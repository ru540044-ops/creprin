import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Detailed } from '@react-three/drei';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Geo } from './geo';
import { getTextures, labelTexture } from './textures';
import { mulberry } from './rng';
import {
  blocks, buildings, props, doors, Building, BType, N, ROAD, PITCH, HALF, CITY, HWY_C, HWY_W, roadC, LAND, PORT, AIRPORT, BEACH_X, heightAt, WATER_Y,
} from './cityGen';
import { game } from '../state/store';

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
      glass: fac(T.glass, 0.55), office: fac(T.office, 0.1), brick: fac(T.brick, 0.02), shop: fac(T.shop, 0.05, 1.3), house: fac(T.house, 0.02, 0.9), warehouse: fac(T.warehouse, 0.3, 0.6), terminal: fac(T.terminal, 0.5), hangar: fac(T.warehouse, 0.35, 0.4),
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
      water: std({ color: '#1d5f7a', roughness: 0.12, metalness: 0.25, normalMap: T.waterN, normalScale: new THREE.Vector2(0.28, 0.28), transparent: true, opacity: 0.93, envMapIntensity: 1.5 }),
    };
  }, []);
}
type Mats = ReturnType<typeof useMaterials>;

const FAC_SET = (t: BType) => { const T = getTextures(); return ({ glass: T.glass, office: T.office, brick: T.brick, shop: T.shop, house: T.house, warehouse: T.warehouse, terminal: T.terminal, hangar: T.warehouse } as const)[t]; };

