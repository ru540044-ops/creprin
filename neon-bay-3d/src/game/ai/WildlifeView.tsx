import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { critters, updateWildlife, Critter } from './wildlife';
import { tdt } from '../admin';

/** The city's birds and cats, drawn with instanced meshes (bodies, two wings per bird, one mesh for the cats). */
type Col = [number, number, number];
const paint = (g: THREE.BufferGeometry, c: Col) => { const g2 = g.index ? g.toNonIndexed() : g, n = g2.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g2.setAttribute('color', new THREE.BufferAttribute(a, 3)); for (const k of Object.keys(g2.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g2.deleteAttribute(k); return g2; };
const sph = (rx: number, ry: number, rz: number, x: number, y: number, z: number, c: Col, w = 8, h = 6) => { const g = new THREE.SphereGeometry(1, w, h); g.scale(rx, ry, rz); g.translate(x, y, z); return paint(g, c); };
const bx = (w: number, h: number, d: number, x: number, y: number, z: number, c: Col) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return paint(g, c); };
const cyl = (r0: number, r1: number, h: number, x: number, y: number, z: number, c: Col, rx = 0, rz = 0) => { const g = new THREE.CylinderGeometry(r0, r1, h, 6); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); g.translate(x, y, z); return paint(g, c); };
const W: Col = [1, 1, 1], DK: Col = [0.12, 0.11, 0.1], BEAK: Col = [0.95, 0.75, 0.35], LEG: Col = [0.8, 0.35, 0.3];
const MAXB = 170, MAXC = 40;

function geos() {
  const bird = mergeGeometries([
    sph(0.052, 0.05, 0.13, 0, 0.075, 0, W), sph(0.034, 0.034, 0.036, 0, 0.125, 0.1, W), sph(0.012, 0.01, 0.026, 0, 0.12, 0.14, BEAK, 5, 4), bx(0.06, 0.008, 0.11, 0, 0.07, -0.16, [0.8, 0.8, 0.8]),
    cyl(0.004, 0.004, 0.05, 0.02, 0.025, 0.01, LEG), cyl(0.004, 0.004, 0.05, -0.02, 0.025, 0.01, LEG), sph(0.006, 0.006, 0.004, 0.03, 0.13, 0.115, DK, 4, 3), sph(0.006, 0.006, 0.004, -0.03, 0.13, 0.115, DK, 4, 3),
  ])!;
  const wing = (s: 1 | -1) => bx(0.17, 0.007, 0.085, s * 0.085, 0, 0, [0.85, 0.85, 0.85]);
  const cat = mergeGeometries([
    sph(0.075, 0.08, 0.2, 0, 0.19, 0, W, 10, 7), sph(0.068, 0.066, 0.065, 0, 0.27, 0.2, W, 8, 6), cyl(0.0, 0.022, 0.06, 0.04, 0.34, 0.2, W, 0, 0), cyl(0.0, 0.022, 0.06, -0.04, 0.34, 0.2, W, 0, 0),
    cyl(0.014, 0.02, 0.34, 0, 0.27, -0.32, W, -0.6, 0), sph(0.012, 0.012, 0.01, 0.03, 0.28, 0.255, [0.6, 0.85, 0.3], 4, 3), sph(0.012, 0.012, 0.01, -0.03, 0.28, 0.255, [0.6, 0.85, 0.3], 4, 3),
    cyl(0.02, 0.016, 0.17, 0.045, 0.085, 0.13, W), cyl(0.02, 0.016, 0.17, -0.045, 0.085, 0.13, W), cyl(0.02, 0.016, 0.17, 0.045, 0.085, -0.13, W), cyl(0.02, 0.016, 0.17, -0.045, 0.085, -0.13, W),
  ])!;
  return { bird, wl: wing(-1), wr: wing(1), cat };
}
const COL: Record<string, string[]> = { pigeon: ['#8b909a', '#a9aab2', '#6d727e'], crow: ['#17171c', '#1d1d23', '#121216'], gull: ['#f0f2f4', '#dcdfe4', '#f4f4f1'], cat: ['#c9722e', '#1b1b1f', '#7d7f87', '#e8e4dc', '#8a6a47'] };

