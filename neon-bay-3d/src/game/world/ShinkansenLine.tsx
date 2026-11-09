import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Geo } from './geo';
import { SHIN, shinStand, shinUp, shinDown, ShinPlatform, TUN, heightAt, HALF, ROAD, PITCH, N, roadC, nodeOpen, segOpen, isWater } from './cityGen';
import { REGION, REGIONS } from './region';
import { labelTexture } from './textures';
import { game } from '../state/store';
import { trainBy, chime } from '../audio';
import { vehicles, SHIN_FLIP } from '../vehicles/sim';
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
  const zHood = TUN.portal + TUN.hood;
  for (const s of [-1, 1]) { const a = S.stationZ - 114; C.box(x + s * hw - (s > 0 ? 0.35 : 0), y, zHood, x + s * hw + (s < 0 ? 0.35 : 0), y + 2.0, a, CON); } // sound walls (open along the platforms, none in the tunnel)
  for (const s of [-1, 1]) { const tx = x + s * S.track; M.box(tx - 1.4, y, S.z0, tx + 1.4, y + 0.25, S.z1, SLAB, 4, 4, M, 2); for (const o of [-0.75, 0.75]) M.box(tx + o - 0.04, y + 0.25, S.z0, tx + o + 0.04, y + 0.42, S.z1, RAILC); }
  for (const z of S.piers) { C.box(x - 1, 0, z - 1.4, x + 1, y - 1.3, z + 1.4, CON); C.box(x - 3.6, y - 2.4, z - 1.5, x + 3.6, y - 1.3, z + 1.5, CON); }
  // the terminus: an end wall and a buffer stop on each track
  C.box(x - hw, y, S.z1 - 0.5, x + hw, y + 2.6, S.z1 + 0.5, CON);
  for (const s of [-1, 1]) { const tx = x + s * S.track; M.box(tx - 1.3, y + 0.25, S.z1 - 2.2, tx + 1.3, y + 1.3, S.z1 - 0.5, [0.95, 0.78, 0.1]); for (let k = 0; k < 4; k++) M.box(tx - 1.3 + k * 0.7, y + 0.6, S.z1 - 2.25, tx - 1.3 + k * 0.7 + 0.35, y + 1.0, S.z1 - 2.2, [0.08, 0.08, 0.08]); Gl.box(tx - 0.2, y + 1.3, S.z1 - 1.6, tx + 0.2, y + 1.6, S.z1 - 1.2, [1, 0.15, 0.1], 4, 4, null); }
  // in the cutting the deck rests on an embankment, with retaining walls along the foot of the cut slopes
  { let zc = zHood; while (zc < -HALF && heightAt(x, zc) > 5) zc += 5; if (zc > zHood) C.box(x - hw, 0, TUN.portal, x + hw, y - 1.3, zc, [0.6, 0.6, 0.58]);
    let zr = zHood; while (zr < -HALF && heightAt(x + TUN.cutW + 3, zr) > TUN.cut + 2) zr += 5;
    for (const s of [-1, 1]) if (zr > zHood) C.box(x + s * TUN.cutW - (s > 0 ? 0.6 : 0), TUN.cut - 1, TUN.portal + 2, x + s * TUN.cutW + (s < 0 ? 0.6 : 0), TUN.cut + 4.5, zr, [0.66, 0.65, 0.62]); }
  for (let z = zHood + 8; z < S.z1; z += 50) { for (const s of [-1, 1]) M.box(x + s * (hw - 0.6) - 0.15, y, z - 0.15, x + s * (hw - 0.6) + 0.15, y + 7, z + 0.15, [0.4, 0.42, 0.45]); M.box(x - hw + 0.4, y + 6.6, z - 0.12, x + hw - 0.4, y + 6.85, z + 0.12, [0.4, 0.42, 0.45]); }
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

