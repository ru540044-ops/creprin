import { VDEFS, VDef, VKind } from './defs';
import { parkSlots, GARAGE, collide, groundAt, isWater } from '../world/cityGen';
import { clamp } from '../world/rng';
import { game, toast, ownedCars } from '../state/store';
import { sfx } from '../audio';

export interface Veh {
  id: number; def: VDef; color: string; x: number; z: number; y: number; yaw: number; vx: number; vz: number; yr: number;
  steer: number; hp: number; slot: number; owned: number; touched: boolean; drift: boolean; gear: number; rpm: number;
  braking: boolean; reversing: boolean; spin: number; pitch: number; roll: number; slip: number; dead: boolean; burn: number; lean: number;
  role: '' | 'police' | 'armored'; ai: AI | null; // AI-driven cars carry their driver state
}
/** Per-car AI driver: route on the road grid plus the controls it decided on this frame. */
export interface AI { ctl: Drive | null; ni: number; nj: number; pi: number; pj: number; stuck: number; rev: number; revSteer: number; direct: number; t: number; [k: string]: any }
/** Callbacks the crime / police systems hook into. */
export const hooks = { carHit: (_a: Veh, _b: Veh, _imp: number) => {}, hurtPlayer: (_dmg: number) => {} };
export const vehicles: Veh[] = [];
const activeSlot = new Set<number>();
let nextId = 1;
export const owned = ownedCars;

export function spawn(kind: VKind, x: number, z: number, yaw: number, color?: string, slot = -1, ownedIdx = -1): Veh {
  const def = VDEFS[kind];
  const v: Veh = { id: nextId++, def, color: color || def.colors[0], x, z, y: groundAt(x, z), yaw, vx: 0, vz: 0, yr: 0, steer: 0, hp: def.hp, slot, owned: ownedIdx, touched: false, drift: false, gear: 0, rpm: 0, braking: false, reversing: false, spin: 0, pitch: 0, roll: 0, slip: 0, dead: false, burn: 0, lean: 0, role: '', ai: null };
  vehicles.push(v); if (slot >= 0) activeSlot.add(slot); return v;
}
export function remove(v: Veh) { const i = vehicles.indexOf(v); if (i >= 0) vehicles.splice(i, 1); if (v.slot >= 0 && !v.touched) activeSlot.delete(v.slot); }
export const playerCar = () => vehicles.find((v) => v.id === game.inCar) || null;

/** Keep nearby parked cars instantiated (streaming), plus owned cars at the garage. */
let streamT = 0;
export function stream(px: number, pz: number, dt: number) {
  streamT -= dt; if (streamT > 0) return; streamT = 0.5;
  for (let i = vehicles.length - 1; i >= 0; i--) {
    const v = vehicles[i]; if (v.id === game.inCar || v.owned >= 0 || v.role) continue;
    const d = Math.hypot(v.x - px, v.z - pz);
    if (d > 240 && !v.touched) remove(v);
    else if (d > 520) remove(v); // abandoned cars far away disappear
  }
  parkSlots.forEach((s, i) => {
    if (activeSlot.has(i)) return;
    if (Math.abs(s.x - px) > 170 || Math.abs(s.z - pz) > 170 || Math.hypot(s.x - px, s.z - pz) > 170) return;
    const def = VDEFS[s.kind as VKind]; spawn(s.kind as VKind, s.x, s.z, s.yaw, def.colors[s.ci % def.colors.length], i);
  });
  // owned cars: present in their garage bay unless already somewhere in the world
  owned.forEach((o, i) => {
    if (vehicles.some((v) => v.owned === i)) return;
    if (Math.hypot(GARAGE.x - px, GARAGE.z - pz) > 420) return;
    const sl = GARAGE.slots[i % GARAGE.slots.length]; spawn(o.kind, sl.x, sl.z, sl.yaw, o.color, -1, i);
  });
}

export interface Drive { thr: number; brake: number; steer: number; hb: boolean }
const angWrap = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

