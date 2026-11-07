/** Vehicle catalogue. Units: meters, m/s, m/s^2, kg. */
export type VKind = 'sedan' | 'sport' | 'super' | 'suv' | 'truck' | 'bike' | 'police' | 'armored';
export interface VDef {
  kind: VKind; name: string; price: number; len: number; wid: number; hgt: number; wheelbase: number; wheelR: number;
  mass: number; accel: number; top: number; brake: number; grip: number; steer: number; hp: number; colors: string[]; blurb: string;
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
};
export const DEALER: VKind[] = ['super', 'sport', 'bike', 'suv', 'sedan', 'truck'];
