import { game, toast, save, progress } from '../state/store';
import { sfx } from '../audio';

/**
 * Shops you can actually use: the convenience store, the solo-booth ramen shop (meal ticket, then a seat),
 * the cafe, the bar, the pharmacy and the diner. Food heals; a few things can be carried and used later
 * (rice balls, energy drinks, first-aid kits). Every shop and product name here is made up.
 */
export type ItemId = 'onigiri' | 'energy' | 'medkit';
export const ITEMS: Record<ItemId, { name: string; icon: string; max: number; use: string }> = {
  onigiri: { name: 'おにぎり', icon: '🍙', max: 9, use: '体力+30' },
  energy: { name: 'エナジードリンク', icon: '⚡', max: 9, use: '60秒スタミナが減らない' },
  medkit: { name: '救急セット', icon: '🩹', max: 3, use: '体力全回復' },
};
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
/** Temporary effects, in seconds left: energy = sprinting costs no stamina, full = slow healing after a proper meal, tipsy = the camera sways. */
export const buffs = { energy: 0, full: 0, tipsy: 0 };

export interface Goods {
  id: string; name: string; sub: string; price: number;
  /** goes into your pocket instead of being eaten on the spot */ carry?: ItemId;
  heal?: number; stamina?: boolean; energy?: number; full?: number; tipsy?: number;
  /** a meal ticket: bought at the machine, eaten at a seat */ ticket?: boolean;
}
export interface ShopDef { title: string; note: string; goods: Goods[] }
export const SHOP_DEFS: Record<string, ShopDef> = {
  konbini: {
    title: 'コンビニ', note: 'おにぎりとエナジードリンクは持ち歩けます（画面右上のボタンで使う）。銃を構えてレジの前に立つと強盗になります。',
    goods: [
      { id: 'onigiri', name: 'おにぎり（ツナマヨ）', sub: '持ち歩き・食べると体力+30', price: 2, carry: 'onigiri' },
      { id: 'energy', name: 'エナジードリンク', sub: '持ち歩き・60秒スタミナが減らない', price: 4, carry: 'energy' },
      { id: 'karaage', name: 'からあげ（ホットスナック）', sub: 'その場で食べる・体力+45', price: 3, heal: 45 },
      { id: 'bento', name: '幕の内弁当', sub: 'その場で食べる・体力全回復', price: 7, heal: 100 },
      { id: 'tea', name: '緑茶', sub: 'その場で飲む・体力+15・スタミナ全回復', price: 2, heal: 15, stamina: true },
    ],
  },
  pharmacy: {
    title: 'ドラッグストア', note: '救急セットは3つまで持ち歩けます（画面右上のボタンで使う）。',
    goods: [
      { id: 'medkit', name: '救急セット', sub: '持ち歩き・使うと体力全回復', price: 25, carry: 'medkit' },
      { id: 'energy', name: 'エナジードリンク', sub: '持ち歩き・60秒スタミナが減らない', price: 4, carry: 'energy' },
      { id: 'vitamin', name: 'ビタミンゼリー', sub: 'その場で飲む・体力+25・スタミナ全回復', price: 3, heal: 25, stamina: true },
    ],
  },
  ramen: {
    title: '券売機', note: '食券を買ったら、空いている仕切り席（緑のランプ）に座ると食べられます。',
    goods: [
      { id: 'ramen', name: 'とんこつラーメン', sub: '体力全回復・満腹3分（体力がじわじわ回復）', price: 9, heal: 100, full: 180, ticket: true },
      { id: 'special', name: '特製ラーメン（味玉・チャーシュー増し）', sub: '体力全回復・満腹5分・60秒スタミナが減らない', price: 13, heal: 100, full: 300, energy: 60, ticket: true },
      { id: 'gyoza', name: '餃子セット', sub: '体力+60・満腹1分', price: 6, heal: 60, full: 60, ticket: true },
    ],
  },
  cafe: {
    title: 'カフェ', note: 'カウンターで注文して、その場でいただきます。',
    goods: [
      { id: 'coffee', name: 'ブレンドコーヒー', sub: 'スタミナ全回復・60秒スタミナが減らない', price: 3, stamina: true, energy: 60 },
      { id: 'latte', name: 'カフェラテ', sub: '体力+20・スタミナ全回復', price: 4, heal: 20, stamina: true },
      { id: 'cake', name: 'チーズケーキ', sub: '体力+50', price: 5, heal: 50 },
    ],
  },
  bar: {
    title: 'バー', note: 'お酒を飲むとしばらく視界がゆれます。',
    goods: [
      { id: 'beer', name: '生ビール', sub: '体力+20・ほろ酔い30秒', price: 5, heal: 20, tipsy: 30 },
      { id: 'highball', name: 'ハイボール', sub: '体力+25・ほろ酔い40秒', price: 6, heal: 25, tipsy: 40 },
      { id: 'nuts', name: 'ミックスナッツ', sub: '体力+15', price: 3, heal: 15 },
    ],
  },
  diner: {
    title: '食堂', note: 'カウンターで注文して、その場でいただきます。',
    goods: [
      { id: 'teishoku', name: '日替わり定食', sub: '体力全回復・満腹2分', price: 7, heal: 100, full: 120 },
      { id: 'curry', name: 'カレーライス', sub: '体力+70', price: 6, heal: 70 },
      { id: 'udon', name: 'かけうどん', sub: '体力+45', price: 4, heal: 45 },
    ],
  },
};

