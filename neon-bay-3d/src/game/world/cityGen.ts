import { mulberry, fbm, smooth, clamp } from './rng';
import { REGION, inTokyo, RegionId } from './region';

const RN = REGION.names;

/* World units are meters. x = east, z = south, y = up. */
export const ROAD = 14, BLOCK = 86, PITCH = ROAD + BLOCK, N = REGION.N; // Tokyo 40x40, Osaka 28, Fukuoka 24, Naha 20
/** The original 14x14 city is the core; a ring of O blocks was added around it (same generator, same seeds for the core). */
export const CORE = 14, O = (N - CORE) / 2;
/** The 20x20 city of the previous release (core + first ring) is kept exactly; the outer districts surround it. */
export const MID = 3;
export const CITY = N * PITCH + ROAD; // 4014 m
export const HALF = CITY / 2; // city spans -HALF..HALF on x and z
export const HWY_W = 26, HWY_C = HALF + 33; // ring highway centerline offset
/** Road lines that connect the city edge to the ring highway. */
export const HWY_LINKS = Array.from({ length: N / 4 }, (_, k) => 2 + k * 4);
export const WATER_Y = -0.8;

export const roadC = (k: number) => -HALF + k * PITCH + ROAD / 2; // center of road line k (0..N)
export const blockX0 = (i: number) => -HALF + i * PITCH + ROAD;
/** Block containing (x, z), or undefined on a road / outside the city. */
export function blockAt(x: number, z: number): BlockInfo | undefined {
  const i = Math.floor((x + HALF - ROAD) / PITCH), j = Math.floor((z + HALF - ROAD) / PITCH);
  if (i < 0 || j < 0 || i >= N || j >= N) return undefined;
  const b = blocks[j * N + i]; return b && x >= b.x0 - 1 && x <= b.x1 + 1 && z >= b.z0 - 1 && z <= b.z1 + 1 ? b : undefined;
}
export const blockOfB = (b: { x0: number; x1: number; z0: number; z1: number }) => blockAt((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);

export type Zone = 'downtown' | 'commercial' | 'residential' | 'industrial' | 'park' | 'parking' | 'gas' | 'canal' | 'station' | 'water';
export type BType = 'glass' | 'office' | 'brick' | 'house' | 'warehouse' | 'shop' | 'terminal' | 'hangar';

export interface Building { x0: number; z0: number; x1: number; z1: number; y0: number; h: number; type: BType; tint: [number, number, number]; gable?: boolean; roofTint?: [number, number, number]; /** a named public building (its interior is a concourse) */ name?: string;
  /** house roof shape (gable by default) and regional style */ roof?: 'hip' | 'flat'; style?: 'machiya' | 'okinawa'; carport?: boolean; }
export interface Solid { x0: number; z0: number; x1: number; z1: number; y0: number; y1: number; }
export interface Door { id: string; x: number; z: number; ang: number; label: string; interior: string; color: string; }
export interface BlockInfo { i: number; j: number; x0: number; z0: number; x1: number; z1: number; zone: Zone; }

export const blocks: BlockInfo[] = [];
export const buildings: Building[] = [];
export const solids: Solid[] = [];
export const doors: Door[] = [];
export const props = {
  lamps: [] as { x: number; z: number; a: number }[],
  signals: [] as { x: number; z: number; a: number; axis: 0 | 1; i: number; j: number }[],
  trees: [] as { x: number; z: number; s: number; y: number; c?: [number, number, number] }[],
  palms: [] as { x: number; z: number; s: number; y: number }[],
  pines: [] as { x: number; z: number; s: number; y: number }[],
  benches: [] as { x: number; z: number; a: number; y?: number }[],
  bins: [] as { x: number; z: number }[],
  hydrants: [] as { x: number; z: number }[],
  containers: [] as { x: number; z: number; y: number; a: number; c: [number, number, number] }[],
  billboards: [] as { x: number; z: number; y: number; a: number; w: number; c: number }[],
  umbrellas: [] as { x: number; z: number; y: number; c: [number, number, number] }[],
  /** Japanese utility poles (a = direction the cross-arm faces), the wires strung between them, vending machines */
  poles: [] as { x: number; z: number; a: number; tr: boolean }[],
  wires: [] as { x0: number; z0: number; x1: number; z1: number }[],
  vends: [] as { x: number; z: number; a: number; c: [number, number, number] }[],
  shisa: [] as { x: number; z: number; y: number; a: number }[],
  walls: [] as { x0: number; z0: number; x1: number; z1: number; lime: boolean }[],
};

/* ---------- zones ---------- */
const SPECIAL: Record<string, Zone> = { '9,3': 'park', '10,3': 'park', '9,4': 'park', '10,4': 'park', '3,4': 'park', '10,11': 'park', '2,2': 'parking', '11,8': 'parking', '5,11': 'parking', '0,6': 'gas', '13,9': 'gas' };
/** Outer-ring districts (core coordinates outside 0..CORE-1). */
const RING_SPECIAL: Record<string, Zone> = { '-2,-2': 'park', '-1,6': 'gas', '6,-2': 'gas', '15,10': 'gas', '-2,11': 'parking', '9,-2': 'park', '3,-2': 'park', '15,4': 'park', '-2,3': 'park', '16,15': 'parking', '7,15': 'gas' };
export type Ring = 'north' | 'east' | 'south' | 'west' | 'uptown' | '';
export function ringOf(ci: number, cj: number): Ring {
  const inI = ci >= 0 && ci < CORE, inJ = cj >= 0 && cj < CORE;
  if (inI && inJ) return '';
  if (ci >= CORE && cj < 0) return 'uptown';
  if (cj >= CORE) return 'south';
  if (ci >= CORE) return 'east';
  if (ci < 0) return 'west';
  return 'north';
}
/** Outer districts (beyond the 20x20 city): eight sectors around the core. */
export type Outer = 'midtown' | 'eastbay' | 'techpark' | 'portside' | 'oldtown' | 'westgate' | 'greenvalley' | 'northhills' | '';
export const OUTER_NAMES: Record<Exclude<Outer, ''>, string> = { midtown: 'ミッドタウン', eastbay: 'イーストベイ', techpark: 'テックパーク', portside: 'ポートサイド', oldtown: 'オールドタウン', westgate: 'ウエストゲート', greenvalley: 'グリーンバレー', northhills: 'ノースヒルズ' };
export const MIDTOWN = { ci: 21, cj: -8 }; // centre of the second skyline (core block coordinates)
export function outerOf(ci: number, cj: number): Outer {
  if (ci >= -MID && ci < CORE + MID && cj >= -MID && cj < CORE + MID) return '';
  const rx = ci - (CORE - 1) / 2, rz = cj - (CORE - 1) / 2, a = Math.atan2(rz, rx) * 180 / Math.PI; // 0 = east, 90 = south
  if (a >= -22.5 && a < 22.5) return 'eastbay';
  if (a >= 22.5 && a < 67.5) return 'techpark';
  if (a >= 67.5 && a < 112.5) return 'portside';
  if (a >= 112.5 && a < 157.5) return 'oldtown';
  if (a >= 157.5 || a < -157.5) return 'westgate';
  if (a >= -157.5 && a < -112.5) return 'greenvalley';
  if (a >= -112.5 && a < -67.5) return 'northhills';
  return 'midtown';
}
function outerZone(o: Exclude<Outer, ''>, ci: number, cj: number): Zone {
  const h = (ci * 83492791) ^ (cj * 2971215073), u = ((h >>> 0) % 1000) / 1000;
  if (u > 0.993 && o !== 'portside' && o !== 'midtown') return 'gas';
  switch (o) {
    case 'midtown': { const d = Math.hypot(ci - MIDTOWN.ci, cj - MIDTOWN.cj); return d < 4.6 ? (u < 0.06 ? 'park' : 'downtown') : u < 0.12 ? 'park' : u < 0.7 ? 'commercial' : 'residential'; }
    case 'eastbay': return u < 0.07 ? 'park' : cj % 3 === 0 ? 'downtown' : u < 0.75 ? 'commercial' : 'residential';
    case 'techpark': return u < 0.14 ? 'park' : u < 0.55 ? 'downtown' : u < 0.94 ? 'commercial' : 'parking';
    case 'portside': return u < 0.82 ? 'industrial' : u < 0.86 ? 'parking' : 'commercial';
    case 'oldtown': return u < 0.08 ? 'park' : u < 0.42 ? 'commercial' : 'residential';
    case 'westgate': return u < 0.07 ? 'parking' : u < 0.36 ? 'commercial' : u < 0.45 ? 'park' : 'residential';
    case 'greenvalley': return u < 0.22 ? 'park' : 'residential';
    case 'northhills': return u < 0.13 ? 'park' : u < 0.2 ? 'commercial' : 'residential';
  }
}
/** Tower height falloff for a downtown block (0 = tallest). */
function towerFall(ci: number, cj: number) {
  if (!inTokyo()) { const c = (N - 1) / 2, i = ci + O, j = cj + O, cs: [number, number][] = REGION.id === 'osaka' ? [[c, c - 6], [c - 1, c + 3]] : REGION.id === 'fukuoka' ? [[c - 3, c - 1], [c + 5, c + 1]] : [[c + 2, c - 7]]; return Math.min(1.25, Math.min(...cs.map(([a, b]) => Math.hypot(i - a, j - b))) / 3); }
  const o = outerOf(ci, cj);
  if (o === 'midtown') return Math.min(1.25, Math.hypot(ci - MIDTOWN.ci, cj - MIDTOWN.cj) / 4.6);
  if (o) return o === 'eastbay' ? 0.95 : 1.15;
  const c = (CORE - 1) / 2; return Math.min(1.25, Math.hypot(ci - c, cj - c) / c) * (ringOf(ci, cj) ? 0.62 : 1);
}
/** Block (grid coordinates) the region's landmark stands in. */
export const LM_BLOCK = { i: REGION.landmark.ci + O, j: REGION.landmark.cj + O };
/* ---------- canals (Osaka's Dotonbori, Fukuoka's river): a channel through a row / column of blocks, bridged by the cross streets ---------- */
export const PROM = 5;
export interface WaterRect { x0: number; z0: number; x1: number; z1: number; axis: 'x' | 'z' | 'pond'; name: string; w: number; blk: number }
/** Channels (rivers, canals) and ponds inside blocks; the streets cross them on bridges. */
export const CANAL_BLOCKS = new Map<number, WaterRect>();
export const CANAL_RECTS: WaterRect[] = [];
/* ---------- the sea cutting into the city: whole blocks of water, the streets end at the quay ---------- */
const hash01 = (a: number, b: number) => ((((a * 73856093) ^ (b * 19349663) ^ (REGION.idx * 2654435761)) >>> 0) % 1000) / 1000;
export const BAY = new Set<number>();
{
  const bay = REGION.bay, inCore = (i: number, j: number) => i >= O - 1 && i <= O + CORE && j >= O - 1 && j <= O + CORE;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (inCore(i, j) || ((i === N / 2 || i === N / 2 - 1) && j < 2)) continue; // keep the core and the corner the highway time trial enters by (the railways cross the water on their viaducts)
    const n = hash01(i, j) * 1.6 + Math.sin(j * 0.55) * 0.9 + Math.sin(i * 0.47 + 1) * 0.9;
    let w = false;
    if (bay === 'southeast') w = i + j > 2 * N - 13 + n && i > N - 11 && j > N - 12;
    else if (bay === 'west') w = i <= 1.6 + n && j > 2 && j < N - 3 || (i <= 4 + n * 0.5 && Math.abs(j - N * 0.62) < 1.5);
    else if (bay === 'north') w = j <= 1.6 + n && i > 1 && i < N - 2;
    if (w) BAY.add(j * N + i);
  }
}
for (const C of REGION.canals ?? []) for (let t = C.from; t <= C.to; t++) {
  const i = C.axis === 'x' ? t + O : C.at + O, j = C.axis === 'x' ? C.at + O : t + O, k = j * N + i, w = C.w ?? 24;
  if (i < 1 || j < 1 || i >= N - 1 || j >= N - 1 || BAY.has(k) || CANAL_BLOCKS.has(k)) continue;
  const x0 = blockX0(i), z0 = blockX0(j), c = (C.axis === 'x' ? z0 : x0) + BLOCK / 2;
  const R: WaterRect = C.axis === 'x' ? { x0, z0: c - w / 2, x1: x0 + BLOCK, z1: c + w / 2, axis: 'x', name: C.name, w, blk: k } : { x0: c - w / 2, z0, x1: c + w / 2, z1: z0 + BLOCK, axis: 'z', name: C.name, w, blk: k };
  CANAL_BLOCKS.set(k, R); CANAL_RECTS.push(R);
}
for (const [ci, cj] of REGION.ponds ?? []) { const i = ci + O, j = cj + O, k = j * N + i; if (i < 1 || j < 1 || i >= N - 1 || j >= N - 1 || BAY.has(k) || CANAL_BLOCKS.has(k)) continue; const x0 = blockX0(i), z0 = blockX0(j); const R: WaterRect = { x0: x0 + 9, z0: z0 + 9, x1: x0 + BLOCK - 9, z1: z0 + BLOCK - 9, axis: 'pond', name: '池', w: BLOCK - 18, blk: k }; CANAL_BLOCKS.set(k, R); CANAL_RECTS.push(R); }
/** Is this block water (the sea)? Road segments and junctions between water blocks are water too. */
export const isBay = (i: number, j: number) => i >= 0 && j >= 0 && i < N && j < N && BAY.has(j * N + i);
const blockExists = (i: number, j: number) => i >= 0 && j >= 0 && i < N && j < N;
/** Road segment open? axis 'x': the east-west road on z-line k between x-lines s and s+1; axis 'z': the north-south road on x-line k between z-lines s and s+1. */
export function segOpen(axis: 'x' | 'z', k: number, s: number): boolean {
  if (!BAY.size) return true;
  const a: [number, number][] = axis === 'x' ? [[s, k - 1], [s, k]] : [[k - 1, s], [k, s]];
  const ex = a.filter(([i, j]) => blockExists(i, j)); return !ex.length || ex.some(([i, j]) => !isBay(i, j));
}
/** Junction of x-line i and z-line j open? */
export function nodeOpen(i: number, j: number): boolean {
  if (!BAY.size) return true;
  const a: [number, number][] = [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]];
  const ex = a.filter(([p, q]) => blockExists(p, q)); return !ex.length || ex.some(([p, q]) => !isBay(p, q));
}
/** Is (x, z) in the sea inside the city (a bay block, or a street that ends at the quay)? */
export function inBay(x: number, z: number): boolean {
  if (!BAY.size) return false;
  const lx = x + HALF, lz = z + HALF; if (lx < 0 || lz < 0 || lx > CITY || lz > CITY) return false;
  const rx = lx - Math.floor(lx / PITCH) * PITCH, rz = lz - Math.floor(lz / PITCH) * PITCH, kx = Math.floor(lx / PITCH), kz = Math.floor(lz / PITCH);
  const onX = rx < ROAD, onZ = rz < ROAD; // on a north-south road line / an east-west road line
  if (onX && onZ) return !nodeOpen(kx, kz);
  if (onX) return !segOpen('z', kx, kz);
  if (onZ) return !segOpen('x', kz, kx);
  return isBay(kx, kz);
}
export const inCanal = (x: number, z: number) => { for (const r of CANAL_RECTS) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return true; return false; };
export const canalAt = (x: number, z: number) => { for (const r of CANAL_RECTS) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return r; return null; };
/** The main station building stands east of the elevated railway, level with its middle station. */
export const STATION_BLOCK = { i: O + 12, j: N / 2 };
/** Blocks kept open for a signature place (they become plazas / parks). */
export const SIG_BLOCKS = new Map<number, 'temple' | 'skytower' | 'shinsekai' | 'dome'>();
{
  const put = (ci: number, cj: number, tag: 'temple' | 'skytower' | 'shinsekai' | 'dome', abs = false) => { const i = abs ? ci : ci + O, j = abs ? cj : cj + O; if (i > 0 && j > 0 && i < N - 1 && j < N - 1) SIG_BLOCKS.set(j * N + i, tag); };
  if (REGION.id === 'tokyo') { put(-10, 21, 'temple'); put(-7, 19, 'skytower'); }
  if (REGION.id === 'osaka') put(3, 12, 'shinsekai');
  if (REGION.id === 'fukuoka') put(N - 2, Math.round(N * 0.4), 'dome', true);
}
/** The regional cities (Osaka, Fukuoka, Naha): a compact centre, a shopping ring and main streets, an industrial quarter by the port, houses beyond. */
function regionZone(i: number, j: number): Zone {
  if (REGION.landmark.kind !== 'seatower' && i === LM_BLOCK.i && j === LM_BLOCK.j) return 'park';
  const c = (N - 1) / 2, dx = i - c, dz = j - c, u = hash01(i * 3 + 1, j * 5 + 2), D = (a: number, b: number) => Math.hypot(i - a, j - b);
  const rest = (pk = 0.09): Zone => (u > 0.985 ? 'gas' : u < pk ? 'park' : u < pk + 0.04 ? 'parking' : u < pk + 0.11 ? 'commercial' : 'residential');
  if (REGION.id === 'osaka') {
    // two centres: Kita (Umeda) in the north, Minami (Namba / Shinsaibashi) in the south, joined by the Midosuji boulevard;
    // the castle park in the east, factories and docks along the bay in the west
    const kita = D(c, c - 6), minami = D(c - 1, c + 3);
    if (kita < 2.7) return u < 0.05 ? 'park' : 'downtown';
    if (minami < 1.7) return 'downtown';
    if (minami < 3.6) return u < 0.08 ? 'parking' : 'commercial';
    if (Math.abs(dx) < 1 && dz > -7 && dz < 6) return 'commercial';
    if (D(LM_BLOCK.i, LM_BLOCK.j) < 1.8) return 'park';
    if (i < 7) return u < 0.72 ? 'industrial' : u < 0.84 ? 'parking' : 'commercial';
    if (kita < 5.2) return u < 0.12 ? 'park' : u < 0.7 ? 'commercial' : 'residential';
    return rest();
  }
  if (REGION.id === 'fukuoka') {
    // Tenjin (shops and offices) west of the river, Hakata (station, offices) east of it, Ohori park in the west,
    // the seaside along the bay in the north, warehouses in the south-east
    const tenjin = D(c - 3, c - 1), hakata = D(c + 5, c + 1);
    if (tenjin < 2.2) return 'downtown';
    if (tenjin < 4) return u < 0.08 ? 'park' : 'commercial';
    if (hakata < 1.8) return 'downtown';
    if (hakata < 3.4) return u < 0.1 ? 'parking' : 'commercial';
    if (j < 6) return u < 0.25 ? 'park' : u < 0.55 ? 'commercial' : 'residential';
    if (dx > 6 && dz > 5) return u < 0.75 ? 'industrial' : 'parking';
    return rest(0.1);
  }
  // Naha: the new downtown (Omoromachi) in the north, Kokusai street running south through the old centre,
  // the port in the south-west, Shuri's hills of houses in the east
  const shin = D(c + 2, c - 7);
  if (shin < 2.3) return u < 0.08 ? 'park' : 'downtown';
  if (Math.abs(i - Math.floor(c)) < 1 && dz > -4 && dz < 6) return 'commercial';
  if (D(c, c + 1) < 2.6) return u < 0.12 ? 'parking' : 'commercial';
  if (i < 7 && j > c + 2) return u < 0.7 ? 'industrial' : u < 0.82 ? 'parking' : 'commercial';
  if (dx > 4) return rest(0.12);
  return rest(0.12);
}
function zoneOf(i: number, j: number): Zone {
  if (i === STATION_BLOCK.i && j === STATION_BLOCK.j) return 'station';
  if (BAY.has(j * N + i)) return 'water';
  { const C = CANAL_BLOCKS.get(j * N + i); if (C) return C.axis === 'pond' ? 'park' : 'canal'; }
  if (SIG_BLOCKS.has(j * N + i)) return 'park';
  if (!inTokyo()) return regionZone(i, j);
  const ci = i - O, cj = j - O, outer = outerOf(ci, cj);
  if (outer) return outerZone(outer, ci, cj);
  const ring = ringOf(ci, cj);
  if (ring) {
    const s = RING_SPECIAL[ci + ',' + cj]; if (s) return s;
    const h = (ci * 73856093) ^ (cj * 19349663), u = ((h >>> 0) % 1000) / 1000;
    if (ring === 'uptown') return 'downtown';
    if (ring === 'south') return u < 0.7 ? 'industrial' : 'commercial';
    if (ring === 'east') return (cj & 1) === 0 && cj > 1 && cj < 12 ? 'downtown' : 'commercial';
    if (ring === 'west') return ci === -1 ? 'commercial' : u < 0.2 ? 'parking' : 'residential';
    return u < 0.15 ? 'commercial' : 'residential';
  }
  i = ci; j = cj;
  const s = SPECIAL[i + ',' + j]; if (s) return s;
  if (i <= 3 && j >= 10) return 'industrial';
  const c = (CORE - 1) / 2, d = Math.max(Math.abs(i - c), Math.abs(j - c));
  if (d < 2.6) return 'downtown';
  if (d < 4.6) return 'commercial';
  return 'residential';
}

