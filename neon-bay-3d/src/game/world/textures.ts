import * as THREE from 'three';
import { mulberry } from './rng';

type Ctx = CanvasRenderingContext2D;
function canvas(w: number, h: number, draw: (c: Ctx, w: number, h: number) => void) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d')!; draw(c, w, h); return cv;
}
function tex(cv: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
}
function noise(c: Ctx, w: number, h: number, amt: number, seed: number, size = 2) {
  const r = mulberry(seed);
  for (let i = 0; i < (w * h) / (size * size) / 3; i++) { const v = Math.floor(r() * 255); c.fillStyle = `rgba(${v},${v},${v},${amt})`; c.fillRect(r() * w, r() * h, size, size); }
}

export interface FacadeSet { map: THREE.Texture; emissive: THREE.Texture; rough: THREE.Texture; normal: THREE.Texture; su: number; sv: number; }

/** Height canvas (white = out, black = in) -> tangent-space normal map. */
function normalFromHeight(hc: HTMLCanvasElement, strength: number) {
  const w = hc.width, h = hc.height, src = hc.getContext('2d')!.getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas'); out.width = w; out.height = h; const oc = out.getContext('2d')!, id = oc.createImageData(w, h);
  const H = (x: number, y: number) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), k = (y * w + x) * 4;
    id.data[k] = (-dx / l * 0.5 + 0.5) * 255; id.data[k + 1] = (dy / l * 0.5 + 0.5) * 255; id.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; id.data[k + 3] = 255;
  }
  oc.putImageData(id, 0, 0); return out;
}

/** Facade with a window grid. cols x rows windows per texture repeat; su/sv = meters covered by one repeat. */
function facade(opts: { cols: number; rows: number; su: number; sv: number; wall: string; glass: string; frame: string; winW: number; winH: number; shop?: boolean; brick?: boolean; corrug?: boolean; seed: number }): FacadeSet {
  const W = 512, H = 512, cw = W / opts.cols, ch = H / opts.rows, r = mulberry(opts.seed);
  const lit: boolean[] = []; for (let i = 0; i < opts.cols * opts.rows; i++) lit.push(r() < 0.42);
  const warm: boolean[] = lit.map(() => r() < 0.75);
  const rectOf = (cx: number, cy: number) => { const ww = cw * opts.winW, hh = ch * opts.winH; return [cx * cw + (cw - ww) / 2, cy * ch + (ch - hh) / 2, ww, hh]; };
  const isShopRow = (cy: number) => opts.shop && cy === opts.rows - 1;
  const map = canvas(W, H, (c) => {
    c.fillStyle = opts.wall; c.fillRect(0, 0, W, H);
    if (opts.brick) { c.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < H; y += 8) { c.fillRect(0, y, W, 1); for (let x = (y / 8) % 2 ? 0 : 8; x < W; x += 16) c.fillRect(x, y, 1, 8); } }
    if (opts.corrug) { for (let x = 0; x < W; x += 6) { c.fillStyle = x % 12 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.14)'; c.fillRect(x, 0, 3, H); } }
    noise(c, W, H, 0.05, opts.seed + 1);
    // grime gradient toward the bottom of each repeat and streaks
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.18)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let cy = 0; cy < opts.rows; cy++) for (let cx = 0; cx < opts.cols; cx++) {
      if (opts.corrug && cy !== 1) continue;
      let [x, y, ww, hh] = rectOf(cx, cy);
      if (isShopRow(cy)) { x = cx * cw + 2; ww = cw - 4; y = cy * ch + ch * 0.12; hh = ch * 0.78; }
      c.fillStyle = opts.frame; c.fillRect(x - 3, y - 3, ww + 6, hh + 6);
      const gg = c.createLinearGradient(x, y, x + ww, y + hh); gg.addColorStop(0, opts.glass); gg.addColorStop(1, '#1b2433'); c.fillStyle = gg; c.fillRect(x, y, ww, hh);
      c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(x, y, ww * 0.35, hh);
      if (!isShopRow(cy) && r() < 0.35) { c.fillStyle = 'rgba(220,210,190,.55)'; c.fillRect(x, y, ww, hh * (0.3 + r() * 0.5)); }
      if (!opts.corrug) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x - 3, y + hh + 3, ww + 6, 3); }
    }
    if (opts.shop) { const y = (opts.rows - 1) * ch; c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, y, W, 6); }
  });
  const emissive = canvas(W, H, (c) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    for (let cy = 0; cy < opts.rows; cy++) for (let cx = 0; cx < opts.cols; cx++) {
      const k = cy * opts.cols + cx; if (opts.corrug && cy !== 1) continue;
      let [x, y, ww, hh] = rectOf(cx, cy);
      if (isShopRow(cy)) { x = cx * cw + 2; ww = cw - 4; y = cy * ch + ch * 0.12; hh = ch * 0.78; c.fillStyle = '#ffe3b0'; c.fillRect(x, y, ww, hh); continue; }
      if (!lit[k]) continue; c.fillStyle = warm[k] ? '#ffcf86' : '#9fd8ff'; c.fillRect(x, y, ww, hh);
    }
  });
  const rough = canvas(W, H, (c) => {
    c.fillStyle = '#e0e0e0'; c.fillRect(0, 0, W, H);
    for (let cy = 0; cy < opts.rows; cy++) for (let cx = 0; cx < opts.cols; cx++) { if (opts.corrug && cy !== 1) continue; let [x, y, ww, hh] = rectOf(cx, cy); if (isShopRow(cy)) { x = cx * cw + 2; ww = cw - 4; y = cy * ch + ch * 0.12; hh = ch * 0.78; } c.fillStyle = '#202020'; c.fillRect(x, y, ww, hh); }
  });
  // relief: wall mid-grey, frames stand out, glass sits back, sills cast a lip; brick mortar and corrugation grooves
  const height = canvas(W, H, (c) => {
    c.fillStyle = '#808080'; c.fillRect(0, 0, W, H);
    if (opts.brick) { c.fillStyle = '#5a5a5a'; for (let y = 0; y < H; y += 8) { c.fillRect(0, y, W, 1.5); for (let x = (y / 8) % 2 ? 0 : 8; x < W; x += 16) c.fillRect(x, y, 1.5, 8); } }
    if (opts.corrug) for (let x = 0; x < W; x += 6) { c.fillStyle = x % 12 ? '#9a9a9a' : '#606060'; c.fillRect(x, 0, 3, H); }
    for (let cy = 0; cy < opts.rows; cy++) for (let cx = 0; cx < opts.cols; cx++) {
      if (opts.corrug && cy !== 1) continue;
      let [x, y, ww, hh] = rectOf(cx, cy);
      if (isShopRow(cy)) { x = cx * cw + 2; ww = cw - 4; y = cy * ch + ch * 0.12; hh = ch * 0.78; }
      c.fillStyle = '#b8b8b8'; c.fillRect(x - 3, y - 3, ww + 6, hh + 6);
      c.fillStyle = '#202020'; c.fillRect(x, y, ww, hh);
      if (!opts.corrug) { c.fillStyle = '#d0d0d0'; c.fillRect(x - 5, y + hh + 2, ww + 10, 4); }
      if (ww > 30) { c.fillStyle = '#707070'; c.fillRect(x + ww / 2 - 1, y, 2, hh); } // mullion
    }
  });
  return { map: tex(map), emissive: tex(emissive), rough: tex(rough, false), normal: tex(normalFromHeight(height, opts.brick ? 3.2 : 2.4), false), su: opts.su, sv: opts.sv };
}

