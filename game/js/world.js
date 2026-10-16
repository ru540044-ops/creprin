'use strict';
// ===== ワールド生成：碁盤の目の街 + ビーチ + 海 =====
const T = 32;                 // 1タイル = 32px
const B = 12;                 // ブロック間隔（道路2 + 区画10）
const NB = 8;                 // ブロック数（1辺）
const CITY = NB * B + 2;      // 街の幅（タイル）
const BEACH = 7, SEA = 24;
const MW = CITY + BEACH + SEA, MH = CITY;
const TL = { WATER: 0, ROAD: 1, WALK: 2, BUILD: 3, GRASS: 4, SAND: 5, LOT: 6, PLAZA: 7 };
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
const DIR_ANG = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
const CAMH = 1400;            // 疑似3D用カメラ高さ

const PASTEL = ['#f7a8b8', '#8fd3c7', '#f4d58d', '#a8c8f0', '#ece8dc', '#ffb38a', '#c5a3ff', '#9be3b0', '#f6c6d0', '#bfe6e0', '#ffd6a5', '#e8f1f2'];
const GLASS = ['#4a6b8a', '#3d5a73', '#5c7d99', '#33506a', '#6d8fa8', '#2f5d6b'];
const NEON = ['#ff2bd6', '#2bf0ff', '#ff7a1a', '#b44bff', '#3dff7a', '#ff3b5c', '#fff03b'];
const LAYOUTS = [
  [[0, 0, 8, 8]],
  [[0, 0, 4, 8], [4, 0, 4, 8]],
  [[0, 0, 8, 4], [0, 4, 8, 4]],
  [[0, 0, 4, 4], [4, 0, 4, 4], [0, 4, 4, 4], [4, 4, 4, 4]],
  [[0, 0, 8, 4], [0, 4, 4, 4], [4, 4, 4, 4]],
  [[0, 0, 5, 8], [5, 0, 3, 4], [5, 4, 3, 4]],
  [[0, 0, 3, 3], [3, 0, 5, 3], [0, 3, 8, 5]],
];
const LAYOUTS_DT = [
  [[0, 0, 8, 8]],
  [[0, 0, 4, 8], [4, 0, 4, 8]],
  [[0, 0, 8, 4], [0, 4, 8, 4]],
  [[1, 1, 6, 6]],
];

const World = {
  grid: new Uint8Array(MW * MH), buildings: [], trees: [], props: [], lamps: [], spots: [],
  blocks: [], chunks: [], CH: 16, cw: 0, chh: 0, minimap: null, lotMarks: new Map(),
  hospital: null, policeHQ: null, spray: null, contactSpots: [],
};
let GR = Math.random;
const pick2 = (R, arr) => arr[Math.floor(R() * arr.length)];

function tileAt(tx, ty) { if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return TL.WATER; return World.grid[ty * MW + tx]; }
function setTile(tx, ty, v) { if (tx >= 0 && ty >= 0 && tx < MW && ty < MH) World.grid[ty * MW + tx] = v; }
function solidTile(tx, ty) { const t = tileAt(tx, ty); return t === TL.BUILD || t === TL.WATER; }
function tileAtPx(x, y) { return tileAt(Math.floor(x / T), Math.floor(y / T)); }
const isRoadRow = (ty) => ty >= 0 && ty < CITY && ty % B < 2;
const isRoadCol = (tx) => tx >= 0 && tx < CITY && tx % B < 2;
const laneY = (j, d) => (j * B + (d === 0 ? 1.5 : 0.5)) * T;  // 東行き:南側車線 / 西行き:北側車線
const laneX = (i, d) => (i * B + (d === 1 ? 0.5 : 1.5)) * T;  // 南行き:西側車線 / 北行き:東側車線

function districtAt(x, y) {
  const tx = x / T, ty = y / T;
  if (tx >= CITY + BEACH) return 'ネオン湾';
  if (tx >= CITY - 2) return 'オーシャン・ドライブ';
  const bi = tx / B, bj = ty / B;
  if (Math.hypot(bi - 4, bj - 4) < 1.8) return 'ネオン・ダウンタウン';
  if (bi < 3 && bj < 3) return 'サンセット・ハイツ';
  if (bi < 3 && bj >= 5) return 'リトル・サルサ';
  if (bi >= 5 && bj < 3) return 'ポートサイド';
  if (bi >= 5 && bj >= 5) return 'パームショア';
  if (bj < 3) return 'ノース・ブリッケル';
  if (bj >= 5) return 'サウス・ワイン';
  if (bi < 3) return 'ウェスト・グローブ';
  return 'イースト・アーツ';
}

