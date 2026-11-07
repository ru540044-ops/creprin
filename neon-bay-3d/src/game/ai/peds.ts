import { game, toast } from '../state/store';
import { vehicles, playerCar, Veh } from '../vehicles/sim';
import { blocks, N, collide, groundAt, HALF, isWater } from '../world/cityGen';
import { pedsAhead } from './traffic';
import { setWanted, copSees } from '../crime/crime';
import { sfx } from '../audio';
import { clamp } from '../world/rng';
import { admin } from '../admin';
import { gaitFor, Gait, IDLE_VARIANTS, IdleVariant } from '../anim/pose';
import { signalState } from '../world/City';
import { combat } from '../combat/weapons';

/** Pedestrians walk the sidewalk ring of each block, cross at corners, and react to danger. */
export type PedState = 'walk' | 'idle' | 'cross' | 'flee' | 'down' | 'dead' | 'hands' | 'wait' | 'cower' | 'handsup' | 'getup';
export interface Ped {
  id: number; x: number; z: number; y: number; yaw: number; vx: number; vz: number; vy: number;
  state: PedState; t: number; blk: number; corner: number; dir: number; tx: number; tz: number;
  hp: number; look: number; phase: number; speed: number; fall: number; scale: number; callT: number; fx: number; fz: number; cash: number;
  gait: Gait; idleV: IdleVariant; idleDur: number; fdir: number; fside: number; head: number; flail: boolean; aimedT: number; crossBlk: number; crossCorner: number;
}
export const peds: Ped[] = [];
export const pickups: { x: number; z: number; y: number; amount: number; t: number }[] = [];
let nextId = 1, spawnT = 0;
const INSET = 2.6;
export const pedCap = () => Math.min(PED_MAX - 4, Math.round((game.quality === 'low' ? 12 : game.quality === 'medium' ? 20 : 28) * (admin.is ? admin.density : 1)));
export const PED_MAX = 40;

const corner = (b: number, c: number) => { const B = blocks[b]; return { x: c === 0 || c === 3 ? B.x0 + INSET : B.x1 - INSET, z: c < 2 ? B.z0 + INSET : B.z1 - INSET }; };
function setTarget(p: Ped) { const c = corner(p.blk, p.corner); p.tx = c.x; p.tz = c.z; }

/** Corner on the neighbouring block straight across the road (for crossing), or null at the city edge. */
function across(b: number, c: number): [number, number] | null {
  const B = blocks[b], horiz = Math.random() < 0.5;
  if (horiz) { const di = c === 0 || c === 3 ? -1 : 1, ni = B.i + di; if (ni < 0 || ni >= N) return null; return [B.j * N + ni, ({ 0: 1, 3: 2, 1: 0, 2: 3 } as Record<number, number>)[c]]; }
  const dj = c < 2 ? -1 : 1, nj = B.j + dj; if (nj < 0 || nj >= N) return null; return [nj * N + B.i, ({ 0: 3, 1: 2, 3: 0, 2: 1 } as Record<number, number>)[c]];
}

function spawnPed(px: number, pz: number) {
  const bx = Math.sin(game.cam.yaw), bz = Math.cos(game.cam.yaw);
  for (let k = 0; k < 16; k++) {
    const bi = clamp(Math.floor((px + HALF) / 100) + Math.round((Math.random() - 0.5) * 4), 0, N - 1), bj = clamp(Math.floor((pz + HALF) / 100) + Math.round((Math.random() - 0.5) * 4), 0, N - 1);
    const b = bj * N + bi, B = blocks[b];
    const cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2; if (Math.hypot(cx - px, cz - pz) > 170) continue;
    const c = Math.floor(Math.random() * 4), a = corner(b, c), e = corner(b, (c + 1) & 3), t = Math.random();
    const x = a.x + (e.x - a.x) * t, z = a.z + (e.z - a.z) * t, d = Math.hypot(x - px, z - pz);
    if (d < 40 || d > 140) continue;
    if (k < 10 && (x - px) * bx + (z - pz) * bz < 0 && d < 90) continue; // do not pop in right in front of the camera
    const p: Ped = { id: nextId++, x, z, y: groundAt(x, z), yaw: 0, vx: 0, vz: 0, vy: 0, state: 'walk', t: 0, blk: b, corner: (c + 1) & 3, dir: 1, tx: 0, tz: 0, hp: 100, look: Math.floor(Math.random() * 1e6), phase: Math.random() * 6, speed: 1.2 + Math.random() * 0.5, fall: 0, scale: 0.92 + Math.random() * 0.16, callT: 0, fx: 0, fz: 0, cash: 10 + Math.floor(Math.random() * 60), gait: gaitFor(0), idleV: 'look' as IdleVariant, idleDur: 1, fdir: 1, fside: 0, head: 0, flail: false, aimedT: 0, crossBlk: 0, crossCorner: 0 };
    p.gait = gaitFor(p.look); p.speed = p.gait.speed; p.flail = Math.random() < 0.5;
    if (Math.random() < 0.5) { p.dir = -1; p.corner = c; }
    setTarget(p); peds.push(p); return p;
  }
  return null;
}

