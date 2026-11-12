import { lineLegs, LEGS } from '../../src/game/line/routes';
// track lengths and station spacing of the lines between the cities (km); a reversed trip must have the same gaps backwards
const km = (m: number) => +(m / 1000).toFixed(1);
const pairs = [['tokyo', 'osaka'], ['osaka', 'fukuoka'], ['tokyo', 'fukuoka'], ['osaka', 'nara'], ['tokyo', 'nara'], ['fukuoka', 'nara']] as const;
const out: Record<string, unknown> = {};
for (const [a, b] of pairs) {
  const f = lineLegs(a, b)!, r = lineLegs(b, a)!, len = (L: typeof f) => km(L.reduce((s, g) => s + g.len, 0));
  const gaps = (L: typeof f) => L.flatMap((g) => g.stations.slice(1).map((s, i) => km(s.s - g.stations[i].s)));
  const g1 = gaps(f), g2 = gaps(r).reverse();
  out[a + '>' + b] = { km: len(f), back: len(r), legs: f.map((g) => g.name), mirror: JSON.stringify(g1) === JSON.stringify(g2) };
}
const T = LEGS.TOKAIDO, st = (n: string) => km(T.stations.find((s) => s.name === n)!.s);
out.tokaido = { 東京_新横浜: st('新横浜'), 東京_名古屋: st('名古屋'), 名古屋_京都: +(st('京都') - st('名古屋')).toFixed(1), 京都_新大阪: +(km(T.len) - st('京都')).toFixed(1), fuji: T.peaks[0] };
console.log(JSON.stringify(out, null, 1));
