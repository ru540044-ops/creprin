import { VDEFS, VDef, VKind, Mods, stockMods, isBoat, mediumOf } from './defs';
import { parkSlots, GARAGE, MARINA, JETPARK, WATER_Y, collide, groundAt, isWater, floorAt, pointBlocked, SHIN } from '../world/cityGen';
import { clamp } from '../world/rng';
import { game, toast, ownedCars } from '../state/store';
import { sfx } from '../audio';
import { admin } from '../admin';

export interface Veh {
  id: number; def: VDef; color: string; x: number; z: number; y: number; yaw: number; vx: number; vz: number; yr: number;
  steer: number; hp: number; slot: number; owned: number; touched: boolean; drift: boolean; gear: number; rpm: number;
  braking: boolean; reversing: boolean; spin: number; pitch: number; roll: number; slip: number; dead: boolean; burn: number; lean: number;
  role: '' | 'police' | 'armored' | 'traffic' | 'racer'; ai: AI | null;
  door: number; squat: number; blink: number; blinkT: number; gearPrev: number; fvPrev: number; // animation state
  mods: Mods; spd: number; air: boolean; vy: number; gyPrev: number; climb: number; airT: number; rotor: number; nitro: number; nitroOn: boolean; exploded: boolean; // AI-driven cars carry their driver state
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
  const v: Veh = { id: nextId++, def, color: color || def.colors[0], x, z, y: groundAt(x, z), yaw, vx: 0, vz: 0, yr: 0, steer: 0, hp: def.hp, slot, owned: ownedIdx, touched: false, drift: false, gear: 0, rpm: 0, braking: false, reversing: false, spin: 0, pitch: 0, roll: 0, slip: 0, dead: false, burn: 0, lean: 0, role: '', ai: null, door: 0, squat: 0, blink: 0, blinkT: 0, gearPrev: 0, fvPrev: 0, mods: stockMods(), spd: 0, air: false, vy: 0, gyPrev: 0, climb: 0, airT: 0, rotor: 0, nitro: 1, nitroOn: false, exploded: false };
  if (def.kind === 'heli') { v.y = floorAt(x, z, 1e4); v.gyPrev = v.y; }
  if (isBoat(kind)) v.y = WATER_Y;
  vehicles.push(v); if (slot >= 0) activeSlot.add(slot); return v;
}
export function remove(v: Veh) { const i = vehicles.indexOf(v); if (i >= 0) vehicles.splice(i, 1); if (v.slot >= 0 && !v.touched) activeSlot.delete(v.slot); }
export const playerCar = () => vehicles.find((v) => v.id === game.inCar) || null;

/** Where owned vehicle #i lives: garage bays for cars and helicopters, the marina for boats, the airport apron for jets. */
export function ownedSpot(i: number) {
  const o = owned[i], m = mediumOf(o.kind), list = m === 'water' ? MARINA.slots : m === 'air' ? JETPARK.slots : GARAGE.slots;
  let n = 0; for (let j = 0; j < i; j++) if (mediumOf(owned[j].kind) === m) n++;
  const sl = list[n % list.length], def = VDEFS[o.kind];
  return m === 'water' ? { x: sl.x, z: sl.z - def.wid / 2 - (o.kind === 'yacht' ? 1.4 : 0.4), yaw: sl.yaw } : sl;
}
/** Keep nearby parked cars instantiated (streaming), plus owned cars at the garage. */
let streamT = 0;
export function stream(px: number, pz: number, dt: number) {
  streamT -= dt; if (streamT > 0) return; streamT = 0.5;
  for (let i = vehicles.length - 1; i >= 0; i--) {
    const v = vehicles[i]; if (v.id === game.inCar || v.owned >= 0 || v.role || (v.id === game.yachtId && game.where === 'yacht')) continue;
    const d = Math.hypot(v.x - px, v.z - pz);
    if (d > 240 && !v.touched) remove(v);
    else if (d > 520) remove(v); // abandoned cars far away disappear
  }
  // parked cars: the nearest slots first, up to a cap per quality level (each car is a dozen draw calls)
  const cap = game.quality === 'low' ? 24 : game.quality === 'medium' ? 38 : 52;
  let parked = 0; for (const v of vehicles) if (v.slot >= 0) parked++;
  if (parked < cap) {
    const cand: [number, number][] = [];
    parkSlots.forEach((s, i) => { if (activeSlot.has(i) || Math.abs(s.x - px) > 170 || Math.abs(s.z - pz) > 170) return; const d = Math.hypot(s.x - px, s.z - pz); if (d <= 170) cand.push([d, i]); });
    cand.sort((a, b) => a[0] - b[0]);
    for (const [, i] of cand) { if (parked >= cap) break; const s = parkSlots[i], def = VDEFS[s.kind as VKind]; spawn(s.kind as VKind, s.x, s.z, s.yaw, def.colors[s.ci % def.colors.length], i); parked++; }
  }
  // owned cars: present in their garage bay unless already somewhere in the world
  owned.forEach((o, i) => {
    if (vehicles.some((v) => v.owned === i)) return;
    const sl = ownedSpot(i); if (Math.hypot(sl.x - px, sl.z - pz) > 420) return;
    const nv = spawn(o.kind, sl.x, sl.z, sl.yaw, o.color, -1, i); if (o.mods) nv.mods = { ...stockMods(), ...o.mods };
  });
}

