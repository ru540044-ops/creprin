import { admin, tdt } from '../admin';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Sky, Stars } from '@react-three/drei';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { game } from '../state/store';
import { nightMats, wetMats } from './City';
import { smooth } from './rng';

/** Sun, sky, fog and day/night cycle. One in-game day = game.dayLen real seconds. */
export default function Environment({ shadows, shadowSize }: { shadows: boolean; shadowSize: number }) {
  const sun = useRef<THREE.DirectionalLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const sky = useRef<any>(null!);
  const stars = useRef<THREE.Points>(null!);
  const { scene, gl } = useThree();
  const fog = useMemo(() => new THREE.Fog('#c9d6e6', 200, 1500), []);
  scene.fog = fog;
  useMemo(() => { const pm = new THREE.PMREMGenerator(gl); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); }, [gl, scene]);
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
    L.intensity = (day * 2.6 + night * 0.25) * (1 - 0.7 * cl) + W.flash * 3;
    L.color.copy(cols.day).lerp(cols.dusk, dusk * 0.8).lerp(cols.night, night);
    hemi.current.intensity = (0.25 + day * 0.75 + night * 0.12) * (1 - 0.25 * cl) + W.flash * 2.5;
    hemi.current.color.setRGB(0.62 + day * 0.2, 0.7 + day * 0.15, 0.85 + day * 0.1).lerp(cols.night, night * 0.6);
    hemi.current.groundColor.setRGB(0.32, 0.28, 0.25).multiplyScalar(0.4 + day * 0.6);
    fog.color.copy(cols.fogDay).lerp(cols.fogDusk, dusk * 0.7).lerp(cols.fogNight, night);
    fog.color.lerp(cols.night.clone().setRGB(0.45, 0.48, 0.53).multiplyScalar(0.25 + day * 0.75), cl * 0.75);
    fog.near = (120 + day * 120) * (1 - 0.65 * W.rain); fog.far = (900 + day * 700) * (1 - 0.62 * W.rain);
    gl.toneMappingExposure = (0.85 + day * 0.25 + night * 0.35) * (1 - 0.12 * cl);
    for (const w of wetMats) { w.m.roughness = w.r * (1 - 0.62 * W.wet); w.m.color.setScalar(1 - 0.3 * W.wet); }
    (scene as any).environmentIntensity = 0.12 + day * 0.55;
    if (stars.current) (stars.current.material as THREE.PointsMaterial).opacity = night;
    const lit = smooth(0.15, -0.1, elev);
    for (const n of nightMats) { if (n.kind === 'emissive') (n.m as THREE.MeshStandardMaterial).emissiveIntensity = lit * n.k + (n.k > 2 ? 0.05 : 0); else { (n.m as THREE.MeshBasicMaterial).opacity = lit * n.k; } }
  });

  return (
    <>
      <Sky ref={sky} distance={4500} sunPosition={[100, 20, 100]} mieCoefficient={0.005} mieDirectionalG={0.8} />
      <Stars ref={stars as any} radius={1800} depth={200} count={1500} factor={10} fade saturation={0} />
      <hemisphereLight ref={hemi} args={['#bcd0ea', '#5a4a3a', 1]} />
      <directionalLight ref={sun} castShadow={shadows} shadow-mapSize-width={shadowSize} shadow-mapSize-height={shadowSize} shadow-camera-near={10} shadow-camera-far={600} shadow-camera-left={-90} shadow-camera-right={90} shadow-camera-top={90} shadow-camera-bottom={-90} shadow-bias={-0.0004} shadow-normalBias={0.04} />
    </>
  );
}
