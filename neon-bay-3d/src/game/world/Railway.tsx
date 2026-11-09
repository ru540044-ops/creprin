import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Geo } from './geo';
import { RAIL, HALF, PITCH, ROAD } from './cityGen';
import { REGION } from './region';
import { labelTexture } from './textures';
import { game } from '../state/store';

/**
 * The elevated railway: concrete viaduct on piers in the median of one avenue, three stations with platforms and canopies,
 * overhead wires, and trains running on the left-hand track (as in Japan) that stop at every station and turn back at the ends.
 */
const R = RAIL, CAR = 20, GAP = 0.6, TRACK = 2.1, V = 20;
const trainLen = R.cars * (CAR + GAP);
const STATION_NAMES = [REGION.names.commercial[0], REGION.names.downtown, REGION.names.residential[1]];

/** One direction's run: dwell at the first terminus, then station to station. Positions are the head car's centre. */
function schedule(dir: 1 | -1) {
  const a = dir > 0 ? R.z0 + trainLen : R.z1 - trainLen, b = dir > 0 ? R.z1 - 12 : R.z0 + 12;
  const stops = R.stations.map((z) => z + dir * (trainLen / 2 - CAR / 2)).filter((z) => (z - a) * dir > 0 && (b - z) * dir > 0).sort((p, q) => (p - q) * dir);
  const pts = [a, ...stops, b], seg: { s0: number; s1: number; t0: number; t1: number }[] = [];
  let t = 0;
  for (let k = 0; k < pts.length; k++) {
    const dwell = k === 0 || k === pts.length - 1 ? 18 : 12; seg.push({ s0: pts[k], s1: pts[k], t0: t, t1: t + dwell }); t += dwell;
    if (k < pts.length - 1) { const d = Math.abs(pts[k + 1] - pts[k]) / V * 1.5; seg.push({ s0: pts[k], s1: pts[k + 1], t0: t, t1: t + d }); t += d; }
  }
  return { seg, T: t };
}
const SB = schedule(1), NB = schedule(-1), PERIOD = SB.T + NB.T;
/** Where a train is at time t of its cycle: southbound on the east track, then back north on the west track. */
function trainAt(t: number) {
  t = ((t % PERIOD) + PERIOD) % PERIOD;
  const S = t < SB.T ? SB : NB, dir = t < SB.T ? 1 : -1, tt = t < SB.T ? t : t - SB.T;
  for (const g of S.seg) if (tt <= g.t1) { const u = g.t1 > g.t0 ? (tt - g.t0) / (g.t1 - g.t0) : 1, e = u * u * (3 - 2 * u); return { z: g.s0 + (g.s1 - g.s0) * e, dir, x: R.x + (dir > 0 ? TRACK : -TRACK) }; }
  return { z: S.seg[S.seg.length - 1].s1, dir, x: R.x + (dir > 0 ? TRACK : -TRACK) };
}

