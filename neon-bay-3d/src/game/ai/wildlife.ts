import { game } from '../state/store';
import { blocks, pointBlocked, groundAt, isWater, BEACH_X, HALF } from '../world/cityGen';
import { vehicles } from '../vehicles/sim';
import { mulberry } from '../world/rng';

/**
 * City wildlife: pigeons that peck about on the squares and the park paths, crows on the edges of the business
 * districts, gulls on the beach, cats along the residential streets. Birds scatter when someone walks up to them or a car
 * comes by fast, circle for a while and come back down near where they were; cats bolt for cover and drift back. Birds
 * roost at night; cats come out. Only the creatures near the player are simulated (the rest keep still where they are).
 */
export type Kind = 'pigeon' | 'crow' | 'gull' | 'cat';
export type CState = 'idle' | 'peck' | 'walk' | 'fly' | 'land' | 'flee' | 'sit' | 'sleep';
export interface Critter { id: number; kind: Kind; x: number; y: number; z: number; yaw: number; s: number; state: CState; t: number; hx: number; hz: number; tx: number; tz: number; alt: number; vy: number; spd: number; phase: number; col: number; head: number }
export const critters: Critter[] = [];
export const stats = { scattered: 0, landed: 0 };

const SPOOK: Record<Kind, number> = { pigeon: 4.2, crow: 6.5, gull: 5.5, cat: 4 };
const SIZE: Record<Kind, number> = { pigeon: 1, crow: 1.55, gull: 1.75, cat: 1 };
const rnd = mulberry(77031);
const free = (x: number, z: number) => !pointBlocked(x, groundAt(x, z) + 0.4, z) && !isWater(x, z);

let built = false;
function build() {
  if (built) return; built = true;
  const add = (kind: Kind, x: number, z: number, col = 0) => {
    const y = groundAt(x, z), id = critters.length;
    critters.push({ id, kind, x, y, z, yaw: rnd() * Math.PI * 2, s: SIZE[kind] * (0.92 + rnd() * 0.16), state: kind === 'cat' ? 'sit' : 'idle', t: rnd() * 6, hx: x, hz: z, tx: x, tz: z, alt: 0, vy: 0, spd: 0, phase: rnd() * 6, col, head: 0 });
  };
  const pick = (b: { x0: number; x1: number; z0: number; z1: number }, inset: number) => {
    for (let k = 0; k < 14; k++) { const x = b.x0 + inset + rnd() * (b.x1 - b.x0 - 2 * inset), z = b.z0 + inset + rnd() * (b.z1 - b.z0 - 2 * inset); if (free(x, z)) return [x, z] as const; }
    return null;
  };
  let n = 0;
  for (const b of blocks) {
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2; if (Math.abs(cx) > HALF || Math.abs(cz) > HALF) continue;
    const r = rnd();
    if ((b.zone === 'park' || b.zone === 'commercial' || b.zone === 'station') && r < 0.34) { // a flock of pigeons
      const c = pick(b, 5); if (!c) continue; const m = 4 + Math.floor(rnd() * 5);
      for (let k = 0; k < m; k++) { const x = c[0] + (rnd() - 0.5) * 6, z = c[1] + (rnd() - 0.5) * 6; if (free(x, z)) { add('pigeon', x, z, Math.floor(rnd() * 3)); n++; } }
    } else if ((b.zone === 'downtown' || b.zone === 'industrial') && r < 0.22) { // crows
      const c = pick(b, 4); if (c) for (let k = 0; k < 1 + Math.floor(rnd() * 2); k++) add('crow', c[0] + k * 1.4, c[1] + k, 0);
    } else if (b.zone === 'residential' && r < 0.2) { // a cat
      const c = pick(b, 3); if (c) add('cat', c[0], c[1], Math.floor(rnd() * 5));
    }
  }
  // gulls on the sand
  for (let k = 0; k < 26; k++) { const x = BEACH_X + 6 + rnd() * 40, z = (rnd() - 0.5) * 2 * HALF * 0.8; if (free(x, z)) add('gull', x, z, Math.floor(rnd() * 2)); }
  void n;
}

/** Is this kind about at this hour? */
const about = (kind: Kind, h: number) => kind === 'cat' || (h > 5.2 && h < 20.8);

function scare(c: Critter, fx: number, fz: number) {
  if (c.state === 'fly' || c.state === 'flee') return;
  const a = Math.atan2(c.x - fx, c.z - fz) + (Math.random() - 0.5) * 0.9;
  if (c.kind === 'cat') { c.state = 'flee'; c.t = 6 + Math.random() * 6; c.yaw = a; c.tx = c.x + Math.sin(a) * 14; c.tz = c.z + Math.cos(a) * 14; return; }
  c.state = 'fly'; c.t = 7 + Math.random() * 9; c.yaw = a; c.alt = 6 + Math.random() * 9; c.vy = 3.5; c.spd = 2; c.phase = 0; stats.scattered++;
}
/** Disturb the creatures near a point (a gunshot, an explosion, a crash). */
export function startle(x: number, z: number, r: number) { for (const c of critters) if (Math.hypot(c.x - x, c.z - z) < r && c.state !== 'sleep') scare(c, x, z); }

const step = (c: Critter, tx: number, tz: number, v: number, dt: number) => {
  const dx = tx - c.x, dz = tz - c.z, L = Math.hypot(dx, dz); if (L < 0.05) return true;
  const want = Math.atan2(dx, dz); let da = want - c.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); c.yaw += Math.max(-dt * 6, Math.min(dt * 6, da));
  const m = Math.min(L, v * dt), nx = c.x + Math.sin(c.yaw) * m, nz = c.z + Math.cos(c.yaw) * m;
  if (!free(nx, nz)) return false; c.x = nx; c.z = nz; c.spd = m / Math.max(dt, 1e-3); c.phase += m * 12; return true;
};

