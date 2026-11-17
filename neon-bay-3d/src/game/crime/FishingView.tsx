import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { fish } from './fishing';
import { game } from '../state/store';
import { WATER_Y } from '../world/cityGen';

/** The rod, the line, the float and what is on the end of it. */
export default function FishingView() {
  const N = 14;
  const g = useMemo(() => {
    const root = new THREE.Group(); root.visible = false;
    const bob = new THREE.Group(); const top = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ff3b30', roughness: 0.5 })); const bot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.5 })); bob.add(top, bot);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 5), new THREE.MeshStandardMaterial({ color: '#f4f4f0' })); stick.position.y = 0.16; bob.add(stick);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    const pts = new Float32Array(N * 3), lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: '#e8e8e8', transparent: true, opacity: 0.85 })); line.frustumCulled = false;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 1, 6), new THREE.MeshStandardMaterial({ color: '#2b2118', roughness: 0.6 }));
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#06121c', transparent: true, opacity: 0.45, depthWrite: false })); shadow.scale.set(1, 1, 2.2);
    root.add(bob, ring, line, rod, shadow);
    return { root, bob, ring, line, pts, lg, rod, shadow };
  }, []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []), d = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const on = fish.on && game.where === 'out'; g.root.visible = on; if (!on) return;
    const p = game.player, t = clock.elapsedTime, y = WATER_Y + 0.06;
    // the fish comes in along the line as it is reeled; the float dips on a bite and bobs while it fights
    const k = fish.phase === 'reel' ? 1 - fish.dist / fish.dist0 : 0, fx = fish.bx + (p.x - fish.bx) * Math.max(0, k) * 0.8, fz = fish.bz + (p.z - fish.bz) * Math.max(0, k) * 0.8;
    const cast = fish.phase === 'cast' ? Math.min(1, fish.t / 0.9) : 1;
    const arc = fish.phase === 'cast' ? Math.sin(cast * Math.PI) * 3 : 0;
    const bx = p.x + (fx - p.x) * cast, bz = p.z + (fz - p.z) * cast, by = y + arc + (fish.phase === 'bite' ? -0.07 + Math.sin(t * 40) * 0.025 : fish.phase === 'reel' ? Math.sin(t * 9) * 0.03 : Math.sin(t * 1.7) * 0.015);
    g.bob.position.set(bx, by, bz);
    g.ring.position.set(bx, y + 0.01, bz); const rs = 0.3 + ((t * 0.7) % 1) * (fish.phase === 'bite' || fish.phase === 'reel' ? 1.1 : 0.5); g.ring.scale.set(rs, 1, rs); (g.ring.material as THREE.MeshBasicMaterial).opacity = (1 - (rs / 1.4)) * (fish.phase === 'wait' ? 0.25 : 0.55) * (cast < 1 ? 0 : 1);
    g.shadow.visible = fish.phase === 'reel'; g.shadow.position.set(fx, y - 0.04, fz); g.shadow.rotation.y = Math.atan2(p.x - fx, p.z - fz) + Math.sin(t * 6) * 0.3;
    // the rod: from the hand out over the water, bending with the tension
    const hx = p.x + Math.sin(p.yaw) * 0.35, hy = p.y + 1.0, hz = p.z + Math.cos(p.yaw) * 0.35, tx = p.x + Math.sin(p.yaw) * 1.7, ty = p.y + 1.75 - fish.tension * 0.5 * (fish.phase === 'reel' ? 1 : 0), tz = p.z + Math.cos(p.yaw) * 1.7;
    d.set(tx - hx, ty - hy, tz - hz); const L = d.length(); g.rod.scale.set(1, L, 1); g.rod.position.set((hx + tx) / 2, (hy + ty) / 2, (hz + tz) / 2); g.rod.quaternion.setFromUnitVectors(up, d.normalize());
    // the line: tip of the rod to the float, sagging when slack
    const sag = 0.5 * (1 - (fish.phase === 'reel' ? fish.tension : 0.2)) + 0.05;
    for (let i = 0; i < N; i++) { const u = i / (N - 1); g.pts[i * 3] = tx + (bx - tx) * u; g.pts[i * 3 + 1] = ty + (by + 0.12 - ty) * u - Math.sin(u * Math.PI) * sag; g.pts[i * 3 + 2] = tz + (bz - tz) * u; }
    g.lg.attributes.position.needsUpdate = true;
  });
  return <primitive object={g.root} />;
}
