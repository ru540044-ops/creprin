import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { buildings, Building, BlockInfo, topFoot, blockOfB } from './cityGen';
import type { BDoor } from './bldgInteriors';
import { game } from '../state/store';
import { getTextures } from './textures';
import { mulberry } from './rng';

/**
 * City detail layer, built per chunk by the city streamer (City.tsx) so only the area around the player exists:
 *  - rooftops: parapets, AC units, stair huts, water tanks, antennas,
 *  - street-level neon: wall signs facing the street + Japanese-style vertical blade signs (glow at night),
 *  - shop awnings and entrance doors.
 * The blinking red aircraft lights on tall towers are city-wide (they show the skyline from afar).
 */
const H_WORDS: [string, string][] = [['ラーメン', '#ff4a4a'], ['居酒屋', '#ff6a3a'], ['カラオケ', '#ffd23a'], ['焼肉', '#ff3a3a'], ['24H', '#3dffb0'], ['ゲーム', '#c07aff'], ['寿司', '#ff4a6a'], ['牛丼', '#ff8a2a'], ['CAFE', '#ff9ad5'], ['うどん', '#ffcf8a'], ['薬局', '#3dffb0'], ['書店', '#ffffff'], ['焼鳥', '#ff6a3a'], ['BAR', '#ff3f93'], ['中華', '#ff3a3a'], ['不動産', '#7ab8ff'], ['歯科', '#9de8ff'], ['美容室', '#ff6ad5'], ['ホテル', '#2be4ff'], ['そば', '#ffd23a'], ['定食', '#ffcf8a'], ['質屋', '#ffd23a'], ['とんかつ', '#ff8a2a'], ['天ぷら', '#ffd23a'], ['餃子', '#ff4a4a'], ['弁当', '#9dff3a'], ['CLUB', '#b07aff'], ['麻雀', '#3dffb0'], ['銭湯', '#7ab8ff'], ['古着', '#c07aff'], ['ジム', '#9dff3a'], ['LIVE', '#2be4ff']];
const V_WORDS: [string, string][] = [['カラオケ', '#ffd23a'], ['ラーメン', '#ff4a4a'], ['居酒屋', '#ff6a3a'], ['ホテル', '#2be4ff'], ['薬局', '#3dffb0'], ['焼肉', '#ff3a3a'], ['寿司', '#ff4a6a'], ['喫茶', '#ffcf8a'], ['麻雀', '#3dffb0'], ['焼鳥', '#ff6a3a'], ['質', '#ffd23a'], ['歯科', '#9de8ff'], ['中華', '#ff3a3a'], ['うなぎ', '#ffcf8a'], ['スナック', '#ff6ad5'], ['ビデオ', '#c07aff']];
/** Tall blade signs that run up the side of mid-rise buildings in the shopping streets. */
const T_WORDS: [string, string][] = [['カラオケ館', '#ffd23a'], ['ネットカフェ', '#2be4ff'], ['まんが喫茶', '#9dff3a'], ['焼肉食べ放題', '#ff3a3a'], ['ゲームセンター', '#c07aff'], ['居酒屋 鳥よし', '#ff6a3a'], ['中華料理 福', '#ff3a3a'], ['ビリヤード', '#3dffb0'], ['ホテル月光', '#2be4ff'], ['ラーメン大将', '#ff4a4a'], ['歯科クリニック', '#9de8ff'], ['英会話', '#ffffff'], ['すし 北海', '#ff4a6a'], ['ダーツバー', '#ff3f93'], ['整骨院', '#9dff3a'], ['学習塾', '#ffd23a']];

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
  m.customProgramCacheKey = () => 'atlas' + sx + 'x' + sy;
  return m;
}

