import type { InteriorDef, Furn } from './Interiors';
import { CRUISE } from './cityGen';

/** Cruise liner rooms (linked to each other by doorways) and the superyacht's saloon. */
const f = (x0: number, z0: number, x1: number, z1: number, h: number, c: string, o: Partial<Furn> = {}): Furn => ({ x0, z0, x1, z1, h, c, ...o });
const L = (x: number, y: number, z: number, c = '#fff1dc', i = 14, d = 16) => ({ x, y, z, c, i, d });
const PLANT = '#2f6a3a', GOLD = '#c9a24a', RED = '#8a1424', CREAM = '#efe6d2', WOOD = '#5a3a24';
const room = (id: string, name: string, ox: number, w: number, d: number, h: number, wall: string, floorTex: InteriorDef['floorTex'], furniture: Furn[], extra: Partial<InteriorDef>): InteriorDef => ({
  id, name, ox, oz: 0, w, d, h, wall, floor: '#ece9e4', floorTex, furniture, exit: { x: 0, z: d / 2 - 1.0 }, spawn: { x: 0, z: d / 2 - 2.2, yaw: Math.PI }, ownLights: true, ...extra,
});

/* ---------------- grand atrium: three-storey balconies, grand staircase, chandelier, boutiques, piano */
const atriumF: Furn[] = [
  ...[-1, 1].flatMap((s) => [f(s * 15 - 1.2, -11, s * 15 + 1.2, 6, 0.25, CREAM, { y0: 4.6 }), f(s * 15 - 1.2, -11, s * 15 + 1.2, 6, 0.25, CREAM, { y0: 9.2 }), f(s * 13.75 - 0.05, -11, s * 13.75 + 0.05, 6, 1.0, GOLD, { y0: 4.85, metal: 0.9, rough: 0.2, walk: true }), f(s * 13.75 - 0.05, -11, s * 13.75 + 0.05, 6, 1.0, GOLD, { y0: 9.45, metal: 0.9, rough: 0.2, walk: true })]),
  ...Array.from({ length: 9 }, (_, k) => f(-3.2, -10.6 + k * 0.6, 3.2, -10.0 + k * 0.6, 0.5 * (9 - k), RED)), // grand staircase rising to the back
  f(-3.6, -11.98, 3.6, -11.9, 12, '#3a2a1a', { walk: true }), f(-3.4, -11.95, 3.4, -11.88, 0.2, GOLD, { y0: 11.5, glow: true, walk: true }),
  ...[0, 1, 2].map((k) => f(-1.6 + k * 0.1, -2.2 + k * 0.1, 1.6 - k * 0.1, 0.2 - k * 0.1, 0.35, '#fff3d0', { y0: 9.5 - k * 1.1, glow: true, walk: true })), // chandelier tiers
  f(-0.05, -1.05, 0.05, -0.95, 2.6, GOLD, { y0: 10.0, metal: 0.9, walk: true }),
  f(-1.3, -1.3, 1.3, -0.9, 0.04, GOLD, { glow: true, walk: true }), f(-1.0, -1.0, 1.0, 1.0, 0.45, '#e8e2d6', { rough: 0.2 }), // fountain
  f(6.5, -6, 8.8, -4.6, 1.0, '#0b0b0d', { rough: 0.1 }), f(6.3, -4.6, 7.2, -4.0, 0.5, '#0b0b0d'), // grand piano + bench
  ...[-12, -8].map((z) => f(-15.9, z, -15.2, z + 3, 3.2, '#202026')), ...[-12, -8].map((z) => f(-15.97, z + 0.3, -15.92, z + 2.7, 0.5, '#ff9ad5', { y0: 2.7, glow: true, walk: true })), // boutiques (west)
  ...[-12, -8].map((z) => f(15.2, z, 15.9, z + 3, 3.2, '#202026')), ...[-12, -8].map((z) => f(15.92, z + 0.3, 15.97, z + 2.7, 0.5, '#7ab8ff', { y0: 2.7, glow: true, walk: true })),
  f(-9, 3, -5, 4, 0.75, '#5a2030'), f(5, 3, 9, 4, 0.75, '#5a2030'), f(-7.5, 1.4, -6.5, 2.4, 0.45, GOLD, { metal: 0.8 }), f(6.5, 1.4, 7.5, 2.4, 0.45, GOLD, { metal: 0.8 }),
  f(-15.5, 9, -14.5, 10, 2.4, PLANT), f(14.5, 9, 15.5, 10, 2.4, PLANT), f(-4.5, -11.5, -3.7, -10.7, 2.2, PLANT), f(3.7, -11.5, 4.5, -10.7, 2.2, PLANT),
  f(-2.5, 6.6, 2.5, 7.4, 1.1, WOOD), f(-2.4, 7.38, 2.4, 7.42, 0.1, GOLD, { y0: 0.95, glow: true, walk: true }), // purser's desk
];
export const SHIP_ATRIUM = room('ship_atrium', 'NEON BAY PRINCESS グランドアトリウム', -4600, 32, 24, 13, '#f4efe6', 'marble', atriumF, {
  lights: [L(-8, 12, -4, '#ffe6c4', 22, 26), L(8, 12, -4, '#ffe6c4', 22, 26), L(0, 9, 0, '#fff1dc', 18, 20), L(0, 12, 8, '#ffe6c4', 16, 20)],
  npcs: [{ x: 0, z: 6.2, yaw: Math.PI, look: { skin: '#e0ac69', shirt: '#1d2c4d', pants: '#1d2c4d', shoe: '#141414', hair: '#1a1012' } }, { x: 6.6, z: -4.3, yaw: 0.6, look: { skin: '#f1c27d', shirt: '#141414', pants: '#141414', shoe: '#141414', hair: '#d4b06a' } }],
  roofSpot: { x: 12, z: 8 }, roof: { x: (CRUISE.x0 + CRUISE.x1) / 2 - 10, z: (CRUISE.z0 + CRUISE.z1) / 2, y: CRUISE.sun }, roofLabel: 'エレベーターでサンデッキへ',
  links: [{ x: -13.5, z: 0, to: 'ship_theater', label: 'シアターへ' }, { x: 13.5, z: 0, to: 'ship_suite', label: 'ロイヤルスイートへ' }, { x: -12, z: 8, to: 'ship_dining', label: 'メインダイニングへ' }],
});

