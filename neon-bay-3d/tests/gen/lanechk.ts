import * as G from '../../src/game/world/cityGen';
import { BDOORS } from '../../src/game/world/bldgInteriors';
import { REGION } from '../../src/game/world/region';
const L = G.LANES, B = G.BRIDGES;
// a lane must be free of solids along its centre line (walk it at 1 m steps, 0.5 m above the ground)
let blockedLanes = 0, sample = '';
for (const q of L) { let bad = false; for (let x = q.x0 + 1; x < q.x1 - 1; x += 1) if (G.pointBlocked(x, 0.7, q.z) || G.pointBlocked(x, 0.7, q.z - 1.2) || G.pointBlocked(x, 0.7, q.z + 1.2)) { bad = true; if (!sample) sample = `${Math.round(x)},${Math.round(q.z)}`; break; } if (bad) blockedLanes++; }
// bridges: the stair ground rises to the deck, the deck is a solid top at FB.top, the road under it is clear for cars
let badBridge = 0; const bs: string[] = [];
for (const b of B) {
  const xe = b.x + G.ROAD / 2, sx = xe + (G.FB.s0 + G.FB.s1) / 2, z0 = b.z + G.FB.hw;
  const foot = G.groundAt(sx, z0 + G.FB.run - 0.05), mid = G.groundAt(sx, z0 + G.FB.run / 2), topG = G.groundAt(sx, z0 + 0.05), deck = G.floorAt(b.x, b.z, G.FB.top + 0.3), road = G.groundAt(b.x, b.z);
  const carBlocked = G.collide({ x: b.x, z: b.z }, 1, 0.2, 1.4) || G.collide({ x: b.x - 3.3, z: b.z }, 1, 0.2, 1.4);
  const ok = foot < 0.4 && mid > 2 && mid < 3.4 && topG > G.FB.top - 0.3 && Math.abs(deck - G.FB.top) < 0.01 && road === 0 && !carBlocked;
  if (!ok) { badBridge++; bs.push(JSON.stringify({ foot, mid, topG, deck, road, carBlocked })); }
}
const doorBlocked = BDOORS.filter((d) => G.pointBlocked(d.x, 1, d.z)).length;
console.log(JSON.stringify({ region: REGION.id, lanes: L.length, blockedLanes, sample, bridges: B.length, badBridge, bs: bs.slice(0, 2), bdoors: BDOORS.length, doorBlocked, spawnBlocked: G.pointBlocked(G.SPAWN.x, 1, G.SPAWN.z), handDoors: G.doors.length, solids: G.solids.length }));