/* ---------- terrain ---------- */
// Land: a big rectangle (city + airport + hills) plus the port pier; everything else is sea.
export const LAND = { x0: -HALF - 793, x1: HALF + 160, z0: -HALF - 993, z1: HALF + 70 };
export const PORT = { x0: 160, x1: HALF + 200, z0: HALF + 70, z1: HALF + 330 };
export const AIRPORT = { x0: -HALF - 753, x1: -HALF - 70, z0: -420, z1: 420 };
export const BEACH_X = HALF + 70; // sand from here to LAND.x1
export function heightAt(x: number, z: number): number {
  if ((CANAL_RECTS.length && inCanal(x, z)) || inBay(x, z)) return WATER_Y - 3;
  const inPort = x > PORT.x0 && x < PORT.x1 && z > PORT.z0 && z < PORT.z1;
  if (inPort) return 1.2;
  if (x < LAND.x0 || x > LAND.x1 || z < LAND.z0 || z > LAND.z1) return WATER_Y - 3;
  let h = 0;
  if (x > BEACH_X) h = -((x - BEACH_X) / (LAND.x1 - BEACH_X)) * 2.2; // beach slope into the sea
  if (z < -HALF - 75) {
    const d = -HALF - 75 - z;
    h += smooth(0, 260, d) * (40 + fbm(x * 0.004, z * 0.004) * 170) + smooth(200, 700, d) * 90;
    const e = Math.min(x - LAND.x0, LAND.x1 - x, z - LAND.z0);
    h *= smooth(0, 220, e);
  }
  return h;
}
/** Marina pier (walkable deck over the sea, east of South Beach). */
export const PIER = { x0: BEACH_X + 8, x1: HALF + 380, z0: 140, z1: 156, y: -0.1 };
const onPier = (x: number, z: number) => x > PIER.x0 && x < PIER.x1 && z > PIER.z0 && z < PIER.z1;
/** Cruise liner moored south of the port quay (hull / promenade deck / sun deck heights). */
export const CRUISE = { x0: 290, x1: 490, z0: HALF + 338, z1: HALF + 368, deck: 14, sun: 30 };
export const isWater = (x: number, z: number) => !onPier(x, z) && heightAt(x, z) < WATER_Y + 0.25;

/* ---------- city ---------- */
const rng = mulberry(20261107);
const pick = <T,>(a: T[], r: () => number) => a[Math.floor(r() * a.length)];
const GLASS_T: [number, number, number][] = [[0.75, 0.85, 0.95], [0.7, 0.78, 0.9], [0.85, 0.9, 0.95], [0.6, 0.72, 0.85]];
const OFFICE_T: [number, number, number][] = [[0.92, 0.88, 0.8], [0.85, 0.85, 0.88], [0.95, 0.92, 0.86], [0.8, 0.78, 0.75]];
const BRICK_T: [number, number, number][] = [[0.75, 0.45, 0.38], [0.65, 0.42, 0.35], [0.82, 0.6, 0.5], [0.6, 0.55, 0.52]];
const HOUSE_T: [number, number, number][] = [[0.98, 0.92, 0.82], [0.9, 0.82, 0.72], [0.82, 0.9, 0.92], [0.98, 0.86, 0.7], [0.88, 0.94, 0.86], [0.96, 0.84, 0.86]];
const ROOF_T: [number, number, number][] = [[0.55, 0.25, 0.2], [0.35, 0.35, 0.4], [0.45, 0.32, 0.25], [0.3, 0.38, 0.36]];
const SHOP_T: [number, number, number][] = [[0.95, 0.9, 0.82], [0.88, 0.8, 0.9], [0.8, 0.9, 0.95], [0.98, 0.85, 0.75]];
const SAKURA: [number, number, number] = [1.0, 0.72, 0.84], MOMIJI: [number, number, number] = [0.95, 0.38, 0.16];
void HOUSE_T; void ROOF_T;

/** Fraction of the footprint each side the top tier is inset by (setback towers); 0 = plain box. */
export const topInset = (b: Building) => (b.type === 'glass' && b.h > 140 ? 0.26 : (b.type === 'glass' && b.h > 90) || (b.type === 'office' && b.h > 42) ? 0.13 : 0);
/** Footprint of the topmost tier. */
export const topFoot = (b: Building) => { const k = topInset(b), ix = (b.x1 - b.x0) * k, iz = (b.z1 - b.z0) * k; return { x0: b.x0 + ix, z0: b.z0 + iz, x1: b.x1 - ix, z1: b.z1 - iz }; };

function addB(b: Building) { buildings.push(b); solids.push({ x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1, y0: b.y0, y1: b.y0 + b.h + (b.gable ? 4 : 0) }); }

