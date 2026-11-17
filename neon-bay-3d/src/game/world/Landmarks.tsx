import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LANDMARK3D, DAIBUTSU } from './cityGen';
import { game } from '../state/store';

/**
 * Each city's landmark, seen from far away (it is not streamed): Tokyo's red-and-white lattice radio tower,
 * Osaka's castle keep on its stone base, Fukuoka's mirror-glass seaside tower, Naha's red-tiled castle hall.
 * Collision boxes for them are in cityGen (LANDMARK3D section).
 */
type Col = [number, number, number];
const paint = (g: THREE.BufferGeometry, c: Col) => { const g2 = g.index ? g.toNonIndexed() : g, n = g2.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g2.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g2; };
const at = (g: THREE.BufferGeometry, x: number, y: number, z: number) => { g.translate(x, y, z); return g; };
const box = (w: number, h: number, d: number, x: number, y: number, z: number, c: Col) => paint(at(new THREE.BoxGeometry(w, h, d), x, y + h / 2, z), c);
/** Square frustum (half-widths a0 at the bottom, a1 at the top), optionally stretched to a rectangle (sx, sz). */
const frustum = (a0: number, a1: number, h: number, y: number, c: Col, sx = 1, sz = 1, open = false) => {
  const g = new THREE.CylinderGeometry(a1 * Math.SQRT2, a0 * Math.SQRT2, h, 4, 1, open); g.rotateY(Math.PI / 4); g.scale(sx, 1, sz); g.translate(0, y + h / 2, 0); return paint(g, c);
};
const merge = (parts: THREE.BufferGeometry[]) => { const g = mergeGeometries(parts.map((p) => { for (const k of Object.keys(p.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color' && k !== 'uv') p.deleteAttribute(k); if (!p.attributes.uv) p.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(p.attributes.position.count * 2), 2)); return p; }), false)!; g.computeBoundingSphere(); return g; };

function latticeTexture() {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const c = cv.getContext('2d')!;
  c.strokeStyle = '#fff'; c.lineWidth = 5; c.strokeRect(0, 0, 64, 64);
  c.lineWidth = 3.4; c.beginPath(); c.moveTo(0, 0); c.lineTo(64, 64); c.moveTo(64, 0); c.lineTo(0, 64); c.stroke();
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}

/** A straight member from p0 to p1 (square section w). */
const beam = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, w: number, c: Col) => {
  const d = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0), L = d.length(), g = new THREE.BoxGeometry(w, L, w);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return paint(g, c);
};
const ORANGE: Col = [0.93, 0.33, 0.12], WHITE: Col = [0.95, 0.95, 0.94];

function buildTower() {
  // lattice body in colour bands (scaled UVs so every band shows the same bracing)
  const lat: THREE.BufferGeometry[] = [], solid: THREE.BufferGeometry[] = [], glow: THREE.BufferGeometry[] = [];
  const hw = (y: number) => (y < 100 ? 17 - (y / 100) * 8.6 : 6.4 - ((y - 106) / 64) * 4.2); // half width at height y
  const band = (y0: number, y1: number, c: Col) => {
    const a0 = hw(y0), a1 = hw(y1), g = frustum(a0, a1, y1 - y0, y0, c, 1, 1, true);
    const uv = g.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4 * Math.max(1, Math.round((a0 + a1) / 4)), uv.getY(i) * Math.max(1, Math.round((y1 - y0) / 6)));
    lat.push(g);
  };
  const bands: [number, number][] = [[0, 14], [14, 28], [28, 42], [42, 56], [56, 70], [70, 84], [84, 96], [106, 120], [120, 134], [134, 148], [148, 160], [160, 170]];
  bands.forEach(([a, b], i) => band(a, b, i % 2 ? WHITE : ORANGE));
  // solid corner legs and ring girders so the silhouette reads from far away (the lattice thins out with distance)
  bands.forEach(([a, b], i) => { const c = i % 2 ? WHITE : ORANGE, A = hw(a), B2 = hw(b); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) solid.push(beam(sx * A, a, sz * A, sx * B2, b, sz * B2, Math.max(0.5, A * 0.09), c)); });
  for (const y of [28, 56, 84, 120, 148]) { const a = hw(y); for (const [x0, z0, x1, z1] of [[-a, -a, a, -a], [a, -a, a, a], [a, a, -a, a], [-a, a, -a, -a]]) solid.push(beam(x0, y, z0, x1, y, z1, 0.5, ORANGE)); }
  // inner core lattice for depth
  { const g = frustum(5, 3.2, 96, 0, ORANGE, 1, 1, true); const uv = g.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * 14); lat.push(g); }
  // the four leg arches at the foot
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) solid.push(box(4.2, 2, 4.2, sx * 15, 0, sz * 15, [0.45, 0.45, 0.47]));
  // main observation deck (two floors, glass band) and the top deck
  solid.push(frustum(11.5, 11, 3, 95, WHITE), frustum(11, 10.5, 2.4, 103.2, WHITE), frustum(10.6, 10.4, 0.6, 105.4, ORANGE));
  glow.push(frustum(11.3, 11.2, 5.2, 98, [1, 0.86, 0.6]));
  solid.push(frustum(4.6, 4.4, 1, 148, WHITE), frustum(4.4, 4.4, 0.6, 152.5, ORANGE)); glow.push(frustum(4.5, 4.5, 3.5, 149, [1, 0.86, 0.6]));
  // antenna mast in bands
  for (let k = 0; k < 6; k++) solid.push(paint(at(new THREE.CylinderGeometry(1.1 - k * 0.14, 1.25 - k * 0.14, 7, 8), 0, 170 + k * 7 + 3.5, 0), k % 2 ? WHITE : ORANGE));
  solid.push(paint(at(new THREE.CylinderGeometry(0.15, 0.3, 10, 6), 0, 217, 0), WHITE));
  // a low hall at the foot (the tower stands on its roof in reality; here it sits between the legs)
  solid.push(box(18, 6, 18, 0, 0, 0, [0.82, 0.82, 0.8]), box(18.6, 0.5, 18.6, 0, 6, 0, [0.4, 0.42, 0.45]));
  glow.push(box(18.1, 1.4, 18.1, 0, 2, 0, [0.95, 0.8, 0.55]));
  return { lat, solid, glow, beacons: [new THREE.Vector3(0, 222.5, 0), new THREE.Vector3(0, 172, 0)] };
}

