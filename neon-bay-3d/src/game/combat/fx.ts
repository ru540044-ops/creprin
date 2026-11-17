/** Short-lived combat effects shared by the player's guns and the police: muzzle flashes, tracers, impacts. */
export const fx = {
  flashes: [] as { x: number; y: number; z: number; t: number; s: number }[],
  tracers: [] as { ax: number; ay: number; az: number; bx: number; by: number; bz: number; t: number }[],
  hits: [] as { x: number; y: number; z: number; t: number; blood: boolean }[],
};
export function flash(x: number, y: number, z: number, s = 1) { fx.flashes.push({ x, y, z, t: 0.06, s }); if (fx.flashes.length > 24) fx.flashes.shift(); }
export function tracer(ax: number, ay: number, az: number, bx: number, by: number, bz: number) { fx.tracers.push({ ax, ay, az, bx, by, bz, t: 0.07 }); if (fx.tracers.length > 32) fx.tracers.shift(); }
export function impact(x: number, y: number, z: number, blood: boolean) { fx.hits.push({ x, y, z, t: 0.35, blood }); if (fx.hits.length > 32) fx.hits.shift(); }
export function tickFx(dt: number) {
  for (const a of [fx.flashes, fx.tracers, fx.hits] as { t: number }[][]) for (let i = a.length - 1; i >= 0; i--) if ((a[i].t -= dt) <= 0) a.splice(i, 1);
}
