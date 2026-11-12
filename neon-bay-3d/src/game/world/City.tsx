import { useEffect, useMemo, useReducer, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Geo } from './geo';
import { getTextures, labelTexture } from './textures';
import { mulberry } from './rng';
import {
  blocks, buildings, props, doors, topFoot, Building, BType, N, ROAD, PITCH, HALF, CITY, HWY_C, HWY_W, roadC, LAND, PORT, AIRPORT, BEACH_X, heightAt, WATER_Y, PIER, HWY_LINKS, O, CANAL_RECTS, PROM, CANAL_BLOCKS, SHORE, segOpen, nodeOpen, inBay, TUN, chamCut, LANES, LANE_W, BRIDGES, FB, ROTARY,
} from './cityGen';
import { REGION } from './region';
import { game } from '../state/store';
import { BDOORS, BDoor } from './bldgInteriors';
import { buildDetail, disposeDetail } from './Detail';
import { blockOfB } from './cityGen';

/** Road marking 止まれ ("stop"): white characters stretched along the lane, transparent around them. */
function tomareTexture() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512; const c = cv.getContext('2d')!;
  c.fillStyle = '#f2f2ee'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '900 84px "Hiragino Sans","Noto Sans JP",sans-serif';
  c.setTransform(1, 0, 0, 5.2, 0, 0); c.fillText('止まれ', 128, 512 / 5.2 / 2 + 2);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/* Materials whose emissive brightness follows the time of day. */
export const nightMats: { m: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial; k: number; kind: 'emissive' | 'opacity' }[] = [];

function useMaterials() {
  return useMemo(() => {
    const T = getTextures();
    const fac = (s: typeof T.glass, metal: number, k = 1.1) => {
      const m = new THREE.MeshStandardMaterial({ map: s.map, emissiveMap: s.emissive, roughnessMap: s.rough, normalMap: s.normal, normalScale: new THREE.Vector2(1.1, 1.1), emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0, roughness: 1, metalness: metal, vertexColors: true, envMapIntensity: 1.35 });
      nightMats.push({ m, k, kind: 'emissive' }); return m;
    };
    const rep = (t: THREE.Texture) => t;
    const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    const lampHead = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: new THREE.Color('#ffd79a'), emissiveIntensity: 0.2 });
    nightMats.push({ m: lampHead, k: 3, kind: 'emissive' });
    const pool = new THREE.MeshBasicMaterial({ map: T.glow, color: '#ffcf8a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    nightMats.push({ m: pool, k: 0.55, kind: 'opacity' });
    return {
      curtain: fac(T.curtain, 0.62, 0.85), ribbon: fac(T.ribbon, 0.15, 0.75), fin: fac(T.fin, 0.4, 0.85), podium: fac(T.podium, 0.05, 1.1),
      crown: (() => { const m = new THREE.MeshStandardMaterial({ color: '#d9e1ea', emissive: new THREE.Color('#d6ecff'), emissiveIntensity: 0, roughness: 0.4, metalness: 0.3 }); nightMats.push({ m, k: 2.6, kind: 'emissive' }); return m; })(),
      glass: fac(T.glass, 0.55), office: fac(T.office, 0.1), brick: fac(T.brick, 0.02), shop: fac(T.shop, 0.05, 1.3), house: fac(T.house, 0.02, 0.9), machiya: fac(T.machiya, 0.02, 0.8), okinawa: fac(T.okinawa, 0.02, 0.9), warehouse: fac(T.warehouse, 0.3, 0.6), terminal: fac(T.terminal, 0.5), hangar: fac(T.warehouse, 0.35, 0.4),
      roof: std({ map: rep(T.roof), vertexColors: true, roughness: 0.95 }),
      tiles: std({ map: T.tiles, vertexColors: true, roughness: 0.75 }),
      misc: std({ vertexColors: true, roughness: 0.7, metalness: 0.15 }),
      metal: std({ vertexColors: true, roughness: 0.35, metalness: 0.7 }),
      glow: glowMat, lampHead, pool,
      asphalt: wetReg(std({ map: T.asphalt, roughness: 0.92, color: '#ffffff' })),
      sidewalk: wetReg(std({ map: T.sidewalk, roughness: 0.9 })),
      grass: std({ map: T.grass, roughness: 1 }),
      sand: std({ map: T.sand, roughness: 1 }),
      concrete: std({ map: T.concrete, roughness: 0.85 }),
      dirt: std({ map: T.dirt, roughness: 1, vertexColors: true }),
      paint: std({ vertexColors: true, roughness: 0.6 }),
      tomare: std({ map: tomareTexture(), transparent: true, alphaTest: 0.35, roughness: 0.6, depthWrite: false }),
      water: std({ color: '#1d5f7a', roughness: 0.12, metalness: 0.25, normalMap: T.waterN, normalScale: new THREE.Vector2(0.28, 0.28), transparent: true, opacity: 0.93, envMapIntensity: 1.5 }),
    };
  }, []);
}
type Mats = ReturnType<typeof useMaterials>;

const FAC_SET = (t: BType | 'machiya' | 'okinawa' | 'curtain' | 'ribbon' | 'fin' | 'podium') => { const T = getTextures(); return ({ glass: T.glass, office: T.office, brick: T.brick, shop: T.shop, house: T.house, machiya: T.machiya, okinawa: T.okinawa, warehouse: T.warehouse, terminal: T.terminal, hangar: T.warehouse, curtain: T.curtain, ribbon: T.ribbon, fin: T.fin, podium: T.podium } as const)[t]; };

/* ---------- chunked buildings with two LOD levels ---------- */
const CH = 300;
/* Streaming: only the chunks around the camera exist. Detail levels by distance from the chunk centre:
   HI (facade trim, rooftops) < HI_R, LO (plain boxes) < LO_R (the fog is opaque at 1500 m), road paint / props / signs < NEAR_R. */
const HI_R = 640, LO_R = 1350, NEAR_R = 600, HYST = 150, SHOW_HI = 500;
export const cityStream = { pending: 1, built: 0, live: 0, ms: 0 };
interface Cell { key: string; cx: number; cz: number; x: number; z: number; items: Building[]; doors: BDoor[]; paint: boolean; props: boolean }
interface Live { hi?: Built; lo?: Built; paint?: Built; detail?: THREE.InstancedMesh[]; near: boolean }
/** Real 3D facade trim built into the chunk meshes: cornices, floor bands, plinths, glass fins, crowns, balconies. */
function archTrim(b: Building, F: { su: number; sv: number; cols: number; rows: number }, mainTop: number, m: Geo, metal: Geo, r: () => number, tall: boolean) {
  const t = b.type, w = F.su / F.cols, rh = F.sv / F.rows, x0 = b.x0, x1 = b.x1, z0 = b.z0, z1 = b.z1, top = b.y0 + b.h;
  const ring = (g: Geo, y0: number, y1: number, p: number, d: number, c: number[]) => { // four trim boxes around the footprint
    g.solid(x0 - p, y0, z0 - p, x1 + p, y1, z0 + d, c); g.solid(x0 - p, y0, z1 - d, x1 + p, y1, z1 + p, c);
    g.solid(x0 - p, y0, z0 + d, x0 + d, y1, z1 - d, c); g.solid(x1 - d, y0, z0 + d, x1 + p, y1, z1 - d, c);
  };
  const lite = [Math.min(1, b.tint[0] * 0.25 + 0.72), Math.min(1, b.tint[1] * 0.25 + 0.7), Math.min(1, b.tint[2] * 0.25 + 0.66)];
  if (t === 'office' || t === 'brick' || t === 'shop') {
    const stone = t === 'brick' ? [0.86, 0.82, 0.75] : lite;
    ring(m, mainTop - 0.7, mainTop + 0.1, 0.5, 0.4, stone); // cornice
    ring(m, b.y0, b.y0 + 0.9, 0.14, 0.2, [stone[0] * 0.6, stone[1] * 0.6, stone[2] * 0.6]); // plinth
    const every = t === 'brick' ? 2 : 3;
    if (b.h > 12 && b.fac !== 'ribbon') for (let k = every; b.y0 + k * rh < mainTop - 2; k += every) { const y = b.y0 + k * rh; ring(m, y - 0.12, y + 0.12, 0.18, 0.2, stone); }
    if (tall) ring(m, top - 0.6, top + 0.1, 0.4, 0.3, stone);
  }
  if (t === 'glass') {
    const fin = [0.7, 0.74, 0.8], pd = 0.55;
    if (!b.fac) for (let x = Math.ceil(x0 / (w * 2)) * w * 2; x < x1 - 0.5; x += w * 2) { if (x < x0 + 0.5) continue; metal.solid(x - 0.13, b.y0, z0 - pd, x + 0.13, mainTop, z0, fin); metal.solid(x - 0.13, b.y0, z1, x + 0.13, mainTop, z1 + pd, fin); }
    if (!b.fac) for (let z = Math.ceil(z0 / (w * 2)) * w * 2; z < z1 - 0.5; z += w * 2) { if (z < z0 + 0.5) continue; metal.solid(x0 - pd, b.y0, z - 0.13, x0, mainTop, z + 0.13, fin); metal.solid(x1, b.y0, z - 0.13, x1 + pd, mainTop, z + 0.13, fin); }
    ring(metal, b.y0, b.y0 + 4.5, 0.3, 0.3, [0.32, 0.34, 0.38]); // dark lobby band
    if (b.h > 120) { // open crown frame on the top tier
      const ix = (x1 - x0) * 0.26, iz = (z1 - z0) * 0.26, a0 = x0 + ix, a1 = x1 - ix, c0 = z0 + iz, c1 = z1 - iz, y = top;
      metal.solid(a0, y, c0, a1, y + 0.5, c0 + 0.4, fin); metal.solid(a0, y, c1 - 0.4, a1, y + 0.5, c1, fin); metal.solid(a0, y, c0, a0 + 0.4, y + 0.5, c1, fin); metal.solid(a1 - 0.4, y, c0, a1, y + 0.5, c1, fin);
      for (const [px, pz] of [[a0, c0], [a1, c0], [a0, c1], [a1, c1]]) metal.solid(px - 0.25, y, pz - 0.25, px + 0.25, y + 7, pz + 0.25, fin);
      metal.solid(a0, y + 6.6, c0, a1, y + 7.1, c0 + 0.35, fin); metal.solid(a0, y + 6.6, c1 - 0.35, a1, y + 7.1, c1, fin);
    }
  }
  // balconies on brick apartment blocks: slab + railing under every other window, on the two long faces
  if (t === 'brick' && b.h <= 34 && r() < 0.85) {
    const rail = [0.22, 0.23, 0.26], slab = [0.8, 0.78, 0.74], dep = 1.15, along = x1 - x0 >= z1 - z0;
    for (let k = 1; b.y0 + k * rh < mainTop - 1.5; k++) {
      const y = b.y0 + k * rh;
      if (along) for (let x = (Math.ceil(x0 / w - 0.5) + 0.5) * w; x < x1 - w * 0.5; x += w * 2) { if (x < x0 + w * 0.5) continue; for (const [za, zb] of [[z0 - dep, z0], [z1, z1 + dep]]) { m.solid(x - 1.25, y - 0.14, za, x + 1.25, y, zb, slab); const zf = za < z0 ? za : zb - 0.06; metal.solid(x - 1.25, y, zf, x + 1.25, y + 1.0, zf + 0.06, rail); } }
      else for (let z = (Math.ceil(z0 / w - 0.5) + 0.5) * w; z < z1 - w * 0.5; z += w * 2) { if (z < z0 + w * 0.5) continue; for (const [xa, xb] of [[x0 - dep, x0], [x1, x1 + dep]]) { m.solid(xa, y - 0.14, z - 1.25, xb, y, z + 1.25, slab); const xf = xa < x0 ? xa : xb - 0.06; metal.solid(xf, y, z - 1.25, xf + 0.06, y + 1.0, z + 1.25, rail); } }
    }
  }
}