/* ---------- chunked buildings with two LOD levels ---------- */
const CH = 300;
interface Chunk { cx: number; cz: number; hi: Record<string, Geo>; lo: Record<string, Geo>; items: Building[] }
function buildChunks(): Chunk[] {
  const map = new Map<string, Chunk>();
  const get = (x: number, z: number) => {
    const cx = Math.floor(x / CH), cz = Math.floor(z / CH), k = cx + ',' + cz;
    let c = map.get(k); if (!c) map.set(k, (c = { cx, cz, hi: {}, lo: {}, items: [] })); return c;
  };
  const g = (rec: Record<string, Geo>, k: string) => (rec[k] ||= new Geo());
  const r = mulberry(4242);
  for (const b of buildings) {
    const c = get((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2); c.items.push(b);
    const F = FAC_SET(b.type), top = b.y0 + b.h, col = b.tint;
    for (const lvl of [c.hi, c.lo]) {
      const hi = lvl === c.hi, wall = g(lvl, b.type);
      if (b.gable) {
        wall.box(b.x0, b.y0, b.z0, b.x1, top, b.z1, col, F.su, F.sv, null, 8, true, b.y0);
        g(lvl, 'tiles').gable(b.x0, b.z0, b.x1, b.z1, top, Math.min(4, (Math.min(b.x1 - b.x0, b.z1 - b.z0)) * 0.35), b.roofTint || [0.5, 0.3, 0.25], wall, col);
        if (hi) { const cx = b.x0 + (b.x1 - b.x0) * 0.25; g(lvl, 'misc').box(cx, top, (b.z0 + b.z1) / 2 - 0.5, cx + 1, top + 3.2, (b.z0 + b.z1) / 2 + 0.5, [0.55, 0.4, 0.35]); g(lvl, 'misc').box((b.x0 + b.x1) / 2 - 0.7, b.y0, b.z0 - 0.08, (b.x0 + b.x1) / 2 + 0.7, b.y0 + 2.2, b.z0, [0.35, 0.22, 0.16]); }
        continue;
      }
      const tall = b.type === 'glass' && b.h > 90 && hi;
      const mainTop = tall ? top - b.h * 0.18 : top;
      wall.box(b.x0, b.y0, b.z0, b.x1, mainTop, b.z1, col, F.su, F.sv, g(lvl, 'roof'), 8, true, b.y0);
      if (tall) { const ix = (b.x1 - b.x0) * 0.15, iz = (b.z1 - b.z0) * 0.15; wall.box(b.x0 + ix, mainTop, b.z0 + iz, b.x1 - ix, top, b.z1 - iz, col, F.su, F.sv, g(lvl, 'roof'), 8, true, b.y0); }
      if (!hi) continue;
      const m = g(lvl, 'misc'), cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      // rooftop machinery
      if (b.type !== 'terminal' && b.type !== 'hangar') for (let n = 0; n < 2 + Math.floor(r() * 3); n++) { const ax = b.x0 + 3 + r() * (b.x1 - b.x0 - 9), az = b.z0 + 3 + r() * (b.z1 - b.z0 - 7); m.box(ax, top, az, ax + 3 + r() * 3, top + 1.5 + r() * 1.5, az + 2 + r() * 2, [0.55, 0.56, 0.6]); }
      if (b.type === 'glass' && b.h > 70) { g(lvl, 'metal').box(cx - 0.3, top, cz - 0.3, cx + 0.3, top + 14, cz + 0.3, [0.7, 0.7, 0.75]); g(lvl, 'glow').box(cx - 0.6, top + 14, cz - 0.6, cx + 0.6, top + 15, cz + 0.6, [1, 0.15, 0.15]); }
      if (b.type === 'brick' && r() < 0.5) { const tx = b.x1 - 6, tz = b.z1 - 6; for (const [ox, oz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) m.box(tx + ox - 0.15, top, tz + oz - 0.15, tx + ox + 0.15, top + 3, tz + oz + 0.15, [0.3, 0.25, 0.2]); m.box(tx - 2, top + 3, tz - 2, tx + 2, top + 6.5, tz + 2, [0.5, 0.38, 0.28]); }
      if (b.type === 'shop') {
        const sides: [number, number, number, number, number][] = [[b.x0, b.z0 - 1.6, b.x1, b.z0, 0], [b.x0, b.z1, b.x1, b.z1 + 1.6, 0]];
        const aw = [[0.85, 0.2, 0.25], [0.15, 0.5, 0.35], [0.2, 0.35, 0.7], [0.9, 0.65, 0.15]][Math.floor(r() * 4)];
        for (const [a0, b0, a1, b1] of sides) { m.box(a0 + 1, b.y0 + 3.4, b0, a1 - 1, b.y0 + 3.7, b1, aw); g(lvl, 'glow').box(a0 + (a1 - a0) * 0.3, b.y0 + 4.1, b0 + (b1 - b0) * 0.5 - 0.12, a0 + (a1 - a0) * 0.7, b.y0 + 5, b0 + (b1 - b0) * 0.5 + 0.12, [[1, 0.3, 0.55], [0.25, 0.9, 1], [1, 0.8, 0.25], [0.4, 1, 0.55]][Math.floor(r() * 4)]); }
      }
      if (b.type === 'warehouse') for (let n = 0; n < 3; n++) { const dx = b.x0 + 6 + n * ((b.x1 - b.x0 - 12) / 2.5); m.box(dx, b.y0, b.z1, dx + 6, b.y0 + 5, b.z1 + 0.1, [0.25, 0.27, 0.3]); }
    }
  }
  return [...map.values()];
}

function ChunkMeshes({ geos, mats, shadows }: { geos: Record<string, Geo>; mats: Mats; shadows: boolean }) {
  const meshes = useMemo(() => Object.entries(geos).filter(([, g]) => !g.empty).map(([k, g]) => ({ k, geo: g.build() })), [geos]);
  return <>{meshes.map(({ k, geo }) => <mesh key={k} geometry={geo} material={(mats as any)[k] || mats.misc} castShadow={shadows && k !== 'glow'} receiveShadow />)}</>;
}

/* ---------- instanced props ---------- */
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function Inst({ geo, mat, items, colors, shadow = false }: { geo: THREE.BufferGeometry; mat: THREE.Material; items: { x: number; y?: number; z: number; a?: number; s?: number }[]; colors?: number[][]; shadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
    items.forEach((it, i) => { tmpQ.setFromAxisAngle(UP, it.a || 0); tmpS.setScalar(it.s || 1); tmpP.set(it.x, it.y || 0, it.z); tmpM.compose(tmpP, tmpQ, tmpS); m.setMatrixAt(i, tmpM); if (colors) m.setColorAt(i, new THREE.Color(colors[i][0], colors[i][1], colors[i][2])); });
    m.count = items.length; m.castShadow = shadow; m.receiveShadow = true; m.computeBoundingSphere();
    return m;
  }, [geo, mat, items, colors, shadow]);
  if (!items.length) return null;
  return <primitive object={mesh} ref={ref} />;
}

function usePropGeos() {
  return useMemo(() => {
    const merge = (parts: THREE.BufferGeometry[]) => { const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)), false)!; g.computeBoundingSphere(); return g; };
    const tr = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, rz = 0) => { g.rotateX(rx); g.rotateZ(rz); g.translate(x, y, z); return g; };
    const lampPole = merge([tr(new THREE.CylinderGeometry(0.09, 0.13, 7.5, 6), 0, 3.75, 0), tr(new THREE.BoxGeometry(0.1, 0.1, 2.2), 0, 7.4, 1.05)]);
    const lampHead = tr(new THREE.BoxGeometry(0.35, 0.12, 0.7), 0, 7.3, 2.1);
    const signalPole = merge([tr(new THREE.CylinderGeometry(0.1, 0.12, 5.5, 6), 0, 2.75, 0), tr(new THREE.BoxGeometry(0.12, 0.12, 4.2), 0, 5.3, -2.1), tr(new THREE.BoxGeometry(0.35, 1.1, 0.35), 0, 4.8, -4)]);
    const signalBulb = tr(new THREE.SphereGeometry(0.13, 6, 4), 0, 4.8, -4.2);
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
    return { lampPole, lampHead, signalPole, signalBulb, trunk, canopy, palmTrunk, palmTop, pine, bench, bin, hydrant, container, umbrella, billboardFrame, billboardPanel, pool };
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