/** A ped who just got out of a car (carjacked driver): runs away. */
export function ejectPed(x: number, z: number, fromX: number, fromZ: number) {
  if (peds.length >= PED_MAX) peds.shift();
  const p: Ped = { id: nextId++, x, z, y: groundAt(x, z), yaw: 0, vx: 0, vz: 0, vy: 0, state: 'flee', t: 7, blk: 0, corner: 0, dir: 1, tx: x, tz: z, hp: 100, look: Math.floor(Math.random() * 1e6), phase: 0, speed: 1.4, fall: 0, scale: 1, callT: Math.random() < 0.6 ? 6 : 0, fx: fromX, fz: fromZ, cash: 40, gait: gaitFor(0), idleV: 'look' as IdleVariant, idleDur: 1, fdir: 1, fside: 0, head: 0, flail: false, aimedT: 0, crossBlk: 0, crossCorner: 0 };
  p.gait = gaitFor(p.look); p.flail = true;
  peds.push(p); return p;
}

/** Everyone within r runs away from (x,z). */
export function scare(x: number, z: number, r: number) {
  for (const p of peds) if ((p.state === 'walk' || p.state === 'idle' || p.state === 'cross' || p.state === 'wait') && Math.hypot(p.x - x, p.z - z) < r) {
    if (Math.hypot(p.x - x, p.z - z) < 16 && Math.random() < 0.35) { p.state = 'cower'; p.t = 2 + Math.random() * 2.5; } else { p.state = 'flee'; p.t = 6 + Math.random() * 4; }
    p.fx = x; p.fz = z;
  }
}

/** Damage a ped. Knockdown for big hits, death at 0 hp (drops cash). byPlayer drives the police reaction. */
export function hitPed(p: Ped, dmg: number, kx: number, kz: number, byPlayer: boolean) {
  if (p.state === 'dead') return;
  p.hp -= dmg; if (p.hp < 60) p.gait = { ...p.gait, limp: 0.7 };
  if (p.hp <= 0) {
    p.state = 'dead'; p.t = 40; p.fdir = (kx * Math.sin(p.yaw) + kz * Math.cos(p.yaw)) > 0 ? -1 : 1; p.fside = (Math.random() - 0.5) * 1.4; p.vx = kx; p.vz = kz; p.vy = Math.min(5, Math.hypot(kx, kz) * 0.35);
    pickups.push({ x: p.x, z: p.z, y: p.y, amount: p.cash, t: 45 });
    if (byPlayer) { if (copSees(p.x, p.z, 70)) setWanted(Math.max(2, game.wanted), '警察の目の前で人を倒した'); else if (Math.random() < 0.35) setTimeout(() => { if (game.wanted < 1) setWanted(1, '目撃者が通報した'); }, 5000); }
  } else if (dmg >= 18 || Math.hypot(kx, kz) > 4) {
    p.state = 'down'; p.t = 2.5 + Math.random() * 1.5; p.fdir = (kx * Math.sin(p.yaw) + kz * Math.cos(p.yaw)) > 0 ? -1 : 1; p.fside = (Math.random() - 0.5); p.vx = kx; p.vz = kz; p.vy = Math.min(4, Math.hypot(kx, kz) * 0.3);
    if (byPlayer && Math.random() < 0.5) p.callT = 7;
  } else { p.state = 'flee'; p.t = 7; p.fx = p.x - kx; p.fz = p.z - kz; }
  scare(p.x, p.z, 18);
}

/** Mugging at gunpoint: hands up for a moment, then hands over the cash and runs. */
export function mug(p: Ped) { p.state = 'hands'; p.t = 1.6; p.cash = 30 + Math.floor(Math.random() * 150); p.vx = p.vz = 0; p.yaw = Math.atan2(game.player.x - p.x, game.player.z - p.z); }

