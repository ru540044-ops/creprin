import { mulberry, fbm, smooth, clamp } from './rng';

/* World units are meters. x = east, z = south, y = up. */
export const ROAD = 14, BLOCK = 86, PITCH = ROAD + BLOCK, N = 14;
export const CITY = N * PITCH + ROAD; // 1414 m
export const HALF = CITY / 2; // city spans -HALF..HALF on x and z
export const HWY_W = 26, HWY_C = HALF + 33; // ring highway centerline offset
export const WATER_Y = -0.8;

export const roadC = (k: number) => -HALF + k * PITCH + ROAD / 2; // center of road line k (0..N)
export const blockX0 = (i: number) => -HALF + i * PITCH + ROAD;

export type Zone = 'downtown' | 'commercial' | 'residential' | 'industrial' | 'park' | 'parking' | 'gas';
export type BType = 'glass' | 'office' | 'brick' | 'house' | 'warehouse' | 'shop' | 'terminal' | 'hangar';

export interface Building { x0: number; z0: number; x1: number; z1: number; y0: number; h: number; type: BType; tint: [number, number, number]; gable?: boolean; roofTint?: [number, number, number]; }
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
  trees: [] as { x: number; z: number; s: number; y: number }[],
  palms: [] as { x: number; z: number; s: number; y: number }[],
  pines: [] as { x: number; z: number; s: number; y: number }[],
  benches: [] as { x: number; z: number; a: number }[],
  bins: [] as { x: number; z: number }[],
  hydrants: [] as { x: number; z: number }[],
  containers: [] as { x: number; z: number; y: number; a: number; c: [number, number, number] }[],
  billboards: [] as { x: number; z: number; y: number; a: number; w: number; c: number }[],
  umbrellas: [] as { x: number; z: number; c: [number, number, number] }[],
};

/* ---------- zones ---------- */
const SPECIAL: Record<string, Zone> = { '9,3': 'park', '10,3': 'park', '9,4': 'park', '10,4': 'park', '3,4': 'park', '10,11': 'park', '2,2': 'parking', '11,8': 'parking', '5,11': 'parking', '0,6': 'gas', '13,9': 'gas' };
function zoneOf(i: number, j: number): Zone {
  const s = SPECIAL[i + ',' + j]; if (s) return s;
  if (i <= 3 && j >= 10) return 'industrial';
  const c = (N - 1) / 2, d = Math.max(Math.abs(i - c), Math.abs(j - c));
  if (d < 2.6) return 'downtown';
  if (d < 4.6) return 'commercial';
  return 'residential';
}

