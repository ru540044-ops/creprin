import { trainInfo } from '../crime/japan';
import { REGION } from '../world/region';
import StyleStudio from './StyleStudio';
import { settings, QualityMode } from '../settings';
import { banner, tutorial, tutorialStep, tutorialCount, skipTutorial } from '../progression';
import { useEffect, useReducer, useRef, useState } from 'react';
import { game, toast, save, Quality } from '../state/store';
import Phone from './Phone';
import GunShop from './GunShop';
import ShopPanel from './ShopPanel';
import { ITEMS, ITEM_IDS, useItem, buffs } from '../crime/shops';
import Customs from './Customs';
import { taxi, startTaxi, stopTaxi } from '../crime/stunts';
import { race } from '../crime/race';
import { talk, mission } from '../crime/story';
import { admin } from '../admin';
import { peds } from '../ai/peds';
import { WEAPONS, combat } from '../combat/weapons';
import { STATIONS } from '../radio';
import { playerCar, vehicles } from '../vehicles/sim';
import { law, jobStatus, armored, searchRadius } from '../crime/crime';
import { input, releaseDrive } from '../input';
import { mapImage, toMap, fromMap, POI, MAP, shinBadge } from './mapRender';
import { SHIN } from '../world/cityGen';
import { places, nearest, here, skipTo, CATS, Place, PlaceCat } from './places';

/** A round badge with an emoji, drawn once per kind and then stamped onto the maps. */
const badgeCache = new Map<string, HTMLCanvasElement>();
function badge(icon: string, color: string) {
  const k = icon + color; let cv = badgeCache.get(k); if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = cv.height = 48; const c = cv.getContext('2d')!;
  c.fillStyle = color; c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.arc(24, 24, 21, 0, Math.PI * 2); c.fill(); c.stroke();
  c.font = '26px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(icon, 24, 26);
  badgeCache.set(k, cv); return cv;
}
const catColor = (id: PlaceCat) => CATS.find((c) => c.id === id)!.color;
/** Which places a map shows: everything of the chosen kind, or (for "all") every stall / shrine / station and the nearest few shops. */
function shownPlaces(cat: PlaceCat | 'all'): Place[] {
  if (cat !== 'all') return places().filter((p) => p.cat === cat);
  const P = here(), few = (id: PlaceCat) => nearest(id, P.x, P.z, 6);
  return [...places().filter((p) => p.cat !== 'ramen' && p.cat !== 'konbini'), ...few('ramen'), ...few('konbini')];
}
import { INTERIORS } from '../world/Interiors';
import { isBoat } from '../vehicles/defs';

function useTicker(ms: number) { const [, f] = useReducer((x: number) => x + 1, 0); useEffect(() => { const id = setInterval(f, ms); return () => clearInterval(id); }, [ms]); }