const SHOP_LABELS: [string, string, string, string][] = [['store', 'QWIK 24', '#3dffb0', 'store'], ['diner', '食堂 ネオン亭', '#ff6a9a', 'diner'], ['clothes', 'THREADS', '#c07aff', 'clothes'], ['store2', 'QWIK 24', '#3dffb0', 'store'], ['store3', 'QWIK 24', '#3dffb0', 'store'], ['arms', 'BAY ARMS', '#ff5a36', 'arms']];
let shopDoorsLeft = SHOP_LABELS.length;
const MACHIYA_BLOCKS = new Set<number>();

for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const x0 = blockX0(i), z0 = blockX0(j), x1 = x0 + BLOCK, z1 = z0 + BLOCK, zone = zoneOf(i, j), ci = i - O, cj = j - O, core = !ringOf(ci, cj);
  blocks.push({ i, j, x0, z0, x1, z1, zone });
  const r = mulberry(ci * 7919 + cj * 104729 + 7), S = 0.15, m = 5; // sidewalk margin (core blocks keep their original seeds)
  const ix0 = x0 + m, iz0 = z0 + m, ix1 = x1 - m, iz1 = z1 - m;
  if (zone === 'downtown') {
    const alongX = r() < 0.5, mid = alongX ? (ix0 + ix1) / 2 : (iz0 + iz1) / 2, a = 3;
    const halves = alongX ? [[ix0, iz0, mid - a, iz1], [mid + a, iz0, ix1, iz1]] : [[ix0, iz0, ix1, mid - a], [ix0, mid + a, ix1, iz1]];
    const dc = towerFall(ci, cj);
    for (const [a0, b0, a1, b1] of halves) {
      const glass = r() < 0.65, h = (60 + r() * 150) * (1.25 - dc * 0.7) * REGION.heightMul;
      addB({ x0: a0, z0: b0, x1: a1, z1: b1, y0: S, h: Math.max(inTokyo() ? 40 : 16, h), type: glass ? 'glass' : 'office', tint: pick(glass ? GLASS_T : OFFICE_T, r) });
    }
  } else if (zone === 'commercial') {
    // perimeter buildings around a service alley ring
    const d2 = 30, gap = 4;
    const lots: [number, number, number, number][] = [[ix0, iz0, ix1, iz0 + d2], [ix0, iz1 - d2, ix1, iz1], [ix0, iz0 + d2 + gap, ix0 + d2, iz1 - d2 - gap], [ix1 - d2, iz0 + d2 + gap, ix1, iz1 - d2 - gap]];
    for (const [a0, b0, a1, b1] of lots) {
      const long = Math.max(a1 - a0, b1 - b0), n = long > 50 ? (r() < 0.45 ? 4 : 3) : 1; // narrow Japanese multi-tenant buildings
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n, hor = a1 - a0 > b1 - b0;
        const bx0 = hor ? a0 + (a1 - a0) * t0 + (k ? 1.5 : 0) : a0, bx1 = hor ? a0 + (a1 - a0) * t1 - (k < n - 1 ? 1.5 : 0) : a1;
        const bz0 = hor ? b0 : b0 + (b1 - b0) * t0 + (k ? 1.5 : 0), bz1 = hor ? b1 : b0 + (b1 - b0) * t1 - (k < n - 1 ? 1.5 : 0);
        const t = r(), type: BType = t < 0.45 ? 'shop' : t < 0.75 ? 'office' : 'brick';
        const h = (type === 'shop' ? 8 + r() * 14 : 14 + r() * 34) * (type === 'shop' ? 1 : Math.max(0.6, REGION.heightMul + 0.25));
        addB({ x0: bx0, z0: bz0, x1: bx1, z1: bz1, y0: S, h, type, tint: pick(type === 'shop' ? SHOP_T : type === 'office' ? OFFICE_T : BRICK_T, r) });
        if (type === 'shop' && core && shopDoorsLeft > 0 && hor && (b0 === iz0 || b1 === iz1) && r() < 0.2) {
          const L = SHOP_LABELS[SHOP_LABELS.length - shopDoorsLeft]; shopDoorsLeft--;
          const front = b0 === iz0 ? bz0 : bz1, dir = b0 === iz0 ? -1 : 1;
          doors.push({ id: L[0], x: (bx0 + bx1) / 2, z: front + dir * 0.8, ang: dir < 0 ? Math.PI : 0, label: L[1], interior: L[3], color: L[2] });
        }
      }
    }
    for (let k = 0; k < 3; k++) props.bins.push({ x: ix0 + d2 + 2 + r() * (ix1 - ix0 - 2 * d2 - 4), z: iz0 + d2 + 2 });
  } else if (zone === 'residential') {
    const oldTown = inTokyo() ? outerOf(ci, cj) === 'oldtown' : REGION.id === 'osaka' ? Math.hypot(i - (N - 1) / 2 + 1, j - (N - 1) / 2 - 7) < 4 : REGION.id === 'fukuoka' ? i > (N - 1) / 2 + 3 && j > (N - 1) / 2 + 2 && j < (N - 1) / 2 + 6 : false;
    if (oldTown && r() < 0.7) { MACHIYA_BLOCKS.add(j * N + i);
      // old town: terraces of narrow two-storey timber townhouses (machiya) with lattice fronts along both streets
      for (const [z0r, z1r] of [[iz0, iz0 + 13], [iz1 - 13, iz1]]) { let x = ix0; while (x < ix1 - 5) { const w = Math.min(ix1 - x, 6 + r() * 2.5); if (w < 4) break; addB({ x0: x, z0: z0r, x1: x + w - 0.15, z1: z1r, y0: S, h: 5.8 + r() * 0.8, type: 'house', tint: [0.75 + r() * 0.2, 0.7 + r() * 0.15, 0.62 + r() * 0.1], gable: true, roofTint: pick(REGION.roofs, r), style: 'machiya' }); x += w; } }
      for (let k = 0; k < 3; k++) props.trees.push({ x: ix0 + 15 + k * 25, z: (iz0 + iz1) / 2, s: 0.7 + r() * 0.3, y: S, c: r() < 0.3 ? SAKURA : undefined });
    } else if (r() < 0.25) {
      const h = 14 + r() * 18;
      addB({ x0: ix0 + 4, z0: iz0 + 4, x1: ix1 - 4, z1: iz0 + 34, y0: S, h, type: 'brick', tint: pick(BRICK_T, r) });
      addB({ x0: ix0 + 4, z0: iz1 - 34, x1: ix1 - 4, z1: iz1 - 4, y0: S, h: h * 0.8, type: 'brick', tint: pick(BRICK_T, r) });
    } else {
      // Japanese neighbourhood: nine plots of two-storey houses with tiled roofs, a few small flats, a garden in the middle
      const cw = (ix1 - ix0) / 3, ch = (iz1 - iz0) / 3;
      for (let rr = 0; rr < 3; rr++) for (let cc = 0; cc < 3; cc++) {
        if (rr === 1 && cc === 1) { if (r() < 0.7) props.trees.push({ x: ix0 + cw * 1.5, z: iz0 + ch * 1.5, s: 0.85 + r() * 0.3, y: S, c: r() < 0.4 ? SAKURA : undefined }); continue; }
        const apt = r() < 0.16, w = apt ? 16 + r() * 3 : 10.5 + r() * 3.5, d = apt ? 12 + r() * 3 : 9 + r() * 3;
        const cx = ix0 + cw * (cc + 0.5) + (r() - 0.5) * 2, cz = iz0 + ch * (rr + 0.5) + (rr === 0 ? -2.5 : rr === 2 ? 2.5 : 0);
        if (apt) addB({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2, y0: S, h: 8.6 + r() * 3.4, type: 'brick', tint: pick(REGION.walls, r) });
        else if (REGION.palmStreets) { // Okinawa: flat-roofed concrete houses with a water tank, or low red-tiled houses
          const flat = r() < 0.62, one = r() < 0.6;
          if (flat) addB({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2, y0: S, h: one ? 3.6 : 6.4, type: 'house', tint: pick(REGION.walls, r), roof: 'flat', style: 'okinawa' });
          else addB({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2, y0: S, h: 3.4, type: 'house', tint: pick(REGION.walls, r), gable: true, roof: 'hip', roofTint: pick(REGION.roofs, r), style: 'okinawa' });
        } else addB({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2, y0: S, h: 5.8 + r() * 1.2, type: 'house', tint: pick(REGION.walls, r), gable: true, roof: r() < 0.55 ? 'hip' : undefined, roofTint: pick(REGION.roofs, r), carport: r() < 0.35 && rr !== 1 });
        if (r() < 0.3) { const side = r() < 0.5 ? -1 : 1; props.trees.push({ x: cx + side * (w / 2 + 2.4), z: cz + (r() - 0.5) * 4, s: 0.6 + r() * 0.25, y: S, c: r() < 0.25 ? SAKURA : undefined }); }
        else if (REGION.palmStreets && r() < 0.3) props.palms.push({ x: cx + (r() < 0.5 ? -1 : 1) * (w / 2 + 2.4), z: cz, s: 0.6 + r() * 0.2, y: S });
      }
    }
  } else if (zone === 'industrial') {
    const big = r() < 0.5;
    if (big) addB({ x0: ix0 + 2, z0: iz0 + 6, x1: ix1 - 2, z1: iz0 + 52, y0: S, h: 12 + r() * 6, type: 'warehouse', tint: [0.7 + r() * 0.2, 0.72, 0.75] });
    else {
      addB({ x0: ix0 + 2, z0: iz0 + 4, x1: (ix0 + ix1) / 2 - 3, z1: iz1 - 20, y0: S, h: 10 + r() * 8, type: 'warehouse', tint: [0.75, 0.7 + r() * 0.2, 0.62] });
      addB({ x0: (ix0 + ix1) / 2 + 3, z0: iz0 + 4, x1: ix1 - 2, z1: iz1 - 20, y0: S, h: 10 + r() * 8, type: 'warehouse', tint: [0.62, 0.68, 0.78] });
    }
    for (let k = 0; k < 6; k++) props.containers.push({ x: ix0 + 6 + k * 12, z: iz1 - 8, y: S, a: 0, c: pick([[0.75, 0.2, 0.15], [0.15, 0.35, 0.65], [0.85, 0.6, 0.15], [0.25, 0.55, 0.3]], r) });
  } else if (zone === 'park') {
    for (let k = 0; k < 22; k++) { const x = ix0 + 4 + r() * (ix1 - ix0 - 8), z = iz0 + 4 + r() * (iz1 - iz0 - 8); if (Math.abs(x - (x0 + x1) / 2) < 3 || Math.abs(z - (z0 + z1) / 2) < 3) continue; const q = r(); if (REGION.palmStreets && q < 0.3) props.palms.push({ x, z, s: 0.8 + r() * 0.4, y: 0.3 }); else props.trees.push({ x, z, s: 0.9 + r() * 0.8, y: 0.3, c: q > 0.62 ? (q > 0.9 ? MOMIJI : SAKURA) : undefined }); }
    for (let k = 0; k < 4; k++) props.benches.push({ x: (x0 + x1) / 2 + (k % 2 ? 4 : -4), z: z0 + 20 + k * 14, a: k % 2 ? -Math.PI / 2 : Math.PI / 2 });
  } else if (zone === 'parking') {
    addB({ x0: ix1 - 16, z0: iz0 + 2, x1: ix1 - 2, z1: iz0 + 12, y0: S, h: 4, type: 'office', tint: [0.8, 0.8, 0.82] });
  } else if (zone === 'canal') {
    // two rows of narrow buildings with their backs to the street and neon over the water; promenades along the channel
    const CR = CANAL_BLOCKS.get(j * N + i)!, ax = CR.axis === 'x', c = (ax ? z0 : x0) + BLOCK / 2, e0 = c - CR.w / 2 - PROM, e1 = c + CR.w / 2 + PROM;
    for (const [s0, s1] of [[ax ? iz0 : ix0, e0 - 2], [e1 + 2, ax ? iz1 : ix1]]) {
      const n = 4 + (r() < 0.5 ? 1 : 0), a0 = ax ? ix0 : iz0, span = ((ax ? ix1 : iz1) - a0) / n;
      for (let k = 0; k < n; k++) {
        const t0 = a0 + span * k + (k ? 0.7 : 0), t1 = a0 + span * (k + 1) - (k < n - 1 ? 0.7 : 0), t = r();
        const type: BType = t < 0.5 ? 'shop' : t < 0.8 ? 'brick' : 'office', h = type === 'shop' ? 9 + r() * 9 : (14 + r() * 22) * Math.max(0.6, REGION.heightMul + 0.2);
        addB(ax ? { x0: t0, z0: s0, x1: t1, z1: s1, y0: S, h, type, tint: pick(type === 'shop' ? SHOP_T : type === 'office' ? OFFICE_T : BRICK_T, r) } : { x0: s0, z0: t0, x1: s1, z1: t1, y0: S, h, type, tint: pick(type === 'shop' ? SHOP_T : type === 'office' ? OFFICE_T : BRICK_T, r) });
      }
    }
  } else if (zone === 'station') {
    // the main station: a long hall facing the railway (red brick with domes in Tokyo, glass elsewhere), a forecourt behind
    const red = inTokyo(), nm = (REGION.station || REGION.names.downtown + '駅') + ' 駅構内';
    addB({ x0: ix0, z0: iz0 + 1, x1: ix0 + 24, z1: iz1 - 1, y0: S, h: red ? 15 : 19, type: red ? 'brick' : 'glass', tint: red ? [0.86, 0.42, 0.32] : [0.78, 0.86, 0.94], name: nm });
    for (const z of [iz0 + 6, iz1 - 6]) props.trees.push({ x: ix0 + 34, z, s: 0.9, y: S });
  } else if (zone === 'gas') {
    const sx0 = ix0 + 10, sz0 = iz0 + 50;
    addB({ x0: sx0, z0: sz0, x1: sx0 + 26, z1: sz0 + 16, y0: S, h: 5, type: 'shop', tint: [0.95, 0.95, 0.95] });
    doors.push({ id: 'gas' + ci, x: sx0 + 13, z: sz0 - 0.8, ang: Math.PI, label: 'ガソリン 24H', interior: 'gas', color: '#ffc03a' });
  }
}
// every city has the full set of shops (the story and the phone apps look them up)
for (const b of buildings) {
  if (shopDoorsLeft <= 0) break;
  if (b.type !== 'shop') continue;
  const k = blockOfB(b), cx = (b.x0 + b.x1) / 2; if (!k || k.zone !== 'commercial' || b.z0 - k.z0 > 8 || b.x1 - b.x0 < 10) continue;
  if (doors.some((d) => Math.hypot(d.x - cx, d.z - b.z0) < 40)) continue;
  const L = SHOP_LABELS[SHOP_LABELS.length - shopDoorsLeft]; shopDoorsLeft--;
  doors.push({ id: L[0], x: cx, z: b.z0 - 0.8, ang: Math.PI, label: L[1], interior: L[3], color: L[2] });
}

