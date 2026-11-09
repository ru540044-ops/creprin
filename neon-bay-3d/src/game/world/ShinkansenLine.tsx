import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Geo } from './geo';
import { SHIN, shinStand, shinUp, shinDown, ShinPlatform } from './cityGen';
import { REGION, REGIONS } from './region';
import { labelTexture } from './textures';
import { game } from '../state/store';
import { vehicles, SHIN_HEAD, SHIN_TAIL } from '../vehicles/sim';
import { buildCarModel } from '../vehicles/models';
import { VDEFS } from '../vehicles/defs';

/**
 * The bullet-train line and its station, modelled after a Japanese Shinkansen terminal:
 *  - a high viaduct with sound walls, slab track and overhead wires,
 *  - two island-style side platforms with fences that open at every car door, boarding-position marks, car-number signs,
 *    station-name boards (with the neighbouring stations), LED departure boards with a clock, benches, waiting rooms,
 *    vending machines, a canopy on columns and stairs down,
 *  - the street-level concourse: a glass front, automatic ticket gates, ticket machines, a station-lunch kiosk,
 *    backlit signs, departure boards over the gates and the stairs up to each platform,
 *  - a train waiting at each platform that has a destination (board it at the cab door), and a timetable train on the other track.
 */
const S = SHIN, H = S.hall;
const stName = REGION.station || REGION.names.downtown + '駅';
const kana: Record<string, string> = { tokyo: 'とうきょう', osaka: 'しんおおさか', fukuoka: 'はかた', naha: 'なは' };
const roma: Record<string, string> = { tokyo: 'Tōkyō', osaka: 'Shin-Ōsaka', fukuoka: 'Hakata', naha: 'Naha' };
const destName = (P: ShinPlatform) => (P.to ? (REGIONS[P.to].station || REGIONS[P.to].name).replace('駅', '') : '回送');

