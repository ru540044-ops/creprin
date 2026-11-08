import { game, toast, save, progress } from '../state/store';
import { vehicles, spawn, remove, playerCar, Veh } from '../vehicles/sim';
import { doors, buildings, topFoot, GARAGE, EXPORT_DOCK, AIRPORT, PORT, groundAt, floorAt, roadC, N } from '../world/cityGen';
import { BDOORS } from '../world/bldgInteriors';
import { INTERIORS } from '../world/Interiors';
import { ejectPed } from '../ai/peds';
import { steer, newAI, nodeIdx } from '../ai/driver';
import { setWanted, law } from './crime';
import { sfx } from '../audio';
import { clamp } from '../world/rng';

/**
 * Story missions: five jobs for RAY, an old friend who runs a chop shop. Each mission is a list of steps;
 * a step shows an objective, may play phone-call dialogue, and finishes when its check passes.
 */
export type Line = { who: string; text: string };
export const talk = { queue: [] as (Line & { t: number })[] };
export function say(lines: Line[]) { for (const l of lines) talk.queue.push({ ...l, t: 2.2 + l.text.length * 0.075 }); sfx('ui', 0.5); }

/** World-space mission marker (yellow pillar on the map / waypoint). */
export const mission = { id: -1, step: 0, t: 0, timer: 0, marker: null as null | { x: number; y: number; z: number }, target: null as Veh | null, fail: '', data: {} as Record<string, any> };
const P = () => game.player;
const at = (x: number, z: number, r: number) => { const me = playerCar(), p = P(); return game.where === 'out' && Math.hypot((me ? me.x : p.x) - x, (me ? me.z : p.z) - z) < r; };
const door = (id: string) => doors.find((d) => d.id === id)!;
const bank = () => BDOORS.find((d) => d.kind === 'lobby' && d.label === 'CENTRAL BANK') || BDOORS.find((d) => d.kind === 'lobby')!;
/** The downtown tower used in the last mission: a lobby with a roof big enough for a helicopter. */
const skyDoor = (() => { let c: typeof BDOORS[number] | null = null; return () => { if (c) return c; let bd = 1e9; for (const d of BDOORS) { if (d.kind !== 'lobby') continue; const b = buildings[d.b], T = topFoot(b); if (b.h < 50 || b.h > 150 || T.x1 - T.x0 < 22 || T.z1 - T.z0 < 20) continue; const q = Math.hypot(d.x, d.z + 50); if (q < bd) { bd = q; c = d; } } return (c ||= BDOORS.find((d) => d.kind === 'lobby')!); }; })();
const skyPad = () => { const b = buildings[skyDoor().b], T = topFoot(b), long = T.x1 - T.x0 >= T.z1 - T.z0, cx = (T.x0 + T.x1) / 2, cz = (T.z0 + T.z1) / 2; const x = long ? cx + 7 : cx, z = long ? cz : cz + 7; return { x, z, y: floorAt(x, z, 1e4) }; };
const hangarPos = () => ({ x: AIRPORT.x0 + 150, z: 250 });
const RAY = 'レイ', VINCE = 'ヴィンス';

interface Step { goal: () => string; enter?: () => void; check: (dt: number) => boolean; marker?: () => { x: number; y: number; z: number } | null }
interface Mission { title: string; blurb: string; reward: number; start: () => { x: number; z: number }; intro: Line[]; outro: Line[]; steps: Step[] }

