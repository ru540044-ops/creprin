import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import City from './game/world/City';
import Environment from './game/world/Environment';
import Interiors from './game/world/Interiors';
import Player from './game/player/Player';
import HUD from './game/ui/HUD';
import { game, load, save, clearSave, Quality } from './game/state/store';
import { bindKeyboard, input } from './game/input';
import { doors, SPAWN, groundAt } from './game/world/cityGen';
(window as any).__nb3d = { game, input, doors, SPAWN, groundAt };

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
function Ticker() {
  const acc = useRef({ t: 0, n: 0 });
  useFrame((st, dt) => {
    acc.current.t += dt; acc.current.n++; if (acc.current.t > 0.5) { game.fps = Math.round(acc.current.n / acc.current.t); acc.current.t = 0; acc.current.n = 0; }
    if (game.toastT > 0) game.toastT -= dt;
    if (game.started) game.clock += dt;
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
      <Interiors where={where} />
      <Player />
      <Waypoint />
      <Ticker />
    </>
  );
}

export default function App() {
  const hadSave = useMemo(() => load(), []);
  const [started, setStarted] = useState(false);
  const [quality, setQuality] = useState<Quality>(game.quality);
  useEffect(() => { bindKeyboard(); }, []);
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
        onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; }}
      >
        <Suspense fallback={null}><Scene quality={quality} /></Suspense>
      </Canvas>
      {started ? <HUD quality={quality} setQuality={setQuality} /> : (
        <div className="overlay title">
          <div className="tcard">
            <p className="eyebrow">オープンワールド · 第1段階</p>
            <h1>Neon Bay</h1>
            <p className="lede">3Dの街を自由に歩き回れます。ダウンタウン、商店街、住宅街、工業地帯、公園、ビーチ、港、空港、山、高速道路。店のドアの前でアクションを押すと中に入れます。</p>
            <ul className="how">
              <li><b>移動</b>{game.isTouch ? '左側のスティック' : 'W A S D'}</li>
              <li><b>視点</b>{game.isTouch ? '右側をドラッグ' : 'マウスをドラッグ'}</li>
              <li><b>操作</b>{game.isTouch ? 'ジャンプ・ダッシュ・しゃがむ・アクション・視点ボタン' : 'Space ジャンプ · Shift ダッシュ · C しゃがむ · E 入る · V 視点'}</li>
              <li><b>マップ</b>ミニマップをタップで全体マップ、タップで目的地設定</li>
              <li><b>セーブ</b>5秒ごとに自動保存</li>
            </ul>
            <p className="note">車・NPC・警察・ミッションは次の段階で追加します（この段階では未実装です）。</p>
            <button type="button" className="go" onClick={() => { game.started = true; setStarted(true); }}>{hadSave ? '続きから' : 'スタート'}</button>
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
    const d = (e: MouseEvent) => { if ((e.target as HTMLElement).closest('button,.overlay,.minimap')) return; down = true; lx = e.clientX; ly = e.clientY; };
    const m = (e: MouseEvent) => { if (!down) return; input.lookDX += e.clientX - lx; input.lookDY += e.clientY - ly; lx = e.clientX; ly = e.clientY; };
    const u = () => { down = false; };
    addEventListener('mousedown', d); addEventListener('mousemove', m); addEventListener('mouseup', u);
    return () => { removeEventListener('mousedown', d); removeEventListener('mousemove', m); removeEventListener('mouseup', u); };
  }, [enabled]);
  return null;
}
