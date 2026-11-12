import * as THREE from 'three';
import { F } from './avatar';

/**
 * Appearance shared by the player, shop staff and every pedestrian: face, hair, clothes and accessories.
 * Luxury brands are original (fictional) houses: MAISON LAVELLE (monogram leather goods), SOLARE (Swiss
 * dive / dress watches) and AXEL VOSS (skeleton tonneau hyper-watches).
 */
export const SKINS = ['#f6d7c3', '#eec4a5', '#e0ac69', '#c98f66', '#b97a50', '#9a5f3c', '#7a4a2e', '#5a3420'];
export const HAIR_COLORS = ['#141012', '#2b1d16', '#4a2c1a', '#7a4a26', '#a8743a', '#d6b06a', '#e8dcc8', '#8a8a8e', '#b02a3a', '#3a5bd8'];
export const EYE_COLORS = ['#3a2416', '#5a3a1e', '#2f5d8a', '#4f7a3a', '#7a6a4a', '#5a6a7a'];
export const CLOTH = ['#f4f4f6', '#16161a', '#2a3550', '#5a6a80', '#8a2a2a', '#c0392b', '#ff3f93', '#2be4ff', '#3dffb0', '#ffd23a', '#c8b48a', '#6b4a2f', '#2f5d3a', '#6c5ce7', '#ff8a2a', '#9aa0a8'];
export const LIPS = ['', '#c0504a', '#a02040', '#d0707a', '#7a2a3a'];

export type HairStyle = 'bald' | 'buzz' | 'short' | 'side' | 'long' | 'pony' | 'bob' | 'curly' | 'bun';
export const HAIR_STYLES: HairStyle[] = ['bald', 'buzz', 'short', 'side', 'long', 'pony', 'bob', 'curly', 'bun'];
export const HAIR_NAMES: Record<HairStyle, string> = { bald: 'スキンヘッド', buzz: 'ベリーショート', short: 'ショート', side: 'サイドパート', long: 'ロング', pony: 'ポニーテール', bob: 'ボブ', curly: 'カーリー', bun: 'お団子' };
export type Beard = 'none' | 'stubble' | 'full' | 'mustache';
export const BEARDS: Beard[] = ['none', 'stubble', 'full', 'mustache'];
export const BEARD_NAMES: Record<Beard, string> = { none: 'なし', stubble: '無精ひげ', full: 'フルビアード', mustache: '口ひげ' };
export type Top = 'tee' | 'shirt' | 'hoodie' | 'blazer' | 'dress' | 'tank';
export const TOPS: Top[] = ['tee', 'shirt', 'hoodie', 'blazer', 'dress', 'tank'];
export const TOP_NAMES: Record<Top, string> = { tee: 'Tシャツ', shirt: 'シャツ', hoodie: 'パーカー', blazer: 'ジャケット', dress: 'ワンピース', tank: 'タンクトップ' };
export type Bottom = 'jeans' | 'slacks' | 'shorts' | 'skirt';
export const BOTTOMS: Bottom[] = ['jeans', 'slacks', 'shorts', 'skirt'];
export const BOTTOM_NAMES: Record<Bottom, string> = { jeans: 'デニム', slacks: 'スラックス', shorts: 'ショートパンツ', skirt: 'スカート' };
export type Hat = 'none' | 'cap' | 'beanie' | 'fedora';
export const HATS: Hat[] = ['none', 'cap', 'beanie', 'fedora'];
export const HAT_NAMES: Record<Hat, string> = { none: 'なし', cap: 'キャップ', beanie: 'ニット帽', fedora: '中折れ帽' };
export type Glasses = 'none' | 'shades' | 'round';
export const GLASSES: Glasses[] = ['none', 'shades', 'round'];
export const GLASSES_NAMES: Record<Glasses, string> = { none: 'なし', shades: 'サングラス', round: '丸メガネ' };

