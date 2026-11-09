import { REGION } from './world/region';
import { game, progress, ownedCars, save, toast } from './state/store';
import { playerCar, spawn, vehicles } from './vehicles/sim';
import { isBoat, VKind } from './vehicles/defs';
import { law } from './crime/crime';
import { mission, nextMission } from './crime/story';
import { giftBoxes, boxesFound } from './crime/gifts';
import { roadC } from './world/cityGen';
import { nodeIdx } from './ai/driver';
import { settings, saveSettings } from './settings';
import { sfx } from './audio';

/* ================================================================ big centre banners (mission passed / failed, achievements) */
export const banner = { kind: '' as '' | 'ok' | 'fail' | 'ach' | 'info', title: '', sub: '', t: 0 };
export function showBanner(kind: 'ok' | 'fail' | 'ach' | 'info', title: string, sub: string, sec = 4) { Object.assign(banner, { kind, title, sub, t: sec }); }

/* ================================================================ stats */
export type { Stats } from './state/store';
import type { Stats } from './state/store';
export const DISTRICT_GOAL = 14;

/* ================================================================ achievements */
interface Ach { id: string; icon: string; title: string; desc: string; test: (s: Stats) => boolean }
export const ACHIEVEMENTS: Ach[] = [
  { id: 'drive', icon: '🚗', title: 'はじめてのドライブ', desc: '乗り物を運転する', test: (s) => s.vehicles.length >= 1 },
  { id: 'five', icon: '🔑', title: '乗り換え上手', desc: '5種類の乗り物に乗る', test: (s) => s.vehicles.length >= 5 },
  { id: 'fifteen', icon: '🏁', title: '乗り物マニア', desc: '15種類の乗り物に乗る', test: (s) => s.vehicles.length >= 15 },
  { id: 'jet', icon: '✈️', title: 'トップガン', desc: '戦闘機で高度300mまで上がる', test: (s) => !!s.flags.jet300 },
  { id: 'heli', icon: '🚁', title: '空の散歩', desc: 'ヘリで高度200mまで上がる', test: (s) => !!s.flags.heli200 },
  { id: 'sail', icon: '⛵', title: 'キャプテン', desc: '船で合計1km進む', test: (s) => s.sail >= 1000 },
  { id: 'speed', icon: '💨', title: 'スピード狂', desc: '地上の乗り物で時速250kmを出す', test: (s) => s.top >= 250 },
  { id: 'walk', icon: '👟', title: '街歩き', desc: '合計5km歩く', test: (s) => s.walk >= 5000 },
  { id: 'road', icon: '🛣️', title: 'ロードトリップ', desc: '合計50km運転する', test: (s) => s.drive >= 50000 },
  { id: 'explore', icon: '🗺️', title: '探検家', desc: `${DISTRICT_GOAL}の地区を訪れる`, test: (s) => s.districts.length >= DISTRICT_GOAL },
  { id: 'story1', icon: '📖', title: 'はじめての仕事', desc: 'ミッション1をクリア', test: () => progress.story >= 1 },
  { id: 'story5', icon: '👑', title: 'ベイの帝王', desc: 'ストーリーを全てクリア', test: () => progress.story >= 5 },
  { id: 'rich', icon: '💰', title: '百万長者', desc: '所持金$1,000,000', test: () => game.money >= 1_000_000 },
  { id: 'earn', icon: '💵', title: '稼ぎ頭', desc: '累計$250,000稼ぐ', test: (s) => s.earned >= 250_000 },
  { id: 'wanted', icon: '🚨', title: '最重要指名手配', desc: '手配度★5になる', test: (s) => s.maxWanted >= 5 },
  { id: 'escape', icon: '🏃', title: '逃げ切り', desc: '★3以上の手配から逃げ切る', test: (s) => s.escapes >= 1 },
  { id: 'home', icon: '🏠', title: 'マイホーム', desc: '家を買う', test: () => game.homes.length >= 1 },
  { id: 'villa', icon: '🏝️', title: '豪邸の主', desc: 'モダン豪邸を買う', test: () => game.homes.includes('villa') },
  { id: 'garage', icon: '🅿️', title: 'コレクター', desc: '乗り物を5台所有する', test: () => ownedCars.length >= 5 },
  { id: 'gift10', icon: '🎁', title: '宝探し', desc: 'ギフトボックスを10個見つける', test: () => progress.gift.boxes.length >= 10 },
  { id: 'giftall', icon: '🎉', title: '全部見つけた', desc: 'どこかの街のギフトボックスをすべて見つける', test: () => boxesFound() >= giftBoxes().length },
  { id: 'cruise', icon: '🛳️', title: '船旅', desc: '豪華客船に乗船する', test: (s) => !!s.flags.cruise },
  { id: 'stunt', icon: '🤸', title: 'スタントマン', desc: 'スタントジャンプを成功させる', test: () => Object.keys(progress.stunts).length >= 1 },
  { id: 'daily', icon: '☀️', title: '皆勤賞', desc: 'ログインボーナス7日目を受け取る', test: () => progress.gift.streak >= 7 },
];

