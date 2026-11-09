import type { InteriorDef, Furn, View } from './Interiors';
import { buildings, blocks, doors, Building, BlockInfo, topFoot, blockOfB } from './cityGen';
import { mulberry } from './rng';

/**
 * Every building without a hand-made interior gets a street door and a procedurally furnished interior,
 * generated when you walk in (one shared slot, 'bi'). Interior style follows the building type.
 */
export type BKind = 'lobby' | 'office' | 'apartment' | 'shop' | 'warehouse' | 'hangar' | 'terminal' | 'house';
export interface BDoor { id: string; b: number; x: number; z: number; fx: number; fz: number; ang: number; y: number; kind: BKind; sub: number; label: string }
export interface Npc { x: number; z: number; yaw: number; look: { skin: string; shirt: string; pants: string; shoe: string; hair: string } }

const f = (x0: number, z0: number, x1: number, z1: number, h: number, c: string, o: Partial<Furn> = {}): Furn => ({ x0, z0, x1, z1, h, c, ...o });
const pickR = <T,>(a: T[], r: () => number) => a[Math.floor(r() * a.length)];
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'], HAIR = ['#1a1012', '#4a2c1a', '#8b5a2b', '#2b2b2b', '#d4b06a'];
const npc = (x: number, z: number, yaw: number, shirt: string, r: () => number): Npc => ({ x, z, yaw, look: { skin: pickR(SKIN, r), shirt, pants: '#24262c', shoe: '#2a2a2e', hair: pickR(HAIR, r) } });

const SHOPS = [
  { key: 'cafe', names: ['CAFE MOKA', 'BEAN BAY', 'カフェ 灯', 'HARBOR COFFEE'] },
  { key: 'ramen', names: ['ラーメン 一番', '麺屋 潮', 'RAMEN TOKO', '博多 ラーメン'] },
  { key: 'boutique', names: ['BOUTIQUE LUNA', 'MODE BAY', 'STUDIO 8', 'SELECT'] },
  { key: 'electronics', names: ['DENKI BAY', 'PIXEL MART', '電気のベイ', 'GADGET HUB'] },
  { key: 'bar', names: ['BAR NIGHTJAR', 'NEON LOUNGE', 'BAR 月', 'BLUE NOTE'] },
  { key: 'books', names: ['BAY BOOKS', '本の森', 'PAGE TURN', '古本屋'] },
  { key: 'pharmacy', names: ['BAY 薬局', 'GREEN CROSS', 'ドラッグ ベイ', 'CARE+'] },
  { key: 'gym', names: ['IRON BAY GYM', 'FIT 24', 'PULSE GYM', '筋トレ道場'] },
];
const LOBBY = ['NEON BAY TOWER', 'BAY TRADE CENTER', 'HARBOR ONE', 'SKYLINE PLAZA', 'MERIDIAN', 'AURORA BLDG', 'CENTRAL BANK', 'PACIFIC LIFE', 'ZENITH TOWER', 'OCEANIC HQ'];
const OFFICE = ['BAY OFFICE', 'KAIRO DESIGN', 'PIXEL WORKS', 'MARINA LAW', 'ORBIT SOFT', 'LUMEN INC', 'NORTH STAR', 'TIDE MEDIA'];
const APT = ['潮風', 'パーム', 'コーラル', 'ハーバー', 'サンセット', 'ベイサイド', 'マリン', 'ネオン'];

const kindOf = (b: Building): BKind => b.type === 'glass' ? 'lobby' : b.type === 'office' ? (b.h > 25 ? 'lobby' : 'office') : b.type === 'brick' ? 'apartment' : b.type === 'shop' ? 'shop' : b.type === 'warehouse' ? 'warehouse' : b.type === 'hangar' ? 'hangar' : b.type === 'terminal' ? 'terminal' : 'house';