/* ---------- shaped towers: round, chamfered, and the spiral landmark ---------- */
/** Plan outline of a shaped tower, scaled by s about its centre. */
function planOf(b: Building, s: number, segs: number): number[][] {
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, hx = ((b.x1 - b.x0) / 2) * s, hz = ((b.z1 - b.z0) / 2) * s;
  if (b.shape === 'cham') { const c = chamCut(b) * s; return [[cx - hx + c, cz - hz], [cx + hx - c, cz - hz], [cx + hx, cz - hz + c], [cx + hx, cz + hz - c], [cx + hx - c, cz + hz], [cx - hx + c, cz + hz], [cx - hx, cz + hz - c], [cx - hx, cz - hz + c]]; }
  const R = Math.min(hx, hz), out: number[][] = []; for (let i = 0; i < segs; i++) { const a = (i / segs) * Math.PI * 2; out.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R]); } return out;
}
/** Up-facing quad from four points in any winding. */
function upQuad(G: Geo, a: number[], b: number[], c: number[], d: number[], col: number[]) {
  const up = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]) > 0, T = (p: number[]) => [p[0] / 4, -p[2] / 4];
  if (up) G.quad(a, b, c, d, [0, 1, 0], [T(a), T(b), T(c), T(d)], col); else G.quad(a, d, c, b, [0, 1, 0], [T(a), T(d), T(c), T(b)], col);
}
/** Rooftop heliport marking (the emergency landing pads on Japanese high-rises): a yellow ring and a white H. */
function helipad(G: Geo, cx: number, cz: number, y: number, R: number) {
  const Y = y + 0.04, n = 28, w = Math.max(0.5, R * 0.07), Ycol = [0.95, 0.78, 0.12], Wcol = [0.95, 0.95, 0.95];
  for (let i = 0; i < n; i++) { const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, p = (a: number, r: number) => [cx + Math.cos(a) * r, Y, cz + Math.sin(a) * r]; upQuad(G, p(a0, R - w), p(a0, R), p(a1, R), p(a1, R - w), Ycol); }
  const h = R * 0.5, bw = R * 0.1;
  G.flat(cx - h * 0.6 - bw / 2, cz - h, cx - h * 0.6 + bw / 2, cz + h, Y, Wcol); G.flat(cx + h * 0.6 - bw / 2, cz - h, cx + h * 0.6 + bw / 2, cz + h, Y, Wcol); G.flat(cx - h * 0.6, cz - bw / 2, cx + h * 0.6, cz + bw / 2, Y, Wcol);
}
/** The twisting landmark tower: an elliptical plan turning and tapering as it rises, three white ribs, a spire. */
function spiralTower(b: Building, F: { su: number; sv: number }, key: string, g: (k: string) => Geo, hi: boolean) {
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, R = Math.min(b.x1 - b.x0, b.z1 - b.z0) / 2, H = b.h, segs = hi ? 24 : 14, nk = hi ? Math.max(8, Math.round(H / 7)) : Math.max(5, Math.round(H / 16));
  const ring = (t: number) => { const sc = 1 - 0.8 * Math.pow(t, 1.45), th = t * 1.9, rx = R * sc, rz = R * sc * 0.62, c = Math.cos(th), s = Math.sin(th), y = b.y0 + t * H, pts: number[][] = [], nor: number[][] = [];
    for (let i = 0; i < segs; i++) { const a = (i / segs) * Math.PI * 2, lx = Math.cos(a) * rx, lz = Math.sin(a) * rz, nx0 = Math.cos(a) / rx, nz0 = Math.sin(a) / rz, L = Math.hypot(nx0, nz0); pts.push([cx + lx * c - lz * s, y, cz + lx * s + lz * c]); nor.push([(nx0 * c - nz0 * s) / L, 0.15, (nx0 * s + nz0 * c) / L]); }
    return { pts, nor, per: Math.PI * (rx + rz) };
  };
  const wall = g(key), M = g('metal'), RIB = [0.93, 0.94, 0.96];
  let prev = ring(0);
  for (let k = 1; k <= nk; k++) {
    const cur = ring(k / nk);
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % segs, u0 = (i / segs) * prev.per / F.su, u1 = ((i + 1) / segs) * prev.per / F.su, v0 = (prev.pts[0][1] - b.y0) / F.sv, v1 = (cur.pts[0][1] - b.y0) / F.sv;
      wall.quadN(prev.pts[j], prev.pts[i], cur.pts[i], cur.pts[j], prev.nor[j], prev.nor[i], cur.nor[i], cur.nor[j], [[u1, v0], [u0, v0], [u0, v1], [u1, v1]], b.tint);
      if (hi && i % (segs / 3) === 0) { // a rib standing out of the glass, both sides
        const o = (p: number[], n: number[], d: number) => [p[0] + n[0] * d, p[1], p[2] + n[2] * d];
        const a0 = prev.pts[i], a1 = cur.pts[i], n0 = prev.nor[i], n1 = cur.nor[i];
        M.quad(a0, o(a0, n0, 1.1), o(a1, n1, 1.1), a1, [n0[2], 0, -n0[0]], [[0, 0], [1, 0], [1, 1], [0, 1]], RIB); M.quad(a0, a1, o(a1, n1, 1.1), o(a0, n0, 1.1), [-n0[2], 0, n0[0]], [[0, 0], [0, 1], [1, 1], [1, 0]], RIB);
      }
    }
    prev = cur;
  }
  const apex = [cx, b.y0 + H + 32, cz];
  for (let i = 0; i < segs; i++) { const j = (i + 1) % segs; M.tri(prev.pts[j], prev.pts[i], apex, prev.nor[i], [[0, 0], [1, 0], [0.5, 1]], [0.82, 0.86, 0.9]); }
  if (hi) { M.extrude(planOf({ ...b, shape: 'round', x0: cx - R * 1.15, x1: cx + R * 1.15, z0: cz - R * 1.15, z1: cz + R * 1.15 } as Building, 1, 24), b.y0, b.y0 + 6, [0.3, 0.33, 0.37], 4, 4, g('roof'), true); } // the glass entrance hall round its foot
}
/** Round and chamfered towers: walls round the plan, a set-back top on tall chamfered ones, crown cladding, a lit crown line, a heliport. */
function shapedTower(b: Building, F: { su: number; sv: number; rows: number }, key: string, g: (k: string) => Geo, hi: boolean, r: () => number) {
  if (b.shape === 'spiral') { spiralTower(b, F, key, g, hi); return; }
  const top = b.y0 + b.h, wall = g(key), rh = F.sv / F.rows, snap = (y: number) => b.y0 + Math.round((y - b.y0) / rh) * rh, round = b.shape === 'round', segs = hi ? 28 : 16;
  const tall = !round && b.h > 90, t1 = tall ? snap(top - b.h * 0.22) : top, sTop = tall ? 0.8 : 1;
  wall.extrude(planOf(b, 1, segs), b.y0, t1, b.tint, F.su, F.sv, g('roof'), round, b.y0);
  if (tall) wall.extrude(planOf(b, sTop, segs), t1, top, b.tint, F.su, F.sv, g('roof'), round, b.y0);
  if (!hi) return;
  const M = g('metal');
  if (b.y0 < 1) M.extrude(planOf(b, 1.012, segs), b.y0, b.y0 + 5, [0.24, 0.26, 0.3], 4, 4, null, round); // the lobby glass at street level
  else M.extrude(planOf(b, 1.012, segs), b.y0, b.y0 + 1.2, [0.7, 0.72, 0.75], 4, 4, null, round); // where the tower meets its podium
  M.extrude(planOf(b, sTop * 1.012, segs), top - 2.6, top + 0.05, [0.8, 0.82, 0.86], 4, 4, null, round); // crown cladding
  g('crown').extrude(planOf(b, sTop * 1.016, segs), top - 3.4, top - 2.75, [1, 1, 1], 4, 4, null, round); // lit crown line at night
  if (tall) M.extrude(planOf(b, 1.012, segs), t1 - 1.2, t1 + 0.05, [0.8, 0.82, 0.86], 4, 4, null, false);
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, R = (Math.min(b.x1 - b.x0, b.z1 - b.z0) / 2) * sTop;
  if (b.h >= 100 && R > 11) helipad(g('paint'), cx, cz, top, R * 0.6);
  else if (R > 8) { const s = R * 0.45; g('misc').box(cx - s, top, cz - s * 0.7, cx + s, top + 4 + r() * 2, cz + s * 0.7, [0.55, 0.57, 0.6]); } // plant room
}