/* ================================================================ per-frame tracking */
const last = { x: NaN, z: NaN, car: 0, money: NaN, wanted: 0, checkT: 0 };
export function updateProgression(dt: number) {
  if (!game.started) return;
  const S = progress.stats, me = playerCar(), out = game.where === 'out';
  S.time += dt;
  // distance by mode (teleports and respawns are ignored)
  const px = me ? me.x : game.player.x, pz = me ? me.z : game.player.z;
  if (out && Number.isFinite(last.x)) {
    const d = Math.hypot(px - last.x, pz - last.z);
    if (d < 25) { if (!me) S.walk += d; else if (me.def.kind === 'jet' || me.def.kind === 'heli') S.fly += d; else if (isBoat(me.def.kind)) S.sail += d; else S.drive += d; }
  }
  last.x = out ? px : NaN; last.z = pz;
  if (me) {
    if (!S.vehicles.includes(me.def.kind)) S.vehicles.push(me.def.kind);
    const kmh = game.speed * 3.6; if (me.def.kind !== 'jet' && me.def.kind !== 'heli' && !isBoat(me.def.kind) && kmh > S.top) S.top = Math.round(kmh);
    if (me.def.kind === 'jet' && me.y > 300) S.flags.jet300 = 1;
    if (me.def.kind === 'heli' && me.y > 200) S.flags.heli200 = 1;
  }
  if (game.where === 'ship_atrium') S.flags.cruise = 1;
  if (Number.isFinite(last.money) && game.money > last.money) S.earned += game.money - last.money;
  last.money = game.money;
  if (game.wanted > S.maxWanted) S.maxWanted = game.wanted;
  if (last.wanted >= 3 && game.wanted === 0 && !law.over) S.escapes++;
  last.wanted = game.wanted;
  if (game.district && !S.districts.includes(game.district) && !game.district.includes('号室') && game.where === 'out') S.districts.push(game.district);
  if (banner.t > 0) banner.t -= dt;
  // achievements, once a second
  if ((last.checkT -= dt) <= 0) {
    last.checkT = 1;
    for (const a of ACHIEVEMENTS) if (!progress.ach.includes(a.id) && a.test(S)) {
      progress.ach.push(a.id); sfx('buy', 0.7);
      if (banner.t <= 0 || banner.kind === 'ach') showBanner('ach', `🏆 実績解除`, `${a.icon} ${a.title}`, 3.2); else toast(`🏆 実績解除：${a.title}`, 3);
      save(); break; // one per second so they do not pile up
    }
  }
  updateTutorial(dt);
}

