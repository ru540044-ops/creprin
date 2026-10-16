'use strict';
// ===== 描画 =====
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const lightCv = document.createElement('canvas'), lctx = lightCv.getContext('2d');
let W = 1, H = 1, DPR = 1, MAX_DPR = 2;
const LS = 0.5;
const cam = { x: 0, y: 0, zoom: 0.8 };
const FONT_NUM = "'Bebas Neue', Impact, 'Arial Narrow', sans-serif";
const FONT_JP = "'Zen Kaku Gothic New', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";
const FONT_BIG = "'Dela Gothic One', 'Zen Kaku Gothic New', sans-serif";

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  lightCv.width = Math.ceil(W * LS); lightCv.height = Math.ceil(H * LS);
}
addEventListener('resize', resize);

// ===== スプライト =====
const SPR = {};
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function buildSprites() {
  let [c, g] = mkCanvas(80, 80);
  g.translate(40, 40);
  for (let k = 0; k < 9; k++) {
    g.save(); g.rotate(k / 9 * TAU + (k % 2) * 0.25);
    const L = k % 2 ? 30 : 36;
    g.fillStyle = k % 2 ? '#2e8b3a' : '#3fae48';
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * 0.45, -9, L, -1); g.quadraticCurveTo(L * 0.45, 6, 0, 0); g.fill();
    g.strokeStyle = '#1e6328'; g.lineWidth = 1; g.beginPath(); g.moveTo(2, 0); g.quadraticCurveTo(L * 0.45, -2, L - 2, -1); g.stroke();
    g.restore();
  }
  g.fillStyle = '#7a5a32'; g.beginPath(); g.arc(0, 0, 4, 0, TAU); g.fill();
  SPR.palm = c;
  [c, g] = mkCanvas(80, 80);
  g.translate(40, 40);
  g.fillStyle = '#2b6e33'; g.beginPath(); g.arc(0, 0, 25, 0, TAU); g.fill();
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * TAU;
    g.fillStyle = '#3a8c42'; g.beginPath(); g.arc(Math.cos(a) * 13, Math.sin(a) * 13, 12, 0, TAU); g.fill();
  }
  g.fillStyle = '#56b05c'; g.beginPath(); g.arc(-6, -6, 10, 0, TAU); g.fill();
  g.fillStyle = '#6cc571'; g.beginPath(); g.arc(-8, -8, 5, 0, TAU); g.fill();
  SPR.oak = c;
  // ライト用の放射グラデーション（毎フレーム生成しない）
  const glow = (col) => {
    const [gc, gg] = mkCanvas(128, 128);
    const gr = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, `rgba(${col},1)`); gr.addColorStop(0.45, `rgba(${col},0.55)`); gr.addColorStop(1, `rgba(${col},0)`);
    gg.fillStyle = gr; gg.fillRect(0, 0, 128, 128); return gc;
  };
  SPR.light = glow('0,0,0'); SPR.warm = glow('255,200,120'); SPR.red = glow('255,40,40'); SPR.blue = glow('40,110,255');
  SPR.blood = glow('110,8,14'); SPR.scorch = glow('10,10,10');
  // ヘッドライトの円錐
  const [hc, hg] = mkCanvas(220, 160);
  const hgr = hg.createRadialGradient(0, 80, 0, 0, 80, 210);
  hgr.addColorStop(0, 'rgba(0,0,0,0.9)'); hgr.addColorStop(1, 'rgba(0,0,0,0)');
  hg.fillStyle = hgr; hg.beginPath(); hg.moveTo(0, 72); hg.lineTo(0, 88); hg.lineTo(210, 160); hg.lineTo(210, 0); hg.closePath(); hg.fill();
  SPR.cone = hc;
}

// ===== 時間帯 =====
function darkness() {
  const h = G.clock / 60;
  if (h >= 7 && h < 18) return 0;
  if (h >= 20.5 || h < 4.5) return 0.62;
  if (h >= 18) return (h - 18) / 2.5 * 0.62;
  return (1 - (h - 4.5) / 2.5) * 0.62;
}
function sunsetTint() {
  const h = G.clock / 60;
  if (h >= 16.5 && h < 20) return Math.sin((h - 16.5) / 3.5 * Math.PI) * 0.2;
  if (h >= 5 && h < 8) return Math.sin((h - 5) / 3 * Math.PI) * 0.13;
  return 0;
}

const proj = (x, y, k) => [x + (x - cam.x) * k, y + (y - cam.y) * k];
function rrect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }

