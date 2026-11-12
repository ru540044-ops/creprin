import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SIG, buildings, roadC, O, ROAD, RAIL, ROTARY, NARA_LANTERNS, NARA_ST } from './cityGen';
import { REGION } from './region';
import { labelTexture } from './textures';
import { game } from '../state/store';

/**
 * The signature places of each city, built once (they are few and some are seen from far away):
 * shrines with torii, Asakusa's thunder gate / stall street / main hall / five-storey pagoda, the sky tower, the Shinsekai tower,
 * the dome, the station hall (red brick with domes in Tokyo), shopping-street arches and lantern strings, street-food stalls,
 * station entrances, and the giant video screens around the scramble crossing. Collision boxes live in cityGen (SIG section).
 */
type Col = [number, number, number];
const paint = (g: THREE.BufferGeometry, c: Col) => { const g2 = g.index ? g.toNonIndexed() : g; const n = g2.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g2.setAttribute('color', new THREE.BufferAttribute(a, 3)); for (const k of Object.keys(g2.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color' && k !== 'uv') g2.deleteAttribute(k); if (!g2.attributes.uv) g2.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2)); return g2; };
const box = (w: number, h: number, d: number, x: number, y: number, z: number, c: Col, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); if (ry) g.rotateY(ry); g.translate(x, y, z); return paint(g, c); };
const cyl = (r0: number, r1: number, h: number, x: number, y: number, z: number, c: Col, seg = 10) => { const g = new THREE.CylinderGeometry(r1, r0, h, seg); g.translate(x, y + h / 2, z); return paint(g, c); };
/** Square (or stretched) frustum: half-widths a0 at the bottom and a1 at the top. */
const frus = (a0: number, a1: number, h: number, x: number, y: number, z: number, c: Col, sx = 1, sz = 1) => { const g = new THREE.CylinderGeometry(a1 * Math.SQRT2, a0 * Math.SQRT2, h, 4); g.rotateY(Math.PI / 4); g.scale(sx, 1, sz); g.translate(x, y + h / 2, z); return paint(g, c); };
const merge = (parts: THREE.BufferGeometry[]) => { if (!parts.length) return null; const g = mergeGeometries(parts, false)!; g.computeBoundingSphere(); return g; };

const VERM: Col = [0.86, 0.24, 0.12], DARK: Col = [0.14, 0.13, 0.13], WOOD: Col = [0.5, 0.33, 0.2], ROOF: Col = [0.24, 0.27, 0.27], STONE: Col = [0.62, 0.6, 0.56], GOLD: Col = [0.95, 0.75, 0.25], WHITE: Col = [0.94, 0.93, 0.9];

function torii(S: THREE.BufferGeometry[], x: number, z: number, big: boolean) {
  const k = big ? 1.9 : 1, w = 3 * k, h = 5.2 * k;
  for (const s of [-1, 1]) { S.push(cyl(0.3 * k, 0.26 * k, h, x + s * w, 0, z, VERM)); S.push(cyl(0.42 * k, 0.42 * k, 0.4 * k, x + s * w, 0, z, DARK)); }
  S.push(box(w * 2 + 1.4 * k, 0.32 * k, 0.5 * k, x, h - 0.1 * k, z, DARK), box(w * 2 + 1.0 * k, 0.3 * k, 0.45 * k, x, h - 0.42 * k, z, VERM), box(w * 2 + 0.4 * k, 0.26 * k, 0.32 * k, x, h - 1.5 * k, z, VERM), box(0.3 * k, 1.0 * k, 0.3 * k, x, h - 1.3 * k, z, VERM));
  for (const s of [-1, 1]) S.push(box(0.9 * k, 0.32 * k, 0.5 * k, x + s * (w + 0.9 * k), h + 0.08 * k, z, DARK)); // upturned ends
}
function hall(S: THREE.BufferGeometry[], G: THREE.BufferGeometry[], x: number, z: number, w: number, d: number, h: number, roof: Col, red: boolean) {
  S.push(box(w + 2, 0.9, d + 2, x, 0, z, STONE));
  S.push(box(w, h, d, x, 0.9, z, red ? VERM : WOOD));
  for (let k = -2; k <= 2; k++) S.push(cyl(0.22, 0.22, h, x + (k * w) / 5, 0.9, z + d / 2 + 0.6, red ? VERM : WOOD, 8));
  G.push(box(w * 0.7, h * 0.35, 0.1, x, 0.9 + h * 0.35, z + d / 2 + 0.05, [1, 0.8, 0.5]));
  S.push(frus(w / 2 + 2.2, w / 2 - 1.5, h * 0.75, x, 0.9 + h, z, roof, 1, (d + 4.4) / (w + 4.4)));
  S.push(box(w * 0.5, 0.6, 0.9, x, 0.9 + h * 1.75, z, roof), box(1.6, 0.5, 0.9, x, 0.9, z + d / 2 + 1.6, WOOD)); // ridge, offering box
}

export default function Signature() {
  const D = useMemo(() => {
    const S: THREE.BufferGeometry[] = [], G: THREE.BufferGeometry[] = [], L: THREE.BufferGeometry[] = [];
    const signs: { tex: THREE.Texture; x: number; y: number; z: number; w: number; h: number; ry: number }[] = [];
    // station-front rotary: signs over the taxi rank and the bus stop (both sides, readable from the loop)
    if (ROTARY.on) for (const [p, t, c] of [[ROTARY.taxi, 'タクシーのりば', '#ffd23a'], [ROTARY.bus, '空港バス のりば', '#2be4ff']] as [{ x: number; z: number }, string, string][]) { const tex = labelTexture(t, c, 512, 128); signs.push({ tex, x: p.x, y: 2.95, z: p.z, w: 2.4, h: 0.6, ry: Math.PI / 2 }, { tex, x: p.x, y: 2.95, z: p.z, w: 2.4, h: 0.6, ry: -Math.PI / 2 }); }
    // shrines and the temple hall
    for (const sh of SIG.shrines) {
      if (sh.tz !== undefined) { torii(S, sh.x, sh.tz, sh.big); hall(S, G, sh.x, sh.z, sh.big ? 18 : 9, sh.big ? 13 : 6.5, sh.big ? 8 : 4.2, sh.big ? [0.3, 0.42, 0.36] : ROOF, false); }
      if (sh.tz !== undefined) for (let z = sh.z + (sh.big ? 8 : 4); z < sh.tz; z += 2) S.push(box(2.4, 0.04, 1.6, sh.x, 0.17, z, [0.82, 0.78, 0.7])); // stone path
    }
    const T = SIG.temple;
    if (T) { // Asakusa
      const cx = T.x, gz = T.z1 - 5;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) S.push(cyl(0.45, 0.45, 8.5, cx + sx * 6, 0.15, gz + sz * 1.2, VERM));
      S.push(box(14, 1.2, 4.4, cx, 8.4, gz, VERM), frus(9.5, 6, 3.2, cx, 9.5, gz, DARK, 1, 0.5), box(10, 0.6, 1, cx, 12.6, gz, DARK));
      signs.push({ tex: lanternTexture('雷門'), x: cx, y: 5.6, z: gz, w: 3.2, h: 3.8, ry: -1 }); // giant lantern (cylinder, see below)
      for (let n = 0; n < 6; n++) for (const s of [-1, 1]) { const z = T.z1 - 16 - n * 6.4; S.push(box(4, 3, 5.2, cx + s * 6.5, 0.15, z, [0.92, 0.88, 0.8]), frus(2.6, 1.9, 1.1, cx + s * 6.5, 3.15, z, VERM, 1, 1.3)); G.push(box(3.2, 0.5, 0.1, cx + s * 6.5 - s * 2.06, 2.2, z, [1, 0.55, 0.3], Math.PI / 2)); }
      for (let z = T.z0 + 27; z < T.z1 - 6; z += 2) S.push(box(7, 0.04, 1.8, cx, 0.17, z, [0.78, 0.75, 0.7]));
      hall(S, G, cx, T.z0 + 17, 28, 17, 9, [0.2, 0.22, 0.22], true);
      const px = cx - 27, pz = T.z0 + 34; S.push(box(8, 1, 8, px, 0, pz, STONE));
      for (let k = 0; k < 5; k++) { const y = 1 + k * 6.8, a = 3.4 - k * 0.3; S.push(box(a * 2, 4.4, a * 2, px, y, pz, k % 2 ? VERM : [0.9, 0.86, 0.8])); S.push(frus(a + 2.4, a + 0.4, 2.2, px, y + 4.4, pz, DARK)); }
      S.push(cyl(0.35, 0.15, 9, px, 35, pz, GOLD, 8));
      for (const s of [-1, 1]) for (let n = 0; n < 4; n++) L.push(new THREE.SphereGeometry(0.4, 8, 6).scale(1, 1.35, 1).translate(cx + s * 4.5, 3, T.z1 - 16 - n * 9));
    }
    // Nara: the five-storey pagoda (tiers of dark timber and white plaster under deep roofs, a bronze spire with nine rings) and the hall beside it
    if (SIG.pagoda) {
      const { x: px, z: pz, hx, hz } = SIG.pagoda, TIM: Col = [0.34, 0.22, 0.14];
      S.push(box(13, 1.2, 13, px, 0, pz, STONE));
      for (let k = 0; k < 5; k++) { // each storey: timber posts and white panels, bracketed eaves, a deep tiled roof
        const y = 1.2 + k * 7.4, a = 4.4 - k * 0.42;
        S.push(box(a * 2, 5.0, a * 2, px, y, pz, [0.86, 0.83, 0.76]));
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) S.push(box(0.5, 5.0, 0.5, px + sx * a, y, pz + sz * a, TIM));
        S.push(box(a * 2 + 0.4, 0.6, a * 2 + 0.4, px, y + 4.4, pz, TIM), box(a * 2 + 2.4, 0.5, a * 2 + 2.4, px, y + 4.9, pz, [0.5, 0.2, 0.12]));
        S.push(frus(a + 4.4, a + 0.6, 2.2, px, y + 5.2, pz, [0.17, 0.18, 0.2]));
      }
      S.push(cyl(0.5, 0.25, 13, px, 38.6, pz, [0.36, 0.3, 0.2], 8)); for (let n = 0; n < 9; n++) S.push(cyl(1.0 - n * 0.05, 1.0 - n * 0.05, 0.22, px, 40 + n * 0.95, pz, GOLD, 10));
      hall(S, G, hx, hz, 22, 14, 7.5, [0.2, 0.21, 0.23], false);
      for (let z = hz + 9; z < pz + 40; z += 2) S.push(box(3, 0.04, 1.6, hx, 0.17, z, [0.8, 0.77, 0.7]));
    }
    // Nara's park: stone lanterns along the paths
    for (const l of NARA_LANTERNS) { S.push(box(0.9, 0.4, 0.9, l.x, 0.15, l.z, STONE), cyl(0.18, 0.18, 0.9, l.x, 0.55, l.z, STONE, 6), box(0.85, 0.2, 0.85, l.x, 1.45, l.z, STONE), box(0.6, 0.45, 0.6, l.x, 1.65, l.z, STONE), frus(0.7, 0.1, 0.35, l.x, 2.1, l.z, STONE)); G.push(box(0.62, 0.3, 0.62, l.x, 1.72, l.z, [1, 0.8, 0.5])); }
    // sky tower
    if (SIG.skytower) {
      const { x, z } = SIG.skytower, SIL: Col = [0.86, 0.88, 0.92];
      for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; S.push(cyl(2.2, 1.2, 60, x + Math.sin(a) * 8, 0, z + Math.cos(a) * 8, SIL, 6)); }
      S.push(cyl(9, 5.5, 280, x, 0, z, SIL, 12), cyl(10.5, 10.5, 10, x, 165, z, [0.7, 0.74, 0.8], 16), cyl(8, 8, 6, x, 240, z, [0.7, 0.74, 0.8], 16), cyl(2.2, 0.4, 70, x, 280, z, SIL, 8));
      G.push(cyl(10.6, 10.6, 3, x, 168, z, [0.55, 0.75, 1], 16), cyl(8.1, 8.1, 2, x, 242, z, [0.6, 0.8, 1], 16));
      for (let y = 20; y < 280; y += 22) G.push(cyl(9.1 - y * 0.0125, 9.1 - y * 0.0125, 0.3, x, y, z, [0.5, 0.7, 1], 12));
    }
    // Shinsekai tower
    if (SIG.shinsekai) {
      const { x, z } = SIG.shinsekai, SIL: Col = [0.75, 0.76, 0.78];
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) S.push(box(1.6, 22, 1.6, x + sx * 6.5, 0, z + sz * 6.5, SIL));
      S.push(box(15, 2, 15, x, 20, z, SIL), cyl(5.2, 4.2, 60, x, 22, z, SIL, 8), cyl(7.5, 7.5, 9, x, 80, z, [0.88, 0.88, 0.9], 8), cyl(1, 0.5, 10, x, 89, z, SIL, 6));
      G.push(cyl(7.6, 7.6, 2, x, 83, z, [1, 0.9, 0.5], 8));
      for (let y = 26; y < 78; y += 8) G.push(cyl(5.3 - (y - 22) * 0.017, 5.3 - (y - 22) * 0.017, 0.4, x, y, z, [0.4, 0.9, 1], 8));
      signs.push({ tex: labelTexture('新世界', '#ffd23a', 512, 128), x, y: 60, z: z + 5.6, w: 9, h: 2.3, ry: 0 }, { tex: labelTexture('新世界', '#ffd23a', 512, 128), x, y: 60, z: z - 5.6, w: 9, h: 2.3, ry: Math.PI });
    }
    // dome
    if (SIG.dome) { const { x, z } = SIG.dome; const R = 39, th = Math.acos(9 / 39), g = new THREE.SphereGeometry(R, 40, 14, 0, Math.PI * 2, 0, th); g.translate(x, -9, z); S.push(paint(g, [0.82, 0.84, 0.88]), cyl(38.5, 38.5, 4, x, 0, z, [0.6, 0.62, 0.66], 40)); G.push(cyl(38.6, 38.6, 1.2, x, 3.2, z, [0.6, 0.85, 1], 40)); }
    // station hall extras
    const st = SIG.station;
    if (st) {
      const cz = (st.z0 + st.z1) / 2, fx = st.x0 - 0.2;
      if (st.red) { // white stone bands, two octagonal domes and a central roof
        for (const y of [5.2, 10.2, 14.9]) S.push(box(0.4, 0.5, st.z1 - st.z0, fx - 0.05, y, cz, WHITE));
        for (const dz of [-30, 30]) { const x = (st.x0 + st.x1) / 2, zz = cz + dz; S.push(cyl(9, 9, 6, x, 15.15, zz, [0.86, 0.42, 0.32], 8), cyl(9.3, 9.3, 0.6, x, 21, zz, WHITE, 8)); const g = new THREE.SphereGeometry(9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1, 0.75, 1); g.translate(x, 21.6, zz); S.push(paint(g, [0.25, 0.27, 0.28])); }
        S.push(frus(10, 3, 5, (st.x0 + st.x1) / 2, 15.15, cz, [0.25, 0.27, 0.28], 1.2, 1));
      } else if (NARA_ST.on) { // Nara: a temple-style hipped roof in two tiers with a bronze spire, a deep porch over the entrance
        const hx = (st.x0 - 5 + st.x0 + 19) / 2, w = 24, d = st.z1 - st.z0 + 12, TILE: Col = [0.2, 0.21, 0.23];
        S.push(box(w + 1.2, 0.5, d + 0.4, hx, 8.5, cz, [0.4, 0.27, 0.18]), frus(w / 2 + 2.6, w / 2 - 3, 3.4, hx, 9.0, cz, TILE, 1, (d + 5) / (w + 5)));
        S.push(box(w * 0.45, 3.2, d * 0.3, hx, 12.4, cz, [0.93, 0.9, 0.82]), frus(w * 0.3 + 1.6, 1.2, 4.2, hx, 15.6, cz, TILE, 1, (d * 0.3 + 3) / (w * 0.45 + 3)));
        S.push(cyl(0.35, 0.18, 7, hx, 19.4, cz, [0.4, 0.33, 0.22], 8)); for (let n = 0; n < 6; n++) S.push(cyl(0.75 - n * 0.06, 0.75 - n * 0.06, 0.18, hx, 20.4 + n * 0.8, cz, GOLD, 10));
        S.push(box(4, 0.5, 14, st.x0 - 7, 6, cz, [0.4, 0.27, 0.18]), frus(3.8, 1.4, 1.6, st.x0 - 7, 6.5, cz, TILE, 1, 3.4)); for (const s of [-1, 1]) S.push(cyl(0.3, 0.3, 6, st.x0 - 8.5, 0.15, cz + s * 6, [0.4, 0.27, 0.18], 8));
      } else S.push(box(6, 0.6, st.z1 - st.z0 + 8, st.x0 - 3, 7, cz, [0.85, 0.87, 0.9]));
      signs.push({ tex: labelTexture(REGION.station || RAIL.names[1], '#ffffff', 512, 128), x: fx - 0.3, y: NARA_ST.on ? 5.2 : 9, z: cz, w: 10, h: 2.5, ry: -Math.PI / 2 });
    }
    // Nara: the terminus of the line to Osaka (platform, canopy, the dead-end track with its buffer stop, the red-and-white train, ticket gates, signs)
    if (NARA_ST.on) {
      const T = NARA_ST, pcx = (T.px0 + T.px1) / 2, pw = T.px1 - T.px0, pz = (T.z0 + T.z1) / 2, pl = T.z1 - T.z0, RED: Col = [0.74, 0.12, 0.14], CRM: Col = [0.95, 0.94, 0.9];
      S.push(box(pw, T.y, pl, pcx, 0, pz, [0.72, 0.71, 0.68]), box(0.5, 0.02, T.gateZ - T.z0, T.px1 - 0.6, T.y, (T.z0 + T.gateZ) / 2, [0.95, 0.8, 0.15]));
      S.push(box(pw + 1.2, 0.35, T.gateZ - T.z0 - 2, pcx - 0.3, 4.4, (T.z0 + T.gateZ) / 2 - 1, [0.55, 0.58, 0.62]));
      for (let z = T.z0 + 4; z < T.gateZ - 2; z += 12) S.push(box(0.36, 4.4 - T.y, 0.36, T.px0 + 0.88, T.y, z, [0.5, 0.52, 0.56]));
      for (let z = T.z0 + 6; z < T.gateZ - 4; z += 6) G.push(box(0.3, 0.08, 2.2, pcx, 4.3, z, [1, 0.95, 0.85]));
      S.push(box(0.2, 1.4, T.gateZ - T.z0, T.px0 - 0.1, 0, (T.z0 + T.gateZ) / 2, [0.55, 0.57, 0.6]));
      // the track: ballast, rails, sleepers, the fence beyond it, the buffer stop
      S.push(box(T.tx + 2.4 - T.px1, 0.12, T.z1 - T.z0, (T.px1 + T.tx + 2.4) / 2, 0.15, pz, [0.45, 0.43, 0.4]));
      for (const s of [-0.72, 0.72]) S.push(box(0.1, 0.16, T.z1 - T.z0, T.tx + s, 0.27, pz, [0.75, 0.77, 0.8]));
      for (let z = T.z0 + 1; z < T.z1; z += 1.2) S.push(box(2.3, 0.08, 0.26, T.tx, 0.24, z, [0.35, 0.3, 0.26]));
      S.push(box(0.2, 1.6, T.z1 - T.z0, T.tx + 2.5, 0, pz, [0.5, 0.55, 0.5]), box(4.6, 1.2, 0.6, T.tx + 0.4, 0, T.tz0 - 0.7, [0.85, 0.15, 0.12]), box(3, 0.3, 0.62, T.tx, 0.9, T.tz0 - 0.7, CRM));
      S.push(box(T.tx + 2.4 - T.px1, 1.1, 0.2, (T.px1 + T.tx + 2.4) / 2, 0, T.tz1 + 0.5, [0.5, 0.55, 0.5]));
      // the train: three cars in red with a cream band, dark windows, doors, the cab front with its lamps
      for (let k = 0; k < 3; k++) {
        const z0 = T.tz0 + k * 20.6, zc = z0 + 10;
        S.push(box(3.0, 3.4, 20, T.tx, 0.5, zc, RED), box(3.04, 0.45, 20, T.tx, 2.0, zc, CRM), box(3.06, 0.9, 18.4, T.tx, 2.55, zc, [0.12, 0.13, 0.16]), box(2.6, 0.3, 19.6, T.tx, 3.9, zc, [0.55, 0.56, 0.6]));
        for (const dz of [-6, 0, 6]) S.push(box(3.08, 2.1, 1.3, T.tx, 0.6, zc + dz, [0.6, 0.08, 0.1]));
      }
      for (const z of [T.tz0 - 0.05, T.tz1 + 0.05]) { S.push(box(2.6, 1.0, 0.1, T.tx, 2.5, z, [0.1, 0.11, 0.14])); for (const s of [-1, 1]) G.push(box(0.35, 0.25, 0.06, T.tx + s * 1.0, 1.2, z + (z < T.tz1 ? -0.05 : 0.05), [1, 0.95, 0.75])); }
      // ticket gates across the platform, with the line's sign over them, the departure board and the station name board
      for (let x = T.px0 + 0.6; x < T.px1 - 0.4; x += 1.3) { S.push(box(0.3, 1.05, 1.5, x, T.y, T.gateZ, [0.62, 0.64, 0.68])); G.push(box(0.32, 0.12, 0.3, x, T.y + 1.0, T.gateZ - 0.5, [0.3, 0.8, 1])); }
      S.push(box(0.25, 3.6, 0.25, T.px0 + 0.3, T.y, T.gateZ, [0.4, 0.42, 0.45]), box(0.25, 3.6, 0.25, T.px1 - 0.3, T.y, T.gateZ, [0.4, 0.42, 0.45]));
      signs.push({ tex: labelTexture('やまと線 のりば  特急 なんば（大阪）行き', '#ff6a6a', 1024, 128), x: pcx, y: T.y + 3.3, z: T.gateZ + 0.15, w: pw - 0.2, h: 0.85, ry: 0 });
      signs.push({ tex: labelTexture('特急 なんば行き  32.8km  車窓を見ながら', '#ffd23a', 1024, 128), x: pcx, y: 3.6, z: T.gateZ - 2.5, w: pw - 1, h: 0.8, ry: Math.PI });
      for (const z of [T.z0 + 14, T.z0 + 44]) signs.push({ tex: labelTexture('な ら  奈良  NARA', '#ffffff', 768, 160), x: T.px0 + 0.25, y: 2.3, z, w: 4, h: 0.85, ry: Math.PI / 2 });
    }
    // shopping-street arches and lantern strings
    for (const a of SIG.arches) {
      for (const s of [-1, 1]) S.push(cyl(0.3, 0.3, 7.6, a.x + s * 8.6, 0, a.z, [0.3, 0.3, 0.34], 10));
      S.push(box(19, 0.5, 0.6, a.x, 7.4, a.z, [0.3, 0.3, 0.34]));
      G.push(box(18.6, 0.18, 0.2, a.x, 7.9, a.z, [1, 0.3, 0.6]), box(18.6, 0.18, 0.2, a.x, 5.15, a.z, [0.3, 0.9, 1]));
      const tx = labelTexture(a.name, '#ffd23a', 768, 160); for (const ry of [0, Math.PI]) signs.push({ tex: tx, x: a.x, y: 6.5, z: a.z + (ry ? -0.4 : 0.4), w: 13, h: 2.6, ry });
    }
    const wirePts: number[] = [];
    for (const l of SIG.lanterns) {
      const n = Math.max(2, Math.round(Math.hypot(l.x1 - l.x0, l.z1 - l.z0) / 2.6));
      for (let k = 0; k <= n; k++) { const t = k / n, x = l.x0 + (l.x1 - l.x0) * t, z = l.z0 + (l.z1 - l.z0) * t, y = l.y - Math.sin(t * Math.PI) * 0.5; if (k > 0 && k < n) L.push(new THREE.SphereGeometry(0.32, 8, 6).scale(1, 1.35, 1).translate(x, y - 0.45, z)); if (k < n) { const t2 = (k + 1) / n; wirePts.push(x, y, z, l.x0 + (l.x1 - l.x0) * t2, l.y - Math.sin(t2 * Math.PI) * 0.5, l.z0 + (l.z1 - l.z0) * t2); } }
      for (const [px, pz] of [[l.x0, l.z0], [l.x1, l.z1]]) S.push(cyl(0.1, 0.1, l.y, px, 0.15, pz, [0.3, 0.3, 0.32], 6));
    }
    // street-food stalls: cart, roof, curtain, lantern, stools, the dish on a sign
    for (const y of SIG.yatai) {
      const fx = Math.sin(y.a), fz = Math.cos(y.a), ry = y.a, lx = Math.cos(y.a), lz = -Math.sin(y.a);
      S.push(box(2.6, 1.05, 1.8, y.x, 0.15, y.z, WOOD, ry), box(2.8, 0.08, 0.7, y.x + fx * 1.1, 1.2, y.z + fz * 1.1, [0.62, 0.45, 0.3], ry));
      for (const s of [-1, 1]) S.push(box(0.1, 1.5, 0.1, y.x + lx * s * 1.25 - fx * 0.8, 1.2, y.z + lz * s * 1.25 - fz * 0.8, WOOD, ry));
      S.push(box(3, 0.12, 2.4, y.x + fx * 0.2, 2.7, y.z + fz * 0.2, [0.75, 0.18, 0.15], ry));
      G.push(box(2.6, 0.55, 0.04, y.x + fx * 1.35, 2.25, y.z + fz * 1.35, [0.95, 0.85, 0.7], ry));
      for (const s of [-1, 0, 1]) S.push(cyl(0.2, 0.2, 0.55, y.x + fx * 2.2 + lx * s * 0.9, 0.15, y.z + fz * 2.2 + lz * s * 0.9, [0.35, 0.3, 0.28], 8));
      L.push(new THREE.SphereGeometry(0.3, 8, 6).scale(1, 1.3, 1).translate(y.x + fx * 1.4 + lx * 1.3, 2.25, y.z + fz * 1.4 + lz * 1.3));
      signs.push({ tex: labelTexture(y.food, '#ffcf8a', 512, 128), x: y.x + fx * 1.4, y: 3.25, z: y.z + fz * 1.4, w: 2.8, h: 0.7, ry });
    }
    // station entrances: a glass booth with stairs climbing towards the platform, the station's name on top
    for (const gt of SIG.gates) {
      S.push(box(4.6, 3.2, 5, gt.x + 1.2, 0.15, gt.z, [0.55, 0.6, 0.66]), box(5, 0.3, 5.4, gt.x + 1.2, 3.35, gt.z, [0.85, 0.86, 0.9]));
      for (let k = 0; k < 6; k++) S.push(box(1.6, 0.6 + k * 0.6, 2.2, gt.x - 0.6 - k * 0.0, 0.15, gt.z + 3.4 + k * 0.9, [0.7, 0.7, 0.72]));
      G.push(box(0.06, 2.3, 3.6, gt.x - 1.11, 0.4, gt.z, [0.85, 0.95, 1]));
      signs.push({ tex: labelTexture(gt.name + '  ' + RAIL.name, '#2be4ff', 768, 128), x: gt.x - 1.2, y: 4.3, z: gt.z, w: 5.2, h: 0.86, ry: -Math.PI / 2 });
    }
    // police boxes: a small white post with a red lamp over the door and the sign
    for (const k of SIG.koban) {
      S.push(box(3.6, 3.0, 3.2, k.x, 0.15, k.z, [0.93, 0.93, 0.9]), box(4.2, 0.3, 3.8, k.x, 3.15, k.z, [0.35, 0.36, 0.4]));
      G.push(box(1.4, 2.1, 0.06, k.x, 0.2, k.z - 1.62, [0.95, 0.9, 0.7]));
      L.push(new THREE.SphereGeometry(0.22, 10, 8).translate(k.x, 2.75, k.z - 1.75));
      signs.push({ tex: labelTexture('交番  KOBAN', '#ffffff', 512, 128), x: k.x, y: 3.7, z: k.z - 1.92, w: 3.2, h: 0.8, ry: Math.PI });
    }
    for (const p of SIG.posts) S.push(cyl(0.24, 0.24, 1.15, p.x, 0.15, p.z, [0.85, 0.1, 0.08], 12), cyl(0.3, 0.3, 0.12, p.x, 1.3, p.z, [0.7, 0.08, 0.06], 12), box(0.3, 0.05, 0.06, p.x, 1.05, p.z - 0.24, [0.15, 0.12, 0.12]));
    const solidMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.08 });
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    const lanternMat = new THREE.MeshBasicMaterial({ color: '#ff5a3a', toneMapped: false });
    const wire = new THREE.BufferGeometry(); wire.setAttribute('position', new THREE.Float32BufferAttribute(wirePts, 3));
    // the giant temple lantern is a real cylinder with the text wrapped round it
    const gl = signs.find((s) => s.ry === -1);
    const bigLantern = gl ? (() => { const g = new THREE.CylinderGeometry(gl.w / 2, gl.w / 2, gl.h, 20, 1, false); const m = new THREE.MeshBasicMaterial({ map: gl.tex, toneMapped: false }); const mesh = new THREE.Mesh(g, m); mesh.position.set(gl.x, gl.y, gl.z); return mesh; })() : null;
    return {
      solid: merge(S), glow: merge(G), lanterns: merge(L.map((g) => { const g2 = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g2.attributes)) if (k !== 'position' && k !== 'normal') g2.deleteAttribute(k); return g2; })),
      solidMat, glowMat, lanternMat, wire, wireMat: new THREE.LineBasicMaterial({ color: '#202022' }), bigLantern,
      signs: signs.filter((s) => s.ry !== -1).map((s) => ({ ...s, mat: new THREE.MeshBasicMaterial({ map: s.tex, toneMapped: false, side: THREE.DoubleSide }) })),
    };
  }, []);
  useFrame(() => {
    const h = game.hour, night = h > 18.4 || h < 6.4, dusk = !night && (h > 17.2 || h < 7.2), k = night ? 1.45 : dusk ? 1.05 : 0.6;
    D.glowMat.color.setScalar(k); D.lanternMat.color.setRGB(1.0 * k * 1.1, 0.35 * k, 0.2 * k);
    for (const s of D.signs) s.mat.color.setScalar(night ? 1.2 : dusk ? 1 : 0.85);
  });
  return (
    <group>
      {D.solid && <mesh geometry={D.solid} material={D.solidMat} castShadow receiveShadow />}
      {D.glow && <mesh geometry={D.glow} material={D.glowMat} />}
      {D.lanterns && <mesh geometry={D.lanterns} material={D.lanternMat} />}
      <lineSegments geometry={D.wire} material={D.wireMat} />
      {D.bigLantern && <primitive object={D.bigLantern} />}
      {D.signs.map((s, i) => <mesh key={i} position={[s.x, s.y, s.z]} rotation-y={s.ry} material={s.mat}><planeGeometry args={[s.w, s.h]} /></mesh>)}
      <Screens />
    </group>
  );
}

