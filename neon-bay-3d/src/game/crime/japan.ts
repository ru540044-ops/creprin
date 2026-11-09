import { game, toast, save, progress } from '../state/store';
import { playerCar } from '../vehicles/sim';
import { props, SIG, RAIL, inCanal, CANAL_RECTS, PROM, groundAt, SHIN, isWater, LANDMARK3D } from '../world/cityGen';
import { spawn, remove, playerCar as pcar, Veh, shinLimits, SHIN_FLIP } from '../vehicles/sim';
import { releaseDrive } from '../input';
import { REGIONS, route } from '../world/region';
import { travelTo } from '../ui/travel';
import { REGION } from '../world/region';
import { sfx } from '../audio';
import type { Near } from './crime';

/**
 * Things to do in the Japanese streets (on foot):
 *  - vending machines: a drink for $2 (+25 health),
 *  - shrines and the temple hall: draw an omikuji fortune for $1 (a little luck money on a good draw),
 *  - street-food stalls: eat for a few dollars (full health),
 *  - station entrances: ride the elevated line to the next station for $3,
 *  - fell into a canal: climb back onto the promenade.
 */
const VEND_DRINKS = ['緑茶', 'コーラ', '缶コーヒー', 'スポーツドリンク', 'ミルクティー', 'サイダー', 'おしるこ', 'コーンスープ'];
const FORTUNES: [string, number, number][] = [['大吉', 0.1, 500], ['中吉', 0.18, 200], ['小吉', 0.2, 50], ['吉', 0.22, 20], ['末吉', 0.18, 5], ['凶', 0.12, 0]];
const MSG: Record<string, string> = { 大吉: '願い事、叶う。', 中吉: '待ち人、来たる。', 小吉: '失せ物、見つかる。', 吉: '旅行、良し。', 末吉: '焦らず待て。', 凶: '木に結んで帰ろう。' };
const shrineCool: Record<number, number> = {};

/* a coarse grid over the vending machines (there are well over a thousand in Tokyo) */
const VG = new Map<string, number[]>();
props.vends.forEach((v, i) => { const k = Math.floor(v.x / 20) + ',' + Math.floor(v.z / 20); let a = VG.get(k); if (!a) VG.set(k, (a = [])); a.push(i); });
function nearVend(x: number, z: number) {
  const cx = Math.floor(x / 20), cz = Math.floor(z / 20);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const i of VG.get((cx + a) + ',' + (cz + b)) || []) {
    const v = props.vends[i], fx = v.x + Math.sin(v.a) * 0.85, fz = v.z + Math.cos(v.a) * 0.85; // in front of the machine
    if (Math.hypot(fx - x, fz - z) < 1.1) return v;
  }
  return null;
}
const front = (o: { x: number; z: number; a: number }, d: number) => ({ x: o.x + Math.sin(o.a) * d, z: o.z + Math.cos(o.a) * d });

export function japanNear(): Near | null {
  if (game.where !== 'out' || playerCar()) return null;
  const p = game.player;
  if (CANAL_RECTS.length && inCanal(p.x, p.z) && p.y < -0.2) return { kind: 'job', id: 'jp:climb', label: '岸に上がる', btn: '上がる' };
  if (SHIN.has && Math.hypot(SHIN.gate.x - p.x, SHIN.gate.z - p.z) < 2.8) { const n = SHIN.next.south ?? SHIN.next.north!; return { kind: 'job', id: 'jp:shin', label: `新幹線を運転する（${REGIONS[n].name}方面）`, btn: '運転' }; }
  for (let i = 0; i < SIG.gates.length; i++) { const g = SIG.gates[i]; if (Math.hypot(g.x - p.x, g.z - p.z) < 2.6) { const to = SIG.gates[(i + 1) % SIG.gates.length]; return { kind: 'job', id: 'jp:train:' + i, label: `${RAIL.name}で${to.name}へ（$3）`, btn: '乗車' }; } }
  for (let i = 0; i < SIG.yatai.length; i++) { const y = SIG.yatai[i], f = front(y, 2.2); if (Math.hypot(f.x - p.x, f.z - p.z) < 1.7) return { kind: 'job', id: 'jp:yatai:' + i, label: `屋台で${y.food}を食べる（$${y.price}・体力全回復）`, btn: '食べる' }; }
  for (let i = 0; i < SIG.shrines.length; i++) { const s = SIG.shrines[i], d = s.big ? 10.5 : 6; if (Math.hypot(s.x - p.x, s.z + d - p.z) < (s.big ? 3.4 : 2.4)) { const cd = (shrineCool[i] ?? -1e9) + 90 - game.clock; return cd > 0 ? { kind: 'job', id: 'jp:wait', label: `${s.name}：おみくじはまた後で（あと${Math.ceil(cd)}秒）`, btn: '参拝' } : { kind: 'job', id: 'jp:omikuji:' + i, label: `${s.name}でおみくじを引く（$1）`, btn: 'おみくじ' }; } }
  for (let i = 0; i < SIG.koban.length; i++) { const k = SIG.koban[i]; if (Math.hypot(k.x - p.x, k.z - 2.6 - p.z) < 2.2) return { kind: 'job', id: 'jp:koban', label: '交番で道を聞く（名所を目的地に設定）', btn: '聞く' }; }
  const v = nearVend(p.x, p.z); if (v) return { kind: 'job', id: 'jp:vend', label: '自販機で飲み物を買う（$2・体力+25）', btn: '買う' };
  return null;
}