/* ---------------- shared materials and geometries (created once) ---------------- */
let SH: ReturnType<typeof makeShared> | null = null;
function makeShared() {
  const stripe = (() => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 8; const c = cv.getContext('2d')!; for (let x = 0; x < 64; x += 16) { c.fillStyle = '#ffffff'; c.fillRect(x, 0, 8, 8); c.fillStyle = '#9a9a9a'; c.fillRect(x + 8, 0, 8, 8); } const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(6, 1); return t; })();
  return {
    box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 10), plane: new THREE.PlaneGeometry(1, 1),
    roofMat: new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.1 }),
    hMat: atlasMaterial(atlas(H_WORDS, 4, 8, 256, 128, false), 0.25, 0.125), vMat: atlasMaterial(atlas(V_WORDS, 16, 1, 128, 512, true), 0.0625, 1), tMat: atlasMaterial(atlas(T_WORDS, 16, 1, 128, 896, true), 0.0625, 1),
    awnMat: new THREE.MeshStandardMaterial({ map: stripe, roughness: 0.85, side: THREE.DoubleSide }),
    doorMat: new THREE.MeshStandardMaterial({ color: '#2a2d33', metalness: 0.6, roughness: 0.35 }),
    doorGlassMat: new THREE.MeshBasicMaterial({ color: '#1c2632', toneMapped: false }), doorLampMat: new THREE.MeshBasicMaterial({ color: '#ffe0a8', toneMapped: false }),
    beaconMat: new THREE.MeshBasicMaterial({ map: getTextures().glow, color: '#ff2020', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  };
}
const shared = () => (SH ||= makeShared());

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
const seedOf = (b: Building) => ((Math.floor(b.x0 * 7.31) * 73856093) ^ (Math.floor(b.z0 * 13.7) * 19349663)) >>> 0;
const GREYS = ['#8a8c90', '#9a958c', '#7d8186', '#a5a39d'], AWN = ['#c0392b', '#1e7a4a', '#1f4e8c', '#d4a017', '#6b2d5c', '#2b2b30', '#d35400', '#117a7a'];
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

/** Rooftop clutter of one building, deterministic per building (so the city-wide beacon list matches the chunk detail). */
function roofPlan(b: Building, box: (x: number, y: number, z: number, w: number, h: number, d: number, col: string, yaw?: number) => void, cyl: (x: number, y: number, z: number, rr: number, h: number, col: string) => void): THREE.Vector3 | null {
  const r = mulberry(seedOf(b)), T = topFoot(b), top = b.y0 + b.h, w = T.x1 - T.x0, d = T.z1 - T.z0, grey = GREYS[Math.floor(r() * 4)];
  const pt = 0.35, ph = 0.9;
  box((T.x0 + T.x1) / 2, top, T.z0 + pt / 2, w, ph, pt, grey); box((T.x0 + T.x1) / 2, top, T.z1 - pt / 2, w, ph, pt, grey);
  box(T.x0 + pt / 2, top, (T.z0 + T.z1) / 2, pt, ph, d, grey); box(T.x1 - pt / 2, top, (T.z0 + T.z1) / 2, pt, ph, d, grey);
  const rx = () => T.x0 + 2 + r() * Math.max(0.1, w - 4), rz = () => T.z0 + 2 + r() * Math.max(0.1, d - 4);
  let beacon: THREE.Vector3 | null = null;
  if (w > 8 && d > 8) {
    const n = 1 + Math.floor(r() * (w * d > 600 ? 5 : 3));
    for (let k = 0; k < n; k++) box(rx(), top, rz(), 1.4, 1.0, 1.1, '#c9ccd0', r() * Math.PI);
    if (r() < 0.65) box(rx(), top, rz(), 3.2, 2.6, 2.6, grey);
    if ((b.type === 'brick' || b.type === 'office' || b.type === 'shop') && r() < 0.4) { const x = rx(), z = rz(); cyl(x, top + 1.2, z, 1.25, 2.4, '#8a6a4a'); box(x, top, z, 2.2, 1.2, 2.2, '#3a3a3e'); }
    if (b.h > 70) { const x = rx(), z = rz(), ah = 8 + r() * 10; cyl(x, top, z, 0.12, ah, '#c9ccd0'); beacon = new THREE.Vector3(x, top + ah + 0.2, z); if (r() < 0.5) box((T.x0 + T.x1) / 2, top, (T.z0 + T.z1) / 2, w * 0.55, 3 + r() * 5, d * 0.55, '#2a3038'); }
  }
  return beacon;
}
const noop = () => {};

