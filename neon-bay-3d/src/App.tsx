import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import City from './game/world/City';
import CruiseShip from './game/world/CruiseShip';
import Landmarks from './game/world/Landmarks';
import Signature from './game/world/Signature';
import ShinkansenLine from './game/world/ShinkansenLine';
import Mountains from './game/world/Mountains';
import Railway from './game/world/Railway';
import Environment from './game/world/Environment';
import Interiors from './game/world/Interiors';
import Player from './game/player/Player';
import HUD from './game/ui/HUD';
import Vehicles from './game/vehicles/Vehicles';
import CrimeView from './game/crime/CrimeView';
import GiftView from './game/crime/GiftView';
import { initNetGifts } from './game/crime/gifts';
import * as giftsMod from './game/crime/gifts';
import * as ambientMod from './game/ai/ambient';
import * as progressionMod from './game/progression';
import * as appearanceMod from './game/player/appearance';
import * as playerMod from './game/player/Player';
import * as settingsMod from './game/settings';
import * as cityMod from './game/world/cityGen';
import { progress, ownedCars } from './game/state/store';
import Birds from './game/world/Birds';
import Weather from './game/world/Weather';
import Effects from './game/world/Effects';
import LightFX from './game/world/LightFX';
import Detail from './game/world/Detail';
import Clouds from './game/world/Clouds';
import { wind, cityStream } from './game/world/City';
import { look } from './game/world/Environment';
import { PedsView, FXView, AmbientProps } from './game/ai/PedsView';
import { peds } from './game/ai/peds';
import * as pedsMod from './game/ai/peds';
import * as traffic from './game/ai/traffic';
import * as weapons from './game/combat/weapons';
import { vehicles, playerCar, owned, spawn, remove, drive, collisions } from './game/vehicles/sim';
import { initAudio, ambience, pauseAudio, music, trainAudioState } from './game/audio';
import { settings, loadSettings, saveSettings, autoQuality, QualityMode } from './game/settings';
import { updateProgression, startTutorial, tutorial } from './game/progression';
import { TitleScreen, PauseMenu, ErrorBoundary } from './game/ui/Menus';
import { storyStatus } from './game/crime/story';
import { BEACH_X, HALF } from './game/world/cityGen';
import { checkAdmin, tdt } from './game/admin';
import * as adminMod from './game/admin';
import * as explodeMod from './game/combat/explode';
import * as stuntsMod from './game/crime/stunts';
import * as raceMod from './game/crime/race';
import * as story from './game/crime/story';
import { BDOORS } from './game/world/bldgInteriors';
import { RAMPS, HELIPADS, CUSTOMS, floorAt, solids } from './game/world/cityGen';
import { game, load, save, clearSave, Quality, toast, arrival } from './game/state/store';
import { bindKeyboard, input } from './game/input';
import { doors, SPAWN, groundAt, buildings, TRIALS, LANDMARKS, EXPORT_DOCK, POLICE_HQ } from './game/world/cityGen';
import * as crime from './game/crime/crime';
import { steer, newAI } from './game/ai/driver';
import { INTERIORS } from './game/world/Interiors';
import { ArrivalScreen, TRAVEL_KEY } from './game/ui/TravelApp';
import * as japanMod from './game/crime/japan';
import * as shopsMod from './game/crime/shops';
import type { RegionId } from './game/world/region';
import { REGION } from './game/world/region'; // after the game modules (import cycles resolve in the old order)
try { if (localStorage.getItem('nb3d.debug') === '1') (window as any).__nb3d = { REGION, japanMod, shopsMod, trainAudioState, cityStream, appearanceMod, playerMod, progressionMod, settingsMod, ambientMod, giftsMod, cityMod, progress, ownedCars, story, floorAt, solids, BDOORS, look, raceMod, explodeMod, stuntsMod, RAMPS, HELIPADS, CUSTOMS, adminMod, peds, pedsMod, traffic, weapons, crime, steer, newAI, TRIALS, LANDMARKS, EXPORT_DOCK, POLICE_HQ, INTERIORS, game, input, doors, buildings, SPAWN, groundAt, vehicles, playerCar, owned, spawn, remove, drive, collisions }; } catch { /* storage blocked */ } // test hook, off by default

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
export const boot = { ready: false, frames: 0 };
const remountAt = { t: -1e9 };
function Ticker({ quality, onSlow }: { quality: Quality; onSlow: () => void }) {
  const acc = useRef({ t: 0, n: 0 }), slow = useRef({ t: 0, bad: 0 });
  const setDpr = useThree((s) => s.setDpr), dyn = useRef({ dpr: 0, t: 0 });
  useFrame((st, rawDt) => {
    const dt = Math.min(rawDt, 0.25); // the first frame after a pause can report minutes
    // dynamic resolution: drop render scale when the frame rate sags, raise it again when there is headroom
    const D = dyn.current, max = Math.min(Q[quality].dpr, window.devicePixelRatio || 1), min = quality === 'low' ? 0.6 : 0.75;
    if (D.dpr === 0) D.dpr = max;
    D.t += dt; if (D.t > 2.5 && game.started) { D.t = 0; const nd = game.fps < 32 ? Math.max(min, D.dpr - 0.25) : game.fps > 56 ? Math.min(max, D.dpr + 0.25) : D.dpr; if (nd !== D.dpr) { D.dpr = nd; setDpr(nd); } }
    // auto quality: if the frame rate stays low even at the lowest render scale, step the quality down (once per level)
    const W = slow.current; if (game.started && settings.quality === 'auto' && quality !== 'low') { W.t += dt; if (W.t > 1) { W.bad = D.dpr <= min + 0.01 && game.fps < 24 ? W.bad + W.t : 0; W.t = 0; if (W.bad > 8) { W.bad = 0; onSlow(); } } }
    boot.frames++; if (!boot.ready && boot.frames > 12 && (cityStream.pending === 0 || boot.frames > 1200)) boot.ready = true; // wait until the streamed city around the camera is built
    updateProgression(dt); japanMod.updateTrain(); shopsMod.updateShops(tdt(dt));
    // a drink or two: the view sways for a while (after the player camera has been placed this frame)
    if (shopsMod.buffs.tipsy > 0 && game.started) { const k = Math.min(1, shopsMod.buffs.tipsy / 6), t = st.clock.elapsedTime; st.camera.rotateZ(Math.sin(t * 1.3) * 0.035 * k); st.camera.rotateX(Math.sin(t * 0.9 + 1) * 0.012 * k); }
    // ambient sound
    const p = game.where === 'out' ? game.player : game.outsidePos, me = playerCar(), h = game.hour, day = h > 6.5 && h < 18.5 ? 1 : 0;
    ambience({ out: game.where === 'out' && game.started, inCar: !!me, day, city: Math.abs(p.x) < HALF && Math.abs(p.z) < HALF ? 1 : 0.2, sea: Math.max(0, Math.min(1, 1 - Math.abs(p.x - BEACH_X - 13) / 70)), height: me ? me.y : game.player.y, dt });
    acc.current.t += rawDt; acc.current.n++; if (acc.current.t > 0.5) { game.fps = Math.round(acc.current.n / acc.current.t); acc.current.t = 0; acc.current.n = 0; }
    if (game.toastT > 0) game.toastT -= dt;
    if (game.hurtT > 0) game.hurtT -= dt;
    if (game.fadeT > 0) game.fadeT -= dt;
    if (game.started) game.clock += tdt(dt);
    wind.value += dt;
  });
  return null;
}

