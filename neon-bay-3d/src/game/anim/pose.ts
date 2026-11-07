/**
 * Procedural animation library shared by the player rig and the instanced pedestrians / drivers.
 * A Pose holds joint angles for the skeleton built in player/character.ts; clips write poses,
 * layers blend them (full body, then an upper-body overlay). Index 0 = right limb, 1 = left limb.
 * Conventions (character faces +z): limb rotation.x < 0 swings forward, knee > 0 bends back,
 * elbow < 0 bends forward, arm rotation.z = side * k moves the arm outward, spine.x > 0 leans forward,
 * head.y > 0 looks left.
 */
export interface Pose {
  hy: number; hx: number; hz: number; hr: number; // hips height, pitch, roll, yaw
  sx: number; sy: number; sz: number; // spine
  nx: number; ny: number; // head
  ax: number[]; ay: number[]; az: number[]; ae: number[]; // shoulders (x,y,z) and elbows
  lx: number[]; lz: number[]; lk: number[]; // hips (x,z) and knees
  fall: number; fdir: number; fside: number; // lying down: 0..1, +1 on the back / -1 face down, sideways roll
  oy: number; oz: number; // root offset (seat height, rider position)
}
const KEYS = ['hy', 'hx', 'hz', 'hr', 'sx', 'sy', 'sz', 'nx', 'ny', 'fall', 'fdir', 'fside', 'oy', 'oz'] as const;
const ARR = ['ax', 'ay', 'az', 'ae', 'lx', 'lz', 'lk'] as const;
const UPPER = ['sx', 'sy', 'sz', 'nx', 'ny'] as const, UPPER_ARR = ['ax', 'ay', 'az', 'ae'] as const;

