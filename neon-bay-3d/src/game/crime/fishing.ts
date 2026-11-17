import { game, toast, save, progress } from '../state/store';
import { isWater, groundAt, WATER_Y } from '../world/cityGen';
import { REGION, RegionId } from '../world/region';
import { input } from '../input';
import { sfx } from '../audio';
import { startEat, dishFor } from '../ui/eat';
import { ev, addRep } from './events';
import { cine } from '../cine';

/**
 * Fishing from the shore, a pier or a canal bank. Walk to the water and cast; wait for the float to dip, hook the fish in
 * the moment it does (a slow hand lets it go), then reel it in: hold to reel, let go when it runs, or the line snaps.
 * Each city has its own catch, better at dawn and dusk. What you do with a fish is up to you: sell it, grill it on the
 * spot (the eating scene) or put it back.
 */
export interface Fish { name: string; value: number; weight: number; power: number; len: [number, number]; rare?: boolean }
const TABLE: Record<RegionId, Fish[]> = {
  tokyo: [{ name: 'アジ', value: 25, weight: 40, power: 0.3, len: [14, 26] }, { name: 'サバ', value: 30, weight: 26, power: 0.4, len: [22, 38] }, { name: 'クロダイ', value: 120, weight: 12, power: 0.6, len: [28, 46] }, { name: 'スズキ', value: 160, weight: 8, power: 0.75, len: [45, 80], rare: true }, { name: 'マダイ', value: 320, weight: 3, power: 0.9, len: [40, 70], rare: true }],
  osaka: [{ name: 'アジ', value: 25, weight: 38, power: 0.3, len: [14, 26] }, { name: 'イワシ', value: 18, weight: 28, power: 0.25, len: [12, 20] }, { name: 'チヌ', value: 130, weight: 12, power: 0.6, len: [28, 48] }, { name: 'タコ', value: 110, weight: 9, power: 0.55, len: [30, 60] }, { name: 'フグ', value: 220, weight: 4, power: 0.5, len: [18, 32], rare: true }],
  nara: [{ name: 'フナ', value: 15, weight: 40, power: 0.25, len: [15, 28] }, { name: 'コイ', value: 25, weight: 28, power: 0.45, len: [35, 70] }, { name: 'ナマズ', value: 70, weight: 14, power: 0.6, len: [40, 80] }, { name: 'ウナギ', value: 150, weight: 6, power: 0.7, len: [50, 90], rare: true }, { name: '錦鯉', value: 420, weight: 2, power: 0.8, len: [45, 80], rare: true }],
  fukuoka: [{ name: 'アジ', value: 28, weight: 36, power: 0.3, len: [14, 28] }, { name: 'イカ', value: 90, weight: 22, power: 0.45, len: [20, 40] }, { name: 'サワラ', value: 150, weight: 14, power: 0.65, len: [50, 90] }, { name: 'ヒラメ', value: 210, weight: 8, power: 0.7, len: [40, 75], rare: true }, { name: 'ブリ', value: 360, weight: 3, power: 0.9, len: [60, 100], rare: true }],
  naha: [{ name: 'グルクン', value: 50, weight: 34, power: 0.35, len: [18, 32] }, { name: 'ブダイ', value: 110, weight: 22, power: 0.55, len: [28, 50] }, { name: 'ミーバイ', value: 180, weight: 14, power: 0.7, len: [35, 65], rare: true }, { name: 'カツオ', value: 140, weight: 12, power: 0.65, len: [40, 70] }, { name: 'カジキ', value: 900, weight: 1, power: 1, len: [150, 260], rare: true }],
};
export const fishTable = (r: RegionId = REGION.id) => TABLE[r];

export type Phase = '' | 'cast' | 'wait' | 'bite' | 'reel' | 'caught' | 'lost';
export const fish = {
  on: false, phase: '' as Phase, t: 0, bx: 0, bz: 0, sx: 0, sz: 0,
  /** line tension 0..1.1 (1 snaps it) */ tension: 0, /** metres of line still out */ dist: 0, dist0: 1, kind: null as Fish | null, len: 0,
  run: false, runT: 0, pull: 0, reeling: false, msg: '', /** this session */ caught: 0, lostN: 0,
};
export const rng = { f: Math.random };
/** How the fight feels (tuned by measurement: tests/fishing.cjs and tests/gen/fishchk.ts). */
export const TUNE = { line0: 6, linePow: 7, tension0: 0.3, reelRest: 2.2, reelRun: 0.7, tenRest: 0.14, tenPull: 0.35, tenRun: 0.8, relax: 0.6, drag: 1.1, surge: 0.2, firstRest: 1.9 };
const flags = () => progress.stats.flags;

