import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HairStyle, Hat, Glasses, Beard } from './appearance';

/**
 * Geometry for the human figure, shared by the player (separate meshes) and pedestrians (instanced meshes).
 * Everything that sits on the head is built in the head bone's space; the head centre is HEAD_Y above the bone.
 * Unit-sphere coordinates (front = +z) are sculpted into a head, then scaled by HS.
 */
export const HEAD_Y = 0.112, HS = 0.108, KX = 0.8, KY = 1.16, KZ = 1.0;
/** Where the features sit on the unit sphere (x = half-width, y = height): eyes, brows, nose tip, mouth, chin. Shared with the face painter. */
export const F = { ex: 0.38, ey: 0.0, by: 0.18, ny: -0.33, my: -0.56, cy: -0.9 };
const g2 = (v: number, mu: number, s: number) => Math.exp(-(((v - mu) / s) ** 2));
const sm = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Sculpt a point of the unit sphere into a human head (still unit space). face 0..5 varies jaw, cheeks, nose and chin. */
export function sculpt(x: number, y: number, z: number, face = 1): [number, number, number] {
  const jaw = [0.32, 0.27, 0.36, 0.24, 0.3, 0.38][face], nose = [1, 0.88, 1.15, 0.85, 1.05, 1.22][face], cheek = [0.05, 0.035, 0.065, 0.03, 0.07, 0.05][face], chin = [0.1, 0.08, 0.13, 0.06, 0.1, 0.14][face];
  const front = sm(0.2, 0.95, z), low = sm(-0.1, -1, y);
  if (z > 0) z *= 1 - 0.14 * front; // a face is much flatter than a ball
  x *= 1 - jaw * Math.pow(low, 1.25); // jaw tapering to the chin
  if (z < 0 && y < 0) z *= 1 - 0.24 * low; // back of the jaw / neck
  if (z < 0 && y > -0.2) z *= 1.07; // back of the skull
  z += chin * front * g2(y, F.cy + 0.04, 0.13); // chin forward
  x += Math.sign(x) * cheek * g2(y, -0.12, 0.2) * sm(0.2, 0.8, z); // cheekbones
  z += 0.07 * front * g2(y, F.by + 0.03, 0.075) * g2(x, 0, 0.55); // brow ridge
  for (const s of [-1, 1]) {
    z -= 0.1 * front * g2(x - s * F.ex, 0, 0.15) * g2(y, F.ey, 0.1); // eye sockets
    z -= 0.03 * front * g2(x - s * 0.68, 0, 0.12) * g2(y, F.by, 0.15); // temples
    z += 0.035 * front * g2(x - s * 0.42, 0, 0.14) * g2(y, -0.32, 0.13); // cheek pads
    if (y < F.ny - 0.02 && y > F.my - 0.06) { const t = (F.ny - 0.02 - y) / (F.ny - F.my + 0.04), lx = s * (0.15 + 0.08 * t); z -= 0.02 * front * g2(x - lx, 0, 0.035); } // nasolabial folds
  }
  const nx = g2(x, 0, 0.075);
  z += front * nx * nose * (0.12 * g2(y, (F.ey + F.ny) / 2, 0.17) * sm(F.by, F.ey - 0.02, y) + 0.21 * g2(y, F.ny + 0.04, 0.085)); // nose bridge and tip
  z += front * 0.065 * nose * g2(Math.abs(x) - 0.09, 0, 0.045) * g2(y, F.ny, 0.05); // nostril wings
  z -= front * 0.015 * g2(Math.abs(x) - 0.035, 0, 0.02) * g2(y, (F.ny + F.my) / 2, 0.04); // philtrum
  z += front * g2(x, 0, 0.2) * (0.045 * g2(y, F.my + 0.045, 0.04) + 0.055 * g2(y, F.my - 0.06, 0.05)); // lips
  z -= front * 0.028 * g2(y, F.my, 0.014) * g2(x, 0, 0.17); // mouth line
  z -= front * 0.04 * g2(y, F.my - 0.16, 0.05) * g2(x, 0, 0.22); // under the lower lip
  if (y > 0.85) y = 0.85 + (y - 0.85) * 0.7; // a slightly flatter crown
  return [x, y, z];
}
const place = (p: [number, number, number], puff = 1): [number, number, number] => [p[0] * KX * HS * puff, HEAD_Y + p[1] * KY * HS * puff, p[2] * KZ * HS * puff];