/* ------------------------------------------------------------------ doors */
export const BDOORS: BDoor[] = [];
const grid = new Map<string, number[]>(), CELL = 30;
{
  const blockOf = (b: Building): BlockInfo | undefined => blockOfB(b) ?? blocks.find((q) => b.x0 >= q.x0 - 1 && b.x1 <= q.x1 + 1 && b.z0 >= q.z0 - 1 && b.z1 <= q.z1 + 1);
  buildings.forEach((b, i) => {
    if (b.x1 - b.x0 < 6 || b.z1 - b.z0 < 6) return;
    if (doors.some((d) => d.x > b.x0 - 3 && d.x < b.x1 + 3 && d.z > b.z0 - 3 && d.z < b.z1 + 3)) return; // has a hand-made interior
    const k = blockOf(b);
    let nx = 0, nz = -1;
    if (k) { const ds: [number, number, number][] = [[b.z0 - k.z0, 0, -1], [k.z1 - b.z1, 0, 1], [b.x0 - k.x0, -1, 0], [k.x1 - b.x1, 1, 0]]; ds.sort((a, c) => a[0] - c[0]); nx = ds[0][1]; nz = ds[0][2]; }
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, fx = nx ? (nx < 0 ? b.x0 : b.x1) : cx, fz = nz ? (nz < 0 ? b.z0 : b.z1) : cz;
    const kind = kindOf(b), r = mulberry(i * 7919 + 3), sub = Math.floor(r() * 1000);
    const label = kind === 'lobby' ? LOBBY[sub % LOBBY.length] : kind === 'office' ? OFFICE[sub % OFFICE.length] : kind === 'apartment' ? APT[sub % APT.length] + 'マンション' : kind === 'shop' ? SHOPS[sub % SHOPS.length].names[(sub >> 3) % 4] : kind === 'warehouse' ? 'BAY LOGISTICS 倉庫' : kind === 'hangar' ? '格納庫' : kind === 'terminal' ? 'ベイ国際空港 ターミナル' : '民家';
    const d: BDoor = { id: 'b' + i, b: i, x: fx + nx * 0.8, z: fz + nz * 0.8, fx, fz, ang: Math.atan2(nx, nz), y: b.y0, kind, sub, label };
    BDOORS.push(d); const key = Math.floor(d.x / CELL) + ',' + Math.floor(d.z / CELL); let a = grid.get(key); if (!a) grid.set(key, (a = [])); a.push(BDOORS.length - 1);
  });
}
export function nearBDoor(x: number, z: number, r = 1.8): BDoor | null {
  let best: BDoor | null = null, bd = r;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const i of grid.get((Math.floor(x / CELL) + dx) + ',' + (Math.floor(z / CELL) + dz)) || []) { const d = BDOORS[i], q = Math.hypot(d.x - x, d.z - z); if (q < bd) { bd = q; best = d; } }
  return best;
}
export const bdoorById = (id: string) => (id.startsWith('b') ? BDOORS.find((d) => d.id === id) || null : null);

/* ------------------------------------------------------------------ interiors */
export type GenDef = InteriorDef & { npcs?: Npc[]; roofSpot?: { x: number; z: number }; roof?: { x: number; z: number; y: number }; noSign?: boolean; ownLights?: boolean };
const OX = -4300;
const L = (x: number, y: number, z: number, c = '#fff1dc', i = 14, d = 16) => ({ x, y, z, c, i, d });
const PLANT = '#2f6a3a';