/* ---------------- theater: raked seating, stage with curtains and footlights */
const theaterF: Furn[] = [f(-11, -10.9, 11, -6, 1.1, '#2a1a14'), f(-11, -11, 11, -10.9, 7, RED, { walk: true }), f(-11, -6.1, -8, -5.9, 7, RED), f(8, -6.1, 11, -5.9, 7, RED), f(-10, -6.02, 10, -5.96, 0.08, '#ffd27a', { y0: 1.12, glow: true, walk: true })];
for (let r = 0; r < 7; r++) for (const [x0, x1] of [[-11.5, -1.6], [1.6, 11.5]]) theaterF.push(f(x0, -3.5 + r * 1.6, x1, -2.9 + r * 1.6, 0.5 + r * 0.25, RED, { y0: r * 0.25 }), f(x0, -2.95 + r * 1.6, x1, -2.85 + r * 1.6, 1.0, '#5a1018', { y0: r * 0.25 }));
theaterF.push(f(-9, -10.95, 9, -10.92, 4.5, '#1a1a2a', { y0: 1.6, walk: true }), f(-4, -10.97, 4, -10.94, 0.2, '#ff3f93', { y0: 6.0, glow: true, walk: true }));
export const SHIP_THEATER = room('ship_theater', 'ロイヤルシアター', -4680, 26, 24, 9, '#2a1420', 'wood', theaterF, {
  lights: [L(0, 8.5, -8, '#ffb0d0', 18, 16), L(-8, 8.5, 4, '#c08aff', 8, 14), L(8, 8.5, 4, '#c08aff', 8, 14)],
  npcs: [{ x: -2, z: -8.5, yaw: 0, look: { skin: '#c68642', shirt: '#ff3f93', pants: '#141414', shoe: '#141414', hair: '#141012' } }, { x: 2.5, z: -8.5, yaw: -0.3, look: { skin: '#ffdbac', shirt: '#2be4ff', pants: '#f4f4f4', shoe: '#f4f4f4', hair: '#8b5a2b' } }],
  links: [{ x: 0, z: 9, to: 'ship_atrium', label: 'アトリウムへ戻る' }],
});