export interface Drive { thr: number; brake: number; steer: number; hb: boolean; lift?: number; nitro?: boolean }
const angWrap = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

/** Arcade bicycle model: grip-limited yaw, tyre slip, gears, handbrake drift, slopes, damage-limited power. */
export function drive(v: Veh, c: Drive | null, dt: number) {
  if (v.def.kind === 'shinkansen') return rail(v, c, dt);
  if (v.def.kind === 'heli') return fly(v, c, dt);
  if (v.def.kind === 'jet') return flyJet(v, c, dt);
  if (isBoat(v.def.kind)) return sail(v, c, dt);
  if (v.air) return airborne(v, dt);
  const d = v.def, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  let fv = v.vx * fx + v.vz * fz, lv = v.vx * fz - v.vz * fx; // forward, lateral(right)
  const sp = Math.abs(fv), health = v.dead ? 0 : 0.35 + 0.65 * clamp(v.hp / d.hp, 0, 1);
  const thr = c && !v.dead ? c.thr : 0, br = c ? c.brake : 0, hb = !!(c && c.hb), st = c ? -c.steer : 0; // input: right = +1
  // admin speed multiplier for the car you drive: top speed and power scale with km, brakes and tyre grip with km^1.5 (so it still stops and turns)
  const km = admin.is && v.id === game.inCar ? admin.carSpeed : 1, kg = km > 1 ? Math.pow(km, 1.5) : 1;
  // steering, softer at speed
  const maxSt = d.steer / (1 + sp / (22 * km));
  v.steer += (st * maxSt - v.steer) * Math.min(1, dt * 8);
  let r = (fv * Math.tan(v.steer)) / d.wheelbase; // positive steer = left = yaw increases
  const wet = 1 - game.weather.wet * 0.2, grip = d.grip * wet;
  const latMax = grip * 9.81 * (1 + Math.min(0.4, sp / 160)) * kg;
  if (hb && sp > 6) v.drift = true;
  if (v.drift) r = r * 1.3 + st * 1.1 * Math.min(1, sp / 15) * Math.sign(fv || 1);
  else if (Math.abs(fv * r) > latMax) r = (Math.sign(r) * latMax) / Math.max(1, sp);
  v.yr = r; v.yaw = angWrap(v.yaw + r * dt);
  const nx = Math.sin(v.yaw), nz = Math.cos(v.yaw);
  fv = v.vx * nx + v.vz * nz; lv = v.vx * nz - v.vz * nx;
  // longitudinal
  const boost = admin.is && admin.carBoost && v.id === game.inCar ? 1 : 0;
  const nitroWant = !!(c && c.nitro) && v.mods.nitro && v.nitro > 0.02 && !v.dead;
  if (nitroWant) { v.nitro = Math.max(0, v.nitro - dt / 3); if (!v.nitroOn) sfx('crash', 0.2); } else v.nitro = Math.min(1, v.nitro + dt / 12);
  v.nitroOn = nitroWant;
  const eng = 1 + v.mods.engine * 0.15, nos = nitroWant ? 1 : 0;
  const top = d.top * km * health * (1 + boost * 0.45) * (1 + v.mods.engine * 0.06) * (1 + nos * 0.28);
  v.braking = false; v.reversing = false;
  if (thr > 0) { if (fv < -0.5) { fv += 9 * thr * dt; v.braking = true; } else { const f = clamp(fv / top, 0, 1); fv += d.accel * km * (1 + boost * 0.8) * eng * (1 + nos * 1.3) * Math.max(thr, nos) * Math.max(0, 1.25 - 0.95 * Math.pow(f, 1.7)) * health * dt; } }
  if (br > 0) { if (fv > 1) { fv -= d.brake * d.grip * kg * br * dt; v.braking = true; } else { fv -= d.accel * 0.45 * br * dt; v.reversing = true; } }
  if (hb) fv -= Math.sign(fv) * Math.min(Math.abs(fv), 5 * kg * dt);
  // slope (hills)
  const hF = groundAt(v.x + nx * 1.5, v.z + nz * 1.5), hB = groundAt(v.x - nx * 1.5, v.z - nz * 1.5);
  fv -= ((hF - hB) / 3) * 9.81 * dt;
  fv -= Math.sign(fv) * Math.min(Math.abs(fv), (0.35 + 0.0008 * fv * fv * (60 / (d.top * km))) * (thr === 0 && br === 0 ? 2.2 : 1) * dt * 2);
  fv = clamp(fv, -12, top);
  // lateral tyre grip
  const lg = grip * (v.drift ? 5 : 34) * (hb ? 0.4 : 1) * kg;
  v.slip = Math.abs(lv);
  lv -= Math.sign(lv) * Math.min(Math.abs(lv), lg * dt);
  if (v.drift && !hb && (Math.abs(lv) < 1.2 || sp < 3)) v.drift = false;
  if (!v.drift && Math.abs(lv) > 4.5 * km && sp > 9 && thr > 0) v.drift = true;
  // gears / rpm (6 speed)
  const gs = (d.top * km) / 6; let g = v.gear;
  if (fv > (g + 1) * gs && g < 5) { g++; } else if (fv < (g - 0.3) * gs && g > 0) g--;
  v.gear = g; v.rpm = clamp((Math.max(0, fv) - g * gs) / gs, 0, 1) * 0.8 + 0.2 * Math.abs(thr);
  v.vx = nx * fv + nz * lv; v.vz = nz * fv - nx * lv;
  const ox = v.x, oz = v.z;
  v.x += v.vx * dt; v.z += v.vz * dt;
  if (isWater(v.x, v.z)) { v.x = ox; v.z = oz; v.vx *= -0.2; v.vz *= -0.2; }
  // body follows terrain / curbs
  const gy = groundAt(v.x, v.z), climb = (gy - v.gyPrev) / Math.max(dt, 1e-3);
  if (gy < v.y - 0.32 && Math.abs(fv) > 6) { v.air = true; v.airT = 0; v.vy = clamp(v.climb, 0, 18); }
  else { v.y += (gy - v.y) * Math.min(1, dt * 14); v.climb = v.climb + (clamp(climb, -20, 20) - v.climb) * 0.6; }
  v.gyPrev = gy;
  v.pitch += (Math.atan2(hF - hB, 3) - v.pitch) * Math.min(1, dt * 8);
  v.roll += (clamp(-v.yr * fv * 0.011, -0.11, 0.11) - v.roll) * Math.min(1, dt * 5);
  const la = (fv - v.fvPrev) / Math.max(dt, 1e-3); v.fvPrev = fv;
  v.squat += (clamp(la * 0.0075, -0.065, 0.05) - v.squat) * Math.min(1, dt * 7);
  v.lean += ((d.kind === 'bike' ? clamp(-v.yr * fv * 0.05, -0.75, 0.75) : 0) - v.lean) * Math.min(1, dt * 6);
  v.spin += (fv / d.wheelR) * dt;
  if (c && Math.hypot(v.vx, v.vz) > 0.5) v.touched = true;
}