function Scene({ quality, onSlow }: { quality: Quality; onSlow: () => void }) {
  const [where, setWhere] = useState(game.where);
  useFrame(() => { if (game.where !== where) setWhere(game.where); });
  const q = Q[quality];
  return (
    <>
      <Environment shadows={q.shadows} shadowSize={q.size} />
      <Mountains />
      <City shadows={q.shadows} />
      <CruiseShip />
      <Landmarks />
      <Signature />
      <ShinkansenLine />
      <Railway />
      <Interiors where={where} />
      <Player />
      <Vehicles />
      <CrimeView />
      <GiftView />
      <PedsView />
      <AmbientProps />
      <FXView />
      <Birds />
      <Weather />
      <LightFX />
      <Detail />
      <Clouds />
      <Effects quality={quality} />
      <Waypoint />
      <Ticker quality={quality} onSlow={onSlow} />
    </>
  );
}

export default function App() {
  const hadSave = useMemo(() => { const h = load(); loadSettings(h); if (!h) game.hour = 17.9; return h; }, []);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [lost, setLost] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<QualityMode>(settings.quality);
  const [autoQ, setAutoQ] = useState<Quality>(autoQuality(game.isTouch));
  const quality: Quality = mode === 'auto' ? autoQ : mode;
  const prevQ = useRef(quality);
  const savedHour = useRef(game.hour);
  const arriving = useMemo(() => { try { return hadSave && !!localStorage.getItem(TRAVEL_KEY); } catch { return false; } }, [hadSave]);
  useEffect(() => { bindKeyboard(); checkAdmin(); initNetGifts(); if (!started) game.hour = 17.9; }, []);
  useEffect(() => { game.quality = quality; save(); }, [quality]);
  if (prevQ.current !== quality) { prevQ.current = quality; remountAt.t = performance.now(); }
  useEffect(() => { const id = setInterval(() => { if (boot.ready) { setReady(true); clearInterval(id); } }, 200); return () => clearInterval(id); }, [quality]);
  // pause: freeze the render loop and the sound; Esc toggles, leaving the app pauses
  const pause = (on: boolean) => { if (!game.started) return; setPaused(on); pauseAudio(on); if (on) { save(); input.keys.clear(); } };
  useEffect(() => { game.paused = paused; }, [paused]);
  useEffect(() => {
    const vis = () => { if (document.hidden) { save(); if (game.started) pause(true); } };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && game.started && !game.phone && !game.mapOpen) pause(!game.paused); };
    document.addEventListener('visibilitychange', vis); addEventListener('pagehide', save); addEventListener('keydown', key);
    const block = (e: TouchEvent) => { if ((e.target as HTMLElement).closest('.overlay,.mpanel-wrap')) return; e.preventDefault(); };
    document.addEventListener('touchmove', block, { passive: false });
    return () => { document.removeEventListener('visibilitychange', vis); removeEventListener('pagehide', save); removeEventListener('keydown', key); document.removeEventListener('touchmove', block); };
  }, []);
  // watchdog: if frames stop arriving while the game is visible and running (an exception killed the render loop), offer a reload
  useEffect(() => {
    let last = -1, still = 0;
    const id = setInterval(() => {
      if (document.hidden || game.paused || !boot.ready || performance.now() - remountAt.t < 30000) { still = 0; last = boot.frames; return; }
      if (boot.frames === last) { still += 1; if (still >= 10) { save(); setFrozen(true); clearInterval(id); } } else still = 0;
      last = boot.frames;
    }, 2000);
    return () => clearInterval(id);
  }, []);
  const firstTouch = () => { initAudio(); music.title = true; };
  const begin = (fresh: boolean) => {
    initAudio(); music.title = false; game.started = true; game.hour = fresh ? 9.5 : savedHour.current; setStarted(true); save();
    if (arrival.drive) { arrival.drive = false; setTimeout(() => japanMod.startArrivalDrive(arrival.from as RegionId), 300); } // came in driving the bullet train: carry on in the cab
    else if (!(fresh && !settings.tutorialDone)) setTimeout(() => { if (tutorial.step < 0) japanMod.shinHint(); }, 6000);
    if (fresh && !settings.tutorialDone) setTimeout(() => startTutorial(), 600);
    setTimeout(() => { const n = (giftsMod.dailyState().can ? 1 : 0) + giftsMod.unclaimed().length; if (n && tutorial.step < 0) toast(`🎁 ギフトが${n}件届いています（スマホ →「ギフト」）`, 3.2); }, 2500);
  };
  const newGame = () => { if (hadSave) { clearSave(); settings.tutorialDone = false; saveSettings(); location.reload(); return; } begin(true); };
  const q = Q[quality];
  const goal = (() => { const s = storyStatus(); return s ? s.text : '自由行動中'; })();
  return (
    <div className="app" onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => { if (!game.isTouch && e.pointerType === 'mouse' && started && e.button === 2) (e.currentTarget as any).dataset.drag = '1'; }}>
      <ErrorBoundary>
        <Canvas
          key={quality}
          frameloop={paused || lost ? 'never' : 'always'}
          shadows={q.shadows ? 'soft' : false}
          dpr={[1, Math.min(q.dpr, window.devicePixelRatio || 1)]}
          gl={{ antialias: quality !== 'low', powerPreference: 'high-performance' }}
          camera={{ fov: 62, near: 0.15, far: 2600, position: [0, 40, 60] }}
          onCreated={({ gl, scene, camera }) => {
            gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace;
            // a lost GPU context (iOS does this under memory pressure) cannot be patched up reliably: save and offer a reload
            // (switching quality remounts the canvas and tears the old context down on purpose: ignore that one)
            const el = gl.domElement; el.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (!el.isConnected || performance.now() - remountAt.t < 8000) return; save(); setLost(true); }, false);
            gl.domElement.addEventListener('webglcontextrestored', () => location.reload(), false);
            try { if (localStorage.getItem('nb3d.debug') === '1') Object.assign(window as any, { __nb3dGL: gl, __nb3dScene: scene, __nb3dCam: camera }); } catch { /* ignore */ }
          }}
        >
          <Suspense fallback={null}><Scene quality={quality} onSlow={() => { if (quality === 'low') return; const nq: Quality = quality === 'high' ? 'medium' : 'low'; setAutoQ(nq); toast(`動作を軽くするため画質を「${nq === 'low' ? '低' : '中'}」にしました（設定で変更できます）`, 4); }} /></Suspense>
        </Canvas>
        {started && <HUD quality={quality} mode={mode} setMode={setMode} onPause={() => pause(true)} />}
        {!started && arriving && <ArrivalScreen ready={ready} onGo={() => begin(false)} />}
        {!started && !arriving && <TitleScreen hadSave={hadSave} ready={ready} onStart={() => begin(false)} onNewGame={newGame} mode={mode} setMode={setMode} effective={quality} onFirstTouch={firstTouch} />}
        {started && paused && <PauseMenu onResume={() => pause(false)} mode={mode} setMode={setMode} effective={quality} goal={goal} />}
        {frozen && !lost && <div className="overlay fatal"><div className="mpanel"><div className="mpanel-body"><p className="ptitle small">動作が止まりました</p><p>申し訳ありません。進行状況は保存されています。再読み込みすると続きから遊べます。</p><button type="button" className="mbtn primary" onClick={() => location.reload()}>再読み込み<span>↻</span></button></div></div></div>}
        {lost && <div className="overlay fatal"><div className="mpanel"><div className="mpanel-body"><p className="ptitle small">画面を復旧します</p><p>グラフィックが一時的に止まりました。進行状況は保存されています。</p><button type="button" className="mbtn primary" onClick={() => location.reload()}>再読み込み<span>↻</span></button></div></div></div>}
      </ErrorBoundary>
      <MouseLook enabled={started && !paused && !game.isTouch} />
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