/** Horseshoe profile of the bore, from the east foot up over the crown to the west foot (x across, y above the track). */
function boreProfile(angs: number[]) {
  const hw = TUN.hw, wall = TUN.wall;
  return [[hw, 0], ...angs.map((a) => [Math.cos(a) * hw, wall + Math.sin(a) * hw]), [-hw, 0]];
}
const ARCH = Array.from({ length: 15 }, (_, k) => (k / 14) * Math.PI);
/** A vertical face at z facing south: the rectangle |x - cx| < W, y0..top, with the bore's opening cut out of it. */
function faceWithHole(G: Geo, cx: number, z: number, W: number, y0: number, top: number, col: number[]) {
  const y = TUN.y, ac = Math.atan2(top - y - TUN.wall, W), angs = [...ARCH, ac, Math.PI - ac].sort((a, b) => a - b);
  const inner = boreProfile(angs), outer = [[W, 0], ...angs.map((a) => { const c = Math.cos(a), s = Math.sin(a), t = Math.min(Math.abs(c) > 1e-6 ? W / Math.abs(c) : 1e9, s > 1e-6 ? (top - y - TUN.wall) / s : 1e9); return [c * t, TUN.wall + s * t]; }), [-W, 0]];
  const P = (q: number[]) => [cx + q[0], y + q[1], z], U = (q: number[]) => [q[0] / 4, q[1] / 4];
  for (let i = 0; i + 1 < inner.length; i++) G.quad(P(inner[i]), P(outer[i]), P(outer[i + 1]), P(inner[i + 1]), [0, 0, 1], [U(inner[i]), U(outer[i]), U(outer[i + 1]), U(inner[i + 1])], col);
  G.quad([cx - W, y0, z], [cx + W, y0, z], [cx + W, y, z], [cx - W, y, z], [0, 0, 1], [[0, 0], [W / 2, 0], [W / 2, 1], [0, 1]], col);
}
/** The mountain tunnel: a lined horseshoe bore with lamps, a hood out of the portal, the portal face with its name plate. */
function tunnel() {
  const In = new Geo(), Out = new Geo(), Lamp = new Geo(), x = TUN.x, y = TUN.y, hw = TUN.hw, zH = TUN.portal + TUN.hood, prof = boreProfile(ARCH);
  // the lining in 10.5 m rings (slightly different shades), the invert, walkways along both walls, the dark far end
  for (let z = TUN.end - 2, k = 0; z < zH; z += 10.5, k++) {
    const z2 = Math.min(zH, z + 10.5), sh = k % 2 ? 0.075 : 0.062;
    for (let i = 0; i + 1 < prof.length; i++) { const a = prof[i], b = prof[i + 1], c = [sh * (a[1] < 3 ? 1.08 : 1), sh, sh * 0.96]; In.quad([x + a[0], y + a[1], z2], [x + a[0], y + a[1], z], [x + b[0], y + b[1], z], [x + b[0], y + b[1], z2], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], c); }
    In.quad([x - hw, y - 0.03, z2], [x + hw, y - 0.03, z2], [x + hw, y - 0.03, z], [x - hw, y - 0.03, z], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], [0.035, 0.035, 0.035]);
  }
  for (const s of [-1, 1]) In.box(x + s * hw - (s > 0 ? 0.9 : 0), y - 0.03, TUN.end - 2, x + s * hw + (s < 0 ? 0.9 : 0), y + 0.55, zH, [0.1, 0.1, 0.095]);
  { const ze = TUN.end - 2, c0 = [x, y + TUN.wall, ze], P = (q: number[]) => [x + q[0], y + q[1], ze], K = [0.02, 0.02, 0.025];
    for (let i = 0; i + 1 < prof.length; i++) In.tri(c0, P(prof[i]), P(prof[i + 1]), [0, 0, 1], [[0, 0], [1, 0], [0, 1]], K);
    In.quad([x - hw, y - 0.03, ze], [x + hw, y - 0.03, ze], [x + hw, y + TUN.wall, ze], [x - hw, y + TUN.wall, ze], [0, 0, 1], [[0, 0], [1, 0], [1, 1], [0, 1]], K); }
  // lamps on both walls every 25 m, the overhead wires
  for (let z = TUN.end + 6; z < zH - 2; z += 25) for (const s of [-1, 1]) Lamp.box(x + s * (hw - 0.14) - 0.07, y + 1.7, z - 1.1, x + s * (hw - 0.14) + 0.07, y + 2.0, z + 1.1, [1, 0.93, 0.75], 4, 4, null);
  for (const s of [-1, 1]) Out.box(x + s * S.track - 0.02, y + 6.1, TUN.end - 2, x + s * S.track + 0.02, y + 6.14, zH, [0.45, 0.42, 0.38]);
  // the hood (a concrete shell out of the mountain) and its mouth, then the portal face set into the hillside
  const CONC = [0.74, 0.73, 0.7], top = y + TUN.wall + hw + 0.6;
  for (const s of [-1, 1]) Out.box(x + s * (hw + 0.03) - (s > 0 ? 0 : 0.57), y - 1.3, TUN.portal - 1, x + s * (hw + 0.03) + (s > 0 ? 0.57 : 0), top, zH, CONC); // just outside the lining (no flicker)
  Out.box(x - hw - 0.6, top - 0.5, TUN.portal - 1, x + hw + 0.6, top, zH, CONC, 4, 4, Out);
  faceWithHole(Out, x, zH + 0.02, hw + 0.6, y - 1.3, top, CONC);
  const W = 17, fTop = y + 19;
  faceWithHole(Out, x, TUN.portal + 2, W, y - 7, fTop, [0.7, 0.69, 0.66]);
  Out.box(x - W - 1, fTop, TUN.portal - 2, x + W + 1, fTop + 1.6, TUN.portal + 2.4, [0.62, 0.61, 0.58]);
  for (const s of [-1, 1]) Out.box(x + s * W - (s > 0 ? 0 : 1), y - 7, TUN.portal - 2, x + s * W + (s > 0 ? 1 : 0), fTop, TUN.portal + 2.4, [0.62, 0.61, 0.58]);
  return { In: In.build(), Out: Out.build(), Lamp: Lamp.build() };
}
/** The stone name plate over the portal. */
function plateTexture(name: string) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const c = cv.getContext('2d')!;
  c.fillStyle = '#d9d4c7'; c.fillRect(0, 0, 512, 128); c.strokeStyle = '#8a8478'; c.lineWidth = 8; c.strokeRect(4, 4, 504, 120);
  c.fillStyle = '#23211d'; c.font = '900 72px "Hiragino Mincho ProN","Noto Serif JP",serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(name, 256, 68);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ---------- finding the station: blue road guide signs at the junctions round it, a sign pylon on the concourse roof, a beam of light ---------- */