function palm(x, y, R) { return { x, y, kind: 'palm', s: 0.8 + R() * 0.45, rot: R() * TAU, h: 44 + R() * 22 }; }

function addBuilding(tx, ty, tw, th, h, o) {
  for (let y = ty; y < ty + th; y++) for (let x = tx; x < tx + tw; x++) setTile(x, y, TL.BUILD);
  const R = GR, color = o.color;
  const b = {
    x: tx * T, y: ty * T, w: tw * T, d: th * T, h, color, kind: o.kind || 'gen',
    glass: !!o.glass, neon: o.neon || null, seed: Math.floor(R() * 1e6), props: [], heli: false,
  };
  b.roof = o.glass ? shadeHex(color, 0.15) : shadeHex(color, -0.08);
  b.wallNS = shadeHex(color, -0.14);
  b.wallEW = shadeHex(color, -0.32);
  b.edge = shadeHex(color, -0.45);
  b.floors = Math.max(1, Math.round(h / 17));
  b.winDay = o.glass ? 'rgba(200,230,255,0.32)' : 'rgba(25,40,58,0.42)';
  if (b.kind === 'gen' && h > 210 && tw >= 4 && th >= 4 && R() < 0.55) b.heli = true;
  const n = b.heli ? 2 : Math.floor(R() * 3) + (tw * th > 12 ? 2 : 1);
  for (let k = 0; k < n; k++) {
    const pw = 0.1 + R() * 0.14, ph = 0.1 + R() * 0.14;
    let u = 0.08 + R() * (0.84 - pw), v = 0.08 + R() * (0.84 - ph);
    if (b.heli) { u = k ? 0.06 : 0.94 - pw; v = 0.06; }
    b.props.push({ u, v, w: pw, h: ph, kind: R() < 0.25 ? 'tank' : 'ac' });
  }
  World.buildings.push(b);
  return b;
}

