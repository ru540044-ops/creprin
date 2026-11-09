import type { InteriorDef, Furn } from './Interiors';

/** Box helper: x0,z0,x1,z1 footprint, height, colour, options (y0 = lift off the floor, walk = no collision). */
const b = (x0: number, z0: number, x1: number, z1: number, h: number, c: string, o: Partial<Furn> = {}): Furn => ({ x0, z0, x1, z1, h, c, ...o });
const chairs = (cx: number, cz: number, n: number, sx: number, c: string): Furn[] => Array.from({ length: n }, (_, k) => { const x = cx + (k % (n / 2) - (n / 2 - 1) / 2) * sx, z = cz + (k < n / 2 ? -1 : 1) * 0.95; return b(x - 0.22, z - 0.22, x + 0.22, z + 0.22, 0.9, c); });
const home = (id: string, name: string, ox: number, w: number, d: number, h: number, wall: string, floor: string, floorTex: InteriorDef['floorTex'], furniture: Furn[], extra: Partial<InteriorDef>): InteriorDef => ({
  id, name, ox, oz: 0, w, d, h, wall, floor, furniture, floorTex, home: true,
  exit: { x: 0, z: d / 2 - 1.0 }, spawn: { x: 0, z: d / 2 - 2.2, yaw: Math.PI }, ...extra,
});

/* ------------------------------------------------------------------ 潮見団地 402号室 (cramped, worn) */
const danchi = home('danchi', '潮見団地 3号棟 402号室', -3400, 10, 9, 2.45, '#d6ccb4', '#cbbf98', 'tatami', [
  b(-1.1, 3.55, 1.1, 4.5, 0.02, '#8d8a84', { walk: true }), // genkan
  b(-5, -0.56, -1.05, -0.44, 2.45, '#e2dac6'), b(1.15, -0.56, 5, -0.44, 2.45, '#e2dac6'), // partition with fusuma opening
  b(-5, 0, -4.4, 3.0, 0.85, '#c9c3b6'), b(-4.98, 0.4, -4.42, 1.4, 0.03, '#2a2a2a', { y0: 0.85 }), b(-5, 0, -4.7, 3.0, 0.6, '#bfb7a6', { y0: 1.55 }), // sink, burner, cupboard
  b(-5, 3.15, -4.3, 3.85, 1.6, '#e8e5da', { rough: 0.4 }), // old fridge
  b(0.6, 1.2, 1.9, 2.0, 0.7, '#8a6a4a'), b(0.65, 2.15, 1.05, 2.55, 0.45, '#5a4a3a'), b(1.4, 2.15, 1.8, 2.55, 0.45, '#5a4a3a'),
  b(3.8, 3.2, 4.5, 3.95, 0.85, '#f2f2ee', { rough: 0.35 }), // washing machine
  b(-0.65, -2.85, 0.65, -1.75, 0.34, '#6a4a30'), // chabudai
  b(1.8, -4.35, 4.7, -2.35, 0.12, '#e6e1f2', { walk: true }), b(4.05, -4.2, 4.6, -3.4, 0.16, '#ffffff', { walk: true }), // futon + pillow
  b(-5, -3.45, -4.05, -2.15, 0.42, '#5a4030'), b(-4.95, -3.25, -4.25, -2.35, 0.55, '#2a2a2c', { y0: 0.42 }), b(-4.25, -3.15, -4.2, -2.45, 0.42, '#9fc8ff', { y0: 0.48, glow: true }), // CRT tv
  b(-3.9, -4.5, -3.5, -4.35, 1.4, '#7a5a8a', { y0: 0.75 }), b(3.5, -4.5, 3.9, -4.35, 1.4, '#7a5a8a', { y0: 0.75 }), // curtains
  b(-2.6, -0.4, -2.0, -0.2, 1.8, '#9aa0a8', { walk: true, y0: 0.4 }), // hanging laundry
], { views: [{ wall: 'n', a0: -3.4, a1: 3.4, y0: 0.85, y1: 2.05, style: 'danchi' }], lights: [{ x: 0, y: 2.3, z: 1.5, c: '#e6f2ff', i: 9, d: 9 }, { x: 0, y: 2.3, z: -2.5, c: '#e6f2ff', i: 8, d: 9 }], flicker: true, ceil: '#e8e2d0', bed: { x: 3.2, z: -2.0 }, buy: { x: 0, z: 2.6 } });

