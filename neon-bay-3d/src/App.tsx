import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import City from './game/world/City';
import CruiseShip from './game/world/CruiseShip';
import Environment from './game/world/Environment';
import Interiors from './game/world/Interiors';
import Player from './game/player/Player';
import HUD from './game/ui/HUD';
import Vehicles from './game/vehicles/Vehicles';
import CrimeView from './game/crime/CrimeView';
import GiftView from './game/crime/GiftView';
import { initNetGifts } from './game/crime/gifts';
import * as giftsMod from './game/crime/gifts';
import * as cityMod from './game/world/cityGen';
import { progress, ownedCars } from './game/state/store';
import Birds from './game/world/Birds';
import Weather from './game/world/Weather';
import Effects from './game/world/Effects';
import LightFX from './game/world/LightFX';
import Detail from './game/world/Detail';
import Clouds from './game/world/Clouds';
import { wind } from './game/world/City';
import { look } from './game/world/Environment';
import { PedsView, FXView } from './game/ai/PedsView';
import { peds } from './game/ai/peds';
import * as pedsMod from './game/ai/peds';
import * as traffic from './game/ai/traffic';
import * as weapons from './game/combat/weapons';
import { vehicles, playerCar, owned, spawn, remove, drive, collisions } from './game/vehicles/sim';
import { initAudio, ambience } from './game/audio';
import { checkAdmin, tdt } from './game/admin';
import * as adminMod from './game/admin';
import * as explodeMod from './game/combat/explode';
import * as stuntsMod from './game/crime/stunts';
import * as raceMod from './game/crime/race';
import * as story from './game/crime/story';
import { BDOORS } from './game/world/bldgInteriors';
import { RAMPS, HELIPADS, CUSTOMS, floorAt, solids } from './game/world/cityGen';
import { game, load, save, clearSave, Quality, toast } from './game/state/store';
import { bindKeyboard, input } from './game/input';
import { doors, SPAWN, groundAt, buildings, TRIALS, LANDMARKS, EXPORT_DOCK, POLICE_HQ } from './game/world/cityGen';
import * as crime from './game/crime/crime';
import { steer, newAI } from './game/ai/driver';
import { INTERIORS } from './game/world/Interiors';
try { if (localStorage.getItem('nb3d.debug') === '1') (window as any).__nb3d = { giftsMod, cityMod, progress, ownedCars, story, floorAt, solids, BDOORS, look, raceMod, explodeMod, stuntsMod, RAMPS, HELIPADS, CUSTOMS, adminMod, peds, pedsMod, traffic, weapons, crime, steer, newAI, TRIALS, LANDMARKS, EXPORT_DOCK, POLICE_HQ, INTERIORS, game, input, doors, buildings, SPAWN, groundAt, vehicles, playerCar, owned, spawn, remove, drive, collisions }; } catch { /* storage blocked */ } // test hook, off by default

const Q: Record<Quality, { dpr: number; shadows: boolean; size: number }> = {
  low: { dpr: 1, shadows: false, size: 512 }, medium: { dpr: 1.5, shadows: true, size: 1024 }, high: { dpr: 2, shadows: true, size: 2048 },
};

function Waypoint() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    const w = game.waypoint, m = ref.current; if (!m) return;
    m.visible = !!w && game.where === 'out'; if (!w) return;
    m.position.set(w.x, 60, w.z); (m.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(clock.elapsedTime * 3) * 0.1;
  });
  return <mesh ref={ref}><cylinderGeometry args={[1.6, 1.6, 120, 12, 1, true]} /><meshBasicMaterial color="#ffd84a" transparent opacity={0.4} depthWrite={false} toneMapped={false} /></mesh>;
}

