import { SPAWN, pointBlocked, isWater, STATION, AIRPORT_ARRIVAL } from '../world/cityGen';
import { REGION, ARRIVE_KEY, REGION_KEY } from '../world/region';
import type { VKind, Mods } from '../vehicles/defs';
import { DEFAULT_LOOK, sanitizeLook, itemById, fashion, setCityStyle, CityStyle, CITY_STYLE_NAMES } from '../player/appearance';
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
  mapOpen: false, paused: false, styling: false, openStyle: false,
  yachtId: 0, // the yacht whose cabin you are in
  homes: [] as string[], // properties the player owns
  items: { onigiri: 0, energy: 0, medkit: 0, senbei: 0 }, // things in your pocket (see crime/shops.ts)
  fadeT: 0, // black fade (sleeping)
  rideHold: null as null | { x: number; z: number; yaw: number }, // while riding a line between cities: where you boarded (saved instead)
  tunnel: 0, // 0..1 while the camera is inside the Shinkansen tunnel (lights and fog go dark)
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
/** Lifetime play statistics (see progression.ts). */
export interface Stats { time: number; walk: number; drive: number; fly: number; sail: number; earned: number; vehicles: string[]; top: number; maxWanted: number; districts: string[]; escapes: number; flags: Record<string, 1> }
export const newStats = (): Stats => ({ time: 0, walk: 0, drive: 0, fly: 0, sail: 0, earned: 0, vehicles: [], top: 0, maxWanted: 0, districts: [], escapes: 0, flags: {} });
export const progress = {
  stats: newStats(), ach: [] as string[], look: { ...DEFAULT_LOOK }, wardrobe: [] as string[], trialBest: {} as Record<string, number>, stunts: {} as Record<string, number>, story: 0,
  gift: { bv: 3, last: '', streak: 0, boxes: [] as number[], claimed: [] as string[], made: [] as string[], used: [] as string[] } };

/** Cars the player owns; index = garage bay. */
export const ownedCars: { kind: VKind; color: string; mods?: Mods }[] = [];

export function toast(msg: string, sec = 2.2) { game.toast = msg; game.toastT = sec; }