function viaduct() {
  const C = new Geo(), M = new Geo(), Gl = new Geo(), y = S.y, x = S.x, hw = S.half, CON = [0.78, 0.77, 0.75], SLAB = [0.5, 0.5, 0.5], RAILC = [0.55, 0.52, 0.5];
  C.box(x - hw, y - 1.3, S.z0, x + hw, y, S.z1, CON, 4, 4, C, 8);
  for (const s of [-1, 1]) { const a = S.stationZ - 114, b = S.stationZ + 114; C.box(x + s * hw - (s > 0 ? 0.35 : 0), y, S.z0, x + s * hw + (s < 0 ? 0.35 : 0), y + 2.0, a, CON); C.box(x + s * hw - (s > 0 ? 0.35 : 0), y, b, x + s * hw + (s < 0 ? 0.35 : 0), y + 2.0, S.z1, CON); } // sound walls (open along the platforms)
  for (const s of [-1, 1]) { const tx = x + s * S.track; M.box(tx - 1.4, y, S.z0, tx + 1.4, y + 0.25, S.z1, SLAB, 4, 4, M, 2); for (const o of [-0.75, 0.75]) M.box(tx + o - 0.04, y + 0.25, S.z0, tx + o + 0.04, y + 0.42, S.z1, RAILC); }
  for (const z of S.piers) { C.box(x - 1, 0, z - 1.4, x + 1, y - 1.3, z + 1.4, CON); C.box(x - 3.6, y - 2.4, z - 1.5, x + 3.6, y - 1.3, z + 1.5, CON); }
  for (const z of [S.z0, S.z1]) C.box(x - hw, y, z - 0.5, x + hw, y + 2.6, z + 0.5, CON);
  for (let z = S.z0 + 20; z < S.z1; z += 50) { for (const s of [-1, 1]) M.box(x + s * (hw - 0.6) - 0.15, y, z - 0.15, x + s * (hw - 0.6) + 0.15, y + 7, z + 0.15, [0.4, 0.42, 0.45]); M.box(x - hw + 0.4, y + 6.6, z - 0.12, x + hw - 0.4, y + 6.85, z + 0.12, [0.4, 0.42, 0.45]); }
  const sz = S.stationZ, top = y + 0.2;
  for (const P of S.platforms) {
    const inner = P.side < 0 ? P.x1 : P.x0, outer = P.side < 0 ? P.x0 : P.x1, cx = (P.x0 + P.x1) / 2;
    C.box(P.x0, y - 1.3, sz - 112, P.x1, top, sz + 112, [0.8, 0.79, 0.76], 4, 4, C, 4);
    M.box(inner - (P.side < 0 ? 1.0 : -0.6), top, sz - 112, inner - (P.side < 0 ? 0.6 : -1.0), top + 0.03, sz + 112, [0.95, 0.8, 0.15], 4, 4, M, 4); // tactile line
    // fence with gaps at every door, boarding-position marks on the floor at the gaps
    const fx = P.side < 0 ? P.x1 - 0.15 : P.x0, doors: number[] = [];
    for (let k = 0; k < 8; k++) for (const o of [-10.6, 10.6]) doors.push(sz + P.dir * 90 - P.dir * k * 25.6 + o);
    doors.sort((a, b) => a - b);
    let z = sz - 110; for (const d of doors) { if (d - 1.1 > z + 0.3) { M.box(fx, top, z, fx + 0.15, top + 1.2, d - 1.1, [0.85, 0.87, 0.9]); M.box(fx - 0.05, top + 1.2, z, fx + 0.2, top + 1.3, d - 1.1, [0.2, 0.45, 0.85]); } z = d + 1.1; Gl.box(inner - (P.side < 0 ? 2.4 : -0.9), top + 0.005, d - 0.9, inner - (P.side < 0 ? 0.9 : -2.4), top + 0.035, d + 0.9, [0.95, 0.65, 0.2], 4, 4, Gl, 2); }
    if (z < sz + 110) M.box(fx, top, z, fx + 0.15, top + 1.2, sz + 110, [0.85, 0.87, 0.9]);
    // canopy on a row of columns, lights under it
    for (let zz = sz - 106; zz < sz + 112; zz += 12) M.box(outer - P.side * 1.0 - 0.15, top, zz - 0.15, outer - P.side * 1.0 + 0.15, top + 5, zz + 0.15, [0.75, 0.77, 0.8]);
    M.box(Math.min(P.x0, P.x1) - 0.4, top + 5, sz - 110, Math.max(P.x0, P.x1) + 0.4 + (P.side < 0 ? 1.6 : 0) - (P.side > 0 ? 1.6 : 0), top + 5.3, sz + 110, [0.9, 0.91, 0.93]);
    for (let zz = sz - 104; zz < sz + 110; zz += 6) Gl.box(cx - 0.12, top + 4.9, zz, cx + 0.12, top + 5, zz + 3, [1, 0.97, 0.88], 4, 4, Gl, 2);
    // benches, waiting room, vending machines, stairs down
    for (const zz of [sz - 40, sz - 12, sz + 44, sz + 62]) { M.box(cx - 0.25, top, zz - 1.2, cx + 0.25, top + 0.45, zz + 1.2, [0.35, 0.55, 0.8]); M.box(cx - 0.05, top + 0.45, zz - 1.2, cx + 0.05, top + 0.9, zz + 1.2, [0.35, 0.55, 0.8]); }
    C.box(cx - 1.6, top, sz + 22, cx + 1.6, top + 0.4, sz + 32, [0.6, 0.62, 0.65]); M.box(cx - 1.55, top + 0.4, sz + 22.05, cx + 1.55, top + 2.6, sz + 31.95, [0.62, 0.74, 0.82], 4, 4, null); // glass waiting room M.box(cx - 1.65, top + 2.6, sz + 21.9, cx + 1.65, top + 2.8, sz + 32.1, [0.4, 0.42, 0.45]);
    for (const k of [0, 1]) { const zz = sz - 24 - k * 1.1; M.box(outer - P.side * 0.4 - 0.4, top, zz - 0.5, outer - P.side * 0.4 + 0.4, top + 1.8, zz + 0.5, k ? [0.15, 0.4, 0.75] : [0.8, 0.12, 0.12]); Gl.box(outer - P.side * 0.82 - 0.03, top + 0.7, zz - 0.4, outer - P.side * 0.82 + 0.03, top + 1.6, zz + 0.4, [0.95, 0.95, 0.9], 4, 4, null); }
    const d = shinDown(P); C.box(d.x - 1.6, top - 0.02, d.z - 4, d.x + 1.6, top + 0.01, d.z + 4, [0.25, 0.25, 0.27]); for (const s of [-1, 1]) M.box(d.x + s * 1.6 - 0.05, top, d.z - 4, d.x + s * 1.6 + 0.05, top + 1.1, d.z + 4, [0.75, 0.77, 0.8]);
  }
  return { C: C.build(), M: M.build(), G: Gl.build() };
}

