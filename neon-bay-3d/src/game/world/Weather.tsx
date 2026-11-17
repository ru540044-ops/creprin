import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { game } from '../state/store';
import { tdt } from '../admin';
import { rainSound, sfx } from '../audio';

/** Weather cycle (clear -> cloudy -> rain -> storm), rain streaks around the camera, lightning and thunder. */
export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'storm';
export const WEATHER_NAMES: Record<WeatherKind, string> = { clear: '晴れ', cloudy: 'くもり', rain: '雨', storm: '嵐' };
export function setWeather(k: WeatherKind) { game.weather.kind = k; game.weather.next = 600; }

const N = 1600, R = 38, H = 30;
export default function Weather() {
  const lines = useMemo(() => {
    const g = new THREE.BufferGeometry(), pos = new Float32Array(N * 6);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.LineBasicMaterial({ color: '#b8c6d8', transparent: true, opacity: 0, depthWrite: false });
    const l = new THREE.LineSegments(g, m); l.frustumCulled = false;
    const drops = Array.from({ length: N }, () => ({ x: (Math.random() - 0.5) * 2 * R, y: Math.random() * H, z: (Math.random() - 0.5) * 2 * R, s: 22 + Math.random() * 10 }));
    return { l, drops, pos, m };
  }, []);
  const st = useMemo(() => ({ thunder: 8, boom: -1 }), []);
  useFrame(({ camera }, raw) => {
    const dt = tdt(Math.min(raw, 0.05)), W = game.weather;
    // cycle
    if (game.started) { W.next -= dt; if (W.next <= 0) { const r = Math.random(); W.kind = r < 0.45 ? 'clear' : r < 0.7 ? 'cloudy' : r < 0.9 ? 'rain' : 'storm'; W.next = 240 + Math.random() * 300; } }
    const tc = W.kind === 'clear' ? 0 : W.kind === 'cloudy' ? 0.6 : W.kind === 'rain' ? 0.85 : 1, tr = W.kind === 'rain' ? 0.75 : W.kind === 'storm' ? 1 : 0;
    W.cloud += (tc - W.cloud) * Math.min(1, dt / 15); W.rain += (tr - W.rain) * Math.min(1, dt / 10);
    W.wet += ((W.rain > 0.2 ? 1 : 0) - W.wet) * Math.min(1, dt / (W.rain > 0.2 ? 25 : 90));
    W.flash = Math.max(0, W.flash - dt * 3);
    // lightning + delayed thunder during storms
    if (W.kind === 'storm' && W.rain > 0.6 && game.started) { st.thunder -= dt; if (st.thunder <= 0) { st.thunder = 6 + Math.random() * 12; W.flash = 1; st.boom = 0.6 + Math.random() * 1.6; } }
    if (st.boom > 0 && (st.boom -= dt) <= 0) sfx('thunder', 0.7);
    const out = game.where === 'out', vis = out ? W.rain : 0;
    rainSound(vis);
    lines.m.opacity = vis * 0.5; lines.l.visible = vis > 0.02;
    if (!lines.l.visible) return;
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z, wx = 2.5, wz = 1.2, len = 0.9;
    for (let i = 0; i < N; i++) {
      const d = lines.drops[i]; d.y -= d.s * dt; d.x += wx * dt; d.z += wz * dt;
      if (d.y < -4 || Math.abs(d.x) > R || Math.abs(d.z) > R) { d.y = H - Math.random() * 4; d.x = (Math.random() - 0.5) * 2 * R; d.z = (Math.random() - 0.5) * 2 * R; }
      const j = i * 6, x = cx + d.x, y = cy - 8 + d.y, z = cz + d.z;
      lines.pos[j] = x; lines.pos[j + 1] = y; lines.pos[j + 2] = z; lines.pos[j + 3] = x - wx * 0.04; lines.pos[j + 4] = y + len; lines.pos[j + 5] = z - wz * 0.04;
    }
    (lines.l.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });
  return <primitive object={lines.l} />;
}