/** Ballistic flight after leaving a ramp or a crest: no traction, nose follows the arc, hard landings hurt. */
function airborne(v: Veh, dt: number) {
  v.vy -= 9.81 * 1.2 * dt; v.airT += dt;
  const ox = v.x, oz = v.z;
  v.x += v.vx * dt; v.z += v.vz * dt; v.y += v.vy * dt; v.yaw = angWrap(v.yaw + v.yr * 0.4 * dt);
  v.vx *= 1 - 0.02 * dt; v.vz *= 1 - 0.02 * dt;
  if (isWater(v.x, v.z) && v.y < 0.6) { v.x = ox; v.z = oz; v.vx *= -0.2; v.vz *= -0.2; }
  const hs = Math.hypot(v.vx, v.vz);
  v.pitch += (clamp(Math.atan2(v.vy, Math.max(5, hs)) * 0.8, -0.55, 0.45) - v.pitch) * Math.min(1, dt * 3);
  v.spin += (hs / v.def.wheelR) * dt * 0.6; v.nitroOn = false;
  const gy = groundAt(v.x, v.z);
  if (v.y <= gy) {
    const imp = -v.vy; v.y = gy; v.air = false; v.vy = 0; v.gyPrev = gy; v.climb = 0; v.squat = -0.06;
    if (imp > 8) hurt(v, imp * 0.4 + 1);
    if (imp > 4) sfx('crash', Math.min(0.8, imp / 20));
    if (v.id === game.inCar) game.shake = Math.min(1.2, game.shake + imp / 14);
  }
}