export function headGeometry(face = 1, seg = 40) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75)), P = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < P.count; i++) { const q = place(sculpt(P.getX(i), P.getY(i), P.getZ(i), face)); P.setXYZ(i, q[0], q[1], q[2]); }
  g.computeVertexNormals(); return g;
}
/** Eye positions in head space (unit 0.3 / 0.08), eyeball radius. */
export const EYE = (() => { const r = 0.155, [, , zs] = sculpt(F.ex, F.ey, Math.sqrt(1 - F.ex * F.ex - F.ey * F.ey)); return { x: F.ex * KX * HS, y: HEAD_Y + F.ey * KY * HS, z: (zs + 0.035 - r) * KZ * HS, r: r * HS }; })();
export function eyeballGeometry() { return new THREE.SphereGeometry(EYE.r, 16, 12); }
export function irisGeometry() { const g = new THREE.SphereGeometry(EYE.r * 1.004, 20, 8, 0, Math.PI * 2, 0, 0.55); g.rotateX(Math.PI / 2); return g; }
/** Upper eyelid: a skin shell over the top of the eyeball. */
export function lidGeometry() { const up = new THREE.SphereGeometry(EYE.r * 1.1, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.36); up.rotateX(0.32); const lo = new THREE.SphereGeometry(EYE.r * 1.07, 18, 6, 0, Math.PI * 2, Math.PI * 0.74, Math.PI * 0.26); lo.rotateX(-0.25); return merge([up, lo]); }
export function earGeometry(side: number) { const g = new THREE.SphereGeometry(1, 12, 10); g.scale(0.012, 0.032, 0.022); g.rotateY(side * 0.35); g.translate(side * 0.985 * KX * HS, HEAD_Y + 0.0, -0.06 * HS); return g; }