// safehouse door: the first apartment block near the center-south
{
  let best: Building | null = null, bd = 1e9;
  for (const b of buildings) if (b.type === 'brick' && b.x1 - b.x0 > 10) { const k = blockOfB(b); if (!k || b.z0 - k.z0 > 9 || k.zone === 'canal') continue; const d = Math.hypot((b.x0 + b.x1) / 2 - 120, (b.z0 + b.z1) / 2 - 250); if (d < bd) { bd = d; best = b; } } // the front must face a street
  if (best) doors.push({ id: 'home', x: (best.x0 + best.x1) / 2, z: best.z0 - 0.8, ang: Math.PI, label: inTokyo() ? '隠れ家' : 'ビジネスホテル', interior: 'home', color: '#2be4ff' });
}

/* ---------- garage (owned cars are delivered here) ---------- */
export const GARAGE = (() => {
  const home = doors.find((d) => d.id === 'home')!;
  let best: BlockInfo | null = null, bd = 1e9;
  for (const b of blocks) {
    if (b.zone !== 'residential' && b.zone !== 'commercial') continue;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, d = Math.hypot(cx - home.x, cz - home.z);
    if (d < 60 || doors.some((q) => q.x > b.x0 - 2 && q.x < b.x1 + 2 && q.z > b.z0 - 2 && q.z < b.z1 + 2)) continue;
    if (d < bd) { bd = d; best = b; }
  }
  const b = best!;
  for (let k = buildings.length - 1; k >= 0; k--) { const q = buildings[k]; if (q.x0 >= b.x0 - 1 && q.x1 <= b.x1 + 1 && q.z0 >= b.z0 - 1 && q.z1 <= b.z1 + 1) { buildings.splice(k, 1); solids.splice(k, 1); } }
  for (let k = props.trees.length - 1; k >= 0; k--) { const t = props.trees[k]; if (t.x > b.x0 && t.x < b.x1 && t.z > b.z0 && t.z < b.z1) props.trees.splice(k, 1); }
  b.zone = 'parking';
  addB({ x0: b.x0 + 6, z0: b.z1 - 34, x1: b.x1 - 6, z1: b.z1 - 6, y0: 0.15, h: 9, type: 'warehouse', tint: [0.55, 0.58, 0.64] });
  const col = [2, 1, 3, 0, 4], slots = Array.from({ length: 10 }, (_, n) => ({ x: b.x0 + 12 + col[n % 5] * 15.5, z: n < 5 ? b.z0 + 16 : b.z0 + 36, yaw: Math.PI }));
  return { x: (b.x0 + b.x1) / 2, z: b.z0 + 2, block: b, slots };
})();

/* ---------- parked cars along the curbs, in lots and at gas stations ---------- */
export const parkSlots: { x: number; z: number; yaw: number; kind: string; ci: number }[] = [];
{
  const r = mulberry(31337), kinds = ['sedan', 'sedan', 'hatch', 'suv', 'pickup', 'sport', 'truck', 'bike', 'muscle', 'super', 'sedan', 'hatch', 'hyper'];
  for (let k = 0; k <= N; k++) for (let sgm = 0; sgm < N; sgm++) {
    const c = roadC(k), a = -HALF + sgm * PITCH + ROAD + 12;
    for (let n = 0; n < 2; n++) {
      if (r() < 0.45) continue;
      const t = a + 6 + r() * (PITCH - ROAD - 36), side = r() < 0.5 ? -1 : 1, off = side * (ROAD / 2 - 1.35), kind = kinds[Math.floor(r() * kinds.length)];
      if (r() < 0.5) parkSlots.push({ x: c + off, z: t, yaw: side > 0 ? 0 : Math.PI, kind, ci: Math.floor(r() * 6) });
      else parkSlots.push({ x: t, z: c + off, yaw: side > 0 ? -Math.PI / 2 : Math.PI / 2, kind, ci: Math.floor(r() * 6) });
    }
  }
  for (const b of blocks) {
    if (b.zone === 'parking' && b !== GARAGE.block) for (let x = b.x0 + 10.6; x < b.x1 - 22; x += 3.2) { if (r() < 0.45) parkSlots.push({ x, z: b.z0 + 12.7, yaw: Math.PI, kind: kinds[Math.floor(r() * 7)], ci: Math.floor(r() * 6) }); if (r() < 0.45) parkSlots.push({ x, z: b.z1 - 12.7, yaw: 0, kind: kinds[Math.floor(r() * 7)], ci: Math.floor(r() * 6) }); }
    if (b.zone === 'gas') for (const ox of [-6, 6]) parkSlots.push({ x: (b.x0 + b.x1) / 2 + ox, z: b.z0 + 25, yaw: Math.PI / 2, kind: r() < 0.5 ? 'sedan' : 'suv', ci: Math.floor(r() * 6) });
  }
  for (let n = 0; n < 8; n++) parkSlots.push({ x: AIRPORT.x0 + 300 + n * 7, z: 110, yaw: Math.PI, kind: kinds[n % kinds.length], ci: n % 6 });
  for (let n = 0; n < 4; n++) parkSlots.push({ x: PORT.x0 + 40 + n * 30, z: PORT.z0 + 15, yaw: Math.PI / 2, kind: n % 2 ? 'truck' : 'suv', ci: n });
}

/* ---------- landmarks: police station, hospital (respawn points), export dock, time trials ---------- */
export interface Landmark { id: string; label: string; color: string; x: number; z: number; spawn: { x: number; z: number; yaw: number }; /** direction the sign faces (default north) */ ang?: number }
function landmark(id: string, label: string, color: string, tx: number, tz: number): Landmark {
  let best: Building | null = null, bd = 1e9;
  for (const b of buildings) {
    if (b.type !== 'office' && b.type !== 'brick' && b.type !== 'glass') continue;
    const blk = blockOfB(b);
    if (!blk || blk === GARAGE.block || b.z0 - blk.z0 > 7 || b.x1 - b.x0 < 14) continue;
    const cx = (b.x0 + b.x1) / 2; if (doors.some((d) => Math.hypot(d.x - cx, d.z - b.z0) < 30)) continue;
    const d = Math.hypot(cx - tx, b.z0 - tz); if (d < bd) { bd = d; best = b; }
  }
  const b = best!, cx = (b.x0 + b.x1) / 2, blk = blockOfB(b)!;
  return { id, label, color, x: cx, z: b.z0 - 0.8, spawn: { x: cx, z: blk.z0 - 2.2, yaw: Math.PI } };
}
export const POLICE_HQ = landmark('pd', REGION.name + '警察署', '#2b6bff', -380, -220);
export const HOSPITAL = landmark('hosp', REGION.name + '総合病院', '#ff4b5c', 330, 120);
/** Where the bullet train arrives (Naha is reached by plane: no station). */
export const STATION: Landmark | null = REGION.station ? (() => { const x0 = blockX0(STATION_BLOCK.i), z = blockX0(STATION_BLOCK.j) + BLOCK / 2; return { id: 'station', label: REGION.station, color: '#ffffff', x: x0 + 4.2, z, ang: -Math.PI / 2, spawn: { x: x0 + 2, z: z + 8, yaw: -Math.PI / 2 } }; })() : null;
export const LANDMARKS = STATION ? [POLICE_HQ, HOSPITAL, STATION] : [POLICE_HQ, HOSPITAL];
/** Arrival point at the airport terminal (planes). */
export const AIRPORT_ARRIVAL = { x: AIRPORT.x0 + 390, z: 168, yaw: 0 };
export const EXPORT_DOCK = { x: PORT.x0 + 26, z: PORT.z0 + 34 };
export const CUSTOMS = landmark('customs', 'BAY CUSTOMS', '#ff9a3a', 300, 420);
/** Helipads: one on the airport apron, one on a downtown tower roof. */
export const HELIPADS: { x: number; z: number; y: number; name: string }[] = [{ x: AIRPORT.x0 + 610, z: 150, y: 0, name: '空港ヘリパッド' }];
{
  let best: Building | null = null, bd = 1e9;
  for (const b of buildings) { if (b.type !== 'glass' && b.type !== 'office') continue; if (b.x1 - b.x0 < 26 || b.z1 - b.z0 < 26 || b.h > 140) continue; const d = Math.hypot((b.x0 + b.x1) / 2 - 60, (b.z0 + b.z1) / 2 + 60); if (d < bd) { bd = d; best = b; } }
  if (best) HELIPADS.push({ x: (best.x0 + best.x1) / 2, z: (best.z0 + best.z1) / 2, y: best.y0 + best.h, name: RN.downtown + '屋上ヘリパッド' });
  for (const h of HELIPADS) parkSlots.push({ x: h.x, z: h.z, yaw: Math.PI, kind: 'heli', ci: 0 });
  for (let n = 0; n < 3; n++) parkSlots.push({ x: AIRPORT.x0 + 360 + n * 7, z: 110, yaw: Math.PI, kind: 'taxi', ci: 0 });
}

/** Time trials: checkpoints on road intersections (n = node index) or explicit points. */
export interface Trial { id: string; name: string; start: { x: number; z: number; yaw: number }; cps: { x: number; z: number }[]; par: number; reward: number }
const nd = (i: number, j: number) => ({ x: roadC(i + O), z: roadC(j + O) });
/** Records for trials and jumps are kept per city. */
const rid = (id: string) => (inTokyo() ? id : REGION.id + '_' + id);
export const TRIALS: Trial[] = [
  { id: rid('loop'), name: RN.downtown + '・ループ', start: { x: roadC(4 + O), z: roadC(4 + O), yaw: Math.PI / 2 }, cps: [nd(6, 4), nd(8, 4), nd(10, 4), nd(10, 6), nd(10, 8), nd(10, 10), nd(8, 10), nd(6, 10), nd(4, 10), nd(4, 8), nd(4, 6), nd(4, 4)], par: 72, reward: 3000 },
  { id: rid('hwy'), name: (inTokyo() ? '首都高' : '環状') + 'ハイウェイ・ラン', start: { x: roadC(N) - 20, z: roadC(N / 2), yaw: Math.PI / 2 }, cps: [{ x: HWY_C, z: 0 }, { x: HWY_C, z: -HWY_C / 2 }, { x: HWY_C, z: -HWY_C }, { x: HWY_C / 2, z: -HWY_C }, { x: roadC(N / 2), z: -HWY_C }, { x: roadC(N / 2), z: roadC(0) }], par: 116, reward: 5000 },
  { id: rid('zig'), name: RN.residential[0] + '・ジグザグ', start: { x: roadC(1 + O), z: roadC(1 + O) - 30, yaw: 0 }, cps: [nd(1, 3), nd(3, 3), nd(3, 5), nd(5, 5), nd(5, 7), nd(1, 7), nd(1, 9), nd(3, 9), nd(3, 12), nd(1, 12)], par: 95, reward: 3500 },
];