/* ------------------------------------------------------------------ 一軒家 (family house) */
const house = home('house', '世田谷の一軒家', -3500, 14, 12, 2.8, '#efe6d8', '#b08a5e', 'wood', [
  b(-6.9, 0, -6.4, 2, 0.5, '#3a2a20'), b(-6.62, 0.15, -6.52, 1.85, 1.0, '#2a4f8a', { y0: 0.8, glow: true }), // tv
  b(-6, -0.5, -3, 2.6, 0.02, '#b8a48a', { walk: true }), b(-5.4, 0.6, -4.2, 1.6, 0.4, '#7a5236'), // rug, coffee table
  b(-3.2, -0.5, -2.4, 2.5, 0.75, '#4a5a6a'), b(-2.4, -0.5, -2.1, 2.5, 1.0, '#45535f'), // sofa
  b(2.2, 1.5, 4.6, 2.7, 0.75, '#8a6a4a'), ...chairs(3.4, 2.1, 4, 1.0, '#6a4a30'), // dining
  b(1, -5.95, 6.8, -5.3, 0.9, '#f2efe8'), b(1, -6, 6.8, -5.65, 0.7, '#d8cfbf', { y0: 1.6 }), b(2.4, -3.6, 5.4, -2.8, 0.9, '#e8e2d6', { rough: 0.3 }), // kitchen
  b(6.2, -5.0, 6.95, -4.2, 1.85, '#c9ccd2', { metal: 0.7, rough: 0.25 }), // fridge
  b(-7, -1.56, -2.5, -1.44, 2.8, '#e8ddcc'), b(-2.56, -6, -2.44, -3.0, 2.8, '#e8ddcc'), // bedroom walls
  b(-6.8, -5.8, -4.6, -3.4, 0.55, '#f4f1ea'), b(-6.98, -5.8, -6.8, -3.4, 1.1, '#5a4030'), b(-4.5, -5.8, -4.0, -5.2, 0.55, '#7a5236'), b(-3.4, -5.95, -2.62, -5.3, 2.0, '#8a6a4a'),
  b(5.6, 0.5, 6.95, 1.5, 0.25, '#9a7a56'), b(5.6, 1.5, 6.95, 2.5, 0.5, '#9a7a56'), b(5.6, 2.5, 6.95, 3.5, 0.75, '#9a7a56'), b(5.6, 3.5, 6.95, 4.5, 1.0, '#9a7a56'), // stairs
  b(-6.8, 4.6, -6.2, 5.2, 1.2, '#3d7a3a'), b(6.2, 5.0, 6.8, 5.6, 1.1, '#3d7a3a'), // plants
], { views: [{ wall: 'e', a0: -1.2, a1: 0.2, y0: 0.9, y1: 2.2, style: 'suburb' }, { wall: 'n', a0: -6.5, a1: -3.0, y0: 1.0, y1: 2.2, style: 'suburb' }], lights: [{ x: -3.5, y: 2.6, z: 1, c: '#ffe2b8', i: 12, d: 12 }, { x: 3.5, y: 2.6, z: -2, c: '#ffe2b8', i: 12, d: 12 }, { x: -4.5, y: 2.6, z: -4.5, c: '#ffd6a0', i: 6, d: 7 }], ceil: '#f6f1e8', bed: { x: -5.7, z: -3.0 }, buy: { x: 0, z: 3.8 } });

