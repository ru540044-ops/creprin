import * as G from '../../src/game/world/cityGen';
import { REGION } from '../../src/game/world/region';
import { places } from '../../src/game/ui/places';
// every place on the map: how many of each kind, and whether the spot you are put down at by "skip" is free ground
const P = places(), cnt: Record<string, number> = {}, bad: string[] = [];
for (const p of P) { cnt[p.cat] = (cnt[p.cat] || 0) + 1; const g = G.groundAt(p.tx, p.tz); if (G.pointBlocked(p.tx, g + 1, p.tz) || G.isWater(p.tx, p.tz)) bad.push(`${p.cat}:${p.name}@${Math.round(p.tx)},${Math.round(p.tz)}`); }
console.log(JSON.stringify({ region: REGION.id, total: P.length, cnt, landingBlocked: bad.length, sample: bad.slice(0, 6) }));