/** Lantern paper: red with big black characters, top and bottom bands. */
function lanternTexture(text: string) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const c = cv.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#7a1010'); g.addColorStop(0.5, '#d42a1e'); g.addColorStop(1, '#7a1010'); c.fillStyle = g; c.fillRect(0, 0, 512, 256);
  c.fillStyle = '#1a1414'; c.fillRect(0, 0, 512, 22); c.fillRect(0, 234, 512, 22);
  c.font = '900 150px "Hiragino Mincho ProN","Noto Serif JP",serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 128, 132); c.fillText(text, 384, 132);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ---------- giant video screens around the scramble crossing (fictional adverts, animated) ---------- */
const ADS: [string, string, string][] = [['NEON COLA', '#ff2a5a', '#1a0010'], ['夏フェス 2026', '#ffd23a', '#2a1060'], ['TOKYO NIGHT RUN', '#2be4ff', '#001a2a'], ['新作ゲーム 発売中', '#9dff3a', '#0a2010'], ['ラーメン博', '#ff8a2a', '#2a0a00'], ['STAR IDOL LIVE', '#ff6ad5', '#200020']];
function Screens() {
  const S = useMemo(() => {
    const nx = roadC(O + 4), nz = roadC(O + 4), list: { x: number; y: number; z: number; w: number; h: number; ry: number }[] = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      let best: (typeof buildings)[number] | null = null, bd = 1e9;
      for (const b of buildings) { if (b.gable || b.h < 16 || b.shape || b.y0 > 3) continue; const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2; if (Math.sign(cx - nx) !== sx || Math.sign(cz - nz) !== sz) continue; const d = Math.hypot(Math.max(b.x0 - nx, nx - b.x1, 0), Math.max(b.z0 - nz, nz - b.z1, 0)); if (d < bd) { bd = d; best = b; } }
      if (!best || bd > 30) continue;
      const b = best, faceX = sx > 0 ? b.x0 : b.x1, faceZ = sz > 0 ? b.z0 : b.z1, w = Math.min(16, (b.z1 - b.z0) - 3), w2 = Math.min(16, (b.x1 - b.x0) - 3);
      const y = b.y0 + Math.min(b.h - 2, 22) - 5;
      if (w > 6) list.push({ x: faceX - sx * 0.3, y, z: (b.z0 + b.z1) / 2, w, h: w * 0.56, ry: sx > 0 ? -Math.PI / 2 : Math.PI / 2 });
      if (w2 > 6) list.push({ x: (b.x0 + b.x1) / 2, y: y - 1, z: faceZ - sz * 0.3, w: w2, h: w2 * 0.56, ry: sz > 0 ? Math.PI : 0 });
    }
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 288; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const cv2 = document.createElement('canvas'); cv2.width = 512; cv2.height = 288; const tex2 = new THREE.CanvasTexture(cv2); tex2.colorSpace = THREE.SRGBColorSpace;
    const mats = [new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), new THREE.MeshBasicMaterial({ map: tex2, toneMapped: false })];
    return { list, cv, cv2, tex, tex2, mats, last: -1 };
  }, []);
  useEffect(() => () => { S.tex.dispose(); S.tex2.dispose(); }, [S]);
  useFrame(({ clock, camera }) => {
    if (!S.list.length) return;
    const near = Math.hypot(camera.position.x - S.list[0].x, camera.position.z - S.list[0].z) < 700; if (!near) return;
    const t = clock.elapsedTime, step = Math.floor(t * 6); if (step === S.last) return; S.last = step; // ~6 frames a second is plenty for a billboard
    for (const [cv, tex, off] of [[S.cv, S.tex, 0], [S.cv2, S.tex2, 3]] as const) {
      const c = cv.getContext('2d')!, ad = ADS[(Math.floor(t / 6) + off) % ADS.length], p = (t % 6) / 6;
      const g = c.createLinearGradient(0, 0, 512, 288); g.addColorStop(0, ad[2]); g.addColorStop(1, '#000'); c.fillStyle = g; c.fillRect(0, 0, 512, 288);
      for (let k = 0; k < 9; k++) { c.fillStyle = ad[1] + '33'; const r = 30 + ((k * 53 + t * 80) % 220); c.beginPath(); c.arc(256 + Math.cos(k + t) * 140, 144 + Math.sin(k * 1.7 + t * 1.3) * 80, r * 0.4, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = ad[1]; c.font = '900 64px "Hiragino Sans","Noto Sans JP",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.globalAlpha = Math.min(1, p * 5, (1 - p) * 5); c.fillText(ad[0], 256 + (1 - Math.min(1, p * 4)) * 200, 150); c.globalAlpha = 1;
      c.fillStyle = '#fff'; c.fillRect(0, 276, 512 * p, 12);
      tex.needsUpdate = true;
    }
    const h = game.hour, k = h > 18.4 || h < 6.4 ? 1.25 : 0.95; for (const m of S.mats) m.color.setScalar(k);
  });
  return <>{S.list.map((s, i) => <group key={i} position={[s.x, s.y, s.z]} rotation-y={s.ry}><mesh material={S.mats[i % 2]}><planeGeometry args={[s.w, s.h]} /></mesh><mesh position={[0, 0, -0.15]}><boxGeometry args={[s.w + 0.6, s.h + 0.6, 0.25]} /><meshStandardMaterial color="#15161a" /></mesh></group>)}</>;
}
void ROAD;
