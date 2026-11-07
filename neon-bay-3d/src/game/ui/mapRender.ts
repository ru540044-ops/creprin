import { GARAGE, blocks, buildings, doors, LAND, PORT, AIRPORT, HALF, HWY_C, HWY_W, BEACH_X, heightAt, N, roadC, ROAD } from '../world/cityGen';

/** World bounds of the map image and its scale. */
export const MAP = { x0: -1560, z0: -1760, x1: 1120, z1: 1120, s: 0.3 };
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
  R(BEACH_X - 10, LAND.z0 + 900, LAND.x1, LAND.z1, '#d8c494');
  R(PORT.x0, PORT.z0, PORT.x1, PORT.z1, '#8b8f96');
  R(AIRPORT.x0 + 40, -190, AIRPORT.x1 - 20, -140, '#2c2f36'); R(AIRPORT.x0 + 200, -140, AIRPORT.x0 + 230, 180, '#3a3d44'); R(AIRPORT.x0 + 20, 120, AIRPORT.x1 - 20, 180, '#8a8c90');
  // highway + city roads
  const hw = HWY_W / 2; for (const s of [-1, 1]) { R(-HWY_C - hw, s * HWY_C - hw, HWY_C + hw, s * HWY_C + hw, '#e0b04a'); R(s * HWY_C - hw, -HWY_C - hw, s * HWY_C + hw, HWY_C + hw, '#e0b04a'); }
  R(-HALF - 70, -20, -HWY_C + hw, 20, '#e0b04a');
  R(-HALF, -HALF, HALF, HALF, '#7d7a8c');
  const zc: Record<string, string> = { downtown: '#3c3f58', commercial: '#4a4660', residential: '#55566a', industrial: '#5a5248', park: '#3f7a46', parking: '#5f5f66', gas: '#6a5a40' };
  for (const b of blocks) R(b.x0, b.z0, b.x1, b.z1, zc[b.zone]);
  c.fillStyle = 'rgba(20,18,34,.55)'; for (const b of buildings) { const [a, bb] = toMap(b.x0, b.z0), [e, f] = toMap(b.x1, b.z1); c.fillRect(a, bb, e - a, f - bb); }
  for (const k of [3, 7, 11]) { const x = roadC(k); R(x - ROAD / 2, -HWY_C, x + ROAD / 2, -HALF, '#7d7a8c'); R(x - ROAD / 2, HALF, x + ROAD / 2, HWY_C, '#7d7a8c'); }
  c.fillStyle = 'rgba(255,255,255,.75)'; c.font = '600 13px system-ui, sans-serif'; c.textAlign = 'center';
  const lab = (t: string, x: number, z: number) => { const [a, b] = toMap(x, z); c.fillText(t, a, b); };
  lab('ダウンタウン', 0, 0); lab('ネオンマイル', -380, -300); lab('パームホロウ', -560, 420); lab('コーラルハイツ', 520, -560); lab('ファウンドリー', -560, 620);
  lab('サウスビーチ', HALF + 110, 0); lab('ポート', 520, HALF + 220); lab('ベイ国際空港', -1110, 60); lab('パリセード・ヒルズ', -200, -1300);
  img = cv; return cv;
}

export const POI = () => [...doors.map((d) => ({ x: d.x, z: d.z, c: d.color, t: d.label })), { x: GARAGE.x, z: GARAGE.z + 20, c: '#3dffb0', t: 'GARAGE' }];
export { N };