/** Japanese castle keep: battered stone base, white walls, flared green copper roofs, gold ridge fish. */
function buildCastle(keep: { stone: Col; wall: Col; roof: Col; trim: Col }) {
  const solid: THREE.BufferGeometry[] = [], glow: THREE.BufferGeometry[] = [];
  solid.push(frustum(25, 22.5, 14, 0, keep.stone, 1, 0.84));
  const tiers: [number, number, number][] = [[15, 12, 8], [13, 10, 6], [11, 8.4, 6], [9, 6.6, 5.5], [7.2, 5.2, 5]];
  let y = 14;
  tiers.forEach(([hx, hz, h], i) => {
    solid.push(box(hx * 2, h, hz * 2, 0, y, 0, keep.wall));
    // windows: dark bands on all four faces
    for (const s of [-1, 1]) { solid.push(box(hx * 1.5, h * 0.28, 0.2, 0, y + h * 0.45, s * (hz + 0.05), [0.12, 0.1, 0.1])); solid.push(box(0.2, h * 0.28, hz * 1.4, s * (hx + 0.05), y + h * 0.45, 0, [0.12, 0.1, 0.1])); }
    glow.push(box(hx * 1.4, h * 0.2, hz * 2.02, 0, y + h * 0.49, 0, [1, 0.85, 0.6]));
    y += h;
    const last = i === tiers.length - 1, ov = 3.6 - i * 0.35, rh = last ? 5.5 : 2.6;
    solid.push(box(hx * 2 + 0.6, 0.6, hz * 2 + 0.6, 0, y, 0, keep.trim));
    solid.push(frustum(hx + ov, last ? 1.2 : hx - 1.6, rh, y + 0.4, keep.roof, 1, hz / hx));
    if (!last) { // little gable on two sides of each roof
      for (const s of [-1, 1]) { const g = new THREE.ConeGeometry(3.4, 2.6, 3); g.rotateY(Math.PI / 2 + (s < 0 ? Math.PI : 0)); g.scale(1, 1, 0.6); g.translate(0, y + 1.6, s * (hz + ov * 0.55)); solid.push(paint(g, keep.roof)); }
    } else { solid.push(box(1.4, 1.2, hz * 2 - 2, 0, y + rh + 0.2, 0, keep.roof)); for (const s of [-1, 1]) solid.push(box(0.9, 1.6, 0.9, 0, y + rh + 1, s * (hz - 1.8), [1, 0.8, 0.2])); }
    y += last ? 0 : 1.2;
  });
  return { lat: [], solid, glow, beacons: [] as THREE.Vector3[] };
}

