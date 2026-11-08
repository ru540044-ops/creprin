import { SPAWN, pointBlocked, isWater } from '../world/cityGen';
import type { VKind, Mods } from '../vehicles/defs';
import { audio } from '../audio';

export type Quality = 'low' | 'medium' | 'high';
const isTouch = typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0);

/** Mutable game state read every frame by the 3D scene and polled by the HUD. */
export const game = {
  started: false,
  clock: 0, // seconds since start (game time)
  hour: 17.2, // time of day 0..24
  dayLen: 24 * 60, // real seconds per in-game day
  money: 50000,
  health: 100,
  stamina: 100,
  wanted: 0,
  where: 'out' as string, // 'out' or an interior id
  near: null as null | { kind: 'door' | 'exit' | 'car' | 'job'; label: string; id: string; btn?: string },
  lastDoor: '', // id of the door the player last came in through
  arms: { owned: { pistol: false, smg: false }, ammo: { pistol: 0, smg: 0, grenade: 0 }, mag: { pistol: 0, smg: 0 }, cur: 'fist' as string, armor: 0 },
  ui: '' as string,
  phone: false, // in-game phone open (the character holds it)
  yachtId: 0, // the yacht whose cabin you are in
  homes: [] as string[], // properties the player owns
  fadeT: 0, // black fade (sleeping)
  carAnim: 0, // 1 while getting into a car (driving is blocked)
  hurtT: 0, // red damage flash timer
  blast: null as null | { x: number; z: number }, // knockback from an explosion (consumed by the player) // full-screen shop panel currently open ('' = none)
  radio: 0, // car radio station (0 = off)
  weather: { kind: 'clear' as 'clear' | 'cloudy' | 'rain' | 'storm', cloud: 0, rain: 0, next: 240, wet: 0, flash: 0 },
  inCar: 0, // id of the vehicle the player is driving, 0 = on foot
  speed: 0, // m/s of the player's vehicle
  shake: 0, // camera shake from impacts
  waypoint: null as null | { x: number; z: number },
  quality: (isTouch ? 'medium' : 'high') as Quality,
  isTouch,
  district: '',
  fps: 60,
  player: { x: SPAWN.x, y: 0.15, z: SPAWN.z, yaw: Math.PI, vy: 0, speed: 0, crouch: false, grounded: true, sprinting: false },
  outsidePos: { x: SPAWN.x, z: SPAWN.z, yaw: Math.PI },
  cam: { yaw: 0, pitch: 0.28, mode: 0, carMode: 0 },
  toast: '' as string, toastT: 0,
};

/** Persistent progress: best time-trial times. */
export const progress = { trialBest: {} as Record<string, number>, stunts: {} as Record<string, number>, story: 0,
  gift: { bv: 2, last: '', streak: 0, boxes: [] as number[], claimed: [] as string[], made: [] as string[], used: [] as string[] } };

/** Cars the player owns; index = garage bay. */
export const ownedCars: { kind: VKind; color: string; mods?: Mods }[] = [];

export function toast(msg: string, sec = 2.2) { game.toast = msg; game.toastT = sec; }

const KEY = 'neonbay3d.save.v1';
let wiped = false;
export function save() {
  if (wiped) return;
  try {
    const p = game.where === 'out' ? game.player : { ...game.player, x: game.outsidePos.x, z: game.outsidePos.z, yaw: game.outsidePos.yaw };
    localStorage.setItem(KEY, JSON.stringify({ v: 2, money: game.money, hour: game.hour, p: { x: p.x, z: p.z, yaw: p.yaw }, q: game.quality, wp: game.waypoint, cam: game.cam.mode, ccam: game.cam.carMode, owned: ownedCars, mute: audio.muted, tb: progress.trialBest, st: progress.stunts, story: progress.story, gift: progress.gift, homes: game.homes, arms: game.arms, radio: game.radio }));
  } catch { /* storage unavailable */ }
}
export function load(): boolean {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return false;
    const s = JSON.parse(raw); if (!s || (s.v !== 1 && s.v !== 2)) return false;
    game.money = s.money ?? game.money; game.hour = s.hour ?? game.hour;
    if (s.v === 1) game.money = Math.max(game.money, 50000); // saves from before cars existed get the starting car budget
    if (Array.isArray(s.owned)) { ownedCars.length = 0; for (const o of s.owned) if (o && typeof o.kind === 'string') ownedCars.push({ kind: o.kind, color: String(o.color), mods: o.mods && typeof o.mods === 'object' ? o.mods : undefined }); }
    if (s.arms && s.arms.owned) { Object.assign(game.arms.owned, s.arms.owned); Object.assign(game.arms.ammo, s.arms.ammo || {}); Object.assign(game.arms.mag, s.arms.mag || {}); game.arms.armor = s.arms.armor || 0; game.arms.cur = s.arms.cur || 'fist'; }
    if (typeof s.radio === 'number') game.radio = s.radio;
    if (s.tb && typeof s.tb === 'object') Object.assign(progress.trialBest, s.tb);
    if (s.st && typeof s.st === 'object') Object.assign(progress.stunts, s.st);
    if (typeof s.story === 'number') progress.story = s.story;
    if (s.gift && typeof s.gift === 'object') { const g = s.gift, G = progress.gift, arr = (a: unknown, t: string) => (Array.isArray(a) ? a.filter((x) => typeof x === t) : []);
      G.last = typeof g.last === 'string' ? g.last : ''; G.streak = typeof g.streak === 'number' ? g.streak : 0; G.boxes = g.bv === 2 ? (arr(g.boxes, 'number') as number[]) : [] /* box layout changed with the bigger city */; G.claimed = arr(g.claimed, 'string') as string[]; G.made = arr(g.made, 'string') as string[]; G.used = arr(g.used, 'string') as string[]; }
    if (Array.isArray(s.homes)) game.homes = s.homes.filter((h: unknown) => typeof h === 'string');
    if (typeof s.ccam === 'number') game.cam.carMode = s.ccam; if (s.mute) audio.muted = true;
    if (s.p) { game.player.x = s.p.x; game.player.z = s.p.z; game.player.yaw = s.p.yaw; game.cam.yaw = s.p.yaw + Math.PI;
      // the city grew around the old one: a saved spot that is now inside a building or the sea goes back to the safehouse
      if (!Number.isFinite(s.p.x) || pointBlocked(s.p.x, 0.9, s.p.z) || pointBlocked(s.p.x, 1.6, s.p.z) || isWater(s.p.x, s.p.z)) { game.player.x = SPAWN.x; game.player.z = SPAWN.z; } }
    if (s.q) game.quality = s.q; if (s.wp) game.waypoint = s.wp; if (typeof s.cam === 'number') game.cam.mode = s.cam;
    return true;
  } catch { return false; }
}
export function clearSave() { wiped = true; try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
