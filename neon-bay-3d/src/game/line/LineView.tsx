import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { line, ANCHOR, legAt, zoneAt, stepLine, limitAt, nextStop } from './line';
import type { Zone } from './routes';
import { labelTexture } from '../world/textures';
import { game } from '../state/store';
import { trainInfo } from '../crime/japan';
import { tdt } from '../admin';

/**
 * The scenery of a trip between cities, drawn round the train as it runs (the train stays put, the land moves past):
 * 100 m chunks generated from the route data a few kilometres ahead, rebuilt as the window moves on. Towns, suburbs,
 * rice fields, wooded hills, the coast and lakes, tunnels through the mountains, river bridges, the stations it passes
 * (platforms with their name boards), castles by the line, catenary masts, and far peaks (Mt Fuji) drawn to scale.
 */
const C = 100, AHEAD = 4300, BEHIND = 400;
const X = new THREE.Object3D(), COL = new THREE.Color();
type Col = [number, number, number];
const GROUND: Record<Zone, Col> = { city: [0.4, 0.41, 0.43], suburb: [0.44, 0.46, 0.38], fields: [0.36, 0.5, 0.24], hills: [0.2, 0.33, 0.18], coast: [0.48, 0.48, 0.4] };
const BIG = ['東京', '品川', '新横浜', '名古屋', '新大阪', '京都', '博多', '広島', '岡山', '小倉', 'なんば', '鶴橋', '静岡', '浜松', '姫路'];
const hash = (a: number, b: number) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

interface Pool { mesh: THREE.InstancedMesh; n: number; max: number }
function pool(geo: THREE.BufferGeometry, mat: THREE.Material, max: number): Pool { const m = new THREE.InstancedMesh(geo, mat, max); m.count = 0; m.frustumCulled = false; m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3); return { mesh: m, n: 0, max }; }
/** A hillside dome beside the line: never reaches across the track (or over a tunnel bore). */
function hill(P: Pool, x: number, y: number, z: number, rx: number, ry: number, rz: number, c: Col) { put(P, x, y, z, Math.min(rx, Math.abs(x) - 12), ry, rz, c); }
function put(P: Pool, x: number, y: number, z: number, sx: number, sy: number, sz: number, c: Col, ry = 0) {
  if (P.n >= P.max) return; X.position.set(x, y, z); X.rotation.set(0, ry, 0); X.scale.set(sx, sy, sz); X.updateMatrix(); P.mesh.setMatrixAt(P.n, X.matrix); P.mesh.setColorAt(P.n, COL.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace)); P.n++;
}
const unitBox = () => { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); return g; };