/* ---------- terrain ---------- */
// Land: a big rectangle (city + airport + hills) plus the port pier; everything else is sea.
export const LAND = { x0: -1500, x1: HALF + 160, z0: -1700, z1: HALF + 70 };
export const PORT = { x0: 160, x1: HALF + 200, z0: HALF + 70, z1: HALF + 330 };
export const AIRPORT = { x0: -1460, x1: -HALF - 70, z0: -420, z1: 420 };
export const BEACH_X = HALF + 70; // sand from here to LAND.x1
export function heightAt(x: number, z: number): number {
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
export const isWater = (x: number, z: number) => heightAt(x, z) < WATER_Y + 0.25;

/* ---------- city ---------- */
const rng = mulberry(20261107);
const pick = <T,>(a: T[], r: () => number) => a[Math.floor(r() * a.length)];
const GLASS_T: [number, number, number][] = [[0.75, 0.85, 0.95], [0.7, 0.78, 0.9], [0.85, 0.9, 0.95], [0.6, 0.72, 0.85]];
const OFFICE_T: [number, number, number][] = [[0.92, 0.88, 0.8], [0.85, 0.85, 0.88], [0.95, 0.92, 0.86], [0.8, 0.78, 0.75]];
const BRICK_T: [number, number, number][] = [[0.75, 0.45, 0.38], [0.65, 0.42, 0.35], [0.82, 0.6, 0.5], [0.6, 0.55, 0.52]];
const HOUSE_T: [number, number, number][] = [[0.98, 0.92, 0.82], [0.9, 0.82, 0.72], [0.82, 0.9, 0.92], [0.98, 0.86, 0.7], [0.88, 0.94, 0.86], [0.96, 0.84, 0.86]];
const ROOF_T: [number, number, number][] = [[0.55, 0.25, 0.2], [0.35, 0.35, 0.4], [0.45, 0.32, 0.25], [0.3, 0.38, 0.36]];
const SHOP_T: [number, number, number][] = [[0.95, 0.9, 0.82], [0.88, 0.8, 0.9], [0.8, 0.9, 0.95], [0.98, 0.85, 0.75]];

function addB(b: Building) { buildings.push(b); solids.push({ x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1, y0: b.y0, y1: b.y0 + b.h + (b.gable ? 4 : 0) }); }

const SHOP_LABELS: [string, string, string, string][] = [['store', 'QWIK 24', '#3dffb0', 'store'], ['diner', 'BAY DINER', '#ff6a9a', 'diner'], ['clothes', 'THREADS', '#c07aff', 'clothes'], ['store2', 'QWIK 24', '#3dffb0', 'store'], ['store3', 'QWIK 24', '#3dffb0', 'store'], ['arms', 'BAY ARMS', '#ff5a36', 'arms']];
let shopDoorsLeft = SHOP_LABELS.length;

for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const x0 = blockX0(i), z0 = blockX0(j), x1 = x0 + BLOCK, z1 = z0 + BLOCK, zone = zoneOf(i, j);
  blocks.push({ i, j, x0, z0, x1, z1, zone });
  const r = mulberry(i * 7919 + j * 104729 + 7), S = 0.15, m = 5; // sidewalk margin
  const ix0 = x0 + m, iz0 = z0 + m, ix1 = x1 - m, iz1 = z1 - m;
  if (zone === 'downtown') {
    const alongX = r() < 0.5, mid = alongX ? (ix0 + ix1) / 2 : (iz0 + iz1) / 2, a = 3;
    const halves = alongX ? [[ix0, iz0, mid - a, iz1], [mid + a, iz0, ix1, iz1]] : [[ix0, iz0, ix1, mid - a], [ix0, mid + a, ix1, iz1]];
    const c = (N - 1) / 2, dc = Math.hypot(i - c, j - c) / c;
    for (const [a0, b0, a1, b1] of halves) {
      const glass = r() < 0.65, h = (60 + r() * 150) * (1.25 - dc * 0.7);
      addB({ x0: a0, z0: b0, x1: a1, z1: b1, y0: S, h: Math.max(40, h), type: glass ? 'glass' : 'office', tint: pick(glass ? GLASS_T : OFFICE_T, r) });
    }
  } else if (zone === 'commercial') {
    // perimeter buildings around a service alley ring
    const d2 = 30, gap = 4;
    const lots: [number, number, number, number][] = [[ix0, iz0, ix1, iz0 + d2], [ix0, iz1 - d2, ix1, iz1], [ix0, iz0 + d2 + gap, ix0 + d2, iz1 - d2 - gap], [ix1 - d2, iz0 + d2 + gap, ix1, iz1 - d2 - gap]];
    for (const [a0, b0, a1, b1] of lots) {
      const long = Math.max(a1 - a0, b1 - b0), n = long > 50 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n, hor = a1 - a0 > b1 - b0;
        const bx0 = hor ? a0 + (a1 - a0) * t0 + (k ? 1.5 : 0) : a0, bx1 = hor ? a0 + (a1 - a0) * t1 - (k < n - 1 ? 1.5 : 0) : a1;
        const bz0 = hor ? b0 : b0 + (b1 - b0) * t0 + (k ? 1.5 : 0), bz1 = hor ? b1 : b0 + (b1 - b0) * t1 - (k < n - 1 ? 1.5 : 0);
        const t = r(), type: BType = t < 0.45 ? 'shop' : t < 0.75 ? 'office' : 'brick';
        const h = type === 'shop' ? 8 + r() * 14 : 18 + r() * 30;
        addB({ x0: bx0, z0: bz0, x1: bx1, z1: bz1, y0: S, h, type, tint: pick(type === 'shop' ? SHOP_T : type === 'office' ? OFFICE_T : BRICK_T, r) });
        if (type === 'shop' && shopDoorsLeft > 0 && hor && (b0 === iz0 || b1 === iz1) && r() < 0.2) {
          const L = SHOP_LABELS[SHOP_LABELS.length - shopDoorsLeft]; shopDoorsLeft--;
          const front = b0 === iz0 ? bz0 : bz1, dir = b0 === iz0 ? -1 : 1;
          doors.push({ id: L[0], x: (bx0 + bx1) / 2, z: front + dir * 0.8, ang: dir < 0 ? Math.PI : 0, label: L[1], interior: L[3], color: L[2] });
        }
      }
    }
    for (let k = 0; k < 3; k++) props.bins.push({ x: ix0 + d2 + 2 + r() * (ix1 - ix0 - 2 * d2 - 4), z: iz0 + d2 + 2 });
  } else if (zone === 'residential') {
    if (r() < 0.25) {
      const h = 14 + r() * 18;
      addB({ x0: ix0 + 4, z0: iz0 + 4, x1: ix1 - 4, z1: iz0 + 34, y0: S, h, type: 'brick', tint: pick(BRICK_T, r) });
      addB({ x0: ix0 + 4, z0: iz1 - 34, x1: ix1 - 4, z1: iz1 - 4, y0: S, h: h * 0.8, type: 'brick', tint: pick(BRICK_T, r) });
    } else {
      const cw = (ix1 - ix0) / 3, ch = (iz1 - iz0) / 2;
      for (let rr = 0; rr < 2; rr++) for (let cc = 0; cc < 3; cc++) {
        const w = 13 + r() * 5, d = 12 + r() * 6, cx = ix0 + cw * (cc + 0.5), cz = iz0 + ch * (rr + 0.5) + (rr ? 4 : -4);
        addB({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2, y0: S, h: 5.5 + r() * 3.5, type: 'house', tint: pick(HOUSE_T, r), gable: true, roofTint: pick(ROOF_T, r) });
        if (r() < 0.7) props.trees.push({ x: cx + (r() - 0.5) * 6, z: cz + (rr ? d / 2 + 6 : -d / 2 - 6), s: 0.8 + r() * 0.5, y: S });
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
    for (let k = 0; k < 22; k++) { const x = ix0 + 4 + r() * (ix1 - ix0 - 8), z = iz0 + 4 + r() * (iz1 - iz0 - 8); if (Math.abs(x - (x0 + x1) / 2) < 3 || Math.abs(z - (z0 + z1) / 2) < 3) continue; props.trees.push({ x, z, s: 0.9 + r() * 0.8, y: 0.3 }); }
    for (let k = 0; k < 4; k++) props.benches.push({ x: (x0 + x1) / 2 + (k % 2 ? 4 : -4), z: z0 + 20 + k * 14, a: k % 2 ? -Math.PI / 2 : Math.PI / 2 });
  } else if (zone === 'parking') {
    addB({ x0: ix1 - 16, z0: iz0 + 2, x1: ix1 - 2, z1: iz0 + 12, y0: S, h: 4, type: 'office', tint: [0.8, 0.8, 0.82] });
  } else if (zone === 'gas') {
    const sx0 = ix0 + 10, sz0 = iz0 + 50;
    addB({ x0: sx0, z0: sz0, x1: sx0 + 26, z1: sz0 + 16, y0: S, h: 5, type: 'shop', tint: [0.95, 0.95, 0.95] });
    doors.push({ id: 'gas' + i, x: sx0 + 13, z: sz0 - 0.8, ang: Math.PI, label: 'FUEL & SNACKS', interior: 'gas', color: '#ffc03a' });
  }
}

// safehouse door: the first apartment block near the center-south
{
  let best: Building | null = null, bd = 1e9;
  for (const b of buildings) if (b.type === 'brick') { const d = Math.hypot((b.x0 + b.x1) / 2 - 120, (b.z0 + b.z1) / 2 - 250); if (d < bd) { bd = d; best = b; } }
  if (best) doors.push({ id: 'home', x: (best.x0 + best.x1) / 2, z: best.z0 - 0.8, ang: Math.PI, label: 'SAFEHOUSE', interior: 'home', color: '#2be4ff' });
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
export interface Landmark { id: string; label: string; color: string; x: number; z: number; spawn: { x: number; z: number; yaw: number } }
function landmark(id: string, label: string, color: string, tx: number, tz: number): Landmark {
  let best: Building | null = null, bd = 1e9;
  for (const b of buildings) {
    if (b.type !== 'office' && b.type !== 'brick' && b.type !== 'glass') continue;
    const blk = blocks.find((q) => b.x0 >= q.x0 - 1 && b.x1 <= q.x1 + 1 && b.z0 >= q.z0 - 1 && b.z1 <= q.z1 + 1);
    if (!blk || blk === GARAGE.block || b.z0 - blk.z0 > 7 || b.x1 - b.x0 < 14) continue;
    const cx = (b.x0 + b.x1) / 2; if (doors.some((d) => Math.hypot(d.x - cx, d.z - b.z0) < 30)) continue;
    const d = Math.hypot(cx - tx, b.z0 - tz); if (d < bd) { bd = d; best = b; }
  }
  const b = best!, cx = (b.x0 + b.x1) / 2, blk = blocks.find((q) => b.x0 >= q.x0 - 1 && b.x1 <= q.x1 + 1 && b.z0 >= q.z0 - 1 && b.z1 <= q.z1 + 1)!;
  return { id, label, color, x: cx, z: b.z0 - 0.8, spawn: { x: cx, z: blk.z0 - 2.2, yaw: Math.PI } };
}
export const POLICE_HQ = landmark('pd', 'BAY PD', '#2b6bff', -380, -220);
export const HOSPITAL = landmark('hosp', 'BAY GENERAL', '#ff4b5c', 330, 120);
export const LANDMARKS = [POLICE_HQ, HOSPITAL];
export const EXPORT_DOCK = { x: PORT.x0 + 26, z: PORT.z0 + 34 };
export const CUSTOMS = landmark('customs', 'BAY CUSTOMS', '#ff9a3a', 300, 420);
/** Helipads: one on the airport apron, one on a downtown tower roof. */
export const HELIPADS: { x: number; z: number; y: number; name: string }[] = [{ x: AIRPORT.x0 + 610, z: 150, y: 0, name: '空港ヘリパッド' }];
{
  let best: Building | null = null, bd = 1e9;
  for (const b of buildings) { if (b.type !== 'glass' && b.type !== 'office') continue; if (b.x1 - b.x0 < 26 || b.z1 - b.z0 < 26 || b.h > 140) continue; const d = Math.hypot((b.x0 + b.x1) / 2 - 60, (b.z0 + b.z1) / 2 + 60); if (d < bd) { bd = d; best = b; } }
  if (best) HELIPADS.push({ x: (best.x0 + best.x1) / 2, z: (best.z0 + best.z1) / 2, y: best.y0 + best.h, name: 'ダウンタウン屋上ヘリパッド' });
  for (const h of HELIPADS) parkSlots.push({ x: h.x, z: h.z, yaw: Math.PI, kind: 'heli', ci: 0 });
  for (let n = 0; n < 3; n++) parkSlots.push({ x: AIRPORT.x0 + 360 + n * 7, z: 110, yaw: Math.PI, kind: 'taxi', ci: 0 });
}

/** Time trials: checkpoints on road intersections (n = node index) or explicit points. */
export interface Trial { id: string; name: string; start: { x: number; z: number; yaw: number }; cps: { x: number; z: number }[]; par: number; reward: number }
const nd = (i: number, j: number) => ({ x: roadC(i), z: roadC(j) });
export const TRIALS: Trial[] = [
  { id: 'loop', name: 'ダウンタウン・ループ', start: { x: roadC(4), z: roadC(4), yaw: Math.PI / 2 }, cps: [nd(6, 4), nd(8, 4), nd(10, 4), nd(10, 6), nd(10, 8), nd(10, 10), nd(8, 10), nd(6, 10), nd(4, 10), nd(4, 8), nd(4, 6), nd(4, 4)], par: 72, reward: 3000 },
  { id: 'hwy', name: 'ハイウェイ・ラン', start: { x: roadC(14) - 20, z: roadC(7), yaw: Math.PI / 2 }, cps: [{ x: HWY_C, z: 0 }, { x: HWY_C, z: -370 }, { x: HWY_C, z: -HWY_C }, { x: 370, z: -HWY_C }, { x: roadC(7), z: -HWY_C }, nd(7, 0)], par: 84, reward: 4000 },
  { id: 'zig', name: 'パームホロウ・ジグザグ', start: { x: roadC(1), z: roadC(1) - 30, yaw: 0 }, cps: [nd(1, 3), nd(3, 3), nd(3, 5), nd(5, 5), nd(5, 7), nd(1, 7), nd(1, 9), nd(3, 9), nd(3, 12), nd(1, 12)], par: 95, reward: 3500 },
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
  for (let z = -HALF; z < HALF; z += 26) { props.palms.push({ x: BEACH_X + 8 + r() * 10, z: z + r() * 10, s: 0.9 + r() * 0.4, y: heightAt(BEACH_X + 10, z) }); if (r() < 0.6) props.umbrellas.push({ x: BEACH_X + 40 + r() * 20, z: z + r() * 14, c: pick([[1, 0.3, 0.4], [0.2, 0.7, 1], [1, 0.8, 0.2], [1, 1, 1]], r) }); }
  // port: container stacks + warehouses
  for (let row = 0; row < 6; row++) for (let col = 0; col < 14; col++) {
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
  for (let k = 0; k < 900; k++) {
    const x = LAND.x0 + 60 + r() * (LAND.x1 - LAND.x0 - 120), z = LAND.z0 + 60 + r() * (-HALF - 120 - LAND.z0 - 60), h = heightAt(x, z);
    if (h < 3) continue; props.pines.push({ x, z, s: 0.7 + r() * 0.8, y: h });
  }
  // billboards on mid-rise roofs
  for (const b of buildings) if ((b.type === 'office' || b.type === 'brick') && b.h < 50 && r() < 0.12) props.billboards.push({ x: (b.x0 + b.x1) / 2, z: b.z0 + 2, y: b.y0 + b.h, a: 0, w: Math.min(18, b.x1 - b.x0 - 4), c: Math.floor(r() * 4) });
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
    if (i >= 0 && j >= 0 && i < N && j < N && lx - ROAD - i * PITCH < BLOCK && lz - ROAD - j * PITCH < BLOCK) return 0.15;
    return rampAt(x, z);
  }
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
  const mid = (a: number) => (roadC(a) + roadC(a + 1)) / 2;
  const add = (id: string, name: string, cx: number, cz: number, yaw: number, len: number, w: number, h: number) => RAMPS.push({ id, name, x: cx - Math.sin(yaw) * len / 2, z: cz - Math.cos(yaw) * len / 2, yaw, len, w, h });
  add('palm', 'パームホロウ・ジャンプ', roadC(2) - 3.3, mid(5), 0, 10, 4.6, 2.4);
  add('neon', 'ネオンマイル・ジャンプ', mid(9), roadC(9) + 3.3, Math.PI / 2, 10, 4.6, 2.5);
  add('foundry', 'ファウンドリー・ジャンプ', roadC(1) + 3.3, mid(11), Math.PI, 11, 4.6, 2.8);
  add('coral', 'コーラル・ジャンプ', mid(11), roadC(4) - 3.3, -Math.PI / 2, 10, 4.6, 2.6);
  add('down', 'ダウンタウン・ダイブ', roadC(5) - 3.3, mid(7), 0, 12, 4.6, 3.0);
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
  if (x > PORT.x0 && z > HALF + 60) return 'ポート・ネオン';
  if (x < -HALF - 60) return z < -HALF ? 'パリセード・ヒルズ' : 'ベイ国際空港';
  if (z < -HALF - 60) return 'パリセード・ヒルズ';
  if (x > HALF + 40) return 'サウスビーチ';
  const lx = x + HALF, lz = z + HALF, i = clamp(Math.floor(lx / PITCH), 0, N - 1), j = clamp(Math.floor(lz / PITCH), 0, N - 1);
  const zn = zoneOf(i, j);
  return ({ downtown: 'ダウンタウン', commercial: 'ネオンマイル', residential: i < N / 2 ? 'パームホロウ' : 'コーラルハイツ', industrial: 'ファウンドリー', park: 'ベイパーク', parking: 'パーキング', gas: 'ハイウェイサイド' } as Record<Zone, string>)[zn];
}

export const SPAWN = (() => { const d = doors.find((q) => q.id === 'home') || doors[0]; return { x: d.x, z: d.z - 4 }; })();