/** Shop items with a price. Base clothes are free; these must be bought once. */
export interface Item { id: string; slot: 'watch' | 'bag' | 'top' | 'hat' | 'shoes'; brand: string; name: string; price: number; desc: string; model: string }
export const ITEMS: Item[] = [
  { id: 'sol_mariner', slot: 'watch', brand: 'SOLARE', name: 'マリナー 41', price: 14500, desc: 'オイスタースチールのダイバーズ。グリーンベゼル。', model: 'diver_green' },
  { id: 'sol_blue', slot: 'watch', brand: 'SOLARE', name: 'マリナー ブルーゴールド', price: 32000, desc: 'イエローゴールド×ブルーダイヤル。', model: 'diver_bluegold' },
  { id: 'sol_pres', slot: 'watch', brand: 'SOLARE', name: 'プレジデンシャル 40', price: 48000, desc: '18Kイエローゴールドのドレスウォッチ。', model: 'dress_gold' },
  { id: 'sol_ice', slot: 'watch', brand: 'SOLARE', name: 'プレジデンシャル アイス', price: 95000, desc: 'プラチナにダイヤモンドを敷き詰めた一本。', model: 'dress_ice' },
  { id: 'av_01', slot: 'watch', brand: 'AXEL VOSS', name: 'AV-01 スケルトン・トノー', price: 320000, desc: '透けるムーブメントの超軽量トノー型。', model: 'tonneau_red' },
  { id: 'av_07', slot: 'watch', brand: 'AXEL VOSS', name: 'AV-07 カーボン トゥールビヨン', price: 480000, desc: 'カーボンケースのトゥールビヨン。限定モデル。', model: 'tonneau_carbon' },
  { id: 'ml_pochette', slot: 'bag', brand: 'MAISON LAVELLE', name: 'モノグラム ポシェット', price: 2400, desc: 'ブラウンのモノグラム・キャンバス。', model: 'pochette' },
  { id: 'ml_tote', slot: 'bag', brand: 'MAISON LAVELLE', name: 'モノグラム トート', price: 3600, desc: 'デイリーに使える大きめトート。', model: 'tote' },
  { id: 'ml_keep', slot: 'bag', brand: 'MAISON LAVELLE', name: 'キープオール 45', price: 4800, desc: '旅にも使えるボストンバッグ。', model: 'boston' },
  { id: 'ml_trunk', slot: 'bag', brand: 'MAISON LAVELLE', name: 'プティ・マル トランク', price: 12500, desc: 'トランク型のアイコンバッグ。', model: 'trunk' },
  { id: 'ml_jacket', slot: 'top', brand: 'MAISON LAVELLE', name: 'モノグラム ジャケット', price: 5800, desc: '全面モノグラムのジャケット。', model: 'mono_blazer' },
  { id: 'ml_cap', slot: 'hat', brand: 'MAISON LAVELLE', name: 'モノグラム キャップ', price: 900, desc: 'モノグラム柄のベースボールキャップ。', model: 'mono_cap' },
  { id: 'ml_sneak', slot: 'shoes', brand: 'MAISON LAVELLE', name: 'トレーナー スニーカー', price: 1400, desc: 'レザーのローカット。', model: 'mono_shoe' },
];
export const itemById = (id: string) => ITEMS.find((i) => i.id === id);

export interface Appearance {
  fem: boolean; height: number; // build: narrower shoulders / wider hips; height 0.94..1.06
  skin: number; face: number; eye: number; brow: number; lips: number; // face: shape preset 0..5, brow thickness 0..2, lips: lipstick index (0 none)
  hair: HairStyle; hairColor: number; beard: Beard;
  top: Top; topColor: number; bottom: Bottom; bottomColor: number; shoeColor: number;
  hat: Hat; hatColor: number; glasses: Glasses;
  watch: string; bag: string; // item ids or ''
  luxTop: boolean; luxHat: boolean; luxShoes: boolean; // wear the bought MAISON LAVELLE pieces
}
export const DEFAULT_LOOK: Appearance = {
  fem: true, height: 1, skin: 3, face: 1, eye: 0, brow: 1, lips: 1, hair: 'pony', hairColor: 0, beard: 'none',
  top: 'tee', topColor: 6, bottom: 'jeans', bottomColor: 2, shoeColor: 0, hat: 'none', hatColor: 1, glasses: 'none', watch: '', bag: '', luxTop: false, luxHat: false, luxShoes: false,
};
export function sanitizeLook(o: unknown): Appearance {
  const L = { ...DEFAULT_LOOK }, s = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>;
  const num = (k: keyof Appearance, max: number) => { const v = s[k]; if (typeof v === 'number' && Number.isFinite(v)) (L as any)[k] = Math.max(0, Math.min(max, Math.round(v))); };
  const one = <T extends string>(k: keyof Appearance, list: readonly T[]) => { if (list.includes(s[k] as T)) (L as any)[k] = s[k]; };
  L.fem = s.fem === undefined ? L.fem : !!s.fem; if (typeof s.height === 'number') L.height = Math.max(0.94, Math.min(1.06, s.height));
  num('skin', SKINS.length - 1); num('face', 5); num('eye', EYE_COLORS.length - 1); num('brow', 2); num('lips', LIPS.length - 1); num('hairColor', HAIR_COLORS.length - 1);
  num('topColor', CLOTH.length - 1); num('bottomColor', CLOTH.length - 1); num('shoeColor', CLOTH.length - 1); num('hatColor', CLOTH.length - 1);
  one('hair', HAIR_STYLES); one('beard', BEARDS); one('top', TOPS); one('bottom', BOTTOMS); one('hat', HATS); one('glasses', GLASSES);
  for (const k of ['watch', 'bag'] as const) if (typeof s[k] === 'string' && (s[k] === '' || itemById(s[k] as string))) L[k] = s[k] as string;
  for (const k of ['luxTop', 'luxHat', 'luxShoes'] as const) L[k] = !!s[k];
  return L;
}

