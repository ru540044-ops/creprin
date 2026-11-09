import { RACES } from '../crime/race';
import { GARAGE, LANDMARKS, EXPORT_DOCK, TRIALS, CUSTOMS, HELIPADS, RAMPS, blocks, buildings, doors, LAND, PORT, AIRPORT, HALF, HWY_C, HWY_W, BEACH_X, heightAt, N, roadC, ROAD, HWY_LINKS, RAIL, LANDMARK3D, districtAt, CANAL_RECTS, SIG, inBay, SHIN, TUN } from '../world/cityGen';
import { REGION } from '../world/region';

/** World bounds of the map image and its scale. */
export const MAP = { x0: LAND.x0 - 60, z0: LAND.z0 - 60, x1: HALF + 413, z1: HALF + 413, s: 0.3 };
export const toMap = (x: number, z: number): [number, number] => [(x - MAP.x0) * MAP.s, (z - MAP.z0) * MAP.s];
export const fromMap = (u: number, v: number): [number, number] => [u / MAP.s + MAP.x0, v / MAP.s + MAP.z0];

let img: HTMLCanvasElement | null = null;
export function mapImage() {
  if (img) return img;
  const W = Math.round((MAP.x1 - MAP.x0) * MAP.s), H = Math.round((MAP.z1 - MAP.z0) * MAP.s);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d')!;
  c.fillStyle = '#16405e'; c.fillRect(0, 0, W, H);
  const R = (x0: number, z0: number, x1: number, z1: number, col: string) => { const [a, b] = toMap(x0, z0), [e, f] = toMap(x1, z1); c.fillStyle = col; c.fillRect(a, b, e - a, f - b); };
  R(LAND.x0, LAND.z0, LAND.x1, LAND.z1, '#4c6a3e');
  // hills shading
  for (let z = LAND.z0; z < -HALF - 40; z += 20) for (let x = LAND.x0; x < LAND.x1; x += 20) { const h = heightAt(x, z); if (h > 2) { const k = Math.min(1, h / 260); c.fillStyle = `rgba(${120 + k * 90},${130 + k * 60},${90 + k * 50},.55)`; const [a, b] = toMap(x, z); c.fillRect(a, b, 20 * MAP.s + 0.5, 20 * MAP.s + 0.5); } }
  R(BEACH_X - 10, -HALF - 90, LAND.x1, LAND.z1, '#d8c494');
  R(PORT.x0, PORT.z0, PORT.x1, PORT.z1, '#8b8f96');
  R(AIRPORT.x0 + 40, -190, AIRPORT.x1 - 20, -140, '#2c2f36'); R(AIRPORT.x0 + 200, -140, AIRPORT.x0 + 230, 180, '#3a3d44'); R(AIRPORT.x0 + 20, 120, AIRPORT.x1 - 20, 180, '#8a8c90');
  // highway + city roads
  const hw = HWY_W / 2; for (const s of [-1, 1]) { R(-HWY_C - hw, s * HWY_C - hw, HWY_C + hw, s * HWY_C + hw, '#e0b04a'); R(s * HWY_C - hw, -HWY_C - hw, s * HWY_C + hw, HWY_C + hw, '#e0b04a'); }
  R(-HALF - 70, -20, -HWY_C + hw, 20, '#e0b04a');
  R(-HALF, -HALF, HALF, HALF, '#7d7a8c');
  const zc: Record<string, string> = { downtown: '#3c3f58', commercial: '#4a4660', residential: '#55566a', industrial: '#5a5248', park: '#3f7a46', parking: '#5f5f66', gas: '#6a5a40', canal: '#4a4660', station: '#7a3a34', water: '#16405e' };
  // (canals are drawn as water below)
  for (const b of blocks) R(b.x0, b.z0, b.x1, b.z1, zc[b.zone]);
  for (const q of CANAL_RECTS) R(q.x0 - (q.axis === 'x' ? 1 : 0), q.z0 - (q.axis === 'z' ? 1 : 0), q.x1 + (q.axis === 'x' ? 1 : 0), q.z1 + (q.axis === 'z' ? 1 : 0), '#2a6e9a');
  { const st = 10; for (let z = -HALF; z < HALF; z += st) for (let x = -HALF; x < HALF; x += st) if (inBay(x + st / 2, z + st / 2)) R(x, z, x + st, z + st, '#16405e'); }
  c.fillStyle = 'rgba(20,18,34,.55)'; for (const b of buildings) { const [a, bb] = toMap(b.x0, b.z0), [e, f] = toMap(b.x1, b.z1); c.fillRect(a, bb, e - a, f - bb); }
  for (const k of HWY_LINKS) { const x = roadC(k); R(x - ROAD / 2, -HWY_C, x + ROAD / 2, -HALF, '#7d7a8c'); R(x - ROAD / 2, HALF, x + ROAD / 2, HWY_C, '#7d7a8c'); }
  // elevated railway and its stations
  R(RAIL.x - 3.5, RAIL.z0, RAIL.x + 3.5, RAIL.z1, '#2a2b30'); c.fillStyle = '#e8e8e8'; for (let z = RAIL.z0; z < RAIL.z1; z += 60) { const [a, b] = toMap(RAIL.x - 1, z); c.fillRect(a, b, 2 * MAP.s + 0.6, 30 * MAP.s); }
  for (const sz of RAIL.stations) R(RAIL.x - 8, sz - 55, RAIL.x + 8, sz + 55, '#d8d8de');
  if (SHIN.has) {
    // the Shinkansen: on its viaduct to the hills, then dashed through the tunnel; the station, the portal and the tunnel's name
    const zH = TUN.portal + TUN.hood; R(SHIN.x - 6, zH, SHIN.x + 6, SHIN.z1, '#f2f2f2'); R(SHIN.x - 2.5, zH, SHIN.x + 2.5, SHIN.z1, '#2b5fb8');
    for (let z = SHIN.z0; z < zH; z += 40) R(SHIN.x - 2.5, z, SHIN.x + 2.5, Math.min(zH, z + 22), '#2b5fb8');
    R(SHIN.x - 12, SHIN.stationZ - 112, SHIN.x + 12, SHIN.stationZ + 112, '#d8d8de'); R(SHIN.hall.x0, SHIN.hall.z0, SHIN.hall.x1, SHIN.hall.z1, '#9fb8e0');
    R(SHIN.x - 16, TUN.portal - 4, SHIN.x + 16, TUN.portal + 6, '#5a5a60');
    c.fillStyle = '#ffffff'; c.font = '800 13px system-ui, sans-serif'; c.textAlign = 'left'; { const [a, b] = toMap(SHIN.x + 16, (TUN.portal + SHIN.z0) / 2); c.fillText('新幹線 ' + TUN.name, a, b); }
  }
  // district names, each at the block of that district nearest its centre
  c.fillStyle = 'rgba(255,255,255,.75)'; c.font = '600 13px system-ui, sans-serif'; c.textAlign = 'center';
  const lab = (t: string, x: number, z: number) => { const [a, b] = toMap(x, z); c.fillText(t, a, b); };
  const acc = new Map<string, { sx: number; sz: number; n: number; pts: [number, number][] }>();
  for (const b of blocks) { const x = (b.x0 + b.x1) / 2, z = (b.z0 + b.z1) / 2, n = districtAt(x, z); let a = acc.get(n); if (!a) acc.set(n, (a = { sx: 0, sz: 0, n: 0, pts: [] })); a.sx += x; a.sz += z; a.n++; a.pts.push([x, z]); }
  for (const [name, a] of acc) { const mx = a.sx / a.n, mz = a.sz / a.n; let best = a.pts[0], bd = 1e18; for (const p of a.pts) { const d = (p[0] - mx) ** 2 + (p[1] - mz) ** 2; if (d < bd) { bd = d; best = p; } } lab(name, best[0], best[1]); }
  const RN = REGION.names;
  lab(RN.beach, HALF + 110, 0); lab(RN.port, (PORT.x0 + PORT.x1) / 2, HALF + 220); lab(RN.airport, (AIRPORT.x0 + AIRPORT.x1) / 2, 60); lab(RN.hills, -200, (LAND.z0 - HALF) / 2); lab(RN.sea, HALF + 330, -HALF + 200);
  img = cv; return cv;
}

