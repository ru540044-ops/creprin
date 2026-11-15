/**
 * What shiny things reflect: the sky from zenith to horizon, a band of city along the horizon, a few clouds, the ground.
 * A plain gradient gives paint and glass nothing to show; the skyline and the clouds are what make a car body read as
 * polished metal. Drawn into an equirectangular canvas (top row = straight up).
 */
export function drawEnv(c: CanvasRenderingContext2D, W: number, H: number, zen: string, hor: string, gnd: string, day: number) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, zen); g.addColorStop(0.3, zen); g.addColorStop(0.485, hor); g.addColorStop(0.5, hor); g.addColorStop(0.505, gnd); g.addColorStop(1, gnd);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // clouds: long soft streaks high up (only by day)
  let s = 12345; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  if (day > 0.05) for (let k = 0; k < 9; k++) {
    const x = rnd() * W, y = H * (0.1 + rnd() * 0.26), rx = W * (0.05 + rnd() * 0.07), ry = H * (0.012 + rnd() * 0.02);
    const cg = c.createRadialGradient(x, y, 0, x, y, rx); cg.addColorStop(0, `rgba(255,255,255,${0.75 * day})`); cg.addColorStop(1, 'rgba(255,255,255,0)');
    c.save(); c.translate(x, y); c.scale(1, ry / rx); c.translate(-x, -y); c.fillStyle = cg; c.fillRect(x - rx, y - rx, rx * 2, rx * 2);
    if (x < rx) { c.translate(W, 0); c.fillRect(x - rx, y - rx, rx * 2, rx * 2); } c.restore();
  }
  // the city along the horizon: blocks of different heights, darker than the sky behind them
  const dark = day > 0.5 ? 'rgba(38,48,66,' : 'rgba(6,8,14,';
  for (let x = 0; x < W;) { const w = 2 + Math.floor(rnd() * 5), h = H * (0.012 + rnd() * rnd() * 0.075); c.fillStyle = dark + (0.55 + rnd() * 0.35) + ')'; c.fillRect(x, H * 0.5 - h, w, h + 1); x += w; }
  // the road surface just below the horizon is lighter than the ground further down (so sills pick up a soft band)
  const rg = c.createLinearGradient(0, H * 0.5, 0, H * 0.62); rg.addColorStop(0, `rgba(170,170,170,${0.22 * day})`); rg.addColorStop(1, 'rgba(170,170,170,0)'); c.fillStyle = rg; c.fillRect(0, H * 0.5, W, H * 0.12);
}