export function japanAction(id: string) {
  const p = game.player, S = progress.stats;
  const pay = (n: number) => { if (game.money < n) { toast('お金が足りない', 1.6); sfx('ui'); return false; } game.money -= n; return true; };
  if (id === 'jp:climb') {
    let best: { x: number; z: number } | null = null, bd = 1e9;
    for (const R of CANAL_RECTS) { const ax = R.x1 - R.x0 > R.z1 - R.z0; for (const s of [-1, 1]) { const q = ax ? { x: Math.min(R.x1 - 1, Math.max(R.x0 + 1, p.x)), z: s < 0 ? R.z0 - PROM / 2 : R.z1 + PROM / 2 } : { x: s < 0 ? R.x0 - PROM / 2 : R.x1 + PROM / 2, z: Math.min(R.z1 - 1, Math.max(R.z0 + 1, p.z)) }; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = q; } } }
    if (best) { p.x = best.x; p.z = best.z; p.y = groundAt(p.x, p.z); p.vy = 0; game.fadeT = 0.5; sfx('door'); toast('岸に上がった', 1.4); }
  } else if (id === 'jp:vend') {
    if (!pay(2)) return; game.health = Math.min(100, game.health + 25); S.flags.vend = 1; sfx('buy', 0.5);
    toast(`🥤 ${VEND_DRINKS[Math.floor(Math.random() * VEND_DRINKS.length)]}を買った（体力+25）`, 2);
  } else if (id.startsWith('jp:yatai:')) {
    const y = SIG.yatai[Number(id.slice(9))]; if (!y || !pay(y.price)) return;
    game.health = 100; game.stamina = 100; S.flags.yatai = 1; sfx('buy'); toast(`🍜 ${y.food}を食べた。うまい！（体力全回復）`, 2.4);
  } else if (id.startsWith('jp:omikuji:')) {
    const i = Number(id.slice(11)), s = SIG.shrines[i]; if (!s || !pay(1)) return;
    shrineCool[i] = game.clock;
    let r = Math.random(), f = FORTUNES[FORTUNES.length - 1]; for (const q of FORTUNES) { if (r < q[1]) { f = q; break; } r -= q[1]; }
    if (f[2]) game.money += f[2]; if (f[0] === '大吉') S.flags.daikichi = 1; S.flags.omikuji = 1;
    sfx(f[2] >= 200 ? 'buy' : 'ui'); toast(`⛩ おみくじ：【${f[0]}】${MSG[f[0]]}${f[2] ? `（お賽銭が返ってきた +$${f[2]}）` : ''}`, 3.2);
  } else if (id === 'jp:koban') {
    const spots: [string, number, number][] = [[LANDMARK3D.label, LANDMARK3D.x, LANDMARK3D.z + 48], ...SIG.shrines.map((s) => [s.name, s.x, s.z + 12] as [string, number, number]), ...SIG.yatai.map((y) => [y.food + 'の屋台', y.x, y.z] as [string, number, number]), ...SIG.gates.map((g) => [g.name, g.x, g.z] as [string, number, number])];
    if (SHIN.has) spots.push(['新幹線のりば', SHIN.gate.x, SHIN.gate.z]);
    const far = spots.filter((q) => Math.hypot(q[1] - p.x, q[2] - p.z) > 150), q = (far.length ? far : spots)[Math.floor(Math.random() * (far.length || spots.length))];
    game.waypoint = { x: q[1], z: q[2] }; sfx('ui'); toast(`👮 おまわりさん「${q[0]}なら、この先ですよ」（目的地に設定）`, 3);
  } else if (id.startsWith('jp:shin')) { shinAction(id);
  } else if (id.startsWith('jp:train:')) {
    const i = Number(id.slice(9)), to = SIG.gates[(i + 1) % SIG.gates.length]; if (!to || !pay(3)) return;
    p.x = to.x + 0.5; p.z = to.z - 2.5; p.y = groundAt(p.x, p.z); p.vy = 0; game.cam.yaw = Math.PI; game.hour = (game.hour + 0.1) % 24; game.fadeT = 1.2; game.waypoint = null;
    S.flags.train = 1; sfx('door'); toast(`🚃 ${RAIL.name}で${to.name}に着いた`, 2.4); save();
  }
}
/* ---------- the bullet train ---------- */
const trainDir = (v: Veh) => (Math.cos(v.yaw) >= 0 ? 1 : -1);
/** Prompts while driving the train: go on to the next city at the end of the line, or change ends to drive back. */
export function shinNear(v: Veh): Near | null {
  if (Math.abs(v.vz) > 0.4) return null;
  const dir = trainDir(v), [lo, hi] = shinLimits(dir), atEnd = dir > 0 ? v.z > hi - 3 : v.z < lo + 3, next = dir > 0 ? SHIN.next.south : SHIN.next.north;
  if (atEnd && next) { const R = route(REGION.id, next); return { kind: 'job', id: 'jp:shinGo', label: `このまま${REGIONS[next].name}へ（約${R.hours}時間）`, btn: '出発' }; }
  return { kind: 'job', id: 'jp:shinTurn', label: atEnd ? '終点：反対側の運転台へ移る（折り返し）' : '反対側の運転台へ移る（折り返し）', btn: '折返し' };
}
/** Leave the train: only when stopped; you come down to the street (at the station if you are on the platform). */
export function exitTrain(v: Veh) {
  if (Math.abs(v.vz) > 0.5) { toast('停車してから降りよう（S でブレーキ）', 1.6); return; }
  const p = game.player, mid = v.z - trainDir(v) * 90, atStation = Math.abs(mid - SHIN.stationZ) < 90;
  let x = SHIN.gate.x, z = SHIN.gate.z;
  if (!atStation) { x = SHIN.x - 9.6; z = v.z; if (isWater(x, z)) { x = SHIN.gate.x; z = SHIN.gate.z; } }
  game.inCar = 0; releaseDrive(); remove(v);
  p.x = x; p.z = z; p.y = groundAt(x, z); p.vy = 0; game.fadeT = 0.8; sfx('door');
  toast(atStation ? `${REGION.station || '駅'}に降りた` : '線路わきの階段から地上に降りた', 1.8);
}
export function shinAction(id: string) {
  const v = pcar();
  if (id === 'jp:shin') {
    if (!SHIN.has) return;
    const dir = SHIN.next.south ? 1 : -1, z = SHIN.stationZ + dir * 90;
    const t = spawn('shinkansen', SHIN.x + dir * SHIN.track, z, dir > 0 ? 0 : Math.PI, '#f4f5f7');
    t.y = SHIN.y + 0.05; t.touched = true; game.inCar = t.id; game.cam.carMode = 0; game.fadeT = 0.6; sfx('door'); progress.stats.flags.shinkansen = 1;
    toast('🚄 W（アクセル）で加速・S でブレーキ。終点まで走ると次の街へ', 3.4);
  } else if (id === 'jp:shinTurn' && v && v.def.kind === 'shinkansen') {
    const dir = trainDir(v); v.z -= dir * SHIN_FLIP; v.yaw = dir > 0 ? Math.PI : 0; v.vz = 0; game.cam.yaw += Math.PI; sfx('ui'); toast('反対側の運転台に移った', 1.6);
  } else if (id === 'jp:shinGo' && v && v.def.kind === 'shinkansen') {
    const next = trainDir(v) > 0 ? SHIN.next.south : SHIN.next.north; if (!next) return;
    if (game.wanted > 0) { toast('手配中は他の街へ行けない', 1.8); return; }
    const R = route(REGION.id, next);
    travelTo(next, 'train', 0, R.hours, `🚄 新幹線を運転して${REGIONS[next].name}へ（${R.hours}時間）`);
  }
}

/** Mark the city as visited (for the "all four cities" achievement). */
export function markVisit() { progress.stats.flags['visit_' + REGION.id] = 1; }