function PropsChunk({ k, B, mats, pg, adMats }: { k: string; B: Record<string, Map<string, any[]>>; mats: Mats; pg: ReturnType<typeof usePropGeos>; adMats: THREE.Material[] }) {
  const pm = useMemo(() => ({
    pole: new THREE.MeshStandardMaterial({ color: '#2b2d33', roughness: 0.5, metalness: 0.6 }), trunk: new THREE.MeshStandardMaterial({ color: '#5a4030', roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, vertexColors: true }), palm: new THREE.MeshStandardMaterial({ color: '#3d7a3a', roughness: 0.9, side: THREE.DoubleSide, flatShading: true }),
    pine: new THREE.MeshStandardMaterial({ color: '#2a4d32', roughness: 1, flatShading: true }), wood: new THREE.MeshStandardMaterial({ color: '#7a5236', roughness: 0.8 }),
    bin: new THREE.MeshStandardMaterial({ color: '#2f4f3a', roughness: 0.6 }), red: new THREE.MeshStandardMaterial({ color: '#c2271d', roughness: 0.5 }),
    cont: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, metalness: 0.4 }), cloth: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }),
  }), []);
  useMemo(() => { for (const m of [pm.leaf, pm.palm, pm.pine]) addWind(m); }, [pm]);
  const L = (n: string) => B[n].get(k) || [];
  const lamps = L('lamps'), trees = L('trees'), palms = L('palms'), pines = L('pines');
  const leafCols = useMemo(() => trees.map((_, i) => [0.2 + ((i * 37) % 10) / 60, 0.42 + ((i * 13) % 10) / 50, 0.2]), [trees]);
  const conts = L('containers'), umbr = L('umbrellas'), bills = L('billboards');
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
      <Inst geo={pg.bench} mat={pm.wood} items={L('benches')} />
      <Inst geo={pg.bin} mat={pm.bin} items={L('bins')} />
      <Inst geo={pg.hydrant} mat={pm.red} items={L('hydrants')} />
      <Inst geo={pg.container} mat={pm.cont} items={conts} colors={conts.map((c: any) => c.c)} shadow />
      <Inst geo={pg.umbrella} mat={pm.cloth} items={umbr} colors={umbr.map((c: any) => c.c)} />
      <Inst geo={pg.billboardFrame} mat={pm.pole} items={bills} />
      {[0, 1, 2, 3].map((n) => <Inst key={n} geo={pg.billboardPanel} mat={adMats[n]} items={bills.filter((b: any) => b.c === n)} />)}
    </group>
  );
}