/** Tracks FPS, counts down toasts, and lets the camera far plane follow the indoor/outdoor state. */
function Ticker({ quality }: { quality: Quality }) {
  const acc = useRef({ t: 0, n: 0 });
  const setDpr = useThree((s) => s.setDpr), dyn = useRef({ dpr: 0, t: 0 });
  useFrame((st, dt) => {
    // dynamic resolution: drop render scale when the frame rate sags, raise it again when there is headroom
    const D = dyn.current, max = Math.min(Q[quality].dpr, window.devicePixelRatio || 1), min = quality === 'low' ? 0.6 : 0.75;
    if (D.dpr === 0) D.dpr = max;
    D.t += dt; if (D.t > 2.5 && game.started) { D.t = 0; const nd = game.fps < 32 ? Math.max(min, D.dpr - 0.25) : game.fps > 56 ? Math.min(max, D.dpr + 0.25) : D.dpr; if (nd !== D.dpr) { D.dpr = nd; setDpr(nd); } }
    // ambient sound
    const p = game.where === 'out' ? game.player : game.outsidePos, me = playerCar(), h = game.hour, day = h > 6.5 && h < 18.5 ? 1 : 0;
    ambience({ out: game.where === 'out' && game.started, inCar: !!me, day, city: Math.abs(p.x) < 700 && Math.abs(p.z) < 700 ? 1 : 0.2, sea: Math.max(0, Math.min(1, 1 - Math.abs(p.x - 790) / 70)), height: me ? me.y : game.player.y, dt });
    acc.current.t += dt; acc.current.n++; if (acc.current.t > 0.5) { game.fps = Math.round(acc.current.n / acc.current.t); acc.current.t = 0; acc.current.n = 0; }
    if (game.toastT > 0) game.toastT -= dt;
    if (game.hurtT > 0) game.hurtT -= dt;
    if (game.fadeT > 0) game.fadeT -= dt;
    if (game.started) game.clock += tdt(dt);
    wind.value += dt;
  });
  return null;
}

function Scene({ quality }: { quality: Quality }) {
  const [where, setWhere] = useState(game.where);
  useFrame(() => { if (game.where !== where) setWhere(game.where); });
  const q = Q[quality];
  return (
    <>
      <Environment shadows={q.shadows} shadowSize={q.size} />
      <City shadows={q.shadows} />
      <CruiseShip />
      <Interiors where={where} />
      <Player />
      <Vehicles />
      <CrimeView />
      <GiftView />
      <PedsView />
      <FXView />
      <Birds />
      <Weather />
      <LightFX />
      <Detail />
      <Clouds />
      <Effects quality={quality} />
      <Waypoint />
      <Ticker quality={quality} />
    </>
  );
}