/* ---------------- main dining: round tables, crystal chandeliers, wine wall, sea view */
const diningF: Furn[] = [];
for (const [x, z] of [[-8, -5], [-3, -5], [3, -5], [8, -5], [-8, 0.5], [-3, 0.5], [3, 0.5], [8, 0.5]]) diningF.push(f(x - 1.1, z - 1.1, x + 1.1, z + 1.1, 0.76, '#f8f6f0'), f(x - 0.15, z - 0.15, x + 0.15, z + 0.15, 0.35, '#e8f4ff', { y0: 0.76, glow: true }), f(x - 1.7, z - 0.25, x - 1.25, z + 0.25, 0.95, RED), f(x + 1.25, z - 0.25, x + 1.7, z + 0.25, 0.95, RED), f(x - 0.25, z - 1.7, x + 0.25, z - 1.25, 0.95, RED), f(x - 0.25, z + 1.25, x + 0.25, z + 1.7, 0.95, RED));
for (const x of [-5.5, 5.5]) diningF.push(f(x - 1.2, -2.6, x + 1.2, -1.6, 0.4, '#fff3d0', { y0: 4.3, glow: true, walk: true }));
diningF.push(f(-13.95, -6, -13.4, 4, 3.2, WOOD), f(-13.97, -5.5, -13.93, 3.5, 0.06, '#ffb35a', { y0: 1.4, glow: true, walk: true }), f(-13.97, -5.5, -13.93, 3.5, 0.06, '#ffb35a', { y0: 2.3, glow: true, walk: true }));
export const SHIP_DINING = room('ship_dining', 'メインダイニング「Azure」', -4740, 28, 20, 5, '#efe4d4', 'wood', diningF, {
  views: [{ wall: 'n', a0: -13, a1: 13, y0: 0.6, y1: 4.6, style: 'sea' }, { wall: 'e', a0: -9, a1: 4, y0: 0.6, y1: 4.6, style: 'sea' }],
  lights: [L(-6, 4.6, -2, '#ffe2b8', 12, 14), L(6, 4.6, -2, '#ffe2b8', 12, 14), L(0, 4.6, 6, '#ffe2b8', 10, 12)],
  npcs: [{ x: -12.6, z: 0, yaw: Math.PI / 2, look: { skin: '#e0ac69', shirt: '#f4f4f4', pants: '#141414', shoe: '#141414', hair: '#1a1012' } }],
  links: [{ x: 12, z: 7.5, to: 'ship_atrium', label: 'アトリウムへ戻る' }],
});