const seedOf = (b: Building) => ((Math.floor(b.x0 * 7.31) * 73856093) ^ (Math.floor(b.z0 * 13.7) * 19349663)) >>> 0;
type Built = { k: string; geo: THREE.BufferGeometry }[];
/** Geometry of one chunk's buildings at one level of detail (hi: facade trim and rooftop clutter). */
function buildChunkLevel(list: Building[], hi: boolean): Built {
  const rec: Record<string, Geo> = {}, g = (k: string) => (rec[k] ||= new Geo());
  for (const b of list) {
    const r = mulberry(seedOf(b));
    const key = b.fac || b.style || b.type, F = FAC_SET(key), top = b.y0 + b.h, col = b.tint;
    {
      const wall = g(key);
      if (b.gable) {
        wall.box(b.x0, b.y0, b.z0, b.x1, top, b.z1, col, F.su, F.sv, null, 8, true, b.y0);
        const span = Math.min(b.x1 - b.x0, b.z1 - b.z0), rt = b.roofTint || [0.3, 0.32, 0.35];
        if (b.roof === 'hip') g('tiles').hip(b.x0, b.z0, b.x1, b.z1, top, span * (b.style === 'okinawa' ? 0.2 : 0.24), rt, b.style === 'okinawa' ? 0.5 : 0.7);
        else g('tiles').gable(b.x0, b.z0, b.x1, b.z1, top, Math.min(3.2, span * (b.style === 'machiya' ? 0.22 : 0.3)), rt, wall, col);
        if (hi) {
          const m = g('misc'), mt = g('metal'), bk = blockOfB(b), south = !!bk && bk.z1 - b.z1 < b.z0 - bk.z0, fz = south ? b.z1 : b.z0, out = south ? 1 : -1;
          const slab = (x0: number, x1: number, y0: number, y1: number, d: number, c: number[], G = m) => G.solid(x0, y0, Math.min(fz, fz + out * d), x1, y1, Math.max(fz, fz + out * d), c);
          if (b.style === 'machiya') { // timber townhouse: a tiled eave all along the ground floor, a sliding door, a hanging sign
            slab(b.x0 - 0.05, b.x1 + 0.05, b.y0 + 2.7, b.y0 + 2.9, 0.95, rt);
            slab((b.x0 + b.x1) / 2 - 0.9, (b.x0 + b.x1) / 2 + 0.9, b.y0, b.y0 + 2.2, 0.06, [0.22, 0.16, 0.12]);
            if (r() < 0.25) slab((b.x0 + b.x1) / 2 + 1.2, (b.x0 + b.x1) / 2 + 1.35, b.y0 + 1.5, b.y0 + 2.6, 0.5, [0.85, 0.2, 0.15]); // noren / lantern sign
          } else if (b.style === 'okinawa') { // low red-tiled house: a deep veranda eave, a stone shisa plinth on the ridge is placed by the generator
            slab(b.x0 + 0.4, b.x1 - 0.4, b.y0 + 2.45, b.y0 + 2.6, 1.4, rt);
            for (const x of [b.x0 + 0.6, b.x1 - 0.6]) slab(x - 0.12, x + 0.12, b.y0, b.y0 + 2.45, 1.3, [0.5, 0.36, 0.24]);
          } else { // modern two-storey house: door with a canopy, an eave over the ground-floor windows, a balcony with a laundry pole, AC unit
            const cx = (b.x0 + b.x1) / 2, bw = (b.x1 - b.x0) * 0.32, by = b.y0 + 3.05, bx = b.x0 + (b.x1 - b.x0) * (r() < 0.5 ? 0.3 : 0.7), dx = cx + (bx > cx ? -2.2 : 2.2);
            slab(dx - 0.6, dx + 0.6, b.y0, b.y0 + 2.1, 0.08, [0.35, 0.26, 0.2]);
            slab(dx - 1.0, dx + 1.0, b.y0 + 2.3, b.y0 + 2.42, 1.1, [0.85, 0.85, 0.86]);
            slab(bx - bw - 0.3, bx + bw + 0.3, b.y0 + 2.5, b.y0 + 2.62, 0.55, [0.32, 0.33, 0.36]);
            slab(bx - bw, bx + bw, by - 0.14, by, 1.0, [0.82, 0.8, 0.76]);
            mt.solid(bx - bw, by, Math.min(fz + out * 1.0, fz + out * 0.94), bx + bw, by + 1.0, Math.max(fz + out * 1.0, fz + out * 0.94), [0.55, 0.57, 0.6]);
            for (const sx of [bx - bw, bx + bw]) mt.solid(sx - 0.03, by, Math.min(fz, fz + out), sx + 0.03, by + 1.0, Math.max(fz, fz + out), [0.55, 0.57, 0.6]);
            mt.solid(bx - bw + 0.3, by + 1.32, Math.min(fz + out * 0.62, fz + out * 0.7), bx + bw - 0.3, by + 1.37, Math.max(fz + out * 0.62, fz + out * 0.7), [0.8, 0.82, 0.85]); // laundry pole
            const az = b.z0 + 1.5 + r() * Math.max(0.5, b.z1 - b.z0 - 3.5); m.solid(b.x1, b.y0, az, b.x1 + 0.32, b.y0 + 0.62, az + 0.82, [0.9, 0.9, 0.88]);
            if (b.carport) { const x0 = b.x1 + 0.8, x1 = x0 + 3.2, z0 = Math.min(fz, fz + out * 5.4), z1 = Math.max(fz, fz + out * 5.4) ; for (const [px, pz] of [[x1, z0], [x1, z1]]) m.solid(px - 0.08, b.y0, pz - 0.08, px + 0.08, b.y0 + 2.4, pz + 0.08, [0.75, 0.75, 0.78]); mt.solid(x0 - 0.2, b.y0 + 2.4, z0, x1 + 0.2, b.y0 + 2.5, z1, [0.7, 0.74, 0.78]); }
          }
        }
        continue;
      }
      if (b.shape) { shapedTower(b, F, key, g, hi, r); continue; }
      // setbacks: tall glass towers step in twice, tall offices once (snapped to whole floors so windows line up)
      const rh = F.sv / F.rows, snap = (y: number) => b.y0 + Math.round((y - b.y0) / rh) * rh;
      const tall = (b.type === 'glass' && b.h > 90) || (b.type === 'office' && b.h > 42);
      const t1 = tall ? snap(top - b.h * (b.type === 'glass' ? 0.3 : 0.2)) : top, t2 = b.type === 'glass' && b.h > 140 ? snap(top - b.h * 0.12) : top;
      wall.box(b.x0, b.y0, b.z0, b.x1, t1, b.z1, col, F.su, F.sv, g('roof'), 8, true, b.y0);
      if (tall) { const ix = (b.x1 - b.x0) * 0.13, iz = (b.z1 - b.z0) * 0.13; wall.box(b.x0 + ix, t1, b.z0 + iz, b.x1 - ix, t2, b.z1 - iz, col, F.su, F.sv, g('roof'), 8, true, b.y0); if (t2 < top) { const jx = (b.x1 - b.x0) * 0.26, jz = (b.z1 - b.z0) * 0.26; wall.box(b.x0 + jx, t2, b.z0 + jz, b.x1 - jx, top, b.z1 - jz, col, F.su, F.sv, g('roof'), 8, true, b.y0); } }
      if (hi) archTrim(b, F, t1, g('misc'), g('metal'), r, tall);
      if (hi && b.fac && b.fac !== 'podium' && b.h > 60) { const T = topFoot(b); g('crown').box(T.x0 - 0.12, top - 3.4, T.z0 - 0.12, T.x1 + 0.12, top - 2.75, T.z1 + 0.12, [1, 1, 1], 4, 4, null); }
      if (!hi) continue;
      const m = g('misc'), cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, tf = topFoot(b);
      // rooftop machinery (on the top tier)
      if (b.type !== 'terminal' && b.type !== 'hangar' && !b.up && tf.x1 - tf.x0 > 10 && tf.z1 - tf.z0 > 8) for (let n = 0; n < 2 + Math.floor(r() * 3); n++) { const ax = tf.x0 + 3 + r() * (tf.x1 - tf.x0 - 9), az = tf.z0 + 3 + r() * (tf.z1 - tf.z0 - 7); m.box(ax, top, az, ax + 3 + r() * 3, top + 1.5 + r() * 1.5, az + 2 + r() * 2, [0.55, 0.56, 0.6]); }
      if (b.style === 'okinawa') { const tx = b.x0 + 2.2, tz = b.z1 - 2.2; m.box(tx - 0.6, top, tz - 0.6, tx + 0.6, top + 0.7, tz + 0.6, [0.6, 0.6, 0.6]); g('metal').box(tx - 0.75, top + 0.7, tz - 0.75, tx + 0.75, top + 2.0, tz + 0.75, [0.1, 0.1, 0.12]); }
      if (b.type === 'glass' && b.h > 70) { g('metal').box(cx - 0.3, top, cz - 0.3, cx + 0.3, top + 14, cz + 0.3, [0.7, 0.7, 0.75]); g('glow').box(cx - 0.6, top + 14, cz - 0.6, cx + 0.6, top + 15, cz + 0.6, [1, 0.15, 0.15]); }
      if (b.type === 'brick' && r() < 0.5) { const tx = b.x1 - 6, tz = b.z1 - 6; for (const [ox, oz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) m.box(tx + ox - 0.15, top, tz + oz - 0.15, tx + ox + 0.15, top + 3, tz + oz + 0.15, [0.3, 0.25, 0.2]); m.box(tx - 2, top + 3, tz - 2, tx + 2, top + 6.5, tz + 2, [0.5, 0.38, 0.28]); }
      // (shops carry the sign of their business over the door: see Detail.tsx)
      if (b.type === 'warehouse') for (let n = 0; n < 3; n++) { const dx = b.x0 + 6 + n * ((b.x1 - b.x0 - 12) / 2.5); m.box(dx, b.y0, b.z1, dx + 6, b.y0 + 5, b.z1 + 0.1, [0.25, 0.27, 0.3]); }
    }
  }
  return Object.entries(rec).filter(([, x]) => !x.empty).map(([k, x]) => ({ k, geo: x.build() }));
}
const disposeBuilt = (b?: Built) => { if (b) for (const x of b) x.geo.dispose(); };
function BuiltMeshes({ built, mats, shadows }: { built: Built; mats: Mats; shadows: boolean }) {
  useEffect(() => () => disposeBuilt(built), [built]);
  return <>{built.map(({ k, geo }) => <mesh key={k} geometry={geo} material={(mats as any)[k] || mats.misc} castShadow={shadows && k !== 'glow'} receiveShadow />)}</>;
}

/* ---------- instanced props ---------- */
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const m_dispose = (m: THREE.InstancedMesh) => m.dispose();
function Inst({ geo, mat, items, colors, shadow = false }: { geo: THREE.BufferGeometry; mat: THREE.Material; items: { x: number; y?: number; z: number; a?: number; s?: number }[]; colors?: number[][]; shadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
    items.forEach((it, i) => { tmpQ.setFromAxisAngle(UP, it.a || 0); tmpS.setScalar(it.s || 1); tmpP.set(it.x, it.y || 0, it.z); tmpM.compose(tmpP, tmpQ, tmpS); m.setMatrixAt(i, tmpM); if (colors) m.setColorAt(i, new THREE.Color(colors[i][0], colors[i][1], colors[i][2])); });
    m.count = items.length; m.castShadow = shadow; m.receiveShadow = true; m.computeBoundingSphere();
    return m;
  }, [geo, mat, items, colors, shadow]);
  useEffect(() => () => m_dispose(mesh), [mesh]);
  if (!items.length) return null;
  return <primitive object={mesh} ref={ref} />;
}

function usePropGeos() {
  return useMemo(() => {
    const merge = (parts: THREE.BufferGeometry[]) => { const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false)!; g.computeBoundingSphere(); return g; };
    const tr = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, rz = 0) => { g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); return g; };
    const lampPole = merge([tr(new THREE.CylinderGeometry(0.09, 0.13, 7.5, 6), 0, 3.75, 0), tr(new THREE.BoxGeometry(0.1, 0.1, 2.2), 0, 7.4, 1.05)]);
    const lampHead = tr(new THREE.BoxGeometry(0.35, 0.12, 0.7), 0, 7.3, 2.1);
    const signalPole = merge([tr(new THREE.CylinderGeometry(0.1, 0.12, 5.5, 6), 0, 2.75, 0), tr(new THREE.BoxGeometry(0.12, 0.12, 4.2), 0, 5.3, -2.1), tr(new THREE.BoxGeometry(1.25, 0.42, 0.3), 0, 5.05, -4)]); // Japanese signal: a horizontal head
    const signalBulb = tr(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 10), 0, 5.05, -4.17, Math.PI / 2);
    const trunk = tr(new THREE.CylinderGeometry(0.16, 0.24, 3, 5), 0, 1.5, 0);
    // canopy: a cluster of lumpy blobs, smooth-shaded, darker underneath (vertex colour, multiplied by the per-tree tint)
    const blob = (r: number, x: number, y: number, z: number, seed: number) => {
      const g = new THREE.IcosahedronGeometry(r, 1), p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) { const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i), n = 1 + 0.16 * Math.sin(vx * 3.1 + seed) * Math.cos(vz * 2.7 + seed * 1.7) + 0.08 * Math.sin(vy * 5 + seed); p.setXYZ(i, vx * n, vy * n * 0.85, vz * n); }
      g.computeVertexNormals(); g.translate(x, y, z); return g;
    };
    const canopy = merge([blob(2.0, 0, 4.3, 0, 1), blob(1.45, 1.1, 4.0, 0.5, 2), blob(1.5, -0.9, 4.6, -0.7, 3), blob(1.3, 0.3, 5.6, -0.2, 4), blob(1.2, -0.5, 3.8, 1.0, 5)]);
    { const p = canopy.attributes.position as THREE.BufferAttribute, col = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const k = 0.55 + 0.45 * Math.min(1, Math.max(0, (p.getY(i) - 2.6) / 3.6)); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k; } canopy.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
    const palmTrunk = tr(new THREE.CylinderGeometry(0.16, 0.3, 9, 6), 0, 4.5, 0);
    const fronds: THREE.BufferGeometry[] = []; for (let k = 0; k < 7; k++) { const f = new THREE.ConeGeometry(0.7, 4.2, 3, 1); f.rotateZ(Math.PI / 2 + 0.35); f.translate(2, 8.6, 0); f.rotateY((k / 7) * Math.PI * 2); fronds.push(f); }
    const palmTop = merge(fronds);
    const pine = merge([tr(new THREE.ConeGeometry(2.6, 6, 7), 0, 5, 0), tr(new THREE.ConeGeometry(1.9, 4.5, 7), 0, 7.6, 0)]);
    const bench = merge([tr(new THREE.BoxGeometry(1.8, 0.08, 0.5), 0, 0.45, 0), tr(new THREE.BoxGeometry(1.8, 0.45, 0.06), 0, 0.75, -0.25), tr(new THREE.BoxGeometry(0.08, 0.45, 0.45), -0.8, 0.22, 0), tr(new THREE.BoxGeometry(0.08, 0.45, 0.45), 0.8, 0.22, 0)]);
    const bin = tr(new THREE.CylinderGeometry(0.32, 0.28, 0.95, 8), 0, 0.48, 0);
    const hydrant = merge([tr(new THREE.CylinderGeometry(0.16, 0.18, 0.7, 8), 0, 0.35, 0), tr(new THREE.SphereGeometry(0.17, 8, 4), 0, 0.72, 0), tr(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 6), 0, 0.45, 0, 0, Math.PI / 2)]);
    const container = tr(new THREE.BoxGeometry(12.2, 2.6, 2.45), 0, 1.3, 0);
    const umbrella = merge([tr(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 4), 0, 1.2, 0), tr(new THREE.ConeGeometry(1.4, 0.6, 8), 0, 2.4, 0)]);
    const billboardFrame = merge([tr(new THREE.BoxGeometry(0.3, 6, 0.3), -4, 3, 0.4), tr(new THREE.BoxGeometry(0.3, 6, 0.3), 4, 3, 0.4), tr(new THREE.BoxGeometry(10.4, 5.2, 0.25), 0, 7.2, 0.35)]);
    const billboardPanel = tr(new THREE.PlaneGeometry(10, 4.8), 0, 7.2, 0.2); billboardPanel.rotateY(Math.PI); billboardPanel.translate(0, 0, 0);
    const pool = new THREE.PlaneGeometry(12, 12); pool.rotateX(-Math.PI / 2); pool.translate(0, 0.2, 2);
    // Japanese concrete utility pole: shaft, two cross-arms with insulators, step bolts; a pole-top transformer on some
    const ins = (x: number, y: number) => tr(new THREE.CylinderGeometry(0.06, 0.08, 0.22, 5), x, y, 0);
    const pole = merge([tr(new THREE.CylinderGeometry(0.13, 0.2, 10.5, 7), 0, 5.4, 0), tr(new THREE.BoxGeometry(1.8, 0.12, 0.12), 0, 9.1, 0), tr(new THREE.BoxGeometry(1.1, 0.1, 0.1), 0, 7.1, 0), ins(-0.75, 9.27), ins(0.75, 9.27), ins(0, 9.27), ...[2.6, 3.4, 4.2, 5, 5.8].map((y, k) => tr(new THREE.BoxGeometry(0.34, 0.04, 0.04), 0, y, 0, 0, 0).rotateY(k % 2 ? Math.PI / 2 : 0))]);
    const transformer = merge([tr(new THREE.CylinderGeometry(0.3, 0.3, 1.05, 8), 0, 7.95, 0.5), tr(new THREE.BoxGeometry(0.1, 0.5, 0.36), 0, 7.95, 0.2)]);
    const vendBody = merge([tr(new THREE.BoxGeometry(1.0, 1.83, 0.75), 0, 0.15 + 0.915, 0), tr(new THREE.BoxGeometry(1.0, 0.08, 0.12), 0, 0.15 + 0.42, 0.42)]);
    const vendFace = new THREE.PlaneGeometry(0.84, 1.08); vendFace.translate(0, 0.15 + 1.2, 0.377);
    // shisa: a lion-dog guardian on a little plinth (Okinawa)
    const shisa = merge([tr(new THREE.BoxGeometry(0.5, 0.12, 0.5), 0, 0.06, 0), tr(new THREE.SphereGeometry(0.2, 7, 5), 0, 0.3, -0.04), tr(new THREE.SphereGeometry(0.17, 7, 5), 0, 0.56, 0.08), tr(new THREE.ConeGeometry(0.06, 0.14, 4), -0.1, 0.72, 0.06), tr(new THREE.ConeGeometry(0.06, 0.14, 4), 0.1, 0.72, 0.06), tr(new THREE.BoxGeometry(0.2, 0.06, 0.08), 0, 0.5, 0.24)]);
    return { shisa, pole, transformer, vendBody, vendFace, lampPole, lampHead, signalPole, signalBulb, trunk, canopy, palmTrunk, palmTop, pine, bench, bin, hydrant, container, umbrella, billboardFrame, billboardPanel, pool };
  }, []);
}

