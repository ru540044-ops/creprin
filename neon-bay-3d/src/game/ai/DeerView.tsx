import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { deer, updateDeer } from './deer';
import { tdt } from '../admin';

/**
 * Nara's deer, drawn with instanced meshes: a body, a head on its neck (pivoting at the shoulders: grazing, bowing,
 * eating), four legs (swinging as they walk; folded away when lying down) and antlers on the stags.
 */
type Col = [number, number, number];
const paint = (g: THREE.BufferGeometry, c: Col) => { const g2 = g.index ? g.toNonIndexed() : g, n = g2.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g2.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g2.attributes.uv) g2.deleteAttribute('uv'); return g2; };
const sph = (rx: number, ry: number, rz: number, x: number, y: number, z: number, c: Col, w = 12, h = 8) => { const g = new THREE.SphereGeometry(1, w, h); g.scale(rx, ry, rz); g.translate(x, y, z); return paint(g, c); };
const bx = (w: number, h: number, d: number, x: number, y: number, z: number, c: Col, rx = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); g.translate(x, y, z); return paint(g, c); };
const FUR: Col = [0.55, 0.38, 0.22], BELLY: Col = [0.82, 0.74, 0.62], WHITE: Col = [0.94, 0.92, 0.88], DARK: Col = [0.08, 0.07, 0.06], ANT: Col = [0.86, 0.8, 0.66];
/** Body centre height above the ground (standing), the neck pivot and hip / shoulder positions in body space. */
const BODY_Y = 0.95, NECK = new THREE.Vector3(0, 0.12, 0.48), LEGS: [number, number][] = [[0.15, 0.42], [-0.15, 0.42], [0.15, -0.44], [-0.15, -0.44]];
const MAX = 90;

function geos() {
  // sika deer: a row of pale spots along each flank, a darker stripe down the back, the white rump
  const spots: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) for (let k = 0; k < 9; k++) { const t = -0.45 + k * 0.11, y = 0.1 + Math.sin(k * 1.7) * 0.06; spots.push(sph(0.026, 0.026, 0.026, s * 0.265 * Math.sqrt(Math.max(0.2, 1 - (t / 0.62) ** 2)), y, t, [0.96, 0.92, 0.84], 6, 4)); }
  const body = mergeGeometries([
    sph(0.27, 0.3, 0.62, 0, 0, 0, FUR, 16, 10), sph(0.2, 0.12, 0.5, 0, -0.17, 0.02, BELLY), sph(0.15, 0.17, 0.08, 0, 0.02, -0.6, WHITE),
    sph(0.06, 0.04, 0.5, 0, 0.28, 0, [0.38, 0.25, 0.14]), ...spots,
  ])!;
  const tail = mergeGeometries([sph(0.05, 0.1, 0.04, 0, -0.06, 0, WHITE), sph(0.03, 0.06, 0.03, 0, -0.02, -0.02, DARK)])!;
  // neck and head in neck-pivot space: the neck reaches forward and up, the head at its top
  const neck = new THREE.CylinderGeometry(0.09, 0.13, 0.55, 8); neck.rotateX(0.55); neck.translate(0, 0.23, 0.13);
  const headParts = [paint(neck, FUR), sph(0.11, 0.12, 0.23, 0, 0.47, 0.36, FUR), sph(0.05, 0.045, 0.05, 0, 0.44, 0.58, DARK), sph(0.03, 0.03, 0.02, 0.09, 0.51, 0.4, DARK), sph(0.03, 0.03, 0.02, -0.09, 0.51, 0.4, DARK)];
  for (const s of [-1, 1]) { const e = new THREE.SphereGeometry(1, 8, 6); e.scale(0.05, 0.11, 0.03); e.rotateZ(s * 0.9); e.translate(s * 0.13, 0.6, 0.28); headParts.push(paint(e, FUR)); }
  const head = mergeGeometries(headParts)!;
  const antParts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) { // beam with a brow tine and a forked top (a four-point stag)
    const a = new THREE.CylinderGeometry(0.016, 0.03, 0.48, 6); a.rotateZ(s * -0.32); a.rotateX(-0.35); a.translate(s * 0.115, 0.79, 0.27); antParts.push(paint(a, ANT));
    const t = new THREE.CylinderGeometry(0.01, 0.018, 0.18, 5); t.rotateX(0.9); t.translate(s * 0.13, 0.7, 0.36); antParts.push(paint(t, ANT));
    for (const f of [-1, 1]) { const q = new THREE.CylinderGeometry(0.008, 0.015, 0.16, 5); q.rotateX(-0.2 + f * 0.6); q.rotateZ(s * -0.3); q.translate(s * 0.2, 1.05, 0.2 + f * 0.04); antParts.push(paint(q, ANT)); }
  }
  const ant = mergeGeometries(antParts)!;
  const leg = mergeGeometries([bx(0.07, 0.86, 0.08, 0, -0.43, 0, FUR), bx(0.06, 0.06, 0.07, 0, -0.85, 0.01, DARK)])!;
  return { body, head, ant, leg, tail };
}

