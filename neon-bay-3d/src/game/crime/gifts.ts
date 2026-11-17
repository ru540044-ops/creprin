import { REGION } from '../world/region';
import { game, toast, save, progress, ownedCars } from '../state/store';
import { VDEFS, VKind, mediumOf } from '../vehicles/defs';
import { playerCar, sellOwned } from '../vehicles/sim';
import { blocks, groundAt, floorAt, pointBlocked, isWater, PIER, BEACH_X, AIRPORT, PORT, CRUISE, HELIPADS, GARAGE, MARINA, JETPARK } from '../world/cityGen';
import { mulberry } from '../world/rng';
import { sfx } from '../audio';

/**
 * Gifts:
 *  - daily login gift (7-day streak, local date),
 *  - 30 hidden gift boxes in the world (collected ids saved),
 *  - gift cards: a code that carries cash or one of your vehicles to a friend (works offline, no server),
 *  - "運営ギフト": gifts the artifact owner sends to every player through the page's shared `db`
 *    (collection `gifts`, readable by every viewer, writable only by the owner; each device claims once).
 */

export type Reward = { cash?: number; vehicle?: VKind; ammo?: boolean; armor?: boolean; grenades?: number };

/* ---------------- capacity per medium (garage bays / marina berths / jet apron) */
export const capOf = (k: VKind) => { const m = mediumOf(k); return m === 'water' ? MARINA.slots.length : m === 'air' ? JETPARK.slots.length : GARAGE.slots.length; };
export const usedOf = (k: VKind) => { const m = mediumOf(k); return ownedCars.filter((o) => mediumOf(o.kind) === m).length; };
export const hasRoom = (k: VKind) => usedOf(k) < capOf(k);
export const homeName = (k: VKind) => { const m = mediumOf(k); return m === 'water' ? 'マリーナ' : m === 'air' ? '空港の駐機場' : 'ガレージ'; };

/** Apply a reward; returns a short description of what was received. */
export function grant(r: Reward): string {
  const out: string[] = [];
  if (r.cash) { game.money += r.cash; out.push('$' + r.cash.toLocaleString('en-US')); }
  if (r.vehicle && VDEFS[r.vehicle]) {
    const d = VDEFS[r.vehicle];
    if (hasRoom(r.vehicle)) { ownedCars.push({ kind: r.vehicle, color: d.colors[0] }); out.push(d.name + '（' + homeName(r.vehicle) + 'に納車）'); }
    else { const c = Math.round(d.price * 0.5); game.money += c; out.push(d.name + ' → 置き場が満杯のため $' + c.toLocaleString('en-US') + ' に換金'); }
  }
  if (r.ammo) { game.arms.ammo.pistol += 60; game.arms.ammo.smg += 120; out.push('弾薬パック（ピストル60・SMG120）'); }
  if (r.armor) { game.arms.armor = 100; out.push('防弾ベスト'); }
  if (r.grenades) { game.arms.ammo.grenade += r.grenades; out.push('手榴弾×' + r.grenades); }
  save();
  return out.join(' + ');
}
export const rewardLabel = (r: Reward) => [r.cash ? '$' + r.cash.toLocaleString('en-US') : '', r.vehicle ? VDEFS[r.vehicle]?.name || '' : '', r.ammo ? '弾薬パック' : '', r.armor ? '防弾ベスト' : '', r.grenades ? '手榴弾×' + r.grenades : ''].filter(Boolean).join(' + ');

/* ---------------- daily login gift */
export const DAILY: Reward[] = [{ cash: 1000 }, { ammo: true }, { cash: 3000 }, { armor: true, grenades: 3 }, { cash: 7500 }, { cash: 15000 }, { vehicle: 'jetski', cash: 5000 }];
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Streak state for today: which day (1..7) would be claimed now, and whether it is still unclaimed. */
export function dailyState() {
  const now = new Date(), today = dayKey(now), y = new Date(now.getTime() - 86400000), yest = dayKey(y), g = progress.gift;
  if (g.last === today) return { can: false, day: g.streak, today };
  const day = g.last === yest ? (g.streak % 7) + 1 : 1;
  return { can: true, day, today };
}
export function claimDaily(): string | null {
  const s = dailyState(); if (!s.can) return null;
  progress.gift.last = s.today; progress.gift.streak = s.day;
  const got = grant(DAILY[s.day - 1]); sfx('buy'); toast(`🎁 ログインボーナス ${s.day}日目：${got}`, 3.2); return got;
}