const M = new THREE.Matrix4(), B = new THREE.Matrix4(), T = new THREE.Matrix4(), R = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
export default function WildlifeView() {
  const G = useMemo(geos, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), []);
  const bird = useRef<THREE.InstancedMesh>(null!), wl = useRef<THREE.InstancedMesh>(null!), wr = useRef<THREE.InstancedMesh>(null!), cat = useRef<THREE.InstancedMesh>(null!);
  const colored = useRef(false);
  useFrame(({ camera }, rawDt) => {
    updateWildlife(tdt(Math.min(rawDt, 0.05)));
    const cx = camera.position.x, cz = camera.position.z;
    let nb = 0, nc = 0;
    for (const c of critters) {
      if (c.state === 'sleep' || Math.abs(c.x - cx) > 130 || Math.abs(c.z - cz) > 130) continue;
      if (c.kind === 'cat') { if (nc >= MAXC) continue; place(c, nc, cat.current, null, null); nc++; }
      else { if (nb >= MAXB) continue; place(c, nb, bird.current, wl.current, wr.current); nb++; }
    }
    for (let i = nb; i < MAXB; i++) { bird.current.setMatrixAt(i, ZERO); wl.current.setMatrixAt(i, ZERO); wr.current.setMatrixAt(i, ZERO); }
    for (let i = nc; i < MAXC; i++) cat.current.setMatrixAt(i, ZERO);
    for (const m of [bird.current, wl.current, wr.current, cat.current]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    colored.current = true;
  });
  return (<>
    <instancedMesh ref={bird} args={[G.bird, mat, MAXB]} frustumCulled={false} castShadow />
    <instancedMesh ref={wl} args={[G.wl, mat, MAXB]} frustumCulled={false} />
    <instancedMesh ref={wr} args={[G.wr, mat, MAXB]} frustumCulled={false} />
    <instancedMesh ref={cat} args={[G.cat, mat, MAXC]} frustumCulled={false} castShadow />
  </>);
}

function place(c: Critter, i: number, body: THREE.InstancedMesh, wL: THREE.InstancedMesh | null, wR: THREE.InstancedMesh | null) {
  const flying = c.state === 'fly' || c.state === 'land', cats = c.kind === 'cat';
  let pitch = 0, roll = 0, dy = 0;
  if (cats) { if (c.state === 'sit') { pitch = -0.75; dy = -0.02; } else if (c.state === 'sleep') pitch = 0; else dy = Math.abs(Math.sin(c.phase * 0.5)) * 0.012 * Math.min(1, c.spd); }
  else if (flying) { pitch = -Math.max(-0.5, Math.min(0.6, c.vy * 0.12)); roll = c.state === 'fly' ? Math.sin(c.phase * 0.07 + c.id) * 0.25 : 0; }
  else if (c.state === 'peck') pitch = c.head * 0.6 + 0.12;
  else if (c.state === 'walk') { dy = Math.abs(Math.sin(c.phase)) * 0.006; pitch = Math.sin(c.phase * 2) * 0.05; }
  Q.setFromAxisAngle(UP, c.yaw); V.set(c.x, c.y + dy, c.z); S.setScalar(c.s); B.compose(V, Q, S);
  R.makeRotationX(pitch); B.multiply(R); if (roll) { R.makeRotationZ(roll); B.multiply(R); }
  body.setMatrixAt(i, B);
  const pal = COL[c.kind]; C.set(pal[c.col % pal.length]); body.setColorAt(i, C);
  if (wL && wR) {
    // wings: out and flapping in flight, folded against the body on the ground
    const a = flying ? Math.sin(c.phase) * (c.vy > 0.5 || c.state === 'land' ? 0.85 : 0.55) + 0.1 : -1.35;
    const sc = flying ? 1 : 0.55;
    T.makeTranslation(0.045, 0.1, 0.01); R.makeRotationZ(a); M.copy(B).multiply(T).multiply(R); S.set(sc, 1, flying ? 1 : 1.1); R.makeScale(S.x, S.y, S.z); M.multiply(R); wR.setMatrixAt(i, M);
    T.makeTranslation(-0.045, 0.1, 0.01); R.makeRotationZ(-a); M.copy(B).multiply(T).multiply(R); R.makeScale(sc, 1, flying ? 1 : 1.1); M.multiply(R); wL.setMatrixAt(i, M);
    wL.setColorAt(i, C); wR.setColorAt(i, C);
  }
}