/** A blue Japanese road guide sign: 新幹線, the station, a big arrow (0 ←, 1 ↑, 2 →). */
function guideTexture(arrow: number) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const c = cv.getContext('2d')!;
  c.fillStyle = '#1b4fae'; c.fillRect(0, 0, 512, 256); c.strokeStyle = '#ffffff'; c.lineWidth = 7; c.strokeRect(10, 10, 492, 236);
  c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const tx = arrow === 0 ? 300 : arrow === 2 ? 200 : 256;
  c.font = '900 84px "Hiragino Sans","Noto Sans JP",sans-serif'; c.fillText('新幹線', tx, arrow === 1 ? 150 : 92);
  c.font = '700 34px "Hiragino Sans","Noto Sans JP",sans-serif'; c.fillText(stName + ' Shinkansen', tx, arrow === 1 ? 214 : 158);
  // the arrow: a thick shaft and a head
  c.save(); const ax = arrow === 0 ? 92 : arrow === 2 ? 420 : 256, ay = arrow === 1 ? 62 : 128; c.translate(ax, ay); c.rotate(arrow === 0 ? -Math.PI / 2 : arrow === 2 ? Math.PI / 2 : 0);
  c.beginPath(); c.moveTo(0, -56); c.lineTo(44, -6); c.lineTo(15, -6); c.lineTo(15, 56); c.lineTo(-15, 56); c.lineTo(-15, -6); c.lineTo(-44, -6); c.closePath(); c.fill(); c.restore();
  if (arrow !== 1) { c.font = '700 30px "Hiragino Sans","Noto Sans JP",sans-serif'; c.fillText(arrow === 0 ? '左折' : '右折', tx, 212); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function wayfinding() {
  const poles = new Geo(), quads: number[][][] = [[], [], []], G = S.gate;
  const gi = Math.round((G.x + HALF - ROAD / 2) / PITCH), gj = Math.round((G.z + HALF - ROAD / 2) / PITCH), GREY = [0.55, 0.57, 0.6];
  const add = (k: number, c: number[], r: number[], w: number, h: number) => { const q = quads[k], hx = r[0] * w / 2, hz = r[1] * w / 2; q.push([c[0] - hx, c[1] - h / 2, c[2] - hz, 0, 0], [c[0] + hx, c[1] - h / 2, c[2] + hz, 1, 0], [c[0] + hx, c[1] + h / 2, c[2] + hz, 1, 1], [c[0] - hx, c[1] - h / 2, c[2] - hz, 0, 0], [c[0] + hx, c[1] + h / 2, c[2] + hz, 1, 1], [c[0] - hx, c[1] + h / 2, c[2] - hz, 0, 1]); };
  for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
    const i = gi + a * 4, j = gj + b * 4; if (i < 1 || j < 1 || i >= N || j >= N || !nodeOpen(i, j)) continue;
    const nx = roadC(i), nz = roadC(j); if (Math.hypot(nx - G.x, nz - G.z) < 90) continue;
    // one sign for each road coming into the junction, over the left lane before it, facing the oncoming driver
    for (const [tx, tz, seg] of [[1, 0, segOpen('x', j, i - 1)], [-1, 0, segOpen('x', j, i)], [0, 1, segOpen('z', i, j - 1)], [0, -1, segOpen('z', i, j)]] as [number, number, boolean][]) {
      if (!seg) continue;
      const rx = -tz, rz = tx, back = ROAD / 2 + 6, px = nx - tx * back - rx * (ROAD / 2 + 1.3), pz = nz - tz * back - rz * (ROAD / 2 + 1.3), cx = nx - tx * back - rx * (ROAD / 4 - 0.4), cz = nz - tz * back - rz * (ROAD / 4 - 0.4);
      if (isWater(px, pz)) continue;
      const sx = G.x - nx, sz = G.z - nz, fwd = sx * tx + sz * tz, rt = sx * rx + sz * rz, arrow = fwd > Math.abs(rt) * 0.6 ? 1 : rt > 0 ? 2 : 0;
      poles.box(px - 0.14, 0, pz - 0.14, px + 0.14, 7.4, pz + 0.14, GREY);
      const ex = cx + rx * 2.6, ez = cz + rz * 2.6; poles.box(Math.min(px, ex) - 0.09, 7.1, Math.min(pz, ez) - 0.09, Math.max(px, ex) + 0.09, 7.3, Math.max(pz, ez) + 0.09, GREY);
      // the panel faces back along the road (towards the driver); its right-hand side is the driver's right
      const W = 4.6, H = 2.3, c = [cx - tx * 0.08, 6.0, cz - tz * 0.08];
      add(arrow, c, [rx, rz], W, H);
      poles.quad([cx + rx * W / 2, 6 - H / 2, cz + rz * W / 2], [cx - rx * W / 2, 6 - H / 2, cz - rz * W / 2], [cx - rx * W / 2, 6 + H / 2, cz - rz * W / 2], [cx + rx * W / 2, 6 + H / 2, cz + rz * W / 2], [tx, 0, tz], [[0, 0], [1, 0], [1, 1], [0, 1]], GREY);
    }
  }
  const geos = quads.map((q) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(q.flatMap((v) => [v[0], v[1], v[2]]), 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(q.flatMap((v) => [v[3], v[4]]), 2)); g.computeVertexNormals(); return g; });
  // the sign pylon on the concourse roof (both faces), lit at night
  const Py = new Geo(), px = H.x0 + 6, top = H.h + 0.6 + 15;
  Py.box(px - 0.6, H.h + 0.6, S.stationZ - 1.9, px + 0.6, top, S.stationZ + 1.9, [0.85, 0.86, 0.9]);
  return { poles: poles.build(), geos, pylon: Py.build(), pylonAt: { x: px, y: (H.h + 0.6 + top) / 2, h: top - H.h - 0.6 } };
}
/** Vertical sign text for the pylon: 新幹線 top to bottom on blue. */
function pylonTexture() {
  const cv = document.createElement('canvas'); cv.width = 192; cv.height = 768; const c = cv.getContext('2d')!;
  c.fillStyle = '#1e5bd8'; c.fillRect(0, 0, 192, 768); c.strokeStyle = '#ffffff'; c.lineWidth = 8; c.strokeRect(8, 8, 176, 752);
  c.fillStyle = '#ffffff'; c.font = '900 150px "Hiragino Sans","Noto Sans JP",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  ['新', '幹', '線'].forEach((ch, k) => c.fillText(ch, 96, 150 + k * 205));
  c.font = '64px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; c.fillText('🚄', 96, 712);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** A soft blue beam rising from the concourse, seen from far off (fades out as you come close). */
function beamTexture() {
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 256; const c = cv.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(90,170,255,0)'); g.addColorStop(0.55, 'rgba(90,170,255,0.35)'); g.addColorStop(1, 'rgba(120,190,255,0.9)');
  c.fillStyle = g; c.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
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

/** Timetable train on the arrivals track (Tokyo, Hakata): out of the tunnel, stop at track 15, change ends, back into the tunnel, rest. */
const V = 70, DWELL = 45, REST = 70;
export function timetable(t: number) {
  const a = TUN.portal - 150, st = S.stationZ + 90, st2 = st - SHIN_FLIP, b = TUN.portal - 300;
  const p1 = (st - a) / V * 1.6, p2 = (st2 - b) / V * 1.6, T = p1 + DWELL + p2 + REST, easeOut = (u: number) => 1 - (1 - u) * (1 - u), easeIn = (u: number) => u * u;
  t = ((t % T) + T) % T;
  if (t < p1) return { z: a + (st - a) * easeOut(t / p1), dir: 1, vis: true, v: V * 1.25 * (1 - t / p1), left: 99 };
  if (t < p1 + DWELL) return { z: st, dir: 1, vis: true, v: 0, left: p1 + DWELL - t };
  if (t < p1 + DWELL + p2) { const u = (t - p1 - DWELL) / p2; return { z: st2 - (st2 - b) * easeIn(u), dir: -1, vis: true, v: V * 1.25 * u, left: 99 }; }
  return { z: b, dir: -1, vis: false, v: 0, left: 99 };
}

export default function ShinkansenLine() {
  const D = useMemo(() => {
    if (!S.has) return null;
    const v = viaduct(), cc = concourse(), tn = tunnel(), wf = wayfinding();
    const conc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.5 }), glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    // the concourse is seen from inside too: its walls, ceiling and fittings are two-sided
    const concIn = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }), metalIn = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.4, side: THREE.DoubleSide });
    const glass = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.45 });
    // the bore is lit only by its own lamps (unlit vertex colours, seen from inside)
    const bore = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const plain = (t: THREE.Texture) => new THREE.MeshBasicMaterial({ map: t, toneMapped: false }); // one-sided: back-to-back pairs where both sides are seen
    const north = S.dests.map((d) => (REGIONS[d].station || REGIONS[d].name).replace('駅', '')).join('・');
    const boardW = plain(nameBoard('', north)), boardE = plain(nameBoard(north, '')); // terminus: the next stations are all to the north
    const signs: { m: THREE.Material; x: number; y: number; z: number; w: number; h: number; ry: number }[] = [];
    // car-number signs hanging over each boarding position, name boards, LED boards per platform
    const boards: { draw: () => void }[] = [];
    for (const P of S.platforms) {
      const cx = (P.x0 + P.x1) / 2, top = S.y + 0.2, ry = P.side < 0 ? Math.PI / 2 : -Math.PI / 2;
      for (let k = 0; k < 8; k++) { const z = S.stationZ + P.dir * 90 - P.dir * k * 25.6, m = plain(labelTexture(`${k + 1}号車`, '#ffffff', 256, 128)); signs.push({ m, x: cx, y: top + 4.2, z, w: 1.6, h: 0.8, ry: 0 }, { m, x: cx, y: top + 4.2, z: z - 0.04, w: 1.6, h: 0.8, ry: Math.PI }); void ry; }
      for (const z of [S.stationZ - 50, S.stationZ + 54]) signs.push({ m: P.side < 0 ? boardW : boardE, x: (P.side < 0 ? P.x0 : P.x1) - P.side * 0.3, y: top + 2.2, z, w: 4.2, h: 1.4, ry: P.side < 0 ? Math.PI / 2 : -Math.PI / 2 });
      const B = makeBoard(() => P.to ? [['のぞみ', destName(P), tt(4), '#ff9a2a', `${P.num}番線`], ['ひかり', destName(P), tt(22), '#ff4a4a', `${P.num}番線`]] : [['到着', 'のぞみ 当駅止まり', tt(9), '#9aa0a8', `${P.num}番線`]], `${P.num}番線　${P.to ? REGIONS[P.to].name + '方面' : '到着ホーム'}`);
      boards.push(B); for (const z of [S.stationZ - 8, S.stationZ + 40]) signs.push({ m: plain(B.tex), x: cx, y: top + 3.4, z, w: 3.6, h: 0.9, ry: 0 }, { m: plain(B.tex), x: cx, y: top + 3.4, z: z + 0.05, w: 3.6, h: 0.9, ry: Math.PI });
      { const m = plain(labelTexture('↓ 改札口・のりかえ', '#ffd23a', 512, 128)), d = shinDown(P); signs.push({ m, x: d.x, y: top + 3, z: d.z + 4.5, w: 3.2, h: 0.8, ry: 0 }, { m, x: d.x, y: top + 3, z: d.z + 4.45, w: 3.2, h: 0.8, ry: Math.PI }); } // readable from both sides
    }
    // concourse: entrance sign outside, gate signs, departure board over the gates, stair signs
    signs.push({ m: plain(labelTexture('新幹線のりかえ口  SHINKANSEN', '#2b8bff', 1024, 160)), x: H.x0 - 0.5, y: H.h - 1.2, z: S.stationZ, w: 14, h: 2.2, ry: -Math.PI / 2 });
    signs.push({ m: plain(labelTexture(stName.replace('駅', '') + '  ' + roma[REGION.id], '#ffffff', 768, 160)), x: H.x0 - 0.5, y: H.h + 1.4, z: S.stationZ, w: 12, h: 2.5, ry: -Math.PI / 2 });
    signs.push({ m: plain(labelTexture('新幹線 中央改札', '#ffffff', 768, 128)), x: H.gateX - 1.2, y: 4.2, z: S.stationZ, w: 7, h: 1.2, ry: -Math.PI / 2 });
    { const all = S.platforms.filter((p) => p.to); const B = makeBoard(() => all.flatMap((P) => [['のぞみ', destName(P), tt(4), '#ff9a2a', `${P.num}番線`]]).concat([['ひかり', all[0] ? destName(all[0]) : '', tt(22), '#ff4a4a', `${all[0]?.num ?? ''}番線`]]).slice(0, 2), '新幹線 発車案内'); boards.push(B); signs.push({ m: plain(B.tex), x: H.gateX - 1.3, y: 5.6, z: S.stationZ - 8, w: 6, h: 1.5, ry: -Math.PI / 2 }, { m: plain(B.tex), x: H.gateX - 1.3, y: 5.6, z: S.stationZ + 8, w: 6, h: 1.5, ry: -Math.PI / 2 }); }
    for (const P of S.platforms) { const u = shinUp(P); signs.push({ m: plain(labelTexture(`${P.num}番線  ${P.to ? REGIONS[P.to].name + '方面' : '到着ホーム'} ↑`, P.to ? '#ffd23a' : '#9aa0a8', 768, 128)), x: u.x, y: 3.6, z: u.z, w: 5, h: 0.85, ry: -Math.PI / 2 }); }
    signs.push({ m: new THREE.MeshBasicMaterial({ map: plateTexture(TUN.name) }), x: TUN.x, y: TUN.y + 14.5, z: TUN.portal + 2.06, w: 9, h: 2.25, ry: 0 });
    signs.push({ m: plain(labelTexture('駅弁  EKIBEN', '#ff9a2a', 512, 128)), x: H.x0 + 7, y: 3.1, z: H.z1 - 4.1, w: 5, h: 1.2, ry: Math.PI });
    signs.push({ m: plain(labelTexture('きっぷうりば', '#2be4ff', 512, 128)), x: H.x0 + 7.3, y: 2.6, z: H.z0 + 1.2, w: 5, h: 1.1, ry: 0 });
    // the trains waiting at the platforms with a destination, and the timetable train on another track
    const standing = S.platforms.filter((p) => p.to).map((P) => { const m = buildCarModel(VDEFS.shinkansen, '#f4f5f7'), s = shinStand(P); m.root.position.set(s.x, S.y + 0.05, s.z); m.root.rotation.y = P.dir > 0 ? 0 : Math.PI; return m; });
    const ai = S.platforms.some((p) => !p.to) ? buildCarModel(VDEFS.shinkansen, '#f4f5f7') : null;
    const guideMats = [0, 1, 2].map((k) => { const t = guideTexture(k); return new THREE.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.3, roughness: 0.55 }); });
    const pylonMat = new THREE.MeshBasicMaterial({ map: pylonTexture(), toneMapped: false });
    const beamMat = new THREE.MeshBasicMaterial({ map: beamTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false, opacity: 0 });
    return { v, cc, tn, wf, conc, metal, glow, glass, concIn, metalIn, bore, signs, boards, standing, ai, lastSoon: false, guideMats, pylonMat, beamMat };
  }, []);
  useFrame(({ camera }) => {
    if (!D) return;
    { const c = camera.position, d = Math.hypot(c.x - (H.x0 + 17), c.z - S.stationZ), onTrain = vehicles.some((q) => q.def.kind === 'shinkansen' && q.id === game.inCar);
      D.beamMat.opacity = game.where === 'out' && !onTrain && game.tunnel < 0.5 ? 0.95 * Math.min(1, Math.max(0, (d - 70) / 190)) : 0; }
    const driving = vehicles.some((q) => q.def.kind === 'shinkansen');
    for (const m of D.standing) m.root.visible = !driving;
    let by = 0, byKmh = 0;
    if (D.ai) {
      const T = timetable(game.clock), root = D.ai.root; root.visible = T.vis && !driving;
      if (root.visible) {
        root.position.set(S.x + S.track, S.y + 0.05, T.z); root.rotation.y = T.dir > 0 ? 0 : Math.PI;
        // heard on foot: distance from the player to the nearest point of the train
        const p = game.player, a = T.dir > 0 ? T.z - 195 : T.z - 16, b = T.dir > 0 ? T.z + 16 : T.z + 195, zz = Math.max(a, Math.min(b, p.z)), d = Math.hypot(p.x - S.x - S.track, (p.y - S.y) * 1.5, p.z - zz);
        if (!game.inCar && game.where === 'out') { by = Math.max(0, 1 - d / 260) ** 2; byKmh = T.v * 3.6; }
      }
      // the departure melody on the platform as the timetable train is about to leave
      const soon = T.left < 7; if (soon && !D.lastSoon && !game.inCar && game.where === 'out' && Math.abs(game.player.z - S.stationZ) < 160 && Math.abs(game.player.x - S.x) < 60) chime('depart'); D.lastSoon = soon;
    }
    trainBy(by, byKmh);
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
      <mesh geometry={D.tn.In} material={D.bore} />
      <mesh geometry={D.tn.Out} material={D.conc} castShadow receiveShadow />
      <mesh geometry={D.tn.Lamp} material={D.glow} />
      <mesh geometry={D.wf.poles} material={D.metal} castShadow />
      {D.wf.geos.map((g, k) => <mesh key={'g' + k} geometry={g} material={D.guideMats[k]} />)}
      <mesh geometry={D.wf.pylon} material={D.metal} />
      {[-1, 1].map((s) => <mesh key={'p' + s} position={[D.wf.pylonAt.x + s * 0.62, D.wf.pylonAt.y, S.stationZ]} rotation-y={(s * Math.PI) / 2} material={D.pylonMat}><planeGeometry args={[3.4, D.wf.pylonAt.h - 0.8]} /></mesh>)}
      <mesh position={[H.x0 + 17, H.h + 210, S.stationZ]} material={D.beamMat} renderOrder={5}><cylinderGeometry args={[5, 5, 420, 20, 1, true]} /></mesh>
      {D.standing.map((m, i) => <primitive key={i} object={m.root} />)}
      {D.ai && <primitive object={D.ai.root} />}
      {D.signs.map((s, i) => <mesh key={i} position={[s.x, s.y, s.z]} rotation-y={s.ry} material={s.m}><planeGeometry args={[s.w, s.h]} /></mesh>)}
    </group>
  );
}