/** Instanced detail meshes for the buildings and doors of one chunk (the caller disposes them). */
export function buildDetail(list: Building[], doorList: BDoor[]): THREE.InstancedMesh[] {
  const D = shared();
  const boxes: { m: THREE.Matrix4; c: THREE.Color }[] = [], cyls: { m: THREE.Matrix4; c: THREE.Color }[] = [];
  const hs: { m: THREE.Matrix4; o: [number, number] }[] = [], vs: { m: THREE.Matrix4; o: [number, number] }[] = [], ts: { m: THREE.Matrix4; o: [number, number] }[] = [], aw: { m: THREE.Matrix4; c: THREE.Color }[] = [];
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, col: string, yaw = 0) => { Q.setFromAxisAngle(UP, yaw); P.set(x, y + h / 2, z); S.set(w, h, d); boxes.push({ m: M.compose(P, Q, S).clone(), c: new THREE.Color(col) }); };
  const cyl = (x: number, y: number, z: number, rr: number, h: number, col: string) => { Q.identity(); P.set(x, y + h / 2, z); S.set(rr, h, rr); cyls.push({ m: M.compose(P, Q, S).clone(), c: new THREE.Color(col) }); };
  for (const b of list) {
    if (b.gable || b.type === 'hangar') continue;
    roofPlan(b, box, cyl);
    // street-level neon
    const k = blockOfB(b); if (!k || (k.zone !== 'commercial' && k.zone !== 'downtown' && k.zone !== 'gas')) continue;
    const r = mulberry(seedOf(b) + 1);
    for (const f of streetFaces(b, k)) {
      if (b.type === 'shop' && f.len > 6) { // striped shop awnings along the ground floor
        const n = Math.max(1, Math.floor(f.len / 6.5)), seg = f.len / n, col = new THREE.Color(AWN[Math.floor(r() * AWN.length)]);
        for (let j = 0; j < n; j++) {
          if (r() < 0.2) continue;
          const along = -f.len / 2 + seg * (j + 0.5), x = f.cx + (f.nz !== 0 ? along : 0) + f.nx * 0.8, z = f.cz + (f.nx !== 0 ? along : 0) + f.nz * 0.8;
          Q.setFromEuler(new THREE.Euler(0.38, Math.atan2(f.nx, f.nz), 0, 'YXZ')); P.set(x, b.y0 + 3.05, z); S.set(seg - 0.6, 0.06, 1.7);
          aw.push({ m: M.compose(P, Q, S).clone(), c: col });
        }
      }
      if (f.len < 8 || r() < 0.25) continue;
      const n = f.len > 30 ? 2 : 1;
      for (let j = 0; j < n; j++) {
        const along = (j - (n - 1) / 2) * (f.len / n) + (r() - 0.5) * f.len * 0.2, sw = 3.5 + r() * 3, y = b.y0 + 3.4 + r() * 2.5;
        const x = f.cx + (f.nz !== 0 ? along : 0) + f.nx * 0.12, z = f.cz + (f.nx !== 0 ? along : 0) + f.nz * 0.12;
        Q.setFromAxisAngle(UP, Math.atan2(f.nx, f.nz)); P.set(x, y, z); S.set(sw, sw / 2, 1);
        const cell = Math.floor(r() * H_WORDS.length); hs.push({ m: M.compose(P, Q, S).clone(), o: [(cell % 4) * 0.25, 1 - (Math.floor(cell / 4) + 1) * 0.125] });
        if ((k.zone === 'commercial' && r() < 0.85) || (k.zone === 'downtown' && r() < 0.35)) { // vertical blade sign sticking out from the wall
          const vx = f.cx + (f.nz !== 0 ? along + sw / 2 + 1.2 : 0) + f.nx * 0.9, vz = f.cz + (f.nx !== 0 ? along + sw / 2 + 1.2 : 0) + f.nz * 0.9;
          Q.setFromAxisAngle(UP, Math.atan2(f.nx, f.nz) + Math.PI / 2); P.set(vx, y + 2.6, vz); S.set(1.3, 5.2, 1);
          const vc = Math.floor(r() * V_WORDS.length); vs.push({ m: M.compose(P, Q, S).clone(), o: [vc * 0.0625, 0] });
        }
        if (k.zone === 'commercial' && b.type !== 'shop' && b.h > 16 && r() < 0.7) { // tall blade sign up the corner of a multi-tenant building
          const th = Math.min(13, b.h - 7), edge = f.len / 2 - 1.2, vx = f.cx + (f.nz !== 0 ? (j % 2 ? -edge : edge) : 0) + f.nx * 1.1, vz = f.cz + (f.nx !== 0 ? (j % 2 ? -edge : edge) : 0) + f.nz * 1.1;
          Q.setFromAxisAngle(UP, Math.atan2(f.nx, f.nz) + Math.PI / 2); P.set(vx, b.y0 + 7 + th / 2, vz); S.set(th / 7, th, 1);
          const tc = Math.floor(r() * T_WORDS.length); ts.push({ m: M.compose(P, Q, S).clone(), o: [tc * 0.0625, 0] });
        }
      }
    }
  }
  const frameM: { m: THREE.Matrix4 }[] = [], glassM: { m: THREE.Matrix4 }[] = [], lampM: { m: THREE.Matrix4 }[] = [];
  for (const dd of doorList) {
    const nx = Math.sin(dd.ang), nz = Math.cos(dd.ang), wide = dd.kind === 'lobby' || dd.kind === 'terminal' ? 2.6 : dd.kind === 'warehouse' || dd.kind === 'hangar' ? 3.4 : 1.8, hh = dd.kind === 'warehouse' || dd.kind === 'hangar' ? 3.4 : 2.6;
    Q.setFromAxisAngle(UP, dd.ang);
    P.set(dd.fx + nx * 0.06, dd.y + hh / 2, dd.fz + nz * 0.06); S.set(wide + 0.3, hh + 0.2, 0.14); frameM.push({ m: M.compose(P, Q, S).clone() });
    P.set(dd.fx + nx * 0.14, dd.y + hh / 2 - 0.05, dd.fz + nz * 0.14); S.set(wide, hh - 0.1, 1); glassM.push({ m: M.compose(P, Q, S).clone() });
    P.set(dd.fx + nx * 0.4, dd.y + hh + 0.35, dd.fz + nz * 0.4); S.set(0.5, 0.12, 0.25); lampM.push({ m: M.compose(P, Q, S).clone() });
  }
  const out: THREE.InstancedMesh[] = [];
  const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, list2: { m: THREE.Matrix4; c?: THREE.Color }[], receive = true) => {
    if (!list2.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list2.length); list2.forEach((it, i) => { im.setMatrixAt(i, it.m); if (it.c) im.setColorAt(i, it.c); });
    im.receiveShadow = receive; im.computeBoundingSphere(); out.push(im); return im;
  };
  const withOff = (list2: { m: THREE.Matrix4; o: [number, number] }[], mat: THREE.Material) => {
    if (!list2.length) return;
    const g = D.plane.clone(); const a = new THREE.InstancedBufferAttribute(new Float32Array(list2.length * 2), 2); list2.forEach((it, i) => a.setXY(i, it.o[0], it.o[1])); g.setAttribute('uvOff', a);
    const im = mk(g, mat, list2, false); if (im) im.userData.ownGeo = true;
  };
  mk(D.box, D.roofMat, boxes); mk(D.cyl, D.roofMat, cyls);
  withOff(hs, D.hMat); withOff(vs, D.vMat); withOff(ts, D.tMat);
  const awn = mk(D.box, D.awnMat, aw); if (awn) awn.castShadow = true;
  mk(D.box, D.doorMat, frameM); mk(D.plane, D.doorGlassMat, glassM, false); mk(D.box, D.doorLampMat, lampM, false);
  return out;
}
export function disposeDetail(list: THREE.InstancedMesh[]) { for (const im of list) { if (im.userData.ownGeo) im.geometry.dispose(); im.dispose(); } }