export function nearestPed(x: number, z: number, r: number, alive = true): Ped | null {
  let best: Ped | null = null, bd = r;
  for (const p of peds) { if (alive && (p.state === 'dead' || p.state === 'down')) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
  return best;
}

function carHits(p: Ped, v: Veh) {
  const sp = Math.hypot(v.vx, v.vz); if (sp < 2.5) return false;
  const dx = p.x - v.x, dz = p.z - v.z; if (Math.abs(dx) > 6 || Math.abs(dz) > 6) return false;
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), lf = dx * fx + dz * fz, ls = dx * fz - dz * fx;
  if (Math.abs(lf) > v.def.len / 2 + 0.35 || Math.abs(ls) > v.def.wid / 2 + 0.35) return false;
  const mine = v.id === game.inCar;
  hitPed(p, sp * 6, v.vx * 0.8 + fz * Math.sign(ls) * 1.5, v.vz * 0.8 - fx * Math.sign(ls) * 1.5, mine);
  sfx('crash', Math.min(0.6, sp / 30)); v.vx *= 0.92; v.vz *= 0.92;
  if (mine && copSees(p.x, p.z, 60)) setWanted(Math.max(1, game.wanted), '人をはねた');
  return true;
}

export function updatePeds(dt: number) {
  const out = game.where === 'out', pl = out ? game.player : game.outsidePos, me = playerCar();
  const inCity = Math.abs(pl.x) < HALF + 30 && Math.abs(pl.z) < HALF + 30;
  // despawn
  for (let i = peds.length - 1; i >= 0; i--) { const p = peds[i], d = Math.hypot(p.x - pl.x, p.z - pl.z); if (d > 175 || (p.state === 'dead' && (p.t -= dt) <= 0)) peds.splice(i, 1); }
  spawnT -= dt;
  if (inCity && game.started && spawnT <= 0 && peds.filter((p) => p.state !== 'dead').length < pedCap()) { spawnPed(pl.x, pl.z); spawnT = 0.35; }
  pedsAhead.length = 0;
  for (const p of peds) {
    p.t -= dt;
    if (p.state === 'getup') { if (p.t <= 0) { p.state = 'flee'; p.t = 7; p.fx = pl.x; p.fz = pl.z; p.fall = 0; } continue; }
    if (p.state === 'dead' || p.state === 'down') {
      // tumble with the knock velocity, then lie there
      p.vy -= 18 * dt; p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt; const g = groundAt(p.x, p.z);
      if (p.y <= g) { p.y = g; p.vy = 0; p.vx *= 1 - Math.min(1, dt * 6); p.vz *= 1 - Math.min(1, dt * 6); }
      collide(p, 0.3, p.y, 0.5); p.fall = Math.min(1, p.fall + dt * 5);
      if (p.state === 'down' && p.t <= 0) { p.state = 'getup'; p.t = 1.0; }
      continue;
    }
    p.fall = Math.max(0, p.fall - dt * 3);
    // dodge cars bearing down on us; get hit otherwise
    for (const v of vehicles) {
      if (carHits(p, v)) break;
      const sp = Math.hypot(v.vx, v.vz); if (sp < 7) continue;
      const dx = p.x - v.x, dz = p.z - v.z, d = Math.hypot(dx, dz); if (d > 12) continue;
      if ((dx * v.vx + dz * v.vz) / (d * sp) > 0.8 && p.state !== 'flee') { p.state = 'flee'; p.t = 3; p.fx = v.x; p.fz = v.z; }
    }
    const st2 = p.state as PedState; if (st2 === 'down' || st2 === 'dead') continue;
    let wx = 0, wz = 0, sp = 0;
    // being aimed at: hands up (or bolt)
    const L = combat.lock, aimed = !!L && 'ped' in L && L.ped === p;
    if (aimed && (p.state === 'walk' || p.state === 'idle' || p.state === 'cross' || p.state === 'wait')) { if (Math.random() < 0.65) { p.state = 'handsup'; p.t = 99; } else { p.state = 'flee'; p.t = 7; p.fx = pl.x; p.fz = pl.z; } }
    if (p.state === 'handsup') { p.aimedT = aimed ? 0 : p.aimedT + dt; p.yaw += angDiff(p.yaw, Math.atan2(pl.x - p.x, pl.z - p.z)) * Math.min(1, dt * 6); if (p.aimedT > 1.8) { p.state = 'flee'; p.t = 7; p.fx = pl.x; p.fz = pl.z; p.aimedT = 0; } }
    else if (p.state === 'cower') { if (p.t <= 0) { p.state = 'flee'; p.t = 6; } }
    else if (p.state === 'wait') { // at the kerb until the cars on that road get a red light
      const B = blocks[p.blk], ni = p.corner === 0 || p.corner === 3 ? B.i : B.i + 1, nj = p.corner < 2 ? B.j : B.j + 1, horiz = Math.abs(corner(p.crossBlk, p.crossCorner).x - p.x) > 3;
      const ok = (ni + nj) % 2 !== 0 || signalState(ni, nj, horiz ? 0 : 1, game.clock) === 2;
      if (ok || p.t <= 0) { p.blk = p.crossBlk; p.corner = p.crossCorner; p.state = 'cross'; setTarget(p); }
    }
    else if (p.state === 'hands') {
      if (p.t <= 0) { game.money += p.cash; sfx('buy'); toast('+$' + p.cash + '（カツアゲ）', 1.8); p.cash = 0; p.state = 'flee'; p.t = 8; p.fx = game.player.x; p.fz = game.player.z; if (Math.random() < 0.45) p.callT = 5; }
    } else if (p.state === 'flee') {
      const dx = p.x - p.fx, dz = p.z - p.fz, L = Math.hypot(dx, dz) || 1; wx = dx / L; wz = dz / L; sp = 5.2;
      if (p.t <= 0) { // calm down: return to the nearest block's sidewalk
        let bi = 0, bd = 1e9; blocks.forEach((B, i) => { const d = Math.hypot((B.x0 + B.x1) / 2 - p.x, (B.z0 + B.z1) / 2 - p.z); if (d < bd) { bd = d; bi = i; } });
        p.blk = bi; p.corner = Math.floor(Math.random() * 4); p.state = 'walk'; setTarget(p);
      }
    } else if (p.state === 'idle') { if (p.t <= 0) p.state = 'walk'; }
    else {
      const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
      if (d < 0.6) {
        if (p.state === 'cross') { p.state = 'walk'; }
        const r = Math.random();
        if (r < 0.2 && p.gait.kind !== 'jogger') { p.state = 'idle'; p.t = 3 + Math.random() * 6; p.idleDur = p.t; p.idleV = IDLE_VARIANTS[1 + Math.floor(Math.random() * (IDLE_VARIANTS.length - 1))]; }
        else if (r < 0.4) { const a = across(p.blk, p.corner); if (a) { p.crossBlk = a[0]; p.crossCorner = a[1]; p.state = 'wait'; p.t = 18; continue; } }
        p.corner = (p.corner + p.dir + 4) & 3; setTarget(p);
      } else { wx = dx / d; wz = dz / d; sp = p.speed * (p.state === 'cross' ? 1.3 : 1); }
    }
    if (p.callT > 0 && (p.callT -= dt) <= 0 && game.wanted === 0) setWanted(1, '通行人が警察に通報した');
    const k = Math.min(1, dt * 8); p.vx += (wx * sp - p.vx) * k; p.vz += (wz * sp - p.vz) * k;
    const ox = p.x, oz = p.z; p.x += p.vx * dt; p.z += p.vz * dt;
    if (collide(p, 0.32, p.y + 0.1, 1.6) && p.state === 'flee') { p.fx = ox - (p.x - ox) * 10 + (Math.random() - 0.5) * 20; p.fz = oz - (p.z - oz) * 10 + (Math.random() - 0.5) * 20; }
    if (isWater(p.x, p.z)) { p.x = ox; p.z = oz; }
    // keep out of the walking player
    if (out && !me) { const dx = p.x - pl.x, dz = p.z - pl.z, d = Math.hypot(dx, dz); if (d < 0.7 && d > 1e-3) { p.x += (dx / d) * (0.7 - d); p.z += (dz / d) * (0.7 - d); } }
    p.y += (groundAt(p.x, p.z) - p.y) * Math.min(1, dt * 12);
    const s = Math.hypot(p.vx, p.vz); if (s > 0.2) p.yaw += angDiff(p.yaw, Math.atan2(p.vx, p.vz)) * Math.min(1, dt * 10);
    p.phase += dt * (s > 0.15 ? 2.5 + s * 1.2 : 0) * p.gait.cadence;
    // glance at the player when close
    const pd = Math.hypot(pl.x - p.x, pl.z - p.z), want = out && pd < 6 && (p.state === 'walk' || p.state === 'idle' || p.state === 'wait') ? clamp(angDiff(p.yaw, Math.atan2(pl.x - p.x, pl.z - p.z)), -1.1, 1.1) : 0;
    p.head += (want - p.head) * Math.min(1, dt * 4);
    if (p.state === 'cross' || p.state === 'flee') pedsAhead.push(p);
  }
  // cash pickups
  for (let i = pickups.length - 1; i >= 0; i--) {
    const c = pickups[i]; c.t -= dt;
    if (c.t <= 0) { pickups.splice(i, 1); continue; }
    const px = me ? me.x : game.player.x, pz = me ? me.z : game.player.z;
    if (out && Math.hypot(c.x - px, c.z - pz) < (me ? 2.5 : 1.3)) { game.money += c.amount; sfx('buy'); toast('+$' + c.amount, 1.2); pickups.splice(i, 1); }
  }
}
const angDiff = (a: number, b: number) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
export { clamp };
