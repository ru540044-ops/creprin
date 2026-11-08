import { game, toast, save, ownedCars } from './state/store';
import { vehicles, spawn, remove, playerCar, owned } from './vehicles/sim';
import { VDEFS, VKind, DEALER, isBoat } from './vehicles/defs';
import { hasRoom } from './crime/gifts';
import { peds, scare } from './ai/peds';
import { law, armored, exportJob, newExport, resetRobberies } from './crime/crime';
import { HALF, groundAt, floorAt, doors, GARAGE, AIRPORT, PORT, BEACH_X, POLICE_HQ, HOSPITAL, EXPORT_DOCK, CUSTOMS, HELIPADS, RAMPS, isWater } from './world/cityGen';
import { WEAPONS, MAG } from './combat/weapons';
import { releaseDrive } from './input';
import { sfx } from './audio';
import { setWeather as setWeatherKind, WeatherKind, WEATHER_NAMES } from './world/Weather';

/**
 * Admin (owner-only) powers. Whether the viewer is the admin comes from the claude.ai viewer itself
 * (`user.isOwner()` on the artifact page): only the artifact's owner gets the admin app.
 * Outside claude.ai (a saved copy, the dev server) there is no viewer, so nobody is admin.
 * Note: every viewer receives the same page code; this gates the UI and the actions for
 * normal play, it cannot stop someone who rewrites the page code on their own device.
 */
export const admin = {
  is: false, checked: false,
  god: false, noWanted: false, infAmmo: false, carGod: false, carBoost: false, fastRun: false, superJump: false,
  freezeTime: false, timeScale: 1, density: 1, debug: false,
};

const KEY = 'neonbay3d.admin.v1';
export async function checkAdmin() {
  try {
    const c = (window as unknown as { claude?: { use?: (n: string) => Promise<{ isOwner(): Promise<boolean> } | null> } }).claude;
    const u = c?.use ? await c.use('user') : null;
    admin.is = !!u && (await u.isOwner());
  } catch { admin.is = false; }
  admin.checked = true;
  if (admin.is) { try { Object.assign(admin, JSON.parse(localStorage.getItem(KEY) || '{}'), { is: true, checked: true }); } catch { /* ignore */ } }
  else resetPowers();
}
function resetPowers() { Object.assign(admin, { god: false, noWanted: false, infAmmo: false, carGod: false, carBoost: false, fastRun: false, superJump: false, freezeTime: false, timeScale: 1, density: 1, debug: false }); }
export function saveAdmin() { if (!admin.is) return; try { const { is, checked, ...rest } = admin; void is; void checked; localStorage.setItem(KEY, JSON.stringify(rest)); } catch { /* ignore */ } }
/** Scaled frame time for the simulation (slow motion / fast forward). */
export const timeFx = { slow: 1 }; // stunt-jump slow motion
export const tdt = (dt: number) => dt * (admin.is ? admin.timeScale : 1) * timeFx.slow;

/** Every admin action goes through here: refuses when the viewer is not the admin. */
function guard(): boolean { if (!admin.is) { toast('管理者のみ使用できます', 1.6); return false; } sfx('ui'); return true; }
export type Toggle = 'god' | 'noWanted' | 'infAmmo' | 'carGod' | 'carBoost' | 'fastRun' | 'superJump' | 'freezeTime' | 'debug';
export function toggle(k: Toggle) { if (!guard()) return; admin[k] = !admin[k]; if (k === 'noWanted' && admin.noWanted) clearWanted(); saveAdmin(); }
export function setScale(s: number) { if (!guard()) return; admin.timeScale = s; saveAdmin(); }
export function setDensity(d: number) { if (!guard()) return; admin.density = d; saveAdmin(); if (d === 0) clearArea(true); }

export function addMoney(n: number) { if (!guard()) return; game.money = Math.max(0, game.money + n); save(); toast((n >= 0 ? '+$' : '-$') + Math.abs(n).toLocaleString('en-US'), 1.4); }
export function heal() { if (!guard()) return; game.health = 100; game.arms.armor = 100; game.stamina = 100; const c = playerCar(); if (c) { c.hp = c.def.hp; c.dead = false; c.burn = 0; } toast('体力・アーマー・車を全回復', 1.4); }
export function giveWeapons() {
  if (!guard()) return; const A = game.arms;
  A.owned.pistol = A.owned.smg = true; A.ammo.pistol = Math.max(A.ammo.pistol, 360); A.ammo.smg = Math.max(A.ammo.smg, 900); A.mag.pistol = MAG.pistol; A.mag.smg = MAG.smg; A.armor = 100;
  if (A.cur === 'fist') A.cur = 'pistol'; save(); toast('全武器・弾薬・アーマーを付与', 1.6);
}
export function setWanted(n: number) { if (!guard()) return; if (n === 0) clearWanted(); else { game.wanted = n; law.lastSeen = { x: game.player.x, z: game.player.z }; law.unseen = 0; law.spawnT = 0; } }
function clearWanted() { game.wanted = 0; law.bust = 0; law.unseen = 0; }
export function setHour(h: number) { if (!guard()) return; game.hour = ((h % 24) + 24) % 24; }

