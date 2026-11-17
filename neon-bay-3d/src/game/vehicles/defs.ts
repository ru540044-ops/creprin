/** Vehicle catalogue. Units: meters, m/s, m/s^2, kg. */
export type VKind = 'sedan' | 'sport' | 'super' | 'suv' | 'truck' | 'bike' | 'police' | 'armored' | 'hyper' | 'muscle' | 'hatch' | 'pickup' | 'taxi' | 'heli' | 'limo' | 'formula' | 'jetski' | 'speedboat' | 'yacht' | 'jet' | 'shinkansen';
export const isRail = (k: string) => k === 'shinkansen';
export const isBoat = (k: string) => k === 'jetski' || k === 'speedboat' || k === 'yacht';
export const isAir = (k: string) => k === 'heli' || k === 'jet';
export type Medium = 'land' | 'water' | 'air';
export const mediumOf = (k: string): Medium => (isBoat(k) ? 'water' : k === 'jet' ? 'air' : 'land');
/** Bay Customs upgrades carried by a car. */
export interface Mods { engine: number; armor: number; nitro: boolean; neon: string; finish: 'gloss' | 'matte' | 'chrome' | 'pearl'; tint: boolean; wheel: string }
export const stockMods = (): Mods => ({ engine: 0, armor: 0, nitro: false, neon: '', finish: 'gloss', tint: false, wheel: '' });
export interface VDef {
  kind: VKind; name: string; price: number; len: number; wid: number; hgt: number; wheelbase: number; wheelR: number;
  mass: number; accel: number; top: number; brake: number; grip: number; steer: number; hp: number; colors: string[]; blurb: string; colR?: number;
}
export const VDEFS: Record<VKind, VDef> = {
  sedan: { kind: 'sedan', name: 'Corsa Lune', price: 6000, len: 4.7, wid: 1.85, hgt: 1.45, wheelbase: 2.75, wheelR: 0.34, mass: 1450, accel: 5.2, top: 52, brake: 9, grip: 1.0, steer: 0.55, hp: 100, colors: ['#3f6fb5', '#d8d8de', '#2b2b30', '#8a1f2b', '#c9a24a', '#3d6b4a'], blurb: '素直で扱いやすい4ドア。' },
  sport: { kind: 'sport', name: 'Stingline GT', price: 18000, len: 4.5, wid: 1.9, hgt: 1.25, wheelbase: 2.6, wheelR: 0.34, mass: 1350, accel: 8.0, top: 68, brake: 10.5, grip: 1.18, steer: 0.58, hp: 90, colors: ['#ff3f93', '#2be4ff', '#ffd23a', '#e8141c', '#f4f4ff'], blurb: '軽くてドリフトしやすいクーペ。' },
  super: { kind: 'super', name: 'Taurino V12', price: 45000, len: 4.6, wid: 2.0, hgt: 1.12, wheelbase: 2.7, wheelR: 0.35, mass: 1500, accel: 11, top: 88, brake: 12, grip: 1.4, steer: 0.55, hp: 90, colors: ['#9dff3a', '#ffd23a', '#ff6a00', '#e8141c', '#f4f4ff', '#141414'], blurb: 'くさび形のV12。加速は暴力的。' },
  suv: { kind: 'suv', name: 'Tidewater', price: 9000, len: 4.9, wid: 2.0, hgt: 1.85, wheelbase: 2.9, wheelR: 0.4, mass: 2200, accel: 4.6, top: 50, brake: 8, grip: 0.92, steer: 0.5, hp: 140, colors: ['#1d1f26', '#e8e8f0', '#5a6b7a', '#7a2a2a', '#c8b48a'], blurb: '大きくて頑丈。段差も気にしない。' },
  truck: { kind: 'truck', name: 'Haulmark Box', price: 7000, len: 7.2, wid: 2.4, hgt: 3.1, wheelbase: 4.4, wheelR: 0.48, mass: 6500, accel: 2.6, top: 34, brake: 6, grip: 0.8, steer: 0.45, hp: 220, colors: ['#e9e6df', '#2f5f9a', '#c94f2a'], blurb: '箱型トラック。遅いが簡単には壊れない。' },
  bike: { kind: 'bike', name: 'Viper 600', price: 8000, len: 2.1, wid: 0.75, hgt: 1.15, wheelbase: 1.42, wheelR: 0.32, mass: 220, accel: 9.5, top: 72, brake: 11, grip: 1.15, steer: 0.62, hp: 60, colors: ['#e8141c', '#141414', '#2be4ff', '#ffd23a'], blurb: '速くて小回りがきく。転ぶと痛い。' },
  police: { kind: 'police', name: 'Bay PD Interceptor', price: 0, len: 4.8, wid: 1.9, hgt: 1.5, wheelbase: 2.8, wheelR: 0.35, mass: 1700, accel: 7.6, top: 60, brake: 10.5, grip: 1.15, steer: 0.56, hp: 150, colors: ['#15171c'], blurb: '警察車両。' },
  armored: { kind: 'armored', name: '現金輸送車', price: 0, len: 6.6, wid: 2.4, hgt: 2.9, wheelbase: 4.0, wheelR: 0.48, mass: 7200, accel: 2.8, top: 30, brake: 6, grip: 0.85, steer: 0.45, hp: 400, colors: ['#3e4650'], blurb: '現金を運ぶ装甲トラック。' },
  hyper: { kind: 'hyper', name: 'Zentora X', price: 120000, len: 4.7, wid: 2.05, hgt: 1.08, wheelbase: 2.75, wheelR: 0.36, mass: 1450, accel: 13, top: 104, brake: 13, grip: 1.55, steer: 0.55, hp: 85, colors: ['#ff2a6a', '#00e1ff', '#f4f4ff', '#141414', '#ffd23a', '#7a00ff'], blurb: '最高速370km/h超えのハイパーカー。' },
  muscle: { kind: 'muscle', name: 'Brawler 69', price: 22000, len: 4.95, wid: 1.95, hgt: 1.32, wheelbase: 2.9, wheelR: 0.37, mass: 1650, accel: 8.6, top: 70, brake: 9, grip: 0.98, steer: 0.5, hp: 120, colors: ['#e8141c', '#141414', '#ff8a00', '#2f5f9a', '#3d6b4a'], blurb: 'V8の暴れ馬。リアがよく滑る。' },
  hatch: { kind: 'hatch', name: 'Pico', price: 3500, len: 3.8, wid: 1.72, hgt: 1.5, wheelbase: 2.45, wheelR: 0.3, mass: 1050, accel: 5.6, top: 46, brake: 9.5, grip: 1.05, steer: 0.62, hp: 85, colors: ['#9dff3a', '#ff6a9a', '#2be4ff', '#f4f4ff', '#ffd23a'], blurb: '小さくて小回り抜群。' },
  pickup: { kind: 'pickup', name: 'Ridgeback', price: 12000, len: 5.3, wid: 2.0, hgt: 1.85, wheelbase: 3.2, wheelR: 0.42, mass: 2300, accel: 5.2, top: 52, brake: 8, grip: 0.95, steer: 0.5, hp: 150, colors: ['#8a1f2b', '#2b2b30', '#c8b48a', '#e8e8f0', '#3d6b4a'], blurb: 'タフなピックアップトラック。' },
  taxi: { kind: 'taxi', name: 'Bay Cab', price: 5000, len: 4.7, wid: 1.85, hgt: 1.45, wheelbase: 2.75, wheelR: 0.34, mass: 1500, accel: 5.4, top: 52, brake: 9, grip: 1.0, steer: 0.55, hp: 110, colors: ['#ffcc00'], blurb: 'タクシー。乗るとタクシーの仕事ができる。' },
  heli: { kind: 'heli', name: 'Skylark H2', price: 150000, len: 10, wid: 2.3, hgt: 3.0, wheelbase: 3, wheelR: 0.1, mass: 2600, accel: 22, top: 55, brake: 0, grip: 0, steer: 1.4, hp: 160, colors: ['#141414', '#f4f4ff', '#e8141c', '#2be4ff', '#ffd23a'], blurb: 'ヘリコプター。街の上をどこへでも飛べる。' },
  limo: { kind: 'limo', name: 'Regent ストレッチリムジン', price: 60000, len: 7.6, wid: 2.0, hgt: 1.5, wheelbase: 5.2, wheelR: 0.36, mass: 2900, accel: 5.4, top: 55, brake: 9, grip: 1.0, steer: 0.4, hp: 170, colors: ['#0b0b0d', '#f4f4ff', '#c9b48a', '#3a3a40'], blurb: '後部はラウンジ。シャンパンバーとLED付き。' },
  formula: { kind: 'formula', name: 'Apex F1', price: 250000, len: 5.2, wid: 2.0, hgt: 0.95, wheelbase: 3.4, wheelR: 0.36, mass: 760, accel: 16, top: 100, brake: 17, grip: 1.95, steer: 0.4, hp: 60, colors: ['#e8141c', '#2b6bff', '#f4f4ff', '#ff8a00', '#141414', '#00b894'], blurb: '公道走行ギリギリのフォーミュラカー。' },
  jetski: { kind: 'jetski', name: 'Wave Rider ジェットスキー', price: 12000, len: 3.2, wid: 1.2, hgt: 1.1, wheelbase: 2, wheelR: 0.1, mass: 380, accel: 9, top: 27, brake: 4, grip: 0, steer: 1.7, hp: 60, colors: ['#ffd23a', '#2be4ff', '#e8141c', '#f4f4ff', '#9dff3a'], blurb: '水上バイク。マリーナで受け取り。' },
  speedboat: { kind: 'speedboat', name: 'Marlin 33 スピードボート', price: 75000, len: 10, wid: 3.0, hgt: 1.8, wheelbase: 6, wheelR: 0.1, mass: 4200, accel: 7.5, top: 33, brake: 4, grip: 0, steer: 0.9, hp: 160, colors: ['#e8141c', '#141414', '#2b6bff', '#f4f4ff', '#ffd23a'], blurb: '高速クルーザー。操縦席とデッキを再現。', colR: 1.5 },
  yacht: { kind: 'yacht', name: 'Orca 88 スーパーヨット', price: 900000, len: 27, wid: 7, hgt: 8, wheelbase: 18, wheelR: 0.1, mass: 120000, accel: 2.6, top: 17, brake: 2, grip: 0, steer: 0.32, hp: 700, colors: ['#f4f4f6', '#141414', '#1d2c4d', '#c9a24a'], blurb: '3層デッキの豪華ヨット。キャビンに入れる。', colR: 3.4 },
  jet: { kind: 'jet', name: 'Falcon X 戦闘機', price: 2500000, len: 15, wid: 10, hgt: 4.5, wheelbase: 6, wheelR: 0.4, mass: 16000, accel: 30, top: 250, brake: 10, grip: 1, steer: 0.5, hp: 220, colors: ['#7d858e', '#3a4048', '#d8d8d0', '#2b3a2a'], blurb: '空港で受け取り。機銃とアフターバーナー付き。', colR: 1.6 },
  shinkansen: { kind: 'shinkansen', name: '新幹線', price: 0, len: 26, wid: 3.4, hgt: 3.7, wheelbase: 18, wheelR: 0.43, mass: 400000, accel: 1.15, top: 86, brake: 2.8, grip: 1, steer: 0, hp: 99999, colors: ['#f4f5f7'], blurb: '高架の新幹線を運転する。北の山のトンネルを抜けると次の街へ。' },
};
export const DEALER: VKind[] = ['jet', 'yacht', 'speedboat', 'jetski', 'formula', 'limo', 'heli', 'hyper', 'super', 'sport', 'muscle', 'bike', 'suv', 'pickup', 'sedan', 'hatch', 'taxi', 'truck'];