/** Red-lacquered castle hall on a limestone terrace inside curved stone walls, with a gate in front. */
function buildRedCastle() {
  const solid: THREE.BufferGeometry[] = [], glow: THREE.BufferGeometry[] = [];
  const RED: Col = [0.78, 0.13, 0.1], TILE: Col = [0.78, 0.32, 0.2], LIME: Col = [0.86, 0.8, 0.66], GOLD: Col = [0.95, 0.75, 0.25];
  solid.push(box(50, 1.4, 26, 0, 0, 0, LIME));
  solid.push(box(36, 8.4, 18, 0, 1.4, 0, RED));
  for (let k = -4; k <= 4; k++) solid.push(box(0.5, 8.4, 0.5, k * 4, 1.4, -9.3, [0.6, 0.08, 0.06]));
  glow.push(box(30, 2.2, 0.2, 0, 4, -9.15, [1, 0.8, 0.5]));
  solid.push(box(37, 0.8, 19, 0, 9.8, 0, GOLD));
  solid.push(frustum(21, 15, 5, 10.6, TILE, 1, 0.55));
  solid.push(box(30, 1, 2.4, 0, 15.4, 0, TILE)); for (const s of [-1, 1]) solid.push(box(1.2, 1.8, 1.2, s * 14.5, 15.6, 0, GOLD));
  // front porch with its own roof
  solid.push(box(12, 6, 6, 0, 1.4, -11, RED)); solid.push(frustum(8, 5, 3, 7.4, TILE, 1, 0.7)); solid.at(-1)!.translate(0, 0, -11);
  // stone walls with a gap in front, and the red gate
  for (const [x0, z0, x1, z1] of [[-35, -28, 35, -26], [-35, 26, -6, 28], [6, 26, 35, 28], [-35, -28, -33, 28], [33, -28, 35, 28]]) solid.push(box(x1 - x0, 4.2, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2, LIME));
  for (const s of [-1, 1]) solid.push(box(0.9, 7, 0.9, s * 5, 0, 30, RED));
  solid.push(box(13, 1.2, 3, 0, 7, 30, RED), frustum(8, 5.5, 2.2, 8.2, TILE, 1, 0.35)); solid.at(-1)!.translate(0, 0, 30);
  return { lat: [], solid, glow, beacons: [] as THREE.Vector3[] };
}

