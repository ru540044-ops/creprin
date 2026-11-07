import { SPAWN } from '../world/cityGen';
import type { VKind } from '../vehicles/defs';
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
  near: null as null | { kind: 'door' | 'exit' | 'car'; label: string; id: string },
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

/** Cars the player owns; index = garage bay. */
export const ownedCars: { kind: VKind; color: string }[] = [];

export function toast(msg: string, sec = 2.2) { game.toast = msg; game.toastT = sec; }

const KEY = 'neonbay3d.save.v1';
let wiped = false;
export function save() {
  if (wiped) return;
  try {
    const p = game.where === 'out' ? game.player : { ...game.player, x: game.outsidePos.x, z: game.outsidePos.z, yaw: game.outsidePos.yaw };
    localStorage.setItem(KEY, JSON.stringify({ v: 2, money: game.money, hour: game.hour, p: { x: p.x, z: p.z, yaw: p.yaw }, q: game.quality, wp: game.waypoint, cam: game.cam.mode, ccam: game.cam.carMode, owned: ownedCars, mute: audio.muted }));
  } catch { /* storage unavailable */ }
}
export function load(): boolean {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return false;
    const s = JSON.parse(raw); if (!s || (s.v !== 1 && s.v !== 2)) return false;
    game.money = s.money ?? game.money; game.hour = s.hour ?? game.hour;
    if (s.v === 1) game.money = Math.max(game.money, 50000); // saves from before cars existed get the starting car budget
    if (Array.isArray(s.owned)) { ownedCars.length = 0; for (const o of s.owned) if (o && typeof o.kind === 'string') ownedCars.push({ kind: o.kind, color: String(o.color) }); }
    if (typeof s.ccam === 'number') game.cam.carMode = s.ccam; if (s.mute) audio.muted = true;
    if (s.p) { game.player.x = s.p.x; game.player.z = s.p.z; game.player.yaw = s.p.yaw; game.cam.yaw = s.p.yaw + Math.PI; }
    if (s.q) game.quality = s.q; if (s.wp) game.waypoint = s.wp; if (typeof s.cam === 'number') game.cam.mode = s.cam;
    return true;
  } catch { return false; }
}
export function clearSave() { wiped = true; try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