/* ---------------- hidden gift boxes */
export interface GiftBox { id: number; x: number; y: number; z: number; hint: string }
let _boxes: GiftBox[] | null = null;
const free = (x: number, y: number, z: number) => (y > 1 || !isWater(x, z)) && !pointBlocked(x, y + 0.6, z) && !pointBlocked(x, y + 1.5, z);
export function giftBoxes(): GiftBox[] {
  if (_boxes) return _boxes;
  const out: GiftBox[] = [];
  const add = (x: number, z: number, hint: string, y?: number) => { const yy = y ?? groundAt(x, z); if (free(x, yy, z) && !out.some((b) => Math.hypot(b.x - x, b.z - z) < 25)) out.push({ id: REGION.idx * 1000 + out.length, x, y: yy, z, hint }); };
  // landmarks first: pier end, beaches, airport, port, cruise ship sun deck, rooftop helipad
  add(PIER.x1 - 8, (PIER.z0 + PIER.z1) / 2, '桟橋の先端', PIER.y);
  add(BEACH_X + 22, -220, '南のビーチ'); add(BEACH_X + 22, 260, '北のビーチ');
  add(AIRPORT.x0 + 520, 150, '空港のエプロン'); add(PORT.x0 + 120, PORT.z0 + 90, '港のコンテナヤード');
  { const x = (CRUISE.x0 + CRUISE.x1) / 2 + 30, z = (CRUISE.z0 + CRUISE.z1) / 2, y = floorAt(x, z, CRUISE.sun + 6); if (y > 5) add(x, z, '豪華客船のサンデッキ', y); }
  for (const h of HELIPADS) if (h.y > 10) add(h.x + 7, h.z + 7, '高層ビル屋上のヘリパッド', h.y);
  // the rest on sidewalks and in parks around the city, spread out
  const R = mulberry(20261108), idx = blocks.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  for (const bi of idx) {
    if (out.length >= 60) break;
    const b = blocks[bi], cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    if (out.some((q) => Math.hypot(q.x - cx, q.z - cz) < 120)) continue;
    const hint = b.zone === 'park' ? '公園の中' : b.zone === 'downtown' ? REGION.names.downtown + 'の歩道' : b.zone === 'industrial' ? '工業地帯の歩道' : b.zone === 'residential' ? '住宅街の歩道' : '街角の歩道';
    const cand = b.zone === 'park' ? [[cx, cz], [cx + 12, cz - 9]] : [[b.x0 + 2.2, b.z0 + 2.2], [b.x1 - 2.2, b.z1 - 2.2], [b.x0 + 2.2, b.z1 - 2.2], [b.x1 - 2.2, b.z0 + 2.2]];
    const n0 = out.length; for (const [x, z] of cand) { add(x, z, hint); if (out.length > n0) break; }
  }
  _boxes = out; return out;
}
const boxReward = (id: number): Reward => {
  const R = mulberry(id * 7919 + 13), r = R();
  if (r < 0.6) return { cash: 1000 + Math.floor(R() * 10) * 500 };
  if (r < 0.75) return { ammo: true, cash: 500 };
  if (r < 0.9) return { armor: true, cash: 500 };
  return { grenades: 3, cash: 1000 };
};
const FINAL: Reward = { vehicle: 'formula', cash: 50000 };
const MILESTONE: Record<number, Reward> = { 10: { cash: 25000 }, 25: { cash: 75000 }, 40: { cash: 150000 } };
/** Boxes found in this city (ids are city index * 1000 + n). */
export const boxesFound = () => progress.gift.boxes.filter((id) => Math.floor(id / 1000) === REGION.idx).length;
export const boxesLeft = () => giftBoxes().filter((b) => !progress.gift.boxes.includes(b.id));
export function nearestBox(x: number, z: number) { let best: GiftBox | null = null, bd = 1e9; for (const b of boxesLeft()) { const d = Math.hypot(b.x - x, b.z - z); if (d < bd) { bd = d; best = b; } } return best; }