/** Hair: the sculpted head pushed out by `puff`, with everything below a hairline (front / side / back heights) folded up onto that line. */
let SEG = 36; // detail of hair / hat / beard shells (lowered while building pedestrian meshes)
export function withDetail<T>(seg: number, f: () => T): T { const o = SEG; SEG = seg; try { return f(); } finally { SEG = o; } }
function shell(puff: number, front: number, side: number, back: number, opts: { noise?: number; top?: number; shift?: number; face?: number } = {}) {
  const g = new THREE.SphereGeometry(1, SEG, Math.round(SEG * 0.72)), P = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < P.count; i++) {
    let x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const a = Math.abs(Math.atan2(x, z)), line = front + (side - front) * sm(0, Math.PI / 2, a) + (back - side) * sm(Math.PI / 2, Math.PI, a);
    if (y < line) { const r = Math.sqrt(Math.max(0, 1 - line * line)), h = Math.hypot(x, z) || 1; x = (x / h) * r * 0.97; z = (z / h) * r * 0.97; y = line; }
    let [sx, sy, sz] = sculpt(x, y, z, opts.face ?? 1);
    if (sz > 0.55 && sy < 0.45) sz = Math.min(sz, 0.75); // never over the brow / nose
    let k = puff; if (opts.noise) k += opts.noise * (Math.sin(x * 23 + y * 7) * Math.sin(y * 19 + z * 11) * Math.sin(z * 17 + x * 5));
    if (opts.top && sy > 0.3) { sy += opts.top * (sy - 0.3); }
    if (opts.shift && sy > 0.2) sx += opts.shift * (sy - 0.2);
    const q = place([sx, sy, sz], k); P.setXYZ(i, q[0], q[1], q[2]);
  }
  g.computeVertexNormals(); return g;
}
const at = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return g; };
const merge = (gs: THREE.BufferGeometry[]) => mergeGeometries(gs.map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') n.deleteAttribute(k); return n; }))!;
const U = (v: number) => v * HS; // unit -> metres

export function hairGeometry(s: HairStyle): THREE.BufferGeometry {
  switch (s) {
    case 'bald': return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)).setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3)).setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 2));
    case 'buzz': return shell(1.025, 0.42, 0.05, -0.42);
    case 'short': return shell(1.075, 0.4, 0.12, -0.48, { top: 0.12 });
    case 'side': return shell(1.08, 0.36, 0.1, -0.48, { top: 0.16, shift: 0.12 });
    case 'curly': return shell(1.2, 0.42, -0.05, -0.5, { noise: 0.07, top: 0.1 });
    case 'bob': return merge([shell(1.12, 0.4, -0.62, -0.7, { top: 0.08 })]);
    case 'bun': return merge([shell(1.035, 0.42, 0.02, -0.38), at(new THREE.SphereGeometry(U(0.34), 14, 10), 0, HEAD_Y + U(0.95), U(-0.42))]);
    case 'pony': return merge([shell(1.075, 0.36, 0.02, -0.32, { top: 0.12, shift: 0.05 }), at(new THREE.SphereGeometry(U(0.16), 10, 8), 0, HEAD_Y + U(0.35), U(-1.0)), at(new THREE.CapsuleGeometry(U(0.15), U(1.25), 4, 10), 0, HEAD_Y - U(0.32), U(-1.12), 0.25)]);
    case 'long': {
      const curtain = new THREE.CylinderGeometry(U(0.93), U(1.12), U(2.3), 22, 6, true, Math.PI * 0.32, Math.PI * 1.36);
      const P = curtain.attributes.position as THREE.BufferAttribute; for (let i = 0; i < P.count; i++) { const y = P.getY(i), z = P.getZ(i); P.setZ(i, z * 0.92 - (y < 0 ? 0 : 0)); }
      curtain.computeVertexNormals(); curtain.scale(KX, 1, KZ); curtain.translate(0, HEAD_Y - U(0.95), U(-0.08));
      return merge([shell(1.09, 0.42, -0.2, -0.55, { top: 0.06 }), curtain]);
    }
  }
}
export function beardGeometry(b: Beard): THREE.BufferGeometry | null {
  if (b === 'none' || b === 'stubble') return null;
  const g = new THREE.SphereGeometry(1, SEG, Math.round(SEG * 0.72)), P = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const inMouth = g2(x, 0, 0.16) * g2(y, -0.52, 0.06), keep = b === 'full' ? (y < -0.25 && z > -0.15 && inMouth < 0.5 ? 1 : 0) : (y > -0.47 && y < -0.36 && Math.abs(x) < 0.26 && z > 0.6 ? 1 : 0);
    const [sx, sy, sz] = sculpt(x, y, z); const q = place([sx, sy, sz], keep ? (b === 'full' ? 1.07 : 1.045) : 0.9); P.setXYZ(i, q[0], q[1], q[2]);
  }
  g.computeVertexNormals(); return g;
}
export function hatGeometry(h: Hat): THREE.BufferGeometry | null {
  if (h === 'none') return null;
  if (h === 'beanie') return merge([shell(1.14, 0.5, 0.3, 0.05, { top: 0.18 }), at(new THREE.TorusGeometry(U(0.97), U(0.09), 8, 28), 0, HEAD_Y + U(0.38), 0, Math.PI / 2).scale(KX, 1, KZ)]);
  if (h === 'cap') {
    const brim = new THREE.CylinderGeometry(U(0.8), U(0.8), U(0.05), 20, 1, false, -Math.PI / 2, Math.PI); brim.scale(0.9, 1, 1.2); brim.translate(0, HEAD_Y + U(0.5), U(0.78));
    return merge([shell(1.12, 0.48, 0.38, 0.25, { top: 0.04 }), brim]);
  }
  const crown = new THREE.CylinderGeometry(U(0.78), U(0.92), U(0.62), 20); crown.scale(KX * 1.05, 1, KZ * 1.08); crown.translate(0, HEAD_Y + U(0.85), 0);
  const brim = new THREE.CylinderGeometry(U(1.55), U(1.6), U(0.05), 28); brim.scale(1, 1, 1.05); brim.translate(0, HEAD_Y + U(0.52), 0);
  const band = new THREE.CylinderGeometry(U(0.93), U(0.93), U(0.14), 20, 1, true); band.scale(KX * 1.05, 1, KZ * 1.08); band.translate(0, HEAD_Y + U(0.62), 0);
  return merge([crown, brim, band]);
}
export function glassesGeometry(gl: Glasses): THREE.BufferGeometry | null {
  if (gl === 'none') return null;
  const z = EYE.z + EYE.r * 1.5, y = EYE.y, parts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    if (gl === 'shades') parts.push(at(new THREE.BoxGeometry(U(0.27), U(0.18), U(0.02)), s * EYE.x * 1.05, y, z, 0, s * -0.12));
    else parts.push(at(new THREE.TorusGeometry(U(0.12), U(0.012), 6, 18), s * EYE.x, y, z));
    parts.push(at(new THREE.BoxGeometry(U(0.02), U(0.025), U(0.75)), s * 0.93 * KX * HS, y + U(0.02), U(0.35))); // temple arms
  }
  parts.push(at(new THREE.BoxGeometry(U(0.16), U(0.025), U(0.02)), 0, y + U(0.04), z));
  return merge(parts);
}