/** The Shinkansen station badge: a big blue roundel with the train, drawn upright at screen position (x, y), r px. */
export function shinBadge(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.save(); c.fillStyle = '#1e5bd8'; c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(1.5, r * 0.16); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
  c.font = `${Math.round(r * 1.15)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🚄', x, y + r * 0.06); c.restore();
}
export const POI = () => [...doors.map((d) => ({ x: d.x, z: d.z, c: d.color, t: d.label })), ...SIG.shrines.map((s) => ({ x: s.x, z: s.z, c: '#e2432a', t: s.name })), ...SIG.gates.map((g) => ({ x: g.x, z: g.z, c: '#2be4ff', t: g.name })), { x: GARAGE.x, z: GARAGE.z + 20, c: '#3dffb0', t: 'GARAGE' }, { x: LANDMARK3D.x, z: LANDMARK3D.z, c: '#ff6a2a', t: LANDMARK3D.label },
  ...LANDMARKS.map((L) => ({ x: L.x, z: L.z, c: L.color, t: L.label })), { x: EXPORT_DOCK.x, z: EXPORT_DOCK.z, c: '#ff9a3a', t: 'EXPORT DOCK' }, ...TRIALS.map((T) => ({ x: T.start.x, z: T.start.z, c: '#c07aff', t: 'TIME TRIAL' })), { x: CUSTOMS.x, z: CUSTOMS.z, c: '#ff9a3a', t: 'BAY CUSTOMS' }, ...HELIPADS.map((h) => ({ x: h.x, z: h.z, c: '#ffffff', t: 'HELIPAD' })), ...RAMPS.map((r) => ({ x: r.x, z: r.z, c: '#ffcc00', t: 'STUNT JUMP' })), ...RACES.map((R) => ({ x: R.x, z: R.z, c: '#ff2a40', t: 'STREET RACE' }))];
export { N };