/** The meal ticket in your hand (ramen shop): bought at the machine, used up at a seat. */
export const meal = { ticket: null as Goods | null };

function consume(g: Goods) {
  if (g.heal) game.health = Math.min(100, game.health + g.heal);
  if (g.stamina) game.stamina = 100;
  if (g.energy) buffs.energy = Math.max(buffs.energy, g.energy);
  if (g.full) buffs.full = Math.max(buffs.full, g.full);
  if (g.tipsy) buffs.tipsy = Math.max(buffs.tipsy, g.tipsy);
}
/** Why this cannot be bought right now ('' = it can). */
export function cantBuy(g: Goods): string {
  if (game.money < g.price) return 'お金が足りない';
  if (g.carry && game.items[g.carry] >= ITEMS[g.carry].max) return `これ以上持てない（最大${ITEMS[g.carry].max}）`;
  if (g.ticket && meal.ticket) return '食券はもう持っている';
  return '';
}
/** Buy one. Returns the message to show (an error or what happened). */
export function buyGoods(shop: string, g: Goods): string {
  const why = cantBuy(g); if (why) { sfx('ui'); return why; }
  game.money -= g.price; sfx('buy', 0.6); progress.stats.flags['shop_' + shop] = 1;
  if (g.carry) { game.items[g.carry]++; save(); return `${ITEMS[g.carry].icon} ${g.name}を買った（所持 ${game.items[g.carry]}）`; }
  if (g.ticket) { meal.ticket = g; save(); return `🎫 食券「${g.name}」を買った。席に座ろう`; }
  consume(g); save();
  return `${g.name}をいただいた${g.heal ? `（体力${g.heal >= 100 ? '全回復' : '+' + g.heal}）` : ''}`;
}
/** Sit down with the ticket and eat. */
export function eatMeal() {
  const g = meal.ticket; if (!g) { toast('先に入口の券売機で食券を買おう', 2); sfx('ui'); return; }
  meal.ticket = null; consume(g); game.fadeT = 1.3; sfx('door', 0.5); progress.stats.flags.ramen = 1;
  setTimeout(() => { sfx('buy', 0.5); toast(`🍜 ${g.name}を完食。${g.heal && g.heal >= 100 ? '体力全回復' : '体力+' + g.heal}${g.full ? '・満腹' + Math.round(g.full / 60) + '分' : ''}`, 3); }, 900);
  save();
}
/** Use something from your pocket. */
export function useItem(id: ItemId) {
  if (game.items[id] <= 0) return;
  if ((id === 'onigiri' || id === 'medkit') && game.health >= 100) { toast('体力は満タン', 1.2); return; }
  game.items[id]--; sfx('buy', 0.4);
  if (id === 'onigiri') { game.health = Math.min(100, game.health + 30); toast('🍙 おにぎりを食べた（体力+30）', 1.6); }
  else if (id === 'medkit') { game.health = 100; toast('🩹 救急セットを使った（体力全回復）', 1.6); }
  else { buffs.energy = Math.max(buffs.energy, 60); game.stamina = 100; toast('⚡ エナジードリンクを飲んだ（60秒スタミナが減らない）', 1.8); }
  save();
}
/** Per frame: run the effect timers; a full stomach heals slowly. */
export function updateShops(dt: number) {
  if (!game.started) return;
  buffs.energy = Math.max(0, buffs.energy - dt); buffs.tipsy = Math.max(0, buffs.tipsy - dt);
  if (buffs.full > 0) { buffs.full = Math.max(0, buffs.full - dt); if (game.health > 0 && game.health < 100) game.health = Math.min(100, game.health + dt * 1.5); }
  if (meal.ticket && game.where === 'out') { game.money += meal.ticket.price; meal.ticket = null; toast('使わなかった食券は払い戻された', 2); } // the ticket is only good in the shop you bought it in
}
/** Sprinting costs no stamina while an energy drink or a coffee is working. */
export const freeSprint = () => buffs.energy > 0;