/** City-wide: aircraft warning lights on tall towers, and the night glow of signs and doors. */
export default function Detail() {
  const D = useMemo(() => {
    const beacons: THREE.Vector3[] = [];
    for (const b of buildings) if (b.h > 70 && !b.gable && b.type !== 'hangar') { const v = roofPlan(b, noop, noop); if (v) beacons.push(v); }
    const sh = shared();
    const bl = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.6, 1.6), sh.beaconMat, Math.max(1, beacons.length)); bl.count = beacons.length; bl.frustumCulled = false;
    return { bl, beacons, sh };
  }, []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), s: new THREE.Vector3(1, 1, 1) }), []);
  useFrame(({ camera, clock }) => {
    const h = game.hour, night = h > 18.4 || h < 6.4, dusk = !night && (h > 17.2 || h < 7.2), sh = D.sh;
    const k = night ? 1.7 : dusk ? 1.1 : 0.55; sh.hMat.color.setScalar(k); sh.vMat.color.setScalar(k); sh.tMat.color.setScalar(k);
    sh.doorGlassMat.color.set(night || dusk ? '#ffcf8a' : '#1c2632').multiplyScalar(night ? 1.3 : dusk ? 0.8 : 1); sh.doorLampMat.color.set('#ffe0a8').multiplyScalar(night ? 2.2 : dusk ? 1.2 : 0.5);
    const blink = Math.sin(clock.elapsedTime * 3.2) > 0.2; sh.beaconMat.opacity = night || dusk ? (blink ? 1 : 0.12) : (blink ? 0.4 : 0.05);
    let n = 0; const cx = camera.position.x, cz = camera.position.z;
    for (const v of D.beacons) { if (Math.abs(v.x - cx) > 1600 || Math.abs(v.z - cz) > 1600) continue; tmp.m.compose(v, camera.quaternion, tmp.s); D.bl.setMatrixAt(n++, tmp.m); }
    D.bl.count = n; D.bl.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={D.bl} />;
}
