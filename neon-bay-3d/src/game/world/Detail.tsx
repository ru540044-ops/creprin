import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { buildings, blocks, Building, BlockInfo } from './cityGen';
import { game } from '../state/store';
import { getTextures } from './textures';
import { mulberry } from './rng';

/**
 * City detail layer (all instanced, a handful of draw calls):
 *  - rooftops: parapets, AC units, stair huts, water tanks, antennas with blinking red aircraft lights,
 *  - street-level neon: wall signs facing the street + Japanese-style vertical blade signs (glow at night).
 */
const H_WORDS: [string, string][] = [['RAMEN', '#ff4a4a'], ['BAR', '#ff3f93'], ['HOTEL', '#2be4ff'], ['カラオケ', '#ffd23a'], ['24H', '#3dffb0'], ['ゲーム', '#c07aff'], ['PIZZA', '#ff8a2a'], ['寿司', '#ff4a6a'], ['CLUB', '#b07aff'], ['SUSHI', '#3dffb0'], ['COFFEE', '#ffcf8a'], ['居酒屋', '#ff6a3a'], ['ARCADE', '#2be4ff'], ['BEER', '#ffd23a'], ['TACOS', '#ff8a2a'], ['焼肉', '#ff3a3a'], ['JAZZ', '#7ab8ff'], ['CAFE', '#ff9ad5'], ['MOTEL', '#ff3f93'], ['薬局', '#3dffb0'], ['BOOKS', '#ffffff'], ['GYM', '#9dff3a'], ['DANCE', '#ff3f93'], ['LIVE', '#2be4ff'], ['NOODLE', '#ffd23a'], ['HOSTEL', '#7ab8ff'], ['DONUTS', '#ff9ad5'], ['麺', '#ffcf8a'], ['NAILS', '#ff6ad5'], ['TATTOO', '#ff4a4a'], ['PAWN', '#ffd23a'], ['BAY FM', '#2be4ff']];
const V_WORDS: [string, string][] = [['カラオケ', '#ffd23a'], ['ラーメン', '#ff4a4a'], ['居酒屋', '#ff6a3a'], ['ホテル', '#2be4ff'], ['薬局', '#3dffb0'], ['焼肉', '#ff3a3a'], ['寿司', '#ff4a6a'], ['喫茶', '#ffcf8a']];

function atlas(words: [string, string][], cols: number, rows: number, cw: number, ch: number, vertical: boolean) {
  const cv = document.createElement('canvas'); cv.width = cols * cw; cv.height = rows * ch; const c = cv.getContext('2d')!;
  c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
  words.forEach(([t, col], i) => {
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
    c.fillStyle = '#0c0a14'; c.fillRect(x + 4, y + 4, cw - 8, ch - 8);
    c.strokeStyle = col; c.lineWidth = 5; c.shadowColor = col; c.shadowBlur = 14; c.strokeRect(x + 10, y + 10, cw - 20, ch - 20);
    c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (vertical) { const n = t.length, fs = Math.min(cw * 0.62, (ch - 40) / n); c.font = `900 ${fs}px "Hiragino Sans","Noto Sans JP",system-ui,sans-serif`; [...t].forEach((chr, k) => c.fillText(chr, x + cw / 2, y + 24 + fs * (k + 0.5))); }
    else { const fs = Math.min(ch * 0.55, (cw - 40) / Math.max(2, t.length) * 1.7); c.font = `900 ${fs}px "Hiragino Sans","Noto Sans JP",system-ui,sans-serif`; c.fillText(t, x + cw / 2, y + ch / 2 + 2); }
    c.shadowBlur = 0;
  });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; return tex;
}
/** Basic material whose instances each show one cell of the atlas (per-instance UV offset). */
function atlasMaterial(tex: THREE.Texture, sx: number, sy: number) {
  const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute vec2 uvOff;\n' + sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>\n  vMapUv = vMapUv * vec2(${sx.toFixed(4)}, ${sy.toFixed(4)}) + uvOff;`);
  };
  return m;
}