// ===== 建物 =====
function buildingFaces(b) {
  const x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.d, f = [];
  if (cam.y > y1) f.push([x0, y1, x1, y1, b.wallNS]);
  if (cam.y < y0) f.push([x1, y0, x0, y0, b.wallNS]);
  if (cam.x > x1) f.push([x1, y1, x1, y0, b.wallEW]);
  if (cam.x < x0) f.push([x0, y0, x0, y1, b.wallEW]);
  return f;
}
function drawBuilding(b, dark) {
  const k = b.h / (CAMH - b.h);
  const faces = buildingFaces(b);
  for (const [ax, ay, cx, cy, col] of faces) {
    const [tax, tay] = proj(ax, ay, k), [tcx, tcy] = proj(cx, cy, k);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(cx, cy); ctx.lineTo(tcx, tcy); ctx.lineTo(tax, tay); ctx.closePath(); ctx.fill();
    // 窓の帯
    ctx.fillStyle = dark > 0.3 ? 'rgba(15,20,35,0.55)' : b.winDay;
    ctx.beginPath();
    for (let f = 0; f < b.floors; f++) {
      const h0 = (f + 0.28) / b.floors * b.h, h1 = (f + 0.78) / b.floors * b.h;
      const k0 = h0 / (CAMH - h0), k1 = h1 / (CAMH - h1);
      const p0 = proj(ax, ay, k0), p1 = proj(cx, cy, k0), p2 = proj(cx, cy, k1), p3 = proj(ax, ay, k1);
      ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]); ctx.closePath();
    }
    ctx.fill();
    if (b.glass) {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.beginPath();
      const n = Math.max(2, Math.round(Math.hypot(cx - ax, cy - ay) / 16));
      for (let i = 1; i < n; i++) {
        const u = i / n, bx = lerp(ax, cx, u), by = lerp(ay, cy, u), t = proj(bx, by, k);
        ctx.moveTo(bx, by); ctx.lineTo(t[0], t[1]);
      }
      ctx.stroke();
    }
  }
  const [rx0, ry0] = proj(b.x, b.y, k), [rx1, ry1] = proj(b.x + b.w, b.y + b.d, k);
  const rw = rx1 - rx0, rh = ry1 - ry0;
  ctx.fillStyle = b.roof; ctx.fillRect(rx0, ry0, rw, rh);
  ctx.strokeStyle = b.edge; ctx.lineWidth = 2; ctx.strokeRect(rx0 + 1, ry0 + 1, rw - 2, rh - 2);
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(rx0 + 3, ry0 + 3, rw - 6, 3);
  const cxr = rx0 + rw / 2, cyr = ry0 + rh / 2, m = Math.min(rw, rh);
  if (b.kind === 'hospital') {
    ctx.fillStyle = '#e63946'; const s = m * 0.12;
    ctx.fillRect(cxr - s, cyr - s * 3, s * 2, s * 6); ctx.fillRect(cxr - s * 3, cyr - s, s * 6, s * 2);
  } else if (b.kind === 'police') {
    ctx.fillStyle = '#1f3c88'; ctx.fillRect(rx0 + 4, cyr - rh * 0.18, rw - 8, rh * 0.36);
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(rh * 0.24)}px ${FONT_NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('POLICE', cxr, cyr + 1);
  } else if (b.kind === 'spray') {
    for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#ff2bd6', '#2bf0ff', '#ffd23f', '#3dff7a', '#ff7a1a'][i]; ctx.fillRect(rx0 + 4, ry0 + 4 + i * (rh - 8) / 5, rw - 8, (rh - 8) / 10); }
    ctx.fillStyle = '#222'; ctx.font = `bold ${Math.round(rh * 0.28)}px ${FONT_NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('SPRAY', cxr, cyr);
  }
  for (const p of b.props) {
    const x = rx0 + p.u * rw, y = ry0 + p.v * rh, w = p.w * rw, h = p.h * rh;
    if (p.kind === 'tank') {
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; circle(x + w / 2 + 3, y + h / 2 + 3, Math.min(w, h) / 2);
      ctx.fillStyle = '#8b6b4a'; circle(x + w / 2, y + h / 2, Math.min(w, h) / 2);
      ctx.fillStyle = '#6d5238'; circle(x + w / 2, y + h / 2, Math.min(w, h) / 3.5);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x + 3, y + 3, w, h);
      ctx.fillStyle = '#b8bcc2'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#8d9299'; ctx.fillRect(x + w * 0.2, y + h * 0.2, w * 0.6, h * 0.6);
    }
  }
  if (b.heli) {
    const r = m * 0.28;
    ctx.fillStyle = '#3a3f47'; circle(cxr, cyr, r);
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cxr, cyr, r * 0.85, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(r)}px ${FONT_NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('H', cxr, cyr + 1);
  }
}

// 夜間の発光（窓・ネオン）— 暗闇レイヤーの上に描く
function drawBuildingEmissive(b, a) {
  const k = b.h / (CAMH - b.h);
  ctx.fillStyle = `rgba(255,214,140,${0.85 * a})`;
  ctx.beginPath();
  const faces = buildingFaces(b);
  for (let fi = 0; fi < faces.length; fi++) {
    const [ax, ay, cx, cy] = faces[fi];
    const n = Math.max(2, Math.round(Math.hypot(cx - ax, cy - ay) / 18));
    for (let f = 0; f < b.floors; f++) {
      const h0 = (f + 0.3) / b.floors * b.h, h1 = (f + 0.75) / b.floors * b.h;
      const k0 = h0 / (CAMH - h0), k1 = h1 / (CAMH - h1);
      for (let i = 0; i < n; i++) {
        if (hash2(b.seed + i * 31 + fi * 977, f + Math.floor(G.clock / 90)) > (b.glass ? 0.42 : 0.3)) continue;
        const u0 = (i + 0.15) / n, u1 = (i + 0.85) / n;
        const bx0 = lerp(ax, cx, u0), by0 = lerp(ay, cy, u0), bx1 = lerp(ax, cx, u1), by1 = lerp(ay, cy, u1);
        const p0 = proj(bx0, by0, k0), p1 = proj(bx1, by1, k0), p2 = proj(bx1, by1, k1), p3 = proj(bx0, by0, k1);
        ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.lineTo(p3[0], p3[1]); ctx.closePath();
      }
    }
  }
  ctx.fill();
  if (b.neon) {
    const [rx0, ry0] = proj(b.x, b.y, k), [rx1, ry1] = proj(b.x + b.w, b.y + b.d, k);
    const flick = 0.85 + 0.15 * Math.sin(G.t * 9 + b.seed);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = b.neon;
    ctx.globalAlpha = 0.25 * a * flick; ctx.lineWidth = 10; ctx.strokeRect(rx0 + 3, ry0 + 3, rx1 - rx0 - 6, ry1 - ry0 - 6);
    ctx.globalAlpha = 0.9 * a * flick; ctx.lineWidth = 2.5; ctx.strokeRect(rx0 + 3, ry0 + 3, rx1 - rx0 - 6, ry1 - ry0 - 6);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
}

function drawTree(t) {
  const k = t.h / (CAMH - t.h);
  const [tx, ty] = proj(t.x, t.y, k);
  ctx.fillStyle = 'rgba(10,20,45,0.2)';
  ctx.beginPath(); ctx.ellipse(t.x + t.h * 0.3, t.y + t.h * 0.2, 17 * t.s, 15 * t.s, 0, 0, TAU); ctx.fill();
  if (t.kind === 'palm') {
    ctx.strokeStyle = '#8a6a42'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(tx, ty); ctx.stroke();
  }
  const pl = G.player, near = G.state !== 'title' && Math.abs(tx - pl.x) < 40 && Math.abs(ty - pl.y) < 40;
  ctx.save(); ctx.translate(tx, ty); ctx.rotate(t.rot + Math.sin(G.t * 0.8 + t.x) * 0.04); ctx.scale(t.s, t.s);
  if (near) ctx.globalAlpha = 0.4;
  ctx.drawImage(t.kind === 'palm' ? SPR.palm : SPR.oak, -40, -40);
  ctx.restore();
}

function drawUmbrella(p) {
  const k = 22 / (CAMH - 22), [x, y] = proj(p.x, p.y, k);
  ctx.fillStyle = 'rgba(10,20,45,0.18)'; circle(p.x + 7, p.y + 5, 15);
  ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? p.color : '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 16, i / 8 * TAU, (i + 1) / 8 * TAU); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ===== 車・人 =====
function drawCar(c) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.angle);
  const L = c.len, Wd = c.wid, hl = L / 2, hw = Wd / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rrect(ctx, -hl + 3, -hw + 3, L, Wd, 5); ctx.fill();
  const body = c.wrecked ? '#2b2724' : c.color;
  ctx.fillStyle = body; rrect(ctx, -hl, -hw, L, Wd, 5); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-hl + 2, hw - 3, L - 4, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-hl + 3, -hw + 1, L - 6, 2);
  if (c.type === 'van') {
    ctx.fillStyle = c.wrecked ? '#1c1a18' : shadeHex(c.color, 0.12); ctx.fillRect(-hl + 3, -hw + 2, L * 0.62, Wd - 4);
    ctx.fillStyle = c.wrecked ? '#111' : '#1d2733'; ctx.fillRect(hl - L * 0.3, -hw + 2, L * 0.12, Wd - 4);
  } else {
    ctx.fillStyle = c.wrecked ? '#111' : '#1d2733';
    ctx.beginPath(); ctx.moveTo(hl * 0.55, -hw + 2); ctx.lineTo(hl * 0.18, -hw + 3); ctx.lineTo(hl * 0.18, hw - 3); ctx.lineTo(hl * 0.55, hw - 2); ctx.closePath(); ctx.fill();
    ctx.fillRect(-hl * 0.68, -hw + 3, hl * 0.2, Wd - 6);
    ctx.fillStyle = c.wrecked ? '#24201d' : shadeHex(c.color.startsWith('#') ? c.color : '#888888', 0.1);
    ctx.fillRect(-hl * 0.48, -hw + 3, hl * 0.66, Wd - 6);
  }
  if (c.type === 'sports' && !c.wrecked) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(-hl + 2, -2, L - 4, 1.5); ctx.fillRect(-hl + 2, 1, L - 4, 1.5); }
  if (c.type === 'taxi' && !c.wrecked) { ctx.fillStyle = '#222'; ctx.fillRect(-4, -hw + 3, 8, Wd - 6); ctx.fillStyle = '#fff6a0'; ctx.fillRect(-2.5, -4, 5, 8); }
  if (c.type === 'police' && !c.wrecked) {
    ctx.fillStyle = '#f2f2f2'; ctx.fillRect(-hl * 0.45, -hw, hl * 0.9, 3); ctx.fillRect(-hl * 0.45, hw - 3, hl * 0.9, 3);
    ctx.fillStyle = '#f2f2f2'; ctx.fillRect(-hl * 0.48, -hw + 3, hl * 0.66, Wd - 6);
    const on = c.siren && Math.floor(G.t * 8) % 2 === 0;
    ctx.fillStyle = c.siren ? (on ? '#ff2a2a' : '#5a1010') : '#7a2020'; ctx.fillRect(-5, -hw + 3, 6, hw - 3);
    ctx.fillStyle = c.siren ? (!on ? '#2a6bff' : '#10205a') : '#20307a'; ctx.fillRect(-5, 0, 6, hw - 3);
  }
  if (!c.wrecked) {
    ctx.fillStyle = '#fff6c8'; ctx.fillRect(hl - 3, -hw + 2, 3, 4); ctx.fillRect(hl - 3, hw - 6, 3, 4);
    ctx.fillStyle = c.fwd < -5 || c.throttle < 0 ? '#ff3030' : '#a01818'; ctx.fillRect(-hl, -hw + 2, 2, 4); ctx.fillRect(-hl, hw - 6, 2, 4);
  }
  ctx.restore();
}

function drawPed(p) {
  if (p.inCar) return;
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
  if (p.dead) {
    ctx.fillStyle = p.pants; ctx.fillRect(-12, -4, 9, 3); ctx.fillRect(-12, 1, 9, 3);
    ctx.fillStyle = p.shirt; ctx.beginPath(); ctx.ellipse(0, 0, 6, 7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = p.skin; ctx.fillRect(-1, -11, 7, 2.5); ctx.fillRect(2, 8, 6, 2.5);
    ctx.fillStyle = p.hat ? '#0b1a40' : p.hair; circle(8.5, 0, 3.8);
    ctx.restore(); return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(2, 2, 6, 8, 0, 0, TAU); ctx.fill();
  const sw = p.moving > 5 ? Math.sin(p.walkT) * 5 : 0;
  ctx.fillStyle = p.pants; ctx.fillRect(sw - 3, -5, 6, 3.5); ctx.fillRect(-sw - 3, 1.5, 6, 3.5);
  const armed = p.weapon && p.weapon !== 'fist';
  if (armed) {
    ctx.fillStyle = '#1b1b1b'; ctx.fillRect(5, 0, p.weapon === 'pistol' ? 8 : 12, 2.6);
    ctx.fillStyle = p.skin; circle(6, 1.5, 2.2); circle(4, -4, 2);
  } else {
    ctx.fillStyle = p.skin; circle(sw * 0.6 + 1, -7, 2); circle(-sw * 0.6 + 1, 7, 2);
  }
  ctx.fillStyle = p.shirt; ctx.beginPath(); ctx.ellipse(0, 0, 4.6, 7.4, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = p.skin; circle(0.8, 0, 3.6);
  ctx.fillStyle = p.hat ? '#0b1a40' : p.hair; ctx.beginPath(); ctx.arc(-0.3, 0, 3.7, Math.PI * 0.55, Math.PI * 1.45); ctx.fill();
  if (p.hat) { ctx.fillStyle = '#0b1a40'; circle(0, 0, 3.4); ctx.fillRect(2, -3, 2.5, 6); }
  ctx.restore();
}

function drawHeli(h) {
  const k = 160 / (CAMH - 160);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.save(); ctx.translate(h.x + 60, h.y + 40); ctx.rotate(h.angle);
  ctx.beginPath(); ctx.ellipse(0, 0, 20, 10, 0, 0, TAU); ctx.fill(); ctx.fillRect(-42, -2, 26, 4);
  ctx.restore();
  const [x, y] = proj(h.x, h.y, k * 0.3);
  ctx.save(); ctx.translate(x, y); ctx.rotate(h.angle);
  ctx.fillStyle = '#1b2a4a'; ctx.fillRect(-44, -2.5, 30, 5);
  ctx.fillStyle = '#fff'; ctx.fillRect(-47, -8, 4, 16);
  ctx.fillStyle = '#e9edf3'; ctx.beginPath(); ctx.ellipse(0, 0, 21, 11, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#1b2a4a'; ctx.beginPath(); ctx.ellipse(-4, 0, 15, 11, 0, Math.PI * 0.5, Math.PI * 1.5); ctx.fill();
  ctx.fillStyle = '#5fa9d6'; ctx.beginPath(); ctx.ellipse(11, 0, 8, 8, 0, -Math.PI / 2, Math.PI / 2); ctx.fill();
  ctx.strokeStyle = 'rgba(30,30,30,0.55)'; ctx.lineWidth = 3;
  for (let i = 0; i < 2; i++) { const a = h.rot + i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * -38, Math.sin(a) * -38); ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38); ctx.stroke(); }
  ctx.fillStyle = 'rgba(120,120,120,0.12)'; circle(0, 0, 38);
  ctx.fillStyle = '#333'; circle(0, 0, 3);
  ctx.restore();
}

function drawMarker(m) {
  const pulse = 0.5 + 0.5 * Math.sin(G.t * 4);
  ctx.globalAlpha = m.faint ? 0.25 : 0.22 + 0.12 * pulse;
  ctx.fillStyle = m.color; circle(m.x, m.y, m.r);
  ctx.globalAlpha = m.faint ? 0.4 : 0.9;
  ctx.strokeStyle = m.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * (0.75 + 0.25 * pulse), 0, TAU); ctx.stroke();
  ctx.globalAlpha = 1;
}
function drawMarkerArrow(m, color) {
  if (m.faint) return;
  const bob = Math.sin(G.t * 5) * 6;
  const k = 70 / (CAMH - 70), [x, y] = proj(m.x, m.y, k);
  ctx.fillStyle = color || m.color; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 11, y - 26 + bob); ctx.lineTo(x + 11, y - 26 + bob); ctx.lineTo(x, y - 8 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (m.label) { ctx.font = `20px ${FONT_NUM}`; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeText(m.label, x, y - 34 + bob); ctx.fillStyle = '#fff'; ctx.fillText(m.label, x, y - 34 + bob); }
}
function drawContact(c) {
  const pulse = 0.5 + 0.5 * Math.sin(G.t * 3);
  ctx.globalAlpha = 0.3 + 0.2 * pulse; ctx.fillStyle = c.color; circle(c.x, c.y, 22);
  ctx.globalAlpha = 1; ctx.strokeStyle = c.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x, c.y, 16 + pulse * 6, 0, TAU); ctx.stroke();
  const k = 60 / (CAMH - 60), [x, y] = proj(c.x, c.y, k), bob = Math.sin(G.t * 3) * 4;
  ctx.fillStyle = c.color; circle(x, y - 20 + bob, 13);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 20 + bob, 13, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#1a1a1a'; ctx.font = `20px ${FONT_NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('M', x, y - 19 + bob); ctx.textBaseline = 'alphabetic';
}
function drawPickup(k) {
  if (k.respawn > 0) return;
  const info = PICKUP_INFO[k.type], bob = Math.sin(G.t * 4 + k.x) * 2, a = G.t * 2 + k.y;
  if (k.once && k.life < 5 && Math.floor(G.t * 8) % 2) return;
  ctx.globalAlpha = 0.35; ctx.fillStyle = info.color; circle(k.x, k.y, 11 + Math.sin(a) * 2); ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(k.x, k.y - 3 + bob);
  ctx.fillStyle = '#111'; ctx.strokeStyle = info.color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = info.color;
  if (k.type === 'health') { ctx.fillRect(-1.5, -5, 3, 10); ctx.fillRect(-5, -1.5, 10, 3); }
  else if (k.type === 'armor') { ctx.beginPath(); ctx.moveTo(-4.5, -4.5); ctx.lineTo(4.5, -4.5); ctx.lineTo(4, 1); ctx.lineTo(0, 5); ctx.lineTo(-4, 1); ctx.closePath(); ctx.fill(); }
  else if (k.type === 'cash') { ctx.font = `13px ${FONT_NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', 0, 1); ctx.textBaseline = 'alphabetic'; }
  else { ctx.fillRect(-5, -1.5, 9, 3); ctx.fillRect(-4, 0, 3, 4); if (k.type !== 'pistol') ctx.fillRect(2, -3, 3, 1.5); }
  ctx.restore();
}

// ===== メイン描画 =====
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#16658c'; ctx.fillRect(0, 0, W, H);
  const z = cam.zoom, shx = G.shake > 0 ? rand(-G.shake, G.shake) : 0, shy = G.shake > 0 ? rand(-G.shake, G.shake) : 0;
  const hw = W / 2 / z, hh = H / 2 / z;
  const v = { x0: cam.x - hw - 40, y0: cam.y - hh - 40, x1: cam.x + hw + 40, y1: cam.y + hh + 40 };
  const inV = (x, y, m = 0) => x > v.x0 - m && x < v.x1 + m && y > v.y0 - m && y < v.y1 + m;
  const dark = darkness();

  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-cam.x + shx, -cam.y + shy);

  // 地面
  const CHP = World.CH * T;
  const cx0 = Math.max(0, Math.floor(v.x0 / CHP)), cx1 = Math.min(World.cw - 1, Math.floor(v.x1 / CHP));
  const cy0 = Math.max(0, Math.floor(v.y0 / CHP)), cy1 = Math.min(World.chh - 1, Math.floor(v.y1 / CHP));
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) ctx.drawImage(World.chunks[cy * World.cw + cx], cx * CHP, cy * CHP);

  // 波
  const seaX = (CITY + BEACH) * T;
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 2; ctx.beginPath();
  for (let y = Math.floor(v.y0 / 46) * 46; y < v.y1; y += 46) {
    for (let x = Math.max(seaX + 30, Math.floor(v.x0 / 90) * 90); x < v.x1; x += 90) {
      const o = Math.sin(G.t * 1.2 + y * 0.05 + x * 0.01) * 14 + ((y / 46) % 2) * 45;
      ctx.moveTo(x + o, y); ctx.lineTo(x + o + 20, y);
    }
  }
  ctx.stroke();
  if (seaX > v.x0 && seaX < v.x1 + 40) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 4; ctx.beginPath();
    for (let y = Math.max(0, v.y0); y < Math.min(MH * T, v.y1); y += 12) {
      const x = seaX + 4 + Math.sin(y * 0.03 + G.t * 1.5) * 5 + Math.sin(G.t * 0.7) * 4;
      if (y === Math.max(0, v.y0)) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // デカール
  for (const d of G.decals) {
    if (!inV(d.x, d.y, 60)) continue;
    ctx.globalAlpha = d.kind === 'blood' ? 0.9 : 0.8;
    ctx.drawImage(d.kind === 'blood' ? SPR.blood : SPR.scorch, d.x - d.r, d.y - d.r, d.r * 2, d.r * 2);
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = 'rgba(18,18,18,0.32)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath();
  for (const s of G.skids) { if (!inV(s[0], s[1])) continue; ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); }
  ctx.stroke();

  // スプレー屋パッド
  const sp = World.spray;
  if (inV(sp.x, sp.y, 40)) {
    ctx.fillStyle = 'rgba(255,159,67,0.25)'; ctx.fillRect(sp.x - 30, sp.y - 26, 60, 52);
    ctx.strokeStyle = '#ff9f43'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.strokeRect(sp.x - 30, sp.y - 26, 60, 52); ctx.setLineDash([]);
  }

  // マーカー・ピックアップ
  if (G.state !== 'title') {
    for (const c of Missions.contacts) if (!Missions.active && inV(c.x, c.y, 60)) drawContact(c);
    for (const m of Missions.markers) if (inV(m.x, m.y, 60)) drawMarker(m);
  }
  for (const k of G.pickups) if (inV(k.x, k.y, 20)) drawPickup(k);

  // 人・車
  for (const p of G.peds) if (p.dead && inV(p.x, p.y, 20)) drawPed(p);
  for (const p of G.peds) if (!p.dead && inV(p.x, p.y, 20) && p !== G.player) drawPed(p);
  if (G.state !== 'title' && !G.player.inCar) drawPed(G.player);
  for (const c of G.cars) if (inV(c.x, c.y, 40)) drawCar(c);

  // 弾
  ctx.lineCap = 'round';
  for (const b of G.projectiles) {
    if (!inV(b.x, b.y)) continue;
    if (b.rocket) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
      ctx.fillStyle = '#556b2f'; ctx.fillRect(-8, -2.5, 14, 5); ctx.fillStyle = '#ffb347'; circle(-10, 0, 3.5);
      ctx.restore();
    } else {
      ctx.strokeStyle = 'rgba(255,240,180,0.85)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }

  // 建物・木（奥から手前へ）
  const drawables = [];
  for (const b of World.buildings) {
    if (b.x + b.w < v.x0 - 260 || b.x > v.x1 + 260 || b.y + b.d < v.y0 - 260 || b.y > v.y1 + 260) continue;
    drawables.push({ o: b, t: 0, d: dist(b.x + b.w / 2, b.y + b.d / 2, cam.x, cam.y) });
  }
  for (const t of World.trees) if (inV(t.x, t.y, 60)) drawables.push({ o: t, t: 1, d: dist(t.x, t.y, cam.x, cam.y) });
  for (const p of World.props) if (p.kind === 'umbrella' && inV(p.x, p.y, 30)) drawables.push({ o: p, t: 2, d: dist(p.x, p.y, cam.x, cam.y) });
  drawables.sort((a, b) => b.d - a.d);
  for (const d of drawables) {
    if (d.t === 0) drawBuilding(d.o, dark); else if (d.t === 1) drawTree(d.o); else drawUmbrella(d.o);
  }

  if (G.heli) drawHeli(G.heli);

  // パーティクル
  for (const p of G.particles) {
    if (!inV(p.x, p.y, 30)) continue;
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    if (p.add) ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = p.color; circle(p.x, p.y, p.size);
    if (p.add) ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;

  // マーカー矢印（建物の上）
  if (G.state !== 'title') {
    for (const m of Missions.markers) if (inV(m.x, m.y, 60)) drawMarkerArrow(m);
    if (!Missions.active && G.player.inCar && G.wanted > 0 && inV(sp.x, sp.y, 60)) drawMarkerArrow({ x: sp.x, y: sp.y }, '#ff9f43');
  }
  ctx.restore();

  if (dark > 0.01) drawLighting(dark, v, inV, shx, shy);
  const tint = sunsetTint();
  if (tint > 0.005) { ctx.fillStyle = `rgba(255,110,60,${tint})`; ctx.fillRect(0, 0, W, H); }
  if (G.hurtT > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, 'rgba(200,0,0,0)'); g.addColorStop(1, `rgba(200,0,0,${G.hurtT * 0.9})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (G.state === 'wasted' || G.state === 'busted') {
    ctx.fillStyle = G.state === 'wasted' ? `rgba(60,0,0,${Math.min(0.45, G.deadT * 0.2)})` : `rgba(0,10,50,${Math.min(0.45, G.deadT * 0.2)})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (G.state !== 'title') drawHUD();
  if (G.showMap) drawBigMap();
}

// ===== ライティング =====
function drawLighting(dark, v, inV, shx, shy) {
  const z = cam.zoom, s = LS;
  const sx = (x) => ((x - cam.x + shx) * z + W / 2) * s, sy = (y) => ((y - cam.y + shy) * z + H / 2) * s;
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, lightCv.width, lightCv.height);
  lctx.fillStyle = `rgba(6,8,32,${dark})`; lctx.fillRect(0, 0, lightCv.width, lightCv.height);
  lctx.globalCompositeOperation = 'destination-out';
  const L = (x, y, r, a) => {
    if (!inV(x, y, r)) return;
    const px = sx(x), py = sy(y), rr = r * z * s;
    lctx.globalAlpha = a; lctx.drawImage(SPR.light, px - rr, py - rr, rr * 2, rr * 2);
  };
  for (const l of World.lamps) L(l.x, l.y, 115, 0.8);
  const pl = G.player;
  L(pl.x, pl.y, 150, 0.35);
  for (const c of G.cars) {
    if (!inV(c.x, c.y, 220)) continue;
    if (c.burnT >= 0) L(c.x, c.y, 110, 0.8);
    if (c.siren) L(c.x, c.y, 90, 0.5);
    if (c.wrecked || !(c.driver || c.siren)) continue;
    const ca = Math.cos(c.angle), sa = Math.sin(c.angle);
    const fx = c.x + ca * c.len / 2, fy = c.y + sa * c.len / 2, k = z * s;
    lctx.globalAlpha = 1;
    lctx.setTransform(k, 0, 0, k, sx(fx), sy(fy)); lctx.rotate(c.angle);
    lctx.drawImage(SPR.cone, 0, -80);
    lctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  for (const f of G.flashes) L(f.x, f.y, f.r, Math.min(1, f.t / f.max));
  for (const p of G.particles) if (p.add && p.size > 5) L(p.x, p.y, p.size * 5, 0.25 * p.life / p.max);
  if (G.heli) { const a = G.t * 0.9; L(pl.x + Math.cos(a) * 30, pl.y + Math.sin(a * 1.3) * 30, 95, 0.9); }
  for (const m of Missions.markers) L(m.x, m.y, 70, 0.5);
  for (const c of Missions.contacts) L(c.x, c.y, 60, 0.5);
  lctx.globalCompositeOperation = 'source-over'; lctx.globalAlpha = 1;
  ctx.drawImage(lightCv, 0, 0, W, H);

  // 発光物
  const a = dark / 0.62;
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-cam.x + shx, -cam.y + shy);
  for (const b of World.buildings) {
    if (b.x + b.w < v.x0 - 200 || b.x > v.x1 + 200 || b.y + b.d < v.y0 - 200 || b.y > v.y1 + 200) continue;
    drawBuildingEmissive(b, a);
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const l of World.lamps) {
    if (!inV(l.x, l.y, 40)) continue;
    ctx.globalAlpha = 0.35 * a; ctx.drawImage(SPR.warm, l.x - 40, l.y - 40, 80, 80);
  }
  ctx.globalAlpha = 1;
  for (const c of G.cars) {
    if (!inV(c.x, c.y, 60) || c.wrecked) continue;
    const ca = Math.cos(c.angle), sa = Math.sin(c.angle);
    if (c.driver || c.siren) {
      ctx.fillStyle = `rgba(255,250,210,${0.9 * a})`;
      for (const s of [-1, 1]) circle(c.x + ca * c.len / 2 - sa * s * (c.wid / 2 - 4), c.y + sa * c.len / 2 + ca * s * (c.wid / 2 - 4), 2.5);
      ctx.fillStyle = `rgba(255,40,40,${0.7 * a})`;
      for (const s of [-1, 1]) circle(c.x - ca * c.len / 2 - sa * s * (c.wid / 2 - 4), c.y - sa * c.len / 2 + ca * s * (c.wid / 2 - 4), 2.5);
    }
    if (c.siren) {
      ctx.globalAlpha = 0.5 * a + 0.15;
      ctx.drawImage(Math.floor(G.t * 8) % 2 === 0 ? SPR.red : SPR.blue, c.x - 60, c.y - 60, 120, 120);
      ctx.globalAlpha = 1;
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

// ===== HUD =====
const Hud = {
  big: null, flashes: [], area: null, veh: null, radio: null, helpMsg: null,
  bigMsg(title, sub, color, dur = 3.5, huge = false) { this.big = { title, sub, color, t: 0, dur, huge }; },
  flash(text, dur = 2.5) { this.flashes.push({ text, t: 0, dur }); if (this.flashes.length > 3) this.flashes.shift(); },
  showArea(text) { this.area = { text, t: 0, dur: 3.5 }; },
  showVeh(text) { this.veh = { text, t: 0, dur: 3 }; },
  showRadio(text, sub) { this.radio = { text, sub, t: 0, dur: 3 }; },
  help(text, dur) { this.helpMsg = { text, t: 0, dur }; },
  update(dt) {
    for (const k of ['big', 'area', 'veh', 'radio', 'helpMsg']) if (this[k]) { this[k].t += dt; if (this[k].t > this[k].dur) this[k] = null; }
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < f.dur);
  },
};
const fadeA = (m) => Math.min(1, m.t * 4, (m.dur - m.t) * 2.5);

function txt(s, x, y, size, color, align = 'left', font = FONT_NUM, ow = 4) {
  ctx.font = `${size}px ${font}`; ctx.textAlign = align; ctx.lineJoin = 'round';
  ctx.lineWidth = ow; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(s, x, y);
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
const TAG_COL = { y: '#ffd23f', g: '#3dff7a', r: '#ff5a6e', b: '#6ab8ff' };
function richText(s, x, y, size) {
  const segs = []; const re = /<(\w)>(.*?)<\/\1>|([^<]+)/g; let m;
  while ((m = re.exec(s))) segs.push(m[3] ? { t: m[3], c: '#ffffff' } : { t: m[2], c: TAG_COL[m[1]] || '#fff' });
  ctx.font = `700 ${size}px ${FONT_JP}`;
  const total = segs.reduce((a, g) => a + ctx.measureText(g.t).width, 0);
  let cx = x - total / 2;
  for (const g of segs) { jp(g.t, cx, y, size, g.c, 'left', 4); cx += ctx.measureText(g.t).width; }
}
function jp(s, x, y, size, color, align = 'center', ow = 4) {
  ctx.font = `700 ${size}px ${FONT_JP}`; ctx.textAlign = align; ctx.lineJoin = 'round';
  ctx.lineWidth = ow; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(s, x, y);
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
function star(x, y, r, fill, stroke) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
}

function drawHUD() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const pl = G.player, small = W < 700, S = small ? 0.78 : 1;
  const R = W - 18, top = 16;
  // 時計とお金
  const hh = Math.floor(G.clock / 60), mm = Math.floor(G.clock % 60);
  txt(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, R, top + 26 * S, 30 * S, '#f2f2f2', 'right');
  txt('$' + String(Math.max(0, G.money)).padStart(8, '0'), R, top + 62 * S, 40 * S, '#5fe08a', 'right', FONT_NUM, 5);
  // 体力・アーマー
  const bw = 150 * S, bx = R - bw, by = top + 74 * S;
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 2, by - 2, bw + 4, 12 * S + 4);
  ctx.fillStyle = '#4a0e12'; ctx.fillRect(bx, by, bw, 12 * S);
  ctx.fillStyle = pl.hp < 25 && Math.floor(G.t * 4) % 2 ? '#ff8080' : '#e0353f'; ctx.fillRect(bx, by, bw * clamp(pl.hp / 100, 0, 1), 12 * S);
  if (pl.armor > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 2, by + 14 * S, bw + 4, 8 * S + 4);
    ctx.fillStyle = '#3d8bff'; ctx.fillRect(bx, by + 16 * S, bw * pl.armor / 100, 8 * S);
  }
  // 手配度
  const w = G.wanted;
  for (let i = 0; i < 5; i++) {
    const on = i < w, blink = on && ((G.starFlash > 0 || (!G.seen && G.lostT > 0)) && Math.floor(G.t * 5) % 2);
    star(R - 12 * S - i * 28 * S, top + 118 * S, 11 * S, on ? (blink ? '#fff7c2' : '#ffd23f') : 'rgba(0,0,0,0.35)', on ? '#5a3d00' : 'rgba(255,255,255,0.35)');
  }
  // 武器
  const wpn = WEAPONS[pl.weapon];
  const wx = bx - 16 - 86 * S, wy = top + 6;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; rrect(ctx, wx, wy, 86 * S, 72 * S, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
  drawWeaponIcon(pl.weapon, wx + 43 * S, wy + 30 * S, S);
  jp(wpn.name, wx + 43 * S, wy + 62 * S, 12 * S, '#ffffff', 'center', 3);
  if (pl.weapon !== 'fist') txt(String(pl.ammo[pl.weapon]), wx + 80 * S, wy + 18 * S, 20 * S, '#ffd23f', 'right');

  // ミニマップ
  const mr = small ? 62 : 82, mx = (IS_TOUCH ? 18 : 22) + mr, my = IS_TOUCH ? 18 + mr : H - 22 - mr;
  drawMinimap(mx, my, mr);

  // ミッション
  const obj = Missions.objective;
  if (obj) richText(obj, W / 2, H - (IS_TOUCH ? 190 : 46), small ? 16 : 22);
  const tm = Missions.timer;
  if (tm != null) {
    const s = Math.max(0, Math.ceil(tm));
    txt(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, W / 2, 58, 48, s <= 10 && Math.floor(G.t * 4) % 2 ? '#ff5a6e' : '#ffffff', 'center', FONT_NUM, 6);
  }
  // 画面外マーカー矢印
  for (const m of Missions.markers) if (!m.faint) edgeArrow(m.x, m.y, m.color);

  // 大きなメッセージ
  const b = Hud.big;
  if (b) {
    ctx.globalAlpha = fadeA(b);
    const sz = b.huge ? Math.min(120, W / 6) : Math.min(64, W / 10);
    txt(b.title, W / 2, H * 0.38, sz, b.color, 'center', b.huge ? FONT_NUM : FONT_BIG, 8);
    if (b.sub) jp(b.sub, W / 2, H * 0.38 + sz * 0.55 + 10, small ? 15 : 20, '#ffffff', 'center', 5);
    ctx.globalAlpha = 1;
  }
  Hud.flashes.forEach((f, i) => { ctx.globalAlpha = fadeA(f); jp(f.text, W / 2, H * 0.62 + i * 30, small ? 16 : 20, '#fff7c2', 'center', 5); });
  ctx.globalAlpha = 1;
  if (Hud.area) { ctx.globalAlpha = fadeA(Hud.area); txt(Hud.area.text, W - 24, H - (IS_TOUCH ? 200 : 60), small ? 26 : 38, '#ffd8f0', 'right', FONT_BIG, 6); ctx.globalAlpha = 1; }
  if (Hud.veh) { ctx.globalAlpha = fadeA(Hud.veh); txt(Hud.veh.text, W - 24, H - (IS_TOUCH ? 160 : 24), small ? 18 : 26, '#9fe8ff', 'right', FONT_BIG, 5); ctx.globalAlpha = 1; }
  if (Hud.radio) {
    ctx.globalAlpha = fadeA(Hud.radio);
    txt(Hud.radio.text, W / 2, 110, small ? 26 : 34, '#ff7ad9', 'center', FONT_NUM, 5);
    jp(Hud.radio.sub, W / 2, 136, 14, '#ffffff', 'center', 3);
    ctx.globalAlpha = 1;
  }
  if (Hud.helpMsg) {
    ctx.globalAlpha = fadeA(Hud.helpMsg);
    ctx.font = `700 ${small ? 12 : 14}px ${FONT_JP}`;
    const lines = wrapText(Hud.helpMsg.text, small ? W - 40 : 360);
    const hx = IS_TOUCH ? W / 2 - (small ? W - 40 : 360) / 2 : 22, hy = IS_TOUCH ? 30 + mr * 2 : 22;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; rrect(ctx, hx - 10, hy - 6, (small ? W - 40 : 360) + 20, lines.length * 20 + 14, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    lines.forEach((l, i) => ctx.fillText(l, hx, hy + 16 + i * 20));
    ctx.globalAlpha = 1;
  }
  if (G.bustT > 0.2) jp('逮捕されそうだ！', W / 2, H * 0.7, 22, '#6ab8ff', 'center', 5);
  if (G.paused) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, W, H); }
}

function wrapText(s, maxW) {
  const out = []; let line = '';
  for (const part of s.split(/(\s+)/)) {
    if (ctx.measureText(line + part).width > maxW && line.trim()) { out.push(line.trim()); line = part.trimStart(); }
    else line += part;
  }
  if (line.trim()) out.push(line.trim());
  return out;
}

function drawWeaponIcon(w, x, y, S) {
  ctx.save(); ctx.translate(x, y); ctx.scale(S * 1.5, S * 1.5);
  ctx.fillStyle = '#e8e8e8'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
  if (w === 'fist') {
    rrect(ctx, -9, -7, 18, 14, 4); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#999'; for (let i = -4; i <= 4; i += 4) { ctx.beginPath(); ctx.moveTo(i, -7); ctx.lineTo(i, -2); ctx.stroke(); }
  } else if (w === 'pistol') {
    ctx.fillRect(-10, -6, 18, 5); ctx.fillRect(-10, -1, 6, 9); ctx.strokeRect(-10, -6, 18, 5);
  } else if (w === 'smg') {
    ctx.fillRect(-14, -5, 26, 6); ctx.fillRect(-6, 1, 5, 10); ctx.fillRect(-14, 1, 4, 5); ctx.fillRect(2, 1, 4, 6);
  } else if (w === 'shotgun') {
    ctx.fillRect(-16, -4, 32, 4); ctx.fillRect(-16, 0, 10, 6); ctx.fillStyle = '#a0703c'; ctx.fillRect(-3, 0, 10, 3);
  } else {
    ctx.fillStyle = '#7b8f4a'; ctx.fillRect(-16, -3, 30, 6); ctx.fillStyle = '#c94b2b'; ctx.beginPath(); ctx.moveTo(14, -4); ctx.lineTo(19, 0); ctx.lineTo(14, 4); ctx.fill();
    ctx.fillStyle = '#e8e8e8'; ctx.fillRect(-4, 3, 4, 6);
  }
  ctx.restore();
}

function edgeArrow(x, y, color) {
  const sx = (x - cam.x) * cam.zoom + W / 2, sy = (y - cam.y) * cam.zoom + H / 2;
  if (sx > 30 && sx < W - 30 && sy > 30 && sy < H - 30) return;
  const a = Math.atan2(sy - H / 2, sx - W / 2), m = 34;
  const t = Math.min((W / 2 - m) / Math.abs(Math.cos(a) || 1e-6), (H / 2 - m) / Math.abs(Math.sin(a) || 1e-6));
  const ex = W / 2 + Math.cos(a) * t, ey = H / 2 + Math.sin(a) * t;
  ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
  ctx.fillStyle = color; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -11); ctx.lineTo(-3, 0); ctx.lineTo(-8, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  txt(Math.round(dist(x, y, G.player.x, G.player.y) / 10) + 'm', ex - Math.cos(a) * 30, ey - Math.sin(a) * 30 + 6, 16, '#fff', 'center');
}

function blip(x, y, r, color, ring) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = ring || 'rgba(0,0,0,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
}
function mapBlips(toMap, scale, clampFn) {
  const pl = G.player;
  for (const c of Missions.contacts) if (!Missions.active) { const [x, y] = clampFn(...toMap(c.x, c.y)); blip(x, y, 5.5 * scale, c.color); }
  for (const m of Missions.markers) if (!m.faint) { const [x, y] = clampFn(...toMap(m.x, m.y)); blip(x, y, 6 * scale, m.color, '#fff'); }
  { const [x, y] = toMap(World.hospital.x, World.hospital.y); blip(x, y, 4 * scale, '#ff4d6d', '#fff'); }
  { const [x, y] = toMap(World.policeHQ.x, World.policeHQ.y); blip(x, y, 4 * scale, '#3d8bff', '#fff'); }
  { const [x, y] = toMap(World.spray.x, World.spray.y); blip(x, y, 4 * scale, '#ff9f43', '#fff'); }
  const on = Math.floor(G.t * 6) % 2;
  for (const c of G.cars) if (c.type === 'police' && (c.driver === 'cop' || c.siren)) { const [x, y] = toMap(c.x, c.y); blip(x, y, 3.2 * scale, on ? '#ff3b3b' : '#3b7bff'); }
  for (const p of G.peds) if (!p.dead && (p.kind === 'cop' && G.wanted > 0 || p.kind === 'gang' && p.hostile)) { const [x, y] = toMap(p.x, p.y); blip(x, y, 2.5 * scale, p.kind === 'cop' ? '#6ab8ff' : '#ff3b5c'); }
  if (G.heli) { const [x, y] = toMap(G.heli.x, G.heli.y); blip(x, y, 4 * scale, on ? '#ff3b3b' : '#3b7bff', '#fff'); }
  const [px, py] = toMap(pl.x, pl.y);
  ctx.save(); ctx.translate(px, py); ctx.rotate(pl.inCar ? pl.inCar.angle : pl.angle);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(8 * scale, 0); ctx.lineTo(-5 * scale, -5.5 * scale); ctx.lineTo(-2 * scale, 0); ctx.lineTo(-5 * scale, 5.5 * scale); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawMinimap(cx, cy, r) {
  const pl = G.player, sc = 1.15;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.closePath();
  ctx.fillStyle = '#123f5a'; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-pl.x / T * 2, -pl.y / T * 2);
  ctx.globalAlpha = 0.92; ctx.drawImage(World.minimap, 0, 0); ctx.globalAlpha = 1;
  ctx.restore();
  const toMap = (x, y) => [cx + (x - pl.x) / T * 2 * sc, cy + (y - pl.y) / T * 2 * sc];
  const clampFn = (x, y) => { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy); return d > r - 6 ? [cx + dx / d * (r - 6), cy + dy / d * (r - 6)] : [x, y]; };
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r + 8, 0, TAU); ctx.clip();
  mapBlips(toMap, 1, clampFn);
  ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = G.wanted > 0 ? (Math.floor(G.t * 4) % 2 ? '#ff3b3b' : '#3b7bff') : 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  txt('N', cx, cy - r + 14, 16, '#fff', 'center');
  ctx.restore();
}

function drawBigMap() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = 'rgba(5,10,25,0.85)'; ctx.fillRect(0, 0, W, H);
  const mw = World.minimap.width, mh = World.minimap.height;
  const s = Math.min((W - 40) / mw, (H - 110) / mh), ox = (W - mw * s) / 2, oy = (H - mh * s) / 2 + 20;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(World.minimap, ox, oy, mw * s, mh * s);
  ctx.imageSmoothingEnabled = true;
  const toMap = (x, y) => [ox + x / T * 2 * s, oy + y / T * 2 * s];
  mapBlips(toMap, 1.4, (x, y) => [x, y]);
  txt('NEON BAY', W / 2, 48, 40, '#ff7ad9', 'center', FONT_NUM, 5);
  ctx.font = `700 13px ${FONT_JP}`;
  const legend = [['#ffd23f', 'ミッション'], ['#ff4d6d', '病院'], ['#3d8bff', '警察署'], ['#ff9f43', '塗装屋（手配度クリア）']];
  let lx = W / 2 - 230;
  for (const [c, l] of legend) { blip(lx, H - 22, 6, c, '#fff'); jp(l, lx + 12, H - 17, 13, '#fff', 'left', 3); lx += 30 + ctx.measureText(l).width; }
  jp('M キーで閉じる', W - 20, H - 17, 13, '#aaa', 'right', 3);
}