/* ------------------------------------------------------------------ pedestrians: a full look from a seed, steered by the city's fashion mood */
export type CityStyle = 'mix' | 'casual' | 'business' | 'street' | 'luxury';
export const CITY_STYLE_NAMES: Record<CityStyle, string> = { mix: 'ミックス', casual: 'カジュアル', business: 'ビジネス', street: 'ストリート', luxury: 'ハイブランド' };
export const fashion = { style: 'mix' as CityStyle, ver: 0 };
export function setCityStyle(s: CityStyle) { fashion.style = s; fashion.ver++; }
/** Bumped whenever the player's look changes, so the 3D character is rebuilt. */
export const lookState = { ver: 0 };
const rnd = (seed: number, k: number) => { const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
export function lookFromSeed(seed: number, outfit = 0): Appearance {
  const r = (k: number) => rnd(seed, k), pick = <T,>(a: readonly T[], k: number) => a[Math.floor(r(k) * a.length) % a.length];
  const fem = r(1) < 0.5, mood = outfit === 4 ? 'business' : fashion.style === 'mix' ? (['casual', 'casual', 'business', 'street', 'luxury'] as const)[Math.floor(r(2) * 5)] : fashion.style; // outfit 4: a commuter in office clothes
  const L: Appearance = { ...DEFAULT_LOOK, fem, height: 0.95 + r(3) * 0.1, skin: Math.floor(r(4) * SKINS.length), face: Math.floor(r(5) * 6), eye: Math.floor(r(6) * EYE_COLORS.length), brow: Math.floor(r(7) * 3),
    lips: fem && r(8) < 0.7 ? 1 + Math.floor(r(9) * (LIPS.length - 1)) : 0, hairColor: r(10) < 0.85 ? Math.floor(r(11) * 6) : Math.floor(r(11) * HAIR_COLORS.length),
    hair: fem ? pick(['long', 'pony', 'bob', 'curly', 'bun', 'long', 'short'] as const, 12) : pick(['short', 'side', 'buzz', 'curly', 'bald', 'short', 'side'] as const, 12),
    beard: fem ? 'none' : pick(['none', 'none', 'stubble', 'full', 'mustache'] as const, 13), shoeColor: Math.floor(r(14) * CLOTH.length),
    hat: r(15) < 0.18 ? pick(['cap', 'beanie', 'fedora'] as const, 16) : 'none', hatColor: Math.floor(r(17) * CLOTH.length), glasses: r(18) < 0.22 ? pick(['shades', 'round'] as const, 19) : 'none',
    top: 'tee', topColor: Math.floor(r(20) * CLOTH.length), bottom: 'jeans', bottomColor: Math.floor(r(21) * CLOTH.length), watch: '', bag: '' };
  if (mood === 'business') { L.top = fem && r(22) < 0.4 ? 'dress' : pick(['blazer', 'shirt', 'blazer'] as const, 22); L.bottom = fem && r(23) < 0.4 ? 'skirt' : 'slacks'; L.topColor = pick([1, 2, 3, 15, 0] as const, 24); L.bottomColor = pick([1, 2, 3, 15] as const, 25); L.hat = 'none'; if (r(26) < 0.5) L.watch = pick(['sol_mariner', 'sol_pres'] as const, 27); }
  else if (mood === 'street') { L.top = pick(['hoodie', 'tee', 'hoodie', 'tank'] as const, 22); L.bottom = pick(['jeans', 'shorts', 'jeans'] as const, 23); if (r(24) < 0.4) L.hat = pick(['cap', 'beanie'] as const, 25); }
  else if (mood === 'luxury') { L.top = fem ? pick(['dress', 'blazer', 'shirt'] as const, 22) : pick(['blazer', 'shirt'] as const, 22); L.bottom = fem && r(23) < 0.5 ? 'skirt' : 'slacks'; L.watch = pick(['sol_mariner', 'sol_pres', 'sol_blue', 'av_01', 'sol_ice'] as const, 24); if (r(25) < 0.6) L.bag = pick(['ml_pochette', 'ml_tote', 'ml_keep', 'ml_trunk'] as const, 26); if (r(27) < 0.25) L.luxTop = L.top === 'blazer'; L.glasses = r(28) < 0.5 ? 'shades' : L.glasses; }
  else { L.top = fem ? pick(['tee', 'shirt', 'dress', 'tank', 'hoodie'] as const, 22) : pick(['tee', 'shirt', 'hoodie', 'tank', 'tee'] as const, 22); L.bottom = fem ? pick(['jeans', 'skirt', 'shorts', 'jeans'] as const, 23) : pick(['jeans', 'shorts', 'slacks', 'jeans'] as const, 23); if (r(24) < 0.12) L.bag = 'ml_pochette'; }
  if (L.top === 'dress' && L.bottom !== 'skirt') L.bottom = 'skirt';
  if (outfit === 1) { L.top = 'tank'; L.bottom = 'shorts'; L.hat = 'none'; L.watch = ''; L.bag = ''; L.glasses = r(29) < 0.5 ? 'shades' : 'none'; } // beachwear
  if (outfit === 3) { L.top = 'tank'; L.bottom = 'shorts'; L.hat = r(29) < 0.3 ? 'cap' : 'none'; L.bag = ''; } // running kit
  if (outfit === 2) { L.top = 'tee'; L.topColor = 14; L.bottom = 'slacks'; L.bottomColor = 3; L.hat = 'cap'; L.hatColor = 9; L.bag = ''; L.watch = ''; L.glasses = 'none'; } // dock worker (hi-vis, hard hat colour)
  return L;
}
/** Interior staff and passengers were authored as simple colour sets; turn one into a full look. */
export function lookFromColors(c: { skin: string; shirt: string; pants: string; shoe: string; hair: string }, seed = 1): Appearance {
  const L = lookFromSeed(seed * 7919 + 3), near = (hex: string, list: string[]) => { const a = new THREE.Color(hex); let bi = 0, bd = 1e9; list.forEach((h, i) => { const b = new THREE.Color(h), d = (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi; };
  return { ...L, skin: near(c.skin, SKINS), hairColor: near(c.hair, HAIR_COLORS), top: 'shirt', topColor: near(c.shirt, CLOTH), bottom: 'slacks', bottomColor: near(c.pants, CLOTH), shoeColor: near(c.shoe, CLOTH), hat: 'none', bag: '', watch: '', glasses: 'none' };
}

/* ------------------------------------------------------------------ textures */
const canvas = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
/**
 * Face painted on the head's UVs (front = u 0.25), on a white base that the skin colour multiplies.
 * Positions follow the sculpted head in headGeometry(): eyes at y 0.08, brows 0.25, nose tip -0.28, mouth -0.5, chin -0.8 (unit sphere).
 */
export interface FacePaint { brow: number; lips: number; liner: boolean; stubble: number; age: number; fem: boolean }
export function paintFace(c: CanvasRenderingContext2D, ox: number, oy: number, W: number, H: number, f: FacePaint) {
  const u = (x: number) => ox + (0.25 + Math.asin(Math.max(-1, Math.min(1, x))) / (2 * Math.PI)) * W, v = (y: number) => oy + (Math.acos(Math.max(-1, Math.min(1, y))) / Math.PI) * H;
  const k = W / 512, { ex, ey, by, ny, my, cy } = F;
  c.save(); c.beginPath(); c.rect(ox, oy, W, H); c.clip();
  c.fillStyle = '#ffffff'; c.fillRect(ox, oy, W, H);
  const blob = (x: number, y: number, rx: number, ry: number, rgb: string, a: number) => {
    const X = u(x), Y = v(y), R = Math.max(rx, ry) * k, g = c.createRadialGradient(X, Y, 0, X, Y, R); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    c.save(); c.translate(X, Y); c.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); c.translate(-X, -Y); c.fillStyle = g; c.beginPath(); c.arc(X, Y, R, 0, 7); c.fill(); c.restore();
  };
  const path = (pts: [number, number][], close = false) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(u(x), v(y)) : c.moveTo(u(x), v(y)))); if (close) c.closePath(); };
  const curve = (x0: number, y0: number, cx: number, cyy: number, x1: number, y1: number) => { c.beginPath(); c.moveTo(u(x0), v(y0)); c.quadraticCurveTo(u(cx), v(cyy), u(x1), v(y1)); };
  // contouring: temples, sockets, under the cheekbones, sides of the nose, jaw, under the lip; warmth on cheeks, nose tip and lips area
  for (const s of [-1, 1]) {
    blob(s * 0.7, by, 24, 34, '150,100,82', 0.26); blob(s * ex, ey + 0.02, 20, 13, '130,85,75', 0.32); blob(s * (ex - 0.14), ey - 0.01, 8, 10, '120,75,70', 0.28);
    blob(s * 0.56, -0.36, 22, 12, '150,95,80', 0.22); blob(s * 0.09, (ey + ny) / 2, 5, 22, '150,95,80', 0.2); blob(s * 0.62, F.my - 0.12, 24, 26, '150,100,85', 0.18);
    blob(s * 0.42, -0.24, 20, 13, '240,120,110', f.fem ? 0.26 : 0.12);
  }
  blob(0, ny + 0.03, 9, 6, '235,130,120', 0.14); blob(0, my - 0.16, 16, 6, '150,95,80', 0.26); blob(0, cy + 0.02, 44, 10, '150,100,85', 0.18);
  if (f.stubble > 0) {
    c.globalAlpha = 0.16 + f.stubble * 0.22; c.fillStyle = 'rgb(70,55,50)';
    path([[-0.7, -0.34], [-0.62, -0.7], [-0.3, -0.95], [0, -0.98], [0.3, -0.95], [0.62, -0.7], [0.7, -0.34], [0.3, my + 0.12], [0.12, ny - 0.06], [-0.12, ny - 0.06], [-0.3, my + 0.12]], true); c.fill();
    c.globalCompositeOperation = 'destination-out'; c.globalAlpha = 0.8; c.beginPath(); c.ellipse(u(0), v(my), 14 * k, 5 * k, 0, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  }
  // nose: nostrils, the shadow under the tip, a highlight on the bridge
  for (const s of [-1, 1]) { c.fillStyle = 'rgba(80,45,40,.6)'; c.beginPath(); c.ellipse(u(s * 0.06), v(ny - 0.035), 3 * k, 1.8 * k, s * 0.5, 0, 7); c.fill(); }
  blob(0, ny - 0.07, 11, 3.5, '130,80,70', 0.3); blob(0, (ey + ny) / 2, 3, 16, '255,255,255', 0.25);
  // eyes: lid crease, lash line (thicker on the outer corner), lower lid, inner corner; brows made of strokes
  for (const s of [-1, 1]) {
    const x = s * ex, w = 0.15;
    c.strokeStyle = 'rgba(115,70,60,.5)'; c.lineWidth = 1.8 * k; curve(x - s * w, ey + 0.035, x, ey + 0.16, x + s * w * 1.05, ey + 0.05); c.stroke();
    c.lineCap = 'round';
    c.strokeStyle = f.liner ? 'rgba(15,8,8,.98)' : 'rgba(35,20,18,.9)'; c.lineWidth = (f.liner ? 3.4 : 2.4) * k; curve(x - s * w, ey + 0.005, x, ey + 0.1, x + s * w * (f.liner ? 1.25 : 1.05), ey + (f.liner ? 0.055 : 0.02)); c.stroke();
    for (let i = 0; i < 9; i++) { const t = 0.15 + (i / 8) * 0.8, lx = x - s * w + s * 2 * w * t, ly = ey + 0.005 + Math.sin(t * Math.PI) * 0.06; c.strokeStyle = 'rgba(20,12,12,.75)'; c.lineWidth = (f.fem ? 1.6 : 1.1) * k; c.beginPath(); c.moveTo(u(lx), v(ly)); c.lineTo(u(lx + s * 0.02 * t), v(ly + (f.fem ? 0.05 : 0.03))); c.stroke(); }
    c.strokeStyle = 'rgba(110,70,62,.4)'; c.lineWidth = 1.4 * k; curve(x - s * w * 0.9, ey - 0.03, x, ey - 0.085, x + s * w * 0.95, ey - 0.025); c.stroke();
    blob(x - s * w * 0.95, ey - 0.005, 3, 3, '200,110,110', 0.5);
    if (f.age > 0.5) { c.strokeStyle = 'rgba(120,80,70,.35)'; c.lineWidth = 1 * k; for (const dy of [-0.03, 0, 0.03]) { c.beginPath(); c.moveTo(u(x + s * w * 1.15), v(ey + dy)); c.lineTo(u(x + s * w * 1.6), v(ey + dy * 2.2)); c.stroke(); } }
    const th = [1.8, 2.8, 4][f.brow] * k, b0 = x - s * 0.17, b1 = x + s * 0.2;
    for (let i = 0; i < 22; i++) { const t = i / 21, bx = b0 + (b1 - b0) * t, arch = Math.sin(Math.min(1, t * 1.3) * Math.PI * 0.85) * 0.045, yb = by + arch - t * 0.01; c.strokeStyle = `rgba(30,18,15,${0.45 + 0.4 * Math.sin(t * Math.PI)})`; c.lineWidth = th * (1.1 - t * 0.6); c.beginPath(); c.moveTo(u(bx), v(yb - 0.018)); c.lineTo(u(bx + s * 0.035), v(yb + 0.018)); c.stroke(); }
  }
  // lips: cupid's bow, fuller lower lip, corners, a soft highlight
  const lip = LIPS[f.lips] || (f.fem ? '#c47f76' : '#b8786e'), lw = f.fem ? 0.2 : 0.21;
  c.fillStyle = lip; c.globalAlpha = f.lips ? 0.95 : 0.75;
  c.beginPath(); c.moveTo(u(-lw), v(my)); c.quadraticCurveTo(u(-lw * 0.5), v(my + 0.055), u(-0.03), v(my + 0.045)); c.lineTo(u(0), v(my + 0.035)); c.lineTo(u(0.03), v(my + 0.045)); c.quadraticCurveTo(u(lw * 0.5), v(my + 0.055), u(lw), v(my)); c.quadraticCurveTo(u(0), v(my - 0.01), u(-lw), v(my)); c.fill();
  c.beginPath(); c.moveTo(u(-lw * 0.95), v(my - 0.005)); c.quadraticCurveTo(u(0), v(my - 0.02), u(lw * 0.95), v(my - 0.005)); c.quadraticCurveTo(u(lw * 0.6), v(my - 0.1), u(0), v(my - 0.105)); c.quadraticCurveTo(u(-lw * 0.6), v(my - 0.1), u(-lw * 0.95), v(my - 0.005)); c.fill();
  c.globalAlpha = 1; c.strokeStyle = 'rgba(80,35,35,.7)'; c.lineWidth = 1.6 * k; c.beginPath(); c.moveTo(u(-lw), v(my)); c.quadraticCurveTo(u(0), v(my - 0.018), u(lw), v(my)); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.ellipse(u(0.03), v(my - 0.06), 6 * k, 1.8 * k, 0, 0, 7); c.fill();
  if (f.age > 0.5) { c.strokeStyle = 'rgba(120,80,70,.32)'; c.lineWidth = 1.3 * k; for (const s of [-1, 1]) { curve(s * 0.15, ny - 0.04, s * 0.25, (ny + my) / 2, s * 0.24, my - 0.06); c.stroke(); } }
  c.restore();
}
let faceAtlas: THREE.CanvasTexture | null = null;
export const FACE_TILES = 4; // 4x4 variants for pedestrians
/** Pedestrian face variants: index = brow + 3 * (lips/liner/stubble/age variety). */
export function facePaintFor(i: number): FacePaint { return { brow: i % 3, lips: [0, 1, 2, 3, 0, 4, 0, 0, 1, 0, 3, 0, 0, 2, 0, 0][i % 16], liner: [false, true, true, false, false, true, false, false, true, false, false, false, false, true, false, false][i % 16], stubble: [0, 0, 0, 0, 0.6, 0, 1, 0.3, 0, 0, 0, 1, 0.6, 0, 0, 0][i % 16], age: [0, 0, 0, 0.3, 0, 0, 0.8, 0, 0, 0.9, 0, 0, 1, 0, 0.7, 0][i % 16], fem: [false, true, true, true, false, true, false, false, true, false, true, false, false, true, false, true][i % 16] }; }
export function faceAtlasTexture() {
  if (faceAtlas) return faceAtlas;
  const TW = 512, TH = 256, cv = canvas(TW * FACE_TILES, TH * FACE_TILES), c = cv.getContext('2d')!;
  for (let i = 0; i < FACE_TILES * FACE_TILES; i++) paintFace(c, (i % FACE_TILES) * TW, Math.floor(i / FACE_TILES) * TH, TW, TH, facePaintFor(i));
  faceAtlas = new THREE.CanvasTexture(cv); faceAtlas.colorSpace = THREE.SRGBColorSpace; faceAtlas.anisotropy = 4; return faceAtlas;
}
/** Index of the atlas face that fits a look. */
export function faceIndexFor(L: Appearance, seed: number) {
  const want = (i: number) => { const f = facePaintFor(i); return f.fem === L.fem && (L.beard === 'stubble' ? f.stubble > 0 : L.fem ? true : f.stubble === 0 || L.beard !== 'none') && (L.lips > 0) === (f.lips > 0); };
  const ok = Array.from({ length: 16 }, (_, i) => i).filter(want); return ok.length ? ok[seed % ok.length] : seed % 16;
}
export function playerFaceTexture(L: Appearance) {
  const cv = canvas(1024, 512), c = cv.getContext('2d')!;
  paintFace(c, 0, 0, 1024, 512, { brow: L.brow, lips: L.lips, liner: L.fem && L.lips > 0, stubble: L.beard === 'stubble' ? 0.8 : L.beard === 'full' ? 0.4 : 0, age: 0, fem: L.fem });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
/** Hair strands: fine light/dark streaks along v (top to bottom of the head), on white so the hair colour multiplies. */
let hairT: THREE.CanvasTexture | null = null;
export function hairTexture() {
  if (hairT) return hairT;
  const W = 512, H = 256, cv = canvas(W, H), c = cv.getContext('2d')!;
  c.fillStyle = '#bdbdbd'; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { const x = Math.random() * W, l = 20 + Math.random() * 90, y = Math.random() * H, b = Math.random(); c.strokeStyle = b < 0.5 ? `rgba(255,255,255,${0.15 + b * 0.5})` : `rgba(40,40,40,${(b - 0.5) * 0.5})`; c.lineWidth = 0.6 + Math.random() * 1.2; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + (Math.random() - 0.5) * 8, y + l / 2, x + (Math.random() - 0.5) * 6, y + l); c.stroke(); }
  hairT = new THREE.CanvasTexture(cv); hairT.colorSpace = THREE.SRGBColorSpace; hairT.wrapS = hairT.wrapT = THREE.RepeatWrapping; hairT.anisotropy = 4; return hairT;
}
/** Skin relief as a normal map on the same UVs as the face: pores, eyelid creases, smile lines, lip lines, brow hairs. */
let skinN: THREE.CanvasTexture | null = null;
export function skinNormalTexture() {
  if (skinN) return skinN;
  const W = 1024, H = 512, hc = canvas(W, H), c = hc.getContext('2d')!;
  c.fillStyle = 'rgb(128,128,128)'; c.fillRect(0, 0, W, H);
  const img = c.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 22; d[i] = d[i + 1] = d[i + 2] = 128 + n; } // pores
  c.putImageData(img, 0, 0);
  const u = (x: number) => (0.25 + Math.asin(Math.max(-1, Math.min(1, x))) / (2 * Math.PI)) * W, v = (y: number) => (Math.acos(Math.max(-1, Math.min(1, y))) / Math.PI) * H;
  c.lineCap = 'round';
  const line = (pts: [number, number][], w: number, col: string) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(u(x), v(y)) : c.moveTo(u(x), v(y)))); c.stroke(); };
  const { ex, ey, by, ny, my } = F;
  for (const s of [-1, 1]) {
    line([[s * (ex - 0.15), ey + 0.04], [s * ex, ey + 0.15], [s * (ex + 0.15), ey + 0.05]], 3, 'rgb(95,95,95)'); // upper lid crease
    line([[s * (ex - 0.12), ey - 0.04], [s * ex, ey - 0.08], [s * (ex + 0.13), ey - 0.03]], 2, 'rgb(105,105,105)'); // under-eye
    line([[s * 0.15, ny - 0.03], [s * 0.2, (ny + my) / 2], [s * 0.23, my - 0.04]], 4, 'rgb(100,100,100)'); // smile line
    for (let i = 0; i < 26; i++) { const t = i / 25, x = s * (ex - 0.17 + t * 0.37); line([[x, by + Math.sin(t * Math.PI) * 0.04], [x + s * 0.03, by + 0.02 + Math.sin(t * Math.PI) * 0.04]], 1.5, 'rgb(160,160,160)'); } // brow hairs
  }
  for (let i = -6; i <= 6; i++) line([[i * 0.025, my + 0.04], [i * 0.027, my - 0.09]], 1, 'rgb(112,112,112)'); // lip lines
  // height -> normal (Sobel)
  const src = c.getImageData(0, 0, W, H).data, out = c.createImageData(W, H), o = out.data, k = 2.2;
  const hgt = (x: number, y: number) => src[(((y + H) % H) * W + ((x + W) % W)) * 4] / 255;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (hgt(x + 1, y) - hgt(x - 1, y)) * k, dy = (hgt(x, y + 1) - hgt(x, y - 1)) * k, l = Math.hypot(dx, dy, 1), i = (y * W + x) * 4;
    o[i] = (-dx / l * 0.5 + 0.5) * 255; o[i + 1] = (dy / l * 0.5 + 0.5) * 255; o[i + 2] = (1 / l * 0.5 + 0.5) * 255; o[i + 3] = 255;
  }
  c.putImageData(out, 0, 0);
  skinN = new THREE.CanvasTexture(hc); skinN.anisotropy = 4; return skinN;
}
/** Skin: soft sheen at grazing angles (a cheap stand-in for light scattering under the skin), fine relief. */
export function skinMaterial(color: string, map: THREE.Texture | null, rough = 0.5) {
  return new THREE.MeshPhysicalMaterial({ color, map, roughness: rough, sheen: 0.3, sheenColor: new THREE.Color('#ff9f88'), sheenRoughness: 0.6, normalMap: skinNormalTexture(), normalScale: new THREE.Vector2(0.35, 0.35) });
}
/** Iris: coloured ring with radial fibres, dark pupil and a catch-light (white base, the iris colour multiplies). */
let irisTex: THREE.CanvasTexture | null = null;
export function irisTexture() {
  if (irisTex) return irisTex;
  // the iris sits on a spherical cap: canvas x = angle around the eye, canvas y = distance from the centre (top = pupil)
  const S = 128, cv = canvas(S, S), c = cv.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#050505'); g.addColorStop(0.36, '#050505'); g.addColorStop(0.4, '#9a9a9a'); g.addColorStop(0.7, '#ffffff'); g.addColorStop(0.88, '#8a8a8a'); g.addColorStop(0.97, '#2a2a2a'); g.addColorStop(1, '#1a1a1a');
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  for (let x = 0; x < S; x += 2) { c.strokeStyle = `rgba(${x % 6 ? 255 : 40},${x % 6 ? 255 : 40},${x % 6 ? 255 : 40},.22)`; c.lineWidth = 1; c.beginPath(); c.moveTo(x, S * 0.4); c.lineTo(x + (Math.random() - 0.5) * 3, S * 0.9); c.stroke(); }
  c.fillStyle = 'rgba(255,255,255,.95)'; c.fillRect(S * 0.12, S * 0.38, S * 0.1, S * 0.1);
  irisTex = new THREE.CanvasTexture(cv); irisTex.colorSpace = THREE.SRGBColorSpace; return irisTex;
}
/** MAISON LAVELLE monogram canvas: interlocked "ML" with four-petal flowers and diamonds, gold on brown. */
let mono: THREE.CanvasTexture | null = null;
export function monogramCanvas(size = 256) {
  const cv = canvas(size, size), c = cv.getContext('2d')!, s = size / 4;
  c.fillStyle = '#5a3a22'; c.fillRect(0, 0, size, size);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const x = (i + 0.5) * s + (j % 2 ? s / 2 : 0), y = (j + 0.5) * s, kind = (i + j) % 3;
    c.save(); c.translate(x % size, y); c.fillStyle = '#c9a25a'; c.strokeStyle = '#c9a25a';
    if (kind === 0) { c.font = `900 ${s * 0.42}px Georgia,serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('M', -s * 0.06, 0); c.font = `italic 900 ${s * 0.36}px Georgia,serif`; c.fillText('L', s * 0.1, s * 0.05); }
    else if (kind === 1) { for (let p = 0; p < 4; p++) { c.rotate(Math.PI / 2); c.beginPath(); c.ellipse(0, -s * 0.11, s * 0.06, s * 0.1, 0, 0, 7); c.fill(); } c.fillStyle = '#5a3a22'; c.beginPath(); c.arc(0, 0, s * 0.035, 0, 7); c.fill(); }
    else { c.rotate(Math.PI / 4); c.fillRect(-s * 0.09, -s * 0.09, s * 0.18, s * 0.18); c.fillStyle = '#5a3a22'; c.beginPath(); c.arc(0, 0, s * 0.06, 0, 7); c.fill(); c.fillStyle = '#c9a25a'; c.beginPath(); c.arc(0, 0, s * 0.03, 0, 7); c.fill(); }
    c.restore();
  }
  return cv;
}
export function monogramTexture() { if (mono) return mono; mono = new THREE.CanvasTexture(monogramCanvas()); mono.colorSpace = THREE.SRGBColorSpace; mono.wrapS = mono.wrapT = THREE.RepeatWrapping; return mono; }
/** The same canvas tiled finer, for clothing (capsule UVs wrap the whole garment once). */
const monoRep = new Map<string, THREE.Texture>();
export function monogramCloth(rx: number, ry: number) { const k = rx + 'x' + ry; let t = monoRep.get(k); if (!t) { t = monogramTexture().clone(); t.repeat.set(rx, ry); t.userData.shared = true; t.needsUpdate = true; monoRep.set(k, t); } return t; }
/** A watch drawn for the shop card (2D). */
export function drawWatch(c: CanvasRenderingContext2D, model: string, W: number, H: number) {
  c.clearRect(0, 0, W, H); const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.3;
  const gold = model.includes('gold') || model === 'dress_gold', ice = model === 'dress_ice', ton = model.startsWith('tonneau');
  const metal = ice ? '#e8eef4' : gold ? '#d4a53a' : model === 'tonneau_carbon' ? '#2a2a2e' : model === 'tonneau_red' ? '#d8d8dc' : '#c8ccd2';
  c.fillStyle = ton ? (model === 'tonneau_red' ? '#c0161c' : '#1a1a1e') : metal; c.fillRect(cx - R * 0.55, 0, R * 1.1, H); // strap / bracelet
  if (!ton) { c.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < H; y += 10) c.fillRect(cx - R * 0.55, y, R * 1.1, 2); }
  if (ton) { const w = R * 1.6, h = R * 2.1; c.fillStyle = metal; c.beginPath(); c.roundRect(cx - w / 2, cy - h / 2, w, h, R * 0.5); c.fill(); c.fillStyle = '#0d0d10'; c.beginPath(); c.roundRect(cx - w / 2 + 8, cy - h / 2 + 8, w - 16, h - 16, R * 0.4); c.fill();
    c.strokeStyle = '#8a8a90'; c.lineWidth = 2; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(cx + Math.cos(i) * R * 0.3, cy + Math.sin(i * 1.7) * R * 0.45, R * (0.12 + (i % 3) * 0.05), 0, 7); c.stroke(); }
    c.strokeStyle = '#c0161c'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx - R * 0.5, cy - R * 0.7); c.lineTo(cx + R * 0.5, cy + R * 0.7); c.stroke(); for (const [dx, dy] of [[-0.5, -0.8], [0.5, -0.8], [-0.5, 0.8], [0.5, 0.8]]) { c.fillStyle = '#9a9aa0'; c.beginPath(); c.arc(cx + dx * w * 0.8, cy + dy * h * 0.42, 3, 0, 7); c.fill(); } }
  else {
    c.fillStyle = metal; c.beginPath(); c.arc(cx, cy, R * 1.08, 0, 7); c.fill();
    const dial = model === 'diver_green' ? '#0e0e10' : model === 'diver_bluegold' ? '#1a3a8a' : ice ? '#dfe8f0' : '#e8d9b0';
    if (model.startsWith('diver')) { c.fillStyle = model === 'diver_green' ? '#0f6a3a' : '#1a3a8a'; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill(); c.fillStyle = '#e8e8e8'; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.fillRect(cx + Math.sin(a) * R * 0.88 - 1, cy - Math.cos(a) * R * 0.88 - 3, 2, 6); } }
    else { c.strokeStyle = ice ? '#ffffff' : '#b8862a'; c.lineWidth = 3; for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; c.beginPath(); c.moveTo(cx + Math.sin(a) * R * 0.86, cy - Math.cos(a) * R * 0.86); c.lineTo(cx + Math.sin(a) * R, cy - Math.cos(a) * R); c.stroke(); } }
    c.fillStyle = dial; c.beginPath(); c.arc(cx, cy, R * 0.78, 0, 7); c.fill();
    c.fillStyle = gold ? '#d4a53a' : '#f0f0f0'; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.beginPath(); c.arc(cx + Math.sin(a) * R * 0.64, cy - Math.cos(a) * R * 0.64, i % 3 ? 2.6 : 4, 0, 7); c.fill(); }
    if (ice) { c.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 40; i++) { const a = Math.random() * 7, rr = R * (0.86 + Math.random() * 0.2); c.fillRect(cx + Math.sin(a) * rr, cy - Math.cos(a) * rr, 2, 2); } }
    c.fillStyle = gold || dial === '#e8d9b0' ? '#3a2a10' : '#f0f0f0'; c.font = `700 ${R * 0.16}px Georgia,serif`; c.textAlign = 'center'; c.fillText('SOLARE', cx, cy - R * 0.25);
    c.strokeStyle = gold || dial === '#e8d9b0' ? '#3a2a10' : '#f4f4f4'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + R * 0.32, cy - R * 0.2); c.moveTo(cx, cy); c.lineTo(cx - R * 0.1, cy - R * 0.55); c.stroke();
  }
}
/** A bag drawn for the shop card (2D), on the monogram canvas. */
export function drawBag(c: CanvasRenderingContext2D, model: string, W: number, H: number) {
  c.clearRect(0, 0, W, H); const pat = c.createPattern(monogramCanvas(128), 'repeat')!;
  const box = (x: number, y: number, w: number, h: number, r: number) => { c.fillStyle = pat; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); c.strokeStyle = '#c9a25a'; c.lineWidth = 2; c.stroke(); };
  const handle = (x0: number, x1: number, y: number, hgt: number) => { c.strokeStyle = '#c8865a'; c.lineWidth = 5; c.beginPath(); c.moveTo(x0, y); c.quadraticCurveTo((x0 + x1) / 2, y - hgt, x1, y); c.stroke(); };
  if (model === 'pochette') { box(W * 0.2, H * 0.4, W * 0.6, H * 0.36, 8); c.strokeStyle = '#c9a25a'; c.lineWidth = 2; c.beginPath(); c.moveTo(W * 0.25, H * 0.4); c.quadraticCurveTo(W * 0.5, H * 0.1, W * 0.75, H * 0.4); c.stroke(); }
  else if (model === 'tote') { handle(W * 0.32, W * 0.48, H * 0.32, H * 0.22); handle(W * 0.52, W * 0.68, H * 0.32, H * 0.22); box(W * 0.2, H * 0.32, W * 0.6, H * 0.5, 4); }
  else if (model === 'boston') { handle(W * 0.35, W * 0.65, H * 0.36, H * 0.24); box(W * 0.12, H * 0.36, W * 0.76, H * 0.4, 30); c.fillStyle = '#c8865a'; c.fillRect(W * 0.12, H * 0.6, W * 0.76, 5); }
  else { handle(W * 0.4, W * 0.6, H * 0.3, H * 0.15); box(W * 0.22, H * 0.3, W * 0.56, H * 0.48, 6); c.fillStyle = '#c9a25a'; c.fillRect(W * 0.22, H * 0.42, W * 0.56, 4); for (const x of [0.26, 0.74]) c.fillRect(W * x - 3, H * 0.3, 6, H * 0.48); }
  c.fillStyle = '#c9a25a'; c.beginPath(); c.arc(W * 0.5, H * 0.55, 4, 0, 7); c.fill();
}
