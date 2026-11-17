/**
 * What a dish looks like when you eat it (EatScene draws it): the kind of vessel, the colours, the toppings.
 * startEat() plays the scene; the effect (health etc.) has already been applied by whoever calls it.
 */
export type DishKind = 'bowl' | 'plate' | 'hand' | 'drink' | 'tray' | 'can';
export interface Dish {
  kind: DishKind;
  /** soup / drink / filling colour */ c?: string;
  /** a second colour (noodles, rice, foam, crust) */ c2?: string;
  /** toppings on a bowl: chashu, egg, nori, negi, menma, beni (pickled ginger), naruto, tempura, shrimp, cheese, corn */ top?: string[];
  /** big emoji for hand-held food / tray food / plates */ icon?: string;
  /** a glass with foam (beer), a mug (coffee), a paper cup, a bottle */ cup?: 'glass' | 'mug' | 'paper' | 'bottle' | 'tea';
}
export const eatFx = { on: false, name: '', dish: null as Dish | null, note: '', t0: 0, dur: 3.4, ver: 0 };
/** Play the eating scene for a dish. */
export function startEat(name: string, dish: Dish, note = '') {
  eatFx.on = true; eatFx.name = name; eatFx.dish = dish; eatFx.note = note; eatFx.t0 = performance.now(); eatFx.ver++;
  eatFx.dur = dish.kind === 'drink' || dish.kind === 'can' ? 2.6 : dish.kind === 'hand' ? 2.8 : 3.6;
}
export const stopEat = () => { eatFx.on = false; eatFx.ver++; };