export default function LineView() {
  const root = useRef<THREE.Group>(null!), moving = useRef<THREE.Group>(null!), fixed = useRef<THREE.Group>(null!);
  const R = useMemo(() => {
    const std = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05 });
    const glow = new THREE.MeshBasicMaterial({ toneMapped: false });
    const water = new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 0.1, color: '#ffffff' });
    const roofG = new THREE.ConeGeometry(0.75, 1, 4); roofG.rotateY(Math.PI / 4); roofG.translate(0, 0.5, 0);
    const treeG = mergeGeometries([new THREE.CylinderGeometry(0.12, 0.16, 1.2, 5).translate(0, 0.6, 0), new THREE.ConeGeometry(0.9, 2.6, 6).translate(0, 2.3, 0)])!;
    const hillG = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const mastG = mergeGeometries([new THREE.BoxGeometry(0.35, 7.6, 0.35).translate(0, 3.8, 0), new THREE.BoxGeometry(4.6, 0.25, 0.25).translate(-2.1, 7.2, 0)])!;
    const tubeG = mergeGeometries([new THREE.BoxGeometry(1.2, 8, 20).translate(-6.6, 4, 0), new THREE.BoxGeometry(1.2, 8, 20).translate(6.6, 4, 0), new THREE.BoxGeometry(14.4, 1.2, 20).translate(0, 8.4, 0)])!;
    const P = {
      ground: pool(unitBox(), std, 260), bldg: pool(unitBox(), std, 1600), roof: pool(roofG, std, 1100), tree: pool(treeG, std, 1800), hill: pool(hillG, std, 220),
      mast: pool(mastG, std, 220), tube: pool(tubeG, std, 260), lamp: pool(unitBox(), glow, 400), water: pool(unitBox(), water, 160), win: pool(unitBox(), glow, 900),
    };
    // the track bed, rails and the far ground stay with the train (they look the same all the way)
    const bed = new THREE.Mesh(new THREE.BoxGeometry(12, 1, AHEAD + 600).translate(0, 0.5, -(AHEAD + 600) / 2 + 300), new THREE.MeshStandardMaterial({ color: '#8d8a84', roughness: 0.95 }));
    const rails = new THREE.Mesh(mergeGeometries([-3.1, -1.6, 1.6, 3.1].map((x) => new THREE.BoxGeometry(0.12, 0.16, AHEAD + 600).translate(x, 1.08, -(AHEAD + 600) / 2 + 300)))!, new THREE.MeshStandardMaterial({ color: '#c9ccd2', metalness: 0.7, roughness: 0.35 }));
    const far = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2).translate(0, -0.08, -2500), new THREE.MeshStandardMaterial({ color: '#4d6a3a', roughness: 1 }));
    const wire = new THREE.Mesh(mergeGeometries([-2.3, 2.3].map((x) => new THREE.BoxGeometry(0.04, 0.04, AHEAD + 600).translate(x, 6.9, -(AHEAD + 600) / 2 + 300)))!, new THREE.MeshBasicMaterial({ color: '#333' }));
    // far peaks (to scale): a cone each, with a snow cap; not fogged so Mt Fuji stands out over the haze
    const peakMat = new THREE.MeshBasicMaterial({ color: '#6f8098', fog: false }), snowMat = new THREE.MeshBasicMaterial({ color: '#eef2f6', fog: false });
    return { P, std, bed, rails, far, wire, peakMat, snowMat, base: -1e9, signs: new Map<string, THREE.Texture>() };
  }, []);
  // the trains: a bullet train (8 cars, the nose in front) or a commuter train, seen from outside or the side windows
  const trains = useMemo(() => {
    const mk = (shin: boolean) => {
      const parts: THREE.BufferGeometry[] = [], col = (g: THREE.BufferGeometry, c: Col) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g.index ? g.toNonIndexed() : g; };
      const cars = shin ? 8 : 4, len = shin ? 25 : 20, body: Col = shin ? [0.95, 0.95, 0.96] : [0.75, 0.12, 0.14], band: Col = shin ? [0.1, 0.25, 0.65] : [0.95, 0.94, 0.9];
      for (let k = 0; k < cars; k++) {
        const z0 = k * (len + 0.6);
        parts.push(col(new THREE.BoxGeometry(3.3, 3.4, len).translate(0, 1.2 + 1.7, z0 + len / 2), body), col(new THREE.BoxGeometry(3.34, 0.35, len).translate(0, 2.0, z0 + len / 2), band), col(new THREE.BoxGeometry(3.36, 0.7, len - 2).translate(0, 3.2, z0 + len / 2), [0.15, 0.18, 0.22]));
      }
      const nose = new THREE.ConeGeometry(1.75, shin ? 14 : 2, 4, 1); nose.rotateX(-Math.PI / 2); nose.rotateZ(Math.PI / 4); nose.scale(1, 0.95, 1); nose.translate(0, 2.7, shin ? -7 : -1);
      parts.push(col(nose, body));
      const g = mergeGeometries(parts.map((p) => { for (const k of Object.keys(p.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') p.deleteAttribute(k); return p; }))!;
      return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.2 }));
    };
    return { shin: mk(true), local: mk(false) };
  }, []);
  const peaks = useRef<{ cone: THREE.Mesh; cap: THREE.Mesh }[]>([]);
  const signs = useRef<THREE.Mesh[]>([]);
  useEffect(() => () => { for (const p of Object.values(R.P)) p.mesh.dispose(); }, [R]);

  /** Rebuild every chunk in the window [base, base + BEHIND + AHEAD]. */
  const rebuild = (base: number) => {
    const P = R.P; for (const p of Object.values(P)) p.n = 0;
    const L = line, z = (s: number) => -(s - base);
    const signList: { name: string; s: number; side: number }[] = [];
    for (let s0 = base; s0 < base + BEHIND + AHEAD; s0 += C) {
      if (s0 < -2000 || s0 > L.L + 2000) continue;
      const ci = Math.floor(s0 / C), li = legAt(s0), g = L.legs[li], q0 = s0 - L.off[li], zn = zoneAt(s0), zc = z(s0 + C / 2);
      const shin = g.train === 'shin', r = (k: number) => hash(ci, k);
      const tun = g.tunnels.find((t) => q0 + C > t.a && q0 < t.b);
      const nearSt = L.stops.find((st) => Math.abs(st.s - (s0 + C / 2)) < 260);
      const big = nearSt ? BIG.includes(nearSt.name) : L.stops.some((st) => BIG.includes(st.name) && Math.abs(st.s - s0) < 7000);
      // tunnels: the bore (lit), the mountain over it (a wooded lid and ridges either side)
      if (tun && q0 + C / 2 > tun.a && q0 + C / 2 < tun.b) {
        for (let k = 0; k < 5; k++) { const zz = z(s0 + k * 20 + 10); put(P.tube, 0, 0, zz, 1, 1, 1, [0.32, 0.31, 0.3]); if (k % 2 === 0) for (const sd of [-1, 1]) put(P.lamp, sd * 5.9, 5.2, zz, 0.15, 0.25, 1.4, [1, 0.85, 0.6]); }
        if (q0 > tun.a + 20 && q0 + C < tun.b - 10) put(P.bldg, 0, 9, zc, 40, 34, C, [0.2, 0.32, 0.17]);
        for (const sd of [-1, 1]) hill(P.hill, sd * (70 + r(sd + 3) * 60), -10, zc, 110 + r(sd + 5) * 60, 55 + r(sd + 7) * 50, 90, [0.19, 0.31, 0.16]);
        continue;
      }
      // ground either side, coloured by what the line runs through; water beside the line (sea, lake)
      for (const sd of [-1, 1]) {
        const w = g.water.find((q) => q.side === sd && q0 + C > q.a && q0 < q.b);
        if (w) { put(P.ground, sd * 18, -0.2, zc, 24, 0.25, C, w.lake ? [0.4, 0.5, 0.32] : [0.78, 0.74, 0.6]); put(P.water, sd * 1530, -0.3, zc, 3000, 0.3, C, w.lake ? [0.16, 0.34, 0.42] : [0.1, 0.27, 0.42]); continue; }
        const gc = GROUND[zn], k = 0.92 + r(sd + 11) * 0.12; put(P.ground, sd * 606, -0.2, zc, 1200, 0.25, C, [gc[0] * k, gc[1] * k, gc[2] * k]);
      }
      // a river under a bridge
      const rv = g.rivers.find((q) => q.s >= q0 && q.s < q0 + C + q.w);
      if (rv) { const zs = z(L.off[li] + rv.s - rv.w / 2) - 0, ze = z(L.off[li] + rv.s + rv.w / 2); put(P.water, 0, 0, (zs + ze) / 2, 3000, 0.1, Math.abs(zs - ze), [0.2, 0.36, 0.42]);
        for (let k = 0; k < Math.ceil(rv.w / 40); k++) { const zz = zs - k * 40 - 20; if (zz < zc - C / 2 || zz > zc + C / 2) continue; for (const sd of [-1, 1]) put(P.bldg, sd * 6.4, 1.2, zz, 0.5, 4.2, 40, [0.55, 0.32, 0.25]); put(P.bldg, 0, -6, zz + 19, 3, 7, 2, [0.6, 0.6, 0.62]); } }
      const riverHere = !!rv;
      // catenary masts (bullet train: every 50 m), noise barriers through towns
      for (let k = 0; k < 2; k++) for (const sd of [-1, 1]) { const zz = z(s0 + k * 50); X.rotation.set(0, 0, 0); put(P.mast, sd * 7.2, 0, zz, sd, 1, 1, [0.55, 0.57, 0.6]); }
      if (shin && (zn === 'city' || zn === 'suburb') && !riverHere) for (const sd of [-1, 1]) put(P.bldg, sd * 6.6, 0.4, zc, 0.3, 2.4, C, [0.78, 0.79, 0.8]);
      // a station it passes: platforms, canopies, the name boards
      if (nearSt) {
        for (const sd of [-1, 1]) { put(P.bldg, sd * 11, 0, zc, 7, 2.2, C, [0.7, 0.7, 0.68]); put(P.bldg, sd * 11.5, 6.2, zc, 8, 0.4, C, [0.62, 0.66, 0.7]); for (const zz of [zc - 25, zc + 25]) put(P.bldg, sd * 13, 2.2, zz, 0.4, 4, 0.4, [0.5, 0.52, 0.55]); for (const zz of [zc - 30, zc, zc + 30]) put(P.win, sd * 11.5, 6.0, zz, 0.5, 0.08, 8, [1, 0.95, 0.85]); }
        if (Math.abs(nearSt.s - (s0 + C / 2)) < 60) for (const sd of [-1, 1]) signList.push({ name: nearSt.name, s: nearSt.s, side: sd });
      }
      // what stands either side
      for (const sd of [-1, 1]) {
        if (g.water.some((q) => q.side === sd && q0 + C > q.a && q0 < q.b)) continue;
        const x0 = nearSt ? 22 : zn === 'city' ? 12 : 18;
        if (zn === 'city') {
          const n = big ? 7 : 5;
          for (let k = 0; k < n; k++) { const x = sd * (x0 + 6 + r(k * 7 + sd) * 220), w = 12 + r(k * 7 + 2 + sd) * 24, d = 12 + r(k * 7 + 3) * 26, h = (big ? 14 + r(k * 7 + 4) ** 2 * 120 : 9 + r(k * 7 + 4) * 30) * (Math.abs(x) < 40 ? 0.5 : 1), zz = zc + (r(k * 7 + 5) - 0.5) * (C - d);
            if (riverHere) continue; const t = 0.5 + r(k * 7 + 6) * 0.4; put(P.bldg, x, 0, zz, w, h, d, [t, t * 1.01, t * 1.04]); if (h > 18) put(P.win, x - sd * (w / 2 + 0.05), h * 0.15, zz, 0.08, h * 0.7, d * 0.8, [0.5, 0.6, 0.7]); }
        } else if (zn === 'suburb' || zn === 'coast') {
          for (let k = 0; k < 8; k++) { if (riverHere) break; const x = sd * (x0 + 4 + r(k * 5 + sd + 20) * 150), zz = zc + (r(k * 5 + 21) - 0.5) * (C - 12), apt = r(k * 5 + 22) < 0.15, w = apt ? 22 : 8 + r(k * 5 + 23) * 3, h = apt ? 12 + r(k) * 8 : 5.5;
            const wc = 0.82 + r(k * 5 + 24) * 0.14; put(P.bldg, x, 0, zz, w, h, apt ? 11 : 8, [wc, wc * 0.97, wc * 0.92]); if (!apt) put(P.roof, x, h, zz, w * 1.1, 2.4, 9.6, [0.2 + r(k) * 0.12, 0.22, 0.26]); }
          for (let k = 0; k < 4; k++) put(P.tree, sd * (x0 + r(k + 40 + sd) * 140), 0, zc + (r(k + 44) - 0.5) * C, 2, 2 + r(k + 48), 2, [0.22, 0.4, 0.2]);
        } else if (zn === 'fields') {
          for (let k = 0; k < 3; k++) { const x = sd * (x0 + 20 + r(k + 60 + sd) * 300), w = 30 + r(k + 64) * 50; put(P.ground, x, -0.05, zc + (r(k + 66) - 0.5) * 40, w, 0.06, 36, [0.3 + r(k + 68) * 0.12, 0.52 + r(k + 69) * 0.1, 0.24]); }
          if (r(sd + 70) < 0.45) { const x = sd * (x0 + 30 + r(sd + 71) * 200), zz = zc + (r(sd + 72) - 0.5) * 60; put(P.bldg, x, 0, zz, 11, 5, 9, [0.86, 0.84, 0.78]); put(P.roof, x, 5, zz, 13, 3, 11, [0.24, 0.24, 0.26]); for (let k = 0; k < 3; k++) put(P.tree, x + sd * (8 + k * 3), 0, zz + k * 4, 2.4, 3, 2.4, [0.18, 0.34, 0.16]); }
          for (let k = 0; k < 3; k++) put(P.tree, sd * (x0 + 50 + r(k + 80 + sd) * 400), 0, zc + (r(k + 84) - 0.5) * C, 3, 3, 3, [0.2, 0.36, 0.18]);
        } else { // hills: woods and hillsides close to the line
          for (let k = 0; k < 14; k++) put(P.tree, sd * (x0 + r(k * 3 + 90 + sd) * 90), 0, zc + (r(k * 3 + 91) - 0.5) * C, 2.6, 2.4 + r(k * 3 + 92) * 1.6, 2.6, [0.14 + r(k) * 0.06, 0.3 + r(k + 1) * 0.08, 0.14]);
          if (ci % 2 === 0) hill(P.hill, sd * (90 + r(sd + 95) * 120), -8, zc, 70 + r(sd + 96) * 90, 40 + r(sd + 97) * 70, 120, [0.18, 0.3, 0.16]);
        }
        // hills on the horizon everywhere outside the cities
        const peakSide = g.peaks.some((q) => q.snow && Math.sign(q.off) === sd && Math.abs(q.s - q0) < 70000); // keep the view of a snow peak open
        if (zn !== 'city' && ci % 3 === 0 && !peakSide) hill(P.hill, sd * (700 + r(sd + 99) * 900), -20, zc, 300 + r(sd + 100) * 300, 50 + r(sd + 101) * 90, 260, [0.24, 0.33, 0.24]);
      }
      // castles by the line (white keep on a stone base)
      for (const cs of g.castles) if (cs.s >= q0 && cs.s < q0 + C) { const x = cs.side * 180, zz = z(L.off[li] + cs.s);
        put(P.bldg, x, 0, zz, 46, 12, 40, [0.5, 0.48, 0.45]); let y = 12; for (let k = 0; k < 5; k++) { const w = 28 - k * 4.4, h = 6; put(P.bldg, x, y, zz, w, h, w * 0.85, [0.95, 0.95, 0.93]); put(P.roof, x, y + h, zz, w * 1.25, 2.6, w * 1.05, [0.25, 0.3, 0.32]); y += h + 1.6; } }
    }
    for (const p of Object.values(P)) { p.mesh.count = p.n; p.mesh.instanceMatrix.needsUpdate = true; if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true; }
    // name boards of the station in view (both platforms, a few along each)
    for (const m of signs.current) m.visible = false;
    let si = 0;
    for (const sg of signList) for (const o of [-80, -30, 30, 80]) {
      let m = signs.current[si]; if (!m) { m = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshBasicMaterial({ toneMapped: false })); signs.current[si] = m; moving.current.add(m); }
      let t = R.signs.get(sg.name); if (!t) { t = labelTexture(sg.name + '  ' + (sg.name.endsWith('駅') ? '' : '駅'), '#2b6bff', 640, 160); R.signs.set(sg.name, t); }
      (m.material as THREE.MeshBasicMaterial).map = t; m.position.set(sg.side * 7.9, 3.2, z(sg.s + o)); m.rotation.set(0, sg.side > 0 ? -Math.PI / 2 : Math.PI / 2, 0); m.visible = true; si++;
    }
  };

  useFrame(({ camera, scene }, rawDt) => {
    const L = line; if (!L.on || !root.current) return;
    const dt = tdt(Math.min(rawDt, 0.1));
    if (L.mode === 'seat') stepLine(0, 0, dt);
    // the display in the cab: line speed, the next stop and how far
    { const ni = nextStop(), st = L.stops[ni]; trainInfo.on = L.mode === 'drive'; trainInfo.limit = Math.round(limitAt(L.s) * 3.6); trainInfo.atc = L.v * 3.6 > trainInfo.limit + 3; trainInfo.next = st ? st.name + (ni === L.stops.length - 1 ? '（終点）' : '（通過）') : ''; trainInfo.dist = st ? Math.max(0, Math.round(st.s - L.s)) : 0; }
    const base = Math.floor((L.s - BEHIND) / C) * C;
    if (base !== R.base) { R.base = base; rebuild(base); }
    root.current.position.set(ANCHOR.x, 0, ANCHOR.z);
    moving.current.position.set(0, 0, L.s - base);
    // far ground and fog follow what the line runs through
    const zn = zoneAt(L.s), gc = GROUND[zn]; (R.far.material as THREE.MeshStandardMaterial).color.setRGB(gc[0] * 0.95, gc[1] * 0.95, gc[2] * 0.95);
    if (scene.fog instanceof THREE.Fog) { scene.fog.far = Math.max(scene.fog.far, 2400 * (1 - 0.6 * L.tunnel)); scene.fog.near = Math.max(scene.fog.near, 300 * (1 - 0.6 * L.tunnel)); }
    // far peaks, scaled so they keep their true size in the view
    const legI = legAt(L.s), g = L.legs[legI];
    peaks.current.forEach((pk, i) => { const q = g.peaks[i]; pk.cone.visible = pk.cap.visible = false; if (!q) return;
      const dz = L.off[legI] + q.s - L.s, d = Math.hypot(q.off, dz); if (d > 150000 || L.tunnel > 0.5) return;
      const Rr = 2350, k = Rr / d; pk.cone.visible = true; pk.cone.position.set(q.off * k, -2, -dz * k); pk.cone.scale.set(q.r * 0.55 * k, q.h * 1.5 * k, q.r * 0.55 * k); // a little steeper than life, as the eye remembers it
      if (q.snow) { pk.cap.visible = true; pk.cap.position.copy(pk.cone.position); pk.cap.scale.copy(pk.cone.scale); } });
    // which train is drawn, and where the camera is
    const shin = g.train === 'shin', T = shin ? trains.shin : trains.local; trains.shin.visible = shin && L.view !== 0; trains.local.visible = !shin && L.view !== 0;
    if (L.view === 1 || L.view === 2) T.visible = false;
    const sway = Math.sin(performance.now() / 700) * 0.02 * Math.min(1, L.v / 60);
    camera.up.set(0, 1, 0);
    if (L.view === 0) { camera.position.set(ANCHOR.x + sway, 3.5, ANCHOR.z - (shin ? 6 : 0.5)); camera.lookAt(ANCHOR.x, 2.6, ANCHOR.z - 200); }
    else if (L.view === 1 || L.view === 2) { const sd = L.view === 1 ? 1 : -1; camera.position.set(ANCHOR.x + sd * 1.2, 2.9 + sway, ANCHOR.z + 40); camera.lookAt(ANCHOR.x + sd * 100, 2.2, ANCHOR.z - 40); }
    else { const t = performance.now() / 9000; camera.position.set(ANCHOR.x - 5 + Math.sin(t) * 2, 19, ANCHOR.z - 75); camera.lookAt(ANCHOR.x, 2, ANCHOR.z + 45); } // above the line, ahead of the nose, looking back along the train
    game.player.x = ANCHOR.x; game.player.z = ANCHOR.z + 20; game.player.y = 1;
  });

  // peak meshes for the current route (cones with snow caps)
  const peakNodes = useMemo(() => {
    const out: { cone: THREE.Mesh; cap: THREE.Mesh }[] = [];
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 24, 1).translate(0, 0.5, 0), R.peakMat);
      const capG = new THREE.ConeGeometry(0.28, 0.28, 24, 1).translate(0, 0.86, 0); const cap = new THREE.Mesh(capG, R.snowMat);
      out.push({ cone, cap });
    }
    peaks.current = out; return out;
  }, [R]);

  return (
    <group ref={root}>
      <group ref={fixed}>
        <primitive object={R.bed} /><primitive object={R.rails} /><primitive object={R.far} /><primitive object={R.wire} />
        <primitive object={trains.shin} /><primitive object={trains.local} />
        {peakNodes.map((p, i) => <group key={i}><primitive object={p.cone} /><primitive object={p.cap} /></group>)}
      </group>
      <group ref={moving}>
        {Object.values(R.P).map((p, i) => <primitive key={i} object={p.mesh} />)}
      </group>
    </group>
  );
}
