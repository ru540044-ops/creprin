/**
 * Japan: four regions, each generated as its own city (Tokyo, Osaka, Fukuoka, Naha). Travelling saves the game,
 * stores the destination and reloads the page, so every system keeps working on one city at a time.
 */
export type RegionId = 'tokyo' | 'osaka' | 'fukuoka' | 'naha';
export type Landmark3D = 'tower' | 'castle' | 'seatower' | 'redcastle';
export interface RegionDef {
  id: RegionId; idx: number; name: string; en: string; N: number;
  /** tower height multiplier for downtown blocks (Fukuoka and Naha keep low skylines) */
  heightMul: number;
  /** where on the Japan map (0..1 of the map width / height) */
  map: [number, number];
  intro: string;
  names: { downtown: string; commercial: [string, string]; residential: [string, string]; industrial: string; park: string; beach: string; port: string; airport: string; hills: string; sea: string };
  /** Tokyo only: names of the districts that only the big city has */
  ring?: { north: string; east: string; south: string; west: string; uptown: string };
  outer?: { midtown: string; eastbay: string; techpark: string; portside: string; oldtown: string; westgate: string; greenvalley: string; northhills: string };
  /** the station trains arrive at ('' = reached by plane only) */
  station: string;
  /** the city's landmark: kind, label on the map, and the park block (core coordinates) it stands in */
  landmark: { kind: Landmark3D; label: string; ci: number; cj: number };
  /** elevated railway: label and number of cars */
  rail: { name: string; cars: number; color: string };
  roofs: [number, number, number][];
  walls: [number, number, number][];
  palmStreets: boolean;
}
const JROOF: [number, number, number][] = [[0.26, 0.28, 0.32], [0.3, 0.34, 0.42], [0.36, 0.3, 0.25], [0.22, 0.24, 0.27], [0.42, 0.3, 0.24], [0.2, 0.3, 0.42]];
const JWALL: [number, number, number][] = [[0.97, 0.96, 0.93], [0.92, 0.9, 0.86], [0.88, 0.86, 0.82], [0.95, 0.92, 0.85], [0.84, 0.86, 0.88], [0.93, 0.88, 0.8]];
export const REGIONS: Record<RegionId, RegionDef> = {
  tokyo: {
    id: 'tokyo', idx: 0, name: '東京', en: 'TOKYO', N: 40, heightMul: 1, map: [0.7, 0.47],
    intro: '日本の首都。超高層ビルの街、高架を走る電車、赤い電波塔。',
    names: { downtown: '新宿', commercial: ['渋谷', '銀座'], residential: ['世田谷', '目黒'], industrial: '大田', park: '代々木公園', beach: 'お台場', port: '東京港', airport: '羽田空港', hills: '奥多摩', sea: '東京湾' },
    ring: { north: '池袋', east: '日本橋', south: '品川', west: '中野', uptown: '六本木' },
    outer: { midtown: '丸の内', eastbay: '豊洲', techpark: '天王洲', portside: '京浜', oldtown: '浅草', westgate: '吉祥寺', greenvalley: '練馬', northhills: '赤羽' },
    station: '東京駅', landmark: { kind: 'tower', label: '電波塔', ci: 10, cj: 11 }, rail: { name: '環状線', cars: 8, color: '#3aa85a' },
    roofs: JROOF, walls: JWALL, palmStreets: false,
  },
  osaka: {
    id: 'osaka', idx: 1, name: '大阪', en: 'OSAKA', N: 28, heightMul: 0.8, map: [0.53, 0.57],
    intro: '天下の台所。キタの高層ビル、ミナミのネオン、大阪城。',
    names: { downtown: '梅田', commercial: ['心斎橋', '難波'], residential: ['天王寺', '福島'], industrial: '此花', park: '大阪城公園', beach: '南港', port: '大阪港', airport: '関西空港', hills: '生駒山', sea: '大阪湾' },
    station: '新大阪駅', landmark: { kind: 'castle', label: '大阪城', ci: 9, cj: 4 }, rail: { name: '環状線', cars: 6, color: '#ff6a2a' },
    roofs: JROOF, walls: JWALL, palmStreets: false,
  },
  fukuoka: {
    id: 'fukuoka', idx: 2, name: '福岡', en: 'FUKUOKA', N: 24, heightMul: 0.42, map: [0.27, 0.66],
    intro: '九州の玄関口。中洲のネオン、海辺のガラスのタワー、空港が近い低い街並み。',
    names: { downtown: '天神', commercial: ['博多', '中洲'], residential: ['薬院', '大濠'], industrial: '箱崎', park: '大濠公園', beach: '百道浜', port: '博多港', airport: '福岡空港', hills: '油山', sea: '博多湾' },
    station: '博多駅', landmark: { kind: 'seatower', label: 'シーサイドタワー', ci: 0, cj: 0 }, rail: { name: '空港線', cars: 4, color: '#2b6bff' },
    roofs: JROOF, walls: JWALL, palmStreets: false,
  },
  naha: {
    id: 'naha', idx: 3, name: '那覇', en: 'NAHA', N: 20, heightMul: 0.3, map: [0.1, 0.92],
    intro: '南国の地方都市。赤瓦の家、ヤシ並木、青い海、モノレール。',
    names: { downtown: 'おもろまち', commercial: ['国際通り', '牧志'], residential: ['首里', '小禄'], industrial: '港町', park: '首里城公園', beach: '波の上ビーチ', port: '那覇港', airport: '那覇空港', hills: '首里の丘', sea: '東シナ海' },
    station: '', landmark: { kind: 'redcastle', label: '首里城', ci: 4, cj: 9 }, rail: { name: 'モノレール', cars: 2, color: '#2bb0c8' },
    roofs: [[0.78, 0.33, 0.22], [0.72, 0.3, 0.2], [0.85, 0.4, 0.26], [0.7, 0.36, 0.26]], walls: [[0.98, 0.97, 0.94], [0.95, 0.93, 0.86], [0.92, 0.95, 0.96], [0.97, 0.9, 0.82]], palmStreets: true,
  },
};
export const REGION_ORDER: RegionId[] = ['tokyo', 'osaka', 'fukuoka', 'naha'];
export const REGION_KEY = 'neonbay3d.region';
export const ARRIVE_KEY = 'neonbay3d.arrive';
export const REGION: RegionDef = (() => {
  try { const r = localStorage.getItem(REGION_KEY) as RegionId | null; if (r && r in REGIONS) return REGIONS[r]; } catch { /* storage unavailable */ }
  return REGIONS.tokyo;
})();
export const inTokyo = () => REGION.id === 'tokyo';
export function setRegion(id: RegionId) { try { localStorage.setItem(REGION_KEY, id); } catch { /* ignore */ } }
export type TravelMode = 'train' | 'plane';
/** Travel options between regions: mode, hours on the clock, fare. Naha (an island) is reached by plane only. */
export function route(from: RegionId, to: RegionId) {
  const order: RegionId[] = ['tokyo', 'osaka', 'fukuoka'];
  if (to === 'naha' || from === 'naha') return { mode: 'plane' as TravelMode, label: '飛行機', icon: '✈️', fare: 2500, hours: 3 };
  const d = Math.abs(order.indexOf(from) - order.indexOf(to));
  return { mode: 'train' as TravelMode, label: '新幹線', icon: '🚄', fare: 800 * d + 400, hours: 2.5 * d };
}
