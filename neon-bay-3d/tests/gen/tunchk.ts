import * as G from '../../src/game/world/cityGen';
import { REGION } from '../../src/game/world/region';
const T = G.TUN, S = G.SHIN, h = (x: number, z: number) => Math.round(G.heightAt(x, z) * 10) / 10;
const line: string[] = [];
for (let z = -G.HALF + 20; z > T.end - 10; z -= 40) line.push(`${Math.round(z - T.portal)}:${h(T.x, z)}/${h(T.x + 20, z)}/${h(T.x + 60, z)}`);
// over the bore: the ground must clear the crown (y + wall + hw = 23) everywhere along it, within the bore width
let minCover = 1e9; for (let z = T.portal - 1; z > T.end - 3; z -= 3) for (const dx of [-6, -3, 0, 3, 6]) minCover = Math.min(minCover, G.heightAt(T.x + dx, z) - (T.y + T.wall + T.hw));
// in the cutting the ground must stay under the deck (y - 1.3)
let maxCut = -1e9; for (let z = T.portal + 1; z < -G.HALF; z += 3) for (const dx of [-5, 0, 5]) maxCut = Math.max(maxCut, G.heightAt(T.x + dx, z));
const pinesInCut = G.props.pines.filter((p) => Math.abs(p.x - T.x) < 14 && p.z > T.portal - 5).length;
console.log(JSON.stringify({ region: REGION.id, has: S.has, x: S.x, z0: S.z0, z1: S.z1, sz: S.stationZ, half: G.HALF, portal: T.portal, end: T.end, dests: S.dests, plats: S.platforms.map((p) => [p.num, p.side, p.dir, p.to || '-']), piers: S.piers.length, piersOutside: S.piers.filter((z) => z < -G.HALF).length, minCover: Math.round(minCover * 10) / 10, maxCut: Math.round(maxCut * 10) / 10, pinesInCut, spawnBlocked: G.pointBlocked(G.SPAWN.x, 1, G.SPAWN.z), gateBlocked: G.pointBlocked(S.gate.x, 1, S.gate.z), line: line.join(' ') }));