const BOWL = (c: string, c2: string, top: string[]): Dish => ({ kind: 'bowl', c, c2, top });
/** Dishes by name (shop goods, street stalls, vending drinks); anything unknown falls back by keyword. */
const D: Record<string, Dish> = {
  // ramen shop
  'とんこつラーメン': BOWL('#efe3c8', '#f3e6a6', ['chashu', 'negi', 'beni', 'nori']),
  '博多ラーメン': BOWL('#f1e6cf', '#f6edc0', ['chashu', 'negi', 'beni']),
  '特製ラーメン（味玉・チャーシュー増し）': BOWL('#ead9b6', '#f3e6a6', ['chashu', 'chashu', 'egg', 'nori', 'negi', 'menma']),
  '醤油ラーメン': BOWL('#8a5426', '#f0d98a', ['chashu', 'naruto', 'menma', 'nori', 'negi']),
  '味噌ラーメン': BOWL('#c0782f', '#f2cf6a', ['corn', 'chashu', 'negi', 'menma']),
  '塩ラーメン': BOWL('#e9dca2', '#f5e3a0', ['chashu', 'egg', 'negi']),
  'つけ麺': { kind: 'plate', icon: '🍜', c: '#6a3a1c' },
  '替え玉': BOWL('#efe3c8', '#f3e6a6', ['negi']),
  '餃子セット': { kind: 'plate', icon: '🥟' },
  'チャーハン': { kind: 'plate', icon: '🍚', c: '#e9c45a' },
  // konbini
  'からあげ（ホットスナック）': { kind: 'hand', icon: '🍗' },
  '肉まん': { kind: 'hand', icon: '🥟' },
  'おでん（大根・たまご・ちくわ）': { kind: 'bowl', c: '#d9b56a', c2: '#e8d9a8', top: ['egg', 'daikon', 'chikuwa'] },
  '幕の内弁当': { kind: 'plate', icon: '🍱' },
  'からあげ弁当': { kind: 'plate', icon: '🍱' },
  'カップ麺（お湯を入れて3分）': BOWL('#b0742c', '#f0d98a', ['negi', 'naruto']),
  'サンドイッチ': { kind: 'hand', icon: '🥪' },
  'プリン': { kind: 'hand', icon: '🍮' },
  'アイスクリーム': { kind: 'hand', icon: '🍦' },
  '緑茶': { kind: 'drink', cup: 'bottle', c: '#a8c45a' },
  'ホットコーヒー': { kind: 'drink', cup: 'paper', c: '#4a2a14' },
  // cafe / bar / diner / pharmacy
  'ブレンドコーヒー': { kind: 'drink', cup: 'mug', c: '#3a2212' },
  'カフェラテ': { kind: 'drink', cup: 'mug', c: '#c89a6a', c2: '#f4ead8' },
  '抹茶ラテ': { kind: 'drink', cup: 'mug', c: '#9cc06a', c2: '#eef4e0' },
  'チーズケーキ': { kind: 'hand', icon: '🍰' },
  'パンケーキ': { kind: 'plate', icon: '🥞' },
  '生ビール': { kind: 'drink', cup: 'glass', c: '#f2b42a', c2: '#fffaf0' },
  'ハイボール': { kind: 'drink', cup: 'glass', c: '#e8c86a', c2: '#ffffff' },
  'レモンサワー': { kind: 'drink', cup: 'glass', c: '#f4ec9a', c2: '#ffffff' },
  'ミックスナッツ': { kind: 'tray', icon: '🥜' },
  '焼き鳥（盛り合わせ）': { kind: 'tray', icon: '🍢' },
  '日替わり定食': { kind: 'plate', icon: '🍱' },
  'カレーライス': { kind: 'plate', icon: '🍛' },
  'かけうどん': BOWL('#d8b26a', '#f6f1e4', ['negi', 'kamaboko']),
  '天ぷらそば': BOWL('#6a4424', '#8a6a4a', ['tempura', 'negi']),
  'カツ丼': { kind: 'plate', icon: '🍲' },
  'ビタミンゼリー': { kind: 'drink', cup: 'bottle', c: '#f4c04a' },
  'スポーツドリンク': { kind: 'drink', cup: 'bottle', c: '#bfe3ff' },
  // street stalls
  'たこ焼き': { kind: 'tray', icon: '🐙' }, '串カツ': { kind: 'tray', icon: '🍢' }, 'お好み焼き': { kind: 'plate', icon: '🥞' }, 'いか焼き': { kind: 'hand', icon: '🦑' },
  '人形焼': { kind: 'tray', icon: '🧁' }, 'たい焼き': { kind: 'hand', icon: '🐟' }, '焼きそば': { kind: 'plate', icon: '🍝' }, 'もんじゃ焼き': { kind: 'plate', icon: '🥘' },
  'おでん': { kind: 'bowl', c: '#d9b56a', c2: '#e8d9a8', top: ['egg', 'daikon', 'chikuwa'] }, '焼きラーメン': { kind: 'plate', icon: '🍜' }, 'もつ鍋': { kind: 'bowl', c: '#c88a4a', c2: '#f1e4c0', top: ['negi', 'negi', 'cabbage'] },
  'サーターアンダギー': { kind: 'tray', icon: '🍩' }, '沖縄そば': BOWL('#e2c88e', '#f4e6b8', ['chashu', 'kamaboko', 'beni']), 'タコス': { kind: 'hand', icon: '🌮' }, '紅いもアイス': { kind: 'hand', icon: '🍨' },
  '柿の葉ずし': { kind: 'tray', icon: '🍣' }, '奈良漬けおにぎり': { kind: 'hand', icon: '🍙' }, 'くずもち': { kind: 'tray', icon: '🍡' }, '三輪そうめん': BOWL('#c8a46a', '#fbf8f0', ['negi', 'shiitake']),
  // pocket items
  'おにぎり': { kind: 'hand', icon: '🍙' }, 'エナジードリンク': { kind: 'can', c: '#2be47a' },
};
/** The dish for a name (exact, else by keyword). */
export function dishFor(name: string): Dish {
  if (D[name]) return D[name];
  if (/ラーメン|そば|うどん|そうめん/.test(name)) return BOWL('#c89a5a', '#f3e6a6', ['negi', 'chashu']);
  if (/コーヒー|ラテ|紅茶|ミルクティー|おしるこ|コーンスープ/.test(name)) return { kind: 'drink', cup: 'paper', c: '#6a3a1c' };
  if (/茶|水|サイダー|コーラ|ドリンク/.test(name)) return { kind: 'drink', cup: 'bottle', c: name.includes('コーラ') ? '#3a1a0a' : '#a8c4ff' };
  if (/ビール|サワー|酒|ハイボール/.test(name)) return { kind: 'drink', cup: 'glass', c: '#f2b42a', c2: '#fffaf0' };
  return { kind: 'plate', icon: '🍽️' };
}