function genBlock(bi, bj, kind, R, downtown) {
  const x0 = bi * B + 2, y0 = bj * B + 2, ix = x0 + 1, iy = y0 + 1;
  World.blocks.push({ bi, bj, kind });
  // 歩道のヤシの木
  for (let k = 1; k < 9; k += 2) {
    if (R() < 0.22) World.trees.push(palm((x0 + k + 0.5) * T, (y0 + 0.22) * T, R));
    if (R() < 0.22) World.trees.push(palm((x0 + k + 0.5) * T, (y0 + 9.78) * T, R));
    if (R() < 0.22) World.trees.push(palm((x0 + 0.22) * T, (y0 + k + 0.5) * T, R));
    if (R() < 0.22) World.trees.push(palm((x0 + 9.78) * T, (y0 + k + 0.5) * T, R));
  }
  const fill = (t) => { for (let y = iy; y < iy + 8; y++) for (let x = ix; x < ix + 8; x++) setTile(x, y, t); };
  const lotRow = (r, type, facing) => {
    for (let x = ix; x < ix + 8; x++) {
      World.lotMarks.set(x + ',' + r, x === ix + 7 ? 2 : 1);
      World.lotMarks.set(x + ',' + (r + 1), x === ix + 7 ? 2 : 1);
      World.spots.push({ x: (x + 0.5) * T, y: (r + 1) * T, a: facing, type, next: 0 });
    }
  };

  if (kind === 'park') {
    fill(TL.GRASS);
    for (let k = 0; k < 8; k++) {
      setTile(ix + 3, iy + k, TL.PLAZA); setTile(ix + 4, iy + k, TL.PLAZA);
      setTile(ix + k, iy + 3, TL.PLAZA); setTile(ix + k, iy + 4, TL.PLAZA);
    }
    const n = 12 + Math.floor(R() * 6);
    for (let k = 0; k < n; k++) {
      const tx = ix + Math.floor(R() * 8), ty = iy + Math.floor(R() * 8);
      if (tileAt(tx, ty) !== TL.GRASS) continue;
      const x = (tx + 0.5) * T + (R() - 0.5) * 12, y = (ty + 0.5) * T + (R() - 0.5) * 12;
      World.trees.push(R() < 0.45 ? palm(x, y, R) : { x, y, kind: 'oak', s: 0.75 + R() * 0.5, rot: R() * TAU, h: 32 + R() * 12 });
    }
    World.props.push({ kind: 'fountain', x: (ix + 4) * T, y: (iy + 4) * T });
  } else if (kind === 'lot' || kind === 'spray' || kind === 'police') {
    fill(TL.LOT);
    if (kind === 'police') {
      addBuilding(ix, iy, 8, 4, 72, { color: '#dfe6ee', kind: 'police' });
      lotRow(iy + 6, 'police', -Math.PI / 2);
      World.policeHQ = { x: (x0 + 5) * T, y: (y0 + 9.5) * T };
    } else if (kind === 'spray') {
      addBuilding(ix, iy, 4, 3, 52, { color: '#ff9f43', kind: 'spray' });
      lotRow(iy + 6, 'civ', -Math.PI / 2);
      World.spray = { x: (ix + 2) * T, y: (iy + 4.2) * T };
    } else {
      lotRow(iy, 'civ', Math.PI / 2);
      lotRow(iy + 6, 'civ', -Math.PI / 2);
    }
  } else if (kind === 'hospital') {
    fill(TL.PLAZA);
    addBuilding(ix + 1, iy + 1, 6, 5, 118, { color: '#f4f6f8', kind: 'hospital' });
    World.trees.push(palm((ix + 0.5) * T, (iy + 7.5) * T, R), palm((ix + 7.5) * T, (iy + 7.5) * T, R));
    World.hospital = { x: (x0 + 5) * T, y: (y0 + 9.5) * T };
  } else {
    fill(TL.PLAZA);
    const d = Math.hypot(bi + 0.5 - 4, bj + 0.5 - 4);
    const hmax = downtown ? 330 : bi === NB - 1 ? 210 : clamp(230 - d * 38, 70, 210);
    const L = pick2(R, downtown ? LAYOUTS_DT : LAYOUTS);
    for (const [lx, ly, lw, lh] of L) {
      const ins = (lw >= 4 && lh >= 4 && R() < 0.4) ? 1 : 0;
      const h = Math.round(lerp(hmax * 0.35, hmax, R()));
      const glass = downtown ? R() < 0.7 : R() < 0.12;
      const color = glass ? pick2(R, GLASS) : pick2(R, PASTEL);
      const neon = ((!glass && R() < 0.45) || (downtown && R() < 0.35)) ? pick2(R, NEON) : null;
      addBuilding(ix + lx + ins, iy + ly + ins, lw - 2 * ins, lh - 2 * ins, h, { color, glass, neon });
      if (ins && R() < 0.6) World.trees.push(palm((ix + lx + 0.5) * T, (iy + ly + 0.5) * T, R));
    }
  }
}

function genWorld(seed) {
  const R = mulberry32(seed); GR = R;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    let t = TL.WATER;
    if (x < CITY) t = (isRoadRow(y) || isRoadCol(x)) ? TL.ROAD : TL.WALK;
    else if (x < CITY + BEACH) t = TL.SAND;
    World.grid[y * MW + x] = t;
  }
  const special = { '1,5': 'hospital', '5,1': 'police', '6,6': 'spray', '2,2': 'park', '5,5': 'park', '0,3': 'lot', '7,4': 'lot' };
  for (let bj = 0; bj < NB; bj++) for (let bi = 0; bi < NB; bi++) {
    const downtown = Math.hypot(bi + 0.5 - 4, bj + 0.5 - 4) < 1.6;
    let kind = special[bi + ',' + bj];
    if (!kind) { const r = R(); kind = !downtown && r < 0.07 ? 'park' : !downtown && r < 0.13 ? 'lot' : 'build'; }
    genBlock(bi, bj, kind, R, downtown);
  }
  // ビーチ
  for (let y = 1; y < MH - 1; y++) for (let x = CITY; x < CITY + BEACH; x++) {
    const r = R();
    if (x <= CITY + 3 && r < 0.07) World.trees.push(palm((x + R()) * T, (y + R()) * T, R));
    else if (x >= CITY + 3 && r < 0.08) World.props.push({ kind: 'umbrella', x: (x + R()) * T, y: (y + R()) * T, color: pick2(R, ['#ff5f7e', '#ffd23f', '#4fd1ff', '#ffffff', '#7cff8a', '#c084fc']), rot: R() * TAU });
    else if (x >= CITY + 3 && r < 0.11) World.props.push({ kind: 'towel', x: (x + R()) * T, y: (y + R()) * T, color: pick2(R, ['#ff8fab', '#ffd166', '#06d6a0', '#118ab2', '#ef476f']), rot: (R() - 0.5) * 0.6 });
  }
  // 街灯
  for (let j = 0; j <= NB; j++) for (let i = 0; i <= NB; i++) {
    const x0 = i * B * T, y0 = j * B * T, x1 = (i * B + 2) * T, y1 = (j * B + 2) * T;
    const pts = [[x0 - 6, y0 - 6], [x1 + 6, y0 - 6], [x1 + 6, y1 + 6], [x0 - 6, y1 + 6]];
    if (i < NB) pts.push([x0 + 7 * T, y0 - 6], [x0 + 7 * T, y1 + 6]);
    if (j < NB) pts.push([x0 - 6, y0 + 7 * T], [x1 + 6, y0 + 7 * T]);
    for (const [x, y] of pts) if (x > 0 && y > 0 && x < CITY * T && y < CITY * T) World.lamps.push({ x, y });
  }
  // コンタクト（ミッション依頼人）
  for (const [bi, bj] of [[3, 2], [6, 3], [2, 6]]) {
    const x0 = bi * B + 2, y0 = bj * B + 2;
    World.contactSpots.push({ x: (x0 + 5) * T, y: (y0 + 9.5) * T });
  }
  buildChunks();
  buildMinimap();
}