/** The concourse at street level. */
function concourse() {
  const C = new Geo(), M = new Geo(), Gl = new Geo(), Lt = new Geo(), sz = S.stationZ, h = H.h, F = 0.16, WALL = [0.9, 0.9, 0.88];
  C.box(H.x0, 0, H.z0, H.x1, F, H.z1, [0.86, 0.85, 0.82], 3, 3, C, 3); // polished floor
  C.box(H.x0, 0, H.z0, H.x1, h, H.z0 + 0.4, WALL); C.box(H.x0, 0, H.z1 - 0.4, H.x1, h, H.z1, WALL); C.box(H.x1 - 0.4, 0, H.z0, H.x1, h, H.z1, WALL);
  C.box(H.x0 - 1, h, H.z0 - 1, H.x1 + 1, h + 0.6, H.z1 + 1, [0.75, 0.76, 0.78]);
  { let z = H.z0; for (const g of [sz - 18, sz, sz + 18]) { Gl.box(H.x0, F, z, H.x0 + 0.3, h, g - 3, [0.55, 0.7, 0.8], 4, 4, null); M.box(H.x0 - 0.1, F, g - 3.2, H.x0 + 0.4, h, g - 3, [0.5, 0.52, 0.55]); M.box(H.x0 - 0.1, F, g + 3, H.x0 + 0.4, h, g + 3.2, [0.5, 0.52, 0.55]); M.box(H.x0 - 0.1, 3.4, g - 3, H.x0 + 0.4, h, g + 3, [0.5, 0.52, 0.55]); z = g + 3; } Gl.box(H.x0, F, z, H.x0 + 0.3, h, H.z1, [0.55, 0.7, 0.8], 4, 4, null); }
  // the automatic ticket gates: cabinets with blue-lit tops and arrow lamps, and the staffed gate booth
  for (let z = H.z0 + 5; z < H.z1 - 5; z += 1.5) { M.box(H.gateX - 0.75, F, z - 0.15, H.gateX + 0.75, 1.05, z + 0.15, [0.82, 0.84, 0.88]); Lt.box(H.gateX - 0.6, 1.05, z - 0.13, H.gateX + 0.2, 1.08, z + 0.13, [0.3, 0.6, 1], 4, 4, null); Lt.box(H.gateX - 0.78, 0.75, z - 0.08, H.gateX - 0.75, 0.9, z + 0.08, [0.2, 1, 0.5], 4, 4, null); }
  M.box(H.gateX - 2, F, H.z0 + 0.5, H.gateX + 2, 2.6, H.z0 + 4, [0.7, 0.72, 0.76]);
  // ticket machines along the north wall, the station-lunch kiosk by the south wall
  for (let k = 0; k < 6; k++) { const x = H.x0 + 4 + k * 1.3; M.box(x - 0.55, F, H.z0 + 0.4, x + 0.55, 1.9, H.z0 + 1.1, [0.85, 0.86, 0.9]); Lt.box(x - 0.4, 0.95, H.z0 + 1.1, x + 0.4, 1.5, H.z0 + 1.13, [0.6, 0.85, 1], 4, 4, null); }
  M.box(H.x0 + 3, F, H.z1 - 4, H.x0 + 11, 2.6, H.z1 - 0.4, [0.92, 0.88, 0.8]); Lt.box(H.x0 + 3.2, 1.0, H.z1 - 4.03, H.x0 + 10.8, 2.2, H.z1 - 4.0, [1, 0.92, 0.75], 4, 4, null);
  for (let k = 0; k < 4; k++) M.box(H.x0 + 4 + k * 1.8, F, H.z1 - 5.2, H.x0 + 5.2 + k * 1.8, 1.0, H.z1 - 4.1, [[0.85, 0.3, 0.2], [0.95, 0.75, 0.2], [0.3, 0.6, 0.3], [0.9, 0.9, 0.85]][k]);
  // stairs and escalators up to the platforms, behind the gates
  for (const P of S.platforms) { const u = shinUp(P); for (let k = 0; k < 8; k++) C.box(u.x + 2.2 + k * 0.6, F, u.z - 3.6, H.x1 - 0.4, F + (k + 1) * 0.36, u.z + 3.6, [0.7, 0.7, 0.72]); M.box(u.x + 2, F, u.z - 4, H.x1 - 0.4, 3.2, u.z - 3.6, [0.55, 0.57, 0.6]); M.box(u.x + 2, F, u.z + 3.6, H.x1 - 0.4, 3.2, u.z + 4, [0.55, 0.57, 0.6]); }
  // ceiling lights, benches, a column of tactile paving to the gates
  for (let x = H.x0 + 3; x < H.x1 - 2; x += 5) for (let z = H.z0 + 4; z < H.z1 - 3; z += 8) Lt.box(x, h - 0.12, z, x + 2.4, h - 0.05, z + 0.5, [1, 0.97, 0.9], 4, 4, null);
  for (const z of [sz - 9, sz + 9]) M.box(H.x0 + 8, F, z - 1.2, H.x0 + 8.5, 0.6, z + 1.2, [0.35, 0.55, 0.8]);
  M.box(H.x0 + 0.4, F, sz - 0.3, H.gateX - 0.8, F + 0.02, sz + 0.3, [0.95, 0.8, 0.15], 4, 4, M, 2);
  return { C: C.build(), M: M.build(), G: Gl.build(), L: Lt.build() };
}

