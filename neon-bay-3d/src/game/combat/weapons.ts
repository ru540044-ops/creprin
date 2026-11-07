import { game, toast, save } from '../state/store';
import { vehicles, Veh } from '../vehicles/sim';
import { peds, Ped, hitPed, scare } from '../ai/peds';
import { panic } from '../ai/traffic';
import { pointBlocked } from '../world/cityGen';
import { clearLine } from '../ai/driver';
import { setWanted, copSees, armored } from '../crime/crime';
import { flash, tracer, impact } from './fx';
import { sfx } from '../audio';
import { admin } from '../admin';
import { throwGrenade } from './explode';

export type WeaponId = 'fist' | 'pistol' | 'smg' | 'grenade';
export const WEAPONS: Record<WeaponId, { name: string; dmg: number; rate: number; range: number; carDmg: number; acc: number; pack: number; price: number; ammoPrice: number }> = {
  fist: { name: '素手', dmg: 22, rate: 0.45, range: 1.7, carDmg: 0, acc: 1, pack: 0, price: 0, ammoPrice: 0 },
  pistol: { name: 'ピストル', dmg: 34, rate: 0.3, range: 60, carDmg: 6, acc: 0.85, pack: 36, price: 1200, ammoPrice: 150 },
  grenade: { name: 'グレネード', dmg: 0, rate: 0.9, range: 0, carDmg: 0, acc: 1, pack: 5, price: 0, ammoPrice: 600 },
  smg: { name: 'SMG', dmg: 17, rate: 0.085, range: 50, carDmg: 3, acc: 0.62, pack: 120, price: 4500, ammoPrice: 400 },
};
export const ARMOR_PRICE = 800;

/** What the auto-aim is locked onto. */
export type Target = { ped: Ped } | { veh: Veh };
export const combat = { cool: 0, lock: null as Target | null, punchT: 0, recoil: 0, lastShot: 0, reload: 0, reloadDur: 1 };
export const MAG = { pistol: 12, smg: 30 };
/** Start a reload if the magazine is not full and there is spare ammo. */
export function startReload() {
  const id = game.arms.cur as 'pistol' | 'smg'; if (id !== 'pistol' && id !== 'smg' || combat.reload > 0) return;
  if (game.arms.mag[id] >= MAG[id] || game.arms.ammo[id] <= 0) return;
  combat.reloadDur = combat.reload = id === 'smg' ? 1.7 : 1.15; sfx('door', 0.35);
}
/** Called every frame: finish reloads (moves rounds from the reserve into the magazine). */
export function tickWeapons(dt: number) {
  if (combat.reload > 0 && (combat.reload -= dt) <= 0) { const id = game.arms.cur as 'pistol' | 'smg'; if (id === 'pistol' || id === 'smg') { const n = Math.min(MAG[id] - game.arms.mag[id], game.arms.ammo[id]); game.arms.mag[id] += n; game.arms.ammo[id] -= n; sfx('ui', 0.6); } }
}

export const armed = () => game.arms.cur !== 'fist';
export function cycleWeapon() {
  combat.reload = 0;
  const order: WeaponId[] = ['fist', 'pistol', 'smg', 'grenade'], have = order.filter((w) => w === 'fist' || (w === 'grenade' ? game.arms.ammo.grenade > 0 : game.arms.owned[w as 'pistol' | 'smg']));
  const i = have.indexOf(game.arms.cur as WeaponId); game.arms.cur = have[(i + 1) % have.length]; sfx('ui');
  toast(WEAPONS[game.arms.cur as WeaponId].name, 0.9);
}

const tPos = (t: Target) => ('ped' in t ? { x: t.ped.x, y: t.ped.y + 1.1, z: t.ped.z } : { x: t.veh.x, y: t.veh.y + 0.9, z: t.veh.z });
const alive = (t: Target) => ('ped' in t ? t.ped.state !== 'dead' && peds.includes(t.ped) : !t.veh.dead && vehicles.includes(t.veh));