/* ---------- street furniture ---------- */
for (let k = 0; k <= N; k++) {
  const c = roadC(k);
  for (let t = -HALF + 20; t < HALF - 10; t += 32) {
    const rel = ((t + HALF) % PITCH + PITCH) % PITCH; if (rel < ROAD + 6 || rel > PITCH - 6) continue;
    props.lamps.push({ x: c - ROAD / 2 - 1.2, z: t, a: 0 }); props.lamps.push({ x: c + ROAD / 2 + 1.2, z: t + 16, a: Math.PI });
    props.lamps.push({ x: t, z: c - ROAD / 2 - 1.2, a: Math.PI / 2 }); props.lamps.push({ x: t + 16, z: c + ROAD / 2 + 1.2, a: -Math.PI / 2 });
  }
}
for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
  const x = roadC(i), z = roadC(j), o = ROAD / 2 + 1.4;
  if ((i + j) % 2 === 0) {
    props.signals.push({ x: x + o, z: z + o, a: 0, axis: 0, i, j }); props.signals.push({ x: x - o, z: z - o, a: Math.PI, axis: 0, i, j });
    props.signals.push({ x: x + o, z: z - o, a: -Math.PI / 2, axis: 1, i, j }); props.signals.push({ x: x - o, z: z + o, a: Math.PI / 2, axis: 1, i, j });
  }
  if ((i * 3 + j) % 5 === 0) props.hydrants.push({ x: x + o + 1, z: z - o - 3 });
}

/* ---------- beach, port, airport, hills ---------- */
{
  const r = mulberry(99);
  for (let z = -HALF; z < HALF; z += 26) { props.palms.push({ x: BEACH_X + 8 + r() * 10, z: z + r() * 10, s: 0.9 + r() * 0.4, y: heightAt(BEACH_X + 10, z) }); if (r() < 0.6) { const ux = BEACH_X + 15 + r() * 12; props.umbrellas.push({ x: ux, z: z + r() * 14, y: heightAt(ux, z) - 0.1, c: pick([[1, 0.3, 0.4], [0.2, 0.7, 1], [1, 0.8, 0.2], [1, 1, 1]], r) }); } }
  // port: container stacks + warehouses
  for (let row = 0; row < 6; row++) for (let col = 0; col < 30; col++) {
    if (r() < 0.25) continue;
    const x = PORT.x0 + 60 + col * 14, z = PORT.z0 + 40 + row * 9, stack = 1 + Math.floor(r() * 3);
    for (let s = 0; s < stack; s++) props.containers.push({ x, z, y: 1.2 + s * 2.6, a: 0, c: pick([[0.75, 0.2, 0.15], [0.15, 0.35, 0.65], [0.85, 0.6, 0.15], [0.25, 0.55, 0.3], [0.6, 0.6, 0.62]], r) });
    solids.push({ x0: x - 6.1, z0: z - 1.3, x1: x + 6.1, z1: z + 1.3, y0: 1.2, y1: 1.2 + stack * 2.6 });
  }
  addB({ x0: PORT.x0 + 30, z0: PORT.z1 - 90, x1: PORT.x0 + 150, z1: PORT.z1 - 40, y0: 1.2, h: 16, type: 'warehouse', tint: [0.6, 0.66, 0.72] });
  addB({ x0: PORT.x0 + 180, z0: PORT.z1 - 90, x1: PORT.x0 + 300, z1: PORT.z1 - 40, y0: 1.2, h: 16, type: 'warehouse', tint: [0.72, 0.62, 0.55] });
  // airport
  addB({ x0: AIRPORT.x0 + 260, z0: 180, x1: AIRPORT.x0 + 520, z1: 240, y0: 0, h: 18, type: 'terminal', tint: [0.8, 0.88, 0.95] });
  for (let k = 0; k < 3; k++) addB({ x0: AIRPORT.x0 + 40 + k * 70, z0: 260, x1: AIRPORT.x0 + 95 + k * 70, z1: 320, y0: 0, h: 16, type: 'hangar', tint: [0.72, 0.74, 0.78] });
  addB({ x0: AIRPORT.x0 + 580, z0: 190, x1: AIRPORT.x0 + 592, z1: 202, y0: 0, h: 38, type: 'office', tint: [0.85, 0.85, 0.88] });
  // hills: pines
  for (let k = 0; k < 1900; k++) {
    const x = LAND.x0 + 60 + r() * (LAND.x1 - LAND.x0 - 120), z = LAND.z0 + 60 + r() * (-HALF - 120 - LAND.z0 - 60), h = heightAt(x, z);
    if (h < 3) continue; props.pines.push({ x, z, s: 0.7 + r() * 0.8, y: h });
  }
  // billboards on mid-rise roofs
  for (const b of buildings) { const q = mulberry(Math.floor(b.x0 * 13 + b.z0 * 7 + 991)); if ((b.type === 'office' || b.type === 'brick') && b.h < 50 && q() < 0.12) props.billboards.push({ x: (b.x0 + b.x1) / 2, z: b.z0 + 2, y: b.y0 + b.h, a: 0, w: Math.min(18, b.x1 - b.x0 - 4), c: Math.floor(q() * 4) }); }
}

/* ---------- homes you can walk into (danchi flat, family house, tower penthouse, beach villa) ---------- */
{
  const blkOf = (b: Building) => blockOfB(b);
  const free = (x: number, z: number) => !doors.some((d) => Math.hypot(d.x - x, d.z - z) < 30);
  const pick = (test: (b: Building, blk: BlockInfo) => boolean, tx: number, tz: number, maxSet = 9) => {
    let best: Building | null = null, bd = 1e9;
    for (const b of buildings) { const blk = blkOf(b); if (!blk || blk === GARAGE.block || b.z0 - blk.z0 > maxSet || !test(b, blk)) continue; const cx = (b.x0 + b.x1) / 2; if (!free(cx, b.z0)) continue; const d = Math.hypot(cx - tx, b.z0 - tz); if (d < bd) { bd = d; best = b; } }
    return best;
  };
  const front = (id: string, b: Building | null, label: string, color: string) => { if (b) doors.push({ id: 'h_' + id, x: (b.x0 + b.x1) / 2, z: b.z0 - 0.8, ang: Math.PI, label, interior: id, color }); };
  if (inTokyo()) {
  front('danchi', pick((b, k) => b.type === 'brick' && k.zone === 'residential' && b.x1 - b.x0 > 40, -350, 350), '潮見団地 3号棟', '#c9b48a');
  front('house', pick((b, k) => b.type === 'house' && k.zone === 'residential', -250, 120, 24), '一軒家', '#9dff3a');
  front('tower', pick((b, k) => b.type === 'glass' && k.zone === 'downtown' && b.h > 100, 40, -40), 'BAY TOWER RESIDENCE', '#ffd23a');
  // the villa is a new building on the beach
  const vx0 = BEACH_X + 8, vz0 = -470, vx1 = BEACH_X + 36, vz1 = -444;
  addB({ x0: vx0, z0: vz0, x1: vx1, z1: vz1, y0: -0.6, h: 8.6, type: 'terminal', tint: [0.97, 0.97, 0.98] });
  for (const L of [props.palms, props.umbrellas] as { x: number; z: number }[][]) for (let k = L.length - 1; k >= 0; k--) if (L[k].x > vx0 - 3 && L[k].x < vx1 + 3 && L[k].z > vz0 - 3 && L[k].z < vz1 + 3) L.splice(k, 1);
  doors.push({ id: 'h_villa', x: vx0 - 0.8, z: (vz0 + vz1) / 2, ang: -Math.PI / 2, label: 'MODERN VILLA', interior: 'villa', color: '#ffffff' });
  }
}

/* ---------- street trees along downtown / commercial sidewalks ---------- */
{
  const r = mulberry(777);
  const lampAt = new Set<string>(); for (const l of props.lamps) lampAt.add(Math.floor(l.x / 3) + ',' + Math.floor(l.z / 3)); // 3 m cells: a lamp within ~3 m
  const nearLamp = (x: number, z: number) => { const i = Math.floor(x / 3), j = Math.floor(z / 3); for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) if (lampAt.has((i + a) + ',' + (j + c))) return true; return false; };
  for (const b of blocks) {
    if ((b.zone !== 'downtown' && b.zone !== 'commercial') || b === GARAGE.block) continue;
    const sides: [number, number, number, number][] = [[b.x0 + 1.5, b.z0, 0, 1], [b.x1 - 1.5, b.z0, 0, 1], [b.x0, b.z0 + 1.5, 1, 0], [b.x0, b.z1 - 1.5, 1, 0]];
    for (const [sx, sz, ax, az] of sides) for (let t = 11; t < BLOCK - 10; t += 17) {
      const x = sx + ax * t, z = sz + az * t;
      if (doors.some((d) => Math.hypot(d.x - x, d.z - z) < 7)) continue;
      if (nearLamp(x, z)) continue;
      if (REGION.palmStreets) props.palms.push({ x, z, s: 0.62 + r() * 0.18, y: 0.15 }); else props.trees.push({ x, z, s: 0.72 + r() * 0.22, y: 0.15, c: r() < 0.12 ? SAKURA : undefined });
    }
    // a couple of sidewalk benches facing the street, between the trees
    for (const [k, [sx, sz, ax, az]] of sides.entries()) {
      if (r() > 0.45) continue;
      const t = 36.5 + (r() < 0.5 ? 0 : 17), ins = 3.9, x = k === 0 ? b.x0 + ins : k === 1 ? b.x1 - ins : sx + ax * t, z = k < 2 ? sz + az * t : k === 2 ? b.z0 + ins : b.z1 - ins;
      if (doors.some((d) => Math.hypot(d.x - x, d.z - z) < 8)) continue;
      props.benches.push({ x, z, a: k === 0 ? -Math.PI / 2 : k === 1 ? Math.PI / 2 : k === 2 ? Math.PI : 0, y: 0.15 });
    }
  }
  // seafront promenade benches looking out to sea
  for (let z = -HALF + 60; z < HALF - 60; z += 70) props.benches.push({ x: BEACH_X + 2.5, z, a: Math.PI / 2, y: heightAt(BEACH_X + 2.5, z) });
}

/* ---------- marina, jet park, cruise liner ---------- */
export const MARINA = { x: PIER.x0 + 115, z: PIER.z0 - 2, slots: Array.from({ length: 8 }, (_, n) => ({ x: PIER.x0 + 95 + n * 26, z: PIER.z0 - 1.2, yaw: Math.PI / 2 })) };
export const JETPARK = { x: AIRPORT.x0 + 130, z: 150, slots: [0, 1, 2, 3].map((n) => ({ x: AIRPORT.x0 + 100 + n * 22, z: 150, yaw: Math.PI / 2 })) };
{
  // public boats on the north side of the pier, a fighter jet waiting on the runway threshold
  const boats: [string, number][] = [['jetski', 85], ['jetski', 93], ['speedboat', 115], ['speedboat', 145], ['yacht', 200], ['speedboat', 245], ['jetski', 273]].map(([k, o]) => [k as string, PIER.x0 + (o as number)]);
  for (const [k, x] of boats) parkSlots.push({ x, z: PIER.z1 + 1.2 + (k === 'yacht' ? 3.6 : k === 'speedboat' ? 1.6 : 0.7), yaw: -Math.PI / 2, kind: k, ci: Math.floor(x) % 5 });
  parkSlots.push({ x: AIRPORT.x0 + 90, z: -165, yaw: Math.PI / 2, kind: 'jet', ci: 0 });
  parkSlots.push({ x: AIRPORT.x0 + 60, z: 150, yaw: Math.PI / 2, kind: 'jet', ci: 1 });
  // cruise liner: hull, superstructure and funnel are solid, so you can stand on the promenade and sun decks
  const C = CRUISE;
  solids.push({ x0: C.x0, z0: C.z0, x1: C.x1, z1: C.z1, y0: -14, y1: C.deck });
  solids.push({ x0: C.x0 + 14, z0: C.z0 + 3, x1: C.x1 - 36, z1: C.z1 - 3, y0: C.deck, y1: C.sun });
  solids.push({ x0: C.x0 + 34, z0: C.z0 + 9, x1: C.x0 + 52, z1: C.z1 - 9, y0: C.sun, y1: C.sun + 14 });
  doors.push({ id: 'cruise', x: (C.x0 + C.x1) / 2, z: PORT.z1 - 0.8, ang: Math.PI, label: 'NEON BAY PRINCESS 乗船口', interior: 'ship_atrium', color: '#ffd23a' });
}


