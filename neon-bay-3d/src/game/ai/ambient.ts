import { props, blocks, doors, heightAt, pointBlocked, isWater, BEACH_X, HALF, PIER, PORT, AIRPORT, CRUISE, BLOCK } from '../world/cityGen';
import { mulberry } from '../world/rng';

/**
 * Ambient pedestrians: people who stay put doing something (sitting on benches, sunbathing, chatting in groups,
 * dancing in the park with a small crowd, fishing off the pier, working at the port, waiting at the airport,
 * lounging on the cruise deck) or jogging along the beach. Spots are fixed places in the world; peds.ts
 * streams a person into a free spot near the player and treats them like any other pedestrian when trouble starts.
 */
export type SpotKind = 'sit' | 'lie' | 'chat' | 'fish' | 'dance' | 'jog' | 'work' | 'watch';
export const AMBIENT_STATES = new Set<string>(['sit', 'lie', 'chat', 'fish', 'dance', 'jog', 'work', 'watch']);
/** 0 everyday clothes, 1 swimwear, 2 hi-vis work wear, 3 sportswear */
export type Outfit = 0 | 1 | 2 | 3;
export interface Spot { id: number; kind: SpotKind; x: number; y: number; z: number; yaw: number; outfit: Outfit; x2: number; z2: number; style: number; cool: number }

let _spots: Spot[] | null = null;
export const towels: { x: number; y: number; z: number; yaw: number; c: number }[] = [];
export const rods: { x: number; y: number; z: number; yaw: number }[] = [];

