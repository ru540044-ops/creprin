import type { Furn, Act } from './Interiors';

/**
 * Furniture of the shops you can use (all brands are made up):
 *  - the convenience store: drinks coolers along the back wall, an open chilled case, three gondola aisles, the magazine
 *    rack under the window, the counter with the till, the hot-snack case and the coffee machine, cigarettes behind it,
 *    an ATM and a copier,
 *  - the ramen shop: a ticket machine by the door, a row of one-person booths with partitions and a blind over the
 *    serving slot, a lamp over each free seat, the vacancy board by the entrance.
 * The till, the clerk and the hold-up spot of the convenience store stay where the robbery code expects them.
 */
const f = (x0: number, z0: number, x1: number, z1: number, h: number, c: string, o: Partial<Furn> = {}): Furn => ({ x0, z0, x1, z1, h, c, ...o });

/** Room size shared by every convenience store. */
export const KONBINI = { w: 16, d: 12, h: 4.2 };
/** The four made-up chains: name, sign colour, second colour. */
export const KONBINI_BRANDS: [string, string, string][] = [['QWIK 24', '#3dffb0', '#12324a'], ['NEON MART', '#ff3f93', '#ffffff'], ['BAY 24', '#ffd23a', '#1a1a1a'], ['よるマート', '#8a5cff', '#ffe066']];
export function konbiniFurn(a: string, b: string): Furn[] {
  const F: Furn[] = [];
  // brand band round the back wall, over the coolers
  F.push(f(-8, -5.99, 8, -5.93, 0.42, a, { y0: 2.55, glow: true, walk: true }), f(-8, -5.99, 8, -5.92, 0.08, b, { y0: 2.42, glow: true, walk: true }));
  // back wall: drinks coolers behind glass doors, then the chilled desserts
  F.push(f(-7.6, -5.9, 4.3, -5.25, 2.25, '#20262e', { tex: 'drinks' }), f(4.5, -5.9, 7.7, -5.2, 1.5, '#e9edf0', { tex: 'chilled' }));
  // left wall: the open chilled case (rice balls, sandwiches, lunch boxes)
  F.push(f(-7.95, -4.9, -7.25, 2.4, 1.9, '#e9edf0', { tex: 'chilled' }));
  // three gondola aisles with end caps
  for (const x of [-4.6, -1.7, 1.2]) F.push(f(x - 0.42, -3.4, x + 0.42, 1.4, 1.45, '#dfe3e8', { tex: 'goods' }), f(x - 0.46, -3.44, x + 0.46, 1.44, 0.05, '#f4f5f7', { y0: 1.45 }), f(x - 0.42, 1.5, x + 0.42, 1.92, 1.15, '#dfe3e8', { tex: 'goods' }));
  // magazine rack under the front window, left of the door
  F.push(f(-7.6, 5.35, -2.2, 5.85, 1.25, '#3a3f48', { tex: 'mags' }));
  // ice-cream chest by the entrance
  F.push(f(-1.9, 2.6, -0.6, 3.5, 0.9, '#eef2f5'), f(-1.84, 2.66, -0.66, 3.44, 0.04, '#bfe6ff', { y0: 0.9, glow: true }));
  // the counter: till with its display, hot-snack case, coffee machine; cigarettes on the wall behind
  F.push(f(3, 3, 7, 4, 1.05, '#f1f2f4'), f(3, 2.96, 7, 3.0, 0.45, a, { y0: 0.3, glow: true, walk: true }));
  F.push(f(4.75, 3.25, 5.25, 3.75, 0.32, '#2a2d33', { y0: 1.05 }), f(4.8, 3.22, 5.2, 3.25, 0.2, '#9fe8ff', { y0: 1.13, glow: true, walk: true }));
  F.push(f(3.15, 3.15, 4.15, 3.85, 0.55, '#ffd9a0', { y0: 1.05, glow: true }), f(3.1, 3.1, 4.2, 3.9, 0.06, '#c9ccd2', { y0: 1.6, metal: 0.8, rough: 0.3 }));
  F.push(f(6.2, 3.2, 6.85, 3.8, 0.7, '#1f2126', { y0: 1.05 }), f(6.3, 3.17, 6.75, 3.2, 0.2, '#ff8a3a', { y0: 1.4, glow: true, walk: true }));
  F.push(f(3.2, 5.62, 7.4, 5.96, 1.4, '#30343c', { y0: 1.1, tex: 'cigs', walk: true }));
  // ATM and the copier on the right wall, bins by the door
  F.push(f(7.25, -0.9, 7.95, 0.1, 1.7, '#2b3f7a'), f(7.21, -0.7, 7.25, -0.1, 0.4, '#9fd8ff', { y0: 1.05, glow: true, walk: true }));
  F.push(f(7.1, -2.6, 7.95, -1.4, 1.1, '#dfe2e6'), f(7.1, -2.5, 7.9, -1.5, 0.05, '#2a2d33', { y0: 1.1 }));
  F.push(f(1.3, 5.3, 2.5, 5.85, 0.95, '#c9ccd2'));
  // rows of bright ceiling panels
  for (const x of [-5.2, 0, 5.2]) for (const z of [-3.6, 0, 3.6]) F.push(f(x - 1.3, z - 0.3, x + 1.3, z + 0.3, 0.05, '#ffffff', { y0: KONBINI.h - 0.07, glow: true, walk: true }));
  return F;
}
export const konbiniLights = () => [{ x: -4.5, y: 3.9, z: -2, c: '#f6fbff', i: 15, d: 16 }, { x: 4.5, y: 3.9, z: -2, c: '#f6fbff', i: 15, d: 16 }, { x: 0, y: 3.9, z: 3.2, c: '#f6fbff', i: 14, d: 15 }];