/** Spawn any vehicle a few metres in front of the player and (optionally) jump in. */
export function spawnVehicle(kind: VKind, enter: boolean) {
  if (!guard()) return; if (game.where !== 'out') { toast('外で使ってください', 1.4); return; }
  const me = playerCar(), p = game.player, yaw = me ? me.yaw : p.yaw, d = me ? me.def.len + 3 : 5;
  const x = (me ? me.x : p.x) + Math.sin(yaw) * d, z = (me ? me.z : p.z) + Math.cos(yaw) * d;
  if (isBoat(kind) ? !isWater(x, z) : isWater(x, z)) { toast(isBoat(kind) ? '船は水の上で出してください' : 'ここには出せない', 1.4); return; }
  const def = VDEFS[kind], v = spawn(kind, x, z, yaw, def.colors[Math.floor(Math.random() * def.colors.length)]); v.touched = true;
  if (enter && !me) { game.inCar = v.id; releaseDrive(); }
  toast(def.name + 'を出現', 1.2);
}
export function fillGarage() {
  if (!guard()) return; let n = 0;
  for (const k of DEALER) if (hasRoom(k) && !ownedCars.some((o) => o.kind === k)) { ownedCars.push({ kind: k, color: VDEFS[k].colors[0] }); n++; }
  save(); toast(n ? `${n}台を追加（車→ガレージ・船→マリーナ・戦闘機→空港）` : '全車種そろっています', 1.8);
}

export const WARPS: { name: string; at: () => { x: number; z: number } }[] = [
  { name: 'セーフハウス', at: () => { const d = doors.find((q) => q.id === 'home')!; return { x: d.x, z: d.z - 3 }; } },
  { name: 'ガレージ', at: () => ({ x: GARAGE.x, z: GARAGE.z + 6 }) },
  { name: 'BAY ARMS', at: () => { const d = doors.find((q) => q.id === 'arms')!; return { x: d.x + Math.sin(d.ang) * 3, z: d.z + Math.cos(d.ang) * 3 }; } },
  { name: '警察署', at: () => POLICE_HQ.spawn },
  { name: '病院', at: () => HOSPITAL.spawn },
  { name: '輸出ドック', at: () => ({ x: EXPORT_DOCK.x - 12, z: EXPORT_DOCK.z }) },
  { name: '空港', at: () => ({ x: AIRPORT.x0 + 320, z: -165 }) },
  { name: '港', at: () => ({ x: PORT.x0 + 80, z: PORT.z0 + 20 }) },
  { name: 'ビーチ', at: () => ({ x: BEACH_X + 30, z: 0 }) },
  { name: 'ダウンタウン', at: () => ({ x: 0, z: -50 }) },
  { name: 'アップタウン', at: () => ({ x: HALF - 150, z: -HALF + 150 }) },
  { name: 'ベイフロント', at: () => ({ x: HALF - 157, z: 50 }) },
  { name: 'BAY CUSTOMS', at: () => CUSTOMS.spawn },
  ...(['danchi', 'house', 'tower', 'villa'] as const).map((id) => ({ name: { danchi: '団地', house: '一軒家', tower: 'タワマン', villa: '豪邸' }[id], at: () => { const d = doors.find((q) => q.id === 'h_' + id)!; return { x: d.x + Math.sin(d.ang) * 2.5, z: d.z + Math.cos(d.ang) * 2.5 }; } })),
  { name: '屋上ヘリパッド', at: () => { const h = HELIPADS[HELIPADS.length - 1]; return { x: h.x + 9, z: h.z }; } },
  { name: 'ランウェイ・ジャンプ', at: () => { const r = RAMPS[RAMPS.length - 1]; return { x: r.x - Math.sin(r.yaw) * 120, z: r.z - Math.cos(r.yaw) * 120 }; } },
];
export function warp(to: { x: number; z: number }) {
  if (!guard()) return;
  const me = playerCar(), p = game.player;
  game.where = 'out'; game.waypoint = null;
  if (me) { me.x = to.x; me.z = to.z; me.y = groundAt(to.x, to.z); me.vx = me.vz = 0; }
  const y = floorAt(to.x, to.z, 1e4); p.x = to.x; p.z = to.z; p.y = y + 0.05; p.vy = 0; if (me) me.y = me.def.kind === 'heli' ? y : groundAt(to.x, to.z); toast('ワープ', 1);
}
export function warpWaypoint() { if (!game.waypoint) { toast('目的地が設定されていません', 1.4); return; } warp(game.waypoint); }

/** Remove traffic, pedestrians and wrecks around the player (keeps owned cars and the one you drive). */
export function clearArea(silent = false) {
  if (!silent && !guard()) return;
  for (const v of [...vehicles]) if (v.id !== game.inCar && v.owned < 0 && (v.role === 'traffic' || v.dead || v.role === 'police')) remove(v);
  peds.length = 0; if (!silent) toast('周囲を片付けた', 1.2);
}
export function panicAll() { if (!guard()) return; scare(game.player.x, game.player.z, 250); toast('街中がパニック', 1.2); }
export function armoredNow() { if (!guard()) return; if (armored.v) { toast('すでに輸送車が出ている', 1.4); return; } armored.nextT = 0; clearWanted(); toast('現金輸送車を呼んだ（街の中・数秒後）', 1.8); }
export function resetJobs() { if (!guard()) return; resetRobberies(); newExport(); exportJob.cool = 0; toast('強盗のクールダウンと輸出依頼をリセット', 1.6); }
export const ADMIN_KINDS: VKind[] = [...DEALER, 'police', 'armored'];
export function weather(k: WeatherKind) { if (!guard()) return; setWeatherKind(k); toast('天気: ' + WEATHER_NAMES[k], 1.2); }
export { WEAPONS, owned };