function viaduct() {
  const C = new Geo(), M = new Geo(), y = R.y, hw = R.half, x = R.x, CON = [0.72, 0.71, 0.69], DARK = [0.3, 0.3, 0.32], RAILC = [0.45, 0.42, 0.4];
  if (R.mono) for (const s of [-1, 1]) C.box(x + s * TRACK - 0.45, y - 1.5, R.z0, x + s * TRACK + 0.45, y, R.z1, CON, 4, 4, C, 8); // monorail: two guideway beams
  else {
    C.box(x - hw, y - 0.9, R.z0, x + hw, y, R.z1, CON, 4, 4, C, 8);
    C.box(x - hw, y - 0.95, R.z0, x + hw, y - 0.9, R.z1, [0.55, 0.55, 0.53], 4, 4, null); // soffit edge
    for (const s of [-1, 1]) C.box(x + s * hw - (s > 0 ? 0.3 : 0), y, R.z0, x + s * hw + (s < 0 ? 0.3 : 0), y + 1.05, R.z1, CON);
    for (const s of [-1, 1]) { const tx = x + s * TRACK; M.box(tx - 1.3, y, R.z0, tx + 1.3, y + 0.16, R.z1, [0.42, 0.4, 0.38], 4, 4, M, 2); for (const o of [-0.72, 0.72]) M.box(tx + o - 0.04, y + 0.16, R.z0, tx + o + 0.04, y + 0.32, R.z1, RAILC); }
  }
  for (const z of R.piers) { C.box(x - 0.8, 0, z - 1.2, x + 0.8, y - (R.mono ? 1.5 : 0.9), z + 1.2, CON); C.box(x - 3.2, y - (R.mono ? 2.4 : 1.8), z - 1.3, x + 3.2, y - (R.mono ? 1.5 : 0.9), z + 1.3, CON); }
  // end walls and buffer stops
  if (!R.mono) for (const z of [R.z0, R.z1]) { C.box(x - hw, y, z - 0.4, x + hw, y + 1.4, z + 0.4, CON); for (const s of [-1, 1]) M.box(x + s * TRACK - 1, y + 0.3, z - 1.2 * Math.sign(z), x + s * TRACK + 1, y + 1.4, z - 0.4 * Math.sign(z), [0.85, 0.75, 0.15]); }
  // catenary masts and cross beams every 50 m
  if (!R.mono) for (let z = R.z0 + 10; z < R.z1; z += 50) { for (const s of [-1, 1]) M.box(x + s * (hw - 0.45) - 0.15, y, z - 0.15, x + s * (hw - 0.45) + 0.15, y + 6.2, z + 0.15, DARK); M.box(x - hw + 0.3, y + 5.7, z - 0.12, x + hw - 0.3, y + 5.95, z + 0.12, DARK); }
  // stations: side platforms, canopies on columns, stairs down to the pavement
  const G = new Geo();
  for (const sz of R.stations) for (const s of [-1, 1]) {
    const px0 = s < 0 ? x - 7.8 : x + hw, px1 = s < 0 ? x - hw : x + 7.8, z0 = sz - 55, z1 = sz + 55;
    C.box(px0, y - 0.9, z0, px1, y + 0.2, z1, [0.78, 0.77, 0.74], 4, 4, C, 4);
    G.box(s < 0 ? px1 - 0.5 : px0, y + 0.2, z0, s < 0 ? px1 : px0 + 0.5, y + 0.23, z1, [0.95, 0.8, 0.15], 4, 4, G, 4); // yellow tactile line
    for (let z = z0 + 6; z < z1; z += 12) M.box((px0 + px1) / 2 - 0.15, y + 0.2, z - 0.15, (px0 + px1) / 2 + 0.15, y + 4.2, z + 0.15, [0.75, 0.77, 0.8]);
    M.box(s < 0 ? px0 - 0.2 : x + 0.2, y + 4.2, z0 + 3, s < 0 ? x - 0.2 : px1 + 0.2, y + 4.45, z1 - 3, [0.86, 0.87, 0.9]);
    M.box(s < 0 ? px0 - 0.1 : px1 - 0.1, y + 0.2, z0, s < 0 ? px0 + 0.1 : px1 + 0.1, y + 1.3, z1, [0.6, 0.62, 0.66]); // fence
  }
  return { C: C.build(), M: M.build(), G: G.build() };
}

function carGeometry(color: string) {
  const c = new THREE.Color(color), body = new Geo(), win = new Geo(), L = CAR / 2, W = 1.45, H = 3.7, S = [0.84, 0.85, 0.87], STRIPE = [c.r, c.g, c.b];
  body.box(-W, 0.55, -L, W, H, L, S, 4, 4, body, 4);
  body.box(-W - 0.01, 0.95, -L, W + 0.01, 1.35, L, STRIPE, 4, 4, null);
  body.box(-W - 0.01, H - 0.55, -L, W + 0.01, H - 0.35, L, STRIPE, 4, 4, null);
  body.box(-W + 0.2, 0, -L + 2, W - 0.2, 0.55, -L + 4.5, [0.18, 0.18, 0.2]); body.box(-W + 0.2, 0, L - 4.5, W - 0.2, 0.55, L - 2, [0.18, 0.18, 0.2]);
  body.box(-0.9, H, -L + 6, 0.9, H + 0.4, -L + 8, [0.3, 0.3, 0.32]);
  for (let z = -L + 1.2; z < L - 1.2; z += 4.6) { win.box(-W - 0.03, 1.55, z, W + 0.03, 2.75, z + 1.6, [1, 1, 1], 4, 4, null); win.box(-W - 0.03, 0.75, z + 2.1, W + 0.03, 2.75, z + 3.4, [0.8, 0.8, 0.85], 4, 4, null); }
  win.box(-W + 0.3, 1.6, L + 0.01, W - 0.3, 2.9, L + 0.03, [1, 1, 1], 4, 4, null); win.box(-W + 0.3, 1.6, -L - 0.03, W - 0.3, 2.9, -L - 0.01, [1, 1, 1], 4, 4, null);
  return { body: body.build(), win: win.build() };
}