export function genInterior(d: BDoor): GenDef {
  const b = buildings[d.b], r = mulberry(d.b * 104729 + 17), T = topFoot(b);
  const roofOK = b.h > 9 && d.kind !== 'house' && d.kind !== 'terminal' && d.kind !== 'hangar' && d.kind !== 'warehouse';
  const base = (w: number, dd: number, h: number, wall: string, floor: string, floorTex: GenDef['floorTex'], furniture: Furn[], extra: Partial<GenDef> = {}): GenDef => ({
    id: 'bi', name: d.label, ox: OX, oz: 0, w, d: dd, h, wall, floor, floorTex, furniture,
    exit: { x: 0, z: dd / 2 - 1.0 }, spawn: { x: 0, z: dd / 2 - 2.2, yaw: Math.PI },
    roof: roofOK ? { x: (T.x0 + T.x1) / 2, z: (T.z0 + T.z1) / 2, y: b.y0 + b.h } : undefined, ...extra,
  });
  const acc = pickR(['#2be4ff', '#ffd23a', '#ff3f93', '#3dffb0', '#b07aff', '#ff8a3a'], r);
  switch (d.kind) {
    case 'lobby': {
      const dark = r() < 0.4, wall = dark ? '#2b2e36' : pickR(['#dcd9d3', '#e6e2da', '#d4d8dc'], r), sofa = pickR(['#2a2a30', '#6a4a3a', '#e8e4dc', '#3a4a5a'], r);
      const F: Furn[] = [
        f(-7, -7.98, 7, -7.92, 5.6, dark ? '#1a1c22' : '#5a4434', { walk: true }), f(-6, -7.9, 6, -7.84, 0.35, acc, { y0: 4.3, glow: true, walk: true }),
        f(-4.5, -3.2, 4.5, -2.2, 1.1, '#1c1d22', { rough: 0.25 }), f(-4.5, -2.22, 4.5, -2.16, 0.1, acc, { y0: 0.95, glow: true, walk: true }),
        f(6, 1, 10, 1.9, 0.75, sofa), f(6, 4.5, 10, 5.4, 0.75, sofa), f(7, 2.6, 9, 3.8, 0.4, '#8890a0', { metal: 0.9, rough: 0.05 }),
        f(-6.5, -0.4, -5.7, 0.4, 6, dark ? '#3a3e48' : '#cfccc6'), f(5.7, -0.4, 6.5, 0.4, 6, dark ? '#3a3e48' : '#cfccc6'),
        f(-11.5, 6.6, -10.7, 7.4, 1.8, PLANT), f(10.7, 6.6, 11.5, 7.4, 1.8, PLANT), f(10.7, -7.4, 11.5, -6.6, 2.2, PLANT),
      ];
      if (d.label === 'CENTRAL BANK') F.push(f(5.2, -7.97, 7.8, -7.8, 2.8, '#8a8f98', { metal: 0.9, rough: 0.25, walk: true }), f(6.2, -7.82, 6.8, -7.7, 0.6, '#c9a24a', { y0: 1.1, metal: 0.9, rough: 0.2, walk: true }), f(5.2, -7.97, 7.8, -7.8, 0.08, '#ff2a40', { y0: 2.9, glow: true, walk: true }));
      for (let k = 0; k < 3; k++) { const z = -5.5 + k * 2.6; F.push(f(-11.98, z - 0.8, -11.9, z + 0.8, 2.6, '#b8bcc4', { metal: 0.9, rough: 0.18, walk: true }), f(-11.97, z - 0.2, -11.92, z + 0.2, 0.15, '#ffb35a', { y0: 2.8, glow: true, walk: true })); }
      return base(24, 16, 6, wall, '#ece9e4', 'marble', F, { lights: [L(-6, 5.6, -2, '#fff1dc', 16, 18), L(6, 5.6, -2, '#fff1dc', 16, 18), L(0, 5.6, 4, '#fff1dc', 14, 16)], ownLights: true, roofSpot: { x: -10.5, z: -3 }, npcs: [npc(0, -3.8, 0, '#1d2c4d', r), npc(9, -6, -Math.PI / 2, '#2a2a30', r)] });
    }
    case 'office': {
      const F: Furn[] = [];
      for (const z of [-4.5, -1.5]) for (let x = -7.5; x <= 7.5; x += 3) { F.push(f(x - 1.2, z - 0.45, x + 1.2, z + 0.45, 0.75, '#d9d4ca'), f(x - 0.4, z - 0.32, x + 0.4, z - 0.26, 0.45, '#9fd8ff', { y0: 0.8, glow: true }), f(x - 0.25, z + 0.6, x + 0.25, z + 1.1, 0.9, '#2a2c33')); }
      F.push(f(4.5, 2, 9.95, 2.08, 3.2, '#a8c4dc', { metal: 0.9, rough: 0.05 }), f(6, 3.4, 8.8, 5, 0.75, '#6a4a30'), f(-9.8, 4.4, -8.8, 5.2, 1.1, '#cfd2d6'), f(-9.8, 5.8, -9.3, 6.3, 1.3, '#9fd8ff'), f(9.2, -6.6, 9.9, -5.9, 1.6, PLANT), f(-9.95, 1.0, -9.88, 2.6, 2.4, '#b8bcc4', { metal: 0.9, rough: 0.2, walk: true }));
      return base(20, 14, 3.2, '#e8e6e1', '#6a7080', 'tiles', F, { lights: [L(-5, 3, -2, '#f4f8ff', 9, 12), L(5, 3, -2, '#f4f8ff', 9, 12), L(0, 3, 3.5, '#f4f8ff', 8, 10)], ownLights: true, noSign: false, roofSpot: { x: -9.0, z: 1.8 }, npcs: [npc(-8.6, 5.2, -Math.PI / 2, pickR(['#e8e4dc', '#9ab0d0', '#d0b0a0'], r), r)] });
    }
    case 'apartment': case 'house': {
      const big = d.kind === 'house', w = big ? 13 : 11, dd = big ? 10 : 9, h = big ? 2.8 : 2.7, hw = w / 2, hd = dd / 2;
      const wood = pickR(['#6a4a30', '#8a6a4a', '#4a3424', '#a8835a'], r), sofa = pickR(['#4a5a6a', '#7a3a3a', '#3a5a4a', '#d8cfbf', '#2a2a30'], r), rug = pickR(['#b8a48a', '#8a9ab0', '#a08080', '#c8c0a8'], r);
      const F: Furn[] = [
        f(-hw + 0.1, -1.5, -hw + 1.0, 1.5, 0.75, sofa), f(-hw + 1.1, -1.6, -hw + 3.7, 1.6, 0.02, rug, { walk: true }), f(-hw + 2.0, -0.6, -hw + 3.0, 0.6, 0.4, wood),
        f(hw - 0.5, -1.2, hw - 0.05, 1.2, 0.5, '#3a2a20'), f(hw - 0.3, -0.9, hw - 0.25, 0.9, 0.75, '#1b2c50', { y0: 0.8, glow: true }),
        f(1.8, -hd + 0.05, hw - 0.6, -hd + 0.65, 0.9, '#e8e2d6'), f(1.8, -hd + 0.02, hw - 0.6, -hd + 0.35, 0.7, '#d0c8ba', { y0: 1.6 }), f(hw - 0.6, -hd + 0.05, hw - 0.05, -hd + 0.75, 1.8, '#d8dbe0', { metal: 0.6, rough: 0.3 }),
        f(1.4, -2.2, 3.0, -1.2, 0.75, wood), f(1.9, -0.9, 2.5, -0.4, 0.9, wood), f(1.9, -3.0, 2.5, -2.5, 0.9, wood),
        f(-hw + 0.1, -hd + 0.1, -hw + 2.3, -hd + 2.1, 0.55, '#f2f0ea'), f(-hw + 0.05, -hd + 0.1, -hw + 0.2, -hd + 2.1, 1.0, wood),
        f(-1.2, -hd + 0.05, 0.2, -hd + 0.4, 1.9, wood), f(hw - 0.55, hd - 1.8, hw - 0.05, hd - 1.3, 1.1, PLANT),
      ];
      const views: View[] = [{ wall: 'n', a0: -hw + 2.6, a1: 1.4, y0: 0.9, y1: 2.2, style: big ? 'suburb' : pickR(['danchi', 'suburb'] as const, r) }];
      const lights = [L(-hw / 2, h - 0.25, 0, '#ffe2b8', 7, 9), L(hw / 2, h - 0.25, -1, '#ffe2b8', 7, 9)];
      const extra: Partial<GenDef> = { views, lights, ownLights: true, noSign: true, ceil: '#f6f1e8' };
      if (!big && roofOK) { F.push(f(hw - 0.06, 1.6, hw - 0.01, 2.6, 2.1, '#5a4434', { walk: true })); extra.roofSpot = { x: hw - 0.9, z: 2.1 }; }
      if (r() < 0.6) extra.npcs = [npc(-hw + 2.4, 1.5, Math.PI * 0.75, pickR(['#e84a5f', '#2a9d8f', '#f4a261', '#6c5ce7'], r), r)];
      const name = big ? d.label : `${d.label} ${1 + Math.floor(r() * Math.max(1, b.h / 3.2))}0${1 + Math.floor(r() * 6)}号室`;
      return base(w, dd, h, pickR(['#efe6d8', '#e8e2d6', '#dfe6ea', '#f2ece4'], r), '#b08a5e', 'wood', F, { ...extra, name });
    }
    case 'shop': return shop(d, r, base, acc);
    case 'warehouse': {
      const F: Furn[] = [], crate = ['#b07a3a', '#8a6a4a', '#3a5a8a', '#6a8a4a', '#c0a060', '#7a3a3a'];
      for (const z of [-8, -3, 2]) {
        for (let x = -12; x <= 12; x += 4) F.push(f(x - 0.1, z - 0.6, x + 0.1, z + 0.6, 7, '#2b5aa8'));
        for (const y of [2.6, 5.2]) F.push(f(-12, z - 0.6, 12, z + 0.6, 0.12, '#e07a1a', { y0: y }));
        for (let k = 0; k < 9; k++) { const x = -11 + r() * 21, y = [0, 2.72, 5.32][k % 3]; F.push(f(x, z - 0.5, x + 1.2 + r() * 0.8, z + 0.5, 1.0 + r() * 0.6, pickR(crate, r), { y0: y })); }
      }
      F.push(f(4, 6, 5.4, 8, 1.4, '#ffcc00'), f(4.2, 8, 5.2, 8.15, 3.2, '#2a2a2a'), f(4.3, 8.15, 5.1, 9.3, 0.08, '#2a2a2a', { y0: 0.2 }), f(-13, 6, -10, 8.5, 1.2, '#b07a3a'), f(-12.5, 6.5, -10.8, 8, 1.0, '#8a6a4a', { y0: 1.2 }));
      for (const z of [-6, 0, 6]) F.push(f(-10, z - 0.1, 10, z + 0.1, 0.1, '#ffffff', { y0: 8.7, glow: true, walk: true }));
      return base(30, 22, 9, '#9a9ea4', '#8a8a88', 'concrete', F, { lights: [L(-8, 8, -3, '#f0f4ff', 20, 22), L(8, 8, -3, '#f0f4ff', 20, 22), L(0, 8, 6, '#f0f4ff', 18, 20)], ownLights: true, npcs: [npc(2.5, 7, -Math.PI / 2, '#ff8a2a', r)] });
    }
    case 'hangar': {
      const F: Furn[] = [
        f(-1.1, -11, 1.1, 5, 2.2, '#f4f4f6', { y0: 0.8 }), f(-0.85, 5, 0.85, 6.6, 1.7, '#f4f4f6', { y0: 1.0 }), f(-0.7, 4.4, 0.7, 6.0, 0.5, '#2a3a50', { y0: 2.4 }),
        f(-8.5, -4, 8.5, -1.4, 0.25, '#e8e8ec', { y0: 1.7 }), f(-0.12, -11, 0.12, -8.4, 2.8, '#c0392b', { y0: 3.0 }), f(-3.2, -11, 3.2, -9.6, 0.2, '#e8e8ec', { y0: 2.9 }),
        f(-5.2, -3.4, -3.8, -0.6, 1.1, '#9aa0a8', { metal: 0.8, rough: 0.3, y0: 0.6 }), f(3.8, -3.4, 5.2, -0.6, 1.1, '#9aa0a8', { metal: 0.8, rough: 0.3, y0: 0.6 }),
        f(-0.2, 3.4, 0.2, 3.8, 0.8, '#2a2a2a'), f(-2.2, -3, -1.8, -2.6, 0.8, '#2a2a2a'), f(1.8, -3, 2.2, -2.6, 0.8, '#2a2a2a'),
        f(-16.5, -10, -15.4, -6, 1.2, '#c0392b'), f(15.4, -2, 16.5, 4, 1.0, '#c0392b'), f(-16, 6, -13, 8, 0.15, '#ffcc00', { walk: true }),
      ];
      for (const z of [-8, 0, 8]) F.push(f(-14, z - 0.1, 14, z + 0.1, 0.1, '#ffffff', { y0: 11.7, glow: true, walk: true }));
      return base(34, 26, 12, '#a8acb2', '#8a8a88', 'concrete', F, { lights: [L(-8, 11, -2, '#f0f4ff', 26, 26), L(8, 11, -2, '#f0f4ff', 26, 26), L(0, 11, 8, '#f0f4ff', 22, 22)], ownLights: true, npcs: [npc(3, 5, -Math.PI / 3, '#2b6bff', r)] });
    }
    case 'terminal': default: {
      const F: Furn[] = [f(-6, -10.98, 6, -10.92, 2.0, '#0b1220', { y0: 4.4 }), f(-5.6, -10.99, 5.6, -10.95, 0.12, '#ffd23a', { y0: 5.6, glow: true, walk: true }), f(-5.6, -10.99, 5.6, -10.95, 0.12, '#ffd23a', { y0: 5.1, glow: true, walk: true }), f(-5.6, -10.99, 5.6, -10.95, 0.12, '#ffd23a', { y0: 4.6, glow: true, walk: true })];
      const npcs: Npc[] = [];
      for (let k = 0; k < 6; k++) { const x = -12.5 + k * 5; F.push(f(x - 2, -9.2, x + 2, -8.2, 1.1, '#cfd4da'), f(x - 0.6, -10.97, x + 0.6, -10.92, 0.7, '#2b6bff', { y0: 2.6, glow: true, walk: true })); if (k % 2 === 0) npcs.push(npc(x, -9.8, 0, '#1d2c4d', r)); }
      for (const z of [-2, 1.5]) for (const [x0, x1] of [[-12, -4], [4, 12]]) F.push(f(x0, z - 0.35, x1, z + 0.35, 0.45, '#2b6bff'), f(x0, z + 0.25, x1, z + 0.35, 0.9, '#2b6bff'));
      F.push(f(-16.5, 9.5, -15.5, 10.5, 2.2, PLANT), f(15.5, 9.5, 16.5, 10.5, 2.2, PLANT), f(-16.5, -10.5, -15.5, -9.5, 2.2, PLANT));
      return base(34, 22, 8, '#e6ebf0', '#ece9e4', 'marble', F, { lights: [L(-10, 7.5, -3, '#f4f8ff', 20, 22), L(10, 7.5, -3, '#f4f8ff', 20, 22), L(0, 7.5, 5, '#f4f8ff', 20, 22)], ownLights: true, npcs });
    }
  }
}