/** Soft lock: the living target closest to the aim direction inside a narrow cone (touch screens need the help). */
export function findLock(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, range: number): Target | null {
  let best: Target | null = null, ba = game.isTouch ? 0.24 : 0.12;
  const consider = (t: Target) => {
    const p = tPos(t), vx = p.x - ox, vy = p.y - oy, vz = p.z - oz, d = Math.hypot(vx, vy, vz); if (d > range || d < 0.5) return;
    const a = Math.acos(Math.max(-1, Math.min(1, (vx * dx + vy * dy + vz * dz) / d))); if (a >= ba) return;
    if (!clearLine(ox, oz, p.x, p.z, Math.min(oy, p.y))) return; ba = a; best = t;
  };
  for (const p of peds) if (p.state !== 'dead') consider({ ped: p });
  for (const v of vehicles) if (!v.dead && v.id !== game.inCar && (v.role || Math.hypot(v.vx, v.vz) > 1)) consider({ veh: v });
  return best;
}

function damageVehicle(v: Veh, dmg: number) {
  v.hp -= dmg; v.touched = true;
  if (v.role === 'traffic') panic(v);
  if (v.role === 'armored' && v === armored.v && (armored.state === 'drive' || armored.state === 'alert')) { armored.dmg += dmg * 0.22; if (armored.state === 'drive') { armored.state = 'alert'; setWanted(Math.max(1, game.wanted), '現金輸送車を襲撃'); } }
  if (v.role === 'police') setWanted(Math.max(3, game.wanted), '警察を撃った');
  if (v.hp <= 0 && !v.dead) { v.hp = 0; v.dead = true; v.burn = 4.5; sfx('crash', 0.9); if (v.role === 'police') setWanted(Math.min(5, game.wanted + 1), 'パトカーを破壊'); }
}

/** Fire the current weapon from (ox,oy,oz) along (dx,dy,dz). Returns true if a shot/punch happened. */
export function fire(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, moving: boolean): boolean {
  if (combat.cool > 0) return false;
  const id = game.arms.cur as WeaponId, W = WEAPONS[id];
  combat.cool = W.rate;
  if (id === 'grenade') { // lob a grenade along the aim direction
    if (game.arms.ammo.grenade <= 0) { game.arms.cur = 'fist'; return false; }
    if (!(admin.is && admin.infAmmo)) game.arms.ammo.grenade--; combat.punchT = 0.3; throwGrenade(ox, oy, oz, dx, dy, dz);
    if (game.arms.ammo.grenade <= 0) setTimeout(() => { if (game.arms.cur === 'grenade' && game.arms.ammo.grenade <= 0) game.arms.cur = 'fist'; }, 400);
    return true;
  }
  if (id === 'fist') { // punch whatever is right in front
    combat.punchT = 0.3; sfx('door', 0.5);
    let hit: Ped | null = null, bd = W.range;
    for (const p of peds) { if (p.state === 'dead') continue; const vx = p.x - ox, vz = p.z - oz, d = Math.hypot(vx, vz); if (d < bd && (vx * dx + vz * dz) / (d || 1) > 0.5) { bd = d; hit = p; } }
    if (hit) { hitPed(hit, W.dmg, dx * 3, dz * 3, true); impact(hit.x, hit.y + 1.4, hit.z, false); if (copSees(hit.x, hit.z, 50)) setWanted(Math.max(1, game.wanted), '暴行'); }
    return true;
  }
  if (combat.reload > 0) return false;
  const gid = id as 'pistol' | 'smg';
  if (game.arms.mag[gid] <= 0) { if (game.arms.ammo[gid] > 0) startReload(); else { combat.cool = 0.4; sfx('ui'); toast('弾切れ（BAY ARMSで購入）', 1.2); } return false; }
  if (!(admin.is && admin.infAmmo)) game.arms.mag[gid] -= 1; if (game.arms.mag[gid] === 0 && game.arms.ammo[gid] > 0) setTimeout(startReload, 150);
  combat.recoil = 1; combat.lastShot = performance.now();
  flash(ox + dx * 0.4, oy + dy * 0.4, oz + dz * 0.4, id === 'smg' ? 0.8 : 1); sfx('shot', id === 'smg' ? 0.55 : 0.8);
  scare(ox, oz, 55);
  if (copSees(ox, oz, 80)) setWanted(Math.max(2, game.wanted), '発砲を目撃された');
  // locked target: hit roll; otherwise march the ray
  let hx = ox + dx * W.range, hy = oy + dy * W.range, hz = oz + dz * W.range, what: Target | null = null;
  const L = combat.lock && alive(combat.lock) ? combat.lock : null;
  if (L && Math.random() < W.acc * (moving ? 0.8 : 1)) { const p = tPos(L); hx = p.x + (Math.random() - 0.5) * 0.3; hy = p.y + (Math.random() - 0.5) * 0.4; hz = p.z + (Math.random() - 0.5) * 0.3; what = L; }
  else {
    const sx = L ? (Math.random() - 0.5) * 0.06 : 0, sz = L ? (Math.random() - 0.5) * 0.06 : 0;
    const ddx = dx + sx, ddz = dz + sz;
    outer: for (let t = 0.6; t < W.range; t += 0.45) {
      const x = ox + ddx * t, y = oy + dy * t, z = oz + ddz * t;
      if (pointBlocked(x, y, z) || y < 0) { hx = x; hy = y; hz = z; break; }
      for (const p of peds) if (p.state !== 'dead' && Math.abs(p.x - x) < 0.4 && Math.abs(p.z - z) < 0.4 && y > p.y && y < p.y + 1.8) { what = { ped: p }; hx = x; hy = y; hz = z; break outer; }
      for (const v of vehicles) {
        if (v.id === game.inCar) continue; const vx = x - v.x, vz = z - v.z; if (Math.abs(vx) > 5 || Math.abs(vz) > 5) continue;
        const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
        if (Math.abs(vx * fx + vz * fz) < v.def.len / 2 && Math.abs(vx * fz - vz * fx) < v.def.wid / 2 && y < v.y + v.def.hgt) { what = { veh: v }; hx = x; hy = y; hz = z; break outer; }
      }
    }
  }
  tracer(ox + dx * 0.5, oy + dy * 0.5, oz + dz * 0.5, hx, hy, hz);
  if (what && 'ped' in what) { hitPed(what.ped, W.dmg, dx * 2, dz * 2, true); impact(hx, hy, hz, true); }
  else if (what && 'veh' in what) { damageVehicle(what.veh, W.carDmg); impact(hx, hy, hz, false); }
  else impact(hx, hy, hz, false);
  return true;
}