/** Helicopter: rotor spin-up, collective lift, cyclic tilt, yaw; lands on ground or roofs; crashes into buildings and water. */
function fly(v: Veh, c: Drive | null, dt: number) {
  const d = v.def, on = !!c && !v.dead;
  v.rotor = clamp(v.rotor + (on ? dt * 0.55 : -dt * 0.2), 0, 1);
  v.spin += v.rotor * dt * 36;
  const floor = floorAt(v.x, v.z, v.y + 0.5), grounded = v.y <= floor + 0.06, power = v.rotor > 0.85;
  const lift = on && power ? clamp(c!.lift || 0, -1, 1) : 0;
  let targetVy = power ? lift * 8.5 : on ? -2 : grounded ? 0 : -7;
  if (power && targetVy < 0) targetVy = Math.max(targetVy, -(0.8 + (v.y - floor) * 0.6)); // landing assist: slow down near the ground
  v.vy += (targetVy - v.vy) * Math.min(1, dt * (power ? 2.4 : 0.8));
  const air = !grounded || v.vy > 0.3;
  const fwd = on && air ? (c!.thr - c!.brake) : 0, yawIn = on && (air || power) ? -c!.steer : 0;
  v.yr += (yawIn * d.steer - v.yr) * Math.min(1, dt * 3);
  v.yaw = angWrap(v.yaw + v.yr * dt);
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  v.vx += fx * fwd * d.accel * dt * (1 + v.mods.engine * 0.15); v.vz += fz * fwd * d.accel * dt * (1 + v.mods.engine * 0.15);
  const lv = v.vx * fz - v.vz * fx; v.vx -= fz * lv * Math.min(1, dt * 0.9); v.vz += fx * lv * Math.min(1, dt * 0.9);
  const drag = Math.min(1, dt * (air ? 0.35 : 5)); v.vx -= v.vx * drag; v.vz -= v.vz * drag;
  const hs = Math.hypot(v.vx, v.vz), top = d.top * (1 + v.mods.engine * 0.06); if (hs > top) { v.vx *= top / hs; v.vz *= top / hs; }
  const ox = v.x, oy = v.y, oz = v.z;
  v.x += v.vx * dt; v.z += v.vz * dt; v.y += v.vy * dt;
  if (pointBlocked(v.x, v.y + 1.4, v.z) || pointBlocked(v.x + fx * 2.6, v.y + 1.6, v.z + fz * 2.6) || pointBlocked(v.x - fx * 5, v.y + 2, v.z - fz * 5)) {
    const imp = Math.hypot(v.vx, v.vy, v.vz); v.x = ox; v.y = oy; v.z = oz; v.vx *= -0.35; v.vz *= -0.35; v.vy *= -0.3;
    if (imp > 5) { hurt(v, imp * 1.2 + 4); if (v.id === game.inCar) game.shake = 1; }
  }
  const fl = floorAt(v.x, v.z, v.y + 1);
  if (v.y < fl) { const imp = -v.vy; v.y = fl; if (v.vy < 0) v.vy = 0; if (imp > 8) hurt(v, imp * 1.5); }
  if (v.y < 0.4 && isWater(v.x, v.z)) { v.hp = 0; v.dead = true; v.burn = 0.5; v.rotor = 0; if (v.id === game.inCar) toast('海に墜落した！', 2.5); }
  v.pitch += ((-fwd * 0.24 - (v.vx * fx + v.vz * fz) * 0.003) - v.pitch) * Math.min(1, dt * 3);
  v.roll += ((-v.yr * 0.12 - lv * 0.01) - v.roll) * Math.min(1, dt * 3);
  v.air = air; v.gear = 0; v.rpm = v.rotor * 0.55 + Math.abs(lift) * 0.3; v.slip = 0; v.braking = false; v.reversing = false;
  if (c && hs > 0.5) v.touched = true;
}