const KEY = 'neonbay3d.save.v1';
let lastBak = 0;
let wiped = false;
export function save() {
  if (wiped || !game.started) return; // nothing changes on the title screen (which shows its own time of day)
  try {
    const p = game.rideHold ? { ...game.player, ...game.rideHold } : game.where === 'out' ? game.player : { ...game.player, x: game.outsidePos.x, z: game.outsidePos.z, yaw: game.outsidePos.yaw };
    const data = JSON.stringify({ v: 2, rg: REGION.id, money: game.money, hour: game.hour, p: { x: p.x, z: p.z, yaw: p.yaw }, q: game.quality, wp: game.waypoint, cam: game.cam.mode, ccam: game.cam.carMode, owned: ownedCars, mute: audio.muted, tb: progress.trialBest, st: progress.stunts, story: progress.story, gift: progress.gift, stats: progress.stats, ach: progress.ach, look: progress.look, wardrobe: progress.wardrobe, cityStyle: fashion.style, homes: game.homes, arms: game.arms, radio: game.radio, items: game.items });
    localStorage.setItem(KEY, data);
    // a second copy, refreshed once a minute, in case the main one is ever cut off mid-write
    const now = Date.now(); if (now - lastBak > 60000) { lastBak = now; localStorage.setItem(KEY + '.bak', data); }
  } catch { /* storage unavailable */ }
}
/** How we came into this city this session (set by load): driving the bullet train continues in its cab. */
export const arrival = { drive: false, from: '' as string };
export function load(): boolean {
  try {
    const parse = (k: string) => { try { const r = localStorage.getItem(k); const o = r ? JSON.parse(r) : null; return o && (o.v === 1 || o.v === 2) ? o : null; } catch { return null; } };
    const s = parse(KEY) || parse(KEY + '.bak'); if (!s) return false;
    game.money = s.money ?? game.money; game.hour = s.hour ?? game.hour;
    if (s.v === 1) game.money = Math.max(game.money, 50000); // saves from before cars existed get the starting car budget
    if (Array.isArray(s.owned)) { ownedCars.length = 0; for (const o of s.owned) if (o && typeof o.kind === 'string') ownedCars.push({ kind: o.kind, color: String(o.color), mods: o.mods && typeof o.mods === 'object' ? o.mods : undefined }); }
    if (s.arms && s.arms.owned) { Object.assign(game.arms.owned, s.arms.owned); Object.assign(game.arms.ammo, s.arms.ammo || {}); Object.assign(game.arms.mag, s.arms.mag || {}); game.arms.armor = s.arms.armor || 0; game.arms.cur = s.arms.cur || 'fist'; }
    if (typeof s.radio === 'number') game.radio = s.radio;
    if (s.items && typeof s.items === 'object') for (const k of ['onigiri', 'energy', 'medkit', 'senbei'] as const) { const n = Number(s.items[k]); if (Number.isFinite(n)) game.items[k] = Math.max(0, Math.min(10, Math.floor(n))); }
    if (s.tb && typeof s.tb === 'object') Object.assign(progress.trialBest, s.tb);
    if (s.st && typeof s.st === 'object') Object.assign(progress.stunts, s.st);
    if (typeof s.story === 'number') progress.story = s.story;
    if (s.stats && typeof s.stats === 'object') { const T = s.stats, S = progress.stats;
      for (const k of ['time', 'walk', 'drive', 'fly', 'sail', 'earned', 'top', 'maxWanted', 'escapes'] as const) if (typeof T[k] === 'number' && Number.isFinite(T[k])) S[k] = T[k];
      if (Array.isArray(T.vehicles)) S.vehicles = T.vehicles.filter((x: unknown) => typeof x === 'string'); if (Array.isArray(T.districts)) S.districts = T.districts.filter((x: unknown) => typeof x === 'string');
      if (T.flags && typeof T.flags === 'object') for (const k of Object.keys(T.flags)) S.flags[k] = 1; }
    if (Array.isArray(s.ach)) progress.ach = s.ach.filter((x: unknown) => typeof x === 'string');
    if (Array.isArray(s.wardrobe)) progress.wardrobe = s.wardrobe.filter((x: unknown) => typeof x === 'string' && !!itemById(x as string));
    if (s.look) { const L = sanitizeLook(s.look); if (L.watch && !progress.wardrobe.includes(L.watch)) L.watch = ''; if (L.bag && !progress.wardrobe.includes(L.bag)) L.bag = ''; progress.look = L; }
    if (typeof s.cityStyle === 'string' && s.cityStyle in CITY_STYLE_NAMES) setCityStyle(s.cityStyle as CityStyle);
    if (s.gift && typeof s.gift === 'object') { const g = s.gift, G = progress.gift, arr = (a: unknown, t: string) => (Array.isArray(a) ? a.filter((x) => typeof x === t) : []);
      G.last = typeof g.last === 'string' ? g.last : ''; G.streak = typeof g.streak === 'number' ? g.streak : 0; G.boxes = g.bv === 3 ? (arr(g.boxes, 'number') as number[]) : [] /* box layout changed with the bigger city */; G.claimed = arr(g.claimed, 'string') as string[]; G.made = arr(g.made, 'string') as string[]; G.used = arr(g.used, 'string') as string[]; }
    if (Array.isArray(s.homes)) game.homes = s.homes.filter((h: unknown) => typeof h === 'string');
    if (typeof s.ccam === 'number') game.cam.carMode = s.ccam;
    // a save from another city: start where the train / plane arrives
    const here = (s.rg || 'tokyo') === REGION.id;
    let arrive = ''; try { arrive = localStorage.getItem(ARRIVE_KEY) || ''; localStorage.removeItem(ARRIVE_KEY); } catch { /* ignore */ }
    if (!here) { arrival.drive = arrive === 'drive'; try { arrival.from = JSON.parse(localStorage.getItem('neonbay3d.travelling') || '{}').from || ''; } catch { /* ignore */ } const a = (arrive === 'train' || arrive === 'drive') && STATION ? STATION.spawn : arrive === 'plane' ? AIRPORT_ARRIVAL : { x: SPAWN.x, z: SPAWN.z, yaw: Math.PI }; game.player.x = a.x; game.player.z = a.z; game.player.yaw = a.yaw; game.cam.yaw = a.yaw + Math.PI; s.p = null; s.wp = null; }
    if (s.p) { game.player.x = s.p.x; game.player.z = s.p.z; game.player.yaw = s.p.yaw; game.cam.yaw = s.p.yaw + Math.PI;
      // the city grew around the old one: a saved spot that is now inside a building or the sea goes back to the safehouse
      if (!Number.isFinite(s.p.x) || pointBlocked(s.p.x, 0.9, s.p.z) || pointBlocked(s.p.x, 1.6, s.p.z) || isWater(s.p.x, s.p.z)) { game.player.x = SPAWN.x; game.player.z = SPAWN.z; } }
    if (s.q) game.quality = s.q; if (s.wp) game.waypoint = s.wp; if (typeof s.cam === 'number') game.cam.mode = s.cam;
    return true;
  } catch { return false; }
}
export function clearSave() { wiped = true; try { localStorage.removeItem(KEY); localStorage.removeItem(KEY + '.bak'); localStorage.removeItem(REGION_KEY); localStorage.removeItem(ARRIVE_KEY); } catch { /* ignore */ } }
