import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LANES, LANE_W, roadC, N, ROAD, nodeOpen, segOpen, districtAt, blocks, HALF } from './cityGen';
import { game } from '../state/store';

/**
 * Japanese road signs, all instanced:
 *  - 止まれ (red inverted triangle) where every back lane meets a street,
 *  - speed limits (40 on ordinary streets, 50 on every fourth, wider-feeling one) just past the junctions,
 *  - blue guide boards on gantries over the east-west streets: the district ahead, to the left and to the right,
 *  - coin-parking lots: the yellow "P" sign with its tariff, the pay machine, a flap plate in every bay.
 * (Parking itself: see crime/parking.ts.)
 */
function tex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d')!); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const JP = '"Hiragino Sans","Noto Sans JP","Yu Gothic",sans-serif';
const stopTex = () => tex(128, 128, (c) => { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(4, 10); c.lineTo(124, 10); c.lineTo(64, 122); c.closePath(); c.fill(); c.fillStyle = '#d8101a'; c.beginPath(); c.moveTo(13, 16); c.lineTo(115, 16); c.lineTo(64, 111); c.closePath(); c.fill(); c.fillStyle = '#fff'; c.font = `900 30px ${JP}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('止まれ', 64, 46); });
const limitTex = (n: number) => tex(128, 128, (c) => { c.fillStyle = '#d8101a'; c.beginPath(); c.arc(64, 64, 60, 0, Math.PI * 2); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(64, 64, 46, 0, Math.PI * 2); c.fill(); c.fillStyle = '#1b3fae'; c.font = '900 62px Arial,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), 64, 68); });
const guideTex = (ahead: string, left: string, right: string) => tex(512, 224, (c) => {
  c.fillStyle = '#1447b8'; c.fillRect(0, 0, 512, 224); c.strokeStyle = '#fff'; c.lineWidth = 6; c.strokeRect(6, 6, 500, 212);
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 12; c.lineCap = 'round';
  c.beginPath(); c.moveTo(256, 196); c.lineTo(256, 92); c.moveTo(120, 132); c.lineTo(392, 132); c.stroke(); // the junction
  const head = (x: number, y: number, a: number) => { c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.moveTo(0, -20); c.lineTo(17, 6); c.lineTo(-17, 6); c.closePath(); c.fill(); c.restore(); };
  head(256, 84, 0); head(110, 132, -Math.PI / 2); head(402, 132, Math.PI / 2);
  c.font = `800 34px ${JP}`; c.fillText(ahead, 256, 40); c.font = `800 30px ${JP}`; c.fillText(left, 92, 86); c.fillText(right, 420, 86);
});
const coinTex = () => tex(256, 384, (c) => { c.fillStyle = '#ffd400'; c.fillRect(0, 0, 256, 384); c.fillStyle = '#111'; c.font = '900 190px Arial,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('P', 128, 110); c.fillStyle = '#0a8a3a'; c.fillRect(20, 206, 216, 54); c.fillStyle = '#fff'; c.font = `900 36px ${JP}`; c.fillText('空 車', 128, 235); c.fillStyle = '#111'; c.font = `800 30px ${JP}`; c.fillText('24時間 入出庫可', 128, 292); c.font = `900 34px ${JP}`; c.fillStyle = '#c0101a'; c.fillText('1回 $3', 128, 340); });

export default function RoadSigns() {
  const R = useMemo(() => {
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), UP = THREE.Object3D.DEFAULT_UP;
    const plane = new THREE.PlaneGeometry(1, 1), mats: THREE.MeshBasicMaterial[] = [];
    const board = (t: THREE.Texture, alpha: boolean) => { const m = new THREE.MeshBasicMaterial({ map: t, transparent: alpha, alphaTest: alpha ? 0.5 : 0, side: THREE.DoubleSide, toneMapped: false }); mats.push(m); return m; };
    const inst = (mat: THREE.Material, list: THREE.Matrix4[]) => { const im = new THREE.InstancedMesh(plane, mat, Math.max(1, list.length)); list.forEach((m, i) => im.setMatrixAt(i, m)); im.count = list.length; im.frustumCulled = false; return im; };
    const at = (x: number, y: number, z: number, ry: number, w: number, h: number) => M.compose(V.set(x, y, z), Q.setFromAxisAngle(UP, ry), S.set(w, h, 1)).clone();
    const poles: THREE.BufferGeometry[] = [], pole = (x: number, z: number, h: number, r = 0.045) => poles.push(new THREE.CylinderGeometry(r, r, h, 6).translate(x, h / 2 + 0.15, z));
    const beam = (x0: number, y: number, z0: number, x1: number, z1: number) => poles.push(new THREE.BoxGeometry(Math.abs(x1 - x0) + 0.2, 0.2, Math.abs(z1 - z0) + 0.2).translate((x0 + x1) / 2, y, (z0 + z1) / 2));
    // 止まれ at both mouths of every back lane (on the driver's left, facing the car coming out)
    const stops: THREE.Matrix4[] = [];
    for (const L of LANES) {
      const a = { x: L.x0 + 1.0, z: L.z + LANE_W / 2 + 0.45, ry: Math.PI / 2 }, b = { x: L.x1 - 1.0, z: L.z - LANE_W / 2 - 0.45, ry: -Math.PI / 2 };
      for (const q of [a, b]) { stops.push(at(q.x, 2.25, q.z, q.ry, 0.8, 0.8)); pole(q.x, q.z, 2.2); }
    }
    // speed limits on the east-west streets, on the left just past the junction (every other junction)
    const l40: THREE.Matrix4[] = [], l50: THREE.Matrix4[] = [];
    for (let j = 1; j < N; j++) for (let i = 1; i < N - 1; i++) {
      if ((i + j) % 2 || !nodeOpen(i, j) || !segOpen('x', j, i)) continue;
      const x = roadC(i) + ROAD / 2 + 4, z = roadC(j) - ROAD / 2 - 0.75;
      (j % 4 === 0 ? l50 : l40).push(at(x, 2.9, z, -Math.PI / 2, 0.66, 0.66)); pole(x, z, 3.2);
    }
    // blue guide boards over the east-west streets, before the junction, for the traffic heading east
    const guides = new Map<string, { t: THREE.Texture; list: THREE.Matrix4[] }>();
    for (let j = 2; j < N - 1; j += 4) for (let i = 3; i < N - 1; i += 6) {
      if (!nodeOpen(i, j) || !segOpen('x', j, i - 1) || !segOpen('x', j, i)) continue;
      const jx = roadC(i), jz = roadC(j), x = jx - ROAD / 2 - 14, d = 260, cl = (v: number) => Math.max(-HALF + 30, Math.min(HALF - 30, v));
      const ahead = districtAt(cl(jx + d), jz), left = districtAt(jx, cl(jz - d)), right = districtAt(jx, cl(jz + d)), key = ahead + '|' + left + '|' + right;
      let G = guides.get(key); if (!G) guides.set(key, (G = { t: guideTex(ahead, left, right), list: [] }));
      G.list.push(at(x, 6.6, jz, -Math.PI / 2, 5.6, 2.45));
      const zl = jz - ROAD / 2 - 0.6, zr = jz + ROAD / 2 + 0.6; pole(x + 0.15, zl, 7.6, 0.14); pole(x + 0.15, zr, 7.6, 0.14); beam(x + 0.15, 7.7, zl, x + 0.15, zr); beam(x + 0.15, 5.4, zl, x + 0.15, zr);
    }
    // coin parking: the sign, the pay machine, a flap plate in each bay
    const coin: THREE.Matrix4[] = [], flaps: THREE.Matrix4[] = [], boxG = new THREE.BoxGeometry(1, 1, 1), extra: THREE.BufferGeometry[] = [];
    for (const b of blocks) {
      if (b.zone !== 'parking') continue;
      const sx = b.x0 + 4.2, sz = b.z0 + 4.2; pole(sx, sz, 5.2, 0.09); coin.push(at(sx, 4.3, sz + 0.12, 0, 1.5, 2.25), at(sx, 4.3, sz - 0.12, Math.PI, 1.5, 2.25));
      extra.push(new THREE.BoxGeometry(0.7, 1.5, 0.5).translate(b.x0 + 6.6, 0.9, b.z0 + 6.2), new THREE.BoxGeometry(0.9, 0.12, 0.7).translate(b.x0 + 6.6, 1.72, b.z0 + 6.2));
      for (let x = b.x0 + 9; x < b.x1 - 23; x += 3.2) for (const z of [b.z0 + 12.6, b.z1 - 12.6]) flaps.push(M.compose(V.set(x + 1.6, 0.24, z), Q.identity(), S.set(1.6, 0.1, 0.5)).clone());
    }
    const steel = new THREE.MeshStandardMaterial({ color: '#b8bcc2', metalness: 0.6, roughness: 0.4 }), yellow = new THREE.MeshStandardMaterial({ color: '#f2c200', roughness: 0.6 }), machine = new THREE.MeshStandardMaterial({ color: '#e8e8ea', roughness: 0.5 });
    const flapI = new THREE.InstancedMesh(boxG, yellow, Math.max(1, flaps.length)); flaps.forEach((m, i) => flapI.setMatrixAt(i, m)); flapI.count = flaps.length; flapI.frustumCulled = false;
    const objs: THREE.Object3D[] = [inst(board(stopTex(), true), stops), inst(board(limitTex(40), true), l40), inst(board(limitTex(50), true), l50), inst(board(coinTex(), false), coin), flapI];
    for (const G of guides.values()) objs.push(inst(board(G.t, false), G.list));
    if (poles.length) { const g = mergeGeometries(poles)!; const m = new THREE.Mesh(g, steel); m.frustumCulled = false; objs.push(m); }
    if (extra.length) { const m = new THREE.Mesh(mergeGeometries(extra)!, machine); m.frustumCulled = false; objs.push(m); }
    return { objs, mats, counts: { stops: stops.length, limits: l40.length + l50.length, guides: [...guides.values()].reduce((a, G) => a + G.list.length, 0), guideKinds: guides.size, coinLots: coin.length / 2, flaps: flaps.length } };
  }, []);
  useMemo(() => { (window as unknown as { __nb3dSigns?: unknown }).__nb3dSigns = R.counts; }, [R]);
  // signs are retro-reflective: they stay readable at night, a little dimmer
  useFrame(() => { const h = game.hour, night = h > 18.4 || h < 6.4, k = night ? 0.62 : h > 17.2 || h < 7.2 ? 0.8 : 1; for (const m of R.mats) m.color.setScalar(k); });
  return <group>{R.objs.map((o, i) => <primitive key={i} object={o} />)}</group>;
}
