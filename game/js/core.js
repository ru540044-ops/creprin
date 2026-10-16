'use strict';
// ===== 共通ユーティリティ =====
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
let UID = 0;

function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function shadeHex(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// ===== 入力 =====
const Input = {
  keys: {}, pressed: {}, wheel: 0,
  mouse: { x: 0, y: 0, down: false, last: -1e9 },
  touch: { on: false, jx: 0, jy: 0, fire: false, brake: false },
};
const kd = (c) => !!Input.keys[c];
const kp = (c) => !!Input.pressed[c];
const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

addEventListener('keydown', (e) => {
  if (!Input.keys[e.code]) Input.pressed[e.code] = true;
  Input.keys[e.code] = true;
  if (PREVENT.has(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => { Input.keys[e.code] = false; });
addEventListener('blur', () => { Input.keys = {}; Input.mouse.down = false; });

function bindMouse(canvas) {
  const pos = (e) => { Input.mouse.x = e.clientX; Input.mouse.y = e.clientY; Input.mouse.last = performance.now(); };
  canvas.addEventListener('mousemove', pos);
  canvas.addEventListener('mousedown', (e) => { pos(e); if (e.button === 0) Input.mouse.down = true; });
  addEventListener('mouseup', (e) => { if (e.button === 0) Input.mouse.down = false; });
  canvas.addEventListener('wheel', (e) => { Input.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

function bindTouch() {
  if (!IS_TOUCH) return;
  Input.touch.on = true;
  const stick = document.getElementById('stick'), knob = document.getElementById('knob');
  let sid = null, cx = 0, cy = 0;
  const move = (t) => {
    let dx = t.clientX - cx, dy = t.clientY - cy;
    const m = Math.hypot(dx, dy), R = 52;
    if (m > R) { dx *= R / m; dy *= R / m; }
    Input.touch.jx = dx / R; Input.touch.jy = dy / R;
    knob.style.transform = `translate(${dx}px,${dy}px)`;
  };
  stick.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0]; sid = t.identifier;
    const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    move(t); e.preventDefault();
  }, { passive: false });
  stick.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) if (t.identifier === sid) move(t);
    e.preventDefault();
  }, { passive: false });
  const end = (e) => {
    for (const t of e.changedTouches) if (t.identifier === sid) {
      sid = null; Input.touch.jx = 0; Input.touch.jy = 0; knob.style.transform = '';
    }
  };
  stick.addEventListener('touchend', end);
  stick.addEventListener('touchcancel', end);
  document.querySelectorAll('[data-btn]').forEach((b) => {
    const name = b.dataset.btn;
    b.addEventListener('touchstart', (e) => {
      e.preventDefault(); b.classList.add('on');
      if (name === 'fire') Input.touch.fire = true;
      else if (name === 'brake') Input.touch.brake = true;
      else Input.pressed[name] = true;
    }, { passive: false });
    const up = () => {
      b.classList.remove('on');
      if (name === 'fire') Input.touch.fire = false;
      if (name === 'brake') Input.touch.brake = false;
    };
    b.addEventListener('touchend', up);
    b.addEventListener('touchcancel', up);
  });
}

function endInputFrame() { Input.pressed = {}; Input.wheel = 0; }