let cache: ReturnType<typeof build> | null = null;
export const getTextures = () => (cache ||= build());

function build() {
  const glass = facade({ cols: 8, rows: 8, su: 26, sv: 28, wall: '#c9ced6', glass: '#5d7896', frame: '#8f99a8', winW: 0.86, winH: 0.8, seed: 11 });
  const office = facade({ cols: 6, rows: 8, su: 24, sv: 28, wall: '#e8e2d6', glass: '#46607a', frame: '#b9b2a4', winW: 0.6, winH: 0.55, seed: 12 });
  const brick = facade({ cols: 6, rows: 8, su: 22, sv: 26, wall: '#b46a54', glass: '#3c4f63', frame: '#e7ddd0', winW: 0.42, winH: 0.5, brick: true, seed: 13 });
  const shop = facade({ cols: 6, rows: 6, su: 24, sv: 21, wall: '#efe6d8', glass: '#47627f', frame: '#5b5048', winW: 0.5, winH: 0.5, shop: true, seed: 14 });
  const house = facade({ cols: 3, rows: 2, su: 12, sv: 6.4, wall: '#f4efe6', glass: '#3e5670', frame: '#ffffff', winW: 0.42, winH: 0.42, seed: 15 });
  const warehouse = facade({ cols: 8, rows: 3, su: 32, sv: 18, wall: '#c8ccd1', glass: '#3a4a5c', frame: '#9aa0a8', winW: 0.7, winH: 0.25, corrug: true, seed: 16 });
  const terminal = facade({ cols: 10, rows: 3, su: 40, sv: 18, wall: '#d5dde6', glass: '#6a8cb0', frame: '#c0c8d0', winW: 0.95, winH: 0.85, seed: 17 });

  const asphalt = tex(canvas(512, 512, (c, w, h) => {
    c.fillStyle = '#3d3f45'; c.fillRect(0, 0, w, h); noise(c, w, h, 0.25, 21, 2); noise(c, w, h, 0.12, 22, 4);
    const r = mulberry(23); c.strokeStyle = 'rgba(20,20,24,.55)'; c.lineWidth = 1.2;
    for (let k = 0; k < 9; k++) { c.beginPath(); let x = r() * w, y = r() * h; c.moveTo(x, y); for (let s = 0; s < 8; s++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; c.lineTo(x, y); } c.stroke(); }
    for (let k = 0; k < 4; k++) { c.fillStyle = 'rgba(25,25,30,.14)'; c.fillRect(r() * w, r() * h, 40 + r() * 90, 30 + r() * 70); }
    for (let k = 0; k < 6; k++) { const g = c.createRadialGradient(0, 0, 0, 0, 0, 30); g.addColorStop(0, 'rgba(10,10,12,.18)'); g.addColorStop(1, 'rgba(10,10,12,0)'); c.save(); c.translate(r() * w, r() * h); c.fillStyle = g; c.fillRect(-30, -30, 60, 60); c.restore(); }
  }));
  const sidewalk = tex(canvas(256, 256, (c, w, h) => {
    c.fillStyle = '#b9b6b0'; c.fillRect(0, 0, w, h); noise(c, w, h, 0.18, 31, 2);
    c.fillStyle = 'rgba(70,70,70,.45)'; for (let k = 0; k <= 4; k++) { c.fillRect(0, k * 64, w, 2); c.fillRect(k * 64, 0, 2, h); }
    const r = mulberry(32); for (let k = 0; k < 10; k++) { c.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.06})`; c.fillRect(Math.floor(r() * 4) * 64, Math.floor(r() * 4) * 64, 64, 64); }
  }));
  const grass = tex(canvas(256, 256, (c, w, h) => { c.fillStyle = '#4f7a3a'; c.fillRect(0, 0, w, h); noise(c, w, h, 0.25, 41, 2); const r = mulberry(42); for (let k = 0; k < 600; k++) { c.fillStyle = r() < 0.5 ? 'rgba(120,160,70,.35)' : 'rgba(40,70,30,.35)'; c.fillRect(r() * w, r() * h, 1, 3); } }));
  const sand = tex(canvas(256, 256, (c, w, h) => { c.fillStyle = '#d9c49a'; c.fillRect(0, 0, w, h); noise(c, w, h, 0.22, 51, 2); }));
  const dirt = tex(canvas(256, 256, (c, w, h) => { c.fillStyle = '#6c6a4a'; c.fillRect(0, 0, w, h); noise(c, w, h, 0.3, 61, 3); }));
  const concrete = tex(canvas(256, 256, (c, w, h) => { c.fillStyle = '#9c9a96'; c.fillRect(0, 0, w, h); noise(c, w, h, 0.2, 71, 2); c.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k <= 2; k++) { c.fillRect(0, k * 128, w, 2); c.fillRect(k * 128, 0, 2, h); } }));
  const roof = tex(canvas(256, 256, (c, w, h) => { c.fillStyle = '#7b7a7f'; c.fillRect(0, 0, w, h); noise(c, w, h, 0.3, 81, 2); }));
  const tiles = tex(canvas(256, 256, (c, w, h) => { c.fillStyle = '#d0d0d0'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, y + 13, w, 3); for (let x = (y / 16) % 2 ? 0 : 12; x < w; x += 24) c.fillRect(x, y, 2, 16); } noise(c, w, h, 0.12, 91, 2); }));
  // water normal map from summed waves
  const wn = canvas(256, 256, (c, w, h) => {
    const id = c.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = (x / w) * Math.PI * 2, v = (y / h) * Math.PI * 2;
      const dx = Math.cos(u * 3 + v) * 0.5 + Math.cos(u * 7 - v * 2) * 0.3 + Math.cos(u * 13 + v * 5) * 0.15;
      const dy = Math.cos(v * 4 - u) * 0.5 + Math.cos(v * 9 + u * 3) * 0.3 + Math.cos(v * 15 - u * 4) * 0.15;
      const k = (y * w + x) * 4; id.data[k] = 128 + dx * 60; id.data[k + 1] = 128 + dy * 60; id.data[k + 2] = 255; id.data[k + 3] = 255;
    }
    c.putImageData(id, 0, 0);
  });
  const waterN = tex(wn, false);
  const glow = tex(canvas(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }));
  return { glass, office, brick, shop, house, warehouse, terminal, asphalt, sidewalk, grass, sand, dirt, concrete, roof, tiles, waterN, glow };
}

export function labelTexture(text: string, color: string, w = 512, h = 128) {
  return tex(canvas(w, h, (c) => {
    c.fillStyle = 'rgba(10,8,20,.85)'; c.fillRect(0, 0, w, h);
    c.strokeStyle = color; c.lineWidth = 8; c.strokeRect(6, 6, w - 12, h - 12);
    c.fillStyle = color; c.font = `700 ${Math.floor(h * 0.5)}px "Arial Black", Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + 4);
  }));
}