/* ------------------------------------------------------------------ タワーマンション 最上階 (penthouse) */
const mullions: Furn[] = Array.from({ length: 9 }, (_, k) => b(-11.85 + k * 2.95, -7.98, -11.75 + k * 2.95, -7.88, 3.4, '#1c1d22', { walk: true }));
const tower = home('tower', 'ベイタワー 58階ペントハウス', -3600, 24, 16, 3.4, '#d9d6d0', '#ece9e4', 'marble', [
  ...mullions,
  b(-7, -4, 1, 1, 0.02, '#34343c', { walk: true }), // rug
  b(-6, -3, 0, -2.1, 0.7, '#26262c'), b(-6, -2.1, -5.1, 0.6, 0.7, '#26262c'), b(-6, -3.25, 0, -3.0, 1.0, '#202026'), // sectional sofa
  b(-4.2, -1.6, -2, -0.6, 0.4, '#8890a0', { metal: 0.9, rough: 0.05 }), // glass coffee table
  b(-11.9, -3.5, -11.3, 1.5, 0.45, '#16161a'), b(-11.95, -3, -11.85, 1, 1.6, '#1b2c50', { y0: 1.0, glow: true }), // huge tv
  b(-11.98, -6, -11.94, 6, 0.06, '#ffd6a0', { y0: 3.3, glow: true, walk: true }), // led strip
  b(3, 1.5, 7, 2.6, 0.95, '#f2efea', { rough: 0.12 }), ...[3.6, 5, 6.4].map((x) => b(x - 0.2, 2.9, x + 0.2, 3.3, 0.8, '#1a1a1e')), // marble island + stools
  b(5, 7.3, 11.8, 7.95, 0.95, '#22242a', { rough: 0.2 }), b(5, 7.6, 11.8, 7.95, 0.8, '#2a2c33', { y0: 1.7 }),
  b(6, -2, 9.5, -0.5, 0.76, '#a8b0c0', { metal: 0.9, rough: 0.05 }), ...chairs(7.75, -1.25, 6, 1.2, '#f0eee8'), // glass dining
  b(8.5, -6.5, 10.5, -4.8, 1.0, '#0b0b0d', { rough: 0.12 }), // grand piano
  b(-12, 2.94, -6, 3.06, 3.4, '#e1ded8'), b(-6.06, 3, -5.94, 5.4, 3.4, '#e1ded8'), // bedroom walls
  b(-11.6, 4.0, -9.0, 7.2, 0.5, '#f2f2f4'), b(-11.95, 4.0, -11.7, 7.2, 1.3, '#2a2a30'), // king bed
  b(10.8, 1, 11.95, 4, 1.6, '#3a2a20', { y0: 0.9 }), b(10.75, 1.2, 10.8, 3.8, 0.04, '#ffb35a', { y0: 1.5, glow: true, walk: true }), // bar shelf
  b(-1.2, 6.8, -0.6, 7.4, 2.0, '#2f6a3a'), b(10.6, -7.6, 11.4, -6.8, 2.2, '#2f6a3a'), // plants
  b(-8.5, 7.9, -7.0, 7.96, 1.2, '#c86a3a', { y0: 1.2, walk: true }), // art
], { views: [{ wall: 'n', a0: -11.9, a1: 11.9, y0: 0.05, y1: 3.35, style: 'city-high' }, { wall: 'e', a0: -7.9, a1: 0.8, y0: 0.05, y1: 3.35, style: 'city-high' }], lights: [{ x: -4, y: 3.1, z: -1, c: '#ffe6c4', i: 6, d: 14 }, { x: 6, y: 3.1, z: 1, c: '#ffe6c4', i: 6, d: 14 }, { x: -9, y: 3.1, z: 5.5, c: '#ffd6a0', i: 6, d: 9 }], ceil: '#f3f1ed', bed: { x: -10.3, z: 3.6 }, buy: { x: 0, z: 5.8 } });