/** Arcade bicycle model: grip-limited yaw, tyre slip, gears, handbrake drift, slopes, damage-limited power. */
export function drive(v: Veh, c: Drive | null, dt: number) {
  const d = v.def, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  let fv = v.vx * fx + v.vz * fz, lv = v.vx * fz - v.vz * fx; // forward, lateral(right)
  const sp = Math.abs(fv), health = v.dead ? 0 : 0.35 + 0.65 * clamp(v.hp / d.hp, 0, 1);
  const thr = c && !v.dead ? c.thr : 0, br = c ? c.brake : 0, hb = !!(c && c.hb), st = c ? -c.steer : 0; // input: right = +1
  // steering, softer at speed
  const maxSt = d.steer / (1 + sp / 22);
  v.steer += (st * maxSt - v.steer) * Math.min(1, dt * 8);
  let r = (fv * Math.tan(v.steer)) / d.wheelbase; // positive steer = left = yaw increases
  const latMax = d.grip * 9.81 * (1 + Math.min(0.4, sp / 160));
  if (hb && sp > 6) v.drift = true;
  if (v.drift) r = r * 1.3 + st * 1.1 * Math.min(1, sp / 15) * Math.sign(fv || 1);
  else if (Math.abs(fv * r) > latMax) r = (Math.sign(r) * latMax) / Math.max(1, sp);
  v.yr = r; v.yaw = angWrap(v.yaw + r * dt);
  const nx = Math.sin(v.yaw), nz = Math.cos(v.yaw);
  fv = v.vx * nx + v.vz * nz; lv = v.vx * nz - v.vz * nx;
  // longitudinal
  const top = d.top * health;
  v.braking = false; v.reversing = false;
  if (thr > 0) { if (fv < -0.5) { fv += 9 * thr * dt; v.braking = true; } else { const f = clamp(fv / top, 0, 1); fv += d.accel * thr * Math.max(0, 1.25 - 0.95 * Math.pow(f, 1.7)) * health * dt; } }
  if (br > 0) { if (fv > 1) { fv -= d.brake * d.grip * br * dt; v.braking = true; } else { fv -= d.accel * 0.45 * br * dt; v.reversing = true; } }
  if (hb) fv -= Math.sign(fv) * Math.min(Math.abs(fv), 5 * dt);
  // slope (hills)
  const hF = groundAt(v.x + nx * 1.5, v.z + nz * 1.5), hB = groundAt(v.x - nx * 1.5, v.z - nz * 1.5);
  fv -= ((hF - hB) / 3) * 9.81 * dt;
  fv -= Math.sign(fv) * Math.min(Math.abs(fv), (0.35 + 0.0008 * fv * fv * (60 / d.top)) * (thr === 0 && br === 0 ? 2.2 : 1) * dt * 2);
  fv = clamp(fv, -12, top);
  // lateral tyre grip
  const lg = d.grip * (v.drift ? 5 : 34) * (hb ? 0.4 : 1);
  v.slip = Math.abs(lv);
  lv -= Math.sign(lv) * Math.min(Math.abs(lv), lg * dt);
  if (v.drift && !hb && (Math.abs(lv) < 1.2 || sp < 3)) v.drift = false;
  if (!v.drift && Math.abs(lv) > 4.5 && sp > 9 && thr > 0) v.drift = true;
  // gears / rpm (6 speed)
  const gs = d.top / 6; let g = v.gear;
  if (fv > (g + 1) * gs && g < 5) { g++; } else if (fv < (g - 0.3) * gs && g > 0) g--;
  v.gear = g; v.rpm = clamp((Math.max(0, fv) - g * gs) / gs, 0, 1) * 0.8 + 0.2 * Math.abs(thr);
  v.vx = nx * fv + nz * lv; v.vz = nz * fv - nx * lv;
  const ox = v.x, oz = v.z;
  v.x += v.vx * dt; v.z += v.vz * dt;
  if (isWater(v.x, v.z)) { v.x = ox; v.z = oz; v.vx *= -0.2; v.vz *= -0.2; }
  // body follows terrain / curbs
  const gy = groundAt(v.x, v.z); v.y += (gy - v.y) * Math.min(1, dt * 12);
  v.pitch += (Math.atan2(hF - hB, 3) - v.pitch) * Math.min(1, dt * 8);
  v.roll += (clamp(-v.yr * fv * 0.004, -0.08, 0.08) - v.roll) * Math.min(1, dt * 6);
  v.lean += ((d.kind === 'bike' ? clamp(-v.yr * fv * 0.05, -0.75, 0.75) : 0) - v.lean) * Math.min(1, dt * 6);
  v.spin += (fv / d.wheelR) * dt;
  if (c && Math.hypot(v.vx, v.vz) > 0.5) v.touched = true;
}

