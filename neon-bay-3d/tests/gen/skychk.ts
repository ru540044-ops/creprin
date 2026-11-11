import * as G from '../../src/game/world/cityGen';
import { BDOORS } from '../../src/game/world/bldgInteriors';
import { REGION } from '../../src/game/world/region';
const B = G.buildings, cnt: Record<string, number> = {};
for (const b of B) { const k = (b.shape || 'box') + ':' + (b.fac || b.type); cnt[k] = (cnt[k] || 0) + 1; }
const elevated = B.filter((b) => b.y0 > 1), podiums = B.filter((b) => b.up);
// every tower standing on a podium must sit inside one
const floating = elevated.filter((t) => !B.some((p) => p !== t && p.y0 < 1 && Math.abs(p.y0 + p.h - t.y0) < 0.5 && t.x0 >= p.x0 - 0.01 && t.x1 <= p.x1 + 0.01 && t.z0 >= p.z0 - 0.01 && t.z1 <= p.z1 + 0.01)).length;
const doorsUp = BDOORS.filter((d) => d.y > 1).length;
const tallest = [...B].sort((a, b) => b.y0 + b.h - a.y0 - a.h).slice(0, 5).map((b) => `${b.shape || 'box'}/${b.fac || b.type}:${Math.round(b.y0 + b.h)}m`);
const spiral = B.find((b) => b.shape === 'spiral'), twin = B.filter((b) => b.shape === 'round' && b.y0 > 1 && b.fac && (b.fac === 'fin' || b.fac === 'curtain')).length;
const heli = G.HELIPADS.map((h) => `${h.name}@${Math.round(h.y)}`);
const lobbies = BDOORS.filter((d) => d.kind === 'lobby');
const sky = lobbies.filter((d) => { const b = B[d.b], T = G.topFoot(b); return b.h >= 50 && b.h <= 150 && T.x1 - T.x0 >= 22 && T.z1 - T.z0 >= 20; }).length;
const podiumRoofs = BDOORS.filter((d) => B[d.b].up).length;
console.log(JSON.stringify({ region: REGION.id, buildings: B.length, cnt, elevated: elevated.length, podiums: podiums.length, floating, doorsUp, tallest, spiral: spiral && Math.round(spiral.h), twinTowers: twin, heli, skyMissionCandidates: sky, podiumDoors: podiumRoofs, spawnBlocked: G.pointBlocked(G.SPAWN.x, 1, G.SPAWN.z), homes: G.doors.filter((d) => d.id.startsWith('h_')).map((d) => d.id) }));