/* ---------- the city's landmark (model in Landmarks.tsx): red lattice tower, castle, seaside tower, red-tiled castle hall ---------- */
export const LANDMARK3D = (() => {
  const L = REGION.landmark;
  if (L.kind === 'seatower') return { kind: L.kind, label: L.label, x: BEACH_X + 34, z: -320 };
  const b = blocks[LM_BLOCK.j * N + LM_BLOCK.i];
  return { kind: L.kind, label: L.label, x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 };
})();
{
  const { x, z, kind } = LANDMARK3D, R = kind === 'tower' ? 24 : kind === 'castle' ? 33 : kind === 'redcastle' ? 38 : 16;
  const clear = (L: { x: number; z: number }[]) => { for (let k = L.length - 1; k >= 0; k--) if (Math.abs(L[k].x - x) < R && Math.abs(L[k].z - z) < R) L.splice(k, 1); };
  clear(props.trees); clear(props.palms); clear(props.benches); clear(props.umbrellas); clear(props.bins);
  const box = (x0: number, z0: number, x1: number, z1: number, y0: number, y1: number) => solids.push({ x0: x + x0, z0: z + z0, x1: x + x1, z1: z + z1, y0, y1 });
  if (kind === 'tower') { for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(sx * 15 - 3, sz * 15 - 3, sx * 15 + 3, sz * 15 + 3, 0, 26); box(-9, -9, 9, 9, 0, 6.6); box(-9, -9, 9, 9, 26, 96); box(-11, -11, 11, 11, 96, 106); box(-5, -5, 5, 5, 106, 168); }
  else if (kind === 'castle') { box(-25, -21, 25, 21, 0, 14); box(-15, -12, 15, 12, 14, 50); }
  else if (kind === 'redcastle') { box(-24, -12, 24, 12, 0, 14); for (const [a, b2, c, d] of [[-35, -28, 35, -26], [-35, 26, -6, 28], [6, 26, 35, 28], [-35, -28, -33, 28], [33, -28, 35, 28]]) box(a, b2, c, d, 0, 4.2); }
  else { box(-15, -15, 15, 15, -2, 6.6); box(-8, -8, 8, 8, 6.6, 152); }
}

/* ---------- elevated railway: one line north-south through the city (trains run in Railway.tsx) ---------- */
export const RAIL = (() => {
  // core road line 12: no time trial, street race, stunt jump or highway run uses it (the piers stand in its median)
  const k = O + 12, x = roadC(k), z0 = -HALF + ROAD + 30, z1 = HALF - ROAD - 30, y = 9.2;
  const stations = [0.2, 0.5, 0.8].map((f) => roadC(Math.round(f * N)) + PITCH / 2);
  const mid = REGION.station || REGION.names.downtown + '駅', first = REGION.names.commercial[0] + '駅' === mid ? REGION.names.commercial[1] + '駅' : REGION.names.commercial[0] + '駅';
  const names = [first, mid, REGION.names.residential[1] + '駅'];
  return { k, x, z0, z1, y, half: 4.6, stations, names, piers: [] as number[], name: REGION.rail.name, cars: REGION.rail.cars, color: REGION.rail.color, mono: REGION.id === 'naha' };
})();
{
  const R = RAIL;
  for (let z = R.z0; z <= R.z1; z += 25) { const rel = ((z + HALF) % PITCH + PITCH) % PITCH; if (rel < ROAD + 4 || rel > PITCH - 4) continue; R.piers.push(z); solids.push({ x0: R.x - 0.8, z0: z - 1.2, x1: R.x + 0.8, z1: z + 1.2, y0: 0, y1: R.y - 0.9 }); }
  if (R.mono) for (const s of [-1, 1]) solids.push({ x0: R.x + s * 2.1 - 0.45, z0: R.z0, x1: R.x + s * 2.1 + 0.45, z1: R.z1, y0: R.y - 1.5, y1: R.y }); // two guideway beams
  else solids.push({ x0: R.x - R.half, z0: R.z0, x1: R.x + R.half, z1: R.z1, y0: R.y - 0.9, y1: R.y + 0.25 });
  for (const sz of R.stations) for (const s of [-1, 1]) solids.push({ x0: s < 0 ? R.x - 7.8 : R.x + R.half, z0: sz - 55, x1: s < 0 ? R.x - R.half : R.x + 7.8, z1: sz + 55, y0: R.y - 0.9, y1: R.y + 0.2 });
}

/* ---------- the bullet-train line: its own high viaduct along the avenue east of the main station (Naha has none) ---------- */
export interface ShinPlatform { side: number; x0: number; x1: number; dir: number; to?: RegionId; num: number }
export const SHIN = (() => {
  const x = roadC(O + 13), sz = blockX0(STATION_BLOCK.j) + BLOCK / 2, bx0 = blockX0(STATION_BLOCK.i), next = REGION.shinkansen ?? {};
  // west platform: the northbound track (trains run on the left); east platform: the southbound track
  const platforms: ShinPlatform[] = [{ side: -1, x0: x - 10.5, x1: x - 5, dir: -1, to: next.north, num: 14 }, { side: 1, x0: x + 5, x1: x + 10.5, dir: 1, to: next.south, num: 15 }];
  return {
    has: !!REGION.shinkansen, x, y: 15, z0: -HALF + ROAD + 6, z1: HALF - ROAD - 6, stationZ: sz, half: 5, track: 2.3, piers: [] as number[], next, platforms,
    /** the Shinkansen concourse at street level, in the east half of the station block, entered from the forecourt */
    hall: { x0: bx0 + 46, x1: bx0 + 80, z0: sz - 32, z1: sz + 32, h: 7.5, gateX: bx0 + 62 },
    /** street entrance (map marker / directions) */
    gate: { x: bx0 + 44, z: sz },
  };
})();
/** Where a waiting train's lead car stands at a platform, and the cab door you board it by. */
export const shinStand = (P: ShinPlatform) => ({ x: SHIN.x + P.side * SHIN.track, z: SHIN.stationZ + P.dir * 90 });
export const shinCabDoor = (P: ShinPlatform) => ({ x: P.side < 0 ? P.x1 - 0.9 : P.x0 + 0.9, z: SHIN.stationZ + P.dir * 94 });
/** Stairs: up from the concourse (behind the ticket gates) to each platform, and down from the platform end. */
export const shinUp = (P: ShinPlatform) => ({ x: SHIN.hall.x0 + 28, z: SHIN.stationZ + P.side * 14 });
export const shinDown = (P: ShinPlatform) => ({ x: (P.x0 + P.x1) / 2, z: SHIN.stationZ - 70 });
if (SHIN.has) {
  const R = SHIN, H = R.hall, sz = R.stationZ, box = (x0: number, z0: number, x1: number, z1: number, y0: number, y1: number) => solids.push({ x0, z0, x1, z1, y0, y1 });
  for (let z = R.z0 + 10; z <= R.z1 - 10; z += 30) { const rel = ((z + HALF) % PITCH + PITCH) % PITCH; if (rel < ROAD + 4 || rel > PITCH - 4) continue; R.piers.push(z); box(R.x - 1, z - 1.4, R.x + 1, z + 1.4, 0, R.y - 1.3); }
  box(R.x - R.half, R.z0, R.x + R.half, R.z1, R.y - 1.3, R.y);
  for (const P of R.platforms) {
    box(P.x0, sz - 112, P.x1, sz + 112, R.y - 1.3, R.y + 0.2);
    // platform fence along the track edge, open at every car door of a standing train
    const fx = P.side < 0 ? P.x1 - 0.15 : P.x0, doors: number[] = [];
    for (let k = 0; k < 8; k++) for (const o of [-10.6, 10.6]) doors.push(sz + P.dir * 90 - P.dir * k * 25.6 + o);
    let z = sz - 110; for (const d of doors.sort((a, b) => a - b)) { if (d - 1.1 > z + 0.3) box(fx, z, fx + 0.15, d - 1.1, R.y + 0.2, R.y + 1.4); z = d + 1.1; } if (z < sz + 110) box(fx, z, fx + 0.15, sz + 110, R.y + 0.2, R.y + 1.4);
    box((P.x0 + P.x1) / 2 - 1.6, sz + 22, (P.x0 + P.x1) / 2 + 1.6, sz + 32, R.y + 0.2, R.y + 3); // waiting room
  }
  // concourse: walls (glass front with three entrances), ticket gates, stairs up behind them
  box(H.x0, H.z0, H.x1, H.z0 + 0.4, 0, H.h); box(H.x0, H.z1 - 0.4, H.x1, H.z1, 0, H.h); box(H.x1 - 0.4, H.z0, H.x1, H.z1, 0, H.h);
  { let z = H.z0; for (const g of [sz - 18, sz, sz + 18]) { box(H.x0, z, H.x0 + 0.3, g - 3, 0, H.h); z = g + 3; } box(H.x0, z, H.x0 + 0.3, H.z1, 0, H.h); }
  for (let z = H.z0 + 5; z < H.z1 - 5; z += 1.5) box(H.gateX - 0.75, z - 0.15, H.gateX + 0.75, z + 0.15, 0, 1.05);
  for (const P of R.platforms) { const u = shinUp(P); box(u.x + 2.2, u.z - 4, H.x1 - 0.4, u.z + 4, 0, 3); }
  for (const L of [props.trees, props.benches, props.lamps, props.bins] as { x: number; z: number }[][]) for (let k = L.length - 1; k >= 0; k--) if (L[k].x > H.x0 - 2 && L[k].x < H.x1 + 1 && L[k].z > H.z0 - 2 && L[k].z < H.z1 + 2) L.splice(k, 1);
}

/* ---------- Japanese streets: utility poles with sagging wires, vending machines ---------- */
{
  const r = mulberry(4242 + REGION.idx * 17);
  const grid = (list: { x: number; z: number }[]) => { const m = new Map<string, { x: number; z: number }[]>(); for (const q of list) { const k = Math.floor(q.x / 8) + ',' + Math.floor(q.z / 8); let a = m.get(k); if (!a) m.set(k, (a = [])); a.push(q); } return (x: number, z: number, d: number) => { for (let i = Math.floor((x - d) / 8); i <= Math.floor((x + d) / 8); i++) for (let j = Math.floor((z - d) / 8); j <= Math.floor((z + d) / 8); j++) for (const q of m.get(i + ',' + j) || []) if (Math.abs(q.x - x) < d && Math.abs(q.z - z) < d) return true; return false; }; };
  const nearLamp = grid(props.lamps), nearTree = grid([...props.trees, ...props.palms]), nearDoor = grid(doors);
  const poled = (b: BlockInfo) => b.zone === 'residential' || b.zone === 'commercial' || b.zone === 'industrial';
  const railX = (x: number) => Math.abs(x - RAIL.x) < 12 || (SHIN.has && Math.abs(x - SHIN.x) < 12);
  // north edges (wires along x) row by row, west edges (wires along z) column by column; a chain carries on across a road
  for (const dir of [0, 1] as const) for (let a = 0; a < N; a++) {
    let last: { x: number; z: number } | null = null;
    for (let t = 0; t < N; t++) {
      const b = dir === 0 ? blocks[a * N + t] : blocks[t * N + a];
      if (!b || !poled(b) || b === GARAGE.block) { last = null; continue; }
      for (const s of [6, 37, 68]) {
        const x = dir === 0 ? b.x0 + s + (r() - 0.5) * 2 : b.x0 + 0.6, z = dir === 0 ? b.z0 + 0.6 : b.z0 + s + (r() - 0.5) * 2;
        if (nearLamp(x, z, 2.4) || nearTree(x, z, 2.2) || nearDoor(x, z, 5) || railX(x)) continue;
        props.poles.push({ x, z, a: dir === 0 ? Math.PI / 2 : 0, tr: r() < 0.16 });
        if (last && Math.hypot(x - last.x, z - last.z) < 52) props.wires.push({ x0: last.x, z0: last.z, x1: x, z1: z });
        last = { x, z };
      }
    }
  }
  // vending machines in pairs: on a corner of most housing blocks, against a shop front in the shopping streets
  const nearPole = grid(props.poles), VC: [number, number, number][] = [[0.82, 0.1, 0.12], [0.12, 0.32, 0.72], [0.93, 0.93, 0.93], [0.2, 0.55, 0.3], [0.95, 0.6, 0.12]];
  for (const b of blocks) {
    if (b === GARAGE.block || (b.zone !== 'residential' && b.zone !== 'commercial') || r() > (b.zone === 'residential' ? 0.5 : 0.65)) continue;
    const t = 16 + r() * 54, inset = b.zone === 'residential' ? 1.1 : 4.45, side = Math.floor(r() * 4);
    const nx = side === 0 ? 0 : side === 1 ? 0 : side === 2 ? -1 : 1, nz = side === 0 ? -1 : side === 1 ? 1 : 0;
    const x = nz !== 0 ? b.x0 + t : nx < 0 ? b.x0 + inset : b.x1 - inset, z = nx !== 0 ? b.z0 + t : nz < 0 ? b.z0 + inset : b.z1 - inset;
    if (nearLamp(x, z, 2.6) || nearTree(x, z, 2.4) || nearDoor(x, z, 6) || nearPole(x, z, 2)) continue;
    const a = Math.atan2(nx, nz);
    props.vends.push({ x, z, a, c: VC[Math.floor(r() * VC.length)] });
    props.vends.push({ x: x + (nz !== 0 ? 1.05 : 0), z: z + (nx !== 0 ? 1.05 : 0), a, c: VC[Math.floor(r() * VC.length)] });
  }
}