export function buy(item: 'pistol' | 'smg' | 'pistolAmmo' | 'smgAmmo' | 'armor' | 'grenades'): string | null {
  const A = game.arms;
  const price = item === 'grenades' ? WEAPONS.grenade.ammoPrice : item === 'pistol' ? WEAPONS.pistol.price : item === 'smg' ? WEAPONS.smg.price : item === 'pistolAmmo' ? WEAPONS.pistol.ammoPrice : item === 'smgAmmo' ? WEAPONS.smg.ammoPrice : ARMOR_PRICE;
  if (game.money < price) return '資金不足';
  if ((item === 'pistolAmmo' && !A.owned.pistol) || (item === 'smgAmmo' && !A.owned.smg)) return '先に本体を買おう';
  if ((item === 'pistol' && A.owned.pistol) || (item === 'smg' && A.owned.smg)) return '購入済み';
  if (item === 'armor' && A.armor >= 100) return '満タン';
  game.money -= price;
  if (item === 'pistol') { A.owned.pistol = true; A.ammo.pistol += WEAPONS.pistol.pack; A.cur = 'pistol'; }
  if (item === 'smg') { A.owned.smg = true; A.ammo.smg += WEAPONS.smg.pack; A.cur = 'smg'; }
  if (item === 'pistolAmmo') A.ammo.pistol += WEAPONS.pistol.pack;
  if (item === 'smgAmmo') A.ammo.smg += WEAPONS.smg.pack;
  if (item === 'armor') A.armor = 100;
  if (item === 'grenades') { A.ammo.grenade += WEAPONS.grenade.pack; if (A.cur === 'fist') A.cur = 'grenade'; }
  for (const g of ['pistol', 'smg'] as const) if (A.owned[g] && A.mag[g] < MAG[g]) { const n = Math.min(MAG[g] - A.mag[g], A.ammo[g]); A.mag[g] += n; A.ammo[g] -= n; }
  sfx('buy'); save(); return null;
}