// ===== 地面のプリレンダリング =====
function drawGroundTile(g, tx, ty) {
  const t = tileAt(tx, ty), px = tx * T, py = ty * T, h = hash2(tx, ty);
  switch (t) {
    case TL.WATER: {
      const shallow = tileAt(tx - 1, ty) === TL.SAND || tileAt(tx - 2, ty) === TL.SAND;
      g.fillStyle = shallow ? '#3fb8cc' : tx < CITY ? '#176a93' : (tx < CITY + BEACH + 5 ? '#1e86ae' : '#1a76a2');
      g.fillRect(px, py, T, T);
      if (h < 0.3) { g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(px + h * 40, py + 10, 10, 2); }
      break;
    }
    case TL.SAND:
      g.fillStyle = tileAt(tx + 1, ty) === TL.WATER ? '#e2cd94' : '#ecdcab';
      g.fillRect(px, py, T, T);
      g.fillStyle = 'rgba(160,130,70,0.18)';
      for (let k = 0; k < 4; k++) g.fillRect(px + hash2(tx * 7 + k, ty) * 30, py + hash2(tx, ty * 7 + k) * 30, 2, 2);
      break;
    case TL.ROAD: {
      g.fillStyle = '#3d4046'; g.fillRect(px, py, T, T);
      g.fillStyle = h < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)';
      g.fillRect(px + h * 20, py + hash2(ty, tx) * 20, 8, 6);
      const hr = isRoadRow(ty), vr = isRoadCol(tx);
      if (hr && !vr) {
        g.fillStyle = '#e8c33a';
        if (ty % B === 0) g.fillRect(px, py + T - 4, T, 2); else g.fillRect(px, py + 2, T, 2);
        g.fillStyle = 'rgba(255,255,255,0.45)';
        if (ty % B === 0) g.fillRect(px, py + 3, T, 1); else g.fillRect(px, py + T - 4, T, 1);
        const m = tx % B;
        if (m === 2 || m === B - 1) { g.fillStyle = '#e6e6e0'; for (let k = 0; k < 4; k++) g.fillRect(px + 5, py + k * 8 + 2, T - 10, 4); }
      } else if (vr && !hr) {
        g.fillStyle = '#e8c33a';
        if (tx % B === 0) g.fillRect(px + T - 4, py, 2, T); else g.fillRect(px + 2, py, 2, T);
        g.fillStyle = 'rgba(255,255,255,0.45)';
        if (tx % B === 0) g.fillRect(px + 3, py, 1, T); else g.fillRect(px + T - 4, py, 1, T);
        const m = ty % B;
        if (m === 2 || m === B - 1) { g.fillStyle = '#e6e6e0'; for (let k = 0; k < 4; k++) g.fillRect(px + k * 8 + 2, py + 5, 4, T - 10); }
      } else {
        g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(px, py, T, T);
      }
      break;
    }
    case TL.WALK: {
      g.fillStyle = '#bdb8ad'; g.fillRect(px, py, T, T);
      g.fillStyle = '#ada89c';
      g.fillRect(px, py, T, 1); g.fillRect(px, py, 1, T); g.fillRect(px, py + 16, T, 1); g.fillRect(px + 16, py, 1, T);
      g.fillStyle = '#7f7b71';
      if (tileAt(tx, ty - 1) === TL.ROAD) g.fillRect(px, py, T, 3);
      if (tileAt(tx, ty + 1) === TL.ROAD) g.fillRect(px, py + T - 3, T, 3);
      if (tileAt(tx - 1, ty) === TL.ROAD) g.fillRect(px, py, 3, T);
      if (tileAt(tx + 1, ty) === TL.ROAD) g.fillRect(px + T - 3, py, 3, T);
      if (tileAt(tx + 1, ty) === TL.SAND) { g.fillStyle = '#d9cfb5'; g.fillRect(px + T - 5, py, 5, T); }
      break;
    }
    case TL.GRASS:
      g.fillStyle = '#5c9e47'; g.fillRect(px, py, T, T);
      for (let k = 0; k < 6; k++) {
        g.fillStyle = k % 2 ? '#4f8d3d' : '#6cb055';
        g.fillRect(px + hash2(tx * 3 + k, ty) * 29, py + hash2(tx, ty * 3 + k) * 29, 3, 3);
      }
      break;
    case TL.LOT: {
      g.fillStyle = '#4b4e54'; g.fillRect(px, py, T, T);
      const m = World.lotMarks.get(tx + ',' + ty);
      if (m) {
        g.fillStyle = '#e6e6e0'; g.fillRect(px, py, 2, T);
        if (m === 2) g.fillRect(px + T - 2, py, 2, T);
      }
      break;
    }
    case TL.PLAZA:
      g.fillStyle = '#dad0bd'; g.fillRect(px, py, T, T);
      g.fillStyle = '#cbc0aa';
      g.fillRect(px, py, 16, 16); g.fillRect(px + 16, py + 16, 16, 16);
      break;
    case TL.BUILD:
      g.fillStyle = '#34322f'; g.fillRect(px, py, T, T);
      break;
  }
}