/* ---------- signature places: shrines, Asakusa's temple, the sky tower, shopping arches with lanterns, street-food stalls,
   station entrances, Shinsekai, the dome, shisa (models in Signature.tsx, interactions in crime/japan.ts) ---------- */
export interface Shrine { x: number; z: number; big: boolean; name: string; /** torii position (none for a temple hall) */ tz?: number }
export const SIG = {
  shrines: [] as Shrine[],
  temple: null as null | { x: number; z: number; x0: number; z0: number; x1: number; z1: number },
  skytower: null as null | { x: number; z: number },
  shinsekai: null as null | { x: number; z: number },
  dome: null as null | { x: number; z: number; r: number },
  station: null as null | { x0: number; z0: number; x1: number; z1: number; red: boolean },
  arches: [] as { x: number; z: number; name: string }[],
  lanterns: [] as { x0: number; z0: number; x1: number; z1: number; y: number }[],
  yatai: [] as { x: number; z: number; a: number; food: string; price: number }[],
  gates: [] as { x: number; z: number; st: number; name: string }[],
  /** police boxes on street corners (ask for directions), red post boxes */
  koban: [] as { x: number; z: number; a: number }[],
  posts: [] as { x: number; z: number }[],
};
{
  const r = mulberry(5150 + REGION.idx), solid = (x0: number, z0: number, x1: number, z1: number, y0: number, y1: number) => solids.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), y0, y1 });
  const clearIn = (x0: number, z0: number, x1: number, z1: number) => { for (const L of [props.trees, props.palms, props.benches, props.bins, props.lamps, props.vends, props.poles] as { x: number; z: number }[][]) for (let k = L.length - 1; k >= 0; k--) if (L[k].x > x0 && L[k].x < x1 && L[k].z > z0 && L[k].z < z1) L.splice(k, 1); };
  const blk = (k: number) => blocks[k];
  const food = (k: number) => REGION.food[k % REGION.food.length];
  // shrines: a torii on the south edge and a small hall in a few parks (a big one in Tokyo's central park)
  const SHRINE_NAMES = ['稲荷神社', '八幡神社', '天満宮', '氷川神社', '日枝神社', '熊野神社'];
  const shrineAt = (b: BlockInfo, big: boolean, name: string) => {
    const cx = (b.x0 + b.x1) / 2, hz = big ? b.z0 + 30 : b.z1 - 24, w = big ? 9 : 4.5;
    clearIn(cx - w - 4, hz - w - 2, cx + w + 4, b.z1 - 1);
    SIG.shrines.push({ x: cx, z: hz, big, name, tz: b.z1 - (big ? 4 : 3) });
    solid(cx - w, hz - w * 0.75, cx + w, hz + w * 0.75, 0, big ? 12 : 6);
    const tz = b.z1 - (big ? 4 : 3), tw = big ? 6 : 3; for (const s of [-1, 1]) solid(cx + s * tw - 0.4, tz - 0.4, cx + s * tw + 0.4, tz + 0.4, 0, big ? 11 : 5.5);
  };
  if (inTokyo()) { const b = blk((4 + O) * N + 9 + O); if (b && b.zone === 'park') shrineAt(b, true, '明治神宮'); }
  { const parks = blocks.filter((b) => b.zone === 'park' && !SIG_BLOCKS.has(b.j * N + b.i) && !(b.i === LM_BLOCK.i && b.j === LM_BLOCK.j) && !(inTokyo() && b.i - O >= 9 && b.i - O <= 10 && b.j - O >= 3 && b.j - O <= 4));
    for (let k = 0; k < Math.min(5, parks.length); k++) { const b = parks[Math.floor(r() * parks.length)]; if (SIG.shrines.some((q) => Math.hypot(q.x - (b.x0 + b.x1) / 2, q.z - (b.z0 + b.z1) / 2) < 120)) continue; shrineAt(b, false, SHRINE_NAMES[k % SHRINE_NAMES.length]); } }
  // signature blocks
  for (const [k, tag] of SIG_BLOCKS) {
    const b = blk(k); if (!b) continue; const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    if (tag === 'temple') { // Asakusa: thunder gate with its lantern, a street of stalls, the main hall, a five-storey pagoda
      clearIn(b.x0, b.z0, b.x1, b.z1); SIG.temple = { x: cx, z: cz, x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1 };
      for (const s of [-1, 1]) solid(cx + s * 6 - 0.7, b.z1 - 5.7, cx + s * 6 + 0.7, b.z1 - 4.3, 0, 9);
      for (let n = 0; n < 6; n++) for (const s of [-1, 1]) solid(cx + s * 6.5 - 2, b.z1 - 16 - n * 6.4 - 2.6, cx + s * 6.5 + 2, b.z1 - 16 - n * 6.4 + 2.6, 0, 3.4);
      solid(cx - 15, b.z0 + 8, cx + 15, b.z0 + 26, 0, 16); solid(cx - 31, b.z0 + 30, cx - 23, b.z0 + 38, 0, 40);
      for (let n = 0; n < 2; n++) SIG.yatai.push({ x: cx + (n ? 4.4 : -4.4), z: b.z1 - 16 - (n + 1) * 6.4, a: n ? -Math.PI / 2 : Math.PI / 2, food: food(n)[0], price: food(n)[1] });
      SIG.shrines.push({ x: cx, z: b.z0 + 17, big: true, name: '浅草寺 本堂' });
    } else if (tag === 'skytower') { clearIn(b.x0, b.z0, b.x1, b.z1); SIG.skytower = { x: cx, z: cz }; solid(cx - 9, cz - 9, cx + 9, cz + 9, 0, 340); }
    else if (tag === 'shinsekai') { clearIn(cx - 14, cz - 14, cx + 14, cz + 14); SIG.shinsekai = { x: cx, z: cz }; solid(cx - 7, cz - 7, cx + 7, cz + 7, 0, 96);
      for (const [lx0, lz0, lx1, lz1] of [[b.x0, b.z0 + 3, b.x1, b.z0 + 3], [b.x0, b.z1 - 3, b.x1, b.z1 - 3], [b.x0 + 3, b.z0, b.x0 + 3, b.z1], [b.x1 - 3, b.z0, b.x1 - 3, b.z1]]) SIG.lanterns.push({ x0: lx0, z0: lz0, x1: lx1, z1: lz1, y: 4.6 });
      for (let n = 0; n < 2; n++) SIG.yatai.push({ x: cx + (n ? 18 : -18), z: b.z1 - 9, a: 0, food: food(1)[0], price: food(1)[1] }); }
    else if (tag === 'dome') { clearIn(b.x0, b.z0, b.x1, b.z1); SIG.dome = { x: cx, z: cz, r: 38 }; solid(cx - 26, cz - 26, cx + 26, cz + 26, 0, 30); }
  }
  // station hall
  { const b = blk(STATION_BLOCK.j * N + STATION_BLOCK.i); if (b) SIG.station = { x0: b.x0 + 5, z0: b.z0 + 6, x1: b.x0 + 29, z1: b.z1 - 6, red: inTokyo() }; }
  // shopping street: a lit arch at each end of one block of a north-south street, lantern strings across it
  { const x = roadC(O + 3), za = roadC(O + 5) + 18, zb = roadC(O + 6) - 18;
    for (const z of [za, zb]) { SIG.arches.push({ x, z, name: REGION.arch }); for (const s of [-1, 1]) solid(x + s * 8.6 - 0.35, z - 0.35, x + s * 8.6 + 0.35, z + 0.35, 0, 7.6); }
    for (let z = za + 8; z < zb - 4; z += 9) SIG.lanterns.push({ x0: x - 8.4, z0: z, x1: x + 8.4, z1: z, y: 6.4 }); }
  // street-food stalls along the river promenade (Fukuoka) / the canal (Osaka) / Kokusai street (Naha) / the arch street
  { const RS = CANAL_RECTS.filter((q) => q.axis !== 'pond' && q.name === (REGION.canals ?? [])[0]?.name), ax = RS.length ? RS[0].axis === 'x' : true, mid = Math.floor(RS.length / 2), CANAL_RECTS_ = RS;
    for (let n = 0; n < (REGION.id === 'fukuoka' ? 12 : 4) && RS.length; n++) { const R = CANAL_RECTS_[Math.min(RS.length - 1, Math.max(0, mid - 2 + Math.floor(n / 3)))]; if (!R) break;
      const t = ((n % 3) + 0.5) / 3, x = ax ? R.x0 + (R.x1 - R.x0) * t : R.x1 + PROM / 2 + 0.2, z = ax ? R.z1 + PROM / 2 + 0.2 : R.z0 + (R.z1 - R.z0) * t, f = food(n);
      SIG.yatai.push({ x, z, a: ax ? 0 : Math.PI / 2, food: f[0], price: f[1] }); /* the counter faces the promenade */ solid(x - (ax ? 1.3 : 1), z - (ax ? 1 : 1.3), x + (ax ? 1.3 : 1), z + (ax ? 1 : 1.3), 0, 2.6); } }
  { const x = roadC(O + 3) + 9.8, n = REGION.palmStreets ? 4 : 2; for (let k = 0; k < n; k++) { const z = roadC(O + 5) + 17 + k * (60 / n), f = food(k + 2); SIG.yatai.push({ x, z, a: -Math.PI / 2, food: f[0], price: f[1] }); solid(x - 1, z - 1.3, x + 1, z + 1.3, 0, 2.6); } }
  // station entrances at street level under the three stations
  RAIL.stations.forEach((z, i) => { const x = RAIL.x + 9.4; SIG.gates.push({ x, z: z + (i === 1 ? -30 : 0), st: i, name: RAIL.names[i] }); });
  // police boxes on the corners of busy blocks near the centre, post boxes by the shops and stations
  { const c = (N - 1) / 2, cand = blocks.filter((b) => (b.zone === 'commercial' || b.zone === 'downtown') && Math.hypot(b.i - c, b.j - c) < N * 0.3).sort((a, b) => hash01(a.i, a.j * 7) - hash01(b.i, b.j * 7));
    for (const b of cand) { if (SIG.koban.length >= 5) break; const x = b.x0 + 3.2, z = b.z0 + 3.2; if (SIG.koban.some((q) => Math.hypot(q.x - x, q.z - z) < 300) || doors.some((d) => Math.hypot(d.x - x, d.z - z) < 10)) continue; /* (no collision grid yet here) */ SIG.koban.push({ x, z, a: Math.PI }); clearIn(x - 3, z - 3, x + 3, z + 3); solid(x - 1.9, z - 1.6, x + 1.9, z + 1.9, 0, 3.4); } }
  for (const d of doors) if (['store', 'store2', 'store3', 'diner', 'home'].includes(d.id)) SIG.posts.push({ x: d.x + 3.2, z: d.z - Math.cos(d.ang) * 0.4 });
  for (const g of SIG.gates) SIG.posts.push({ x: g.x + 0.4, z: g.z - 4.2 });
  // tidy up the things that now stand where a stall or gate went
  for (const y of [...SIG.yatai, ...SIG.gates]) clearIn(y.x - 2.5, y.z - 2.5, y.x + 2.5, y.z + 2.5);
}