/* ---------- traffic signals (animated) ---------- */
export const signalState = (i: number, j: number, axis: number, t: number) => { let p = (t + ((i * 7 + j * 13) % 12)) % 24; if (axis) p = (p + 12) % 24; return p < 10 ? 0 : p < 12 ? 1 : 2; };
function Signals() {
  const pg = usePropGeos();
  const pole = useMemo(() => new THREE.MeshStandardMaterial({ color: '#25272c', roughness: 0.5, metalness: 0.6 }), []);
  const bulbMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), []);
  const items = props.signals;
  const bulbs = useMemo(() => { const m = new THREE.InstancedMesh(pg.signalBulb, bulbMat, items.length); items.forEach((it, i) => { tmpQ.setFromAxisAngle(UP, it.a); tmpP.set(it.x, 0, it.z); tmpS.setScalar(1); tmpM.compose(tmpP, tmpQ, tmpS); m.setMatrixAt(i, tmpM); m.setColorAt(i, new THREE.Color('#ff2020')); }); m.computeBoundingSphere(); return m; }, [items, pg, bulbMat]);
  const cols = useMemo(() => [new THREE.Color(0.2, 2, 0.6), new THREE.Color(2, 1.4, 0.1), new THREE.Color(2.2, 0.15, 0.1)], []);
  const last = useRef(-1);
  useFrame(() => {
    const tt = Math.floor(game.clock * 2) / 2; if (tt === last.current) return; last.current = tt;
    items.forEach((it, i) => bulbs.setColorAt(i, cols[signalState(it.i, it.j, it.axis, game.clock)]));
    bulbs.instanceColor!.needsUpdate = true;
  });
  return <group><Inst geo={pg.signalPole} mat={pole} items={items} /><primitive object={bulbs} /></group>;
}