function bakeProps(g) {
  for (const p of World.props) {
    if (p.kind === 'fountain') {
      g.fillStyle = '#9a9488'; g.beginPath(); g.arc(p.x, p.y, 30, 0, TAU); g.fill();
      g.fillStyle = '#58c4dc'; g.beginPath(); g.arc(p.x, p.y, 25, 0, TAU); g.fill();
      g.fillStyle = '#bfefff'; g.beginPath(); g.arc(p.x, p.y, 7, 0, TAU); g.fill();
    } else if (p.kind === 'towel') {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
      g.fillStyle = p.color; g.fillRect(-7, -13, 14, 26);
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(-7, -6, 14, 3); g.fillRect(-7, 4, 14, 3);
      g.restore();
    }
  }
  for (const l of World.lamps) { g.fillStyle = '#4a4a4a'; g.beginPath(); g.arc(l.x, l.y, 3, 0, TAU); g.fill(); }
}

function buildChunks() {
  const CH = World.CH, CHP = CH * T;
  World.cw = Math.ceil(MW / CH); World.chh = Math.ceil(MH / CH);
  for (let cy = 0; cy < World.chh; cy++) for (let cx = 0; cx < World.cw; cx++) {
    const c = document.createElement('canvas'); c.width = CHP + 2; c.height = CHP + 2;
    const g = c.getContext('2d');
    g.translate(-cx * CHP, -cy * CHP);
    for (let ty = cy * CH; ty <= cy * CH + CH; ty++) for (let tx = cx * CH; tx <= cx * CH + CH; tx++) drawGroundTile(g, tx, ty);
    g.fillStyle = 'rgba(10,20,45,0.22)';
    for (const b of World.buildings) {
      const ox = b.h * 0.42, oy = b.h * 0.28;
      if (b.x + b.w + ox < cx * CHP || b.x > (cx + 1) * CHP + 2 || b.y + b.d + oy < cy * CHP || b.y > (cy + 1) * CHP + 2) continue;
      g.beginPath();
      g.moveTo(b.x, b.y); g.lineTo(b.x + b.w, b.y); g.lineTo(b.x + b.w + ox, b.y + oy);
      g.lineTo(b.x + b.w + ox, b.y + b.d + oy); g.lineTo(b.x + ox, b.y + b.d + oy); g.lineTo(b.x, b.y + b.d);
      g.closePath(); g.fill();
    }
    bakeProps(g);
    World.chunks.push(c);
  }
}