/* ---------- the shore: quay walls and railings where streets and blocks meet the sea; nothing stands in the water ---------- */
export const SHORE: { x0: number; z0: number; x1: number; z1: number; top: number }[] = [];
{
  const span = (c: number): [number, number] => (c % 2 === 0 ? [roadC(c / 2) - ROAD / 2, roadC(c / 2) + ROAD / 2] : [blockX0((c - 1) / 2), blockX0((c - 1) / 2) + BLOCK]);
  const wet = (ci: number, cj: number) => {
    if (ci < 0 || cj < 0 || ci > 2 * N || cj > 2 * N) return false;
    const ex = ci % 2 === 0, ez = cj % 2 === 0;
    if (!ex && !ez) return isBay((ci - 1) / 2, (cj - 1) / 2);
    if (ex && ez) return !nodeOpen(ci / 2, cj / 2);
    if (ex) return !segOpen('z', ci / 2, (cj - 1) / 2);
    return !segOpen('x', cj / 2, (ci - 1) / 2);
  };
  if (BAY.size) for (let cj = 0; cj <= 2 * N; cj++) for (let ci = 0; ci <= 2 * N; ci++) {
    if (wet(ci, cj)) continue;
    const [x0, x1] = span(ci), [z0, z1] = span(cj), top = ci % 2 && cj % 2 ? 0.15 : 0, t = 0.3;
    if (wet(ci - 1, cj)) SHORE.push({ x0, z0, x1: x0 + t, z1, top }); if (wet(ci + 1, cj)) SHORE.push({ x0: x1 - t, z0, x1, z1, top });
    if (wet(ci, cj - 1)) SHORE.push({ x0, z0, x1, z1: z0 + t, top }); if (wet(ci, cj + 1)) SHORE.push({ x0, z0: z1 - t, x1, z1, top });
  }
  for (const s of SHORE) solids.push({ x0: s.x0, z0: s.z0, x1: s.x1, z1: s.z1, y0: -3, y1: s.top + 1.05 });
  // trees and benches round the ponds
  { const r = mulberry(919); for (const P of CANAL_RECTS) { if (P.axis !== 'pond') continue; for (let t = P.x0 + 4; t < P.x1 - 2; t += 11) for (const z of [P.z0 - 4.5, P.z1 + 4.5]) props.trees.push({ x: t + r() * 2, z, s: 0.8 + r() * 0.4, y: 0.17, c: r() < 0.35 ? SAKURA : undefined }); for (let t = P.z0 + 9; t < P.z1 - 2; t += 11) for (const x of [P.x0 - 4.5, P.x1 + 4.5]) props.trees.push({ x, z: t + r() * 2, s: 0.8 + r() * 0.4, y: 0.17, c: r() < 0.35 ? SAKURA : undefined }); props.benches.push({ x: (P.x0 + P.x1) / 2, z: P.z1 + 1.6, a: 0, y: 0.15 }, { x: (P.x0 + P.x1) / 2, z: P.z0 - 1.6, a: Math.PI, y: 0.15 }); } }
  // remove what the generic street furniture put in the water
  const wetAt = (x: number, z: number) => inBay(x, z) || inCanal(x, z);
  for (const L of [props.lamps, props.signals, props.hydrants, props.trees, props.palms, props.benches, props.bins, props.poles, props.vends, props.billboards, props.shisa] as { x: number; z: number }[][]) for (let k = L.length - 1; k >= 0; k--) if (wetAt(L[k].x, L[k].z)) L.splice(k, 1);
  for (let k = props.wires.length - 1; k >= 0; k--) { const w = props.wires[k]; if (wetAt(w.x0, w.z0) || wetAt(w.x1, w.z1) || wetAt((w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2)) props.wires.splice(k, 1); }
  for (let k = parkSlots.length - 1; k >= 0; k--) if (wetAt(parkSlots[k].x, parkSlots[k].z) && !['jetski', 'speedboat', 'yacht'].includes(parkSlots[k].kind)) parkSlots.splice(k, 1);
}
// canal railings (the banks and both edges of every bridge)
for (const R of CANAL_RECTS) {
  const ax = R.axis === 'x', rs = (x0: number, z0: number, x1: number, z1: number) => solids.push({ x0, z0, x1, z1, y0: -3, y1: 1.1 });
  if (ax) { rs(R.x0, R.z0 - 0.2, R.x1, R.z0); rs(R.x0, R.z1, R.x1, R.z1 + 0.2); rs(R.x0 - 0.2, R.z0, R.x0, R.z1); rs(R.x1, R.z0, R.x1 + 0.2, R.z1); }
  else { rs(R.x0 - 0.2, R.z0, R.x0, R.z1); rs(R.x1, R.z0, R.x1 + 0.2, R.z1); rs(R.x0, R.z0 - 0.2, R.x1, R.z0); rs(R.x0, R.z1, R.x1, R.z1 + 0.2); }
}
// shisa guardians: pairs at the shop doors of Naha's shopping streets, one on the roof of many houses
if (REGION.palmStreets) {
  const r = mulberry(7373);
  for (const b of buildings) {
    const k = blockOfB(b); if (!k) continue;
    if (b.style === 'okinawa' && b.roof === 'flat' && r() < 0.6) props.shisa.push({ x: (b.x0 + b.x1) / 2, z: b.z0 + 0.25, y: b.y0 + b.h + 0.9, a: Math.PI });
    else if (b.gable && r() < 0.55) props.shisa.push({ x: (b.x0 + b.x1) / 2, z: b.z0 + 0.6, y: b.y0 + b.h + 0.35, a: Math.PI });
    else if (b.type === 'shop' && k.zone === 'commercial' && b.z0 - k.z0 < 8 && r() < 0.6) for (const s of [-1, 1]) props.shisa.push({ x: (b.x0 + b.x1) / 2 + s * 2.2, z: b.z0 - 0.7, y: 0.15, a: Math.PI });
  }
}
// low concrete-block walls (limestone in Naha) around the housing plots, with an opening in front of every plot
{
  const lime = REGION.palmStreets;
  for (const b of blocks) {
    if (b.zone !== 'residential' || b === GARAGE.block || MACHIYA_BLOCKS.has(b.j * N + b.i)) continue;
    const ix0 = b.x0 + 5, iz0 = b.z0 + 5, ix1 = b.x1 - 5, iz1 = b.z1 - 5, cw = (ix1 - ix0) / 3, gaps = [0.5, 1.5, 2.5].map((k) => ix0 + cw * k), zgap = (iz0 + iz1) / 2;
    const seg = (x0: number, z0: number, x1: number, z1: number) => { if (x1 - x0 < 0.5 && z1 - z0 < 0.5) return; props.walls.push({ x0, z0, x1, z1, lime }); solids.push({ x0, z0, x1, z1, y0: 0, y1: 1.3 }); };
    for (const z of [iz0, iz1 - 0.2]) { let a = ix0; for (const g of gaps) { seg(a, z, g - 2.2, z + 0.2); a = g + 2.2; } seg(a, z, ix1, z + 0.2); }
    for (const x of [ix0, ix1 - 0.2]) { seg(x, iz0, x + 0.2, zgap - 2.2); seg(x, zgap + 2.2, x + 0.2, iz1); }
  }
}

/* ---------- collision grid ---------- */
const CELL = 40, grid = new Map<string, number[]>();
solids.forEach((s, idx) => {
  for (let cx = Math.floor(s.x0 / CELL); cx <= Math.floor(s.x1 / CELL); cx++) for (let cz = Math.floor(s.z0 / CELL); cz <= Math.floor(s.z1 / CELL); cz++) {
    const k = cx + ',' + cz; let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(idx);
  }
});
export function nearSolids(x: number, z: number): number[] {
  const a = grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)); return a || [];
}
/** Push a vertical capsule (radius r, from y to y+h) out of solids. Returns true if it hit something. */
export function collide(p: { x: number; z: number }, r: number, y: number, h: number): boolean {
  let hit = false;
  const seen = new Set<number>();
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    for (const idx of nearSolids(p.x + dx * r * 2, p.z + dz * r * 2)) {
      if (seen.has(idx)) continue; seen.add(idx);
      const s = solids[idx]; if (y > s.y1 - 0.05 || y + h < s.y0) continue;
      const cx = clamp(p.x, s.x0, s.x1), cz = clamp(p.z, s.z0, s.z1);
      let ex = p.x - cx, ez = p.z - cz; const d2 = ex * ex + ez * ez;
      if (d2 >= r * r) continue;
      if (d2 < 1e-8) { // center inside: push to nearest face
        const l = p.x - s.x0, rt = s.x1 - p.x, t = p.z - s.z0, bt = s.z1 - p.z, m = Math.min(l, rt, t, bt);
        if (m === l) p.x = s.x0 - r; else if (m === rt) p.x = s.x1 + r; else if (m === t) p.z = s.z0 - r; else p.z = s.z1 + r;
      } else { const d = Math.sqrt(d2); p.x = cx + (ex / d) * r; p.z = cz + (ez / d) * r; }
      hit = true;
    }
  }
  return hit;
}
/** Is point (x,y,z) inside any solid? Used by the camera. */
export function pointBlocked(x: number, y: number, z: number): boolean {
  for (const idx of nearSolids(x, z)) { const s = solids[idx]; if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1 && y > s.y0 && y < s.y1) return true; }
  return false;
}

/** Ground height including raised sidewalks. */
export function groundAt(x: number, z: number): number {
  const lx = x + HALF, lz = z + HALF;
  if (lx >= 0 && lz >= 0 && lx <= CITY && lz <= CITY) {
    const i = Math.floor((lx - ROAD) / PITCH), j = Math.floor((lz - ROAD) / PITCH);
    if (i >= 0 && j >= 0 && i < N && j < N && lx - ROAD - i * PITCH < BLOCK && lz - ROAD - j * PITCH < BLOCK) return (CANAL_RECTS.length && inCanal(x, z)) || inBay(x, z) ? WATER_Y - 3 : 0.15;
    return inBay(x, z) ? WATER_Y - 3 : rampAt(x, z);
  }
  if (onPier(x, z)) return PIER.y;
  return Math.max(heightAt(x, z), rampAt(x, z));
}
/** Height of the walkable surface under (x,z) at or below height y: ground, ramps, or a building roof you are standing on. */
export function floorAt(x: number, z: number, y: number): number {
  let g = groundAt(x, z);
  for (const idx of nearSolids(x, z)) { const s = solids[idx]; if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1 && s.y1 <= y + 0.6 && s.y1 > g) g = s.y1; }
  return g;
}

/* ---------- stunt ramps (part of the ground: cars launch off the top edge) ---------- */
export interface Ramp { id: string; name: string; x: number; z: number; yaw: number; len: number; w: number; h: number }
export const RAMPS: Ramp[] = [];
{
  const mid = (a: number) => (roadC(a + O) + roadC(a + 1 + O)) / 2, rc = (a: number) => roadC(a + O);
  const add = (id: string, name: string, cx: number, cz: number, yaw: number, len: number, w: number, h: number) => RAMPS.push({ id: rid(id), name, x: cx - Math.sin(yaw) * len / 2, z: cz - Math.cos(yaw) * len / 2, yaw, len, w, h });
  add('palm', RN.residential[0] + '・ジャンプ', rc(2) - 3.3, mid(5), 0, 10, 4.6, 2.4);
  add('neon', RN.commercial[0] + '・ジャンプ', mid(9), rc(9) + 3.3, Math.PI / 2, 10, 4.6, 2.5);
  add('foundry', RN.industrial + '・ジャンプ', rc(1) + 3.3, mid(11), Math.PI, 11, 4.6, 2.8);
  add('coral', RN.residential[1] + '・ジャンプ', mid(11), rc(4) - 3.3, -Math.PI / 2, 10, 4.6, 2.6);
  add('down', RN.downtown + '・ダイブ', rc(5) - 3.3, mid(7), 0, 12, 4.6, 3.0);
  add('hwy', 'ハイウェイ・ロケット', HWY_C + 5, 160, Math.PI, 16, 6, 3.6);
  add('runway', 'ランウェイ・メガジャンプ', AIRPORT.x0 + 420, -165, Math.PI / 2, 24, 8, 5.5);
}
export function rampAt(x: number, z: number): number {
  for (const r of RAMPS) {
    const dx = x - r.x, dz = z - r.z; if (dx * dx + dz * dz > (r.len + 6) * (r.len + 6)) continue;
    const s = Math.sin(r.yaw), c = Math.cos(r.yaw), lf = dx * s + dz * c, ls = dx * c - dz * s;
    if (lf >= 0 && lf <= r.len && Math.abs(ls) <= r.w / 2) return (r.h * lf) / r.len;
  }
  return 0;
}

export function districtAt(x: number, z: number): string {
  if (x > PORT.x0 && z > HALF + 60) return RN.port;
  if (x < -HALF - 60) return z < -HALF ? RN.hills : RN.airport;
  if (z < -HALF - 60) return RN.hills;
  if (x > HALF + 40) return RN.beach;
  const lx = x + HALF, lz = z + HALF, i = clamp(Math.floor(lx / PITCH), 0, N - 1), j = clamp(Math.floor(lz / PITCH), 0, N - 1);
  if (inTokyo()) {
    const outer = outerOf(i - O, j - O); if (outer) return REGION.outer![outer];
    const ring = ringOf(i - O, j - O); if (ring) return REGION.ring![ring];
    const zn = zoneOf(i, j), ci = i - O, cj = j - O;
    if (zn === 'park' && ci >= 9 && ci <= 10 && cj >= 3 && cj <= 4) return RN.park;
    if (zn === 'industrial') return RN.industrial;
    const c = (CORE - 1) / 2, d = Math.max(Math.abs(ci - c), Math.abs(cj - c));
    return d < 2.6 ? RN.downtown : d < 4.6 ? RN.commercial[ci < c ? 0 : 1] : RN.residential[ci < c ? 0 : 1];
  }
  if (i === LM_BLOCK.i && j === LM_BLOCK.j && REGION.landmark.kind !== 'seatower') return RN.park;
  { const C = CANAL_BLOCKS.get(j * N + i); if (C && C.axis !== 'pond') return C.name; }
  if (isBay(i, j)) return RN.sea;
  const c = (N - 1) / 2, dx = i - c, dz = j - c, d = Math.max(Math.abs(dx), Math.abs(dz));
  if (d < N * 0.12) return RN.downtown;
  if (d < N * 0.24) return RN.commercial[dx < 0 ? 0 : 1];
  if (dz > N * 0.3 && dx > 0) return RN.industrial;
  return RN.residential[dz < 0 ? 0 : 1];
}

export const SPAWN = (() => { const d = doors.find((q) => q.id === 'home') || doors[0]; return { x: d.x, z: d.z - 4 }; })();