/** Boats: throttle, rudder that bites with speed, keel against sideslip, planing bow lift, swell. Land (and the pier) stops them. */
function sail(v: Veh, c: Drive | null, dt: number) {
  const d = v.def, on = !!c && !v.dead, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  let fv = v.vx * fx + v.vz * fz, lv = v.vx * fz - v.vz * fx;
  const thr = on ? c!.thr : 0, br = on ? c!.brake : 0, st = on ? -c!.steer : 0, nos = on && !!c!.nitro && v.mods.nitro && v.nitro > 0.02;
  if (nos) v.nitro = Math.max(0, v.nitro - dt / 3); else v.nitro = Math.min(1, v.nitro + dt / 12); v.nitroOn = nos;
  const top = d.top * (1 + v.mods.engine * 0.06) * (nos ? 1.3 : 1) * (v.dead ? 0 : 1);
  if (thr > 0) fv += d.accel * (1 + v.mods.engine * 0.15) * (nos ? 1.8 : 1) * thr * Math.max(0, 1 - fv / top) * dt * 1.6;
  if (br > 0) fv -= d.accel * 0.6 * br * dt;
  fv = clamp(fv, -top * 0.3, top);
  fv -= fv * Math.min(1, dt * (thr > 0 ? 0.08 : 0.4)); lv -= lv * Math.min(1, dt * 2.4);
  const yr = st * d.steer * clamp(Math.abs(fv) / 5, 0, 1) * Math.sign(fv || 1);
  v.yr += (yr - v.yr) * Math.min(1, dt * 2.5); v.yaw = angWrap(v.yaw + v.yr * dt);
  const nx = Math.sin(v.yaw), nz = Math.cos(v.yaw); v.vx = nx * fv + nz * lv; v.vz = nz * fv - nx * lv;
  const ox = v.x, oz = v.z; v.x += v.vx * dt; v.z += v.vz * dt;
  const bowX = v.x + nx * d.len * 0.45, bowZ = v.z + nz * d.len * 0.45;
  if (!isWater(v.x, v.z) || !isWater(bowX, bowZ) || pointBlocked(bowX, WATER_Y + 1, bowZ)) { v.x = ox; v.z = oz; const imp = Math.abs(fv); v.vx *= -0.25; v.vz *= -0.25; if (imp > 5) hurt(v, imp * 0.8); }
  const t = performance.now() / 1000 + v.id, sp = Math.hypot(v.vx, v.vz), big = d.len > 15 ? 0.35 : 1;
  v.y = WATER_Y + Math.sin(t * 1.3) * 0.08 * big - (v.dead ? Math.min(3, v.airT += dt * 0.2) : 0);
  v.pitch += ((Math.min(0.13, sp * 0.007) * big + Math.sin(t * 1.1) * 0.025 * big) - v.pitch) * Math.min(1, dt * 3);
  const bank = d.kind === 'jetski' ? clamp(-v.yr * sp * 0.04, -0.6, 0.6) : clamp(-v.yr * sp * 0.012, -0.15, 0.15);
  v.roll += ((bank + Math.sin(t * 0.9) * 0.03 * big) - v.roll) * Math.min(1, dt * 3);
  v.spin += sp * dt; v.rpm = clamp(sp / Math.max(1, top), 0, 1) * 0.8 + 0.2 * thr; v.gear = 0; v.slip = 0; v.braking = false; v.reversing = fv < -0.3; v.air = false;
  if (c && sp > 0.5) v.touched = true;
}