const blockOf = (b: Building) => blocks.find((q) => b.x0 >= q.x0 - 1 && b.x1 <= q.x1 + 1 && b.z0 >= q.z0 - 1 && b.z1 <= q.z1 + 1);
type Face = { nx: number; nz: number; cx: number; cz: number; len: number };
/** Building faces that look onto a street. */
function streetFaces(b: Building, k: BlockInfo): Face[] {
  const f: Face[] = [], cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  if (b.z0 - k.z0 < 8) f.push({ nx: 0, nz: -1, cx, cz: b.z0, len: b.x1 - b.x0 });
  if (k.z1 - b.z1 < 8) f.push({ nx: 0, nz: 1, cx, cz: b.z1, len: b.x1 - b.x0 });
  if (b.x0 - k.x0 < 8) f.push({ nx: -1, nz: 0, cx: b.x0, cz, len: b.z1 - b.z0 });
  if (k.x1 - b.x1 < 8) f.push({ nx: 1, nz: 0, cx: b.x1, cz, len: b.z1 - b.z0 });
  return f;
}

export default function Detail() {
  const D = useMemo(() => {
    const r = mulberry(4242), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    const boxes: { m: THREE.Matrix4; c: THREE.Color }[] = [], cyls: { m: THREE.Matrix4; c: THREE.Color }[] = [], beacons: THREE.Vector3[] = [];
    const hs: { m: THREE.Matrix4; o: [number, number] }[] = [], vs: { m: THREE.Matrix4; o: [number, number] }[] = [];
    const box = (x: number, y: number, z: number, w: number, h: number, d: number, col: string, yaw = 0) => { Q.setFromAxisAngle(UP, yaw); P.set(x, y + h / 2, z); S.set(w, h, d); boxes.push({ m: M.compose(P, Q, S).clone(), c: new THREE.Color(col) }); };
    const cyl = (x: number, y: number, z: number, rr: number, h: number, col: string) => { Q.identity(); P.set(x, y + h / 2, z); S.set(rr, h, rr); cyls.push({ m: M.compose(P, Q, S).clone(), c: new THREE.Color(col) }); };
    for (const b of buildings) {
      if (b.gable || b.type === 'hangar') continue;
      const top = b.y0 + b.h, w = b.x1 - b.x0, d = b.z1 - b.z0, grey = ['#8a8c90', '#9a958c', '#7d8186', '#a5a39d'][Math.floor(r() * 4)];
      // parapet ring
      const pt = 0.35, ph = 0.9;
      box((b.x0 + b.x1) / 2, top, b.z0 + pt / 2, w, ph, pt, grey); box((b.x0 + b.x1) / 2, top, b.z1 - pt / 2, w, ph, pt, grey);
      box(b.x0 + pt / 2, top, (b.z0 + b.z1) / 2, pt, ph, d, grey); box(b.x1 - pt / 2, top, (b.z0 + b.z1) / 2, pt, ph, d, grey);
      const rx = () => b.x0 + 2 + r() * Math.max(0.1, w - 4), rz = () => b.z0 + 2 + r() * Math.max(0.1, d - 4);
      if (w > 8 && d > 8) {
        const n = 1 + Math.floor(r() * (w * d > 600 ? 5 : 3));
        for (let k = 0; k < n; k++) { box(rx(), top, rz(), 1.4, 1.0, 1.1, '#c9ccd0', r() * Math.PI); }
        if (r() < 0.65) box(rx(), top, rz(), 3.2, 2.6, 2.6, grey);
        if ((b.type === 'brick' || b.type === 'office' || b.type === 'shop') && r() < 0.4) { const x = rx(), z = rz(); cyl(x, top + 1.2, z, 1.25, 2.4, '#8a6a4a'); box(x, top, z, 2.2, 1.2, 2.2, '#3a3a3e'); }
        if (b.h > 70) { const x = rx(), z = rz(), ah = 8 + r() * 10; cyl(x, top, z, 0.12, ah, '#c9ccd0'); beacons.push(new THREE.Vector3(x, top + ah + 0.2, z)); if (r() < 0.5) box((b.x0 + b.x1) / 2, top, (b.z0 + b.z1) / 2, w * 0.55, 3 + r() * 5, d * 0.55, '#2a3038'); }
      }
      // street-level neon
      const k = blockOf(b); if (!k || (k.zone !== 'commercial' && k.zone !== 'downtown' && k.zone !== 'gas')) continue;
      for (const f of streetFaces(b, k)) {
        if (f.len < 8 || r() < 0.25) continue;
        const n = f.len > 30 ? 2 : 1;
        for (let j = 0; j < n; j++) {
          const along = (j - (n - 1) / 2) * (f.len / n) + (r() - 0.5) * f.len * 0.2, sw = 3.5 + r() * 3, y = b.y0 + 3.4 + r() * 2.5;
          const x = f.cx + (f.nz !== 0 ? along : 0) + f.nx * 0.12, z = f.cz + (f.nx !== 0 ? along : 0) + f.nz * 0.12;
          Q.setFromAxisAngle(UP, Math.atan2(f.nx, f.nz)); P.set(x, y, z); S.set(sw, sw / 2, 1);
          const cell = Math.floor(r() * H_WORDS.length); hs.push({ m: M.compose(P, Q, S).clone(), o: [(cell % 4) * 0.25, 1 - (Math.floor(cell / 4) + 1) * 0.125] });
          if (k.zone === 'commercial' && r() < 0.55) { // vertical blade sign sticking out from the wall
            const vx = f.cx + (f.nz !== 0 ? along + sw / 2 + 1.2 : 0) + f.nx * 0.9, vz = f.cz + (f.nx !== 0 ? along + sw / 2 + 1.2 : 0) + f.nz * 0.9;
            Q.setFromAxisAngle(UP, Math.atan2(f.nx, f.nz) + Math.PI / 2); P.set(vx, y + 2.6, vz); S.set(1.3, 5.2, 1);
            const vc = Math.floor(r() * V_WORDS.length); vs.push({ m: M.compose(P, Q, S).clone(), o: [vc * 0.125, 0] });
          }
        }
      }
    }
    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, list: { m: THREE.Matrix4; c?: THREE.Color }[]) => { const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)); list.forEach((it, i) => { im.setMatrixAt(i, it.m); if (it.c) im.setColorAt(i, it.c); }); im.count = list.length; im.receiveShadow = true; im.computeBoundingSphere(); return im; };
    const roofMat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.1 });
    const roofBoxes = mk(new THREE.BoxGeometry(1, 1, 1), roofMat, boxes), roofCyl = mk(new THREE.CylinderGeometry(1, 1, 1, 10), roofMat, cyls);
    const hTex = atlas(H_WORDS, 4, 8, 256, 128, false), vTex = atlas(V_WORDS, 8, 1, 128, 512, true);
    const hMat = atlasMaterial(hTex, 0.25, 0.125), vMat = atlasMaterial(vTex, 0.125, 1);
    const plane = () => new THREE.PlaneGeometry(1, 1);
    const withOff = (list: { m: THREE.Matrix4; o: [number, number] }[], mat: THREE.Material) => { const g = plane(); g.setAttribute('uvOff', new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, list.length) * 2), 2)); const im = mk(g, mat, list); const a = g.getAttribute('uvOff') as THREE.InstancedBufferAttribute; list.forEach((it, i) => a.setXY(i, it.o[0], it.o[1])); im.receiveShadow = false; return im; };
    const signs = withOff(hs, hMat), blades = withOff(vs, vMat);
    const beaconMat = new THREE.MeshBasicMaterial({ map: getTextures().glow, color: '#ff2020', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const bl = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.6, 1.6), beaconMat, Math.max(1, beacons.length)); bl.count = beacons.length; bl.frustumCulled = false;
    return { roofBoxes, roofCyl, signs, blades, hMat, vMat, bl, beacons, beaconMat, counts: { roof: boxes.length + cyls.length, signs: hs.length + vs.length, beacons: beacons.length } };
  }, []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), s: new THREE.Vector3(1, 1, 1) }), []);
  useFrame(({ camera, clock }) => {
    const h = game.hour, night = h > 18.4 || h < 6.4, dusk = !night && (h > 17.2 || h < 7.2);
    const k = night ? 1.7 : dusk ? 1.1 : 0.55; D.hMat.color.setScalar(k); D.vMat.color.setScalar(k);
    const blink = Math.sin(clock.elapsedTime * 3.2) > 0.2; D.beaconMat.opacity = night || dusk ? (blink ? 1 : 0.12) : (blink ? 0.4 : 0.05);
    for (let i = 0; i < D.beacons.length; i++) { tmp.m.compose(D.beacons[i], camera.quaternion, tmp.s); D.bl.setMatrixAt(i, tmp.m); }
    D.bl.instanceMatrix.needsUpdate = true;
  });
  return <><primitive object={D.roofBoxes} /><primitive object={D.roofCyl} /><primitive object={D.signs} /><primitive object={D.blades} /><primitive object={D.bl} /></>;
}