export default function App() {
  const hadSave = useMemo(() => load(), []);
  const [started, setStarted] = useState(false);
  const [quality, setQuality] = useState<Quality>(game.quality);
  useEffect(() => { bindKeyboard(); checkAdmin(); initNetGifts(); }, []);
  useEffect(() => { game.quality = quality; save(); }, [quality]);
  useEffect(() => {
    const vis = () => { if (document.hidden) save(); };
    document.addEventListener('visibilitychange', vis); addEventListener('pagehide', save);
    const block = (e: TouchEvent) => { if ((e.target as HTMLElement).closest('.overlay')) return; e.preventDefault(); };
    document.addEventListener('touchmove', block, { passive: false });
    return () => { document.removeEventListener('visibilitychange', vis); removeEventListener('pagehide', save); document.removeEventListener('touchmove', block); };
  }, []);
  const q = Q[quality];
  return (
    <div className="app" onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => { if (!game.isTouch && e.pointerType === 'mouse' && started && e.button === 2) (e.currentTarget as any).dataset.drag = '1'; }}>
      <Canvas
        key={quality}
        shadows={q.shadows ? 'soft' : false}
        dpr={[1, Math.min(q.dpr, window.devicePixelRatio || 1)]}
        gl={{ antialias: quality !== 'low', powerPreference: 'high-performance' }}
        camera={{ fov: 62, near: 0.15, far: 2600, position: [0, 40, 60] }}
        onCreated={({ gl, scene, camera }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; try { if (localStorage.getItem('nb3d.debug') === '1') Object.assign(window as any, { __nb3dGL: gl, __nb3dScene: scene, __nb3dCam: camera }); } catch { /* ignore */ } }}
      >
        <Suspense fallback={null}><Scene quality={quality} /></Suspense>
      </Canvas>
      {started ? <HUD quality={quality} setQuality={setQuality} /> : (
        <div className="overlay title">
          <div className="tcard">
            <p className="eyebrow">オープンワールド · 第5段階</p>
            <h1>Neon Bay</h1>
            <p className="lede">3Dの街を歩いて、車に乗って走れます。道ばたの車に近づいて「乗る」。スマホの Bay Motors でスーパーカーを買うと、セーフハウス近くのガレージに届きます。</p>
            <ul className="how">
              <li><b>移動</b>{game.isTouch ? '左側のスティック' : 'W A S D'}</li>
              <li><b>視点</b>{game.isTouch ? '右側をドラッグ' : 'マウスをドラッグ'}</li>
              <li><b>操作</b>{game.isTouch ? 'ジャンプ・ダッシュ・しゃがむ・アクション・視点ボタン' : 'Space ジャンプ · Shift ダッシュ · C しゃがむ · E 入る/乗る · V 視点'}</li>
              <li><b>運転</b>{game.isTouch ? '左 ◀ ▶ でハンドル、右にアクセル・ブレーキ(バック)・サイド・降車' : 'W アクセル · S ブレーキ/バック · A D ハンドル · Space サイド · E 降りる'}</li>
              <li><b>武器</b>{game.isTouch ? '武器ボタンで切替、狙うでエイム、撃つで射撃（素手ならパンチ）' : 'X 切替 · 右クリック/Q 狙う · 左クリック/F 撃つ'}。銃は BAY ARMS で購入</li>
              <li><b>新要素</b>ヘリ・ハイパーカー・タクシー、BAY CUSTOMSで改造とニトロ、スタントジャンプ、グレネードと爆発、天気（雨・嵐）</li>
              <li><b>スマホ</b>{game.isTouch ? '右上の「スマホ」' : 'P キー'}：車の購入・ガレージ・マップ・設定</li>
              <li><b>マップ</b>ミニマップをタップで全体マップ、タップで目的地設定</li>
              <li><b>セーブ</b>5秒ごとに自動保存</li>
            </ul>
            <p className="note">地図の黄色い R マークからストーリーミッション（全5話）が遊べます。お金はスマホの「仕事」でも稼げます：コンビニ強盗、現金輸送車強盗、車の輸出、タイムトライアル。手配度が付くとパトカーが追ってきます。街には歩行者と一般車が走り、車を奪う・カツアゲもできます。ストーリーミッションと徒歩の警官はまだ未実装です。</p>
            <button type="button" className="go" onClick={() => { initAudio(); game.started = true; setStarted(true); setTimeout(() => { const n = (giftsMod.dailyState().can ? 1 : 0) + giftsMod.unclaimed().length; if (n) toast(`🎁 ギフトが${n}件届いています（スマホ →「ギフト」）`, 3.2); }, 2500); }}>{hadSave ? '続きから' : 'スタート'}</button>
            {hadSave && <button type="button" className="sub" onClick={() => { clearSave(); location.reload(); }}>最初からやり直す</button>}
          </div>
        </div>
      )}
      <MouseLook enabled={started && !game.isTouch} />
    </div>
  );
}

/** Desktop: drag with any mouse button to look around. */
function MouseLook({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    let down = false, lx = 0, ly = 0;
    const d = (e: MouseEvent) => { if ((e.target as HTMLElement).closest('button,.overlay,.minimap')) return; down = true; lx = e.clientX; ly = e.clientY; if (e.button === 2) input.aimHold = true; if (e.button === 0 && (input.aimHold || input.aim)) input.fire = true; };
    const m = (e: MouseEvent) => { if (!down) return; input.lookDX += e.clientX - lx; input.lookDY += e.clientY - ly; lx = e.clientX; ly = e.clientY; };
    const u = (e: MouseEvent) => { down = false; if (e.button === 2) input.aimHold = false; if (e.button === 0) input.fire = false; };
    addEventListener('mousedown', d); addEventListener('mousemove', m); addEventListener('mouseup', u);
    return () => { removeEventListener('mousedown', d); removeEventListener('mousemove', m); removeEventListener('mouseup', u); };
  }, [enabled]);
  return null;
}
