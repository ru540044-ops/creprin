import { fish, TUNE, updateFishing, fishAction, fishTable, rng } from '../../src/game/crime/fishing';
import { game } from '../../src/game/state/store';
import { input } from '../../src/game/input';
// the fight, measured without a browser: how long it takes and how often each kind of player wins, snaps the line or loses the fish
Object.assign(TUNE, JSON.parse(process.env.TUNE || '{}')); // try other numbers: TUNE='{"reelRest":2.4}' node fishchk.cjs
game.started = true; game.where = 'out'; game.inCar = 0; game.health = 100; game.hour = 13;
const T = fishTable();
function fight(policy: (f: typeof fish, lag: { v: number; last: boolean }) => boolean, power: number) {
  const f = T.find((x) => Math.abs(x.power - power) < 0.06) || T[0];
  Object.assign(fish, { on: true, phase: 'bite', t: 0, sx: game.player.x, sz: game.player.z, kind: f, lostN: 0 }); fishAction('fish:hook');
  const lag = { v: 0, last: false }; let t = 0;
  while (fish.phase === 'reel' && t < 120) { input.reel = policy(fish, lag); updateFishing(0.05); t += 0.05; }
  input.reel = false; const res = fish.phase === 'caught' ? 'won' : t >= 120 ? 'esc' : /切れ/.test(String((globalThis as any).__lastToast || '')) ? 'snap' : 'lost';
  return { res, t, tension: fish.tension, dist: fish.dist };
}
const careful = (f: typeof fish, lag: { v: number; last: boolean }) => { if (f.run !== lag.last) { lag.v = 0.25; lag.last = f.run; } lag.v = Math.max(0, lag.v - 0.05); const run = lag.v > 0 ? !f.run : f.run; return !run && f.tension < 0.7; };
const sloppy = (f: typeof fish, lag: { v: number; last: boolean }) => { if (f.run !== lag.last) { lag.v = 0.6; lag.last = f.run; } lag.v = Math.max(0, lag.v - 0.05); const run = lag.v > 0 ? !f.run : f.run; return !run && f.tension < 0.8; }; // slow hands
const mash = () => true, idle = () => false;
const out: Record<string, unknown> = {};
for (const [name, pol] of [['careful', careful], ['sloppy', sloppy], ['mash', mash], ['idle', idle]] as const) for (const power of [0.3, 0.6, 0.9]) {
  const N = 120; let won = 0, snap = 0, lost = 0, esc = 0, tt = 0, mn = 1e9, mx = 0;
  for (let i = 0; i < N; i++) { const r = fight(pol as never, power); tt += r.t; mn = Math.min(mn, r.t); mx = Math.max(mx, r.t); if (r.res === 'won') won++; else if (r.res === 'esc') esc++; else if (r.tension >= 1) snap++; else lost++; }
  out[name + '@' + power] = { won: +(won / N).toFixed(2), snap: +(snap / N).toFixed(2), lost: +(lost / N).toFixed(2), esc: +(esc / N).toFixed(2), avg: +(tt / N).toFixed(1), min: +mn.toFixed(1), max: +mx.toFixed(1) };
}
console.log(JSON.stringify(TUNE)); for (const [k, v] of Object.entries(out)) console.log(k.padEnd(14), JSON.stringify(v));
void rng;
