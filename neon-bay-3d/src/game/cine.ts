import * as THREE from 'three';
import { game } from './state/store';
import { playerCar } from './vehicles/sim';
import { pointBlocked, groundAt } from './world/cityGen';
import { line } from './line/line';
import { input } from './input';

/**
 * Cinematic scenes: black bars slide in, the HUD steps aside, the player is held still and the camera leaves its
 * usual place. Used for a mission's opening (the camera comes round to the player's face while they are briefed, then
 * turns to look at where the job is) and for its close (a slow circle round the player). Always skippable.
 *
 * A scene only plays when it is safe: out of doors, nobody after you, on foot or in a car that has stopped, not on the train line.
 * While one plays `cine.lock` is on: movement and actions are ignored (input.ts, Player.tsx, Vehicles.tsx) and the
 * mission clock stands still (story.ts).
 */
export type CineKind = 'intro' | 'goal' | 'win';
export const cine = {
  on: false, lock: false,
  /** how far the black bars have slid in, 0..1 */ k: 0,
  kind: '' as CineKind | '', t: 0, dur: 0, skippable: false,
  cam: { on: false, pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 50 },
  queue: [] as { kind: CineKind; dur: number }[],
  /** where the job is (for the 'goal' shot) */ goal: null as null | (() => { x: number; y: number; z: number } | null),
  /** how many scenes have played (tests) */ played: 0,
  /** the side of the subject the camera works from (radians away from the default) */ side: 0,
};
const ease = (t: number) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
const V = new THREE.Vector3();

/** Is it fine to take the camera and the controls away right now? */
export const cineSafe = () => game.started && game.where === 'out' && game.wanted === 0 && game.health > 30 && !line.on && !cine.on && (() => { const c = playerCar(); return !c || (Math.hypot(c.vx, c.vz) < 2 && c.def.kind !== 'heli' && c.def.kind !== 'jet' && c.def.kind !== 'shinkansen'); })();

/** Play one scene (or several in a row). Returns false when it is not safe to. */
export function startCine(scenes: { kind: CineKind; dur: number }[], goal?: () => { x: number; y: number; z: number } | null): boolean {
  if (!scenes.length || !cineSafe()) return false;
  cine.queue = scenes.slice(1); cine.goal = goal || null; begin(scenes[0]); return true;
}
function begin(s: { kind: CineKind; dur: number }) { pickSide(s.kind); cine.on = true; cine.lock = true; input.locked = true; // the controls are taken this instant, not on the next frame
  cine.kind = s.kind; cine.t = 0; cine.dur = s.dur; cine.skippable = true; cine.cam.on = true; cine.played++; }
/** Skip: straight to the end of the whole sequence. */
export function skipCine() { cine.queue = []; if (cine.on) cine.t = cine.dur; }

/** The thing the camera is about: the player, or their car. */
function subject() {
  const c = playerCar(), p = game.player;
  return c ? { x: c.x, y: c.y, z: c.z, yaw: c.yaw, r: c.def.len * 0.75 + 2, h: c.def.hgt * 0.55 } : { x: p.x, y: p.y, z: p.z, yaw: p.yaw, r: 0, h: p.crouch ? 0.9 : 1.45 };
}
/** How much of the way from the subject's head to a camera position is clear of walls and ground (0..1). */
function freeFraction(sx: number, sy: number, sz: number, px: number, py: number, pz: number) {
  for (let k = 1; k <= 14; k++) {
    const t = k / 14, x = sx + (px - sx) * t, y = sy + (py - sy) * t, z = sz + (pz - sz) * t;
    if (pointBlocked(x, y, z) || y < groundAt(x, z) + 0.25) return (k - 1) / 14;
  }
  return 1;
}
/** Pull a camera position in until it is clear of walls and the ground. */
function clear(sx: number, sy: number, sz: number, pos: THREE.Vector3) {
  const f = freeFraction(sx, sy, sz, pos.x, pos.y, pos.z); if (f >= 1) return;
  const b = Math.max(0.25, f); pos.set(sx + (pos.x - sx) * b, sy + (pos.y - sy) * b, sz + (pos.z - sz) * b);
}
type Subj = ReturnType<typeof subject>;
/** The camera for the arc scenes at progress u, working from the side `off` (radians) away from the default. */
function arc(S: Subj, kind: CineKind, u: number, off: number, pos: THREE.Vector3) {
  const win = kind === 'win', e = ease(u), a = S.yaw + (win ? 2.2 : 0.55) + off + (win ? 1.0 : 0.6) * e;
  const r = (win ? 5.2 + 1.8 * e : 3.5 - 0.7 * e) + S.r, h = (win ? 1.9 + 0.5 * e : 1.5 - 0.15 * e) + S.h * 0.5;
  return pos.set(S.x + Math.sin(a) * r, S.y + h, S.z + Math.cos(a) * r);
}
/** Pick the side the camera works from: the default unless a wall, a pole or a kerb is in the way, then the clearest other side. */
function pickSide(kind: CineKind) {
  if (kind === 'goal') { cine.side = 0; return; }
  const S = subject(), P = new THREE.Vector3(); let best = 0, bs = -1;
  for (const off of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9, Math.PI]) {
    let sc = 0; for (const u of [0, 0.25, 0.5, 0.75, 1]) { arc(S, kind, u, off, P); sc += freeFraction(S.x, S.y + S.h + 0.4, S.z, P.x, P.y, P.z); }
    sc -= Math.abs(off) * 0.04; // a small liking for the default
    if (sc > bs) { bs = sc; best = off; }
  }
  cine.side = best;
}