export const MISSIONS: Mission[] = [
  {
    title: 'ネオンベイへようこそ', blurb: '足を手に入れて、レイのガレージへ。', reward: 2000,
    start: () => { const d = door('home'); return { x: d.x + 3, z: d.z - 6 }; },
    intro: [{ who: RAY, text: 'よう、NOVA。久しぶりだな。ネオンベイへようこそ。' }, { who: RAY, text: 'まずは足が要る。そこらの車を拝借して、俺のガレージまで来い。' }],
    outro: [{ who: RAY, text: 'いい運転だ。これは前金だ。また連絡する。' }],
    steps: [
      { goal: () => '車に乗れ（道ばたの車に近づいて「乗る」）', check: () => !!playerCar() && playerCar()!.def.kind !== 'heli' },
      { goal: () => 'レイのガレージへ行け', marker: () => ({ x: GARAGE.x, y: 0, z: GARAGE.z + 3 }), check: () => at(GARAGE.x, GARAGE.z + 3, 9) },
    ],
  },
  {
    title: '運び屋', blurb: '荷物を拾って、時間内に港の倉庫へ。', reward: 5000,
    start: () => ({ x: GARAGE.x, z: GARAGE.z + 3 }),
    intro: [{ who: RAY, text: 'QWIK 24の前に荷物を置いてある。中身は聞くな。' }, { who: RAY, text: '拾ったら2分以内に港の倉庫まで届けろ。サツの目に気をつけろよ。' }],
    outro: [{ who: RAY, text: '時間通りだ。お前、やっぱり腕は落ちてないな。' }],
    steps: [
      { goal: () => 'QWIK 24の前の荷物を拾え', marker: () => { const d = door('store'); return { x: d.x + Math.sin(d.ang) * 4 + 3, y: 0, z: d.z + Math.cos(d.ang) * 4 }; }, check: () => { const d = door('store'); return at(d.x + Math.sin(d.ang) * 4 + 3, d.z + Math.cos(d.ang) * 4, 4.5); } },
      { goal: () => `港の倉庫へ届けろ　残り ${Math.max(0, Math.ceil(mission.timer))} 秒`, enter: () => { mission.timer = 150; sfx('buy'); toast('荷物を手に入れた', 1.4); },
        marker: () => ({ x: PORT.x0 + 90, y: 1.2, z: PORT.z0 + 12 }),
        check: (dt) => { mission.timer -= dt; if (mission.timer < 85 && !mission.data.tip) { mission.data.tip = 1; setWanted(1, '誰かが密告したらしい'); } if (mission.timer <= 0) mission.fail = '時間切れ…荷物は届かなかった'; return at(PORT.x0 + 90, PORT.z0 + 12, 10); } },
    ],
  },
  {
    title: '裏切り者', blurb: '書類を持って逃げたヴィンスを追え。', reward: 8000,
    start: () => ({ x: EXPORT_DOCK.x - 10, z: EXPORT_DOCK.z }),
    intro: [{ who: RAY, text: 'まずいことになった。ヴィンスがうちの帳簿を持って逃げた。' }, { who: RAY, text: '黒いスポーツカーだ。ぶつけて止めて、帳簿を取り返せ！' }],
    outro: [{ who: RAY, text: '帳簿は戻った。ヴィンスは…まあ、二度と顔を出さないだろう。' }],
    steps: [
      { goal: () => '車に乗れ', check: () => !!playerCar() && playerCar()!.def.kind !== 'heli' },
      { goal: () => mission.target ? `ヴィンスの車に体当たりして止めろ　ダメージ ${Math.round((1 - mission.target.hp / mission.target.def.hp) * 100 / 0.55)}%` : 'ヴィンスを追え',
        enter: () => {
          const p = P(), pi = nodeIdx(p.x), pj = nodeIdx(p.z);
          for (let k = 0; k < 30; k++) { const i = clamp(pi + Math.round((Math.random() - 0.5) * 4), 0, N), j = clamp(pj + Math.round((Math.random() - 0.5) * 4), 0, N), x = roadC(i), z = roadC(j); if (Math.hypot(x - p.x, z - p.z) < 70 || Math.hypot(x - p.x, z - p.z) > 180) continue; const v = spawn('sport', x, z, 0, '#141414'); v.touched = true; v.ai = newAI(x, z, { mode: 'flee' }); mission.target = v; break; }
          say([{ who: VINCE, text: 'レイの犬か！捕まるかよ！' }]);
        },
        marker: () => mission.target ? { x: mission.target.x, y: mission.target.y + 2, z: mission.target.z } : null,
        check: (dt) => {
          const v = mission.target; if (!v || !vehicles.includes(v)) { mission.fail = 'ヴィンスを見失った'; return false; }
          const me = playerCar(), d = me ? Math.hypot(me.x - v.x, me.z - v.z) : 1e9;
          if (d > 380) { mission.fail = 'ヴィンスに逃げられた'; return false; }
          const beaten = v.hp <= v.def.hp * 0.45 || v.dead;
          if (beaten) { v.ai!.ctl = { thr: 0, brake: 1, steer: 0, hb: false }; return Math.hypot(v.vx, v.vz) < 1.5; }
          const flee = me ? { x: v.x + (v.x - me.x), z: v.z + (v.z - me.z) } : null;
          v.ai!.ctl = steer(v, d < 60 ? flee : null, dt, { speed: d < 60 ? 33 : 24, lane: 3.3 });
          return false;
        } },
      { goal: () => '帳簿を拾え（車の横に落ちている）', enter: () => { const v = mission.target!; const q = ejectPed(v.x + Math.cos(v.yaw) * 2.4, v.z - Math.sin(v.yaw) * 2.4, v.x, v.z); q.callT = 0; mission.data.book = { x: v.x - Math.sin(v.yaw) * 4, z: v.z - Math.cos(v.yaw) * 4 }; v.ai = null; mission.target = null; say([{ who: VINCE, text: 'わ、わかった！持ってけ！' }]); },
        marker: () => ({ x: mission.data.book.x, y: groundAt(mission.data.book.x, mission.data.book.z), z: mission.data.book.z }), check: () => at(mission.data.book.x, mission.data.book.z, 3.5) },
    ],
  },
  {
    title: '大仕事', blurb: 'CENTRAL BANKの金庫を破れ。', reward: 50000,
    start: () => { const d = door('home'); return { x: d.x + 3, z: d.z - 6 }; },
    intro: [{ who: RAY, text: 'でかい話がある。CENTRAL BANKの金庫だ。' }, { who: RAY, text: '銃を用意して、ロビー奥の金庫室を開けろ。警報が鳴ったら即逃げろ。' }],
    outro: [{ who: RAY, text: 'ハハッ、やりやがった！ニュースはお前の話でもちきりだ。' }],
    steps: [
      { goal: () => '銃を手に入れろ（BAY ARMS）', check: () => game.arms.owned.pistol || game.arms.owned.smg, marker: () => { const d = door('arms'); return { x: d.x, y: 0, z: d.z }; } },
      { goal: () => 'CENTRAL BANKに入れ', marker: () => { const d = bank(); return { x: d.x, y: d.y, z: d.z }; }, check: () => game.where === 'bi' && game.lastDoor === bank().id },
      { goal: () => '奥の金庫室の前へ行け', marker: () => { const I = INTERIORS[game.where]; return I && game.where === 'bi' ? { x: I.ox + 6.5, y: -50, z: I.oz - 6.4 } : null; },
        check: () => { const I = INTERIORS[game.where]; return !!I && game.where === 'bi' && Math.hypot(P().x - I.ox - 6.5, P().z - I.oz + 6.4) < 1.8; } },
      { goal: () => `金庫をこじ開けている… ${Math.max(0, Math.ceil(mission.timer))} 秒（離れるな）`, enter: () => { mission.timer = 9; setWanted(3, '銀行の警報が鳴った！'); sfx('crash', 0.4); },
        marker: () => { const I = INTERIORS[game.where]; return I && game.where === 'bi' ? { x: I.ox + 6.5, y: -50, z: I.oz - 6.4 } : null; },
        check: (dt) => { const I = INTERIORS[game.where]; if (!I || game.where !== 'bi' || Math.hypot(P().x - I.ox - 6.5, P().z - I.oz + 6.4) > 3) { mission.timer = Math.min(9, mission.timer + dt * 0.5); return false; } mission.timer -= dt; return mission.timer <= 0; } },
      { goal: () => '金を持って外へ逃げろ', enter: () => { sfx('buy'); toast('金庫の中身をいただいた！', 2); }, check: () => game.where === 'out' },
      { goal: () => '警察を振り切れ', enter: () => setWanted(4, '銀行強盗犯として指名手配'), check: () => game.wanted === 0 },
    ],
  },
  {
    title: 'ラストフライト', blurb: 'ヘリで空港の格納庫へ。最後の取引だ。', reward: 100000,
    start: () => ({ x: GARAGE.x, z: GARAGE.z + 3 }),
    intro: [{ who: RAY, text: '最後の仕事だ。空港の格納庫で買い手が待ってる。' }, { who: RAY, text: 'ダウンタウンのビルの屋上にヘリを用意した。エレベーターで上がって、飛んでこい。' }],
    outro: [{ who: RAY, text: '取引成立だ。NOVA、ネオンベイはもうお前の街だ。' }, { who: RAY, text: '…また面白い話があったら連絡する。じゃあな。' }],
    steps: [
      { goal: () => 'ダウンタウンのビルに入って、エレベーターで屋上へ', enter: () => { const h = skyPad(); if (!vehicles.some((v) => v.def.kind === 'heli' && Math.hypot(v.x - h.x, v.z - h.z) < 8)) { const v = spawn('heli', h.x, h.z, Math.PI, '#e8141c'); v.touched = true; } },
        marker: () => { const d = skyDoor(); return game.where === 'out' && P().y < 5 ? { x: d.x, y: d.y, z: d.z } : null; }, check: () => (game.where === 'out' && P().y > skyPad().y - 3) || (!!playerCar() && playerCar()!.def.kind === 'heli') },
      { goal: () => 'ヘリに乗れ', marker: () => { const h = skyPad(); return { x: h.x, y: h.y, z: h.z }; }, check: () => !!playerCar() && playerCar()!.def.kind === 'heli' },
      { goal: () => '空港の格納庫へ飛べ（着陸すれば完了）', marker: () => { const h = hangarPos(); return { x: h.x, y: 0, z: h.z - 70 }; },
        check: () => { const me = playerCar(); if (me && !mission.data.cops && Math.hypot(me.x, me.z) > 500) { mission.data.cops = 1; setWanted(3, '警察に追跡されている'); } const h = hangarPos(); return !!me && Math.hypot(me.x - h.x, me.z - h.z + 70) < 45 && !me.air; } },
    ],
  },
];

