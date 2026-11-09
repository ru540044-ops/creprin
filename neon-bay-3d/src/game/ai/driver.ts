import { roadC, N, HALF, PITCH, ROAD, pointBlocked } from '../world/cityGen';
import { Veh, AI, Drive } from '../vehicles/sim';
import { clamp } from '../world/rng';

/** Road-grid AI driving: cars hop between intersections of the street grid, then go straight for the target when they can see it. */
export const nodeIdx = (v: number) => clamp(Math.round((v + HALF - ROAD / 2) / PITCH), 0, N);
const angDiff = (a: number, b: number) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

export function newAI(x: number, z: number, extra: Record<string, any> = {}): AI {
  const i = nodeIdx(x), j = nodeIdx(z);
  return { ctl: null, ni: i, nj: j, pi: -1, pj: -1, stuck: 0, rev: 0, revSteer: 0, direct: 0, t: 0, ...extra };
}

/** True when nothing solid lies on the straight line between the two points. */
export function clearLine(x0: number, z0: number, x1: number, z1: number, y = 1.2): boolean {
  const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 4);
  for (let k = 1; k < n; k++) { const t = k / n; if (pointBlocked(x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t)) return false; }
  return true;
}

/** Pick the neighbouring intersection that brings us closest to (ti,tj); wander adds randomness and forbids U-turns. */
function stepNode(ai: AI, ti: number, tj: number, wander: boolean) {
  const opts: [number, number][] = [[ai.ni + 1, ai.nj], [ai.ni - 1, ai.nj], [ai.ni, ai.nj + 1], [ai.ni, ai.nj - 1]].filter(([i, j]) => i >= 0 && j >= 0 && i <= N && j <= N) as [number, number][];
  let best = opts[0], bs = 1e9;
  for (const o of opts) {
    const back = o[0] === ai.pi && o[1] === ai.pj;
    const sc = (wander ? Math.random() * 3 : Math.abs(o[0] - ti) + Math.abs(o[1] - tj)) + (back ? 50 : 0);
    if (sc < bs) { bs = sc; best = o; }
  }
  ai.pi = ai.ni; ai.pj = ai.nj; ai.ni = best[0]; ai.nj = best[1];
}

/**
 * Decide controls for one AI car this frame.
 * target: where to go (null = wander); speed: cruise m/s; lane: metres left of the centre line (left-hand traffic); stopAt: brake when this close to the target.
 */
export function steer(v: Veh, target: { x: number; z: number } | null, dt: number, o: { speed: number; lane?: number; stopAt?: number; ram?: boolean }): Drive {
  const ai = v.ai!; ai.t += dt;
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), fv = v.vx * fx + v.vz * fz, sp = Math.abs(fv);
  // --- choose the point to aim at ---
  let ax: number, az: number, want = o.speed;
  const dT = target ? Math.hypot(target.x - v.x, target.z - v.z) : 1e9;
  if (Math.floor(ai.t * 4) !== Math.floor((ai.t - dt) * 4)) ai.see = !!target && dT < 70 && clearLine(v.x, v.z, target.x, target.z);
  if (!target || dT >= 70) ai.see = false;
  ai.direct -= dt;
  if (target && (ai.see || ai.direct > 0)) {
    // straight for the target while it is in sight (or we reached its intersection)
    ax = target.x; az = target.z;
    if (o.stopAt && dT < o.stopAt + Math.max(0, fv) * 0.9) want = 0;
    else if (!o.ram) want = Math.min(want, 4 + dT * 0.5);
    if (!ai.see && ai.direct <= 0) { ai.ni = nodeIdx(v.x); ai.nj = nodeIdx(v.z); ai.pi = ai.pj = -1; }
  } else {
    let nx = roadC(ai.ni), nz = roadC(ai.nj), dn = Math.hypot(nx - v.x, nz - v.z);
    // far off the grid (pushed onto a sidewalk, parked in a lot): re-acquire the nearest intersection
    if (dn > PITCH * 1.6) { ai.ni = nodeIdx(v.x); ai.nj = nodeIdx(v.z); ai.pi = ai.pj = -1; nx = roadC(ai.ni); nz = roadC(ai.nj); dn = Math.hypot(nx - v.x, nz - v.z); }
    if (dn < 7) {
      const ti = target ? nodeIdx(target.x) : 0, tj = target ? nodeIdx(target.z) : 0;
      if (target && ti === ai.ni && tj === ai.nj) { ai.direct = 2.5; }
      else { stepNode(ai, ti, tj, !target); nx = roadC(ai.ni); nz = roadC(ai.nj); dn = Math.hypot(nx - v.x, nz - v.z); }
    }
    ax = nx; az = nz;
    if (o.lane && ai.pi >= 0) { // keep left of the centre line (Japan drives on the left)
      const dx = roadC(ai.ni) - roadC(ai.pi), dz = roadC(ai.nj) - roadC(ai.pj), L = Math.hypot(dx, dz) || 1;
      ax -= (-dz / L) * o.lane; az -= (dx / L) * o.lane;
    }
    if (dn < 32) want = Math.min(want, 8 + dn * 0.45); // slow down for the junction
  }
  const diff = angDiff(v.yaw, Math.atan2(ax - v.x, az - v.z));
  if (Math.abs(diff) > 0.9) want = Math.min(want, 7);
  // --- stuck / reversing ---
  if (ai.rev > 0) { ai.rev -= dt; return { thr: 0, brake: 1, steer: ai.revSteer, hb: false }; }
  if (want > 2 && sp < 0.8) ai.stuck += dt; else ai.stuck = Math.max(0, ai.stuck - dt * 2);
  if (ai.stuck > 1.1) { ai.stuck = 0; ai.rev = 1.1; ai.revSteer = Math.sign(diff || 1); return { thr: 0, brake: 1, steer: ai.revSteer, hb: false }; }
  // target behind and we are slow: reverse-turn
  if (Math.abs(diff) > 2.3 && sp < 5 && want > 0) return { thr: 0, brake: 1, steer: Math.sign(diff), hb: false };
  const st = clamp(-diff * 2.4, -1, 1);
  let thr = 0, brake = 0;
  if (fv < want - 0.8) thr = clamp((want - fv) / 6, 0.35, 1); else if (fv > want + 1.5) brake = clamp((fv - want) / 8, 0.3, 1);
  if (want === 0 && fv < 1) brake = 0; // stopped: do not start reversing
  return { thr, brake, steer: st, hb: false };
}