/** The nearest water in front of or beside the player, within casting range: its position, or null. */
export function waterNear(): { x: number; z: number } | null {
  const p = game.player; if (game.where !== 'out' || game.inCar || !game.started) return null;
  let best: { x: number; z: number } | null = null, bd = 1e9;
  for (let k = 0; k < 24; k++) for (const r of [2.2, 3.4, 5, 7]) {
    const a = (k / 24) * Math.PI * 2, x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
    if (isWater(x, z) && r < bd) { bd = r; best = { x, z }; }
  }
  return best && bd <= 7 && !isWater(p.x, p.z) && Math.abs(p.y - groundAt(p.x, p.z)) < 1.2 ? best : null;
}
/** The prompt: what the action button does right now. */
export function fishNear() {
  if (fish.on) {
    if (fish.phase === 'wait') return { kind: 'job' as const, id: 'fish:stop', label: '浮きを見ている…（やめる）', btn: 'やめる' };
    if (fish.phase === 'bite') return { kind: 'job' as const, id: 'fish:hook', label: '！ 今だ、引け！', btn: '引く！' };
    return null;
  }
  if (cine.lock || ev.choice || game.where !== 'out' || game.inCar) return null;
  return waterNear() ? { kind: 'job' as const, id: 'fish:start', label: '釣りをする（' + REGION.name + 'の水辺）', btn: '釣る' } : null;
}
export function fishAction(id: string) {
  if (id === 'fish:start') start();
  else if (id === 'fish:stop') stop('釣りをやめた');
  else if (id === 'fish:hook') hook();
}
function start() {
  const w = waterNear(); if (!w) { toast('水辺で釣れる', 1.6); return; }
  const p = game.player; p.yaw = Math.atan2(w.x - p.x, w.z - p.z);
  Object.assign(fish, { on: true, phase: 'cast', t: 0, sx: p.x, sz: p.z, bx: p.x + (w.x - p.x) * 1.25, bz: p.z + (w.z - p.z) * 1.25, tension: 0, kind: null, msg: '' });
  // a cast ends in water: step the target out until it is
  for (let k = 0; k < 6 && !isWater(fish.bx, fish.bz); k++) { fish.bx = fish.sx + (fish.bx - fish.sx) * 1.2; fish.bz = fish.sz + (fish.bz - fish.sz) * 1.2; }
  sfx('door', 0.4); toast('キャスト！', 1.2);
}
function stop(msg: string) { fish.on = false; fish.phase = ''; fish.reeling = false; input.noMove = false; if (msg) toast(msg, 1.8); }
function pickFish(): Fish {
  const h = game.hour, bite = (h > 4.5 && h < 7.5) || (h > 16.5 && h < 19.5), T = TABLE[REGION.id];
  const w = T.map((f) => f.weight * (f.rare && bite ? 2.2 : 1)), sum = w.reduce((a, b) => a + b, 0); let r = rng.f() * sum;
  for (let i = 0; i < T.length; i++) { r -= w[i]; if (r <= 0) return T[i]; } return T[0];
}
function hook() {
  if (fish.phase !== 'bite') return;
  const f = fish.kind!; fish.phase = 'reel'; fish.dist0 = fish.dist = TUNE.line0 + f.power * TUNE.linePow; fish.tension = TUNE.tension0; fish.run = false; fish.runT = TUNE.firstRest + rng.f() * 1.4; fish.pull = 0.1; fish.len = Math.round(f.len[0] + rng.f() * (f.len[1] - f.len[0]));
  sfx('crash', 0.12); toast('かかった！ 長押しで巻く・暴れたら離す', 2.4);
}