/** Fighter jet: throttle (rotor = throttle setting), afterburner, pitch, bank-to-turn, stall below 60 m/s, runway take-off and landing. */
function flyJet(v: Veh, c: Drive | null, dt: number) {
  const d = v.def, on = !!c && !v.dead, STALL = 60;
  v.rotor = clamp(v.rotor + (on ? (c!.thr - c!.brake) : -0.4) * dt * 0.45, 0, 1);
  const ab = on && !!c!.nitro ? 1 : 0; v.nitroOn = ab > 0;
  const ground = floorAt(v.x, v.z, v.y + 1), onGround = v.y <= ground + 0.06;
  const drag = v.spd * v.spd * 0.00042 + (onGround ? (on && c!.brake > 0 && v.rotor < 0.05 ? 9 : 0.5) : 0);
  v.spd = clamp(v.spd + ((v.rotor * d.accel + ab * 16) * (v.dead ? 0 : 1) - drag - Math.sin(v.pitch) * 9.81) * dt, 0, d.top * (1 + ab * 0.25));
  const pitchIn = on ? clamp(c!.lift || 0, -1, 1) : 0, rollIn = on ? c!.steer : 0;
  if (onGround) {
    v.roll += (0 - v.roll) * Math.min(1, dt * 5);
    v.yaw = angWrap(v.yaw - rollIn * 0.45 * clamp(v.spd / 12, 0, 1) * dt);
    v.pitch += ((v.spd > STALL ? Math.max(0, pitchIn) * 0.28 : 0) - v.pitch) * Math.min(1, dt * 2);
  } else {
    const auth = clamp(v.spd / STALL, 0.25, 1.4);
    v.roll += (rollIn * 1.15 - v.roll) * Math.min(1, dt * 2.6);
    v.pitch = clamp(v.pitch + pitchIn * 0.85 * auth * dt, -1.25, 1.25);
    v.yaw = angWrap(v.yaw - Math.tan(clamp(v.roll, -1.2, 1.2)) * 9.81 / Math.max(45, v.spd) * dt * 1.7);
    if (v.spd < STALL) v.pitch -= ((STALL - v.spd) / STALL) * 0.9 * dt;
  }
  const cp = Math.cos(v.pitch), fx = Math.sin(v.yaw) * cp, fy = Math.sin(v.pitch), fz = Math.cos(v.yaw) * cp;
  const sink = onGround ? 0 : clamp((STALL - v.spd) / STALL, 0, 1) * 16;
  v.vx = fx * v.spd; v.vz = fz * v.spd; v.vy = fy * v.spd - sink;
  v.x += v.vx * dt; v.z += v.vz * dt; v.y += v.vy * dt;
  const crash = (why: string) => { if (v.dead) return; v.hp = 0; v.dead = true; v.burn = 0.05; v.spd = 0; v.vx = v.vz = v.vy = 0; if (v.id === game.inCar) { hooks.hurtPlayer(70); toast(why, 2.5); } };
  if (pointBlocked(v.x + fx * 7, v.y + 2, v.z + fz * 7) || pointBlocked(v.x, v.y + 2, v.z)) crash('建物に激突した！');
  const g2 = floorAt(v.x, v.z, v.y + 1);
  if (v.y < g2) {
    const ok = Math.abs(v.roll) < 0.35 && v.pitch > -0.2 && -v.vy < 7 && !isWater(v.x, v.z);
    if (ok) { v.y = g2; v.pitch = Math.max(0, v.pitch); } else crash(isWater(v.x, v.z) ? '海に墜落した！' : '墜落した！');
  }
  if (v.y > 900) { v.y = 900; v.pitch = Math.min(v.pitch, 0); }
  v.air = v.y > floorAt(v.x, v.z, v.y + 1) + 0.3; v.airT = v.air ? v.airT + dt : 0;
  v.spin += (v.spd / 0.38) * dt * (v.air ? 0 : 1); v.rpm = v.rotor * 0.85 + ab * 0.15; v.gear = 0; v.slip = 0; v.braking = false; v.reversing = false; v.yr = 0;
  if (c && v.spd > 0.5) v.touched = true;
}

