import { useEffect, useReducer, useRef, useState } from 'react';
import { game, toast, save, Quality } from '../state/store';
import Phone from './Phone';
import { playerCar } from '../vehicles/sim';
import { input, releaseDrive } from '../input';
import { mapImage, toMap, fromMap, POI, MAP } from './mapRender';
import { INTERIORS } from '../world/Interiors';

function useTicker(ms: number) { const [, f] = useReducer((x: number) => x + 1, 0); useEffect(() => { const id = setInterval(f, ms); return () => clearInterval(id); }, [ms]); }

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
      c.restore();
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

function FullMap({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!; const img = mapImage(), ar = img.width / img.height;
    const W = Math.min(innerWidth - 32, (innerHeight - 120) * ar), H = W / ar, dpr = Math.min(2, devicePixelRatio || 1);
    cv.style.width = W + 'px'; cv.style.height = H + 'px'; cv.width = W * dpr; cv.height = H * dpr;
    let raf = 0; const draw = () => {
      raf = requestAnimationFrame(draw); const c = cv.getContext('2d')!, k = (W / img.width) * dpr; c.setTransform(k, 0, 0, k, 0, 0); c.drawImage(img, 0, 0);
      for (const q of POI()) { const [a, b] = toMap(q.x, q.z); c.fillStyle = q.c; c.beginPath(); c.arc(a, b, 6, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1.5; c.stroke(); }
      if (game.waypoint) { const [a, b] = toMap(game.waypoint.x, game.waypoint.z); c.fillStyle = '#ffd84a'; c.beginPath(); c.arc(a, b, 8, 0, Math.PI * 2); c.fill(); c.stroke(); }
      const p = game.where !== 'out' ? game.outsidePos : game.player, [a, b] = toMap(p.x, p.z);
      c.save(); c.translate(a, b); c.rotate(Math.PI - p.yaw); c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -12); c.lineTo(-8, 9); c.lineTo(0, 4); c.lineTo(8, 9); c.closePath(); c.fill(); c.stroke(); c.restore();
    };
    draw(); return () => cancelAnimationFrame(raf);
  }, []);
  const tap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = (e.target as HTMLCanvasElement).getBoundingClientRect(), img = mapImage();
    const [x, z] = fromMap(((e.clientX - r.left) / r.width) * img.width, ((e.clientY - r.top) / r.height) * img.height);
    game.waypoint = { x, z }; toast('目的地を設定しました'); save(); onClose();
  };
  return (
    <div className="overlay map">
      <div className="mapHead"><b>ベイ全体マップ</b><span>タップで目的地を設定</span></div>
      <canvas ref={ref} onPointerDown={tap} />
      <div className="row"><button type="button" onClick={() => { game.waypoint = null; save(); onClose(); }}>目的地を消す</button><button type="button" className="pri" onClick={onClose}>閉じる</button></div>
      <div className="legend">{POI().map((q) => <span key={q.t}><i style={{ background: q.c }} />{q.t}</span>)}<span><i style={{ background: '#ffd84a' }} />目的地</span></div>
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
      <div className="gear">{gear}</div>
      <div className="vname">{me.def.name}</div>
      <i className="vhp"><b style={{ width: hp * 100 + '%', background: hp > 0.5 ? 'var(--mint)' : hp > 0.25 ? 'var(--amber)' : '#ff4b4b' }} /></i>
      <div className="rpm"><b style={{ width: Math.round(me.rpm * 100) + '%' }} /></div>
    </div>
  );
}