/* ---------------- body pieces (bone spaces as in character.ts) ---------------- */
/** Mitten hand with a thumb, hanging from the forearm end (local y down). */
export function handGeometry() { return merge([at(new THREE.BoxGeometry(0.06, 0.085, 0.028), 0, -0.04, 0.0), at(new THREE.CapsuleGeometry(0.012, 0.035, 3, 6), 0.03, -0.03, 0.012, 0, 0, 0.5)]).translate(0, 0.02, 0); }
/** Skirt hanging from the hips (hips bone space). */
export function skirtGeometry(long = false) { return new THREE.CylinderGeometry(0.19, long ? 0.33 : 0.29, long ? 0.6 : 0.42, 20, 1, true).translate(0, long ? -0.24 : -0.15, 0); }
/** Open jacket front showing the shirt (spine space) and a tie. */
export function shirtFrontGeometry() { return merge([new THREE.BoxGeometry(0.09, 0.28, 0.01).translate(0, 0.4, 0.122)]); }
export function tieGeometry() { return merge([new THREE.BoxGeometry(0.035, 0.25, 0.012).translate(0, 0.39, 0.13)]); }
/** Torso (spine space): broad shoulders, chest, narrower waist; fem adds a bust and narrows the shoulders a little (per-instance x scale). */
export function torsoGeometry(fem = false, puff = 1) {
  const g = new THREE.CapsuleGeometry(0.16, 0.4, 8, 20), P = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < P.count; i++) {
    let x = P.getX(i), y = P.getY(i), z = P.getZ(i); // y -0.36..0.36
    const w = y > 0.18 ? 1.08 + 0.25 * sm(0.18, 0.3, y) - 0.25 * sm(0.3, 0.36, y) : y > -0.12 ? 0.95 + 0.13 * sm(-0.12, 0.18, y) : 0.95 + 0.12 * sm(-0.12, -0.3, y);
    x *= w * 1.05; z *= 0.66 * (y > 0.05 ? 1.08 : 1);
    if (fem && z > 0) z += 0.038 * g2(y, 0.1, 0.07) * g2(Math.abs(x) - 0.075, 0, 0.065);
    if (y > 0.3) y = 0.3 + (y - 0.3) * 0.6; // flatter shoulder line
    P.setXYZ(i, x * puff, y * puff + 0.3, z * puff);
  }
  g.computeVertexNormals(); return g;
}
export function jacketGeometry() { return torsoGeometry(false, 1.07); }
export function hoodGeometry() { const g = new THREE.SphereGeometry(0.15, 14, 10, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.45); g.scale(1.05, 0.7, 0.9); g.translate(0, 0.6, -0.11); return g; }
export function collarGeometry() { return new THREE.TorusGeometry(0.07, 0.016, 6, 16).rotateX(Math.PI / 2).translate(0, 0.6, 0.01); }
/** Watch on the wrist (forearm space, wrist at y = -0.27). */
export function watchParts(tonneau: boolean, side = 1) {
  const band = new THREE.CylinderGeometry(0.047, 0.047, 0.022, 16, 1, true).translate(0, -0.25, 0);
  const face = tonneau ? new THREE.BoxGeometry(0.014, 0.036, 0.046).translate(side * 0.052, -0.25, 0) : new THREE.CylinderGeometry(0.021, 0.021, 0.012, 18).rotateZ(Math.PI / 2).translate(side * 0.052, -0.25, 0);
  return { band, face };
}
export function watchGeometry(tonneau: boolean, side = 1) { const p = watchParts(tonneau, side); return merge([p.band, p.face]); }
/** Handbag held in the hand (forearm space). */
export function bagGeometry(model: string) {
  const [w, h, d] = model === 'pochette' ? [0.22, 0.13, 0.05] : model === 'tote' ? [0.34, 0.28, 0.12] : model === 'boston' ? [0.42, 0.24, 0.2] : [0.26, 0.2, 0.14];
  const body = new THREE.BoxGeometry(d, h, w).translate(0, -0.34 - h / 2, 0);
  const handle = new THREE.TorusGeometry(Math.min(w, 0.2) * 0.4, 0.008, 6, 14, Math.PI).rotateY(Math.PI / 2).translate(0, -0.34, 0);
  return merge([body, handle]);
}