/** Nara's great hall: a vast timber hall on a stone platform (open doorway, the seated bronze figure inside), a cloister with its middle gate, a bronze lantern. */
function buildDaibutsu() {
  const solid: THREE.BufferGeometry[] = [], glow: THREE.BufferGeometry[] = [];
  const D = DAIBUTSU, W = D.hx1 - D.hx0, cz = (D.hz0 + D.hz1) / 2, dep = D.hz1 - D.hz0;
  const WOOD: Col = [0.36, 0.22, 0.14], PLAS: Col = [0.9, 0.87, 0.8], TILE: Col = [0.15, 0.16, 0.18], GOLD: Col = [0.95, 0.74, 0.25], STONE: Col = [0.6, 0.58, 0.54], BRZ: Col = [0.2, 0.19, 0.14], DARK: Col = [0.09, 0.07, 0.06];
  const sph = (rx: number, ry: number, rz: number, x: number, y: number, z: number, c: Col) => { const g = new THREE.SphereGeometry(1, 18, 12); g.scale(rx, ry, rz); g.translate(x, y, z); return paint(g, c); };
  const cylY = (r0: number, r1: number, h: number, x: number, y: number, z: number, c: Col, seg = 12) => paint(at(new THREE.CylinderGeometry(r1, r0, h, seg), x, y + h / 2, z), c);
  // platform and the stone floor inside
  solid.push(box(W + 10, 0.45, dep + 12, 0, -0.3, cz + 2, STONE), box(W - 2.4, 0.1, dep - 2.4, 0, 0.15, cz, [0.42, 0.4, 0.37]));
  // walls: plaster panels framed in dark timber; the front has a doorway under the lower roof
  const H = D.wallH;
  solid.push(box(W, H, 1.2, 0, 0, D.hz0 + 0.6, PLAS), box(1.2, H, dep, D.hx0 + 0.6, 0, cz, PLAS), box(1.2, H, dep, D.hx1 - 0.6, 0, cz, PLAS));
  const fw = (W / 2 - D.door); for (const s of [-1, 1]) solid.push(box(fw, H, 1.2, s * (D.door + fw / 2), 0, D.hz1 - 0.6, PLAS));
  solid.push(box(D.door * 2, H - D.doorH, 1.2, 0, D.doorH, D.hz1 - 0.6, PLAS));
  for (let k = 0; k <= 8; k++) { const x = D.hx0 + (W * k) / 8; solid.push(cylY(0.62, 0.62, H, x, 0, D.hz1 + 0.1, WOOD, 10), cylY(0.62, 0.62, H, x, 0, D.hz0 - 0.1, WOOD, 10)); }
  for (let k = 0; k <= 6; k++) { const z = D.hz0 + (dep * k) / 6; for (const s of [-1, 1]) solid.push(cylY(0.62, 0.62, H, s * (D.hx1 + 0.1), 0, z, WOOD, 10)); }
  for (const y of [0.4, 10.6, 21, H - 1.2]) { solid.push(box(W + 1.6, 1.0, 0.5, 0, y, D.hz1 + 0.35, WOOD), box(W + 1.6, 1.0, 0.5, 0, y, D.hz0 - 0.35, WOOD)); for (const s of [-1, 1]) solid.push(box(0.5, 1.0, dep + 1.6, s * (D.hx1 + 0.35), y, cz, WOOD)); }
  // lower roof (a skirt all round at mid height) and the great hipped roof with its ridge and golden ridge ends
  solid.push(frustum(W / 2 + 4.2, W / 2 + 0.4, 3.2, 11.4, TILE, 1, (dep + 8.4) / (W + 8.4), true));
  solid.push(frustum(W / 2 + 4.5, W / 2 - 7, 15, H, TILE, 1, (dep + 9) / (W + 9)));
  solid.push(box(W / 2 + 4, 1.8, 2.4, 0, H + 15, cz, TILE));
  for (const s of [-1, 1]) solid.push(box(1.4, 3.4, 2.6, s * (W / 4 + 1.6), H + 16.4, cz, GOLD));
  // bracket sets (dark timber) in a row under the great roof and the lower roof, rafter ends along the eaves
  for (const [y, inset, n] of [[H - 0.2, 0.4, 14], [11.0, 0.3, 14]] as [number, number, number][]) {
    for (let k = 0; k <= n; k++) { const x = D.hx0 + (W * k) / n; solid.push(box(1.1, 0.8, 1.6, x, y, D.hz1 + inset + 0.6, WOOD), box(1.1, 0.8, 1.6, x, y, D.hz0 - inset - 0.6, WOOD)); }
    for (let k = 0; k <= 8; k++) { const z = D.hz0 + (dep * k) / 8; for (const s of [-1, 1]) solid.push(box(1.6, 0.8, 1.1, s * (D.hx1 + inset + 0.6), y, z, WOOD)); }
  }
  for (let x = D.hx0 - 3; x <= D.hx1 + 3; x += 1.1) solid.push(box(0.25, 0.25, 0.9, x, H + 0.3, D.hz1 + 4.2, [0.86, 0.84, 0.78]), box(0.25, 0.25, 0.9, x, 11.6, D.hz1 + 3.6, [0.86, 0.84, 0.78]));
  // lattice windows on the side bays of the front, between the posts
  for (const s of [-1, 1]) for (let b2 = 0; b2 < 2; b2++) { const cx = s * (D.door + 4 + b2 * 7); solid.push(box(4.6, 3.2, 0.12, cx, 4.2, D.hz1 + 0.1, [0.16, 0.11, 0.08])); for (let k = 0; k < 7; k++) solid.push(box(0.12, 3.2, 0.16, cx - 2.1 + k * 0.7, 4.2, D.hz1 + 0.16, WOOD)); }
  // the bronze incense burner in the forecourt (the smoke rises from it, see below)
  solid.push(cylY(1.8, 1.6, 0.7, 0, 0.2, D.lantZ + 8, STONE, 12), cylY(1.6, 2.0, 1.3, 0, 0.9, D.lantZ + 8, BRZ, 14), cylY(2.2, 2.2, 0.25, 0, 2.2, D.lantZ + 8, BRZ, 14));
  for (const s of [-1, 1]) solid.push(cylY(0.12, 0.12, 1.5, s * 1.3, 2.45, D.lantZ + 8, BRZ, 6));
  solid.push(frustum(2.2, 0.4, 1.1, 3.9, BRZ)); solid.at(-1)!.translate(0, 0, D.lantZ + 8);
  // the arched gable over the front and its viewing window (lit at night)
  solid.push(frustum(8, 1, 4.4, 15.6, TILE, 1, 0.55)); solid.at(-1)!.translate(0, 0, D.hz1 + 2.2);
  glow.push(box(11, 3.4, 0.2, 0, 16.4, D.hz1 + 0.08, [1, 0.82, 0.5]));
  // inside: the seated bronze figure on a lotus, a golden halo behind, lamps either side
  const bz = D.bz;
  solid.push(cylY(7.4, 6.6, 2.2, 0, 0.2, bz, BRZ, 20), cylY(7.8, 7.6, 1.0, 0, 2.2, bz, [0.62, 0.5, 0.26], 16));
  solid.push(sph(6.6, 2.4, 4.6, 0, 4.6, bz + 1.6, BRZ), sph(4.4, 6.2, 3.2, 0, 9.6, bz, BRZ));
  for (const s of [-1, 1]) solid.push(sph(1.9, 4.2, 1.9, s * 4.3, 8.8, bz + 0.6, BRZ));
  solid.push(sph(0.9, 1.3, 0.9, 3.4, 10.4, bz + 3.4, BRZ), sph(1.1, 0.7, 1.0, -3.2, 6.0, bz + 4.0, BRZ));
  solid.push(sph(2.5, 2.8, 2.5, 0, 16.4, bz + 0.3, BRZ), sph(1.5, 1.3, 1.5, 0, 18.7, bz + 0.1, [0.2, 0.16, 0.11]));
  for (const s of [-1, 1]) solid.push(box(0.5, 2.4, 0.6, s * 2.55, 14.6, bz + 0.3, BRZ));
  { const g = new THREE.CylinderGeometry(9.5, 9.5, 0.4, 32); g.rotateX(Math.PI / 2); g.translate(0, 13.4, bz - 3.6); solid.push(paint(g, GOLD)); }
  for (const s of [-1, 1]) { solid.push(cylY(0.5, 0.5, 2.6, s * 9, 0.2, bz + 8, WOOD, 8)); glow.push(cylY(0.8, 0.8, 1.2, s * 9, 2.8, bz + 8, [1, 0.75, 0.4], 8)); }
  // cloister round the forecourt and the hall, with the two-storey middle gate in front
  const C = D.clo;
  for (const [x0, z0, x1, z1] of [[-C, -C + 4, -C + 1.2, C], [C - 1.2, -C + 4, C, C], [-C, -C + 4, C, -C + 5.2], [-C, C - 1.2, -D.gate, C], [D.gate, C - 1.2, C, C]]) {
    const w = x1 - x0, d = z1 - z0, x = (x0 + x1) / 2, z = (z0 + z1) / 2;
    solid.push(box(w, 0.8, d, x, 0, z, [0.3, 0.2, 0.14]), box(w, 5.2, d, x, 0.8, z, PLAS), box(w + (w > d ? 0 : 3), 0.7, d + (w > d ? 3 : 0), x, 6, z, TILE));
  }
  for (const s of [-1, 1]) for (const dz of [-1.6, 1.6]) solid.push(cylY(0.5, 0.5, 9, s * D.gate, 0, C - 0.6 + dz, VERMI, 10));
  solid.push(box(D.gate * 2 + 3, 1.2, 6, 0, 8.6, C - 0.6, VERMI), frustum(D.gate + 3.4, D.gate - 1, 2.6, 9.8, TILE, 1, 0.55)); solid.at(-1)!.translate(0, 0, C - 0.6);
  solid.push(box(D.gate * 2 + 1, 2.6, 4.2, 0, 12.4, C - 0.6, VERMI), frustum(D.gate + 2.6, 1.4, 3.2, 15, TILE, 1, 0.5)); solid.at(-1)!.translate(0, 0, C - 0.6);
  // stone path from the gate to the doorway, the octagonal bronze lantern on it
  solid.push(box(7, 0.06, C - D.hz1, 0, 0.16, (C + D.hz1) / 2, [0.78, 0.75, 0.68]));
  solid.push(cylY(1.1, 0.7, 1.4, 0, 0.2, D.lantZ, STONE, 8), cylY(0.35, 0.35, 1.4, 0, 1.6, D.lantZ, BRZ, 8), cylY(1.2, 1.2, 1.5, 0, 3.0, D.lantZ, BRZ, 8), cylY(1.7, 0.3, 1.0, 0, 4.5, D.lantZ, BRZ, 8));
  glow.push(cylY(1.0, 1.0, 1.0, 0, 3.25, D.lantZ, [1, 0.7, 0.35], 8));
  return { lat: [], solid, glow, beacons: [] as THREE.Vector3[] };
}
const VERMI: Col = [0.72, 0.2, 0.12];