/** Per frame (real time, not game time): slides the bars and works out the camera. */
export function updateCine(rawDt: number) {
  const dt = Math.min(0.05, rawDt);
  if (cine.on) {
    cine.t += dt;
    if (!game.started || game.where !== 'out' || line.on) { cine.on = false; cine.queue = []; } // the world moved on (death, a door, the train)
    else if (cine.t >= cine.dur) { if (cine.queue.length) begin(cine.queue.shift()!); else cine.on = false; }
  }
  if (!cine.on) { cine.lock = false; cine.cam.on = false; cine.kind = ''; cine.skippable = false; }
  input.locked = cine.lock; if (typeof document !== 'undefined') document.body.classList.toggle('cine', cine.k > 0.02);
  cine.k += ((cine.on ? 1 : 0) - cine.k) * Math.min(1, dt * 5);
  if (!cine.on || !cine.cam.on) return;
  const S = subject(), u = cine.t / cine.dur, c = cine.cam;
  if (cine.kind === 'intro' || cine.kind === 'win') {
    // a slow arc round the subject: the camera starts in front and to one side and drifts round while it creeps in (intro) or out (win)
    const win = cine.kind === 'win';
    arc(S, cine.kind, u, cine.side, c.pos); clear(S.x, S.y + S.h + 0.4, S.z, c.pos);
    c.look.set(S.x, S.y + S.h + (win ? 0.1 : 0.15), S.z); c.fov = win ? 46 : 38;
  } else { // goal: the camera stays put and turns to the job, holds on it, and turns back
    const g = cine.goal ? cine.goal() : null; let tx = S.x + Math.sin(S.yaw) * 60, tz = S.z + Math.cos(S.yaw) * 60, ty = S.y + S.h;
    if (g) { tx = g.x; tz = g.z; ty = Math.max(g.y, groundAt(g.x, g.z)) + 1.5; }
    const away = Math.hypot(tx - S.x, tz - S.z), k = u < 0.3 ? ease(u / 0.3) : u > 0.75 ? 1 - ease((u - 0.75) / 0.25) : 1;
    const dx = Math.sin(S.yaw) * 60 + (tx - S.x - Math.sin(S.yaw) * 60) * k, dz = Math.cos(S.yaw) * 60 + (tz - S.z - Math.cos(S.yaw) * 60) * k;
    const L = Math.max(1, Math.hypot(dx, dz)); // the camera is the player's eyes, a little ahead of them (so the player is behind it and never in the way)
    c.pos.set(S.x + (dx / L) * (0.5 + S.r * 0.4), S.y + S.h + 0.35 + 0.25 * k, S.z + (dz / L) * (0.5 + S.r * 0.4)); clear(S.x, S.y + S.h + 0.35, S.z, c.pos);
    V.set(S.x + dx, S.y + S.h + (ty - S.y - S.h) * Math.min(1, k * (away > 150 ? 0.35 : 1)), S.z + dz); c.look.copy(V); c.fov = 52 - 8 * k;
  }
}
