import { game } from '../state/store';
import { vehicles, spawn, remove, playerCar, Veh, Drive } from '../vehicles/sim';
import { VDEFS, VKind } from '../vehicles/defs';
import { roadC, N, HALF } from '../world/cityGen';
import { signalState } from '../world/City';
import { steer, newAI, nodeIdx } from './driver';
import { clamp } from '../world/rng';
import { admin } from '../admin';

/** Civilian traffic: cars wander the street grid in the right-hand lane, stop at red lights and keep their distance. */
const KINDS: VKind[] = ['sedan', 'sedan', 'sedan', 'suv', 'suv', 'truck', 'sport', 'bike', 'super', 'taxi', 'taxi', 'hatch', 'hatch', 'pickup', 'pickup', 'muscle'];
const LANE = 3.3;
export const trafficCap = () => Math.round((game.quality === 'low' ? 8 : game.quality === 'medium' ? 13 : 18) * (admin.is ? admin.density : 1));
let spawnT = 0, patrolT = 20;

/** Obstacles (cars, the player, pedestrians) directly ahead limit the speed. */
export const pedsAhead: { x: number; z: number }[] = [];
function aheadLimit(v: Veh): number {
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw); let L = 99;
  const test = (x: number, z: number, wid: number, len: number) => {
    const dx = x - v.x, dz = z - v.z; if (Math.abs(dx) > 22 || Math.abs(dz) > 22) return;
    const lf = dx * fx + dz * fz, ls = dx * fz - dz * fx;
    if (lf > 0 && lf < 18 && Math.abs(ls) < wid) L = Math.min(L, Math.max(0, (lf - len) * 1.1));
  };
  for (const o of vehicles) if (o !== v && Math.abs(o.y - v.y) < 3) test(o.x, o.z, 2.2, v.def.len / 2 + o.def.len / 2 + 1.5);
  if (!playerCar() && game.where === 'out') test(game.player.x, game.player.z, 1.6, v.def.len / 2 + 2.2);
  for (const p of pedsAhead) test(p.x, p.z, 1.6, v.def.len / 2 + 2.2);
  return L;
}

/** Controls for a civilian (or patrolling police) car: wander + lights + following distance. */
export function cruise(v: Veh, dt: number, speed = 13): Drive {
  const ai = v.ai!, panic = (ai.panic = Math.max(0, (ai.panic || 0) - dt)) > 0;
  const c = steer(v, null, dt, { speed: panic ? 22 : speed, lane: LANE });
  let L = aheadLimit(v);
  // red / amber light at a signalled junction ahead
  if (!panic && ai.pi >= 0 && (ai.ni + ai.nj) % 2 === 0) {
    const dn = Math.hypot(roadC(ai.ni) - v.x, roadC(ai.nj) - v.z), alongZ = ai.nj !== ai.pj ? 0 : 1;
    if (dn > 11 && dn < 28 && signalState(ai.ni, ai.nj, alongZ, game.clock) > 0) L = Math.min(L, Math.max(0, (dn - 12) * 0.9));
  }
  const fv = v.vx * Math.sin(v.yaw) + v.vz * Math.cos(v.yaw);
  if (fv > L) { c.thr = 0; c.brake = clamp((fv - L) / 4, 0.3, 1); }
  if (L < 0.5 && fv < 0.6) { c.thr = 0; c.brake = 0; ai.stuck = 0; } // waiting, not stuck
  return c;
}

function spawnTraffic(px: number, pz: number, role: '' | 'police' = '') {
  const pi = nodeIdx(px), pj = nodeIdx(pz), bx = Math.sin(game.cam.yaw), bz = Math.cos(game.cam.yaw);
  for (let k = 0; k < 20; k++) {
    const i = clamp(pi + Math.round((Math.random() - 0.5) * 6), 0, N), j = clamp(pj + Math.round((Math.random() - 0.5) * 6), 0, N);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => i + a >= 0 && i + a <= N && j + b >= 0 && j + b <= N);
    const [di, dj] = dirs[Math.floor(Math.random() * dirs.length)];
    const ax = roadC(i), az = roadC(j), ux = di, uz = dj; // unit direction (grid aligned)
    const x = ax + ux * 22 - uz * LANE, z = az + uz * 22 + ux * LANE; // right of the centre line
    const d = Math.hypot(x - px, z - pz); if (d < 85 || d > 210) continue;
    if (k < 14 && (x - px) * bx + (z - pz) * bz < 0) continue; // prefer spawning behind the camera
    if (vehicles.some((v) => Math.hypot(v.x - x, v.z - z) < 10)) continue;
    const kind: VKind = role === 'police' ? 'police' : KINDS[Math.floor(Math.random() * KINDS.length)], def = VDEFS[kind];
    const v = spawn(kind, x, z, Math.atan2(ux, uz), def.colors[Math.floor(Math.random() * def.colors.length)]);
    v.role = role || 'traffic'; v.touched = true;
    v.ai = newAI(x, z, { mode: role === 'police' ? 'patrol' : 'cruise', panic: 0 });
    v.ai.pi = i; v.ai.pj = j; v.ai.ni = i + di; v.ai.nj = j + dj;
    const s = role === 'police' ? 12 : 10; v.vx = ux * s; v.vz = uz * s;
    return v;
  }
  return null;
}

export function updateTraffic(dt: number) {
  const out = game.where === 'out', p = out ? game.player : game.outsidePos;
  const inCity = Math.abs(p.x) < HALF + 60 && Math.abs(p.z) < HALF + 60;
  let n = 0;
  for (const v of [...vehicles]) {
    if (v.role !== 'traffic') continue;
    const d = Math.hypot(v.x - p.x, v.z - p.z);
    if (d > 260 || (v.dead && d > 120)) { remove(v); continue; }
    n++;
    if (v.dead || !v.ai) { if (v.ai) v.ai.ctl = null; continue; }
    v.ai.ctl = cruise(v, dt);
  }
  spawnT -= dt;
  if (inCity && n < trafficCap() && spawnT <= 0 && game.started) { spawnTraffic(p.x, p.z); spawnT = 0.6; }
  // one police patrol around while you are not wanted (they witness crimes)
  patrolT -= dt;
  if (inCity && game.wanted === 0 && patrolT <= 0 && !vehicles.some((v) => v.role === 'police' && v.ai)) { spawnTraffic(p.x, p.z, 'police'); patrolT = 25; }
}

/** Someone rammed this civilian: they floor it for a while. */
export function panic(v: Veh) { if (v.ai && v.role === 'traffic') v.ai.panic = 8; }