/** Slender triangular tower clad in mirror glass, with LED edges that change colour at night. */
function buildSeaTower() {
  const solid: THREE.BufferGeometry[] = [], glow: THREE.BufferGeometry[] = [], glass: THREE.BufferGeometry[] = [];
  const g = new THREE.CylinderGeometry(8.2, 10, 148, 3); g.translate(0, 74, 0); glass.push(paint(g, [1, 1, 1]));
  solid.push(box(30, 8.4, 30, 0, -2, 0, [0.85, 0.86, 0.88]), box(31, 0.6, 31, 0, 6.4, 0, [0.4, 0.42, 0.45]));
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + Math.PI / 2, r = 9.1; const e = new THREE.BoxGeometry(0.5, 148, 0.5); e.translate(Math.sin(a) * r, 74, Math.cos(a) * r); glow.push(paint(e, [1, 1, 1])); }
  solid.push(paint(at(new THREE.CylinderGeometry(9, 9, 5, 3), 0, 120, 0), [0.75, 0.78, 0.82]));
  solid.push(paint(at(new THREE.CylinderGeometry(0.25, 0.6, 22, 6), 0, 159, 0), [0.85, 0.85, 0.88]));
  return { lat: [], solid, glow, glass, beacons: [new THREE.Vector3(0, 170.5, 0)] };
}