/** Per frame (game time). */
export function updateFishing(dt: number) {
  input.noMove = fish.on;
  if (!fish.on) return;
  const p = game.player;
  if (game.where !== 'out' || game.inCar || game.health <= 0 || cine.lock) { stop(''); return; }
  if (Math.hypot(p.x - fish.sx, p.z - fish.sz) > 3 && fish.phase !== 'caught' && fish.phase !== 'lost') { stop('場所を離れたので糸を巻き上げた'); return; }
  fish.t += dt;
  const reeling = !!(input.reel || input.keys.has('e')); fish.reeling = reeling;
  switch (fish.phase) {
    case 'cast': if (fish.t > 1.0) { fish.phase = 'wait'; fish.t = 0; const h = game.hour, bite = (h > 4.5 && h < 7.5) || (h > 16.5 && h < 19.5); fish.runT = (bite ? 2.5 : 4) + rng.f() * (bite ? 5 : 8); } break;
    case 'wait': if (fish.t > fish.runT) { fish.phase = 'bite'; fish.t = 0; fish.kind = pickFish(); sfx('ui', 0.7); } break;
    case 'bite': if (fish.t > 1.5) { fish.phase = 'wait'; fish.t = 0; fish.runT = 3 + rng.f() * 6; fish.lostN++; toast('逃げられた…（引くのが遅い）', 1.8); } break;
    case 'reel': {
      const f = fish.kind!;
      fish.runT -= dt; if (fish.runT <= 0) { fish.run = !fish.run; fish.runT = fish.run ? 0.9 + rng.f() * 1.1 : 1.1 + rng.f() * 1.3; if (fish.run) fish.tension += (0.1 + f.power * 0.9) * TUNE.surge * (0.6 + rng.f() * 0.8); } // a run starts with a jerk on the line
      fish.pull = fish.run ? 0.55 + f.power * 0.45 : 0.1 + f.power * 0.15;
      // reeling brings the fish in and tightens the line; the fish's run does the same, harder; letting go slackens the line
      if (reeling) { fish.dist -= (fish.run ? TUNE.reelRun : TUNE.reelRest) * dt * (1.15 - fish.tension * 0.35); fish.tension += (TUNE.tenRest + fish.pull * (fish.run ? TUNE.tenRun : TUNE.tenPull)) * dt; }
      else { fish.tension -= TUNE.relax * dt; if (fish.run) fish.dist += fish.pull * TUNE.drag * dt; fish.tension += (fish.run ? fish.pull * 0.12 : 0) * dt; }
      fish.tension = Math.max(0, Math.min(1.2, fish.tension));
      if (fish.tension >= 1) { lose('糸が切れた！（巻きすぎ）'); break; }
      if (fish.dist > fish.dist0 + 6) { lose('逃げられた（糸がたるんだ）'); break; }
      if (fish.dist <= 0.5) { landed(); }
      break;
    }
    case 'caught': case 'lost': if (!ev.choice && fish.t > 0.4) stop(''); break;
  }
}
function lose(msg: string) { fish.phase = 'lost'; fish.t = 0; fish.lostN++; fish.kind = null; toast('🎣 ' + msg, 2.4); sfx('crash', 0.2); }
function landed() {
  const f = fish.kind!; fish.phase = 'caught'; fish.t = 0; fish.caught++; flags().fish = (flags().fish || 0) + 1; flags().fishBest = Math.max(flags().fishBest || 0, f.value);
  const sell = () => { game.money += f.value; sfx('buy'); toast(`${f.name}（${fish.len}cm）を売った +$${f.value}`, 2.4); save(); };
  ev.choice = {
    title: `${f.name}が釣れた！`, who: '', text: `${fish.len}cm の${f.name}${f.rare ? '（めったに釣れない大物！）' : ''}。どうする？`, options: [
      { label: '売る', sub: `+$${f.value}`, pick: () => { ev.choice = null; sell(); } },
      { label: 'その場で焼いて食べる', sub: '体力 +25・満腹', pick: () => { ev.choice = null; game.health = Math.min(100, game.health + 25); startEat('焼き' + f.name, dishFor('焼き' + f.name), '体力+25'); save(); } },
      { label: '逃がす', sub: f.rare ? '評判 +1（自然を大切に）' : '何も変わらない', pick: () => { ev.choice = null; if (f.rare) addRep(1, '大物を逃がした'); else toast(`${f.name}を水に返した`, 1.6); } },
    ],
  };
}
/** Stop at once (a door, a death, a scene). */
export const cancelFishing = () => { if (fish.on) stop(''); };