/** A white station-name board: the name in big kanji, kana, romaji, the neighbouring stations, the line colour. */
function nameBoard(prev: string, next: string) {
  const cv = document.createElement('canvas'); cv.width = 768; cv.height = 256; const c = cv.getContext('2d')!;
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, 768, 256); c.fillStyle = '#1e4fae'; c.fillRect(0, 168, 768, 16);
  c.fillStyle = '#111'; c.textAlign = 'center'; c.font = '900 92px "Hiragino Sans","Noto Sans JP",sans-serif'; c.fillText(stName.replace('駅', ''), 384, 102);
  c.font = '700 30px "Hiragino Sans","Noto Sans JP",sans-serif'; c.fillText(kana[REGION.id] + '　' + roma[REGION.id], 384, 152);
  c.font = '700 30px "Hiragino Sans","Noto Sans JP",sans-serif'; c.textAlign = 'left'; c.fillText('← ' + prev, 24, 228); c.textAlign = 'right'; c.fillText(next + ' →', 744, 228);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** LED departure board with the next trains, the platform clock, redrawn once a game minute. */
function makeBoard(lines: () => string[][], title: string) {
  const cv = document.createElement('canvas'); cv.width = 768; cv.height = 192; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  let last = -1;
  const draw = () => {
    const m = Math.floor(game.hour * 60); if (m === last) return; last = m;
    const c = cv.getContext('2d')!; c.fillStyle = '#05070a'; c.fillRect(0, 0, 768, 192);
    c.font = '700 26px "Hiragino Sans","Noto Sans JP",sans-serif'; c.fillStyle = '#9fd0ff'; c.textAlign = 'left'; c.fillText(title, 16, 32);
    const hh = Math.floor(game.hour), mm = Math.floor((game.hour - hh) * 60); c.textAlign = 'right'; c.fillStyle = '#ffffff'; c.fillText(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'), 752, 32);
    lines().forEach((L, i) => { const y = 82 + i * 50; c.textAlign = 'left'; c.font = '700 34px "Hiragino Sans","Noto Sans JP",sans-serif'; c.fillStyle = L[3] || '#ff9a2a'; c.fillText(L[0], 16, y); c.fillStyle = '#ffd23a'; c.fillText(L[1], 190, y); c.fillStyle = '#3dff7a'; c.fillText(L[2], 470, y); c.fillStyle = '#ffffff'; c.textAlign = 'right'; c.fillText(L[4] || '', 752, y); });
    tex.needsUpdate = true;
  };
  return { tex, draw };
}
const tt = (addMin: number) => { const m = Math.floor(game.hour * 60) + addMin, h = Math.floor(m / 60) % 24; return String(h).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

/** Timetable train on a track without a waiting train: in from the far end, stop, out the other end, rest, back. */
const V = 70, DWELL = 30, REST = 50, LEN = S.z1 - S.z0;
function timetable(t: number, dirOnly: number) {
  const run = (LEN - SHIN_TAIL) / V * 1.4, half = run + DWELL + REST, T = 2 * half; t = ((t % T) + T) % T;
  const dir = t < half ? 1 : -1, tt2 = t < half ? t : t - half;
  const a = dir > 0 ? S.z0 + SHIN_TAIL + 2 : S.z1 - SHIN_TAIL - 2, st = S.stationZ + dir * 90, b = dir > 0 ? S.z1 - SHIN_HEAD - 2 : S.z0 + SHIN_HEAD + 2;
  const p1 = Math.abs(st - a) / V * 1.4, p2 = Math.abs(b - st) / V * 1.4, easeOut = (u: number) => 1 - (1 - u) * (1 - u), easeIn = (u: number) => u * u;
  let z: number, vis = dir === dirOnly;
  if (tt2 < p1) z = a + (st - a) * easeOut(tt2 / p1); else if (tt2 < p1 + DWELL) z = st; else if (tt2 < p1 + DWELL + p2) z = st + (b - st) * easeIn((tt2 - p1 - DWELL) / p2); else { z = b; vis = false; }
  return { z, dir, vis };
}

export default function ShinkansenLine() {
  const D = useMemo(() => {
    if (!S.has) return null;
    const v = viaduct(), cc = concourse();
    const conc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.5 }), glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    // the concourse is seen from inside too: its walls, ceiling and fittings are two-sided
    const concIn = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }), metalIn = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.4, side: THREE.DoubleSide });
    const glass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.45 });
    const plain = (t: THREE.Texture) => new THREE.MeshBasicMaterial({ map: t, toneMapped: false }); // one-sided: back-to-back pairs where both sides are seen
    const north = S.next.north ? (REGIONS[S.next.north].station || REGIONS[S.next.north].name).replace('駅', '') : '（車両基地）', south = S.next.south ? (REGIONS[S.next.south].station || REGIONS[S.next.south].name).replace('駅', '') : '（車両基地）';
    const board = plain(nameBoard(north, south));
    const signs: { m: THREE.Material; x: number; y: number; z: number; w: number; h: number; ry: number }[] = [];
    // car-number signs hanging over each boarding position, name boards, LED boards per platform
    const boards: { draw: () => void }[] = [];
    for (const P of S.platforms) {
      const cx = (P.x0 + P.x1) / 2, top = S.y + 0.2, ry = P.side < 0 ? Math.PI / 2 : -Math.PI / 2;
      for (let k = 0; k < 8; k++) { const z = S.stationZ + P.dir * 90 - P.dir * k * 25.6, m = plain(labelTexture(`${k + 1}号車`, '#ffffff', 256, 128)); signs.push({ m, x: cx, y: top + 4.2, z, w: 1.6, h: 0.8, ry: 0 }, { m, x: cx, y: top + 4.2, z: z - 0.04, w: 1.6, h: 0.8, ry: Math.PI }); void ry; }
      for (const z of [S.stationZ - 50, S.stationZ + 54]) signs.push({ m: board, x: (P.side < 0 ? P.x0 : P.x1) - P.side * 0.3, y: top + 2.2, z, w: 4.2, h: 1.4, ry: P.side < 0 ? Math.PI / 2 : -Math.PI / 2 });
      const B = makeBoard(() => P.to ? [['のぞみ', destName(P), tt(4), '#ff9a2a', `${P.num}番線`], ['ひかり', destName(P), tt(22), '#ff4a4a', `${P.num}番線`]] : [['回送', '当駅止まり', '', '#9aa0a8', `${P.num}番線`]], `${P.num}番線　${P.to ? REGIONS[P.to].name + '方面' : ''}`);
      boards.push(B); for (const z of [S.stationZ - 8, S.stationZ + 40]) signs.push({ m: plain(B.tex), x: cx, y: top + 3.4, z, w: 3.6, h: 0.9, ry: 0 }, { m: plain(B.tex), x: cx, y: top + 3.4, z: z + 0.05, w: 3.6, h: 0.9, ry: Math.PI });
      { const m = plain(labelTexture('↓ 改札口・のりかえ', '#ffd23a', 512, 128)), d = shinDown(P); signs.push({ m, x: d.x, y: top + 3, z: d.z + 4.5, w: 3.2, h: 0.8, ry: 0 }, { m, x: d.x, y: top + 3, z: d.z + 4.45, w: 3.2, h: 0.8, ry: Math.PI }); } // readable from both sides
    }
    // concourse: entrance sign outside, gate signs, departure board over the gates, stair signs
    signs.push({ m: plain(labelTexture('新幹線のりかえ口  SHINKANSEN', '#2b8bff', 1024, 160)), x: H.x0 - 0.5, y: H.h - 1.2, z: S.stationZ, w: 14, h: 2.2, ry: -Math.PI / 2 });
    signs.push({ m: plain(labelTexture(stName.replace('駅', '') + '  ' + roma[REGION.id], '#ffffff', 768, 160)), x: H.x0 - 0.5, y: H.h + 1.4, z: S.stationZ, w: 12, h: 2.5, ry: -Math.PI / 2 });
    signs.push({ m: plain(labelTexture('新幹線 中央改札', '#ffffff', 768, 128)), x: H.gateX - 1.2, y: 4.2, z: S.stationZ, w: 7, h: 1.2, ry: -Math.PI / 2 });
    { const all = S.platforms.filter((p) => p.to); const B = makeBoard(() => all.flatMap((P) => [['のぞみ', destName(P), tt(4), '#ff9a2a', `${P.num}番線`]]).concat([['ひかり', all[0] ? destName(all[0]) : '', tt(22), '#ff4a4a', `${all[0]?.num ?? ''}番線`]]).slice(0, 2), '新幹線 発車案内'); boards.push(B); signs.push({ m: plain(B.tex), x: H.gateX - 1.3, y: 5.6, z: S.stationZ - 8, w: 6, h: 1.5, ry: -Math.PI / 2 }, { m: plain(B.tex), x: H.gateX - 1.3, y: 5.6, z: S.stationZ + 8, w: 6, h: 1.5, ry: -Math.PI / 2 }); }
    for (const P of S.platforms) { const u = shinUp(P); signs.push({ m: plain(labelTexture(`${P.num}番線  ${P.to ? REGIONS[P.to].name + '方面' : '回送'} ↑`, P.to ? '#ffd23a' : '#9aa0a8', 768, 128)), x: u.x, y: 3.6, z: u.z, w: 5, h: 0.85, ry: -Math.PI / 2 }); }
    signs.push({ m: plain(labelTexture('駅弁  EKIBEN', '#ff9a2a', 512, 128)), x: H.x0 + 7, y: 3.1, z: H.z1 - 4.1, w: 5, h: 1.2, ry: Math.PI });
    signs.push({ m: plain(labelTexture('きっぷうりば', '#2be4ff', 512, 128)), x: H.x0 + 7.3, y: 2.6, z: H.z0 + 1.2, w: 5, h: 1.1, ry: 0 });
    // the trains waiting at the platforms with a destination, and the timetable train on another track
    const standing = S.platforms.filter((p) => p.to).map((P) => { const m = buildCarModel(VDEFS.shinkansen, '#f4f5f7'), s = shinStand(P); m.root.position.set(s.x, S.y + 0.05, s.z); m.root.rotation.y = P.dir > 0 ? 0 : Math.PI; return m; });
    const free = S.platforms.find((p) => !p.to), ai = free ? buildCarModel(VDEFS.shinkansen, '#f4f5f7') : null;
    return { v, cc, conc, metal, glow, glass, concIn, metalIn, signs, boards, standing, ai, aiDir: free ? free.dir : 0 };
  }, []);
  useFrame(() => {
    if (!D) return;
    const driving = vehicles.some((q) => q.def.kind === 'shinkansen');
    for (const m of D.standing) m.root.visible = !driving;
    if (D.ai) { const T = timetable(game.clock, D.aiDir), root = D.ai.root; root.visible = T.vis; if (T.vis) { root.position.set(S.x + T.dir * S.track, S.y + 0.05, T.z); root.rotation.y = T.dir > 0 ? 0 : Math.PI; } }
    for (const b of D.boards) b.draw();
  });
  if (!D) return null;
  return (
    <group>
      <mesh geometry={D.v.C} material={D.conc} castShadow receiveShadow />
      <mesh geometry={D.v.M} material={D.metal} castShadow />
      <mesh geometry={D.v.G} material={D.glow} />
      <mesh geometry={D.cc.C} material={D.concIn} castShadow receiveShadow />
      <mesh geometry={D.cc.M} material={D.metalIn} castShadow receiveShadow />
      <mesh geometry={D.cc.G} material={D.glass} />
      <mesh geometry={D.cc.L} material={D.glow} />
      {D.standing.map((m, i) => <primitive key={i} object={m.root} />)}
      {D.ai && <primitive object={D.ai.root} />}
      {D.signs.map((s, i) => <mesh key={i} position={[s.x, s.y, s.z]} rotation-y={s.ry} material={s.m}><planeGeometry args={[s.w, s.h]} /></mesh>)}
    </group>
  );
}