/* ---------- ground, roads, markings, special areas ---------- */
function buildGround() {
  const G = { side: new Geo(), grass: new Geo(), paint: new Geo(), misc: new Geo(), concrete: new Geo(), sand: new Geo(), asphalt2: new Geo(), metal: new Geo(), glow: new Geo() };
  const W = [0.92, 0.92, 0.9], Y = [0.95, 0.75, 0.2], ONE = [1, 1, 1];
  for (const b of blocks) {
    G.side.box(b.x0, 0, b.z0, b.x1, 0.15, b.z1, ONE, 2, 2, G.side, 2);
    const m = 5;
    if (b.zone === 'park') { G.grass.flat(b.x0 + 2, b.z0 + 2, b.x1 - 2, b.z1 - 2, 0.17, ONE, 6); }
    else if (b.zone === 'residential') G.grass.flat(b.x0 + m, b.z0 + m, b.x1 - m, b.z1 - m, 0.16, ONE, 6);
    else if (b.zone === 'parking' || b.zone === 'gas') {
      G.asphalt2.flat(b.x0 + m, b.z0 + m, b.x1 - m, b.z1 - m, 0.16, ONE, 8);
      if (b.zone === 'parking') for (let x = b.x0 + 9; x < b.x1 - 20; x += 3.2) { G.paint.flat(x, b.z0 + 10, x + 0.15, b.z0 + 15.5, 0.18, W); G.paint.flat(x, b.z1 - 15.5, x + 0.15, b.z1 - 10, 0.18, W); }
      if (b.zone === 'gas') { const cx = (b.x0 + b.x1) / 2, cz = b.z0 + 25; G.misc.box(cx - 18, 5.4, cz - 9, cx + 18, 6.2, cz + 9, [0.92, 0.92, 0.95]); G.glow.box(cx - 18, 5.5, cz - 9.05, cx + 18, 6.1, cz - 8.95, [1, 0.35, 0.2]); for (const ox of [-12, 0, 12]) { G.misc.box(cx + ox - 0.25, 0.15, cz - 0.25, cx + ox + 0.25, 5.4, cz + 0.25, [0.8, 0.8, 0.82]); G.misc.box(cx + ox - 0.5, 0.15, cz + 2, cx + ox + 0.5, 1.7, cz + 2.8, [0.85, 0.2, 0.2]); G.misc.box(cx + ox - 0.5, 0.15, cz - 2.8, cx + ox + 0.5, 1.7, cz - 2, [0.85, 0.2, 0.2]); } }
    } else if (b.zone === 'industrial') G.concrete.flat(b.x0 + m, b.z0 + m, b.x1 - m, b.z1 - m, 0.16, ONE, 8);
    if (b.zone === 'park') { const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2; G.side.flat(cx - 1.6, b.z0 + 2, cx + 1.6, b.z1 - 2, 0.18, [0.9, 0.85, 0.75], 2); G.side.flat(b.x0 + 2, cz - 1.6, b.x1 - 2, cz + 1.6, 0.18, [0.9, 0.85, 0.75], 2); }
  }
  // road markings
  for (let k = 0; k <= N; k++) {
    const c = roadC(k);
    for (let s = 0; s < N; s++) {
      const a = -HALF + s * PITCH + ROAD + 2, b2 = a + PITCH - ROAD - 4;
      for (let t = a + 2; t < b2 - 3; t += 6) { G.paint.flat(c - 0.12, t, c + 0.12, t + 3, 0.02, Y); G.paint.flat(t, c - 0.12, t + 3, c + 0.12, 0.02, Y); }
      for (const o of [-ROAD / 2 + 0.5, ROAD / 2 - 0.6]) { G.paint.flat(c + o, a, c + o + 0.1, b2, 0.02, W); G.paint.flat(a, c + o, b2, c + o + 0.1, 0.02, W); }
    }
  }
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const x = roadC(i), z = roadC(j), h = ROAD / 2;
    for (let o = -h + 1; o < h - 0.5; o += 1.4) { G.paint.flat(x + o, z - h - 4, x + o + 0.7, z - h - 1, 0.02, W); G.paint.flat(x + o, z + h + 1, x + o + 0.7, z + h + 4, 0.02, W); G.paint.flat(x - h - 4, z + o, x - h - 1, z + o + 0.7, 0.02, W); G.paint.flat(x + h + 1, z + o, x + h + 4, z + o + 0.7, 0.02, W); }
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
  for (const k of [3, 7, 11]) { const c = roadC(k); G.asphalt2.flat(c - ROAD / 2, -C + hw, c + ROAD / 2, -HALF, 0.03, ONE, 8); G.asphalt2.flat(c - ROAD / 2, HALF, c + ROAD / 2, C - hw, 0.03, ONE, 8); G.asphalt2.flat(-C + hw, c - ROAD / 2, -HALF, c + ROAD / 2, 0.03, ONE, 8); G.asphalt2.flat(HALF, c - ROAD / 2, C - hw, c + ROAD / 2, 0.03, ONE, 8); }
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
  for (let z = LAND.z0 + 900; z < LAND.z1; z += 40) G.sand.quad([BEACH_X - 10, 0.01, z + 40], [LAND.x1, -2.2, z + 40], [LAND.x1, -2.2, z], [BEACH_X - 10, 0.01, z], [0, 1, 0], [[(BEACH_X - 10) / 6, -(z + 40) / 6], [LAND.x1 / 6, -(z + 40) / 6], [LAND.x1 / 6, -z / 6], [(BEACH_X - 10) / 6, -z / 6]], ONE);
  for (let z = -HALF + 40; z < HALF; z += 150) { const x = BEACH_X + 45; for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) G.misc.box(x + ox - 0.1, heightAt(x, z), z + oz - 0.1, x + ox + 0.1, 3, z + oz + 0.1, [0.9, 0.9, 0.9]); G.misc.box(x - 1.5, 3, z - 1.5, x + 1.5, 5.5, z + 1.5, [0.95, 0.35, 0.35]); }
  // pier
  G.misc.box(LAND.x1 - 20, -0.2, 140, LAND.x1 + 220, 0.6, 156, [0.55, 0.4, 0.3]);
  return G;
}