/** Resolve car-vs-building and car-vs-car contacts with restitution and damage. Returns the biggest impact speed for the player car. */
export function collisions(dt: number): number {
  let playerHit = 0;
  const circles = (v: Veh) => { const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), r = v.def.wid / 2 + 0.05, n = v.def.kind === 'bike' ? 1 : v.def.kind === 'truck' ? 3 : 2; const out: [number, number, number][] = []; for (let k = 0; k < n; k++) { const t = n === 1 ? 0 : (k / (n - 1) - 0.5) * (v.def.len - v.def.wid); out.push([v.x + fx * t, v.z + fz * t, r]); } return out; };
  for (const v of vehicles) {
    const moving = Math.abs(v.vx) + Math.abs(v.vz) > 0.05 || v.id === game.inCar; if (!moving) continue;
    for (const [cx, cz, r] of circles(v)) {
      const p = { x: cx, z: cz }; if (!collide(p, r, v.y + 0.2, 1.4)) continue;
      const dx = p.x - cx, dz = p.z - cz, L = Math.hypot(dx, dz); if (L < 1e-5) continue;
      v.x += dx; v.z += dz; const nx = dx / L, nz = dz / L, vn = v.vx * nx + v.vz * nz;
      if (vn < 0) { v.vx -= 1.35 * vn * nx; v.vz -= 1.35 * vn * nz; v.vx *= 0.8; v.vz *= 0.8; const imp = -vn; hurt(v, imp); if (v.id === game.inCar) playerHit = Math.max(playerHit, imp); }
    }
  }
  for (let i = 0; i < vehicles.length; i++) for (let j = i + 1; j < vehicles.length; j++) {
    const a = vehicles[i], b = vehicles[j]; if (Math.abs(a.x - b.x) > 10 || Math.abs(a.z - b.z) > 10) continue;
    for (const [ax, az, ar] of circles(a)) for (const [bx, bz, brr] of circles(b)) {
      const dx = bx - ax, dz = bz - az, d2 = dx * dx + dz * dz, R = ar + brr; if (d2 >= R * R || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, pen = R - d, ma = a.def.mass, mb = b.def.mass, ia = 1 / ma, ib = 1 / mb, s = ia + ib;
      a.x -= nx * pen * (ia / s); a.z -= nz * pen * (ia / s); b.x += nx * pen * (ib / s); b.z += nz * pen * (ib / s);
      const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (rv < 0) { const J = (-1.3 * rv) / s; a.vx -= J * ia * nx; a.vz -= J * ia * nz; b.vx += J * ib * nx; b.vz += J * ib * nz; const imp = -rv; hurt(a, imp * (mb / (ma + mb)) * 2 * (b.role === 'armored' ? 0.45 : 1)); hurt(b, imp * (ma / (ma + mb)) * 2 * (a.role === 'armored' ? 0.45 : 1)); a.touched = b.touched = true; if (a.id === game.inCar || b.id === game.inCar) playerHit = Math.max(playerHit, imp); hooks.carHit(a, b, imp); }
    }
  }
  return playerHit;
}

export function hurt(v: Veh, imp: number) {
  if (imp < 3.5 || v.dead) return;
  v.hp -= (imp - 3) * 3.2 * (100 / v.def.hp) * 0.8;
  if (imp > 6) sfx('crash', Math.min(1, imp / 25));
  if (v.hp <= 0) { v.hp = 0; v.dead = true; v.burn = 8; if (v.id === game.inCar) toast('車が大破した。降りよう！', 3); }
}

/** Bring owned car #i to a free spot beside (px,pz). Returns false when no spot is free. */
export function deliverNear(i: number, px: number, pz: number, yaw: number): boolean {
  const o = owned[i]; if (!o) return false;
  let v = vehicles.find((q) => q.owned === i) || null;
  if (v && v.id === game.inCar) return false;
  const def = VDEFS[o.kind], r = Math.max(2.4, def.len / 2 + 0.3);
  const tries: [number, number][] = [[Math.PI / 2, def.wid / 2 + 1.6], [-Math.PI / 2, def.wid / 2 + 1.6], [Math.PI / 2, 4.5], [-Math.PI / 2, 4.5], [Math.PI, 6], [0, 7], [Math.PI / 2, 8], [-Math.PI / 2, 8], [Math.PI * 0.75, 9], [-Math.PI * 0.75, 9], [Math.PI, 11], [0, 12]];
  for (const [a, d] of tries) {
    const x = px + Math.sin(yaw + a) * d, z = pz + Math.cos(yaw + a) * d;
    if (isWater(x, z)) continue;
    const q = { x, z }; if (collide(q, r, 0.4, 1.4)) continue;
    if (vehicles.some((w) => w !== v && Math.hypot(w.x - x, w.z - z) < r + w.def.len / 2)) continue;
    if (!v) v = spawn(o.kind, x, z, yaw, o.color, -1, i);
    else { v.x = x; v.z = z; v.y = groundAt(x, z); v.vx = v.vz = v.yr = 0; v.yaw = yaw; v.drift = false; }
    v.touched = true; return true;
  }
  return false;
}

/** Sell owned car #i: removes it from the world and shifts the remaining garage indices. */
export function sellOwned(i: number): number {
  const o = owned[i]; if (!o) return 0;
  const v = vehicles.find((q) => q.owned === i); if (v && v.id === game.inCar) return 0;
  if (v) remove(v);
  owned.splice(i, 1); for (const q of vehicles) if (q.owned > i) q.owned--;
  // owned cars parked in the garage move to their new bay index
  for (const q of vehicles) if (q.owned >= 0 && !q.touched) { const sl = GARAGE.slots[q.owned % GARAGE.slots.length]; q.x = sl.x; q.z = sl.z; q.yaw = sl.yaw; }
  return Math.round(VDEFS[o.kind].price * 0.5);
}

export function repairAll() { for (const v of vehicles) if (v.owned >= 0) { v.hp = v.def.hp; v.dead = false; v.burn = 0; } }
export { activeSlot };