/** The ramen shop: 14 x 10 m. Seats are the x positions of the booths. */
export const RAMEN = { w: 14, d: 10, h: 3.6, seats: [-4.2, -3.0, -1.8, -0.6, 0.6, 1.8, 3.0, 4.2] };
export function ramenFurn(): { F: Furn[]; acts: Act[] } {
  const F: Furn[] = [], WOOD = '#6b4a30', DARK = '#2a1c14', S = RAMEN.seats;
  // the kitchen wall behind the booths, open in a slot at counter height
  F.push(f(-5.4, -2.78, 5.4, -2.62, 0.95, DARK), f(-5.4, -2.78, 5.4, -2.62, 2.05, DARK, { y0: 1.55 }));
  F.push(f(-7, -2.78, -5.4, -2.62, RAMEN.h, DARK), f(5.4, -2.78, 7, -2.62, RAMEN.h, DARK));
  // counter top, partitions, stools, the blind over each serving slot, a green lamp over each free seat
  F.push(f(-5.4, -2.62, 5.4, -2.05, 0.06, '#8a6240', { y0: 0.9 }), f(-5.4, -2.62, 5.4, -2.5, 0.9, DARK));
  for (let k = 0; k <= S.length; k++) { const x = S[0] - 0.6 + k * 1.2; F.push(f(x - 0.03, -2.62, x + 0.03, -1.2, 1.5, WOOD)); }
  for (const x of S) F.push(f(x - 0.2, -1.72, x + 0.2, -1.32, 0.5, '#1b1b1e'), f(x - 0.5, -2.64, x + 0.5, -2.62, 0.6, '#a3241c', { y0: 0.95, tex: 'noren', walk: true }), f(x - 0.07, -2.64, x + 0.07, -2.61, 0.07, '#3dff7a', { y0: 1.68, glow: true, walk: true }));
  F.push(f(-5, -2.64, 5, -2.61, 0.75, '#e9dcc0', { y0: 2.15, tex: 'menu', walk: true }));
  // the kitchen seen through the slots
  F.push(f(-5.2, -4.7, 5.2, -4.0, 0.9, '#aab0b8', { metal: 0.8, rough: 0.3 }), f(-3.4, -4.6, -2.6, -4.1, 0.5, '#70757c', { y0: 0.9, metal: 0.9, rough: 0.25 }), f(1.2, -4.6, 2.0, -4.1, 0.5, '#70757c', { y0: 0.9, metal: 0.9, rough: 0.25 }));
  // ticket machine by the door, vacancy board, waiting bench, water server, red lanterns
  F.push(f(4.9, 3.9, 5.9, 4.6, 1.75, '#b3261e', { tex: 'ticket' }));
  F.push(f(-6.99, 2.1, -6.92, 4.3, 1.0, '#11151a', { y0: 1.45, walk: true }));
  S.forEach((_, k) => F.push(f(-6.92, 2.3 + k * 0.24, -6.9, 2.42 + k * 0.24, 0.12, '#3dff7a', { y0: 1.9, glow: true, walk: true })));
  F.push(f(-6.9, -0.6, -6.3, 1.6, 0.45, WOOD), f(6.2, -0.7, 6.9, 0.1, 1.2, '#cfd4da', { metal: 0.7, rough: 0.3 }));
  for (const x of [-3.6, 0, 3.6]) F.push(f(x - 0.2, 0.3, x + 0.2, 0.7, 0.42, '#ff5a36', { y0: RAMEN.h - 0.75, glow: true, walk: true }));
  const acts: Act[] = [{ x: 5.4, z: 3.2, r: 1.25, id: 'shop:ramen', label: '券売機で食券を買う', btn: '買う' }, ...S.map((x) => ({ x, z: -0.95, r: 0.62, id: 'ramen:eat', label: '席に座って食べる', btn: '食べる' }))];
  return { F, acts };
}