function Terrain({ mats }: { mats: Mats }) {
  const geo = useMemo(() => {
    const x0 = LAND.x0, x1 = LAND.x1, z0 = LAND.z0, z1 = -HALF - 40, nx = 150, nz = 80;
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const p = g.attributes.position as THREE.BufferAttribute, cols: number[] = [];
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), h = heightAt(x, z); p.setY(i, h); }
    g.computeVertexNormals();
    const n = g.attributes.normal as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const h = p.getY(i), sl = 1 - n.getY(i), t = Math.min(1, h / 200); const c = new THREE.Color().setRGB(0.36 + t * 0.25, 0.48 + t * 0.12, 0.26 + t * 0.12); if (sl > 0.18) c.lerp(new THREE.Color(0.5, 0.47, 0.44), Math.min(1, (sl - 0.18) * 4)); cols.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const uv = g.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 140, uv.getY(i) * 80);
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
    m.color.set('#0b3a52'); m.roughness = 0.12; m.metalness = 0.0; m.normalScale.set(0.5, 0.5); m.envMapIntensity = 0.55; m.opacity = 0.96;
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
  const chunks = useMemo(buildChunks, []);
  const ground = useMemo(() => { const G = buildGround(); return Object.entries(G).filter(([, g]) => !g.empty).map(([k, g]) => ({ k, geo: g.build() })); }, []);
  const pg = usePropGeos();
  const cityPlane = useMemo(() => { const g = new THREE.PlaneGeometry(CITY, CITY); g.rotateX(-Math.PI / 2); const uv = g.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (CITY / 10), uv.getY(i) * (CITY / 10)); return g; }, []);
  const B = useMemo(() => Object.fromEntries((['lamps', 'trees', 'palms', 'pines', 'benches', 'bins', 'hydrants', 'containers', 'umbrellas', 'billboards'] as const).map((n) => [n, bucket(props[n] as any[])])), []);
  const propKeys = useMemo(() => { const s = new Set<string>(); for (const m of Object.values(B)) for (const k of m.keys()) s.add(k); return [...s]; }, [B]);
  const adMats = useMemo(() => [['BUZZR', '#ff3f93'], ['QWIK 24', '#3dffb0'], ['BAY MOTORS', '#2be4ff'], ['THREADS', '#c07aff']].map(([t, c]) => new THREE.MeshBasicMaterial({ map: labelTexture(t, c, 512, 256), toneMapped: false })), []);
  const groundMat = (k: string) => (k === 'side' ? mats.sidewalk : k === 'asphalt2' ? mats.asphalt : (mats as any)[k] || mats.misc);
  useMemo(() => { const T = getTextures(); T.asphalt.repeat.set(1, 1); }, []);
  return (
    <group>
      {/* base land + city asphalt */}
      <mesh rotation-x={-Math.PI / 2} position={[(LAND.x0 + BEACH_X - 10) / 2, -0.05, (-HALF - 40 + LAND.z1) / 2]} material={mats.grass} receiveShadow>
        <planeGeometry args={[BEACH_X - 10 - LAND.x0, LAND.z1 + HALF + 40]} />
      </mesh>
      <mesh geometry={cityPlane} material={mats.asphalt} receiveShadow />
      {ground.map(({ k, geo }) => <mesh key={k} geometry={geo} material={groundMat(k)} receiveShadow castShadow={k === 'misc' && shadows} />)}
      <Terrain mats={mats} />
      <Water mats={mats} />
      {chunks.map((c) => {
        const cx = (c.cx + 0.5) * CH, cz = (c.cz + 0.5) * CH, k = c.cx + ',' + c.cz;
        return (
          <Detailed key={k} distances={[0, 480, 2600]} position={[cx, 0, cz]}>
            <group position={[-cx, 0, -cz]}><ChunkMeshes geos={c.hi} mats={mats} shadows={shadows} />{propKeys.includes(k) && <PropsChunk k={k} B={B} mats={mats} pg={pg} adMats={adMats} />}</group>
            <group position={[-cx, 0, -cz]}><ChunkMeshes geos={c.lo} mats={mats} shadows={false} /></group>
            <group />
          </Detailed>
        );
      })}
      {propKeys.filter((k) => !chunks.some((c) => c.cx + ',' + c.cz === k)).map((k) => {
        const [a, b] = k.split(',').map(Number), cx = (a + 0.5) * CH, cz = (b + 0.5) * CH;
        return <Detailed key={'p' + k} distances={[0, 520]} position={[cx, 0, cz]}><group position={[-cx, 0, -cz]}><PropsChunk k={k} B={B} mats={mats} pg={pg} adMats={adMats} /></group><group /></Detailed>;
      })}
      <Signals />
      <DoorMarkers />
    </group>
  );
}
