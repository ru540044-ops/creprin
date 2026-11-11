import * as G from '../../src/game/world/cityGen';
import { REGION } from '../../src/game/world/region';
import { deer, DEER_AREA } from '../../src/game/ai/deer';
// Nara: zone map, the great hall (walk in through the doorway to the prayer spot), pagoda, stalls, deer spawned on free ground
const N = G.N, rows: string[] = [];
const ch: Record<string, string> = { downtown: 'D', commercial: 'c', residential: '.', park: 'P', parking: 'p', industrial: 'i', station: 'S', canal: '~', water: 'w', gas: 'g' };
for (let j = 0; j < N; j++) { let r = ''; for (let i = 0; i < N; i++) { const b = G.blocks[j * N + i]; r += b ? (i === G.LM_BLOCK.i && j === G.LM_BLOCK.j ? 'L' : G.MACHIYA_BLOCKS.has(j * N + i) ? 'm' : ch[b.zone] ?? '?') : ' '; } rows.push(r); }
console.log(rows.join('\n'));
const L = G.LANDMARK3D, D = G.DAIBUTSU;
// a straight walk from outside the middle gate to the prayer spot in front of the figure must be free of solids
let blocked = ''; for (let z = L.z + D.clo + 3; z > L.z + D.bz + 8; z -= 0.5) if (G.pointBlocked(L.x + 2.5, 1, z) || G.pointBlocked(L.x + 2.5, 1.7, z)) { blocked = `z=${(z - L.z).toFixed(1)}`; break; }
const shrine = G.SIG.shrines.find((s) => s.name === L.label)!;
const pray = { x: shrine.x, z: shrine.z + 10.5 };
console.log(JSON.stringify({ region: REGION.id, landmark: L, walkInBlocked: blocked || 'no', prayFree: !G.pointBlocked(pray.x, 1, pray.z), prayLocal: [pray.x - L.x, pray.z - L.z],
  insideFigure: G.pointBlocked(L.x, 5, L.z + D.bz), wallBack: G.pointBlocked(L.x, 5, L.z + D.hz0 + 0.5), pagoda: G.SIG.pagoda, stalls: G.SIG.yatai.filter((y) => y.senbei).length,
  stallsFree: G.SIG.yatai.filter((y) => y.senbei).map((y) => !G.pointBlocked(y.x, 1, y.z + 2.2)), lanterns: G.NARA_LANTERNS.length, machiya: G.MACHIYA_BLOCKS.size, deer: deer.length, deerBlocked: deer.filter((d) => G.pointBlocked(d.x, 0.6, d.z)).length, area: DEER_AREA,
  station: G.STATION && { x: G.STATION.x, z: G.STATION.z }, spawnBlocked: G.pointBlocked(G.SPAWN.x, 1, G.SPAWN.z), stationSpawnBlocked: G.STATION ? G.pointBlocked(G.STATION.spawn.x, 1, G.STATION.spawn.z) : null }));