/* ---------- moving blips: search area, police, cash truck ---------- */
function drawDynamic(c: CanvasRenderingContext2D, k: number, t: number) {
  if (mission.marker && mission.marker.y > -40) { // story: start blip (R) or the current objective
    const [a, b] = toMap(mission.marker.x, mission.marker.z), pulse = 1 + Math.sin(t / 250) * 0.15;
    c.fillStyle = '#ffd23a'; c.strokeStyle = '#000'; c.lineWidth = 1.4 * k; c.beginPath(); c.arc(a, b, 6.5 * k * 1.4 * pulse, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#000'; c.font = `900 ${9 * k * 1.4}px system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(mission.id < 0 ? 'R' : '!', a, b + 0.5 * k);
  }
  if (game.wanted > 0) {
    const [a, b] = toMap(law.lastSeen.x, law.lastSeen.z), flash = Math.floor(t / 300) % 2;
    c.fillStyle = flash ? 'rgba(255,40,60,.18)' : 'rgba(40,90,255,.18)'; c.strokeStyle = flash ? 'rgba(255,60,80,.8)' : 'rgba(60,120,255,.8)'; c.lineWidth = 1.5 * k;
    c.beginPath(); c.arc(a, b, searchRadius() * MAP.s, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  for (const v of vehicles) {
    if (v.role === 'police' && v.ai) { const [a, b] = toMap(v.x, v.z); c.fillStyle = Math.floor(t / 200 + v.id) % 2 ? '#ff2a40' : '#2b6bff'; c.beginPath(); c.arc(a, b, 3.2 * k * 1.4, 0, Math.PI * 2); c.fill(); }
    if (v.role === 'armored' && v === armored.v && armored.state !== 'looted') { const [a, b] = toMap(v.x, v.z); c.fillStyle = '#3dffb0'; c.strokeStyle = '#000'; c.lineWidth = 1.2 * k; c.beginPath(); c.arc(a, b, 5 * k * 1.4, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = '#000'; c.font = `900 ${9 * k * 1.4}px system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', a, b + 0.5 * k); }
  }
}

/* ---------- minimap ---------- */
function Minimap({ onOpen }: { onOpen: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0, last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw); if (t - last < 66) return; last = t;
      const cv = ref.current; if (!cv) return; const dpr = Math.min(2, devicePixelRatio || 1), S = cv.clientWidth;
      if (cv.width !== Math.round(S * dpr)) { cv.width = cv.height = Math.round(S * dpr); }
      const c = cv.getContext('2d')!; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, S, S);
      const inside = game.where !== 'out', p = inside ? game.outsidePos : game.player, [px, pz] = toMap(p.x, p.z), zoom = 1.25;
      c.save(); c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); c.clip();
      c.fillStyle = '#16405e'; c.fillRect(0, 0, S, S);
      c.translate(S / 2, S / 2); c.rotate(game.cam.yaw); c.scale(zoom, zoom); c.translate(-px, -pz);
      c.drawImage(mapImage(), 0, 0);
      for (const q of POI()) { const [a, b] = toMap(q.x, q.z); c.fillStyle = q.c; c.beginPath(); c.arc(a, b, 3.6 / zoom * 1.4, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1 / zoom; c.stroke(); }
      { const r = S / 2 / zoom / MAP.s + 10, sz = 15 / zoom; for (const q of places()) { if (Math.abs(q.x - p.x) > r || Math.abs(q.z - p.z) > r) continue; const [a, b] = toMap(q.x, q.z); c.save(); c.translate(a, b); c.rotate(-game.cam.yaw); c.drawImage(badge(q.icon, catColor(q.cat)), -sz / 2, -sz / 2, sz, sz); c.restore(); } }
      drawDynamic(c, 1 / zoom, t);
      c.restore();
      const rim = (wx: number, wz: number, pad: number) => { const [a, b] = toMap(wx, wz), dx = (a - px) * zoom, dz = (b - pz) * zoom, cs = Math.cos(game.cam.yaw), sn = Math.sin(game.cam.yaw); let rx = dx * cs - dz * sn, rz = dx * sn + dz * cs; const L = Math.hypot(rx, rz), m = S / 2 - pad, out = L > m; if (out) { rx *= m / L; rz *= m / L; } return [S / 2 + rx, S / 2 + rz, out ? 1 : 0] as const; };
      if (SHIN.has && !(playerCar()?.def.kind === 'shinkansen')) { const [x, y, out] = rim(SHIN.gate.x, SHIN.gate.z, 12); shinBadge(c, x, y, out ? 9 : 11); }
      if (game.waypoint) { // waypoint, clamped to the rim
        const [a, b] = toMap(game.waypoint.x, game.waypoint.z); let dx = (a - px) * zoom, dz = (b - pz) * zoom; const cs = Math.cos(game.cam.yaw), sn = Math.sin(game.cam.yaw);
        let rx = dx * cs - dz * sn, rz = dx * sn + dz * cs; const L = Math.hypot(rx, rz), m = S / 2 - 9; if (L > m) { rx *= m / L; rz *= m / L; }
        c.fillStyle = '#ffd84a'; c.strokeStyle = '#000'; c.beginPath(); c.arc(S / 2 + rx, S / 2 + rz, 5, 0, Math.PI * 2); c.fill(); c.stroke();
      }
      c.save(); c.translate(S / 2, S / 2); c.rotate(game.cam.yaw + Math.PI - p.yaw);
      c.fillStyle = '#ffffff'; c.strokeStyle = '#000'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -8); c.lineTo(-6, 6); c.lineTo(0, 3); c.lineTo(6, 6); c.closePath(); c.fill(); c.stroke(); c.restore();
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 3; c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); c.stroke();
      // north marker
      const na = game.cam.yaw; c.fillStyle = '#ff3f5a'; c.font = '700 11px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('N', S / 2 + Math.sin(-na) * (S / 2 - 10) * -1, S / 2 - Math.cos(-na) * (S / 2 - 10));
    };
    raf = requestAnimationFrame(draw); return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="minimap" onClick={onOpen} aria-label="ミニマップ（タップで全体マップ）" />;
}

/** Full map with zoom and pan (drag, pinch, wheel, + / − buttons); a tap without dragging sets the waypoint. */
function FullMap({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [cat, setCat] = useState<PlaceCat | 'all'>('all'), [sel, setSel] = useState<Place | null>(null);
  const catR = useRef(cat), selR = useRef(sel), drawn = useRef<Place[]>([]); catR.current = cat; selR.current = sel;
  const view = useRef({ z: 0, cx: 0, cy: 0, W: 0, H: 0, fit: 1 });
  const ptrs = useRef(new Map<number, { x: number; y: number }>()), gest = useRef({ moved: 0, dist: 0 });
  const clampV = () => { const v = view.current, img = mapImage(); v.z = Math.max(v.fit, Math.min(4, v.z)); const hw = v.W / 2 / v.z, hh = v.H / 2 / v.z; v.cx = Math.max(Math.min(hw, img.width / 2), Math.min(img.width - Math.min(hw, img.width / 2), v.cx)); v.cy = Math.max(Math.min(hh, img.height / 2), Math.min(img.height - Math.min(hh, img.height / 2), v.cy)); };
  const centerOnPlayer = (z?: number) => { const v = view.current, p = game.where !== 'out' ? game.outsidePos : game.player, [a, b] = toMap(p.x, p.z); v.cx = a; v.cy = b; if (z) v.z = z; clampV(); };
  useEffect(() => {
    const cv = ref.current!, img = mapImage(), v = view.current, dpr = Math.min(2, devicePixelRatio || 1);
    v.W = Math.max(200, innerWidth - 32); v.H = Math.max(140, innerHeight - (innerHeight < 500 ? 240 : 300)); // room below for the places bar v.fit = Math.min(v.W / img.width, v.H / img.height);
    cv.style.width = v.W + 'px'; cv.style.height = v.H + 'px'; cv.width = v.W * dpr; cv.height = v.H * dpr;
    centerOnPlayer(Math.max(v.fit, v.W / (1600 * MAP.s))); // start at about 1.6 km across, around the player
    let raf = 0; const draw = () => {
      raf = requestAnimationFrame(draw); const c = cv.getContext('2d')!, k = v.z * dpr;
      c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#16405e'; c.fillRect(0, 0, cv.width, cv.height);
      c.setTransform(k, 0, 0, k, (v.W / 2 - v.cx * v.z) * dpr, (v.H / 2 - v.cy * v.z) * dpr); c.imageSmoothingEnabled = v.z < 1.5; c.drawImage(img, 0, 0);
      const s = 1 / v.z; // marker sizes stay the same on screen whatever the zoom
      for (const q of POI()) { const [a, b] = toMap(q.x, q.z); c.fillStyle = q.c; c.beginPath(); c.arc(a, b, 6 * s, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1.5 * s; c.stroke(); }
      { // places of the chosen kind, as badges; only those in view are drawn (and remembered for taps)
        const hw = v.W / 2 / v.z, hh = v.H / 2 / v.z, list: Place[] = []; const sz = 22 * s;
        for (const q of shownPlaces(catR.current)) { const [a, b] = toMap(q.x, q.z); if (Math.abs(a - v.cx) > hw + 20 || Math.abs(b - v.cy) > hh + 20) continue; list.push(q); if (list.length > 260) break; }
        for (const q of list) { const [a, b] = toMap(q.x, q.z), on = selR.current && selR.current.x === q.x && selR.current.z === q.z, k = on ? 1.5 : 1; c.drawImage(badge(q.icon, catColor(q.cat)), a - (sz * k) / 2, b - (sz * k) / 2, sz * k, sz * k); }
        drawn.current = list;
      }
      drawDynamic(c, 1.6 * s, performance.now());
      if (SHIN.has) { const [a, b] = toMap(SHIN.gate.x, SHIN.gate.z); c.save(); c.translate(a, b); c.scale(s, s); shinBadge(c, 0, 0, 14); c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 3; c.font = '800 13px system-ui, sans-serif'; c.textAlign = 'center'; c.strokeText('新幹線のりば', 0, 28); c.fillText('新幹線のりば', 0, 28); c.restore(); }
      if (game.waypoint) { const [a, b] = toMap(game.waypoint.x, game.waypoint.z); c.fillStyle = '#ffd84a'; c.beginPath(); c.arc(a, b, 8 * s, 0, Math.PI * 2); c.fill(); c.stroke(); }
      const p = game.where !== 'out' ? game.outsidePos : game.player, [a, b] = toMap(p.x, p.z);
      c.save(); c.translate(a, b); c.scale(s, s); c.rotate(Math.PI - p.yaw); c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -12); c.lineTo(-8, 9); c.lineTo(0, 4); c.lineTo(8, 9); c.closePath(); c.fill(); c.stroke(); c.restore();
    };
    draw(); return () => cancelAnimationFrame(raf);
  }, []);
  const zoomAt = (f: number, sx = view.current.W / 2, sy = view.current.H / 2) => { const v = view.current, ix = v.cx + (sx - v.W / 2) / v.z, iy = v.cy + (sy - v.H / 2) / v.z; v.z *= f; clampV(); v.cx = ix - (sx - v.W / 2) / v.z; v.cy = iy - (sy - v.H / 2) / v.z; clampV(); };
  const local = (e: { clientX: number; clientY: number }) => { const r = ref.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); ptrs.current.set(e.pointerId, local(e)); gest.current.moved = 0; if (ptrs.current.size === 2) { const [p1, p2] = [...ptrs.current.values()]; gest.current.dist = Math.hypot(p1.x - p2.x, p1.y - p2.y); } };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const P = ptrs.current, prev = P.get(e.pointerId); if (!prev) return; const cur = local(e), v = view.current;
    if (P.size === 1) { v.cx -= (cur.x - prev.x) / v.z; v.cy -= (cur.y - prev.y) / v.z; clampV(); gest.current.moved += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y); }
    P.set(e.pointerId, cur);
    if (P.size === 2) { const [p1, p2] = [...P.values()], d = Math.hypot(p1.x - p2.x, p1.y - p2.y); if (gest.current.dist > 0) zoomAt(d / gest.current.dist, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2); gest.current.dist = d; gest.current.moved += 99; }
  };
  const up = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const P = ptrs.current, single = P.size === 1; P.delete(e.pointerId); gest.current.dist = 0;
    if (!single || gest.current.moved > 8) return;
    const v = view.current, l = local(e), ix = v.cx + (l.x - v.W / 2) / v.z, iy = v.cy + (l.y - v.H / 2) / v.z, [x, z] = fromMap(ix, iy);
    // a tap on a badge picks that place (then: guide or skip); anywhere else sets the destination as before
    let best: Place | null = null, bd = 22 / v.z; for (const q of drawn.current) { const [a, b] = toMap(q.x, q.z), d = Math.hypot(a - ix, b - iy); if (d < bd) { bd = d; best = q; } }
    if (best) { setSel(best); return; }
    game.waypoint = { x, z }; toast('目的地を設定しました'); save(); onClose();
  };
  return (
    <div className="overlay map">
      <div className="mapHead"><b>{REGION.name}マップ</b><span>ドラッグで移動・ピンチで拡大・タップで目的地</span></div>
      <div className="mapBox">
        <canvas ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={(e) => { ptrs.current.delete(e.pointerId); }} onWheel={(e) => { const l = local(e); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, l.x, l.y); }} style={{ touchAction: 'none' }} />
        <div className="mapZoom"><button type="button" aria-label="拡大" onClick={() => zoomAt(1.4)}>＋</button><button type="button" aria-label="縮小" onClick={() => zoomAt(1 / 1.4)}>−</button><button type="button" onClick={() => centerOnPlayer()}>現在地</button><button type="button" onClick={() => { view.current.z = view.current.fit; const img = mapImage(); view.current.cx = img.width / 2; view.current.cy = img.height / 2; clampV(); }}>全体</button></div>
      </div>
      <div className="placeBar">
        <div className="placeCats">{[{ id: 'all' as const, icon: '📍', name: 'すべて' }, ...CATS].map((k) => <button type="button" key={k.id} className={cat === k.id ? 'on' : ''} onClick={() => { setCat(k.id); setSel(null); }}>{k.icon} {k.name}</button>)}</div>
        <div className="placeList">{(sel ? [{ ...sel, d: Math.hypot(sel.x - here().x, sel.z - here().z) }] : nearest(cat, here().x, here().z, cat === 'all' ? 3 : 4)).map((q) => (
          <div key={q.name + q.x + q.z} className={'placeRow' + (sel ? ' sel' : '')}>
            <span className="pi">{q.icon}</span><b>{q.name}</b><small>{q.d < 1000 ? Math.round(q.d) + 'm' : (q.d / 1000).toFixed(1) + 'km'}</small>
            <button type="button" onClick={() => { game.waypoint = { x: q.tx, z: q.tz }; save(); toast(`${q.name}を目的地に設定`, 1.8); onClose(); }}>📍 案内</button>
            <button type="button" className="pri" onClick={() => { if (skipTo(q)) onClose(); }}>⏭ スキップ</button>
          </div>))}
          {sel && <button type="button" className="placeBack" onClick={() => setSel(null)}>← 一覧に戻る</button>}
        </div>
      </div>
      <div className="row"><button type="button" onClick={() => { game.waypoint = null; save(); onClose(); }}>目的地を消す</button>{game.waypoint && <button type="button" onClick={() => { const w = game.waypoint!; if (skipTo({ cat: 'station', name: '目的地', icon: '📍', x: w.x, z: w.z, tx: w.x, tz: w.z })) onClose(); }}>⏭ 目的地へスキップ</button>}<button type="button" className="pri" onClick={onClose}>閉じる</button></div>
      <div className="legend">{POI().filter((q, i, a) => a.findIndex((o) => o.t === q.t) === i).map((q) => <span key={q.t}><i style={{ background: q.c }} />{q.t}</span>)}<span><i style={{ background: '#3dffb0' }} />$ 現金輸送車</span><span><i style={{ background: '#ffd84a' }} />目的地</span>{SHIN.has && <span><i style={{ background: '#1e5bd8' }} />🚄 新幹線のりば</span>}</div>
    </div>
  );
}

/* ---------- touch controls ---------- */
function Joystick() {
  const [st, setSt] = useState({ on: false, bx: 0, by: 0, kx: 0, ky: 0 });
  const id = useRef<number | null>(null);
  const R = 58;
  useEffect(() => () => { input.joyActive = false; input.joyX = input.joyY = 0; }, []);
  const set = (e: React.PointerEvent, bx: number, by: number) => {
    let dx = e.clientX - bx, dy = e.clientY - by; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
    input.joyActive = true; input.joyX = dx / R; input.joyY = -dy / R; setSt({ on: true, bx, by, kx: dx, ky: dy });
  };
  return (
    <div className="joyZone"
      onPointerDown={(e) => { if (id.current !== null) return; id.current = e.pointerId; (e.target as HTMLElement).setPointerCapture(e.pointerId); set(e, e.clientX, e.clientY); }}
      onPointerMove={(e) => { if (e.pointerId === id.current) set(e, st.bx, st.by); }}
      onPointerUp={(e) => { if (e.pointerId !== id.current) return; id.current = null; input.joyActive = false; input.joyX = input.joyY = 0; setSt((s) => ({ ...s, on: false, kx: 0, ky: 0 })); }}
      onPointerCancel={() => { id.current = null; input.joyActive = false; input.joyX = input.joyY = 0; setSt((s) => ({ ...s, on: false })); }}>
      <div className={'joyBase' + (st.on ? ' on' : '')} style={st.on ? { left: st.bx, top: st.by, position: 'fixed' } : undefined}>
        <div className="joyKnob" style={{ transform: `translate(${st.kx}px,${st.ky}px)` }} />
      </div>
    </div>
  );
}
function LookZone() {
  const id = useRef<number | null>(null), last = useRef([0, 0]);
  return <div className="lookZone"
    onPointerDown={(e) => { if (id.current !== null) return; id.current = e.pointerId; last.current = [e.clientX, e.clientY]; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
    onPointerMove={(e) => { if (e.pointerId !== id.current) return; input.lookDX += e.clientX - last.current[0]; input.lookDY += e.clientY - last.current[1]; last.current = [e.clientX, e.clientY]; }}
    onPointerUp={(e) => { if (e.pointerId === id.current) id.current = null; }} onPointerCancel={() => { id.current = null; }} />;
}
function HoldBtn({ label, cls, onDown, onUp, active, disabled }: { label: string; cls?: string; onDown: () => void; onUp?: () => void; active?: boolean; disabled?: boolean }) {
  return <button type="button" className={'tb ' + (cls || '') + (active ? ' on' : '')} disabled={disabled}
    onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); if (!disabled) onDown(); }}
    onPointerUp={() => onUp && onUp()} onPointerLeave={() => onUp && onUp()} onPointerCancel={() => onUp && onUp()}>{label}</button>;
}

/* ---------- HUD ---------- */
function Speedo() {
  const me = playerCar(); if (!me) return null;
  const kmh = Math.round(game.speed * 3.6), fv = me.vx * Math.sin(me.yaw) + me.vz * Math.cos(me.yaw);
  const gear = me.dead ? '-' : fv < -0.5 ? 'R' : kmh < 2 ? 'N' : String(me.gear + 1), hp = Math.max(0, me.hp / me.def.hp);
  return (
    <div className="speedo" aria-label={'速度 ' + kmh + ' km/h'}>
      <div className="spd"><b>{kmh}</b><span>km/h</span></div>
      <div className="gear">{me.def.kind === 'heli' || me.def.kind === 'jet' ? Math.round(me.y) + 'm' : isBoat(me.def.kind) ? (fv < -0.5 ? 'R' : Math.round(game.speed * 1.944) + 'kt') : gear}</div>
      {me.def.kind === 'jet' && <div className="jetinfo"><span>THR {Math.round(me.rotor * 100)}%</span><span>{me.nitroOn ? 'AB ON' : me.air ? (me.spd < 60 ? '失速注意' : 'FLY') : me.spd > 60 ? '離陸可' : 'TAXI'}</span><span>PITCH {Math.round(me.pitch * 57)}°</span></div>}
      {me.def.kind === 'shinkansen' && trainInfo.on && <div className="traininfo"><span className={trainInfo.atc ? 'atc on' : 'atc'}>ATC {trainInfo.limit}</span><span>次 {trainInfo.next.replace('駅', '')} {trainInfo.dist >= 1000 ? (trainInfo.dist / 1000).toFixed(1) + 'km' : trainInfo.dist + 'm'}</span><span>{trainInfo.notch}</span></div>}
      <div className="vname">{me.def.name}</div>
      <i className="vhp"><b style={{ width: hp * 100 + '%', background: hp > 0.5 ? 'var(--mint)' : hp > 0.25 ? 'var(--amber)' : '#ff4b4b' }} /></i>
      <div className="rpm"><b style={{ width: Math.round(me.rpm * 100) + '%' }} /></div>
      {me.mods.nitro && <div className="nos"><b style={{ width: Math.round(me.nitro * 100) + '%' }} /></div>}
    </div>
  );
}

export default function HUD({ quality, mode, setMode, onPause }: { quality: Quality; mode: QualityMode; setMode: (q: QualityMode) => void; onPause: () => void }) {
  useTicker(100);
  const [map, setMap] = useState(false);
  useEffect(() => { game.mapOpen = map; }, [map]);
  const [phone, setPhone] = useState(false);
  useEffect(() => { game.phone = phone; }, [phone]);
  const [studio, setStudio] = useState(false);
  useEffect(() => { const id = setInterval(() => { if (input.phone) { input.phone = false; if (!game.styling) setPhone((v) => !v); } if (game.openStyle) { game.openStyle = false; if (!playerCar()) { setPhone(false); setStudio(true); } } }, 50); return () => clearInterval(id); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPhone(false); setMap(false); } }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  const me = playerCar(), driving = !!me, js = jobStatus();
  useEffect(() => { releaseDrive(); }, [driving]);
  const [district, setDistrict] = useState({ name: '', t: 0 });
  useEffect(() => { if (game.district && game.district !== district.name) setDistrict({ name: game.district, t: Date.now() }); });
  const showDistrict = Date.now() - district.t < 3500;
  const near = game.near, p = game.player, inside = game.where !== 'out';
  const hh = Math.floor(game.hour), mm = Math.floor((game.hour - hh) * 60);
  if (studio) return <><StyleStudio onClose={() => setStudio(false)} />{game.toastT > 0 && <div className="toast">{game.toast}</div>}</>;
  return (
    <>
      <LookZone />
      <div className="hud">
        <div className="tl">
          <div className="card who">
            <div className="av">N</div>
            <div className="whoT"><b>NOVA</b><span>{inside ? INTERIORS[game.where]?.name : game.district}</span></div>
            <div className="bars"><i className="hp" style={{ width: game.health + '%' }} />{game.arms.armor > 0 && <i className="ar" style={{ width: game.arms.armor + '%' }} />}<i className="st" style={{ width: game.stamina + '%' }} /></div>
            {(buffs.full > 0 || buffs.energy > 0 || buffs.tipsy > 0) && <div className="buffs">{buffs.full > 0 && <span>満腹 {Math.ceil(buffs.full)}秒</span>}{buffs.energy > 0 && <span>⚡ {Math.ceil(buffs.energy)}秒</span>}{buffs.tipsy > 0 && <span>ほろ酔い</span>}</div>}
          </div>
          {js ? (
            <div className={'card mis' + (game.wanted > 0 ? ' hot' : '')}><span className="lab">ミッション</span><b>{js.title}</b><span>{js.text}</span>{js.prog !== undefined && <i className="prog"><b style={{ width: Math.min(100, js.prog * 100) + '%' }} /></i>}</div>
          ) : (
            <div className="card mis tip"><span className="lab">ミッション</span><b>自由行動</b><span>{driving ? 'ドライブ中。視点ボタンでカメラ切替、降車で降りる' : '地図の黄色い R マークでストーリーミッション開始。お金はスマホの「仕事」で'}</span></div>
          )}
        </div>
        <div className="tr">
          <Minimap onOpen={() => setMap(true)} />
          <div className="money">${game.money.toLocaleString('en-US')}</div>
          {!driving && game.arms.cur === 'grenade' && <div className="weap">グレネード <b>×{game.arms.ammo.grenade}</b></div>}
          {!driving && game.arms.cur !== 'fist' && game.arms.cur !== 'grenade' && <div className="weap">{WEAPONS[game.arms.cur as 'pistol'].name} <b>{combat.reload > 0 ? 'リロード中' : game.arms.mag[game.arms.cur as 'pistol']}</b> / {game.arms.ammo[game.arms.cur as 'pistol']}</div>}
          <div className={'stars' + (game.wanted > 0 && !law.seen ? ' search' : '')} aria-label={'手配度 ' + game.wanted}>{[0, 1, 2, 3, 4].map((i) => <b key={i} className={i < game.wanted ? 'on' : ''}>★</b>)}</div>
          <div className="small">{String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')}{settings.showFps ? ` · ${game.fps} FPS` : ''}</div>
          <div className="chips">
            <button type="button" className="chip pauseChip" onClick={onPause} aria-label="一時停止">Ⅱ</button>
            <button type="button" className="chip phoneChip" onClick={() => setPhone(true)} aria-label="スマホを開く">📱 スマホ</button>
            {driving && me && me.def.kind === 'taxi' && <button type="button" className="chip phoneChip" onClick={() => { if (taxi.on) stopTaxi(); else startTaxi(); }}>🚕 {taxi.on ? '業務終了' : '客を探す'}</button>}
            {driving && <button type="button" className="chip phoneChip" onClick={() => { input.radio = true; }}>📻 {game.radio ? STATIONS[game.radio - 1].name : 'ラジオ'}</button>}
            {!driving && ITEM_IDS.filter((k) => game.items[k] > 0).map((k) => <button type="button" key={k} className="chip itemChip" aria-label={`${ITEMS[k].name}を使う（${ITEMS[k].use}）`} onClick={() => useItem(k)}>{ITEMS[k].icon} {game.items[k]}</button>)}
          </div>
        </div>
      </div>
      {game.fadeT > 0 && <div className="fade" style={{ opacity: Math.min(1, game.fadeT) }} />}
      {game.hurtT > 0 && <div className="hurt" style={{ opacity: Math.min(1, game.hurtT * 1.6) }} />}
      {admin.is && (() => { const n = (['god', 'noWanted', 'infAmmo', 'carGod', 'carBoost', 'fastRun', 'superJump', 'freezeTime'] as const).filter((k) => admin[k]).length + (admin.timeScale !== 1 ? 1 : 0); return <div className="adBadge">ADMIN{n ? ' ●' + n : ''}</div>; })()}
      {admin.is && admin.debug && <div className="adDebug">x {game.player.x.toFixed(1)} z {game.player.z.toFixed(1)} · {game.where}<br />歩行者 {peds.length} · 車 {vehicles.length} · 手配 {game.wanted} · {game.fps} FPS · {game.hour.toFixed(2)}時</div>}
      {race.id && !race.done && (race.count > 0 || race.t < 0.9) && <div className="countdown" key={race.count > 0 ? Math.ceil(race.count - 0.5) : 'go'}>{race.count > 0.5 ? Math.ceil(race.count - 0.5) : 'GO!'}</div>}
      {banner.t > 0 && <div className={'banner ' + banner.kind} key={banner.title + banner.sub}><b>{banner.title}</b><span>{banner.sub}</span></div>}
      {tutorialStep() && <div className="tut"><i>チュートリアル {tutorial.step + 1}/{tutorialCount}</i><b>{tutorialStep()!.title}</b><span>{tutorialStep()!.text()}</span><button type="button" onClick={() => skipTutorial()}>スキップ</button></div>}
      {talk.queue[0] && <div className="subs">{talk.queue[0].who ? <><i>{talk.queue[0].who[0]}</i><b>{talk.queue[0].who}</b></> : <i className="ok">✓</i>}<span>{talk.queue[0].text}</span></div>}
      {law.over && <div className={'over ' + law.over.kind}><b>{law.over.kind === 'busted' ? 'BUSTED' : 'WASTED'}</b><span>{law.over.kind === 'busted' ? '逮捕' : '死亡'}　-${law.over.fine.toLocaleString('en-US')}</span></div>}
      {showDistrict && <div className="district">{district.name}</div>}
      {game.toastT > 0 && <div className="toast">{game.toast}</div>}
      {near && <div className="prompt">{game.isTouch ? '' : '[E] '}{near.label}</div>}
      {driving && <Speedo />}
      {game.isTouch && driving ? (
        <>
          <div className="steer">
            <HoldBtn label="◀" cls="st" active={input.left} onDown={() => { input.left = true; }} onUp={() => { input.left = false; }} />
            <HoldBtn label="▶" cls="st" active={input.right} onDown={() => { input.right = true; }} onUp={() => { input.right = false; }} />
          </div>
          <div className="pedals">
            <HoldBtn label={near && near.kind === 'job' ? near.btn || '決定' : '降車'} cls="act" onDown={() => { input.action = true; }} />
            <HoldBtn label="視点" onDown={() => { input.camCycle = true; }} />
            {me && me.def.kind === 'jet' ? (<>
              <HoldBtn label="機首上げ" cls="gas" active={input.up} onDown={() => { input.up = true; }} onUp={() => { input.up = false; }} />
              <HoldBtn label="スロットル+" cls="hb" active={input.gas} onDown={() => { input.gas = true; }} onUp={() => { input.gas = false; }} />
              <HoldBtn label="機首下げ" cls="brk" active={input.down} onDown={() => { input.down = true; }} onUp={() => { input.down = false; }} />
              <HoldBtn label="スロットル−" cls="rev" active={input.brake} onDown={() => { input.brake = true; }} onUp={() => { input.brake = false; }} />
              <HoldBtn label="機銃" cls="fire" active={input.fire} onDown={() => { input.fire = true; }} onUp={() => { input.fire = false; }} />
              <HoldBtn label="AB" cls="nosb" active={input.nitro} onDown={() => { input.nitro = true; }} onUp={() => { input.nitro = false; }} />
            </>) : me && isBoat(me.def.kind) ? (<>
              <HoldBtn label="スロットル" cls="gas" active={input.gas} onDown={() => { input.gas = true; }} onUp={() => { input.gas = false; }} />
              <HoldBtn label="後進" cls="brk" active={input.brake} onDown={() => { input.brake = true; }} onUp={() => { input.brake = false; }} />
              {me.mods.nitro && <HoldBtn label="ニトロ" cls="nosb" active={input.nitro} onDown={() => { input.nitro = true; }} onUp={() => { input.nitro = false; }} />}
            </>) : me && me.def.kind === 'heli' ? (<>
              <HoldBtn label="上昇" cls="gas" active={input.up} onDown={() => { input.up = true; }} onUp={() => { input.up = false; }} />
              <HoldBtn label="前進" cls="hb" active={input.gas} onDown={() => { input.gas = true; }} onUp={() => { input.gas = false; }} />
              <HoldBtn label="下降" cls="brk" active={input.down} onDown={() => { input.down = true; }} onUp={() => { input.down = false; }} />
              <HoldBtn label="後退" cls="rev" active={input.brake} onDown={() => { input.brake = true; }} onUp={() => { input.brake = false; }} />
            </>) : (<>
              <HoldBtn label="アクセル" cls="gas" active={input.gas} onDown={() => { input.gas = true; }} onUp={() => { input.gas = false; }} />
              <HoldBtn label="サイド" cls="hb" active={input.hb} onDown={() => { input.hb = true; }} onUp={() => { input.hb = false; }} />
              <HoldBtn label="ブレーキ" cls="brk" active={input.brake} onDown={() => { input.brake = true; }} onUp={() => { input.brake = false; }} />
              {me && me.mods.nitro && <HoldBtn label="ニトロ" cls="nosb" active={input.nitro} onDown={() => { input.nitro = true; }} onUp={() => { input.nitro = false; }} />}
            </>)}
          </div>
        </>
      ) : game.isTouch ? (
        <>
          <Joystick />
          <div className="btns">
            <HoldBtn label={({ fist: '素手', pistol: 'ピストル', smg: 'SMG' } as Record<string, string>)[game.arms.cur]} cls="wpn" onDown={() => { input.wcycle = true; }} />
            <HoldBtn label="狙う" cls="aim" active={input.aim} onDown={() => { if (game.arms.cur === 'fist') { toast('銃がない（BAY ARMSで購入）', 1.4); return; } input.aim = !input.aim; }} />
            <HoldBtn label={game.arms.cur === 'fist' ? 'パンチ' : '撃つ'} cls="fire" active={input.fire} onDown={() => { input.fire = true; }} onUp={() => { input.fire = false; }} />
            <HoldBtn label={near ? (near.kind === 'exit' ? '出る' : near.kind === 'car' ? near.btn || '乗る' : near.kind === 'job' ? near.btn || '決定' : '入る') : 'アクション'} cls="act" disabled={!near} onDown={() => { input.action = true; }} />
            <HoldBtn label="視点" onDown={() => { input.camCycle = true; }} />
            <HoldBtn label={p.crouch ? '立つ' : 'しゃがむ'} active={p.crouch} onDown={() => { input.crouchToggle = true; }} />
            <HoldBtn label="ダッシュ" cls="dash" active={p.sprinting} onDown={() => { input.dash = true; }} onUp={() => { input.dash = false; }} />
            <HoldBtn label="ジャンプ" cls="jump" onDown={() => { input.jump = true; }} />
          </div>
        </>
      ) : (
        <div className="keys">{driving ? (me && me.def.kind === 'jet' ? 'W/S スロットル · A D 旋回(バンク) · Space 機首上げ · C/Ctrl 機首下げ · Shift アフターバーナー · F 機銃 · V 視点(コックピット) · E 降りる(着陸後)' : me && isBoat(me.def.kind) ? 'W スロットル · S 後進 · A D 舵 · Shift ニトロ · E 降りる(桟橋で) · V 視点' + (me.def.kind === 'yacht' ? ' · 停船して[E]でキャビン' : '') : me && me.def.kind === 'heli' ? 'Space 上昇 · Shift 下降 · W/S 前進/後退 · A D 旋回 · E 降りる(着陸後) · V 視点' : 'W アクセル · S ブレーキ/バック · A D ハンドル · Space サイド · Shift ニトロ · E 降りる · V 視点 · R ラジオ · P スマホ') : 'WASD 移動 · Shift ダッシュ · Space ジャンプ · E 入る/乗る · X 武器 · 右クリック/Q 狙う · 左クリック/F 撃つ · P スマホ'}</div>
      )}
      {!driving && (input.aim || input.aimHold) && game.arms.cur !== 'fist' && game.where === 'out' && <div className={'xhair' + (combat.lock ? ' lock' : '')} />}
      {game.ui === 'arms' && <GunShop onClose={() => { game.ui = ''; }} />}
      {game.ui === 'customs' && <Customs onClose={() => { game.ui = ''; }} />}
      {game.ui.startsWith('shop:') && <ShopPanel kind={game.ui.slice(5)} onClose={() => { game.ui = ''; }} />}
      {map && <FullMap onClose={() => setMap(false)} />}
      {phone && <Phone onClose={() => setPhone(false)} openMap={() => setMap(true)} quality={quality} mode={mode} setMode={setMode} />}
    </>
  );
}
export { MAP };