/* ================================================================ first-play tutorial */
interface Step { title: string; text: () => string; enter?: () => void; done: (dt: number) => boolean }
export const tutorial = { step: -1, t: 0, acc: 0, yaw: 0 };
const touch = () => game.isTouch;
const STEPS: Step[] = [
  { title: '歩いてみよう', text: () => (touch() ? '左下のスティックをドラッグして歩こう' : 'W A S D で歩こう（Shiftでダッシュ）'), done: () => tutorial.acc >= 10 },
  { title: '周りを見よう', text: () => (touch() ? '画面の右側をドラッグして視点を回そう' : 'マウスをドラッグして視点を回そう'), done: () => tutorial.acc >= 1.4 },
  { title: '車に乗ろう', text: () => (touch() ? '黄色い光の車に近づいて「乗る」を押そう' : '黄色い光の車に近づいて E で乗ろう'),
    enter: () => {
      const p = game.player, i = nodeIdx(p.x), j = nodeIdx(p.z), rx = roadC(i), rz = roadC(j), alongZ = Math.abs(p.x - rx) < Math.abs(p.z - rz);
      const x = alongZ ? rx + 3.3 : p.x + 6, z = alongZ ? p.z + 6 : rz + 3.3, yaw = alongZ ? 0 : Math.PI / 2;
      if (!vehicles.some((v) => Math.hypot(v.x - x, v.z - z) < 4)) { const v = spawn('sport' as VKind, x, z, yaw, '#ff3f93'); v.touched = true; }
      game.waypoint = { x, z };
    },
    done: () => !!playerCar() },
  { title: '走ってみよう', text: () => (touch() ? '右の「アクセル」で200m走ろう（◀ ▶でハンドル）' : 'W でアクセル、A D でハンドル。200m走ろう'), enter: () => { game.waypoint = null; }, done: () => tutorial.acc >= 200 },
  { title: 'スマホを開こう', text: () => (touch() ? '右上の「スマホ」で地図・乗り物の購入・仕事・ギフト' : 'P キーでスマホ。地図・乗り物の購入・仕事・ギフト'), done: () => game.phone },
  { title: 'ストーリーへ', text: () => '地図の黄色い R マークでミッションが始まる。目的地を設定した！', enter: () => { const M = nextMission(); if (M) { const s = M.start(); game.waypoint = { x: s.x, z: s.z }; } }, done: () => mission.id >= 0 || tutorial.t > 14 },
];
export const tutorialStep = () => (tutorial.step >= 0 && tutorial.step < STEPS.length ? STEPS[tutorial.step] : null);
export const tutorialCount = STEPS.length;
export function startTutorial() { tutorial.step = 0; tutorial.t = 0; tutorial.acc = 0; tutorial.yaw = game.cam.yaw; STEPS[0].enter?.(); }
export function skipTutorial() { tutorial.step = -1; settings.tutorialDone = true; saveSettings(); }
const tut = { x: NaN, z: NaN };
function updateTutorial(dt: number) {
  const S = tutorialStep(); if (!S) return;
  tutorial.t += dt;
  const me = playerCar(), px = me ? me.x : game.player.x, pz = me ? me.z : game.player.z;
  const d = Number.isFinite(tut.x) ? Math.hypot(px - tut.x, pz - tut.z) : 0; tut.x = px; tut.z = pz;
  if (tutorial.step === 0 && !me && d < 5) tutorial.acc += d;
  if (tutorial.step === 1) { let dy = game.cam.yaw - tutorial.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; tutorial.acc += Math.abs(dy); tutorial.yaw = game.cam.yaw; }
  if (tutorial.step === 3 && me && d < 25) tutorial.acc += d;
  if (S.done(dt)) {
    sfx('ui'); tutorial.step++; tutorial.t = 0; tutorial.acc = 0; tutorial.yaw = game.cam.yaw;
    const N = tutorialStep();
    if (N) N.enter?.(); else { settings.tutorialDone = true; saveSettings(); game.money += 1000; showBanner('ok', 'チュートリアル完了', `ようこそ${REGION.name}へ！ +$1,000`, 3.5); save(); }
  }
}
