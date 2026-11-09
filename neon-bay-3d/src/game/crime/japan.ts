import { game, toast, save, progress } from '../state/store';
import { playerCar } from '../vehicles/sim';
import { props, SIG, RAIL, inCanal, CANAL_RECTS, PROM, groundAt, SHIN, isWater, LANDMARK3D, shinStand, shinCabDoor, shinUp, shinDown, ShinPlatform, TUN, inTunnel, HALF } from '../world/cityGen';
import { spawn, remove, playerCar as pcar, Veh, shinLimits, SHIN_FLIP, atcKmh, shinRun } from '../vehicles/sim';
import { releaseDrive, input } from '../input';
import { REGIONS, route, RegionId } from '../world/region';
import { travelTo } from '../ui/travel';
import { REGION } from '../world/region';
import { sfx, chime } from '../audio';
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
  { const st = stationNear(p); if (st) return st; }
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
  } else if (id.startsWith('jp:shin') || id.startsWith('jp:st') || id.startsWith('jp:board:')) { shinAction(id);
  } else if (id.startsWith('jp:train:')) {
    const i = Number(id.slice(9)), to = SIG.gates[(i + 1) % SIG.gates.length]; if (!to || !pay(3)) return;
    p.x = to.x + 0.5; p.z = to.z - 2.5; p.y = groundAt(p.x, p.z); p.vy = 0; game.cam.yaw = Math.PI; game.hour = (game.hour + 0.1) % 24; game.fadeT = 1.2; game.waypoint = null;
    S.flags.train = 1; sfx('door'); toast(`🚃 ${RAIL.name}で${to.name}に着いた`, 2.4); save();
  }
}
/* ---------- the bullet train: walk in through the concourse, up to the platform, take the cab, run north through the tunnel to the next city ---------- */
const trainDir = (v: Veh) => (Math.cos(v.yaw) >= 0 ? 1 : -1);
/** The platform beside the track the train is on (west: 14, east: 15). */
const platformAt = (v: Veh) => SHIN.platforms.find((P) => P.side === (v.x >= SHIN.x ? 1 : -1))!;
/** The stop mark: the lead car's centre at the north end of the platform for a northbound train, at the south end for an arrival. */
const stopZ = (dir: number) => SHIN.stationZ + dir * 90;
const stName = () => REGION.station || REGION.names.downtown + '駅';
const short = () => stName().replace('駅', '');
/** The trip to the next city begins when the lead car is this far into the tunnel. */
export const TRIP_Z = TUN.portal - 240;
/** Driver's display (read by the HUD): speed limit, the next stop and the distance to its stop mark, ATC braking. */
export const trainInfo = { on: false, limit: 300, next: '', dist: 0, atc: false, notch: '' };
/** Speed limit (km/h) from the automatic train control (see sim). */
export const atcLimit = (v: Veh) => atcKmh(v);
const T = { moving: false, announced: '', approach: false, judged: true, dest: '' as RegionId | '', inTun: false, left: false, warned: false };
/** Where a northbound train goes: the destination of the platform it left from, else the first city up the line. */
const destOf = (): RegionId | undefined => (T.dest || SHIN.dests[0]) as RegionId | undefined;
/** Per frame while driving: ATC display, announcements, the tunnel and the trip on, the stop-position judgement at the platform. */
export function updateTrain() {
  const v = pcar(); trainInfo.on = !!v && v.def.kind === 'shinkansen'; if (!v || !trainInfo.on) { T.moving = false; shinRun.open = false; return; }
  const dir = trainDir(v), sp = Math.abs(v.vz), kmh = sp * 3.6, dest = destOf(), north = dir < 0;
  shinRun.open = north && !!dest && game.wanted === 0; // the line goes on beyond the tunnel: no braking curve to the end of the bore
  trainInfo.limit = atcLimit(v); trainInfo.atc = kmh > trainInfo.limit + 3;
  trainInfo.notch = v.braking ? 'ブレーキ' : input.gas || input.keys.has('w') || input.keys.has('arrowup') ? '力行' : '惰行';
  if (north) { trainInfo.next = dest ? `${REGIONS[dest].name}（${TUN.name}経由）` : '車両基地'; trainInfo.dist = Math.max(0, Math.round(v.z - TRIP_Z)); }
  else { trainInfo.next = stName(); trainInfo.dist = Math.max(0, Math.round(stopZ(1) - v.z)); }
  if (sp > 2 && !T.moving) {
    T.moving = true; T.judged = false; const key = 'dep' + dir + (dest || '');
    if (T.announced !== key) { T.announced = key; chime('announce'); toast(north && dest ? `🔔 この電車は のぞみ号 ${REGIONS[dest].name}行きです。${TUN.name}を抜けると${REGIONS[dest].name}です` : `🔔 まもなく終点 ${short()} です`, 3.4); }
  }
  if (!north) {
    const ahead = stopZ(1) - v.z;
    if (ahead > 50 && ahead < 1500 && !T.approach && sp > 5) { T.approach = true; chime('announce'); toast(`🔔 まもなく ${short()} です。15番線の停止位置目標に止めよう`, 3); }
    if (ahead < 0) T.approach = false;
  }
  // into the mountain, and on to the next city
  const tun = v.z < TUN.portal + TUN.hood;
  if (tun && !T.inTun && north) toast(`🚇 ${TUN.name}（${dest ? REGIONS[dest].name + '方面' : ''}）`, 2);
  T.inTun = tun;
  if (north && dest && v.z < TRIP_Z && !T.left) {
    if (game.wanted > 0) { if (!T.warned) { T.warned = true; toast('手配中は他の街へ行けない（ATCが止める。トンネルの奥で折り返そう）', 3.2); } }
    else { T.left = true; const R = route(REGION.id, dest); game.fadeT = 1.6; travelTo(dest, 'drive', 0, R.hours, `🚄 ${TUN.name}を抜けて${REGIONS[dest].name}へ（${R.hours}時間）`); return; }
  }
  if (T.moving && sp < 0.15) {
    T.moving = false;
    const sz = stopZ(dir);
    if (!T.judged && Math.abs(v.z - sz) < 60) {
      T.judged = true; const off = (v.z - sz) * dir, a = Math.abs(off);
      const res: [string, number] = a < 0.5 ? ['ぴったり停車！ 定位置ジャスト', 1000] : a < 1.5 ? ['停止位置 ±' + a.toFixed(1) + 'm 優秀', 500] : a < 4 ? ['停止位置 ' + (off > 0 ? '行き過ぎ ' : '手前 ') + a.toFixed(1) + 'm', 150] : ['停止位置から ' + a.toFixed(0) + 'm ずれた', 0];
      if (res[1]) game.money += res[1]; if (a < 1.5) progress.stats.flags.teii = 1;
      chime('door'); toast(`🚄 ${short()}に到着　${res[0]}${res[1] ? `（+$${res[1]}）` : ''}`, 3.6);
    }
  }
}
/** Prompts while stopped at the end of the bore (the trip on, or change ends); anywhere else the button gets you off. */
export function shinNear(v: Veh): Near | null {
  if (Math.abs(v.vz) > 0.4) return null;
  const dir = trainDir(v), [lo] = shinLimits(dir), dest = destOf();
  if (dir < 0 && v.z < lo + 3) {
    if (dest && game.wanted === 0) { const R = route(REGION.id, dest); return { kind: 'job', id: 'jp:shinGo', label: `このまま${REGIONS[dest].name}へ（約${R.hours}時間・運転席のまま到着）`, btn: '出発' }; }
    return { kind: 'job', id: 'jp:shinTurn', label: '反対側の運転台へ移る（折り返して駅へ戻る）', btn: '折返し' };
  }
  return null; // at the terminus the platform is right there: the button gets you off
}
/** Leave the train (only when stopped): onto the platform at the station, down to the street elsewhere, never inside the tunnel. */
export function exitTrain(v: Veh) {
  if (Math.abs(v.vz) > 0.5) { toast('停車してから降りよう（S でブレーキ）', 1.6); return; }
  if (inTunnel(v.x, v.z)) { toast('トンネルの中では降りられない（W で進むか、奥で折り返して駅へ）', 2.4); return; }
  const p = game.player, dir = trainDir(v), P = platformAt(v), atPlat = Math.abs(v.z - SHIN.stationZ) < 105;
  game.inCar = 0; releaseDrive(); remove(v); sfx('door'); game.fadeT = 0.6;
  if (atPlat) { p.x = P.side < 0 ? P.x1 - 1.5 : P.x0 + 1.5; p.z = Math.max(SHIN.stationZ - 105, Math.min(SHIN.stationZ + 105, v.z + dir * 4)); p.y = SHIN.y + 0.2; p.vy = 0; game.cam.yaw = P.side < 0 ? Math.PI / 2 : -Math.PI / 2; toast(`${stName()} ${P.num}番線に降りた（ホーム北寄りの階段から改札へ）`, 2.6); return; }
  let x = SHIN.x - 9.6, z = Math.max(v.z, -HALF + 8); if (isWater(x, z)) { x = SHIN.gate.x; z = SHIN.gate.z; }
  p.x = x; p.z = z; p.y = groundAt(x, z); p.vy = 0; toast('線路わきの非常階段から地上に降りた', 1.8);
}
/** Take the driver's seat of a train at (x, z) facing south (dir 1) or north (-1). */
function ride(x: number, z: number, dir: number) {
  const t = spawn('shinkansen', x, z, dir > 0 ? 0 : Math.PI, '#f4f5f7');
  t.y = SHIN.y + 0.05; t.touched = true; game.inCar = t.id; game.cam.carMode = 0; game.fadeT = 0.6; sfx('door'); progress.stats.flags.shinkansen = 1;
  T.moving = false; T.judged = true; T.approach = false; T.announced = ''; T.left = false; T.warned = false; T.inTun = z < TUN.portal + TUN.hood;
  return t;
}
/** Board the train waiting at this platform (the departure melody plays, then the doors close). */
function board(P: ShinPlatform) { const s = shinStand(P), t = ride(s.x, s.z, P.dir); T.dest = P.to || ''; chime('depart'); return t; }
const drivingTrain = () => { const v = pcar(); return !!v && v.def.kind === 'shinkansen'; };
/** Near prompts on foot at the station: stairs up from the concourse, stairs down from the platform, the cab door. */
export function stationNear(p: { x: number; y: number; z: number }): Near | null {
  if (!SHIN.has) return null;
  if (p.y > SHIN.y - 1) {
    for (const P of SHIN.platforms) {
      const d = shinDown(P); if (Math.hypot(d.x - p.x, d.z + 5 - p.z) < 2.6) return { kind: 'job', id: 'jp:stDown', label: '階段を下りて改札へ', btn: '下りる' };
      if (P.to) { const c = shinCabDoor(P); if (Math.hypot(c.x - p.x, c.z - p.z) < 2.4 && !drivingTrain()) return { kind: 'job', id: 'jp:board:' + P.num, label: `運転席に乗る（のぞみ ${REGIONS[P.to].name}行き・${P.num}番線）`, btn: '乗る' }; }
    }
    return null;
  }
  for (const P of SHIN.platforms) { const u = shinUp(P); if (Math.hypot(u.x - p.x, u.z - p.z) < 2.6) return { kind: 'job', id: 'jp:stUp:' + P.num, label: `${P.num}番線ホームへ上がる（${P.to ? REGIONS[P.to].name + '方面' : '到着ホーム'}）`, btn: '上がる' }; }
  return null;
}
export function shinAction(id: string) {
  const v = pcar(), p = game.player;
  if (id.startsWith('jp:stUp:')) {
    const P = SHIN.platforms.find((q) => q.num === Number(id.slice(8))); if (!P) return;
    const d = shinDown(P); p.x = d.x; p.z = d.z + 6; p.y = SHIN.y + 0.2; p.vy = 0; game.cam.yaw = P.dir > 0 ? Math.PI : 0; game.fadeT = 0.6; sfx('door');
    toast(`${P.num}番線ホーム${P.to ? `：のぞみ ${REGIONS[P.to].name}行きは先頭車（北側の端）の運転席から乗れます` : '（到着専用）'}`, 3.2);
  } else if (id === 'jp:stDown') {
    p.x = SHIN.hall.x0 + 22; p.z = SHIN.stationZ; p.y = groundAt(p.x, p.z); p.vy = 0; game.cam.yaw = Math.PI / 2; game.fadeT = 0.6; sfx('door'); toast('新幹線中央改札', 1.6);
  } else if (id.startsWith('jp:board:')) {
    const P = SHIN.platforms.find((q) => q.num === Number(id.slice(9))); if (!P || !P.to) return;
    board(P); toast(`🚄 のぞみ号 ${REGIONS[P.to].name}行き　W（アクセル）で発車・S でブレーキ。北の${TUN.name}を抜けると${REGIONS[P.to].name}`, 4);
  } else if (id === 'jp:shinTurn' && v && v.def.kind === 'shinkansen') {
    const dir = trainDir(v); v.z -= dir * SHIN_FLIP; v.yaw = dir > 0 ? Math.PI : 0; v.vz = 0; game.cam.yaw += Math.PI; sfx('ui'); toast('反対側の運転台に移った', 1.6); T.judged = true; T.left = false; T.warned = false;
  } else if (id === 'jp:shinGo' && v && v.def.kind === 'shinkansen') {
    const next = destOf(); if (!next) return;
    if (game.wanted > 0) { toast('手配中は他の街へ行けない', 1.8); return; }
    const R = route(REGION.id, next); T.left = true; game.fadeT = 1.6;
    travelTo(next, 'drive', 0, R.hours, `🚄 新幹線を運転して${REGIONS[next].name}へ（${R.hours}時間）`);
  }
}
/** Arriving by driving the train: you come out of the tunnel north of the city at speed, heading for the terminus. */
export function startArrivalDrive(from: RegionId | '') {
  if (!SHIN.has) return;
  const t = ride(SHIN.x + SHIN.track, TUN.portal - 150, 1); t.vz = 120 / 3.6;
  T.dest = ''; T.announced = 'dep1' + (destOf() || ''); T.moving = true; T.judged = false;
  toast(`🚄 ${from && from in REGIONS ? REGIONS[from].name + 'から' : ''}${TUN.name}を抜けると${REGION.name}。終点 ${short()} 15番線の停止位置目標に止めよう（S でブレーキ）`, 4.2);
}

/** Mark the city as visited (for the "all four cities" achievement). */
export function markVisit() { progress.stats.flags['visit_' + REGION.id] = 1; }
/** Once per city with a Shinkansen: where to find the station. */
export function shinHint() {
  const k = 'shinhint_' + REGION.id; if (!SHIN.has || progress.stats.flags[k]) return;
  progress.stats.flags[k] = 1; toast(`🚄 ${stName()}の新幹線のりば：マップの青い🚄マーク・空に伸びる青い光が目印（スマホの「新幹線」アプリで案内・タクシー）`, 4.4);
}