/** Resolve car-vs-building and car-vs-car contacts with restitution and damage. Returns the biggest impact speed for the player car. */
/** Train extent from its position (the lead car's centre): nose tip ahead, tail nose behind. */
export const SHIN_HEAD = 16, SHIN_TAIL = 195.2, SHIN_FLIP = 179.2;
/** Track limits for the lead car's centre, facing south (dir 1) or north (dir -1). */
export const shinLimits = (dir: number) => (dir > 0 ? [SHIN.z0 + SHIN_TAIL + 2, SHIN.z1 - SHIN_HEAD - 2] : [SHIN.z0 + SHIN_HEAD + 2, SHIN.z1 - SHIN_TAIL - 2]);
const ATC_STEPS = [300, 275, 230, 170, 120, 70, 45, 30];
/** Admin speed multiplier for the train you drive (1 for everyone else). */
const trainMul = (v: Veh) => (admin.is && v.id === game.inCar ? admin.trainSpeed : 1);
/** Cab-signal steps for a multiplier: the normal steps scaled up, with the normal low steps kept for the approach to the buffers. */
const stepCache = new Map<number, number[]>();
function atcSteps(km: number) {
  if (km === 1) return ATC_STEPS;
  let s = stepCache.get(km); if (!s) { s = [...new Set([...ATC_STEPS.map((q) => Math.round(q * km)), ...ATC_STEPS])].sort((a, b) => b - a); stepCache.set(km, s); }
  return s;
}
/** Set each frame by the driving logic: the line goes on beyond the tunnel (a trip to the next city), so no braking curve to the north end. */
export const shinRun = { open: false };
/** Cab-signal speed (km/h) for the train: a braking curve to the buffers at the end of the line, shown in the usual ATC steps. */
export function atcKmh(v: Veh) {
  const dir = Math.cos(v.yaw) >= 0 ? 1 : -1, [lo, hi] = shinLimits(dir), d = dir > 0 ? hi - v.z : v.z - lo + (shinRun.open ? 4000 : 0);
  if (d < 2) return 0;
  const km = trainMul(v), curve = Math.sqrt(2 * 2.2 * km * Math.max(0, d - 4)) * 3.6; // service braking at 2.2 m/s2 (times the multiplier) stops before the buffers
  for (const s of atcSteps(km)) if (s <= curve) return s;
  return 30;
}
/** Bullet train on its viaduct: power and brake along the track, ATC limits, buffers at both ends. */
function rail(v: Veh, c: Drive | null, dt: number) {
  const dir = Math.cos(v.yaw) >= 0 ? 1 : -1, thr = c ? c.thr : 0, br = c ? c.brake : 0;
  let sp = v.vz * dir;
  const km = trainMul(v), top = v.def.top * km; // admin speed multiplier: power, brakes and the ATC limits all scale
  if (thr > 0.05 && sp >= -0.2) sp += v.def.accel * km * thr * (1.4 - 0.9 * Math.max(0, sp) / top) * dt;
  if (br > 0.05) sp = Math.max(0, sp - v.def.brake * km * br * dt); // a train does not back up on the brake: overshoot and you are judged on it
  sp *= 1 - 0.0025 * dt;
  const lim = atcKmh(v) / 3.6;
  if (sp > lim + 0.5) sp = Math.max(lim, sp - 4.5 * km * dt); // ATC brake
  const [lo, hi] = shinLimits(dir);
  let z = v.z + dir * sp * dt; if (z < lo) { z = lo; sp = 0; } if (z > hi) { z = hi; sp = 0; }
  v.z = z; v.x = SHIN.x + (v.x >= SHIN.x ? SHIN.track : -SHIN.track); v.y = SHIN.y + 0.05; v.vx = 0; v.vz = dir * sp; v.yr = 0; v.pitch = 0; v.roll = 0; v.air = false; v.vy = 0;
  v.steer = 0; v.braking = br > 0.05; v.reversing = sp < -0.1; v.rpm = Math.min(1, Math.abs(sp) / top); v.gear = sp < -0.1 ? -1 : 1; v.slip = 0; v.spd = Math.abs(sp);
}
export function collisions(dt: number): number {
  let playerHit = 0;
  const circles = (v: Veh) => { const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), r = v.def.colR ?? v.def.wid / 2 + 0.05, n = v.def.kind === 'bike' ? 1 : Math.max(2, Math.round(v.def.len / (r * 2))); const out: [number, number, number][] = []; for (let k = 0; k < n; k++) { const t = n === 1 ? 0 : (k / (n - 1) - 0.5) * (v.def.len - r * 2); out.push([v.x + fx * t, v.z + fz * t, r]); } return out; };
  for (const v of vehicles) {
    const moving = Math.abs(v.vx) + Math.abs(v.vz) > 0.05 || v.id === game.inCar; if (!moving || v.def.kind === 'jet' || v.def.kind === 'shinkansen' || isBoat(v.def.kind)) continue;
    for (const [cx, cz, r] of circles(v)) {
      const p = { x: cx, z: cz }; if (!collide(p, r, v.y + 0.2, 1.4)) continue;
      const dx = p.x - cx, dz = p.z - cz, L = Math.hypot(dx, dz); if (L < 1e-5) continue;
      v.x += dx; v.z += dz; const nx = dx / L, nz = dz / L, vn = v.vx * nx + v.vz * nz;
      if (vn < 0) { v.vx -= 1.35 * vn * nx; v.vz -= 1.35 * vn * nz; v.vx *= 0.8; v.vz *= 0.8; const imp = -vn; hurt(v, imp); if (v.id === game.inCar) playerHit = Math.max(playerHit, imp); }
    }
  }
  for (let i = 0; i < vehicles.length; i++) for (let j = i + 1; j < vehicles.length; j++) {
    const a = vehicles[i], b = vehicles[j]; if (Math.abs(a.x - b.x) > 10 || Math.abs(a.z - b.z) > 10 || Math.abs(a.y - b.y) > 2.2) continue;
    for (const [ax, az, ar] of circles(a)) for (const [bx, bz, brr] of circles(b)) {
      const dx = bx - ax, dz = bz - az, d2 = dx * dx + dz * dz, R = ar + brr; if (d2 >= R * R || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, pen = R - d, ma = a.def.mass, mb = b.def.mass, ia = 1 / ma, ib = 1 / mb, s = ia + ib;
      a.x -= nx * pen * (ia / s); a.z -= nz * pen * (ia / s); b.x += nx * pen * (ib / s); b.z += nz * pen * (ib / s);
      const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (rv < 0) { const J = (-1.3 * rv) / s; a.vx -= J * ia * nx; a.vz -= J * ia * nz; b.vx += J * ib * nx; b.vz += J * ib * nz; const imp = -rv; const soft = a.role === 'racer' || b.role === 'racer' ? 0.3 : 1; hurt(a, imp * (mb / (ma + mb)) * 2 * (b.role === 'armored' ? 0.45 : 1) * soft); hurt(b, imp * (ma / (ma + mb)) * 2 * (a.role === 'armored' ? 0.45 : 1) * soft); a.touched = b.touched = true; if (a.id === game.inCar || b.id === game.inCar) playerHit = Math.max(playerHit, imp); hooks.carHit(a, b, imp); }
    }
  }
  return playerHit;
}

