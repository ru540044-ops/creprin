import { admin, tdt } from '../admin';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky, Stars } from '@react-three/drei';
import { game } from '../state/store';
import { nightMats, wetMats } from './City';
import { smooth } from './rng';
import { inTunnel, TUN } from './cityGen';

/** Sun, sky, fog and day/night cycle. One in-game day = game.dayLen real seconds. */
/** Lighting balance, tweakable from the debug hook. */
/** Current key-light direction (normalised, world space) and whether it is the sun (vs the moon). */
export const sunState = { dir: new THREE.Vector3(0, 1, 0), isSun: true, day: 1, dusk: 0 };
export const look = { sun: 3.2, hemi: 0.55, env: 1.0, exposure: 0.95 };

export default function Environment({ shadows, shadowSize }: { shadows: boolean; shadowSize: number }) {
  const sun = useRef<THREE.DirectionalLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const sky = useRef<any>(null!);
  const stars = useRef<THREE.Points>(null!);
  const { scene, gl, camera } = useThree();
  const fog = useMemo(() => new THREE.Fog('#c9d6e6', 200, 1500), []);
  scene.fog = fog;
  // Reflections come from a painted copy of the current sky (zenith, horizon, sun glow, ground), re-baked as time passes.
  const envGen = useMemo(() => {
    const W = 256, H = 128, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const tex = new THREE.CanvasTexture(cv); tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace;
    const pm = new THREE.PMREMGenerator(gl); let rt: THREE.WebGLRenderTarget | null = null;
    const c = cv.getContext('2d')!, last = { h: -99, cl: -1 };
    const mix = (a: THREE.Color, b: THREE.Color, t: number) => a.clone().lerp(b, t);
    const C = (h: string) => new THREE.Color(h);
    const P = { zDay: C('#2f6fd0'), hDay: C('#a9c4e2'), zDusk: C('#2b335e'), hDusk: C('#ff9a60'), zNight: C('#03050b'), hNight: C('#1b2440'), gDay: C('#5a554c'), gNight: C('#0c0b10'), cloud: C('#8c939c') };
    return (h: number, day: number, dusk: number, night: number, sun: THREE.Vector3, cloud: number) => {
      if (Math.abs(h - last.h) < 0.06 && Math.abs(cloud - last.cl) < 0.04) return;
      last.h = h; last.cl = cloud;
      let zen = mix(mix(P.zNight, P.zDay, day), P.zDusk, dusk * 0.7), hor = mix(mix(P.hNight, P.hDay, day), P.hDusk, dusk * 0.85);
      const grey = P.cloud.clone().multiplyScalar(0.25 + day * 0.75); zen = mix(zen, grey, cloud * 0.8); hor = mix(hor, grey, cloud * 0.7);
      const gnd = mix(P.gNight, P.gDay, day);
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#' + zen.getHexString()); g.addColorStop(0.47, '#' + hor.getHexString()); g.addColorStop(0.5, '#' + mix(hor, gnd, 0.5).getHexString()); g.addColorStop(1, '#' + gnd.getHexString());
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      if (night > 0.3) { const cg = c.createLinearGradient(0, H * 0.38, 0, H * 0.5); cg.addColorStop(0, 'rgba(255,140,80,0)'); cg.addColorStop(1, `rgba(255,140,90,${0.22 * night})`); c.fillStyle = cg; c.fillRect(0, H * 0.38, W, H * 0.12); } // city glow
      const d = sun.y > -0.05 ? sun : sun.clone().set(-sun.x, Math.abs(sun.y) * 0.8 + 0.2, -sun.z);
      const u = Math.atan2(d.z, d.x) / (Math.PI * 2) + 0.5, v = Math.asin(Math.max(-1, Math.min(1, d.y))) / Math.PI + 0.5, x = u * W, y = (1 - v) * H;
      const sunCol = sun.y > -0.05 ? (dusk > 0.3 ? '255,170,90' : '255,250,235') : '200,215,255', sunA = (sun.y > -0.05 ? 1 : 0.35) * (1 - cloud * 0.8);
      const sg = c.createRadialGradient(x, y, 0, x, y, sun.y > -0.05 ? 34 : 10); sg.addColorStop(0, `rgba(${sunCol},${sunA})`); sg.addColorStop(0.15, `rgba(${sunCol},${sunA * 0.6})`); sg.addColorStop(1, `rgba(${sunCol},0)`);
      c.fillStyle = sg; c.fillRect(0, 0, W, H);
      tex.needsUpdate = true;
      const next = pm.fromEquirectangular(tex); scene.environment = next.texture; if (rt) rt.dispose(); rt = next;
    };
  }, [gl, scene]);
  const sunPos = useMemo(() => new THREE.Vector3(), []);
  const cols = useMemo(() => ({ day: new THREE.Color('#fff4e0'), dusk: new THREE.Color('#ff9a5a'), night: new THREE.Color('#7a90c8'), fogDay: new THREE.Color('#c4d3e4'), fogDusk: new THREE.Color('#e0a284'), fogNight: new THREE.Color('#0d1424') }), []);
  const moonDir = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    if (game.started && !(admin.is && admin.freezeTime)) game.hour = (game.hour + (tdt(dt) * 24) / game.dayLen) % 24;
    const h = game.hour, ang = ((h - 6) / 12) * Math.PI; // 6h sunrise, 18h sunset
    const elev = Math.sin(ang), az = Math.cos(ang);
    sunPos.set(az * 0.75, elev, 0.45).normalize();
    const day = smooth(-0.08, 0.25, elev), dusk = 1 - Math.abs(smooth(-0.15, 0.45, elev) * 2 - 1), night = 1 - smooth(-0.18, 0.05, elev);
    if (sky.current) { const u = sky.current.material.uniforms; u.sunPosition.value.copy(sunPos).multiplyScalar(4000); u.rayleigh.value = 1.2 + dusk * 1.5 + game.weather.cloud * 2.5; u.turbidity.value = 5 + dusk * 4 + game.weather.cloud * 14; }
    // key light: sun by day, cool moon at night
    const p = game.player, L = sun.current;
    const dir = elev > -0.05 ? sunPos : moonDir.set(-az * 0.6, 0.7, -0.4).normalize();
    L.position.set(p.x + dir.x * 220, (game.where === 'out' ? 0 : -50) + dir.y * 220, p.z + dir.z * 220); L.target.position.set(p.x, game.where === 'out' ? 0 : -50, p.z); L.target.updateMatrixWorld();
    const W = game.weather, cl = W.cloud;
    const indoor = game.where !== 'out';
    // in the Shinkansen tunnel: no daylight, a dark haze down the bore
    { const c = camera.position, want = game.where === 'out' && inTunnel(c.x, c.z) && c.y < TUN.y + 10 ? 1 : 0; game.tunnel += (want - game.tunnel) * Math.min(1, dt * 3); }
    const tun = game.tunnel;
    L.intensity = ((day * look.sun + night * 0.25) * (1 - 0.7 * cl) + W.flash * 3) * (indoor ? 0.1 : 1) * (1 - 0.92 * tun);
    L.color.copy(cols.day).lerp(cols.dusk, dusk * 0.8).lerp(cols.night, night);
    hemi.current.intensity = ((0.3 + day * look.hemi + night * 0.22) * (1 + 0.3 * cl) + W.flash * 2.5) * (indoor ? 0.45 : 1) * (1 - 0.7 * tun);
    hemi.current.color.setRGB(0.62 + day * 0.2, 0.7 + day * 0.15, 0.85 + day * 0.1).lerp(cols.night, night * 0.6);
    hemi.current.groundColor.setRGB(0.32, 0.28, 0.25).multiplyScalar(0.4 + day * 0.6);
    fog.color.copy(cols.fogDay).lerp(cols.fogDusk, dusk * 0.7).lerp(cols.fogNight, night);
    fog.color.lerp(cols.night.clone().setRGB(0.45, 0.48, 0.53).multiplyScalar(0.25 + day * 0.75), cl * 0.75);
    fog.color.multiplyScalar(1 - 0.93 * tun);
    fog.near = (120 + day * 120) * (1 - 0.65 * W.rain) * (1 - 0.6 * tun); fog.far = (900 + day * 700) * (1 - 0.62 * W.rain) * (1 - 0.55 * tun);
    gl.toneMappingExposure = (0.85 + day * 0.25 + night * 0.35) * (1 - 0.12 * cl) * look.exposure;
    for (const w of wetMats) { w.m.roughness = w.r * (1 - 0.62 * W.wet); w.m.color.setScalar(1 - 0.3 * W.wet); }
    (scene as any).environmentIntensity = (0.45 + day * 0.55) * look.env * (1 - 0.8 * tun);
    if (stars.current) (stars.current.material as THREE.PointsMaterial).opacity = night * (1 - W.cloud);
    envGen(h, day, dusk, night, sunPos, W.cloud);
    sunState.dir.copy(sunPos); sunState.isSun = elev > -0.05; sunState.day = day; sunState.dusk = dusk;
    const lit = smooth(0.15, -0.1, elev);
    for (const n of nightMats) { if (n.kind === 'emissive') (n.m as THREE.MeshStandardMaterial).emissiveIntensity = lit * n.k + (n.k > 2 ? 0.05 : 0); else { (n.m as THREE.MeshBasicMaterial).opacity = lit * n.k; } }
  });

  return (
    <>
      <Sky ref={sky} distance={4500} sunPosition={[100, 20, 100]} mieCoefficient={0.0025} mieDirectionalG={0.86} />
      <Stars ref={stars as any} radius={1800} depth={200} count={1500} factor={10} fade saturation={0} />
      <hemisphereLight ref={hemi} args={['#bcd0ea', '#5a4a3a', 1]} />
      <directionalLight ref={sun} castShadow={shadows} shadow-mapSize-width={shadowSize} shadow-mapSize-height={shadowSize} shadow-camera-near={10} shadow-camera-far={600} shadow-camera-left={-90} shadow-camera-right={90} shadow-camera-top={90} shadow-camera-bottom={-90} shadow-bias={-0.0004} shadow-normalBias={0.04} />
    </>
  );
}