/* ------------------------------------------------------------------ モダン豪邸 (beach villa) */
const villa = home('villa', 'お台場・モダンヴィラ', -3750, 28, 20, 4.2, '#f4f2ee', '#d8c3a0', 'wood', [
  b(-12, -9.6, 2, -6.6, 0.2, '#2bc4ff', { glow: true }), b(-12.3, -9.9, 2.3, -6.3, 0.18, '#e8e4dc'), // indoor infinity pool + coping
  b(4, -4, 12, -3, 0.7, '#f4f1ea'), b(11, -4, 12, 1, 0.7, '#f4f1ea'), b(4, -4.3, 12.3, -4.0, 1.05, '#ece8e0'), // white sofa
  b(3.5, -2.5, 12.5, 1.8, 0.02, '#cfc6b8', { walk: true }), b(6.5, -1.8, 9.5, -0.6, 0.35, '#6b6a66', { rough: 0.3 }), // rug, stone table
  b(13.6, -2, 14, 2, 2.4, '#3a3a3a'), b(13.5, -1.2, 13.6, 1.2, 0.5, '#ff7a22', { y0: 0.3, glow: true }), // fireplace
  b(-6, 1, 2, 2.4, 0.95, '#1a1a1c', { rough: 0.15 }), ...[-4.5, -2.5, -0.5].map((x) => b(x - 0.22, 2.7, x + 0.22, 3.1, 0.8, '#c9a24a', { metal: 0.8, rough: 0.3 })), // black marble island
  b(-13.9, 9.3, -8, 9.95, 0.95, '#e8e4dc'), b(-13.9, 9.6, -8, 9.95, 0.9, '#d8d2c6', { y0: 1.8 }),
  b(-12, -3, -7.5, -1.5, 0.76, '#6a4a30'), ...chairs(-9.75, -2.25, 6, 1.4, '#e8e4dc'), // dining
  b(2.5, 5, 3.1, 5.6, 2.2, '#c9a24a', { metal: 0.9, rough: 0.2 }), // sculpture
  b(5.94, 5, 6.06, 10, 4.2, '#e9e5de'), b(9, 6, 12.5, 9.6, 0.55, '#f4f4f4'), b(9, 9.6, 12.5, 9.9, 1.4, '#8a7a6a'), // master suite
  b(-13.98, -8, -13.94, 8, 0.06, '#ffe0b0', { y0: 4.0, glow: true, walk: true }), b(13.94, -8, 13.98, 8, 0.06, '#ffe0b0', { y0: 4.0, glow: true, walk: true }),
  b(-1.5, 7.5, -0.5, 8.5, 2.4, '#2f6a3a'), b(12.6, -9.4, 13.6, -8.4, 2.6, '#2f6a3a'), // palms in pots
], { views: [{ wall: 'n', a0: -13.9, a1: 13.9, y0: 0.05, y1: 4.15, style: 'sea' }, { wall: 'w', a0: -9.9, a1: 4.0, y0: 0.05, y1: 4.15, style: 'sea' }], lights: [{ x: -5, y: 3.8, z: -4, c: '#fff0d8', i: 14, d: 18 }, { x: 8, y: 3.8, z: -1, c: '#ffe6c4', i: 12, d: 16 }, { x: -6, y: 3.8, z: 5, c: '#ffe6c4', i: 10, d: 14 }, { x: 10.5, y: 3.8, z: 7.5, c: '#ffd6a0', i: 6, d: 9 }], ceil: '#ffffff', bed: { x: 10.7, z: 5.4 }, buy: { x: 0, z: 7.6 } });

export const HOME_DEFS: InteriorDef[] = [danchi, house, tower, villa];
export interface Property { id: string; name: string; kind: string; price: number; blurb: string }
export const PROPERTIES: Property[] = [
  { id: 'danchi', name: danchi.name, kind: '団地', price: 15000, blurb: '6畳一間＋台所。古いけど住めば都。' },
  { id: 'house', name: house.name, kind: '一軒家', price: 90000, blurb: 'リビング・寝室・キッチン付きの戸建て。' },
  { id: 'tower', name: tower.name, kind: 'タワーマンション', price: 480000, blurb: '58階から街を一望する全面ガラスのペントハウス。' },
  { id: 'villa', name: villa.name, kind: 'モダン豪邸', price: 1500000, blurb: '海が見える屋内プール付きのガラスの邸宅。' },
];