/** Incense smoke curling up from the burner in front of the great hall. */
function Smoke({ x, y, z }: { x: number; y: number; z: number }) {
  const N = 26, g = useMemo(() => { const b = new THREE.BufferGeometry(); b.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); return b; }, []);
  const mat = useMemo(() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d')!, gr = c.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(235,235,240,.55)'); gr.addColorStop(1, 'rgba(235,235,240,0)'); c.fillStyle = gr; c.fillRect(0, 0, 64, 64); return new THREE.PointsMaterial({ map: new THREE.CanvasTexture(cv), size: 2.6, transparent: true, depthWrite: false }); }, []);
  useFrame(({ clock }) => { const a = g.attributes.position as THREE.BufferAttribute, t = clock.elapsedTime; for (let k = 0; k < N; k++) { const u = ((t * 0.25 + k / N) % 1); a.setXYZ(k, x + Math.sin(u * 7 + k) * (0.2 + u * 1.4), y + u * 9, z + Math.cos(u * 5 + k) * (0.2 + u * 1.0)); } a.needsUpdate = true; });
  return <points geometry={g} material={mat} />;
}
export default function Landmarks() {
  const L = LANDMARK3D;
  const D = useMemo(() => {
    const b: { lat: THREE.BufferGeometry[]; solid: THREE.BufferGeometry[]; glow: THREE.BufferGeometry[]; glass?: THREE.BufferGeometry[]; beacons: THREE.Vector3[] } =
      L.kind === 'tower' ? buildTower() : L.kind === 'castle' ? buildCastle({ stone: [0.52, 0.5, 0.47], wall: [0.96, 0.96, 0.94], roof: [0.33, 0.56, 0.5], trim: [0.25, 0.25, 0.27] }) : L.kind === 'redcastle' ? buildRedCastle() : L.kind === 'daibutsu' ? buildDaibutsu() : buildSeaTower();
    const latMat = new THREE.MeshStandardMaterial({ map: latticeTexture(), alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, roughness: 0.6, metalness: 0.2, emissive: new THREE.Color('#ff7a2a'), emissiveIntensity: 0 });
    const solidMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05, emissive: new THREE.Color('#ffe2b0'), emissiveIntensity: 0 });
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: '#ffffff' });
    const glassMat = new THREE.MeshStandardMaterial({ color: '#9fc4dd', metalness: 0.9, roughness: 0.08, envMapIntensity: 1.6 });
    const beaconMat = new THREE.MeshBasicMaterial({ color: '#ff2020', toneMapped: false });
    return {
      lat: b.lat.length ? merge(b.lat) : null, solid: merge(b.solid), glow: b.glow.length ? merge(b.glow) : null, glass: b.glass && b.glass.length ? merge(b.glass) : null,
      latMat, solidMat, glowMat, glassMat, beaconMat, beacons: b.beacons,
    };
  }, [L.kind]);
  useFrame(({ clock }) => {
    const h = game.hour, night = h > 18.4 || h < 6.4, dusk = !night && (h > 17.2 || h < 7.2), k = night ? 1 : dusk ? 0.55 : 0;
    D.latMat.emissiveIntensity = k * 0.9; D.solidMat.emissiveIntensity = k * (L.kind === 'tower' ? 0.08 : 0.22);
    if (L.kind === 'seatower') { const t = clock.elapsedTime * 0.05; D.glowMat.color.setHSL(t % 1, 0.8, night ? 0.6 : dusk ? 0.45 : 0.3); }
    else D.glowMat.color.setScalar(night ? 1.4 : dusk ? 0.9 : 0.35);
    D.beaconMat.color.setRGB(Math.sin(clock.elapsedTime * 3.2) > 0.2 ? 1.6 : 0.25, 0.05, 0.05);
  });
  return (
    <group position={[L.x, 0.15, L.z]}>
      {D.lat && <mesh geometry={D.lat} material={D.latMat} castShadow receiveShadow />}
      <mesh geometry={D.solid} material={D.solidMat} castShadow receiveShadow />
      {D.glow && <mesh geometry={D.glow} material={D.glowMat} />}
      {D.glass && <mesh geometry={D.glass} material={D.glassMat} castShadow />}
      {D.beacons.map((v, i) => <mesh key={i} position={v} material={D.beaconMat}><sphereGeometry args={[0.7, 8, 6]} /></mesh>)}
      {L.kind === 'daibutsu' && <Smoke x={0} y={4.2} z={DAIBUTSU.lantZ + 8} />}
    </group>
  );
}