const M = new THREE.Matrix4(), B = new THREE.Matrix4(), L = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Euler();
export default function DeerView() {
  const G = useMemo(() => (deer.length ? geos() : null), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), []);
  const body = useRef<THREE.InstancedMesh>(null!), head = useRef<THREE.InstancedMesh>(null!), ant = useRef<THREE.InstancedMesh>(null!), legs = useRef<THREE.InstancedMesh>(null!), tail = useRef<THREE.InstancedMesh>(null!);
  useFrame(({ camera }, rawDt) => {
    if (!G) return;
    updateDeer(tdt(Math.min(rawDt, 0.05)));
    const cx = camera.position.x, cz = camera.position.z;
    let n = 0, na = 0, nl = 0;
    for (const d of deer) {
      if (n >= MAX) break;
      if (Math.abs(d.x - cx) > 220 || Math.abs(d.z - cz) > 220) continue;
      const lying = d.state === 'rest', by = lying ? 0.38 : BODY_Y;
      Q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, d.yaw); V.set(d.x, d.y + by * d.s, d.z); S.setScalar(d.s); B.compose(V, Q, S);
      body.current.setMatrixAt(n, B);
      // head: pitch down to graze / bow (positive = down)
      // the head turns now and then while it stands or grazes (looking round), and nods with each step
      const now = performance.now() / 1000, still = d.state === 'graze' || d.state === 'rest' || d.state === 'beg', look = still ? Math.sin(now * 0.7 + d.id * 1.3) * Math.max(0, Math.sin(now * 0.23 + d.id)) * 0.6 : 0;
      E.set(d.head * 1.05 + (d.spd > 0.3 ? Math.sin(d.phase * 2) * 0.06 : 0), look, 0, 'YXZ'); Q.setFromEuler(E); L.compose(NECK, Q, S.set(1, 1, 1)); M.multiplyMatrices(B, L);
      head.current.setMatrixAt(n, M); if (d.buck) ant.current.setMatrixAt(na++, M);
      { const flick = Math.max(0, Math.sin(performance.now() / 1000 * 9 + d.id * 2.1)) ** 8 * 0.9; E.set(-0.4 - flick, 0, 0); Q.setFromEuler(E); L.compose(V.set(0, 0.08, -0.62), Q, S.set(1, 1, 1)); M.multiplyMatrices(B, L); tail.current.setMatrixAt(n, M); }
      for (let k = 0; k < 4; k++) {
        const [lx, lz] = LEGS[k], sw = lying ? 0 : Math.sin(d.phase + (k === 0 || k === 3 ? 0 : Math.PI)) * Math.min(0.5, d.spd * 0.18);
        E.set(sw, 0, 0); Q.setFromEuler(E); V.set(lx, -0.1, lz); S.setScalar(lying ? 0.001 : 1); L.compose(V, Q, S); M.multiplyMatrices(B, L); legs.current.setMatrixAt(nl++, M);
      }
      n++;
    }
    body.current.count = n; head.current.count = n; ant.current.count = na; legs.current.count = nl; tail.current.count = n;
    for (const m of [body, head, ant, legs, tail]) m.current.instanceMatrix.needsUpdate = true;
  });
  if (!G) return null;
  return (
    <group>
      <instancedMesh ref={body} args={[G.body, mat, MAX]} frustumCulled={false} castShadow />
      <instancedMesh ref={head} args={[G.head, mat, MAX]} frustumCulled={false} castShadow />
      <instancedMesh ref={ant} args={[G.ant, mat, MAX]} frustumCulled={false} />
      <instancedMesh ref={legs} args={[G.leg, mat, MAX * 4]} frustumCulled={false} castShadow />
      <instancedMesh ref={tail} args={[G.tail, mat, MAX]} frustumCulled={false} />
    </group>
  );
}