/* ---------------- royal suite: king bed, lounge, bathtub, private balcony glass */
export const SHIP_SUITE = room('ship_suite', 'ロイヤルスイート', -4800, 20, 14, 3.4, '#ece6dc', 'wood', [
  f(-9.6, -6.6, -6.2, -3.2, 0.6, '#f8f6f2'), f(-9.95, -6.6, -9.7, -3.2, 1.5, WOOD), f(-6.2, -6.5, -5.4, -5.7, 0.55, WOOD), f(-6.2, -4.1, -5.4, -3.3, 0.55, WOOD),
  f(-9.6, -6.55, -6.3, -3.25, 0.06, GOLD, { y0: 0.6, walk: true }),
  f(1, -1, 5, 0, 0.75, CREAM), f(4.9, -1, 5.8, 3, 0.75, CREAM), f(2.2, 0.6, 3.8, 1.8, 0.4, '#8890a0', { metal: 0.9, rough: 0.05 }),
  f(7.6, -6.6, 9.9, -4.4, 0.6, '#f4f4f4', { rough: 0.1 }), f(7.8, -6.4, 9.7, -4.6, 0.04, '#7ad8ff', { y0: 0.56, glow: true, walk: true }), // bathtub
  f(-1.2, -6.95, 1.2, -6.6, 1.8, WOOD), f(-1.0, -6.62, 1.0, -6.58, 1.0, '#1b2c50', { y0: 1.0, glow: true, walk: true }),
  f(-9.6, 4.6, -8.8, 5.4, 1.8, PLANT), f(8.8, 4.6, 9.6, 5.4, 1.4, PLANT), f(-1.5, 2.5, 1.5, 4.5, 0.02, '#b8a48a', { walk: true }),
], {
  views: [{ wall: 'n', a0: 2, a1: 9.8, y0: 0.1, y1: 3.3, style: 'sea' }, { wall: 'e', a0: -6.8, a1: 2.5, y0: 0.1, y1: 3.3, style: 'sea' }],
  lights: [L(-6, 3.1, -3, '#ffe2b8', 7, 10), L(4, 3.1, 0, '#ffe2b8', 7, 10), L(8, 3.1, -5, '#fff1dc', 5, 6)], noSign: true,
  links: [{ x: -8.8, z: 6.2, to: 'ship_atrium', label: 'アトリウムへ戻る' }], bed: { x: -7.9, z: -2.6 },
});

/* ---------------- superyacht saloon: lounge, bar, dining, helm stairs, wraparound windows */
export const YACHT_CABIN = room('yacht', 'Orca 88 メインサロン', -4860, 16, 8, 2.6, '#f2ece2', 'wood', [
  f(-7.6, -3.6, -3.4, -2.8, 0.7, CREAM), f(-7.6, -2.8, -6.8, 1.0, 0.7, CREAM), f(-5.8, -1.8, -4.2, -0.6, 0.4, WOOD, { rough: 0.2 }), f(-6.2, -2.2, -3.8, 0.4, 0.02, '#b8a48a', { walk: true }),
  f(-1.2, -3.9, 2.0, -3.3, 1.05, '#1a1a1e', { rough: 0.15 }), f(-1.2, -3.32, 2.0, -3.28, 0.05, '#7ab8ff', { y0: 0.98, glow: true, walk: true }), f(-1.0, -3.95, 1.8, -3.9, 0.06, '#ffb35a', { y0: 1.6, glow: true, walk: true }),
  ...[-0.4, 0.6, 1.6].map((x) => f(x - 0.18, -2.9, x + 0.18, -2.55, 0.75, '#141414')),
  f(3.2, -1.2, 5.6, 0.4, 0.76, WOOD, { rough: 0.2 }), ...[3.6, 5.2].flatMap((x) => [f(x - 0.22, -1.8, x + 0.22, -1.4, 0.9, CREAM), f(x - 0.22, 0.6, x + 0.22, 1.0, 0.9, CREAM)]),
  f(6.6, -3.9, 7.9, -1.6, 2.6, WOOD), f(7.6, 2.8, 7.95, 3.9, 1.0, '#1b2c50', { y0: 0.7, glow: true, walk: true }),
  f(-7.9, 2.9, -7.2, 3.6, 1.2, PLANT),
], {
  views: [{ wall: 'n', a0: -7.8, a1: 6.4, y0: 0.7, y1: 2.2, style: 'sea' }, { wall: 'w', a0: -3.4, a1: 2.6, y0: 0.7, y1: 2.2, style: 'sea' }, { wall: 'e', a0: -1.4, a1: 2.6, y0: 0.7, y1: 2.2, style: 'sea' }],
  lights: [L(-4, 2.4, -1, '#ffe2b8', 7, 9), L(3, 2.4, -1, '#ffe2b8', 7, 9)], noSign: true, ceil: '#f6f1e8',
  npcs: [{ x: 0.4, z: -3.6, yaw: 0, look: { skin: '#e0ac69', shirt: '#f4f4f4', pants: '#141414', shoe: '#141414', hair: '#1a1012' } }],
});

export const SHIP_DEFS = [SHIP_ATRIUM, SHIP_THEATER, SHIP_DINING, SHIP_SUITE, YACHT_CABIN];