function buildMinimap() {
  const s = 2, c = document.createElement('canvas'); c.width = MW * s; c.height = MH * s;
  const g = c.getContext('2d');
  const col = { [TL.WATER]: '#1b5d82', [TL.ROAD]: '#9aa0aa', [TL.WALK]: '#2c3038', [TL.BUILD]: '#1d2027', [TL.GRASS]: '#2f6e36', [TL.SAND]: '#c9b27c', [TL.LOT]: '#383c45', [TL.PLAZA]: '#30343c' };
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { g.fillStyle = col[tileAt(x, y)]; g.fillRect(x * s, y * s, s, s); }
  World.minimap = c;
}

// ===== 衝突・視線 =====
function collideCircle(x, y, r) {
  let hit = false, nx = 0, ny = 0;
  const tx0 = Math.floor((x - r) / T), tx1 = Math.floor((x + r) / T), ty0 = Math.floor((y - r) / T), ty1 = Math.floor((y + r) / T);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (!solidTile(tx, ty)) continue;
    const rx = tx * T, ry = ty * T;
    const cx = clamp(x, rx, rx + T), cy = clamp(y, ry, ry + T);
    let dx = x - cx, dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2), p = r - d; dx /= d; dy /= d;
      x += dx * p; y += dy * p; nx += dx; ny += dy;
    } else {
      const l = x - rx, rr = rx + T - x, u = y - ry, dd = ry + T - y, m = Math.min(l, rr, u, dd);
      if (m === l) { x = rx - r; nx -= 1; } else if (m === rr) { x = rx + T + r; nx += 1; }
      else if (m === u) { y = ry - r; ny -= 1; } else { y = ry + T + r; ny += 1; }
    }
    hit = true;
  }
  const nl = Math.hypot(nx, ny) || 1;
  return { x, y, hit, nx: nx / nl, ny: ny / nl };
}

function lineOfSight(x0, y0, x1, y1) {
  const n = Math.ceil(dist(x0, y0, x1, y1) / 12);
  for (let k = 1; k < n; k++) {
    const t = k / n;
    if (tileAtPx(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t) === TL.BUILD) return false;
  }
  return true;
}

// ===== ランダム地点 =====
function randomLanePoint() {
  if (Math.random() < 0.5) {
    const j = randi(0, NB), i = randi(0, NB - 1);
    const x = rand((i * B + 2) * T + 20, (i + 1) * B * T - 20);
    return Math.random() < 0.5 ? { x, y: laneY(j, 0), dir: 0, i: i + 1, j } : { x, y: laneY(j, 2), dir: 2, i, j };
  }
  const i = randi(0, NB), j = randi(0, NB - 1);
  const y = rand((j * B + 2) * T + 20, (j + 1) * B * T - 20);
  return Math.random() < 0.5 ? { x: laneX(i, 1), y, dir: 1, i, j: j + 1 } : { x: laneX(i, 3), y, dir: 3, i, j };
}
function lanePointNear(px, py, minD, maxD, tries = 80) {
  for (let k = 0; k < tries; k++) {
    const p = randomLanePoint(), d = dist(p.x, p.y, px, py);
    if (d >= minD && d <= maxD) return p;
  }
  return null;
}
function cornerPos(bi, bj, c) {
  const xa = (bi * B + 2.5) * T, xb = (bi * B + 11.5) * T, ya = (bj * B + 2.5) * T, yb = (bj * B + 11.5) * T;
  return c === 0 ? { x: xa, y: ya } : c === 1 ? { x: xb, y: ya } : c === 2 ? { x: xb, y: yb } : { x: xa, y: yb };
}
function randomSidewalkPoint() {
  const bi = randi(0, NB - 1), bj = randi(0, NB - 1), c = randi(0, 3), c2 = (c + 1) % 4;
  const a = cornerPos(bi, bj, c), b = cornerPos(bi, bj, c2), t = Math.random();
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), bi, bj, c: c2 };
}
function sidewalkPointNear(px, py, minD, maxD, tries = 60) {
  for (let k = 0; k < tries; k++) {
    const p = randomSidewalkPoint(), d = dist(p.x, p.y, px, py);
    if (d >= minD && d <= maxD) return p;
  }
  return null;
}
function nearestPath(x, y) {
  const bi = clamp(Math.floor(x / T / B), 0, NB - 1), bj = clamp(Math.floor(y / T / B), 0, NB - 1);
  let best = 0, bd = 1e9;
  for (let c = 0; c < 4; c++) { const p = cornerPos(bi, bj, c), d = dist(x, y, p.x, p.y); if (d < bd) { bd = d; best = c; } }
  return { bi, bj, c: best, dir: Math.random() < 0.5 ? 1 : -1 };
}