export const newPose = (): Pose => ({ hy: 0.95, hx: 0, hz: 0, hr: 0, sx: 0, sy: 0, sz: 0, nx: 0, ny: 0, ax: [0, 0], ay: [0, 0], az: [0, 0], ae: [0, 0], lx: [0, 0], lz: [0, 0], lk: [0, 0], fall: 0, fdir: 1, fside: 0, oy: 0, oz: 0 });
export function neutral(P: Pose) {
  for (const k of KEYS) P[k] = 0; P.hy = 0.95; P.fdir = 1;
  for (const k of ARR) { P[k][0] = 0; P[k][1] = 0; }
  P.az[0] = -0.07; P.az[1] = 0.07; P.ae[0] = P.ae[1] = -0.12;
  return P;
}
export function copyPose(d: Pose, s: Pose) { for (const k of KEYS) d[k] = s[k]; for (const k of ARR) { d[k][0] = s[k][0]; d[k][1] = s[k][1]; } return d; }
/** d = lerp(d, s, w) over every joint. */
export function blend(d: Pose, s: Pose, w: number) {
  if (w <= 0) return d; if (w >= 1) return copyPose(d, s);
  for (const k of KEYS) d[k] += (s[k] - d[k]) * w;
  for (const k of ARR) { d[k][0] += (s[k][0] - d[k][0]) * w; d[k][1] += (s[k][1] - d[k][1]) * w; }
  return d;
}
/** Upper-body layer: spine, head and arms only (legs keep walking). */
export function blendUpper(d: Pose, s: Pose, w: number) {
  if (w <= 0) return d;
  for (const k of UPPER) d[k] += (s[k] - d[k]) * w;
  for (const k of UPPER_ARR) { d[k][0] += (s[k][0] - d[k][0]) * w; d[k][1] += (s[k][1] - d[k][1]) * w; }
  return d;
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** 0 -> 1 -> 0 envelope over k in [0,1] with a fast attack. */
export const env = (k: number, attack = 0.25, release = 0.35) => (k < attack ? smooth(0, attack, k) : smooth(1, 1 - release, k));

/* ------------------------------------------------------------------ gaits */
export type GaitKind = 'normal' | 'brisk' | 'elderly' | 'swagger' | 'relaxed' | 'texting' | 'caller' | 'jogger';
export interface Gait { kind: GaitKind; stride: number; cadence: number; swing: number; bounce: number; sway: number; posture: number; elbow: number; speed: number; limp: number }
const rnd = (seed: number, k: number) => { const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
/** Deterministic per-character walking style, so no two pedestrians move quite alike. */
export function gaitFor(seed: number): Gait {
  const r = (k: number) => rnd(seed, k), u = r(0);
  const kind: GaitKind = u < 0.36 ? 'normal' : u < 0.5 ? 'brisk' : u < 0.6 ? 'relaxed' : u < 0.68 ? 'swagger' : u < 0.77 ? 'texting' : u < 0.85 ? 'caller' : u < 0.93 ? 'elderly' : 'jogger';
  const g: Gait = { kind, stride: 0.85 + r(1) * 0.3, cadence: 0.9 + r(2) * 0.25, swing: 0.75 + r(3) * 0.5, bounce: 0.7 + r(4) * 0.7, sway: 0.6 + r(5) * 0.9, posture: -0.02 + r(6) * 0.08, elbow: 0.1 + r(7) * 0.25, speed: 1.15 + r(8) * 0.45, limp: 0 };
  if (kind === 'brisk') { g.speed += 0.35; g.cadence += 0.15; g.swing += 0.2; }
  if (kind === 'elderly') { g.speed = 0.8 + r(9) * 0.2; g.stride *= 0.6; g.cadence *= 0.85; g.swing *= 0.45; g.posture = 0.22 + r(10) * 0.1; g.elbow += 0.3; g.bounce *= 0.4; }
  if (kind === 'swagger') { g.sway *= 1.8; g.swing *= 1.25; g.speed -= 0.15; g.posture -= 0.05; }
  if (kind === 'relaxed') { g.speed -= 0.2; g.swing *= 0.8; g.cadence *= 0.9; }
  if (kind === 'jogger') { g.speed = 3.2 + r(11) * 0.8; }
  if (kind === 'texting') g.speed -= 0.25;
  return g;
}
export const PLAYER_GAIT: Gait = { kind: 'normal', stride: 1, cadence: 1, swing: 1, bounce: 1, sway: 1, posture: 0.02, elbow: 0.15, speed: 1.4, limp: 0 };

/* ------------------------------------------------------------------ full-body clips */
/** Walk -> jog -> run -> sprint, blended continuously by speed (m/s). bank/accel lean into turns and speed changes. */
export function locomotion(P: Pose, phase: number, speed: number, g: Gait, bank = 0, accel = 0) {
  neutral(P);
  const walk = smooth(0.05, 1.3, speed), run = smooth(2.4, 5, speed), spr = smooth(5.6, 8, speed);
  const s = Math.sin(phase), c = Math.cos(phase), A = (0.4 + 0.3 * run + 0.22 * spr) * g.stride * walk;
  for (let i = 0; i < 2; i++) {
    const sg = i ? 1 : -1, limp = i === 0 ? g.limp : 0;
    P.lx[i] = -sg * s * A * (1 - limp * 0.55);
    P.lk[i] = (Math.max(0, sg * c) * (0.85 + 0.65 * run + 0.55 * spr) * walk + 0.05 + run * 0.18) * (1 - limp * 0.7);
    P.ax[i] = sg * s * g.swing * (0.42 + 0.35 * run + 0.45 * spr) * walk;
    P.ae[i] = -(g.elbow + 0.12 * walk + 0.95 * run + 0.45 * spr);
    P.az[i] = sg * (0.07 + 0.06 * run);
  }
  const vb = walk * (1 - run) * 0.032 * g.bounce * (0.5 - Math.abs(s)) + run * 0.055 * g.bounce * (Math.abs(s) - 0.5);
  P.hy = 0.95 - 0.015 * walk - 0.04 * run - 0.05 * spr + vb - g.limp * Math.max(0, -s) * 0.06;
  P.hr = s * (0.09 + 0.05 * run) * g.sway * walk;
  P.hz = s * 0.045 * g.sway * walk * (1 - run) + bank + g.limp * s * 0.06;
  P.sx = g.posture + 0.03 * walk + 0.15 * run + 0.22 * spr + accel;
  P.sy = -P.hr * 1.4; P.sz = -P.hz * 0.6 - bank * 0.4;
  P.nx = -P.sx * 0.65; P.ny = -P.sy * 0.6;
  return P;
}
/** Standing idle with breathing and weight shifts, plus a variant (look around, watch, phone, stretch ...). */
export const IDLE_VARIANTS = ['breathe', 'look', 'watch', 'phone', 'stretch', 'crossed', 'hips', 'chat', 'call', 'tap'] as const;
export type IdleVariant = typeof IDLE_VARIANTS[number];
export function idle(P: Pose, t: number, v: IdleVariant, k: number, g: Gait = PLAYER_GAIT) {
  neutral(P);
  const br = Math.sin(t * 1.7) * 0.014, ws = Math.sin(t * 0.37);
  P.sx = g.posture + br; P.hz = ws * 0.035; P.sz = -ws * 0.02; P.nx = -br * 0.5;
  P.lk[0] = Math.max(0, ws) * 0.13; P.lk[1] = Math.max(0, -ws) * 0.13; P.lx[0] = -Math.max(0, ws) * 0.05; P.lx[1] = -Math.max(0, -ws) * 0.05;
  P.ax[0] = br * 0.6; P.ax[1] = br * 0.6;
  if (k <= 0) return P;
  const Q = TMP_IDLE; copyPose(Q, P);
  switch (v) {
    case 'look': Q.ny = Math.sin(t * 0.7) * 0.8; Q.sy = Q.ny * 0.25; Q.nx = -0.05; break;
    case 'watch': Q.ax[1] = -1.25; Q.az[1] = -0.55; Q.ae[1] = -1.45; Q.nx = 0.38; Q.ny = 0.3; break;
    case 'phone': texting(Q); break;
    case 'stretch': { const e = 0.5 + 0.5 * Math.sin(t * 1.3); Q.ax[0] = Q.ax[1] = -2.9 * e; Q.az[0] = -0.25; Q.az[1] = 0.25; Q.ae[0] = Q.ae[1] = -0.2; Q.sx = -0.12 * e; Q.nx = -0.3 * e; break; }
    case 'crossed': for (let i = 0; i < 2; i++) { const sg = i ? 1 : -1; Q.ax[i] = -0.55; Q.az[i] = -sg * 0.38; Q.ae[i] = -1.95; } Q.sx -= 0.03; break;
    case 'hips': for (let i = 0; i < 2; i++) { const sg = i ? 1 : -1; Q.ax[i] = 0.15; Q.az[i] = sg * 0.7; Q.ae[i] = -1.5; } Q.hz += 0.04; break;
    case 'chat': Q.ax[0] = -0.7 + Math.sin(t * 3.1) * 0.35; Q.ae[0] = -1.2 + Math.sin(t * 2.3) * 0.4; Q.az[0] = -0.2; Q.ax[1] = -0.3 + Math.sin(t * 2.2 + 1) * 0.2; Q.ae[1] = -0.9; Q.nx = Math.sin(t * 2.6) * 0.08; Q.ny = Math.sin(t * 0.9) * 0.25; break;
    case 'call': phoneCall(Q); Q.ny = Math.sin(t * 0.5) * 0.4; break;
    case 'tap': Q.lx[0] = -0.12; Q.lk[0] = 0.3 + Math.max(0, Math.sin(t * 9)) * 0.25; Q.ax[0] -= 0.1; break;
    default: break;
  }
  return blend(P, Q, k);
}
const TMP_IDLE = newPose();
export function crouch(P: Pose, phase: number, speed: number) {
  neutral(P); const w = smooth(0.05, 1.2, speed), s = Math.sin(phase), c = Math.cos(phase);
  P.hy = 0.62 + Math.abs(s) * 0.03 * w; P.sx = 0.42; P.nx = -0.3;
  for (let i = 0; i < 2; i++) { const sg = i ? 1 : -1; P.lx[i] = -1.05 - sg * s * 0.35 * w; P.lk[i] = 1.75 + Math.max(0, sg * c) * 0.3 * w; P.ax[i] = -0.25 + sg * s * 0.25 * w; P.ae[i] = -0.7; }
  return P;
}
/** Jumping / falling: tuck on the way up, flail when falling far. */
export function air(P: Pose, vy: number, t: number) {
  neutral(P); const fall = smooth(-4, -11, vy);
  P.lx[0] = -0.7; P.lk[0] = 1.1; P.lx[1] = 0.25; P.lk[1] = 0.45; P.ax[0] = -1.9; P.ax[1] = -2.2; P.az[0] = -0.35; P.az[1] = 0.35; P.ae[0] = P.ae[1] = -0.45; P.sx = 0.12;
  if (fall > 0) {
    const Q = TMP_AIR; neutral(Q);
    for (let i = 0; i < 2; i++) { const sg = i ? 1 : -1, w = Math.sin(t * 13 + i * 2); Q.ax[i] = -2.3 + w * 0.6; Q.az[i] = sg * (0.6 + w * 0.2); Q.ae[i] = -0.5; Q.lx[i] = -0.4 + Math.sin(t * 11 + i * Math.PI) * 0.5; Q.lk[i] = 0.8 + Math.cos(t * 11 + i * Math.PI) * 0.4; }
    Q.sx = -0.15; Q.nx = 0.2; blend(P, Q, fall);
  }
  return P;
}
const TMP_AIR = newPose();
/** Landing compression (k = 0..1 strength). */
export function landing(P: Pose, k: number) { P.hy -= 0.22 * k; P.sx += 0.4 * k; P.nx -= 0.25 * k; for (let i = 0; i < 2; i++) { P.lx[i] -= 0.65 * k; P.lk[i] += 1.0 * k; P.ax[i] -= 0.4 * k; P.ae[i] -= 0.3 * k; } return P; }
/** Lying on the ground after a knockdown or death: dir +1 on the back, -1 face down; side rolls. */
export function lying(P: Pose, dir: number, side: number, seed = 0) {
  neutral(P); P.fall = 1; P.fdir = dir; P.fside = side; P.hy = 0.95;
  const r = (k: number) => rnd(seed + 7, k);
  for (let i = 0; i < 2; i++) { const sg = i ? 1 : -1; P.ax[i] = (dir > 0 ? -2.3 : -0.4) + (r(i) - 0.5) * 1.2; P.az[i] = sg * (0.4 + r(i + 2) * 0.7); P.ae[i] = -0.3 - r(i + 4) * 0.9; P.lx[i] = (r(i + 6) - 0.6) * 0.6; P.lz[i] = sg * r(i + 8) * 0.35; P.lk[i] = r(i + 10) * 0.9; }
  P.ny = (r(12) - 0.5) * 1.4; P.nx = dir > 0 ? -0.2 : 0.3;
  return P;
}
/** Getting up from the ground: k 0 -> 1 (roll to one knee, push up, stand). */
export function getUp(P: Pose, dir: number, k: number) {
  const Q = TMP_UP; lying(P, dir, 0);
  kneel(Q); blend(P, Q, smooth(0, 0.5, k)); P.fall = 1 - smooth(0.05, 0.5, k);
  neutral(Q); blend(P, Q, smooth(0.5, 1, k));
  return P;
}
const TMP_UP = newPose();
function kneel(P: Pose) { neutral(P); P.hy = 0.52; P.lx[0] = -1.45; P.lk[0] = 1.5; P.lx[1] = 0.15; P.lk[1] = 1.75; P.sx = 0.35; P.ax[0] = -0.6; P.ae[0] = -0.4; P.ax[1] = -0.2; return P; }
/** Busted: kneeling with hands behind the head. */
export function surrender(P: Pose, t: number) { kneel(P); P.sx = 0.05; for (let i = 0; i < 2; i++) { const sg = i ? 1 : -1; P.ax[i] = -2.75; P.az[i] = sg * 0.55; P.ae[i] = -2.1; } P.nx = 0.25 + Math.sin(t * 2) * 0.03; return P; }
/** Seated driver, hands on the wheel following the steering. */
export function seated(P: Pose, steer: number, recline: number, t: number) {
  neutral(P); P.hy = 0.5; P.sx = -recline; P.nx = recline * 0.8;
  for (let i = 0; i < 2; i++) { const sg = i ? 1 : -1; P.lx[i] = -1.48; P.lk[i] = 1.35 + sg * 0.05; P.lz[i] = sg * 0.06; P.ax[i] = -1.05 + recline * 0.5 - sg * steer * 0.32; P.ae[i] = -0.6 - recline * 0.3; P.az[i] = -sg * 0.18; }
  P.sy = steer * 0.12; P.ny = steer * 0.35 + Math.sin(t * 0.3) * 0.08;
  return P;
}
/** Motorbike rider: tucks in at speed. */
export function ride(P: Pose, speed: number) {
  neutral(P); const tuck = smooth(8, 30, speed);
  P.hy = 1.0; P.sx = 0.55 + tuck * 0.35; P.nx = -0.45 - tuck * 0.25;
  for (let i = 0; i < 2; i++) { const sg = i ? 1 : -1; P.lx[i] = -1.25 - tuck * 0.1; P.lk[i] = 1.55 + tuck * 0.1; P.ax[i] = -1.15 - tuck * 0.25; P.az[i] = sg * (0.12 + tuck * 0.05); P.ae[i] = -0.35 - tuck * 0.4; }
  P.oz = -0.32;
  return P;
}
/** Crouched with hands over the head (gunfire nearby). */
export function cower(P: Pose, t: number) { crouch(P, 0, 0); P.sx = 0.65; P.nx = 0.45; for (let i = 0; i < 2; i++) { const sg = i ? 1 : -1; P.ax[i] = -2.55 + Math.sin(t * 17 + i) * 0.03; P.az[i] = sg * 0.35; P.ae[i] = -2.25; } return P; }
/** Getting into / out of a car: duck and step in (k 0 -> 1). */
export function enterCar(P: Pose, k: number) {
  neutral(P); const d = Math.sin(k * Math.PI);
  P.hy = 0.95 - d * 0.32; P.sx = d * 0.6; P.nx = -d * 0.3; P.lx[1] = -d * 1.3; P.lk[1] = d * 1.4; P.lx[0] = -d * 0.4; P.lk[0] = d * 0.7;
  P.ax[1] = -d * 1.2; P.ae[1] = -0.3; P.ax[0] = -d * 0.6; P.az[0] = -0.2; P.sy = d * 0.5;
  return P;
}

/* ------------------------------------------------------------------ upper-body overlays */
export function texting(P: Pose) { for (let i = 0; i < 2; i++) { const sg = i ? 1 : -1; P.ax[i] = -0.75; P.az[i] = -sg * 0.18; P.ae[i] = -1.45; } P.nx = 0.5; P.sx += 0.05; return P; }
export function phoneCall(P: Pose) { P.ax[0] = -0.55; P.az[0] = -0.55; P.ae[0] = -2.45; P.ay[0] = 0.3; P.sz = 0.05; P.nx = 0.08; return P; }
export function handsUp(P: Pose, t: number) { for (let i = 0; i < 2; i++) { const sg = i ? 1 : -1; P.ax[i] = -2.85 + Math.sin(t * 19 + i) * 0.025; P.az[i] = sg * 0.32; P.ae[i] = -0.35; } P.sx = -0.08; P.nx = 0.05; return P; }
/** Running away with arms flailing. */
export function flail(P: Pose, t: number) { for (let i = 0; i < 2; i++) { const sg = i ? 1 : -1; P.ax[i] = -1.5 + Math.sin(t * 9 + i * 2.1) * 0.8; P.az[i] = sg * (0.5 + Math.sin(t * 7 + i) * 0.25); P.ae[i] = -0.8; } P.nx = -0.15; P.ny = Math.sin(t * 3) * 0.5; return P; }
/** Two-handed weapon aim (pitch in radians, recoil 0..1). SMG holds the elbows a bit more bent. */
export function aim(P: Pose, smg: boolean, pitch: number, recoil: number) {
  const k = recoil * 0.28;
  P.ax[0] = -1.52 + pitch * 0.9 - k; P.az[0] = -0.05; P.ae[0] = smg ? -0.3 : 0; P.ay[0] = 0;
  P.ax[1] = -1.32 + pitch * 0.9 - k; P.az[1] = -0.5; P.ae[1] = smg ? -0.75 : -0.35;
  P.sy = 0.18; P.sx = Math.max(P.sx, 0.05) - k * 0.2; P.ny = -0.12; P.nx = pitch * 0.6;
  return P;
}
/** Reload: gun to the chest, off hand swaps the magazine (k 0 -> 1). */
export function reload(P: Pose, smg: boolean, k: number) {
  const m = Math.sin(k * Math.PI);
  P.ax[0] = -0.95; P.az[0] = -0.25; P.ae[0] = -1.35;
  P.ax[1] = -0.75 + Math.sin(k * Math.PI * 2) * 0.55 * m; P.az[1] = -0.55; P.ae[1] = -1.6 + m * 0.5; if (smg) P.ae[1] -= 0.2;
  P.nx = 0.42; P.sy = 0.1;
  return P;
}
/** Jab with the right (side 0) or left (side 1) hand; k 0 -> 1. */
export function punch(P: Pose, side: number, k: number) {
  const e = env(k, 0.35, 0.5), sg = side ? 1 : -1, o = 1 - side;
  P.ax[side] = -0.9 - e * 0.7; P.ae[side] = -1.6 + e * 1.55; P.az[side] = -sg * 0.18 * e;
  P.ax[o] = -1.1; P.ae[o] = -1.9; P.az[o] = sg * 0.2;
  P.sy = sg * 0.45 * e; P.sx += 0.1 * e; P.nx = 0.05;
  return P;
}
/** Front kick with the right leg (full body); k 0 -> 1. */
export function kick(P: Pose, k: number) {
  const e = env(k, 0.35, 0.45);
  P.lx[0] = -1.55 * e; P.lk[0] = 1.2 * (1 - e) * e * 3; P.lk[1] = 0.15; P.sx = -0.25 * e; P.hx = -0.1 * e;
  P.ax[0] = -0.6 * e; P.az[0] = -0.6 * e; P.ax[1] = -0.6 * e; P.az[1] = 0.6 * e; P.ae[0] = P.ae[1] = -0.5;
  return P;
}
/** Hit reaction: jerk away from the impact side (k 1 -> 0). */
export function flinch(P: Pose, k: number, side: number) { P.sx -= 0.28 * k; P.sz += side * 0.22 * k; P.ny += side * 0.5 * k; P.nx -= 0.2 * k; P.ax[0] -= 0.5 * k; P.ax[1] -= 0.5 * k; P.ae[0] -= 0.5 * k; P.ae[1] -= 0.5 * k; return P; }
/** Holding the phone in front of the chest. */
export function holdPhone(P: Pose) { P.ax[0] = -0.95; P.az[0] = -0.2; P.ae[0] = -1.55; P.ax[1] = -0.6; P.az[1] = -0.3; P.ae[1] = -1.2; P.nx = 0.45; return P; }

/** Driver seat per vehicle type: side (fraction of width to the left), forward offset, height offset, recline. */
export function seatFor(kind: string) {
  switch (kind) {
    case 'super': return { side: 0.2, fwd: -0.3, y: -0.3, recline: 0.5 };
    case 'sport': return { side: 0.2, fwd: -0.25, y: -0.2, recline: 0.38 };
    case 'suv': return { side: 0.21, fwd: 0.1, y: 0.22, recline: 0.12 };
    case 'truck': case 'armored': return { side: 0.2, fwd: (kind === 'truck' ? 2.55 : 2.25), y: 0.85, recline: 0.05 };
    default: return { side: 0.21, fwd: -0.15, y: -0.06, recline: 0.22 };
  }
}

/* ------------------------------------------------------------------ apply */
import type { Character } from '../player/character';
/** Drive the jointed player rig from a pose. */
export function applyRig(C: Character, P: Pose) {
  C.hips.position.y = P.hy; C.hips.rotation.set(P.hx, P.hr, P.hz);
  C.spine.rotation.set(P.sx, P.sy, P.sz); C.head.rotation.set(P.nx, P.ny, 0);
  C.arms.forEach((a, i) => { a.top.rotation.set(P.ax[i], P.ay[i], P.az[i]); a.mid.rotation.x = P.ae[i]; });
  C.legs.forEach((l, i) => { l.top.rotation.set(P.lx[i], 0, P.lz[i]); l.mid.rotation.x = P.lk[i]; });
  C.root.position.set(0, P.oy + 0.18 * P.fall, P.oz);
  C.root.rotation.set(P.fall * (P.fdir > 0 ? -Math.PI / 2 : Math.PI / 2), 0, P.fall * P.fside * 0.6);
}