let acc = 0;
/** Per frame. */
export function updateWildlife(dt: number) {
  if (!game.started) return; build(); if (game.where !== 'out') return;
  const P = game.player, me = vehicles.find((v) => v.id === game.inCar), px = me ? me.x : P.x, pz = me ? me.z : P.z, h = game.hour;
  acc += dt; const slow = acc > 0.2; if (slow) acc = 0;
  for (const c of critters) {
    if (Math.abs(c.x - px) > 160 || Math.abs(c.z - pz) > 160) continue;
    c.spd = 0; c.t -= dt;
    if (!about(c.kind, h)) { if (c.state === 'fly') { /* finish the landing below */ } else { c.state = 'sleep'; c.y = groundAt(c.x, c.z); continue; } }
    else if (c.state === 'sleep') { c.state = c.kind === 'cat' ? 'sit' : 'idle'; c.t = 1 + Math.random() * 4; }
    // what scares it: the player close by, a car coming by fast
    if (slow && c.state !== 'fly' && c.state !== 'flee') {
      const R = SPOOK[c.kind] * (P.speed > 4.5 && !me ? 1.5 : 1);
      if (!me && Math.hypot(c.x - P.x, c.z - P.z) < R) scare(c, P.x, P.z);
      else for (const v of vehicles) { const sp = Math.hypot(v.vx, v.vz); if (sp > 4 && Math.abs(v.x - c.x) < 7 + sp * 0.3 && Math.abs(v.z - c.z) < 7 + sp * 0.3) { scare(c, v.x, v.z); break; } }
    }
    const gy = groundAt(c.x, c.z);
    switch (c.state) {
      case 'fly': {
        // climb to the cruising height, fly on round in a wide circle over the spot, then come down near home
        const ret = c.t <= 0;
        if (ret) { const dx = c.hx - c.x, dz = c.hz - c.z; if (Math.hypot(dx, dz) < 3.5) { c.state = 'land'; c.t = 0; break; } c.yaw += (() => { let da = Math.atan2(dx, dz) - c.yaw; da = Math.atan2(Math.sin(da), Math.cos(da)); return Math.max(-dt * 2.2, Math.min(dt * 2.2, da)); })(); }
        else c.yaw += dt * 0.55 * (c.id % 2 ? 1 : -1);
        c.spd = c.kind === 'gull' ? 6.5 : 7.5; c.x += Math.sin(c.yaw) * c.spd * dt; c.z += Math.cos(c.yaw) * c.spd * dt;
        const want = ret ? gy + 2.5 : gy + c.alt; c.vy += (Math.max(-3, Math.min(4, (want - c.y) * 1.2)) - c.vy) * Math.min(1, dt * 3); c.y += c.vy * dt; c.y = Math.max(c.y, gy + 0.05); c.phase += dt * (c.vy > 0.5 ? 22 : c.kind === 'gull' ? 9 : 14);
        if (pointBlocked(c.x, c.y, c.z)) { c.y += 1.5; c.yaw += 0.8; } // over a roof: up and turn
        break;
      }
      case 'land': {
        c.spd = 3; c.x += Math.sin(c.yaw) * c.spd * dt; c.z += Math.cos(c.yaw) * c.spd * dt; c.vy = -2.2; c.y += c.vy * dt; c.phase += dt * 20;
        if (c.y <= groundAt(c.x, c.z) + 0.02) { c.y = groundAt(c.x, c.z); c.vy = 0; c.state = free(c.x, c.z) ? 'idle' : 'idle'; c.t = 2 + Math.random() * 4; stats.landed++; }
        break;
      }
      case 'flee': { // a cat: run, then sit and watch, then drift home
        if (!step(c, c.tx, c.tz, 4.2, dt) || c.t <= 0) { c.state = 'sit'; c.t = 8 + Math.random() * 12; }
        c.y = gy; break;
      }
      case 'walk': if (!step(c, c.tx, c.tz, c.kind === 'cat' ? 0.9 : 0.55, dt) || Math.hypot(c.tx - c.x, c.tz - c.z) < 0.3) { c.state = c.kind === 'cat' ? 'sit' : 'idle'; c.t = 2 + Math.random() * 5; } c.y = gy; break;
      case 'sit': if (c.t <= 0) { c.t = 4 + Math.random() * 8; if (Math.random() < 0.45) { const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 5; c.tx = c.hx + Math.sin(a) * r; c.tz = c.hz + Math.cos(a) * r; c.state = 'walk'; } } c.y = gy; break;
      default: // idle / peck
        c.head = c.state === 'peck' ? Math.max(0, Math.sin(c.phase * 0.9)) : 0; c.phase += dt * 5;
        if (c.t <= 0) { c.t = 1.5 + Math.random() * 4; const r = Math.random(); if (r < 0.5) c.state = c.state === 'peck' ? 'idle' : 'peck'; else if (r < 0.75) { const a = Math.random() * Math.PI * 2, d = 1 + Math.random() * 3; c.tx = c.hx + Math.sin(a) * d; c.tz = c.hz + Math.cos(a) * d; c.state = 'walk'; } }
        c.y = gy;
    }
  }
}

/** The creatures near a point (for tests / the map). */
export const wildlifeNear = (x: number, z: number, r: number, kind?: Kind) => critters.filter((c) => (!kind || c.kind === kind) && Math.hypot(c.x - x, c.z - z) < r);
export function buildWildlife() { build(); return critters.length; }