function shop(d: BDoor, r: () => number, base: (w: number, dd: number, h: number, wall: string, floor: string, floorTex: GenDef['floorTex'], furniture: Furn[], extra?: Partial<GenDef>) => GenDef, acc: string): GenDef {
  const key = SHOPS[d.sub % SHOPS.length].key, F: Furn[] = [], W = 14, D = 10, H = 3.6;
  const counter = (c: string) => F.push(f(-3, -3.4, 3, -2.6, 1.05, c));
  const tables = (c: string, ch: string) => { for (const [x, z] of [[-4.6, -0.2], [-4.6, 2.4], [4.6, -0.2], [4.6, 2.4]]) F.push(f(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 0.75, c), f(x - 1.05, z - 0.22, x - 0.65, z + 0.22, 0.9, ch), f(x + 0.65, z - 0.22, x + 1.05, z + 0.22, 0.9, ch)); };
  const staff = (shirt: string) => [npc(0, -3.9, 0, shirt, r)];
  const lights = (c: string, i = 10) => [L(-3.5, 3.3, -1, c, i, 10), L(3.5, 3.3, -1, c, i, 10), L(0, 3.3, 3, c, i * 0.8, 9)];
  switch (key) {
    case 'cafe':
      counter('#5a4030'); F.push(f(-2.4, -3.3, -1.4, -2.8, 0.5, '#c9ccd2', { y0: 1.05, metal: 0.8, rough: 0.2 }), f(0.5, -3.35, 2.6, -2.65, 0.4, '#ffe3b0', { y0: 1.05, glow: true }), f(-6.6, -4.6, -5.8, -3.8, 1.6, PLANT)); tables('#e8e0d0', '#5a4030');
      return base(W, D, H, '#efe4d4', '#b08a5e', 'wood', F, { lights: lights('#ffd9a8'), ownLights: true, npcs: staff('#5a4030') });
    case 'ramen':
      F.push(f(-5, -2.4, 5, -1.6, 1.0, '#8a6a4a'));
      for (let x = -4; x <= 4; x += 1.6) F.push(f(x - 0.22, -1.25, x + 0.22, -0.8, 0.7, '#3a2a20'));
      for (const x of [-3.2, -2.2, -1.2]) F.push(f(x - 0.4, -4.4, x + 0.4, -3.6, 1.2, '#9aa0a8', { metal: 0.8, rough: 0.3 }));
      for (const x of [-4.5, -1.5, 1.5, 4.5]) F.push(f(x - 0.25, -2.25, x + 0.25, -1.75, 0.5, '#ff3a2a', { y0: 2.5, glow: true, walk: true }));
      F.push(f(-6.6, 2, -5.2, 3.4, 0.75, '#6a4a30'), f(5.2, 2, 6.6, 3.4, 0.75, '#6a4a30'));
      return base(W, D, H, '#3a2a22', '#6a6460', 'concrete', F, { lights: lights('#ffcf9a', 9), ownLights: true, npcs: [npc(0, -3.6, 0, '#f4f4f4', r)] });
    case 'boutique': {
      const cl = ['#e84a5f', '#2a9d8f', '#264653', '#f4a261', '#e9c46a', '#6c5ce7', '#dfe6e9', '#2d3436', '#fd79a8'];
      for (const s of [-1, 1]) { F.push(f(s * 6.2 - 0.06, -3.5, s * 6.2 + 0.06, 2.6, 0.06, '#c0c4cc', { y0: 1.6, metal: 0.9, rough: 0.2, walk: true })); for (let z = -3.3; z < 2.4; z += 0.55) F.push(f(s * 6.2 - 0.3, z, s * 6.2 + 0.3, z + 0.38, 0.9, pickR(cl, r), { y0: 0.7 })); }
      for (const x of [-2.5, 0, 2.5]) F.push(f(x - 0.2, -4.2, x + 0.2, -3.8, 1.75, '#f2efe8'));
      F.push(f(-1.2, -0.8, 1.2, 0.8, 0.8, '#e8e2d6'), f(2.2, -2.6, 4.6, -1.8, 1.0, '#1a1a1e'), f(-6.95, -4.6, -6.9, -3.0, 2.0, '#c8d4e0', { metal: 1, rough: 0.03, y0: 0.1, walk: true }));
      return base(W, D, H, '#f4f1f6', '#ece9e4', 'marble', F, { lights: lights('#ffffff', 11), ownLights: true, npcs: [npc(3.4, -2.9, Math.PI, '#141414', r)] });
    }
    case 'electronics': {
      const sc = ['#2b6bff', '#ff3f93', '#3dffb0', '#ffd23a', '#2be4ff', '#b07aff'];
      for (let row = 0; row < 2; row++) for (let k = 0; k < 3; k++) { const z = -3.2 + k * 2.1; F.push(f(-6.95, z - 0.75, -6.88, z + 0.75, 0.8, pickR(sc, r), { y0: 1.0 + row * 1.0, glow: true, walk: true })); }
      F.push(f(-3, -1, -0.8, 0.6, 0.85, '#2a2c33'), f(0.8, -1, 3, 0.6, 0.85, '#2a2c33'), f(-2.6, -0.6, -1.2, 0.2, 0.08, '#9fd8ff', { y0: 0.85, glow: true }), f(1.2, -0.6, 2.6, 0.2, 0.08, '#ffb35a', { y0: 0.85, glow: true }), f(6.4, -4, 6.95, 3, 1.8, '#d0d4da'));
      counter('#e8e8ec');
      return base(W, D, H, '#e9edf2', '#d8dce2', 'tiles', F, { lights: lights('#f4f8ff', 12), ownLights: true, npcs: staff('#c0392b') });
    }
    case 'bar':
      F.push(f(-4.5, -2.6, 4.5, -1.8, 1.1, '#2a1a14', { rough: 0.2 }), f(-4.5, -1.82, 4.5, -1.76, 0.06, acc, { y0: 1.02, glow: true, walk: true }), f(-4, -4.97, 4, -4.7, 0.06, '#ffb35a', { y0: 1.3, glow: true, walk: true }), f(-4, -4.97, 4, -4.7, 0.06, '#ffb35a', { y0: 1.85, glow: true, walk: true }));
      for (let x = -3.6; x <= 3.6; x += 1.8) F.push(f(x - 0.22, -1.35, x + 0.22, -0.9, 0.75, '#141414'));
      F.push(f(-6.95, 1, -5.6, 3.6, 1.0, '#5a1a2a'), f(-5.5, 1.6, -4.3, 3.0, 0.75, '#2a1a14'), f(5.6, 1, 6.95, 3.6, 1.0, '#5a1a2a'), f(4.3, 1.6, 5.5, 3.0, 0.75, '#2a1a14'), f(-6.97, -2, -6.93, 0, 0.6, acc, { y0: 2.2, glow: true, walk: true }));
      return base(W, D, H, '#1c1820', '#3a3034', 'wood', F, { lights: lights('#c08aff', 6), ownLights: true, npcs: [npc(0, -3.6, 0, '#141414', r)] });
    case 'books': {
      const sp = ['#8a3a3a', '#3a5a8a', '#4a6a3a', '#8a6a3a', '#5a3a6a'];
      for (const [x0, z0, x1, z1] of [[-6.95, -4.9, -6.4, 3], [6.4, -4.9, 6.95, 3], [-6, -4.95, 6, -4.45]]) F.push(f(x0, z0, x1, z1, 2.2, '#7a5236'));
      for (const x of [-3.5, 3.5]) F.push(f(x - 0.35, -3, x + 0.35, 1.2, 1.7, pickR(sp, r)), f(x - 0.4, -3.05, x + 0.4, 1.25, 0.08, '#7a5236', { y0: 1.7 }));
      F.push(f(-1, -1.2, 1, 0.2, 0.75, '#8a6a4a'), f(3.4, 2.6, 5.6, 3.4, 1.0, '#6a4a30'));
      return base(W, D, H, '#efe6d8', '#b08a5e', 'wood', F, { lights: lights('#ffe2b8', 10), ownLights: true, npcs: [npc(4.5, 3.9, Math.PI, '#3a5a8a', r)] });
    }
    case 'pharmacy':
      for (const x of [-4.5, -1.5, 1.5, 4.5]) if (Math.abs(x) > 1) F.push(f(x - 0.4, -2.6, x + 0.4, 1.6, 1.7, '#f4f4f4'));
      F.push(f(-6.97, -1, -6.93, 1, 0.5, '#3dffb0', { y0: 2.2, glow: true, walk: true }), f(-6.97, -0.25, -6.93, 0.25, 2.0, '#3dffb0', { y0: 1.45, glow: true, walk: true }));
      counter('#e8eef0');
      return base(W, D, H, '#f6f8f8', '#e8ecee', 'tiles', F, { lights: lights('#f4fbff', 13), ownLights: true, npcs: staff('#ffffff') });
    case 'gym': default:
      for (const x of [-4.5, -2.5, -0.5, 1.5]) F.push(f(x - 0.4, -4.4, x + 0.4, -2.6, 1.2, '#1a1a1e'), f(x - 0.3, -2.75, x + 0.3, -2.7, 0.3, '#2be4ff', { y0: 1.2, glow: true }));
      F.push(f(6, -1, 6.9, 3, 0.9, '#3a3a3e'), f(6.95, -4, 6.98, 4, 2.4, '#c8d4e0', { metal: 1, rough: 0.03, y0: 0.2, walk: true }), f(-6.5, -1, -3.5, 3, 0.04, '#3a5a8a', { walk: true }), f(2.2, 0, 3.6, 0.5, 0.5, '#2a2a2e'), f(2.2, 2, 3.6, 2.5, 0.5, '#2a2a2e'));
      return base(W, D, H, '#2a2c33', '#3a3c42', 'concrete', F, { lights: lights('#f4f8ff', 12), ownLights: true, npcs: [npc(4.5, 1.2, -Math.PI / 2, '#ff3f93', r)] });
  }
}