/* ------------------------------------------------------------------ runtime */
export const storyDone = () => progress.story >= MISSIONS.length;
export const nextMission = () => (storyDone() ? null : MISSIONS[progress.story]);
export function startMission() {
  const M = nextMission(); if (!M || mission.id >= 0) return;
  mission.id = progress.story; mission.step = 0; mission.t = 0; mission.fail = ''; mission.data = {}; mission.target = null;
  toast('ミッション：' + M.title, 2.2); say(M.intro); M.steps[0].enter?.();
}
function endMission(ok: boolean) {
  const M = MISSIONS[mission.id];
  if (mission.target && vehicles.includes(mission.target)) remove(mission.target);
  if (ok) { progress.story++; game.money += M.reward; sfx('buy'); say(M.outro); talk.queue.push({ who: '', text: `ミッション完了「${M.title}」 +$${M.reward.toLocaleString('en-US')}`, t: 3.5 }); save(); }
  else { toast('ミッション失敗：' + mission.fail + '（マーカーからやり直せる）', 3.5); sfx('crash', 0.3); }
  mission.id = -1; mission.marker = null; mission.target = null; game.waypoint = null;
}
export function updateStory(dt: number) {
  for (const l of talk.queue.slice(0, 1)) { l.t -= dt; if (l.t <= 0) talk.queue.shift(); }
  if (mission.id < 0) { const M = nextMission(); mission.marker = null; if (M && game.where === 'out') { const s = M.start(); mission.marker = { x: s.x, y: groundAt(s.x, s.z), z: s.z }; } return; }
  const M = MISSIONS[mission.id], S = M.steps[mission.step];
  mission.t += dt;
  const mk = S.marker ? S.marker() : null; mission.marker = mk;
  if (mk && mk.y > -40) game.waypoint = { x: mk.x, z: mk.z };
  if (law.over) { mission.fail = law.over.kind === 'busted' ? '逮捕された' : '倒れてしまった'; endMission(false); return; }
  if (mission.fail === '' && S.check(dt)) {
    mission.step++;
    if (mission.step >= M.steps.length) { endMission(true); return; }
    M.steps[mission.step].enter?.(); sfx('ui', 0.6);
  }
  if (mission.fail) endMission(false);
}
export function storyNear() {
  if (mission.id >= 0 || game.where !== 'out') return null;
  const M = nextMission(); if (!M) return null;
  const s = M.start(), me = playerCar(), p = P();
  return Math.hypot((me ? me.x : p.x) - s.x, (me ? me.z : p.z) - s.z) < 4 ? { kind: 'job' as const, id: 'story', label: `ミッション「${M.title}」を始める`, btn: '開始' } : null;
}
export function storyStatus() {
  if (mission.id < 0) return null;
  const M = MISSIONS[mission.id], S = M.steps[mission.step];
  return { title: `${mission.id + 1}. ${M.title}`, text: S.goal(), prog: mission.step / M.steps.length };
}