export default function HUD({ quality, setQuality }: { quality: Quality; setQuality: (q: Quality) => void }) {
  useTicker(100);
  const [map, setMap] = useState(false);
  const [phone, setPhone] = useState(false);
  useEffect(() => { const id = setInterval(() => { if (input.phone) { input.phone = false; setPhone((v) => !v); } }, 50); return () => clearInterval(id); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPhone(false); setMap(false); } }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  const me = playerCar(), driving = !!me;
  useEffect(() => { releaseDrive(); }, [driving]);
  const [district, setDistrict] = useState({ name: '', t: 0 });
  useEffect(() => { if (game.district && game.district !== district.name) setDistrict({ name: game.district, t: Date.now() }); });
  const showDistrict = Date.now() - district.t < 3500;
  const near = game.near, p = game.player, inside = game.where !== 'out';
  const hh = Math.floor(game.hour), mm = Math.floor((game.hour - hh) * 60);
  return (
    <>
      <LookZone />
      <div className="hud">
        <div className="tl">
          <div className="card who">
            <div className="av">N</div>
            <div className="whoT"><b>NOVA</b><span>{inside ? INTERIORS[game.where]?.name : game.district}</span></div>
            <div className="bars"><i className="hp" style={{ width: game.health + '%' }} /><i className="st" style={{ width: game.stamina + '%' }} /></div>
          </div>
          <div className="card mis"><span className="lab">ミッション</span><b>自由行動</b><span>{driving ? 'ドライブ中。視点ボタンでカメラ切替、降車で降りる' : 'スマホの Bay Motors で車を買うとガレージに届く。道ばたの車にも乗れる'}</span></div>
        </div>
        <div className="tr">
          <Minimap onOpen={() => setMap(true)} />
          <div className="money">${game.money.toLocaleString('en-US')}</div>
          <div className="stars" aria-label={'手配度 ' + game.wanted}>{[0, 1, 2, 3, 4].map((i) => <b key={i} className={i < game.wanted ? 'on' : ''}>★</b>)}</div>
          <div className="small">{String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')} · {game.fps} FPS</div>
          <button type="button" className="chip phoneChip" onClick={() => setPhone(true)} aria-label="スマホを開く">📱 スマホ</button>
        </div>
      </div>
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
            <HoldBtn label="降車" cls="act" onDown={() => { input.action = true; }} />
            <HoldBtn label="視点" onDown={() => { input.camCycle = true; }} />
            <HoldBtn label="アクセル" cls="gas" active={input.gas} onDown={() => { input.gas = true; }} onUp={() => { input.gas = false; }} />
            <HoldBtn label="サイド" cls="hb" active={input.hb} onDown={() => { input.hb = true; }} onUp={() => { input.hb = false; }} />
            <HoldBtn label="ブレーキ" cls="brk" active={input.brake} onDown={() => { input.brake = true; }} onUp={() => { input.brake = false; }} />
          </div>
        </>
      ) : game.isTouch ? (
        <>
          <Joystick />
          <div className="btns">
            <HoldBtn label={near ? (near.kind === 'exit' ? '出る' : near.kind === 'car' ? '乗る' : '入る') : 'アクション'} cls="act" disabled={!near} onDown={() => { input.action = true; }} />
            <HoldBtn label="視点" onDown={() => { input.camCycle = true; }} />
            <HoldBtn label={p.crouch ? '立つ' : 'しゃがむ'} active={p.crouch} onDown={() => { input.crouchToggle = true; }} />
            <HoldBtn label="ダッシュ" cls="dash" active={p.sprinting} onDown={() => { input.dash = true; }} onUp={() => { input.dash = false; }} />
            <HoldBtn label="ジャンプ" cls="jump" onDown={() => { input.jump = true; }} />
          </div>
        </>
      ) : (
        <div className="keys">{driving ? 'W アクセル · S ブレーキ/バック · A D ハンドル · Space サイドブレーキ · E 降りる · V 視点 · P スマホ' : 'WASD 移動 · Shift ダッシュ · Space ジャンプ · C しゃがむ · E 入る/乗る · V 視点 · P スマホ · ドラッグで視点'}</div>
      )}
      {map && <FullMap onClose={() => setMap(false)} />}
      {phone && <Phone onClose={() => setPhone(false)} openMap={() => setMap(true)} quality={quality} setQuality={setQuality} />}
    </>
  );
}
export { MAP };