export function spots(): Spot[] {
  if (_spots) return _spots;
  const out: Spot[] = [], R = mulberry(5150);
  const add = (kind: SpotKind, x: number, y: number, z: number, yaw: number, outfit: Outfit = 0, extra: Partial<Spot> = {}) => { out.push({ id: out.length, kind, x, y, z, yaw, outfit, x2: x, z2: z, style: Math.floor(R() * 3), cool: 0, ...extra }); };
  const face = (x: number, z: number, tx: number, tz: number) => Math.atan2(tx - x, tz - z);
  const groupAt = (cx: number, cz: number, y: number, n: number, kind: SpotKind, outfit: Outfit = 0, r = 0.6) => {
    const a0 = R() * Math.PI * 2;
    for (let k = 0; k < n; k++) { const a = a0 + (k / n) * Math.PI * 2, x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r; add(kind, x, y, z, face(x, z, cx, cz), outfit); }
  };
  const nearDoor = (x: number, z: number, d: number) => doors.some((q) => Math.abs(q.x - x) < d && Math.abs(q.z - z) < d);

  // benches: up to two people each, facing the way the bench faces
  for (const b of props.benches) for (const s of [-0.45, 0.45]) {
    if (R() > 0.62) continue;
    const c = Math.cos(b.a), sn = Math.sin(b.a), lx = s, lz = 0.06;
    add('sit', b.x + lx * c + lz * sn, (b.y || 0) + 0.02, b.z - lx * sn + lz * c, b.a);
  }
  // sidewalk groups chatting outside shops and offices
  for (const B of blocks) {
    if ((B.zone !== 'downtown' && B.zone !== 'commercial') || R() > 0.5) continue;
    const side = Math.floor(R() * 4), t = 14 + R() * (BLOCK - 28), ins = 4.1;
    const x = side === 0 ? B.x0 + t : side === 1 ? B.x1 - ins : side === 2 ? B.x0 + t : B.x0 + ins, z = side === 0 ? B.z0 + ins : side === 1 ? B.z0 + t : side === 2 ? B.z1 - ins : B.z0 + t;
    if (nearDoor(x, z, 6) || pointBlocked(x, 1, z)) continue;
    groupAt(x, z, 0.15, 2 + (R() < 0.45 ? 1 : 0), 'chat');
  }
  // parks: street dancers with a small crowd, chatting pairs on the paths
  for (const B of blocks) {
    if (B.zone !== 'park') continue;
    const cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2;
    if (R() < 0.6) {
      const dx = cx + 14, dz = cz + 14;
      groupAt(dx, dz, 0.3, 3, 'dance', 3, 1.3);
      for (let k = 0; k < 4; k++) { const a = -0.9 + k * 0.6, x = dx + Math.sin(a) * 4.6, z = dz - Math.cos(a) * 4.6; add('watch', x, 0.3, z, face(x, z, dx, dz)); }
    }
    groupAt(cx - 3, cz + 22, 0.3, 2, 'chat');
  }
  // beach: sunbathers on towels around the umbrellas, chatting groups on the sand, joggers along the shore
  for (const u of props.umbrellas) {
    const n = 1 + (R() < 0.5 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const x = u.x + (R() - 0.5) * 1.2, z = u.z + (k ? 1.5 : -1.5) + (R() - 0.5) * 0.4, y = heightAt(x, z), yaw = Math.PI / 2 + (R() - 0.5) * 0.5;
      if (isWater(x, z)) continue;
      add('lie', x, y, z, yaw, 1); towels.push({ x, y: y + 0.03, z, yaw, c: Math.floor(R() * 6) });
    }
  }
  for (let z = -HALF + 90; z < HALF - 90; z += 140) { const x = BEACH_X + 10 + R() * 8; if (!isWater(x, z)) groupAt(x, z, heightAt(x, z), 2 + (R() < 0.4 ? 1 : 0), 'chat', R() < 0.6 ? 1 : 0); }
  for (let k = 0; k < 5; k++) { const z = -HALF + 100 + k * (2 * HALF - 200) / 5, x = BEACH_X + 4 + (k % 2) * 2; add('jog', x, heightAt(x, z), z, 0, 3, { x2: x, z2: z + 380 * (k % 2 ? -1 : 1) }); }
  for (let z = -HALF + 60; z < HALF - 60; z += 70) add('watch', BEACH_X + 6 + R() * 6, heightAt(BEACH_X + 8, z), z + 18, Math.PI / 2, R() < 0.5 ? 1 : 0);
  // pier: anglers along the far end, each with a rod over the rail
  for (let x = PIER.x1 - 26; x < PIER.x1 - 2; x += 6) for (const side of [-1, 1]) {
    if (R() < 0.25) continue;
    const z = side > 0 ? PIER.z1 - 0.8 : PIER.z0 + 0.8, yaw = side > 0 ? 0 : Math.PI;
    add('fish', x, PIER.y, z, yaw); rods.push({ x, y: PIER.y, z, yaw });
  }
  add('fish', PIER.x1 - 0.8, PIER.y, (PIER.z0 + PIER.z1) / 2 + 2, Math.PI / 2); rods.push({ x: PIER.x1 - 0.8, y: PIER.y, z: (PIER.z0 + PIER.z1) / 2 + 2, yaw: Math.PI / 2 });
  // port: dock workers in hi-vis between the container rows
  for (let k = 0; k < 14; k++) {
    const x = PORT.x0 + 53 + Math.floor(R() * 22) * 14, z = PORT.z0 + 44.5 + Math.floor(R() * 5) * 9;
    if (pointBlocked(x, 2, z)) continue;
    if (R() < 0.5) groupAt(x, z, 1.2, 2, 'work', 2, 0.55); else add('work', x, 1.2, z, R() * Math.PI * 2, 2);
  }
  // airport: travellers waiting outside the terminal
  for (let k = 0; k < 8; k++) { const x = AIRPORT.x0 + 280 + R() * 220, z = 175 - R() * 4; if (R() < 0.4) groupAt(x, z, 0, 2, 'chat'); else add('watch', x, 0, z, Math.PI + (R() - 0.5) * 1.2); }
  // cruise sun deck: passengers on the loungers and at the rail
  const MID = (CRUISE.z0 + CRUISE.z1) / 2;
  for (let x = 352; x < 432; x += 4) for (const z of [MID - 8, MID + 8]) if ((x < 377 || x > 405) && R() < 0.4) add('lie', x + 1.1, CRUISE.sun + 0.75, z, Math.PI / 2, 1);
  for (let k = 0; k < 6; k++) { const x = 350 + R() * 90, s = k % 2 ? 1 : -1, z = MID + s * 11.2; if (x > 405 && x < 418) continue; add('watch', x, CRUISE.sun, z, s > 0 ? 0 : Math.PI, R() < 0.5 ? 1 : 0); }
  groupAt(392, MID - 11, CRUISE.sun, 3, 'chat', 1);
  _spots = out; return out;
}
