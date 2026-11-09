import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LANDMARK3D } from './cityGen';
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

export default function Landmarks() {
  const L = LANDMARK3D;
  const D = useMemo(() => {
    const b: { lat: THREE.BufferGeometry[]; solid: THREE.BufferGeometry[]; glow: THREE.BufferGeometry[]; glass?: THREE.BufferGeometry[]; beacons: THREE.Vector3[] } =
      L.kind === 'tower' ? buildTower() : L.kind === 'castle' ? buildCastle({ stone: [0.52, 0.5, 0.47], wall: [0.96, 0.96, 0.94], roof: [0.33, 0.56, 0.5], trim: [0.25, 0.25, 0.27] }) : L.kind === 'redcastle' ? buildRedCastle() : buildSeaTower();
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
    </group>
  );
}