export function hurt(v: Veh, imp: number) {
  if (imp < 3.5 || v.dead) return;
  if (admin.is && admin.carGod && v.id === game.inCar) return;
  v.hp -= ((imp - 3) * 3.2 * (100 / v.def.hp) * 0.8) / (1 + v.mods.armor * 0.5);
  if (imp > 6) sfx('crash', Math.min(1, imp / 25));
  if (v.hp <= 0) { v.hp = 0; v.dead = true; v.burn = 4.5; if (v.id === game.inCar) toast('車が大破した。降りよう！', 3); }
}

/** Bring owned car #i to a free spot beside (px,pz). Returns false when no spot is free. */
export function deliverNear(i: number, px: number, pz: number, yaw: number): boolean {
  const o = owned[i]; if (!o) return false;
  if (mediumOf(o.kind) !== 'land' || o.kind === 'heli') return false; // boats, jets and helicopters stay at their berth / apron / garage
  let v = vehicles.find((q) => q.owned === i) || null;
  if (v && v.id === game.inCar) return false;
  const def = VDEFS[o.kind], r = Math.max(2.4, def.len / 2 + 0.3);
  const tries: [number, number][] = [[Math.PI / 2, def.wid / 2 + 1.6], [-Math.PI / 2, def.wid / 2 + 1.6], [Math.PI / 2, 4.5], [-Math.PI / 2, 4.5], [Math.PI, 6], [0, 7], [Math.PI / 2, 8], [-Math.PI / 2, 8], [Math.PI * 0.75, 9], [-Math.PI * 0.75, 9], [Math.PI, 11], [0, 12]];
  for (const [a, d] of tries) {
    const x = px + Math.sin(yaw + a) * d, z = pz + Math.cos(yaw + a) * d;
    if (isWater(x, z)) continue;
    const q = { x, z }; if (collide(q, r, 0.4, 1.4)) continue;
    if (vehicles.some((w) => w !== v && Math.hypot(w.x - x, w.z - z) < r + w.def.len / 2)) continue;
    if (!v) { v = spawn(o.kind, x, z, yaw, o.color, -1, i); if (o.mods) v.mods = { ...stockMods(), ...o.mods }; }
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
  for (const q of vehicles) if (q.owned >= 0 && !q.touched) { const sl = ownedSpot(q.owned); q.x = sl.x; q.z = sl.z; q.yaw = sl.yaw; }
  return Math.round(VDEFS[o.kind].price * 0.5);
}

export function repairAll() { for (const v of vehicles) if (v.owned >= 0) { v.hp = v.def.hp; v.dead = false; v.burn = 0; } }
export { activeSlot };
