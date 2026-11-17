import type { RegionId } from '../world/region';

/**
 * The lines between the cities, at their real lengths. Stations sit at their operating kilometres scaled to the real track
 * length (Tokaido Shinkansen 515.4 km of track for 552.6 operating km; Sanyo 553.7 km for 622.3), so the distances
 * between stations are the real ones. Tunnels, big rivers, the coast, Lake Hamana and Mt Fuji are placed by kilometre
 * from public maps (approximate). The commuter lines to Nara are a made-up private railway on a real-length route.
 */
export type Zone = 'city' | 'suburb' | 'fields' | 'hills' | 'coast';
export interface Leg {
  /** line name and the train that runs it */ name: string; train: 'shin' | 'local'; /** top speed km/h */ vmax: number;
  /** track length, metres */ len: number;
  stations: { name: string; s: number }[];
  zones: { s: number; z: Zone }[];
  tunnels: { a: number; b: number; name?: string }[];
  rivers: { s: number; w: number; name: string }[];
  /** water beside the line: side -1 = left of the direction of travel, 1 = right */
  water: { a: number; b: number; side: number; lake?: boolean }[];
  /** far peaks drawn to scale: position along the line, distance off to the side (metres), height, snow cap */
  peaks: { s: number; off: number; h: number; r: number; snow: boolean; name: string }[];
  castles: { s: number; side: number }[];
}
type Raw = Omit<Leg, 'len' | 'stations' | 'zones' | 'tunnels' | 'rivers' | 'water' | 'peaks' | 'castles'> & {
  scale: number; stations: [string, number][]; zones: [number, Zone][]; tunnels: [number, number, string?][]; rivers: [number, number, string][];
  water: [number, number, number, boolean?][]; peaks: [number, number, number, number, boolean, string][]; castles: [number, number][];
};
/** Build a leg from operating kilometres (scaled to the real track length). */
function leg(r: Raw): Leg {
  const m = (km: number) => km * 1000 * r.scale, last = r.stations[r.stations.length - 1][1];
  return {
    name: r.name, train: r.train, vmax: r.vmax, len: m(last),
    stations: r.stations.map(([name, km]) => ({ name, s: m(km) })),
    zones: r.zones.map(([km, z]) => ({ s: m(km), z })),
    tunnels: r.tunnels.map(([a, b, name]) => ({ a: m(a), b: m(b), name })),
    rivers: r.rivers.map(([km, w, name]) => ({ s: m(km), w, name })),
    water: r.water.map(([a, b, side, lake]) => ({ a: m(a), b: m(b), side, lake })),
    peaks: r.peaks.map(([km, off, h, rad, snow, name]) => ({ s: m(km), off, h, r: rad, snow, name })),
    castles: r.castles.map(([km, side]) => ({ s: m(km), side })),
  };
}
// Tokyo -> Shin-Osaka (direction of travel: west; the Pacific is on the left, Mt Fuji on the right)
const TOKAIDO = leg({
  name: '東海道新幹線', train: 'shin', vmax: 285, scale: 515.4 / 552.6,
  stations: [['東京', 0], ['品川', 6.8], ['新横浜', 28.8], ['小田原', 83.9], ['熱海', 104.6], ['三島', 120.7], ['新富士', 146.2], ['静岡', 180.2], ['掛川', 229.3], ['浜松', 257.1], ['豊橋', 293.6], ['三河安城', 336.3], ['名古屋', 366.0], ['岐阜羽島', 396.3], ['米原', 445.9], ['京都', 513.6], ['新大阪', 552.6]],
  zones: [[0, 'city'], [22, 'suburb'], [36, 'city'], [40, 'suburb'], [58, 'fields'], [76, 'coast'], [87, 'hills'], [114, 'suburb'], [126, 'fields'], [172, 'city'], [186, 'hills'], [200, 'coast'], [212, 'fields'], [252, 'city'], [262, 'fields'], [288, 'suburb'], [300, 'fields'], [352, 'city'], [378, 'fields'], [404, 'hills'], [440, 'fields'], [504, 'city'], [518, 'suburb'], [536, 'city']],
  tunnels: [[44, 45.2], [87.5, 89], [91, 93.4], [96, 101.5], [105.3, 113.2, '新丹那トンネル'], [186.5, 188.4], [190.2, 192.6, '日本坂トンネル'], [216, 217.5], [420, 422.4], [426, 427.4], [507, 510.8, '東山トンネル']],
  rivers: [[16.5, 420, '多摩川'], [66, 440, '相模川'], [80.5, 300, '酒匂川'], [151.5, 1100, '富士川'], [176, 450, '安倍川'], [206, 1050, '大井川'], [249, 900, '天竜川'], [387.5, 780, '木曽川'], [390.5, 560, '長良川'], [392.5, 560, '揖斐川'], [528, 600, '淀川']],
  water: [[76, 86, -1], [198, 206, -1], [268, 282, -1], [270, 281, 1, true]],
  peaks: [[150, 26000, 3776, 22000, true, '富士山'], [95, 9000, 1400, 9000, false, '箱根の山'], [425, 7000, 1377, 7000, false, '伊吹山']],
  castles: [[84.2, 1], [365.4, 1]],
});
// Shin-Osaka -> Hakata (travelling west: the Inland Sea on the left)
const SANYO = leg({
  name: '山陽新幹線', train: 'shin', vmax: 300, scale: 553.7 / 622.3,
  stations: [['新大阪', 0], ['新神戸', 32.7], ['西明石', 59.7], ['姫路', 91.7], ['相生', 112.4], ['岡山', 180.3], ['新倉敷', 206.0], ['福山', 238.6], ['新尾道', 258.8], ['三原', 270.2], ['東広島', 309.8], ['広島', 341.6], ['新岩国', 383.0], ['徳山', 430.1], ['新山口', 474.4], ['厚狭', 509.7], ['新下関', 536.1], ['小倉', 555.1], ['博多', 622.3]],
  zones: [[0, 'city'], [16, 'hills'], [42, 'suburb'], [62, 'fields'], [86, 'city'], [97, 'fields'], [110, 'hills'], [172, 'city'], [188, 'fields'], [232, 'city'], [244, 'fields'], [254, 'coast'], [276, 'hills'], [334, 'city'], [348, 'hills'], [398, 'coast'], [424, 'city'], [436, 'fields'], [526, 'coast'], [550, 'city'], [562, 'hills'], [608, 'city']],
  tunnels: [[17.5, 32.2, '六甲トンネル'], [33.2, 41.1, '神戸トンネル'], [113, 116.5], [121, 125.5], [130, 133], [140, 145.5], [150, 156.2], [160, 166.5], [278, 284.5], [289, 296], [300, 306.5], [315, 321.5], [326, 332.5], [350, 357.5], [362, 369.5], [375, 379.5], [441, 446.2], [480, 486], [495, 505], [537.5, 556.2, '新関門トンネル'], [566, 570], [576, 584.5, '福岡トンネル'], [598, 605]],
  rivers: [[9.5, 300, '神崎川'], [159.5, 480, '吉井川'], [177, 380, '旭川'], [194, 460, '高梁川'], [340, 420, '太田川'], [381, 380, '錦川']],
  water: [[254, 273, -1], [398, 423, -1], [526, 537, -1]],
  peaks: [[60, 9000, 931, 7000, false, '六甲山']],
  castles: [[91.4, 1], [238.4, 1]],
});
// Osaka (Namba) -> Nara on the made-up private railway, through the tunnel under Mt Ikoma
const YAMATO = leg({
  name: 'やまと線 特急', train: 'local', vmax: 110, scale: 1,
  stations: [['なんば', 0], ['鶴橋', 4.1], ['布施', 6.1], ['石切', 15.1], ['生駒', 18.0], ['学園前', 26.2], ['大和西大寺', 28.8], ['奈良', 32.8]],
  zones: [[0, 'city'], [8, 'suburb'], [13.5, 'hills'], [21, 'suburb'], [30, 'city']],
  tunnels: [[15.4, 18.8, '生駒トンネル']],
  rivers: [[7.6, 120, '長瀬川'], [10.5, 160, '恩智川']],
  water: [], peaks: [[17, 3000, 642, 3500, false, '生駒山']], castles: [],
});
// Kyoto -> Nara on the same private railway (for the trip from Tokyo: change at Kyoto)
const YAMATO_KYOTO = leg({
  name: 'やまと京都線 特急', train: 'local', vmax: 105, scale: 1,
  stations: [['京都', 0], ['丹波橋', 6.1], ['大久保', 15.5], ['新田辺', 19.6], ['高の原', 30.4], ['大和西大寺', 34.6], ['奈良', 39.1]],
  zones: [[0, 'city'], [4, 'suburb'], [10, 'fields'], [28, 'suburb'], [36, 'city']],
  tunnels: [], rivers: [[8.2, 360, '宇治川'], [17.3, 420, '木津川']],
  water: [], peaks: [], castles: [],
});
/** The same leg run the other way: positions mirrored, left and right swapped. */
function reverse(L: Leg): Leg {
  const f = (s: number) => L.len - s;
  const zs = L.zones.map((q, i) => ({ s: f(i + 1 < L.zones.length ? L.zones[i + 1].s : L.len), z: q.z })).reverse(); zs[0].s = 0;
  return {
    ...L, stations: L.stations.map((q) => ({ name: q.name, s: f(q.s) })).reverse(), zones: zs,
    tunnels: L.tunnels.map((q) => ({ a: f(q.b), b: f(q.a), name: q.name })).reverse(), rivers: L.rivers.map((q) => ({ ...q, s: f(q.s) })).reverse(),
    water: L.water.map((q) => ({ a: f(q.b), b: f(q.a), side: -q.side, lake: q.lake })), peaks: L.peaks.map((q) => ({ ...q, s: f(q.s), off: -q.off })), castles: L.castles.map((q) => ({ s: f(q.s), side: -q.side })),
  };
}
/** Cut a leg short at a station (the trip from Tokyo to Nara changes trains at Kyoto). */
function cut(L: Leg, at: string): Leg {
  const end = L.stations.find((q) => q.name === at)!.s, keep = <T extends { s: number }>(a: T[]) => a.filter((q) => q.s <= end);
  return { ...L, len: end, stations: keep(L.stations), zones: keep(L.zones), tunnels: L.tunnels.filter((q) => q.b <= end), rivers: keep(L.rivers), water: L.water.filter((q) => q.a < end).map((q) => ({ ...q, b: Math.min(q.b, end) })), peaks: L.peaks, castles: keep(L.castles) };
}
/** The legs of the trip between two cities (none: no line between them, e.g. Naha). */
export function lineLegs(from: RegionId, to: RegionId): Leg[] | null {
  const k = from + '>' + to;
  switch (k) {
    case 'tokyo>osaka': return [TOKAIDO];
    case 'osaka>tokyo': return [reverse(TOKAIDO)];
    case 'osaka>fukuoka': return [SANYO];
    case 'fukuoka>osaka': return [reverse(SANYO)];
    case 'tokyo>fukuoka': return [TOKAIDO, SANYO];
    case 'fukuoka>tokyo': return [reverse(SANYO), reverse(TOKAIDO)];
    case 'osaka>nara': return [YAMATO];
    case 'nara>osaka': return [reverse(YAMATO)];
    case 'tokyo>nara': return [cut(TOKAIDO, '京都'), YAMATO_KYOTO];
    case 'nara>tokyo': return [reverse(YAMATO_KYOTO), reverse(cut(TOKAIDO, '京都'))];
    case 'fukuoka>nara': return [reverse(SANYO), YAMATO];
    case 'nara>fukuoka': return [reverse(YAMATO), SANYO];
  }
  return null;
}
export const LEGS = { TOKAIDO, SANYO, YAMATO, YAMATO_KYOTO };