/** Road and sidewalk materials darken and turn glossy when wet (weather). */
export const wetMats: { m: THREE.MeshStandardMaterial; r: number }[] = [];
const wetReg = <T extends THREE.Material>(m: T): T => { wetMats.push({ m: m as unknown as THREE.MeshStandardMaterial, r: (m as unknown as THREE.MeshStandardMaterial).roughness }); return m; };

/** Wind: foliage vertices sway with height, each tree with its own phase (vertex shader). */
export const wind = { value: 0 };
function addWind(m: THREE.Material) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = wind;
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
#else
  vec3 ip = vec3(0.0);
#endif
  float hh = max(0.0, position.y - 1.2);
  float ph = uWind * 1.25 + ip.x * 0.11 + ip.z * 0.07;
  float gust = 0.6 + 0.4 * sin(uWind * 0.23 + ip.x * 0.01);
  transformed.x += (sin(ph) * 0.045 + sin(ph * 2.9 + position.z) * 0.015) * hh * gust;
  transformed.z += (cos(ph * 0.87) * 0.035 + sin(ph * 3.3 + position.x) * 0.012) * hh * gust;`);
  };
}

function bucket<T extends { x: number; z: number }>(list: T[]) {
  const m = new Map<string, T[]>();
  for (const it of list) { const k = Math.floor(it.x / CH) + ',' + Math.floor(it.z / CH); let a = m.get(k); if (!a) m.set(k, (a = [])); a.push(it); }
  return m;
}

let PM: ReturnType<typeof makePropMats> | null = null;
function makePropMats() {
  const pm = {
    pole: new THREE.MeshStandardMaterial({ color: '#2b2d33', roughness: 0.5, metalness: 0.6 }), trunk: new THREE.MeshStandardMaterial({ color: '#5a4030', roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, vertexColors: true }), palm: new THREE.MeshStandardMaterial({ color: '#3d7a3a', roughness: 0.9, side: THREE.DoubleSide, flatShading: true }),
    pine: new THREE.MeshStandardMaterial({ color: '#2a4d32', roughness: 1, flatShading: true }), wood: new THREE.MeshStandardMaterial({ color: '#7a5236', roughness: 0.8 }),
    bin: new THREE.MeshStandardMaterial({ color: '#2f4f3a', roughness: 0.6 }), red: new THREE.MeshStandardMaterial({ color: '#c2271d', roughness: 0.5 }),
    cont: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, metalness: 0.4 }), cloth: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }),
    concrete: new THREE.MeshStandardMaterial({ color: '#a19f99', roughness: 0.9 }), trans: new THREE.MeshStandardMaterial({ color: '#7d8188', roughness: 0.5, metalness: 0.5 }),
    wire: new THREE.LineBasicMaterial({ color: '#16171a' }),
    vend: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, metalness: 0.2 }), shisa: new THREE.MeshStandardMaterial({ color: '#b5643a', roughness: 0.7 }),
    wall: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 }), vendFace: new THREE.MeshBasicMaterial({ map: vendTexture(), toneMapped: false }),
  };
  for (const m of [pm.leaf, pm.palm, pm.pine]) addWind(m);
  return pm;
}
const propMats = () => (PM ||= makePropMats());
/** Drink display of a vending machine: three shelves of cans and bottles, price buttons, the coin slot. */
function vendTexture() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 164; const c = cv.getContext('2d')!;
  c.fillStyle = '#eef3f7'; c.fillRect(0, 0, 128, 164);
  const cols = ['#d8262e', '#1f5fc4', '#f2c230', '#2d9a4a', '#f07a1e', '#ffffff', '#7a3ec8', '#13a6b8'];
  for (let row = 0; row < 3; row++) for (let k = 0; k < 6; k++) {
    const x = 8 + k * 19, y = 10 + row * 40, col = cols[(row * 5 + k * 3) % cols.length];
    c.fillStyle = col; c.fillRect(x, y, 13, 26); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(x + 2, y + 3, 3, 18);
    c.fillStyle = '#2a2a30'; c.fillRect(x, y + 29, 13, 5); c.fillStyle = '#ff4040'; c.fillRect(x + 4, y + 30, 5, 3);
  }
  c.fillStyle = '#20242a'; c.fillRect(0, 128, 128, 36); c.fillStyle = '#7fe3ff'; c.fillRect(10, 136, 40, 10); c.fillStyle = '#c9ccd3'; c.fillRect(92, 134, 10, 22);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** Sagging cables between utility poles: two power lines at the cross-arm ends and a lower telephone line. */
function wireGeometry(spans: { x0: number; z0: number; x1: number; z1: number }[]) {
  const pts: number[] = [];
  for (const w of spans) {
    const dx = w.x1 - w.x0, dz = w.z1 - w.z0, L = Math.hypot(dx, dz) || 1, px = -dz / L, pz = dx / L, sag = Math.min(1.1, L * 0.022);
    for (const [o, y] of [[-0.75, 9.32], [0.75, 9.32], [0.12, 7.2]]) {
      const ax = w.x0 + px * o, az = w.z0 + pz * o, bx = w.x1 + px * o, bz = w.z1 + pz * o;
      for (let k = 0; k < 6; k++) { const t0 = k / 6, t1 = (k + 1) / 6; pts.push(ax + (bx - ax) * t0, y - sag * 4 * t0 * (1 - t0), az + (bz - az) * t0, ax + (bx - ax) * t1, y - sag * 4 * t1 * (1 - t1), az + (bz - az) * t1); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.computeBoundingSphere(); return g;
}
/** Low walls around the housing plots: unit boxes scaled per instance (concrete blocks, or limestone in Naha). */
function Walls({ items }: { items: { x0: number; z0: number; x1: number; z1: number; lime: boolean }[] }) {
  const mesh = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0);
    const m = new THREE.InstancedMesh(g, propMats().wall, items.length), M4 = new THREE.Matrix4(), c0 = new THREE.Color(0.66, 0.66, 0.64), c1 = new THREE.Color(0.86, 0.8, 0.66);
    items.forEach((w, i) => { M4.makeScale(Math.max(0.2, w.x1 - w.x0), 1.3, Math.max(0.2, w.z1 - w.z0)); M4.setPosition((w.x0 + w.x1) / 2, 0.1, (w.z0 + w.z1) / 2); m.setMatrixAt(i, M4); m.setColorAt(i, w.lime ? c1 : c0); });
    m.receiveShadow = true; m.castShadow = true; m.computeBoundingSphere(); return m;
  }, [items]);
  useEffect(() => () => { mesh.geometry.dispose(); mesh.dispose(); }, [mesh]);
  return <primitive object={mesh} />;
}
function Wires({ spans }: { spans: { x0: number; z0: number; x1: number; z1: number }[] }) {
  const geo = useMemo(() => wireGeometry(spans), [spans]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <lineSegments geometry={geo} material={propMats().wire} />;
}
function PropsChunk({ k, B, mats, pg, adMats }: { k: string; B: Record<string, Map<string, any[]>>; mats: Mats; pg: ReturnType<typeof usePropGeos>; adMats: THREE.Material[] }) {
  const pm = propMats(), small = useRef<THREE.Group>(null);
  const [kx, kz] = k.split(',').map(Number), ccx = (kx + 0.5) * CH, ccz = (kz + 0.5) * CH;
  useFrame(({ camera }) => { if (small.current) small.current.visible = Math.hypot(camera.position.x - ccx, camera.position.z - ccz) < 380; });

  const L = (n: string) => B[n].get(k) || [];
  const lamps = L('lamps'), trees = L('trees'), palms = L('palms'), pines = L('pines');
  const leafCols = useMemo(() => trees.map((t: any, i) => t.c || [0.2 + ((i * 37) % 10) / 60, 0.42 + ((i * 13) % 10) / 50, 0.2]), [trees]);
  const poles = L('poles'), trans = useMemo(() => poles.filter((p: any) => p.tr), [poles]), vends = L('vends'), vendCols = useMemo(() => vends.map((v: any) => v.c), [vends]);
  const conts = L('containers'), umbr = L('umbrellas'), bills = L('billboards');
  const umbrCols = useMemo(() => umbr.map((c: any) => c.c), [umbr]), contCols = useMemo(() => conts.map((c: any) => c.c), [conts]), billsBy = useMemo(() => [0, 1, 2, 3].map((n) => bills.filter((b: any) => b.c === n)), [bills]);
  return (
    <group>
      <Inst geo={pg.lampPole} mat={pm.pole} items={lamps} />
      <Inst geo={pg.lampHead} mat={mats.lampHead} items={lamps} />
      <Inst geo={pg.pool} mat={mats.pool} items={lamps} />
      <Inst geo={pg.trunk} mat={pm.trunk} items={trees} />
      <Inst geo={pg.canopy} mat={pm.leaf} items={trees} colors={leafCols} shadow />
      <Inst geo={pg.palmTrunk} mat={pm.trunk} items={palms} />
      <Inst geo={pg.palmTop} mat={pm.palm} items={palms} shadow />
      <Inst geo={pg.trunk} mat={pm.trunk} items={pines} />
      <Inst geo={pg.pine} mat={pm.pine} items={pines} shadow />
      <group ref={small}>{/* small street furniture: only drawn in the chunks close to the camera */}
        <Inst geo={pg.bench} mat={pm.wood} items={L('benches')} />
        <Inst geo={pg.bin} mat={pm.bin} items={L('bins')} />
        <Inst geo={pg.hydrant} mat={pm.red} items={L('hydrants')} />
        <Inst geo={pg.transformer} mat={pm.trans} items={trans} />
        {L('wires').length > 0 && <Wires spans={L('wires')} />}
        <Inst geo={pg.vendBody} mat={pm.vend} items={vends} colors={vendCols} />
        <Inst geo={pg.vendFace} mat={pm.vendFace} items={vends} />
        <Inst geo={pg.shisa} mat={pm.shisa} items={L('shisa')} />
      </group>
      {L('walls').length > 0 && <Walls items={L('walls')} />}
      <Inst geo={pg.container} mat={pm.cont} items={conts} colors={contCols} shadow />
      <Inst geo={pg.umbrella} mat={pm.cloth} items={umbr} colors={umbrCols} />
      <Inst geo={pg.billboardFrame} mat={pm.pole} items={bills} />
      {[0, 1, 2, 3].map((n) => <Inst key={n} geo={pg.billboardPanel} mat={adMats[n]} items={billsBy[n]} />)}
      <Inst geo={pg.pole} mat={pm.concrete} items={poles} shadow />
    </group>
  );
}

/* ---------- traffic signals (animated) ---------- */
export const signalState = (i: number, j: number, axis: number, t: number) => { let p = (t + ((i * 7 + j * 13) % 12)) % 24; if (axis) p = (p + 12) % 24; return p < 10 ? 0 : p < 12 ? 1 : 2; };
let SIG: { pole: THREE.MeshStandardMaterial; bulb: THREE.MeshBasicMaterial; cols: THREE.Color[] } | null = null;
const sigMats = () => (SIG ||= { pole: new THREE.MeshStandardMaterial({ color: '#8a8e94', roughness: 0.5, metalness: 0.6 }), bulb: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), cols: [new THREE.Color(0.1, 1.9, 1.3), new THREE.Color(2, 1.3, 0.1), new THREE.Color(2.2, 0.15, 0.1)] });
const SIG_OFF = new THREE.Color(0.08, 0.08, 0.09), LAMP_X = [-0.4, 0, 0.4]; // blue-green, amber, red from left to right
function SignalsChunk({ items, pg }: { items: (typeof props.signals)[number][]; pg: ReturnType<typeof usePropGeos> }) {
  const S2 = sigMats();
  const bulbs = useMemo(() => { const m = new THREE.InstancedMesh(pg.signalBulb, S2.bulb, Math.max(1, items.length * 3)); const off = new THREE.Vector3(); items.forEach((it, i) => { tmpQ.setFromAxisAngle(UP, it.a); tmpS.setScalar(1); for (let k = 0; k < 3; k++) { off.set(LAMP_X[k], 0, 0).applyQuaternion(tmpQ); tmpP.set(it.x + off.x, 0, it.z + off.z); tmpM.compose(tmpP, tmpQ, tmpS); m.setMatrixAt(i * 3 + k, tmpM); m.setColorAt(i * 3 + k, k ? SIG_OFF : S2.cols[0]); } }); m.count = items.length * 3; m.computeBoundingSphere(); return m; }, [items, pg, S2]);
  useEffect(() => () => bulbs.dispose(), [bulbs]);
  const last = useRef(-1);
  useFrame(() => {
    const tt = Math.floor(game.clock * 2) / 2; if (tt === last.current) return; last.current = tt;
    items.forEach((it, i) => { const st = signalState(it.i, it.j, it.axis, game.clock); for (let k = 0; k < 3; k++) bulbs.setColorAt(i * 3 + k, k === st ? S2.cols[st] : SIG_OFF); });
    bulbs.instanceColor!.needsUpdate = true;
  });
  return <group><Inst geo={pg.signalPole} mat={S2.pole} items={items} /><primitive object={bulbs} /></group>;
}

/* ---------- the streamer ---------- */
function CityStream({ cells, mats, shadows, B, pg, adMats }: { cells: Cell[]; mats: Mats; shadows: boolean; B: Record<string, Map<string, any[]>>; pg: ReturnType<typeof usePropGeos>; adMats: THREE.Material[] }) {
  const live = useRef(new Map<string, Live>()), [, bump] = useReducer((x: number) => x + 1, 0);
  const sorted = useRef<{ c: Cell; d: number }[]>([]), sortT = useRef(0), lastF = useRef({ x: 1e9, z: 1e9 });
  useFrame(({ camera }, dt) => {
    const f = game.where === 'out' || !game.started ? camera.position : game.outsidePos, t0 = performance.now();
    sortT.current -= dt;
    const jumped = Math.hypot(f.x - lastF.current.x, f.z - lastF.current.z) > 60; // a teleport: re-sort right away
    if (sortT.current <= 0 || jumped || !sorted.current.length) { sortT.current = 0.25; lastF.current = { x: f.x, z: f.z }; sorted.current = cells.map((c) => ({ c, d: Math.hypot(c.x - f.x, c.z - f.z) })).sort((a, b) => a.d - b.d); }
    let changed = false, pending = 0, catchUp = false;
    // free what is now far away
    for (const { c, d } of sorted.current) {
      const L = live.current.get(c.key); if (!L) continue;
      // (the meshes free their GPU memory when React unmounts them)
      if (L.hi && d > HI_R + HYST) { L.hi = undefined; changed = true; }
      if (L.lo && d > LO_R + HYST) { L.lo = undefined; changed = true; }
      if (L.paint && d > NEAR_R + HYST) { L.paint = undefined; changed = true; }
      if (L.detail && d > NEAR_R + HYST) { L.detail = undefined; changed = true; }
      if (L.near && d > NEAR_R + HYST) { L.near = false; changed = true; }
      if (!L.hi && !L.lo && !L.paint && !L.detail && !L.near) live.current.delete(c.key);
    }
    // build what is missing, nearest first, within a time budget (bigger while loading or after a teleport)
    for (const { c, d } of sorted.current) { if (d > 300) break; const L = live.current.get(c.key); if (c.items.length && (!L || !L.hi)) { catchUp = true; break; } }
    const budget = !game.started ? 140 : cityStream.pending > 40 ? 60 : catchUp ? 24 : 5;
    for (const { c, d } of sorted.current) {
      if (d > LO_R) break;
      let L = live.current.get(c.key);
      const need = () => (c.items.length && !L!.lo) || (c.items.length && d < HI_R && !L!.hi) || (d < NEAR_R && c.paint && !L!.paint) || (d < NEAR_R && (c.items.length || c.doors.length) && !L!.detail) || (d < NEAR_R && c.props && !L!.near);
      if (!L) { L = { near: false }; if (!need()) continue; live.current.set(c.key, L); }
      while (need()) {
        if (performance.now() - t0 > budget) { pending++; break; }
        const tb = performance.now();
        if (c.items.length && !L.lo) L.lo = buildChunkLevel(c.items, false);
        else if (c.items.length && d < HI_R && !L.hi) L.hi = buildChunkLevel(c.items, true);
        else if (d < NEAR_R && c.paint && !L.paint) L.paint = buildPaint(c.cx, c.cz);
        else if (d < NEAR_R && (c.items.length || c.doors.length) && !L.detail) L.detail = buildDetail(c.items, c.doors);
        else if (d < NEAR_R && c.props && !L.near) L.near = true;
        changed = true; cityStream.built++; cityStream.ms += performance.now() - tb;
      }
    }
    cityStream.pending = pending; cityStream.live = live.current.size;
    if (changed) bump();
  });
  return (
    <>
      {cells.map((c) => { const L = live.current.get(c.key); return L ? <CellView key={c.key} c={c} L={L} mats={mats} shadows={shadows} B={B} pg={pg} adMats={adMats} /> : null; })}
    </>
  );
}
function DetailMeshes({ list }: { list: THREE.InstancedMesh[] }) {
  useEffect(() => () => disposeDetail(list), [list]);
  return <>{list.map((m, i) => <primitive key={i} object={m} />)}</>;
}
function CellView({ c, L, mats, shadows, B, pg, adMats }: { c: Cell; L: Live; mats: Mats; shadows: boolean; B: Record<string, Map<string, any[]>>; pg: ReturnType<typeof usePropGeos>; adMats: THREE.Material[] }) {
  const hiG = useRef<THREE.Group>(null), loG = useRef<THREE.Group>(null);
  useFrame(({ camera }) => { // the near version swaps in close up, the plain one further away
    const d = Math.hypot(camera.position.x - c.x, camera.position.y, camera.position.z - c.z), showHi = !!L.hi && d < SHOW_HI;
    if (hiG.current) hiG.current.visible = showHi; if (loG.current) loG.current.visible = !showHi;
  });
  const sig = B.signals.get(c.key);
  return (
    <group>
      {L.hi && <group ref={hiG}><BuiltMeshes built={L.hi} mats={mats} shadows={shadows} /></group>}
      {L.lo && <group ref={loG}><BuiltMeshes built={L.lo} mats={mats} shadows={false} /></group>}
      {L.paint && <BuiltMeshes built={L.paint} mats={mats} shadows={false} />}
      {L.detail && <DetailMeshes list={L.detail} />}
      {L.near && c.props && <PropsChunk k={c.key} B={B} mats={mats} pg={pg} adMats={adMats} />}
      {L.near && sig && <SignalsChunk items={sig} pg={pg} />}
    </group>
  );
}

/* ---------- ground, roads, markings, special areas ---------- */
/** Lane lines, edge lines and zebra crossings whose centre falls in one chunk tile. */
function buildPaint(tx: number, tz: number): Built {
  const G = new Geo(), W = [0.92, 0.92, 0.9], Y = [0.95, 0.75, 0.2], x0 = tx * CH, z0 = tz * CH, x1 = x0 + CH, z1 = z0 + CH;
  const inT = (x: number, z: number) => x >= x0 && x < x1 && z >= z0 && z < z1;
  for (let k = 0; k <= N; k++) {
    const c = roadC(k);
    for (let s2 = 0; s2 < N; s2++) {
      const a = -HALF + s2 * PITCH + ROAD + 2, b2 = a + PITCH - ROAD - 4, m = (a + b2) / 2;
      if (inT(c, m) && segOpen('z', k, s2)) { for (let t = a + 2; t < b2 - 3; t += 6) G.flat(c - 0.12, t, c + 0.12, t + 3, 0.02, Y); for (const o of [-ROAD / 2 + 0.5, ROAD / 2 - 0.6]) G.flat(c + o, a, c + o + 0.1, b2, 0.02, W); }
      if (inT(m, c) && segOpen('x', k, s2)) { for (let t = a + 2; t < b2 - 3; t += 6) G.flat(t, c - 0.12, t + 3, c + 0.12, 0.02, Y); for (const o of [-ROAD / 2 + 0.5, ROAD / 2 - 0.6]) G.flat(a, c + o, b2, c + o + 0.1, 0.02, W); }
    }
  }
  { // scramble crossing: diagonal zebra stripes across the busiest junction
    const x = roadC(O + 4), z = roadC(O + 4), s2 = Math.SQRT1_2;
    if (inT(x, z)) for (const [ux, uz, vx, vz, yy] of [[s2, s2, -s2, s2, 0.024], [s2, -s2, s2, s2, 0.026]]) for (let s = -8.4; s <= 8.4; s += 1.4) {
      const cx = x + ux * s, cz = z + uz * s, a = 0.35, b = 1.5;
      G.quad([cx - ux * a + vx * b, yy, cz - uz * a + vz * b], [cx + ux * a + vx * b, yy, cz + uz * a + vz * b], [cx + ux * a - vx * b, yy, cz + uz * a - vz * b], [cx - ux * a - vx * b, yy, cz - uz * a - vz * b], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], W);
    }
  }
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const x = roadC(i), z = roadC(j), h = ROAD / 2; if (!inT(x, z) || !nodeOpen(i, j)) continue;
    for (let o = -h + 1; o < h - 0.5; o += 1.4) { G.flat(x + o, z - h - 4, x + o + 0.7, z - h - 1, 0.02, W); G.flat(x + o, z + h + 1, x + o + 0.7, z + h + 4, 0.02, W); G.flat(x - h - 4, z + o, x - h - 1, z + o + 0.7, 0.02, W); G.flat(x + h + 1, z + o, x + h + 4, z + o + 0.7, 0.02, W); }
  }
  // 止まれ: stop markings and stop lines on the approaches to junctions without signals (in the left-hand lane)
  const TM = new Geo();
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    if ((i + j) % 2 === 0 || !nodeOpen(i, j)) continue;
    const x = roadC(i), z = roadC(j), h = ROAD / 2; if (!inT(x, z)) continue;
    for (const [hx, hz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const ni = i - hx, nj = j - hz; if (ni < 0 || nj < 0 || ni > N || nj > N) continue;
      if (hz !== 0 ? !segOpen('z', i, Math.min(j, nj)) : !segOpen('x', j, Math.min(i, ni))) continue;
      const lx = hz, lz = -hx, cx = x - hx * (h + 8.6) + lx * 3.3, cz = z - hz * (h + 8.6) + lz * 3.3, W = 2.9, L = 4.6;
      const P = (u: number, v: number) => [cx + lx * (0.5 - u) * W + hx * (v - 0.5) * L, 0.025, cz + lz * (0.5 - u) * W + hz * (v - 0.5) * L];
      const A = P(0, 0), Bq = P(1, 0), C = P(1, 1), D = P(0, 1), up = (Bq[2] - A[2]) * (C[0] - Bq[0]) - (Bq[0] - A[0]) * (C[2] - Bq[2]) > 0;
      if (up) TM.quad(A, Bq, C, D, [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], [1, 1, 1]); else TM.quad(D, C, Bq, A, [0, 1, 0], [[0, 1], [1, 1], [1, 0], [0, 0]], [1, 1, 1]);
      const sx = x - hx * (h + 5.4), sz = z - hz * (h + 5.4); // stop line across the lane
      G.flat(Math.min(sx + lx * 0.2, sx + lx * 6.4 + hx * 0.45), Math.min(sz + lz * 0.2, sz + lz * 6.4 + hz * 0.45), Math.max(sx + lx * 0.2, sx + lx * 6.4 + hx * 0.45), Math.max(sz + lz * 0.2, sz + lz * 6.4 + hz * 0.45), 0.021, W === 2.9 ? [0.92, 0.92, 0.9] : Y);
    }
  }
  if (ROTARY.on && inT((ROTARY.x0 + ROTARY.x1) / 2, (ROTARY.z0 + ROTARY.z1) / 2)) { // one-way markings round the island, bus and taxi bays
    const R = ROTARY, I = R.island, Yb = [0.95, 0.75, 0.2];
    for (let z = R.z0 + 3; z < R.z1 - 3; z += 5) { G.flat(R.x0 + 0.4, z, R.x0 + 0.55, z + 2.4, 0.19, W); G.flat(R.x1 - 0.55, z, R.x1 - 0.4, z + 2.4, 0.19, W); }
    for (const [x0, x1] of [[R.taxi.x - 2.4, R.taxi.x - 0.3], [R.bus.x + 0.3, R.bus.x + 3.0]]) { const z0 = x0 < I.x0 ? R.taxi.z - 3 : R.bus.z - 7, z1 = z0 + (x0 < I.x0 ? 13 : 14); G.flat(x0, z0, x0 + 0.12, z1, 0.19, Yb); G.flat(x1 - 0.12, z0, x1, z1, 0.19, Yb); G.flat(x0, z0, x1, z0 + 0.12, 0.19, Yb); G.flat(x0, z1 - 0.12, x1, z1, 0.19, Yb); }
  }
  for (const L of LANES) {
    if (!inT((L.x0 + L.x1) / 2, L.z)) continue;
    for (const o of [-LANE_W / 2 + 0.25, LANE_W / 2 - 0.37]) G.flat(L.x0 + 5, L.z + o, L.x1 - 5, L.z + o + 0.12, 0.19, W);
    for (const [ex, hx] of [[L.x0 + 5, -1], [L.x1 - 5, 1]]) { // leaving the lane: stop line just inside the pavement, the marking behind it
      G.flat(Math.min(ex, ex - hx * 0.4), L.z - LANE_W / 2 + 0.25, Math.max(ex, ex - hx * 0.4), L.z + LANE_W / 2 - 0.25, 0.19, W);
      const cx = ex - hx * 3.4, lz = -hx, Wd = 2.3, Ln = 3.6;
      const P = (u: number, v: number) => [cx + hx * (v - 0.5) * Ln, 0.195, L.z + lz * (0.5 - u) * Wd];
      const A = P(0, 0), Bq = P(1, 0), Cq = P(1, 1), D = P(0, 1), up = (Bq[2] - A[2]) * (Cq[0] - Bq[0]) - (Bq[0] - A[0]) * (Cq[2] - Bq[2]) > 0;
      if (up) TM.quad(A, Bq, Cq, D, [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], [1, 1, 1]); else TM.quad(D, Cq, Bq, A, [0, 1, 0], [[0, 1], [1, 1], [1, 0], [0, 0]], [1, 1, 1]);
    }
  }
  // pedestrian bridges: painted steel deck and girders, panel parapets, concrete piers, stairs down both pavements
  const FBG = new Geo(), FBM = new Geo();
  for (const B of BRIDGES) {
    if (!inT(B.x, B.z)) continue;
    const xw = B.x - ROAD / 2, xe = B.x + ROAD / 2, T = FB.top, z = B.z, STEEL = [0.56, 0.74, 0.72], PANEL = [0.86, 0.9, 0.88], CON = [0.7, 0.69, 0.66], z0 = z + FB.hw, n = 26, tread = FB.run / n;
    FBG.box(xw - FB.land, T - 0.14, z - FB.hw, xe + FB.land, T, z + FB.hw, [0.5, 0.5, 0.52]); // walking surface
    for (const s of [-1, 1]) FBG.box(xw - FB.land, T - 0.75, z + s * FB.hw - 0.12, xe + FB.land, T - 0.14, z + s * FB.hw + 0.12, STEEL); // girders
    FBM.box(xw - FB.land, T, z - FB.hw - 0.06, xe + FB.land, T + 1.15, z - FB.hw, PANEL); FBM.box(xw - FB.s0, T, z + FB.hw, xe + FB.s0, T + 1.15, z + FB.hw + 0.06, PANEL);
    for (const [xa, xb] of [[xw - FB.land - 0.06, xw - FB.land], [xe + FB.land, xe + FB.land + 0.06]]) FBM.box(xa, T, z - FB.hw, xb, T + 1.15, z + FB.hw, PANEL);
    for (const px of [xw - 0.45, xe + 0.05]) FBG.box(px, 0.15, z - 0.2, px + 0.4, T - 0.75, z + 0.2, CON);
    for (const [sx0, sx1] of [[xw - FB.s1, xw - FB.s0], [xe + FB.s0, xe + FB.s1]]) {
      for (let k = 0; k < n; k++) { const h = T - ((T - 0.15) * (k + 1)) / n; FBG.box(sx0, 0.15, z0 + k * tread, sx1, h + 0.1, z0 + (k + 1) * tread, k % 2 ? [0.62, 0.62, 0.64] : [0.56, 0.56, 0.58]); }
      for (const sx of [sx0 - 0.06, sx1]) for (let q = 0; q < 8; q++) { const za = z0 + (FB.run * q) / 8, zb = z0 + (FB.run * (q + 1)) / 8, h = T - ((T - 0.15) * q) / 8; FBM.box(sx, h - 0.6, za, sx + 0.06, h + 1.05, zb, PANEL); }
    }
  }
  const out: Built = []; if (!G.empty) out.push({ k: 'paint', geo: G.build() }); if (!TM.empty) out.push({ k: 'tomare', geo: TM.build() });
  if (!FBG.empty) out.push({ k: 'misc', geo: FBG.build() }); if (!FBM.empty) out.push({ k: 'metal', geo: FBM.build() });
  return out;
}
function buildGround() {
  const G = { road: new Geo(), side: new Geo(), grass: new Geo(), paint: new Geo(), misc: new Geo(), concrete: new Geo(), sand: new Geo(), asphalt2: new Geo(), metal: new Geo(), glow: new Geo() };
  const W = [0.92, 0.92, 0.9], Y = [0.95, 0.75, 0.2], ONE = [1, 1, 1];
  for (const b of blocks) {
    if (b.zone === 'canal') { // pavement on both banks, the channel open to the water, stone walls, promenade paving, railings
      const R = CANAL_BLOCKS.get(b.j * N + b.i); if (!R) continue;
      const ax = R.axis === 'x', STONE = [0.55, 0.53, 0.5], PAVE = [0.78, 0.68, 0.55], RAIL = [0.25, 0.25, 0.28];
      if (ax) { G.side.box(b.x0, 0, b.z0, b.x1, 0.15, R.z0, ONE, 2, 2, G.side, 2); G.side.box(b.x0, 0, R.z1, b.x1, 0.15, b.z1, ONE, 2, 2, G.side, 2);
        G.misc.flat(b.x0, R.z0 - PROM, b.x1, R.z0, 0.16, PAVE); G.misc.flat(b.x0, R.z1, b.x1, R.z1 + PROM, 0.16, PAVE);
        G.misc.box(b.x0, -3, R.z0, b.x1, 0.15, R.z0 + 0.6, STONE, 4, 4, null); G.misc.box(b.x0, -3, R.z1 - 0.6, b.x1, 0.15, R.z1, STONE, 4, 4, null);
        for (const z of [R.z0 - 0.2, R.z1]) { G.metal.box(b.x0, 1.0, z, b.x1, 1.08, z + 0.2, RAIL); for (let x = b.x0 + 1; x < b.x1; x += 3) G.metal.box(x, 0.15, z + 0.05, x + 0.1, 1.0, z + 0.15, RAIL); }
        for (const x of [b.x0, b.x1]) { G.misc.box(x - 0.3, -1.8, R.z0, x + 0.3, 0.02, R.z1, STONE, 4, 4, null); G.metal.box(x - (x === b.x0 ? 0.2 : 0), 1.0, R.z0, x + (x === b.x0 ? 0 : 0.2), 1.08, R.z1, [0.75, 0.6, 0.3]); for (let z = R.z0; z <= R.z1; z += 2) G.metal.box(x - 0.08, 0, z - 0.06, x + 0.08, 1.0, z + 0.06, [0.75, 0.6, 0.3]); }
      } else { G.side.box(b.x0, 0, b.z0, R.x0, 0.15, b.z1, ONE, 2, 2, G.side, 2); G.side.box(R.x1, 0, b.z0, b.x1, 0.15, b.z1, ONE, 2, 2, G.side, 2);
        G.misc.flat(R.x0 - PROM, b.z0, R.x0, b.z1, 0.16, PAVE); G.misc.flat(R.x1, b.z0, R.x1 + PROM, b.z1, 0.16, PAVE);
        G.misc.box(R.x0, -3, b.z0, R.x0 + 0.6, 0.15, b.z1, STONE, 4, 4, null); G.misc.box(R.x1 - 0.6, -3, b.z0, R.x1, 0.15, b.z1, STONE, 4, 4, null);
        for (const x of [R.x0 - 0.2, R.x1]) { G.metal.box(x, 1.0, b.z0, x + 0.2, 1.08, b.z1, RAIL); for (let z = b.z0 + 1; z < b.z1; z += 3) G.metal.box(x + 0.05, 0.15, z, x + 0.15, 1.0, z + 0.1, RAIL); }
        for (const z of [b.z0, b.z1]) { G.misc.box(R.x0, -1.8, z - 0.3, R.x1, 0.02, z + 0.3, STONE, 4, 4, null); G.metal.box(R.x0, 1.0, z - (z === b.z0 ? 0.2 : 0), R.x1, 1.08, z + (z === b.z0 ? 0 : 0.2), [0.75, 0.6, 0.3]); for (let x = R.x0; x <= R.x1; x += 2) G.metal.box(x - 0.06, 0, z - 0.08, x + 0.06, 1.0, z + 0.08, [0.75, 0.6, 0.3]); }
      }
      continue;
    }
    if (b.zone === 'water') continue;
    { const P = CANAL_BLOCKS.get(b.j * N + b.i); if (P && P.axis === 'pond') { // a park with a pond: lawn around the water, a stone rim, a railing
      for (const [a0, c0, a1, c1] of [[b.x0, b.z0, b.x1, P.z0], [b.x0, P.z1, b.x1, b.z1], [b.x0, P.z0, P.x0, P.z1], [P.x1, P.z0, b.x1, P.z1]]) { G.side.box(a0, 0, c0, a1, 0.15, c1, ONE, 2, 2, G.side, 2); G.grass.flat(a0 + 1.5, c0 + 1.5, a1 - 1.5, c1 - 1.5, 0.17, ONE, 6); }
      const ST = [0.6, 0.58, 0.54], RL = [0.3, 0.26, 0.22];
      G.misc.box(P.x0, -3, P.z0, P.x1, 0.2, P.z0 + 0.5, ST, 4, 4, null); G.misc.box(P.x0, -3, P.z1 - 0.5, P.x1, 0.2, P.z1, ST, 4, 4, null); G.misc.box(P.x0, -3, P.z0, P.x0 + 0.5, 0.2, P.z1, ST, 4, 4, null); G.misc.box(P.x1 - 0.5, -3, P.z0, P.x1, 0.2, P.z1, ST, 4, 4, null);
      for (const [a0, c0, a1, c1] of [[P.x0, P.z0 - 0.2, P.x1, P.z0], [P.x0, P.z1, P.x1, P.z1 + 0.2], [P.x0 - 0.2, P.z0, P.x0, P.z1], [P.x1, P.z0, P.x1 + 0.2, P.z1]]) G.metal.box(a0, 0.9, c0, a1, 0.98, c1, RL);
      continue;
    } }
    G.side.box(b.x0, 0, b.z0, b.x1, 0.15, b.z1, ONE, 2, 2, G.side, 2);
    const m = 5;
    if (b.zone === 'park') { G.grass.flat(b.x0 + 2, b.z0 + 2, b.x1 - 2, b.z1 - 2, 0.17, ONE, 6); }
    else if (b.zone === 'residential') { G.concrete.flat(b.x0 + m, b.z0 + m, b.x1 - m, b.z1 - m, 0.16, [0.9, 0.89, 0.86], 8); const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2; G.grass.flat(cx - 10, cz - 10, cx + 10, cz + 10, 0.17, ONE, 6); }
    else if (b.zone === 'parking' || b.zone === 'gas') {
      G.asphalt2.flat(b.x0 + m, b.z0 + m, b.x1 - m, b.z1 - m, 0.16, ONE, 8);
      if (b.zone === 'parking') for (let x = b.x0 + 9; x < b.x1 - 20; x += 3.2) { G.paint.flat(x, b.z0 + 10, x + 0.15, b.z0 + 15.5, 0.18, W); G.paint.flat(x, b.z1 - 15.5, x + 0.15, b.z1 - 10, 0.18, W); }
      if (b.zone === 'gas') { const cx = (b.x0 + b.x1) / 2, cz = b.z0 + 25; G.misc.box(cx - 18, 5.4, cz - 9, cx + 18, 6.2, cz + 9, [0.92, 0.92, 0.95]); G.glow.box(cx - 18, 5.5, cz - 9.05, cx + 18, 6.1, cz - 8.95, [1, 0.35, 0.2]); for (const ox of [-12, 0, 12]) { G.misc.box(cx + ox - 0.25, 0.15, cz - 0.25, cx + ox + 0.25, 5.4, cz + 0.25, [0.8, 0.8, 0.82]); G.misc.box(cx + ox - 0.5, 0.15, cz + 2, cx + ox + 0.5, 1.7, cz + 2.8, [0.85, 0.2, 0.2]); G.misc.box(cx + ox - 0.5, 0.15, cz - 2.8, cx + ox + 0.5, 1.7, cz - 2, [0.85, 0.2, 0.2]); } }
    } else if (b.zone === 'industrial') G.concrete.flat(b.x0 + m, b.z0 + m, b.x1 - m, b.z1 - m, 0.16, ONE, 8);
    if (b.zone === 'park') { const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2; G.side.flat(cx - 1.6, b.z0 + 2, cx + 1.6, b.z1 - 2, 0.18, [0.9, 0.85, 0.75], 2); G.side.flat(b.x0 + 2, cz - 1.6, b.x1 - 2, cz + 1.6, 0.18, [0.9, 0.85, 0.75], 2); }
  }
  // city streets: one quad per road segment and per junction (short quads keep the depth precision at street level)
  for (let k = 0; k <= N; k++) { const c = roadC(k); for (let s = 0; s < N; s++) { const a = roadC(s) + ROAD / 2, e = roadC(s + 1) - ROAD / 2; if (segOpen('x', k, s)) G.road.flat(a, c - ROAD / 2, e, c + ROAD / 2, 0, ONE, 10); if (segOpen('z', k, s)) G.road.flat(c - ROAD / 2, a, c + ROAD / 2, e, 0, ONE, 10); } }
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) if (nodeOpen(i, j)) G.road.flat(roadC(i) - ROAD / 2, roadC(j) - ROAD / 2, roadC(i) + ROAD / 2, roadC(j) + ROAD / 2, 0, ONE, 10);
  for (const q of SHORE) { G.misc.box(q.x0, -3.2, q.z0, q.x1, q.top + 0.05, q.z1, [0.56, 0.55, 0.52], 4, 4, G.misc); const ax = q.x1 - q.x0 > q.z1 - q.z0; G.metal.box(q.x0, q.top + 0.95, q.z0, q.x1, q.top + 1.03, q.z1, [0.75, 0.77, 0.8]); for (let t = ax ? q.x0 : q.z0; t < (ax ? q.x1 : q.z1); t += 2.5) G.metal.box(ax ? t : q.x0 + 0.1, q.top, ax ? q.z0 + 0.1 : t, ax ? t + 0.08 : q.x0 + 0.18, q.top + 0.95, ax ? q.z0 + 0.18 : t + 0.08, [0.75, 0.77, 0.8]); }
  // station-front rotary: asphalt loop, the island with its kerb, a bus shelter and the taxi rank sign
  if (ROTARY.on) {
    const R = ROTARY, I = R.island;
    G.road.flat(R.x0, R.z0, R.x1, R.z1, 0.17, [0.9, 0.9, 0.92], 10);
    G.misc.box(I.x0, 0, I.z0, I.x1, 0.32, I.z1, [0.72, 0.71, 0.68], 4, 4, G.side, 2);
    G.misc.box(I.x0 + 1.4, 0.32, I.z0 + 1.4, I.x1 - 1.4, 0.36, I.z1 - 1.4, [0.42, 0.62, 0.36]);
    const b = R.bus; // shelter on the east side of the island, facing the buses
    for (const z of [b.z - 3, b.z + 3]) G.metal.box(b.x - 1.6, 0.32, z - 0.06, b.x - 1.48, 2.7, z + 0.06, [0.6, 0.63, 0.67]);
    G.metal.box(b.x - 2.0, 2.7, b.z - 3.4, b.x - 0.2, 2.82, b.z + 3.4, [0.78, 0.82, 0.86]); G.misc.box(b.x - 1.9, 0.32, b.z - 2.4, b.x - 1.5, 0.78, b.z + 2.4, [0.35, 0.55, 0.8]);
    for (const p of [b, R.taxi]) G.metal.box(p.x - 0.05, 0.32, p.z - 0.05, p.x + 0.05, 2.6, p.z + 0.05, [0.55, 0.57, 0.6]);
  }
  // back lanes through the housing blocks, with an orange curve mirror at each mouth
  for (const L of LANES) {
    G.road.flat(L.x0, L.z - LANE_W / 2, L.x1, L.z + LANE_W / 2, 0.175, [0.86, 0.86, 0.88], 10);
    for (const [x, s] of [[L.x0 + 4.4, 1], [L.x1 - 4.4, -1]]) {
      const z = L.z + s * (LANE_W / 2 + 0.5);
      G.misc.box(x - 0.05, 0.15, z - 0.05, x + 0.05, 2.7, z + 0.05, [0.95, 0.5, 0.1]);
      G.misc.box(x - 0.42, 2.25, z - 0.06, x + 0.42, 3.05, z + 0.06, [0.95, 0.5, 0.1]); G.metal.box(x - 0.34, 2.33, z - 0.08, x + 0.34, 2.97, z + 0.08, [0.82, 0.86, 0.9]);
    }
  }
  // ring highway
  const C = HWY_C, hw = HWY_W / 2;
  const seg = (x0: number, z0: number, x1: number, z1: number) => G.asphalt2.flat(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), 0.03, ONE, 8);
  seg(-C - hw, -C - hw, C + hw, -C + hw); seg(-C - hw, C - hw, C + hw, C + hw); seg(-C - hw, -C + hw, -C + hw, C - hw); seg(C - hw, -C + hw, C + hw, C - hw);
  for (const side of [-1, 1]) {
    for (let t = -C; t < C; t += 9) { for (const o of [-hw / 3, hw / 3]) { G.paint.flat(t, side * C + o - 0.1, t + 4.5, side * C + o + 0.1, 0.05, W); G.paint.flat(side * C + o - 0.1, t, side * C + o + 0.1, t + 4.5, 0.05, W); } }
    G.paint.flat(-C, side * C - 0.2, C, side * C + 0.2, 0.05, Y); G.paint.flat(side * C - 0.2, -C, side * C + 0.2, C, 0.05, Y);
    for (const o of [-hw - 0.6, hw + 0.4]) { G.metal.box(-C - hw, 0.5, side * C + o, C + hw, 0.85, side * C + o + 0.2, [0.75, 0.77, 0.8]); G.metal.box(side * C + o, 0.5, -C - hw, side * C + o + 0.2, 0.85, C + hw, [0.75, 0.77, 0.8]); }
  }
  // connectors from highway to city edge roads
  for (const k of HWY_LINKS) { const c = roadC(k); if (nodeOpen(k, 0)) G.asphalt2.flat(c - ROAD / 2, -C + hw, c + ROAD / 2, -HALF, 0.03, ONE, 8); if (nodeOpen(k, N)) G.asphalt2.flat(c - ROAD / 2, HALF, c + ROAD / 2, C - hw, 0.03, ONE, 8); if (nodeOpen(0, k)) G.asphalt2.flat(-C + hw, c - ROAD / 2, -HALF, c + ROAD / 2, 0.03, ONE, 8); if (nodeOpen(N, k)) G.asphalt2.flat(HALF, c - ROAD / 2, C - hw, c + ROAD / 2, 0.03, ONE, 8); }
  // airport
  const A = AIRPORT;
  G.asphalt2.flat(A.x0 + 40, -190, A.x1 - 20, -140, 0.04, [0.55, 0.55, 0.6], 8);
  for (let t = A.x0 + 80; t < A.x1 - 60; t += 30) G.paint.flat(t, -165.6, t + 15, -164.4, 0.06, W);
  for (let s = 0; s < 8; s++) { G.paint.flat(A.x0 + 50, -186 + s * 5, A.x0 + 75, -184 + s * 5, 0.06, W); G.paint.flat(A.x1 - 50, -186 + s * 5, A.x1 - 25, -184 + s * 5, 0.06, W); }
  G.asphalt2.flat(A.x0 + 200, -140, A.x0 + 230, 180, 0.04, [0.65, 0.65, 0.7], 8);
  G.concrete.flat(A.x0 + 20, 120, A.x1 - 20, 180, 0.04, ONE, 10);
  G.asphalt2.flat(-HALF - 70, -20, -C + hw, 20, 0.03, ONE, 8);
  for (const [px, pz] of [[A.x0 + 300, 150], [A.x0 + 420, 150]]) { const m = G.misc; m.box(px - 20, 2, pz - 2, px + 20, 6, pz + 2, [0.95, 0.95, 0.97]); m.box(px + 20, 2.5, pz - 1.5, px + 24, 5.5, pz + 1.5, [0.9, 0.9, 0.92]); m.box(px - 4, 3, pz - 18, px + 4, 3.6, pz + 18, [0.9, 0.9, 0.93]); m.box(px - 20, 4, pz - 0.3, px - 16, 11, pz + 0.3, [0.85, 0.2, 0.25]); m.box(px - 20, 4.5, pz - 6, px - 17, 5, pz + 6, [0.9, 0.9, 0.93]); for (const o of [-8, 8]) m.box(px - 1, 0, pz + o - 0.4, px + 1, 2.2, pz + o + 0.4, [0.2, 0.2, 0.22]); }
  // port docks + cranes
  G.concrete.box(PORT.x0, -3, PORT.z0, PORT.x1, 1.2, PORT.z1, ONE, 4, 4, G.concrete, 10);
  for (let k = 0; k < 3; k++) { const x = PORT.x0 + 120 + k * 150, z = PORT.z1 - 14; for (const [ox, oz] of [[-8, -6], [8, -6], [-8, 6], [8, 6]]) G.misc.box(x + ox - 0.6, 1.2, z + oz - 0.6, x + ox + 0.6, 40, z + oz + 0.6, [0.9, 0.55, 0.12]); G.misc.box(x - 9, 38, z - 30, x + 9, 41, z + 26, [0.9, 0.55, 0.12]); G.misc.box(x - 5, 41, z - 2, x + 5, 46, z + 6, [0.85, 0.85, 0.88]); }
  // beach
  for (let z = -HALF - 90; z < LAND.z1; z += 40) G.sand.quad([BEACH_X - 10, 0.01, z + 40], [LAND.x1, -2.2, z + 40], [LAND.x1, -2.2, z], [BEACH_X - 10, 0.01, z], [0, 1, 0], [[(BEACH_X - 10) / 6, -(z + 40) / 6], [LAND.x1 / 6, -(z + 40) / 6], [LAND.x1 / 6, -z / 6], [(BEACH_X - 10) / 6, -z / 6]], ONE);
  for (let z = -HALF + 40; z < HALF; z += 150) { const x = BEACH_X + 27; for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) G.misc.box(x + ox - 0.1, heightAt(x, z), z + oz - 0.1, x + ox + 0.1, 3, z + oz + 0.1, [0.9, 0.9, 0.9]); G.misc.box(x - 1.5, 3, z - 1.5, x + 1.5, 5.5, z + 1.5, [0.95, 0.35, 0.35]); }
  // pier
  G.misc.box(PIER.x0, -1.2, PIER.z0, PIER.x1, -0.1, PIER.z1, [0.55, 0.4, 0.3]);
  for (let x = PIER.x0 + 15; x < PIER.x1; x += 12) for (const z of [140.4, 155.6]) G.misc.box(x - 0.25, -4, z - 0.25, x + 0.25, 0.9, z + 0.25, [0.4, 0.3, 0.22]);
  return G;
}

function Terrain({ mats }: { mats: Mats }) {
  const geo = useMemo(() => {
    const x0 = LAND.x0, x1 = LAND.x1, z0 = LAND.z0, z1 = -HALF - 40, nx = 300, nz = 80;
    // a regular grid, with extra columns and rows where the Shinkansen cuts into the hills (the cutting, the portal)
    let xs: number[] = [], zs: number[] = [];
    for (let i = 0; i <= nx; i++) xs.push(x0 + ((x1 - x0) * i) / nx);
    for (let j = 0; j <= nz; j++) zs.push(z0 + ((z1 - z0) * j) / nz);
    if (TUN.on) {
      for (const o of [0, 3, 6.2, 9, 12.9, 13.1, 16, 20, 24, 30, 40, 55]) { xs.push(TUN.x + o); if (o) xs.push(TUN.x - o); }
      for (let z = TUN.portal + 0.6; z < -HALF - 40; z += 6) zs.push(z);
      zs.push(TUN.portal - 1, TUN.portal - 6);
    }
    const uniq = (a: number[]) => { a.sort((p, q) => p - q); return a.filter((v, i) => i === 0 || v - a[i - 1] > 0.05); };
    xs = uniq(xs); zs = uniq(zs);
    const W = xs.length, H = zs.length, pos = new Float32Array(W * H * 3), uv = new Float32Array(W * H * 2), idx: number[] = [];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i, x = xs[i], z = zs[j]; pos[k * 3] = x; pos[k * 3 + 1] = heightAt(x, z); pos[k * 3 + 2] = z; uv[k * 2] = ((x - x0) / (x1 - x0)) * 140; uv[k * 2 + 1] = ((z1 - z) / (z1 - z0)) * 80; }
    // the mouth of the bore stays open: no ground across it at the portal
    const hole = (i: number, j: number) => TUN.on && Math.abs(xs[i] - TUN.x) < TUN.hw + 0.65 && Math.abs(xs[i + 1] - TUN.x) < TUN.hw + 0.65 && zs[j] > TUN.portal - 1.05 && zs[j + 1] < TUN.portal + 0.65;
    for (let j = 0; j + 1 < H; j++) for (let i = 0; i + 1 < W; i++) { if (hole(i, j)) continue; const a = j * W + i, b = a + 1, c = a + W, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeVertexNormals();
    const p = g.attributes.position as THREE.BufferAttribute, n = g.attributes.normal as THREE.BufferAttribute, cols: number[] = [];
    for (let i = 0; i < p.count; i++) { const h = p.getY(i), sl = 1 - n.getY(i), t = Math.min(1, h / 200); const c = new THREE.Color().setRGB(0.36 + t * 0.25, 0.48 + t * 0.12, 0.26 + t * 0.12); if (sl > 0.18) c.lerp(new THREE.Color(0.5, 0.47, 0.44), Math.min(1, (sl - 0.18) * 4)); cols.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    return g;
  }, []);
  return <mesh geometry={geo} material={mats.dirt} receiveShadow />;
}

/** Ocean: three scrolling wave layers at different scales and directions, crisp sun glints, deep blue-green. */
const waterTime = { value: 0 };
function Water({ mats }: { mats: Mats }) {
  useFrame((_, dt) => { waterTime.value += dt; });
  useMemo(() => {
    const m = mats.water, t = m.normalMap!; t.repeat.set(260, 260);
    m.color.set(REGION.id === 'naha' ? '#0f6f7e' : '#0b3a52'); m.roughness = 0.12; // Naha: clear turquoise sea m.metalness = 0.0; m.normalScale.set(0.5, 0.5); m.envMapIntensity = 0.55; m.opacity = 0.96;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uWaterT = waterTime;
      sh.fragmentShader = 'uniform float uWaterT;\n' + sh.fragmentShader.replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
        `vec3 n1 = texture2D( normalMap, vNormalMapUv + vec2( uWaterT * 0.0040, uWaterT * 0.0021 ) ).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D( normalMap, vNormalMapUv * 0.31 + vec2( -uWaterT * 0.0016, uWaterT * 0.0024 ) ).xyz * 2.0 - 1.0;
        vec3 n3 = texture2D( normalMap, vNormalMapUv * 2.7 + vec2( uWaterT * 0.0090, -uWaterT * 0.0060 ) ).xyz * 2.0 - 1.0;
        vec3 mapN = vec3( n1.xy * 0.8 + n2.xy * 1.3 + n3.xy * 0.45, 1.0 );`);
    };
    m.needsUpdate = true;
  }, [mats]);
  return <mesh rotation-x={-Math.PI / 2} position={[0, WATER_Y, 0]} material={mats.water}><planeGeometry args={[12000, 12000]} /></mesh>;
}

function DoorMarkers() {
  return <>{doors.map((d) => <DoorMarker key={d.id} d={d} />)}</>;
}
function DoorMarker({ d }: { d: (typeof doors)[number] }) {
  const t = useMemo(() => labelTexture(d.label, d.color), [d]);
  const ring = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => { if (ring.current) { const s = 1 + Math.sin(clock.elapsedTime * 3) * 0.08; ring.current.scale.set(s, s, 1); } });
  return (
    <group position={[d.x, 0.17, d.z]} rotation-y={d.ang}>
      <mesh ref={ring} rotation-x={-Math.PI / 2}><ringGeometry args={[0.9, 1.15, 32]} /><meshBasicMaterial color={d.color} toneMapped={false} transparent opacity={0.85} /></mesh>
      <mesh position={[0, 4.2, -0.68]}><planeGeometry args={[4.4, 1.1]} /><meshBasicMaterial map={t} toneMapped={false} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 1.2, -0.74]}><boxGeometry args={[1.6, 2.4, 0.1]} /><meshStandardMaterial color="#2a2f3a" metalness={0.5} roughness={0.3} /></mesh>
    </group>
  );
}

export default function City({ shadows }: { shadows: boolean }) {
  const mats = useMaterials();
  const ground = useMemo(() => { const G = buildGround(); return Object.entries(G).filter(([, g]) => !g.empty).map(([k, g]) => ({ k, geo: g.build() })); }, []);
  const pg = usePropGeos();
  const B = useMemo(() => Object.fromEntries((['lamps', 'trees', 'palms', 'pines', 'benches', 'bins', 'hydrants', 'containers', 'umbrellas', 'billboards', 'signals', 'poles', 'vends', 'shisa'] as const).map((n) => [n, bucket(props[n] as any[])] as [string, Map<string, any[]>]).concat([['walls', bucket(props.walls.map((w) => ({ ...w, x: (w.x0 + w.x1) / 2, z: (w.z0 + w.z1) / 2 })))]]).concat([['wires', bucket(props.wires.map((w) => ({ ...w, x: w.x0, z: w.z0 })))]])) as Record<string, Map<string, any[]>>, []);
  useFrame(() => { const h = game.hour, k = h > 18.4 || h < 6.4 ? 1.5 : h > 17.2 || h < 7.2 ? 1.15 : 0.92; propMats().vendFace.color.setScalar(k); });
  const adMats = useMemo(() => [['BUZZR', '#ff3f93'], ['QWIK 24', '#3dffb0'], ['BAY MOTORS', '#2be4ff'], ['THREADS', '#c07aff']].map(([t, c]) => new THREE.MeshBasicMaterial({ map: labelTexture(t, c, 512, 256), toneMapped: false })), []);
  const cells = useMemo(() => {
    const map = new Map<string, Cell>();
    const get = (cx: number, cz: number) => { const key = cx + ',' + cz; let c = map.get(key); if (!c) map.set(key, (c = { key, cx, cz, x: (cx + 0.5) * CH, z: (cz + 0.5) * CH, items: [], doors: [], paint: false, props: false })); return c; };
    for (const b of buildings) get(Math.floor((b.x0 + b.x1) / 2 / CH), Math.floor((b.z0 + b.z1) / 2 / CH)).items.push(b);
    for (const d of BDOORS) get(Math.floor(d.fx / CH), Math.floor(d.fz / CH)).doors.push(d);
    for (const m of Object.values(B)) for (const k of m.keys()) { const [cx, cz] = k.split(',').map(Number); get(cx, cz).props = true; }
    for (let cx = Math.floor(-HALF / CH); cx <= Math.floor(HALF / CH); cx++) for (let cz = Math.floor(-HALF / CH); cz <= Math.floor(HALF / CH); cz++) get(cx, cz).paint = true;
    return [...map.values()];
  }, [B]);
  const groundMat = (k: string) => (k === 'side' ? mats.sidewalk : k === 'asphalt2' || k === 'road' ? mats.asphalt : (mats as any)[k] || mats.misc);
  useMemo(() => { const T = getTextures(); T.asphalt.repeat.set(1, 1); }, []);
  return (
    <group>
      {/* base land + city asphalt */}
      {/* grass around the city only (not under the asphalt, where the two planes would z-fight at a distance) */}
      {([[LAND.x0, -HALF - 40, -HALF, LAND.z1], [HALF, -HALF - 40, BEACH_X - 10, LAND.z1], [-HALF, -HALF - 40, HALF, -HALF], [-HALF, HALF, HALF, LAND.z1]] as const).map(([x0, z0, x1, z1], i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[(x0 + x1) / 2, -0.05, (z0 + z1) / 2]} material={mats.grass} receiveShadow>
          <planeGeometry args={[x1 - x0, z1 - z0]} />
        </mesh>
      ))}
      {ground.map(({ k, geo }) => <mesh key={k} geometry={geo} material={groundMat(k)} receiveShadow castShadow={k === 'misc' && shadows} />)}
      <Terrain mats={mats} />
      <Water mats={mats} />
      <CityStream cells={cells} mats={mats} shadows={shadows} B={B} pg={pg} adMats={adMats} />
      <DoorMarkers />
    </group>
  );
}
