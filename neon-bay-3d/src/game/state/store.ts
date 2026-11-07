import { SPAWN } from '../world/cityGen';

export type Quality = 'low' | 'medium' | 'high';
const isTouch = typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0);

/** Mutable game state read every frame by the 3D scene and polled by the HUD. */
export const game = {
  started: false,
  clock: 0, // seconds since start (game time)
  hour: 17.2, // time of day 0..24
  dayLen: 24 * 60, // real seconds per in-game day
  money: 500,
  health: 100,
  stamina: 100,
  wanted: 0,
  where: 'out' as string, // 'out' or an interior id
  near: null as null | { kind: 'door' | 'exit'; label: string; id: string },
  waypoint: null as null | { x: number; z: number },
  quality: (isTouch ? 'medium' : 'high') as Quality,
  isTouch,
  district: '',
  fps: 60,
  player: { x: SPAWN.x, y: 0.15, z: SPAWN.z, yaw: Math.PI, vy: 0, speed: 0, crouch: false, grounded: true, sprinting: false },
  outsidePos: { x: SPAWN.x, z: SPAWN.z, yaw: Math.PI },
  cam: { yaw: 0, pitch: 0.28, mode: 0 },
  toast: '' as string, toastT: 0,
};

export function toast(msg: string, sec = 2.2) { game.toast = msg; game.toastT = sec; }

const KEY = 'neonbay3d.save.v1';
export function save() {
  try {
    const p = game.where === 'out' ? game.player : { ...game.player, x: game.outsidePos.x, z: game.outsidePos.z, yaw: game.outsidePos.yaw };
    localStorage.setItem(KEY, JSON.stringify({ v: 1, money: game.money, hour: game.hour, p: { x: p.x, z: p.z, yaw: p.yaw }, q: game.quality, wp: game.waypoint, cam: game.cam.mode }));
  } catch { /* storage unavailable */ }
}
export function load(): boolean {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return false;
    const s = JSON.parse(raw); if (!s || s.v !== 1) return false;
    game.money = s.money ?? game.money; game.hour = s.hour ?? game.hour;
    if (s.p) { game.player.x = s.p.x; game.player.z = s.p.z; game.player.yaw = s.p.yaw; game.cam.yaw = s.p.yaw + Math.PI; }
    if (s.q) game.quality = s.q; if (s.wp) game.waypoint = s.wp; if (typeof s.cam === 'number') game.cam.mode = s.cam;
    return true;
  } catch { return false; }
}
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