let scanT = 0;
/** Pick up gift boxes the player walks (or drives) into. */
export function updateGifts(dt: number) {
  if (!game.started || game.where !== 'out') return;
  scanT -= dt; if (scanT > 0) return; scanT = 0.15;
  const me = playerCar(), p = game.player, R = me ? 3.6 : 1.9;
  for (const b of giftBoxes()) {
    if (progress.gift.boxes.includes(b.id)) continue;
    if (Math.abs(b.x - p.x) > R || Math.abs(b.z - p.z) > R || Math.abs(b.y - p.y) > 2.6 || Math.hypot(b.x - p.x, b.z - p.z) > R) continue;
    progress.gift.boxes.push(b.id);
    const n = boxesFound(), total = giftBoxes().length;
    let msg = `🎁 ギフトボックス ${n}/${total}：` + grant(boxReward(b.id));
    if (n === total) msg += '　★コンプリート：' + grant(FINAL);
    else if (MILESTONE[n]) msg += `　★${n}個達成ボーナス：` + grant(MILESTONE[n]);
    sfx('buy'); toast(msg, 3.6);
    if (game.waypoint && Math.hypot(game.waypoint.x - b.x, game.waypoint.z - b.z) < 3) game.waypoint = null;
  }
}

/* ---------------- gift cards (codes) */
const ALPHA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CARD_CASH = [1000, 5000, 10000, 50000, 100000, 500000, 1000000];
// fixed order: indices are part of issued codes, so only ever append
export const CARD_KINDS: VKind[] = ['sedan', 'sport', 'super', 'suv', 'truck', 'bike', 'police', 'armored', 'hyper', 'muscle', 'hatch', 'pickup', 'taxi', 'heli', 'limo', 'formula', 'jetski', 'speedboat', 'yacht', 'jet'];
const ck = (n: number) => { let h = 2166136261; const s = 'nb3d-gift:' + n; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h & 0xffff; };
function encode(type: number, val: number): string {
  const rnd = Math.floor(Math.random() * 1048576), payload = type * 67108864 + val * 1048576 + rnd;
  let n = payload * 65536 + ck(payload), s = '';
  for (let i = 0; i < 9; i++) { s = ALPHA[n % 32] + s; n = Math.floor(n / 32); }
  return 'NB-' + s.slice(0, 3) + '-' + s.slice(3, 6) + '-' + s.slice(6);
}
function decode(code: string): { type: number; val: number; key: string } | null {
  const s = code.toUpperCase().replace(/^NB/, '').replace(/[^0-9A-Z]/g, '');
  if (s.length !== 9) return null;
  let n = 0; for (const c of s) { const k = ALPHA.indexOf(c); if (k < 0) return null; n = n * 32 + k; }
  const payload = Math.floor(n / 65536), c = n % 65536; if (ck(payload) !== c) return null;
  const type = Math.floor(payload / 67108864), val = Math.floor(payload / 1048576) % 64;
  return { type, val, key: s };
}
/** Make a card worth `cash` (deducted now). */
export function makeCashCard(tier: number): string | null {
  const v = CARD_CASH[tier]; if (v === undefined || game.money < v) return null;
  game.money -= v; const code = encode(0, tier); progress.gift.made.push(code.replace(/[^0-9A-Z]/g, '').slice(2)); save(); sfx('buy'); return code;
}
/** Make a card carrying owned vehicle #i (the vehicle leaves your garage). */
export function makeVehicleCard(i: number): string | null {
  const o = ownedCars[i]; if (!o) return null; const k = CARD_KINDS.indexOf(o.kind); if (k < 0) return null;
  const me = playerCar(); if (me && me.owned === i) return null;
  sellOwned(i); const code = encode(1, k); progress.gift.made.push(code.replace(/[^0-9A-Z]/g, '').slice(2)); save(); sfx('buy'); return code;
}
export function redeemCard(code: string): { ok: boolean; msg: string } {
  const d = decode(code.trim()); if (!d) return { ok: false, msg: 'コードが正しくありません（12文字・英数字）' };
  if (progress.gift.made.includes(d.key)) return { ok: false, msg: '自分で作ったカードは使えません（友達に送ってね）' };
  if (progress.gift.used.includes(d.key)) return { ok: false, msg: 'このカードは使用済みです' };
  let r: Reward;
  if (d.type === 0 && CARD_CASH[d.val] !== undefined) r = { cash: CARD_CASH[d.val] };
  else if (d.type === 1 && CARD_KINDS[d.val]) r = { vehicle: CARD_KINDS[d.val] };
  else return { ok: false, msg: 'コードが正しくありません' };
  progress.gift.used.push(d.key); const got = grant(r); sfx('buy'); return { ok: true, msg: '受け取った：' + got };
}

