'use strict';
// ===== スマホ版：タッチ操作・振動・フルスクリーン・PWA =====
const Mobile = {
  on: false,
  ui: {},
  last: {},

  // 左半分：移動スティック / 右半分：照準スティック（ドラッグで射撃、タップで自動照準射撃）
  bind() {
    if (!IS_TOUCH) return;
    this.on = true;
    Input.touch.on = true;
    document.body.classList.add('is-touch');
    const $ = (id) => document.getElementById(id);
    this.ui = { car: $('bCar'), wpn: $('bWpn'), brake: $('bBrake'), radio: $('bRadio'), hint: $('touchHint') };
    this.stick($('zoneL'), $('stickL'), (x, y) => { Input.touch.jx = x; Input.touch.jy = y; });
    this.stick($('zoneR'), $('stickR'), (x, y, active) => {
      Input.touch.ax = x; Input.touch.ay = y; Input.touch.aiming = active;
    }, () => { Input.touch.tap = true; });

    document.querySelectorAll('[data-btn]').forEach((b) => {
      const name = b.dataset.btn;
      b.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation(); b.classList.add('on'); Mobile.vib(8);
        if (name === 'fire') Input.touch.fire = true;
        else if (name === 'brake') Input.touch.brake = true;
        else Input.pressed[name] = true;
      }, { passive: false });
      const up = (e) => {
        e.preventDefault(); b.classList.remove('on');
        if (name === 'fire') Input.touch.fire = false;
        if (name === 'brake') Input.touch.brake = false;
      };
      b.addEventListener('touchend', up, { passive: false });
      b.addEventListener('touchcancel', up, { passive: false });
    });

    // ピンチズーム・ダブルタップズーム・プルリフレッシュ防止
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
    document.addEventListener('dblclick', (e) => e.preventDefault());
  },

  stick(zone, el, onMove, onTap) {
    const knob = el.querySelector('.knob'), R = 56;
    let id = null, cx = 0, cy = 0, t0 = 0, moved = false;
    const place = (x, y) => { el.style.left = x + 'px'; el.style.top = y + 'px'; };
    const move = (t) => {
      let dx = t.clientX - cx, dy = t.clientY - cy;
      const m = Math.hypot(dx, dy);
      if (m > 12) moved = true;
      if (m > R) { dx *= R / m; dy *= R / m; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      onMove(dx / R, dy / R, moved);
    };
    zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (id !== null) return;
      const t = e.changedTouches[0];
      id = t.identifier; cx = t.clientX; cy = t.clientY; t0 = performance.now(); moved = false;
      place(cx, cy); el.classList.add('active');
      move(t);
    }, { passive: false });
    zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === id) move(t);
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== id) continue;
        if (onTap && !moved && performance.now() - t0 < 250) onTap();
        id = null; knob.style.transform = ''; el.classList.remove('active'); el.style.left = ''; el.style.top = '';
        onMove(0, 0, false);
      }
    };
    zone.addEventListener('touchend', end);
    zone.addEventListener('touchcancel', end);
  },

  // 状況に応じてボタンの表示を変える（車の近く → 「乗る」など）
  update() {
    if (!this.on || G.state === 'title') return;
    const p = G.player;
    let near = false;
    if (!p.inCar) for (const c of G.cars) if (!c.dead && dist(p.x, p.y, c.x, c.y) < c.len / 2 + 26) { near = true; break; }
    const carLabel = p.inCar ? '降りる' : '乗る';
    this.set('carLabel', carLabel, () => { this.ui.car.textContent = carLabel; });
    this.set('carReady', p.inCar || near, (v) => this.ui.car.classList.toggle('ready', v));
    this.set('inCar', !!p.inCar, (v) => { document.body.classList.toggle('in-car', v); });
    const w = WEAPONS[p.weapon].name;
    this.set('wpn', w, () => { this.ui.wpn.textContent = w; });
  },
  set(key, val, fn) { if (this.last[key] !== val) { this.last[key] = val; fn(val); } },

  vib(ms) {
    if (!this.on || !navigator.vibrate || G.paused) return;
    try { navigator.vibrate(ms); } catch (e) { /* ignore */ }
  },

  enterFullscreen() {
    if (!this.on) return;
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req && !document.fullscreenElement) {
      try { const r = req.call(el, { navigationUI: 'hide' }); if (r && r.catch) r.catch(() => {}); } catch (e) { /* iOS Safari などは非対応 */ }
    }
  },
};

// 画面を離れたら自動ポーズ
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.state !== 'title' && !G.paused) togglePause(true);
});

// オフラインでも遊べるように（https または localhost のみ）
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