export default function Railway() {
  const D = useMemo(() => {
    const v = viaduct(), car = carGeometry(R.color), n = R.cars * 2;
    const conc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.55 });
    const tact = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
    const carMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.65, envMapIntensity: 1.2 });
    const winMat = new THREE.MeshStandardMaterial({ vertexColors: true, color: '#22303c', roughness: 0.1, metalness: 0.3, emissive: new THREE.Color('#fff2d0'), emissiveIntensity: 0 });
    const body = new THREE.InstancedMesh(car.body, carMat, n), win = new THREE.InstancedMesh(car.win, winMat, n);
    body.castShadow = true; body.frustumCulled = win.frustumCulled = false;
    // station name boards hanging under the canopies
    const boards = R.stations.map((z, i) => ({ z, tex: labelTexture(STATION_NAMES[i] + '駅', '#ffffff', 512, 128) }));
    // overhead contact wires
    const pts: number[] = []; if (!R.mono) for (const s of [-1, 1]) pts.push(R.x + s * TRACK, R.y + 5.5, R.z0, R.x + s * TRACK, R.y + 5.5, R.z1);
    const wire = new THREE.BufferGeometry(); wire.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return { v, conc, metal, tact, body, win, winMat, boards, wire, wireMat: new THREE.LineBasicMaterial({ color: '#202124' }) };
  }, []);
  const m = useMemo(() => new THREE.Matrix4(), []), q = useMemo(() => new THREE.Quaternion(), []), p = useMemo(() => new THREE.Vector3(), []), one = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  useFrame(() => {
    const h = game.hour, night = h > 18.4 || h < 6.4, dusk = !night && (h > 17.2 || h < 7.2);
    D.winMat.emissiveIntensity = night ? 1.1 : dusk ? 0.6 : 0.05;
    const t = game.clock; let i = 0;
    for (let k = 0; k < 2; k++) { // two trains, half a cycle apart
      const P = trainAt(t + k * PERIOD / 2);
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, P.dir > 0 ? 0 : Math.PI);
      for (let c = 0; c < R.cars; c++) { p.set(P.x, R.mono ? R.y - 1.0 : R.y + 0.32, P.z - P.dir * c * (CAR + GAP)); /* a monorail car straddles its beam */ m.compose(p, q, one); D.body.setMatrixAt(i, m); D.win.setMatrixAt(i, m); i++; }
    }
    D.body.instanceMatrix.needsUpdate = true; D.win.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <mesh geometry={D.v.C} material={D.conc} castShadow receiveShadow />
      <mesh geometry={D.v.M} material={D.metal} castShadow />
      <mesh geometry={D.v.G} material={D.tact} />
      <lineSegments geometry={D.wire} material={D.wireMat} />
      <primitive object={D.body} />
      <primitive object={D.win} />
      {D.boards.map((b, i) => [-1, 1].map((s) => (
        <mesh key={i + '_' + s} position={[R.x + s * 6.2, R.y + 3.4, b.z]} rotation-y={s * Math.PI / 2}><planeGeometry args={[4.4, 1.1]} /><meshBasicMaterial map={b.tex} toneMapped={false} side={THREE.DoubleSide} /></mesh>
      )))}
    </group>
  );
}
void HALF; void PITCH; void ROAD;
