/**
 * Opening hours of the street shops, by kind of business ([opens, closes] on a 24 h clock; closes may run past
 * midnight). Convenience stores never close. A closed shop has its shutter down, turns you away at the door, and
 * the people in the street stop going in.
 */
export const HOURS: Record<string, [number, number] | null> = {
  konbini: null, // 24 時間
  ramen: [11, 26], cafe: [7, 21], bar: [18, 29], pharmacy: [9, 22], boutique: [10, 20.5], gym: [6, 23], electronics: [10, 21], books: [10, 21],
};
const fmt = (h: number) => { const hh = Math.floor(h) % 24, mm = Math.round((h - Math.floor(h)) * 60); return `${h >= 24 ? '翌' : ''}${hh}:${String(mm).padStart(2, '0')}`; };
/** Is a shop of this kind open at this hour (0..24)? */
export function shopOpen(key: string, hour: number): boolean {
  const H = HOURS[key]; if (!H) return true;
  const [o, c] = H; return c <= 24 ? hour >= o && hour < c : hour >= o || hour < c - 24;
}
/** "11:00〜翌2:00" (or 24時間営業). */
export const hoursText = (key: string) => { const H = HOURS[key]; return H ? `${fmt(H[0])}〜${fmt(H[1])}` : '24時間営業'; };
/** Opening and closing hour for the shutter shader: [opens, closes mod 24], or [0, 24] for a shop that never closes. */
export const hoursPair = (key: string): [number, number] => { const H = HOURS[key]; return H ? [H[0], H[1] % 24] : [0, 24]; };