/* ---------------- 運営ギフト (owner → every player, through the page's shared db) */
export interface NetGift { id: string; title: string; msg: string; reward: Reward; at: number }
type Snap = { docs: { id: string; data(): Record<string, unknown> | undefined }[] };
type Coll = { orderBy(f: string, d?: string): Coll; limit(n: number): Coll; onSnapshot(n: (s: Snap) => void, e?: (er: { code: string }) => void): () => void; add(d: Record<string, unknown>): Promise<unknown>; doc(id: string): { delete(): Promise<void> } };
type DB = { collection(p: string): Coll };
export const net = { state: 'off' as 'off' | 'loading' | 'ready' | 'error', list: [] as NetGift[], db: null as DB | null, seen: new Set<string>() };
const okKind = (k: unknown): k is VKind => typeof k === 'string' && k in VDEFS;
function parseGift(id: string, d: Record<string, unknown> | undefined): NetGift | null {
  if (!d) return null;
  const cash = Math.max(0, Math.min(10_000_000, Math.round(Number(d.cash) || 0))), vehicle = okKind(d.vehicle) ? d.vehicle : undefined;
  const reward: Reward = { cash: cash || undefined, vehicle, ammo: d.ammo === true || undefined, armor: d.armor === true || undefined, grenades: Math.max(0, Math.min(20, Math.round(Number(d.grenades) || 0))) || undefined };
  if (!reward.cash && !reward.vehicle && !reward.ammo && !reward.armor && !reward.grenades) return null;
  return { id, title: String(d.title || 'ギフト').slice(0, 40), msg: String(d.msg || '').slice(0, 120), reward, at: Number(d.at) || 0 };
}
export const unclaimed = () => net.list.filter((g) => !progress.gift.claimed.includes(g.id));
export async function initNetGifts() {
  try {
    const c = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
    if (!c?.use) return;
    net.state = 'loading';
    const db = (await c.use('db')) as DB | null; if (!db) { net.state = 'off'; return; }
    net.db = db;
    const t = setTimeout(() => { if (net.state === 'loading') net.state = 'error'; }, 10000);
    db.collection('gifts').orderBy('at', 'desc').limit(30).onSnapshot((s) => {
      clearTimeout(t); net.state = 'ready';
      net.list = s.docs.map((d) => parseGift(d.id, d.data())).filter((g): g is NetGift => !!g);
      const fresh = unclaimed().filter((g) => !net.seen.has(g.id)); for (const g of net.list) net.seen.add(g.id);
      if (fresh.length && game.started) toast(`🎁 運営からギフトが届いた：${fresh[0].title}（スマホ →「ギフト」）`, 3.4);
    }, () => { clearTimeout(t); net.state = 'error'; });
  } catch { net.state = 'off'; }
}
export function claimNet(id: string): string | null {
  const g = net.list.find((q) => q.id === id); if (!g || progress.gift.claimed.includes(id)) return null;
  progress.gift.claimed.push(id); const got = grant(g.reward); sfx('buy'); toast('🎁 ' + g.title + '：' + got, 3); return got;
}
/** Owner only: the db rules reject writes from anyone else. */
export async function sendNetGift(title: string, msg: string, reward: Reward): Promise<string | null> {
  if (!net.db) return 'この画面では共有データが使えません（claude.ai で開いてください）';
  try { await net.db.collection('gifts').add({ title: title.slice(0, 40) || 'ギフト', msg: msg.slice(0, 120), at: Date.now(), cash: reward.cash || 0, vehicle: reward.vehicle || '', ammo: !!reward.ammo, armor: !!reward.armor, grenades: reward.grenades || 0 }); return null; }
  catch (e) { const code = (e as { code?: string })?.code; return code === 'invalid_argument' ? '送信できません（オーナーのみ配布できます）' : code === 'quota_exceeded' ? '保存容量が一杯です（古いギフトを削除してください）' : '送信に失敗しました（' + (code || 'error') + '）'; }
}
export async function deleteNetGift(id: string): Promise<boolean> { if (!net.db) return false; try { await net.db.collection('gifts').doc(id).delete(); return true; } catch { return false; } }
