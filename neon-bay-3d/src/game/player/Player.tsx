import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { game, toast, save } from '../state/store';
import { input, moveVector } from '../input';
import { collide, groundAt, doors, pointBlocked, districtAt, isWater } from '../world/cityGen';
import { INTERIORS, FLOOR, interiorCollide } from '../world/Interiors';
import { clamp, lerp } from '../world/rng';

const R = 0.38, H = 1.8, WALK = 2.3, RUN = 5.2, SPRINT = 8.2, CROUCH = 1.6, GRAV = 22, JUMP = 6.4;
const angDiff = (a: number, b: number) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

/** Character built from primitives with jointed limbs; animated procedurally from speed / airborne / crouch. */
function useCharacter() {
  return useMemo(() => {
    const skin = new THREE.MeshStandardMaterial({ color: '#c98f66', roughness: 0.65 });
    const shirt = new THREE.MeshStandardMaterial({ color: '#ff3f93', roughness: 0.75 });
    const pants = new THREE.MeshStandardMaterial({ color: '#27324f', roughness: 0.85 });
    const shoe = new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.6 });
    const hair = new THREE.MeshStandardMaterial({ color: '#1a1012', roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: '#141417', roughness: 0.5 });
    const cap = (r: number, l: number, m: THREE.Material) => { const g = new THREE.CapsuleGeometry(r, l, 4, 10); const mm = new THREE.Mesh(g, m); mm.castShadow = true; return mm; };
    const root = new THREE.Group(), hips = new THREE.Group(), spine = new THREE.Group(), head = new THREE.Group();
    root.add(hips); hips.position.y = 0.95;
    const pelvis = cap(0.17, 0.12, pants); pelvis.rotation.z = Math.PI / 2; pelvis.scale.set(1, 1.15, 0.8); hips.add(pelvis);
    hips.add(spine); spine.position.y = 0.1;
    const torso = cap(0.2, 0.32, shirt); torso.position.y = 0.3; torso.scale.set(1.15, 1, 0.75); spine.add(torso);
    spine.add(head); head.position.y = 0.66;
    const neck = cap(0.06, 0.06, skin); neck.position.y = -0.06; head.add(neck);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), skin); skull.position.y = 0.1; skull.scale.set(0.95, 1.1, 1); skull.castShadow = true; head.add(skull);
    const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.138, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), hair); hairM.position.y = 0.12; hairM.position.z = -0.01; head.add(hairM);
    const pony = cap(0.045, 0.16, hair); pony.position.set(0, 0.04, -0.15); pony.rotation.x = 0.4; head.add(pony);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 4), dark); e.position.set(s * 0.045, 0.12, 0.118); head.add(e); }
    const mkLimb = (upperLen: number, lowerLen: number, r: number, mU: THREE.Material, mL: THREE.Material, end: THREE.Mesh) => {
      const top = new THREE.Group(), mid = new THREE.Group();
      const u = cap(r, upperLen - r * 2, mU); u.position.y = -upperLen / 2; top.add(u);
      top.add(mid); mid.position.y = -upperLen;
      const l = cap(r * 0.85, lowerLen - r * 2, mL); l.position.y = -lowerLen / 2; mid.add(l);
      end.position.y = -lowerLen; mid.add(end); return { top, mid };
    };
    const arms = [-1, 1].map((s) => { const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), skin); const a = mkLimb(0.3, 0.28, 0.055, shirt, skin, hand); a.top.position.set(s * 0.25, 0.53, 0); spine.add(a.top); return a; });
    const legs = [-1, 1].map((s) => { const foot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.26), shoe); foot.position.z = 0.06; foot.castShadow = true; const l = mkLimb(0.46, 0.45, 0.075, pants, pants, foot); l.top.position.set(s * 0.11, -0.02, 0); hips.add(l.top); return l; });
    return { root, hips, spine, head, arms, legs };
  }, []);
}

export default function Player() {
  const C = useCharacter();
  const grp = useRef<THREE.Group>(null!);
  const { camera } = useThree();
  const st = useMemo(() => ({ phase: 0, vx: 0, vz: 0, lean: 0, saveT: 0, crouchK: 0, landT: 0 }), []);
  const camPos = useMemo(() => new THREE.Vector3(), []), camTgt = useMemo(() => new THREE.Vector3(), []), want = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05), p = game.player, inside = game.where !== 'out', def = INTERIORS[game.where];
    if (!game.started) { st.phase += dt; }
    else {
      // ----- look -----
      game.cam.yaw -= input.lookDX * 0.0055; game.cam.pitch = clamp(game.cam.pitch + input.lookDY * 0.004, -0.35, 1.1);
      input.lookDX = 0; input.lookDY = 0;
      if (input.camCycle) { input.camCycle = false; game.cam.mode = (game.cam.mode + 1) % 3; toast(['標準カメラ', '遠景カメラ', '一人称カメラ'][game.cam.mode], 1.2); }
      if (input.crouchToggle) { input.crouchToggle = false; p.crouch = !p.crouch; }
      // ----- move (camera-relative, PC style: the camera never auto-swings) -----
      const [mx, my] = moveVector(), mag = Math.min(1, Math.hypot(mx, my));
      const yaw = game.cam.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      let dx = fx * my + rx * mx, dz = fz * my + rz * mx; const dl = Math.hypot(dx, dz); if (dl > 1e-3) { dx /= dl; dz /= dl; }
      const wantSprint = input.dash && mag > 0.3 && !p.crouch && game.stamina > 1;
      const top = p.crouch ? CROUCH : wantSprint ? SPRINT : mag > 0.65 || game.isTouch === false ? RUN * (input.joyActive ? mag : 1) : WALK + (RUN - WALK) * mag;
      const sp = top * (input.joyActive ? Math.max(mag, 0.35) : mag > 0 ? 1 : 0) * (inside ? 0.6 : 1);
      const acc = p.grounded ? 14 : 3;
      st.vx = lerp(st.vx, dx * sp, Math.min(1, acc * dt)); st.vz = lerp(st.vz, dz * sp, Math.min(1, acc * dt));
      p.sprinting = wantSprint && Math.hypot(st.vx, st.vz) > RUN;
      game.stamina = clamp(game.stamina + (p.sprinting ? -18 : 12) * dt, 0, 100);
      const ox = p.x, oz = p.z;
      p.x += st.vx * dt; p.z += st.vz * dt;
      // vertical
      if (input.jump) { input.jump = false; if (p.grounded && !p.crouch) { p.vy = JUMP; p.grounded = false; } else if (p.crouch) p.crouch = false; }
      p.vy -= GRAV * dt; p.y += p.vy * dt;
      // collisions
      if (inside && def) { interiorCollide(def, p, R); const g = FLOOR; if (p.y <= g) { if (!p.grounded && p.vy < -8) st.landT = 0.25; p.y = g; p.vy = 0; p.grounded = true; } }
      else {
        collide(p, R, p.y, H);
        if (isWater(p.x, p.z)) { p.x = ox; p.z = oz; } // no swimming yet: the shoreline blocks you
        const g = groundAt(p.x, p.z);
        if (p.y <= g + 0.02 || (p.grounded && p.y - g < 0.45 && p.vy <= 0)) { if (!p.grounded && p.vy < -8) st.landT = 0.25; p.y = g; p.vy = 0; p.grounded = true; } else p.grounded = false;
      }
      p.speed = Math.hypot(st.vx, st.vz);
      if (p.speed > 0.2) p.yaw += angDiff(p.yaw, Math.atan2(st.vx, st.vz)) * Math.min(1, dt * 12);
      // ----- interaction -----
      game.near = null;
      if (inside && def) { if (Math.hypot(p.x - def.ox - def.exit.x, p.z - def.oz - def.exit.z) < 1.6) game.near = { kind: 'exit', label: '外へ出る', id: def.id }; }
      else for (const d of doors) if (Math.hypot(p.x - d.x, p.z - d.z) < 1.8) { game.near = { kind: 'door', label: d.label + 'に入る', id: d.id }; break; }
      if (input.action) {
        input.action = false;
        const n = game.near;
        if (n && n.kind === 'door') {
          const d = doors.find((q) => q.id === n.id)!, I = INTERIORS[d.interior];
          game.outsidePos = { x: d.x + Math.sin(d.ang) * 2.2, z: d.z + Math.cos(d.ang) * 2.2, yaw: d.ang };
          game.where = I.id; p.x = I.ox + I.spawn.x; p.z = I.oz + I.spawn.z; p.y = FLOOR; p.vy = 0; p.yaw = I.spawn.yaw; game.cam.yaw = I.spawn.yaw + Math.PI; st.vx = st.vz = 0;
          toast(I.name, 1.6); save();
        } else if (n && n.kind === 'exit') {
          const o = game.outsidePos; game.where = 'out'; p.x = o.x; p.z = o.z; p.y = groundAt(o.x, o.z); p.vy = 0; p.yaw = o.yaw; game.cam.yaw = o.yaw + Math.PI; st.vx = st.vz = 0; save();
        }
      }
      game.district = inside && def ? def.name : districtAt(p.x, p.z);
      if (game.waypoint && Math.hypot(p.x - game.waypoint.x, p.z - game.waypoint.z) < 12 && !inside) { game.waypoint = null; toast('目的地に到着'); }
      st.saveT += dt; if (st.saveT > 5) { st.saveT = 0; save(); }
    }
    // ----- animation -----
    const spd = game.player.speed, gnd = game.player.grounded, run = clamp(spd / RUN, 0, 1.5);
    st.crouchK = lerp(st.crouchK, game.player.crouch ? 1 : 0, Math.min(1, dt * 10));
    st.landT = Math.max(0, st.landT - dt);
    st.phase += dt * (spd > 0.15 ? 2.2 + spd * 1.35 : 0);
    const s = Math.sin(st.phase), c = Math.cos(st.phase), amp = clamp(spd / 3, 0, 1) * (game.player.crouch ? 0.55 : 1);
    const ck = st.crouchK, land = st.landT * 2.4;
    C.hips.position.y = 0.95 - ck * 0.32 - land * 0.12 + (gnd ? Math.abs(s) * 0.05 * amp : 0);
    C.spine.rotation.x = 0.08 * run + ck * 0.35 + land * 0.3;
    C.spine.rotation.y = s * 0.12 * amp;
    C.head.rotation.x = -C.spine.rotation.x * 0.6;
    const breathe = Math.sin(performance.now() / 700) * 0.02;
    C.legs.forEach((l, i) => {
      const sg = i ? 1 : -1;
      if (!gnd) { l.top.rotation.x = sg > 0 ? -0.7 : 0.25; l.mid.rotation.x = sg > 0 ? 1.1 : 0.4; return; }
      l.top.rotation.x = -sg * s * 0.7 * amp - ck * 1.05;
      l.mid.rotation.x = Math.max(0, sg * c) * 1.15 * amp + ck * 1.75 + land * 0.8;
    });
    C.arms.forEach((a, i) => {
      const sg = i ? 1 : -1;
      if (!gnd) { a.top.rotation.x = -2.4; a.top.rotation.z = sg * 0.3; a.mid.rotation.x = -0.4; return; }
      a.top.rotation.x = sg * s * 0.65 * amp * (0.8 + run * 0.4) + breathe;
      a.top.rotation.z = sg * (0.08 + run * 0.06);
      a.mid.rotation.x = -(0.25 + amp * (0.35 + run * 0.6));
    });
    if (grp.current) { grp.current.position.set(game.player.x, game.player.y, game.player.z); grp.current.rotation.y = game.player.yaw; grp.current.visible = game.cam.mode !== 2 || !game.started; }

    // ----- camera -----
    const P = game.player, mode = game.cam.mode, inside2 = game.where !== 'out';
    const dist = [4.6, 8.5, 0][mode] * (inside2 ? 0.7 : 1), height = (P.crouch ? 1.05 : 1.55);
    const yaw = game.cam.yaw, pitch = game.cam.pitch;
    camTgt.set(P.x, P.y + height, P.z);
    if (!game.started) { // attract orbit over the city
      const t = performance.now() / 12000; camera.position.set(P.x + Math.sin(t) * 60, 45, P.z + Math.cos(t) * 60); camera.lookAt(P.x, 10, P.z); return;
    }
    if (mode === 2) {
      camera.position.set(P.x - Math.sin(yaw) * 0.15, P.y + (P.crouch ? 1.0 : 1.66), P.z - Math.cos(yaw) * 0.15);
      want.set(camera.position.x - Math.sin(yaw) * Math.cos(pitch - 0.25), camera.position.y - Math.sin(pitch - 0.25), camera.position.z - Math.cos(yaw) * Math.cos(pitch - 0.25));
      camera.lookAt(want); return;
    }
    const cx = Math.sin(yaw) * Math.cos(pitch), cz = Math.cos(yaw) * Math.cos(pitch), cy = Math.sin(pitch);
    let d = dist;
    // pull the camera in when a wall is between it and the player
    for (let k = 1; k <= 12; k++) {
      const t = (k / 12) * dist, x = camTgt.x + cx * t, y = camTgt.y + cy * t, z = camTgt.z + cz * t;
      const blocked = inside2 ? (() => { const I = INTERIORS[game.where]; return !I || Math.abs(x - I.ox) > I.w / 2 - 0.25 || Math.abs(z - I.oz) > I.d / 2 - 0.25 || y > FLOOR + I.h - 0.2; })() : pointBlocked(x, y, z) || y < groundAt(x, z) + 0.3;
      if (blocked) { d = Math.max(0.6, t - dist / 12); break; }
    }
    want.set(camTgt.x + cx * d, camTgt.y + cy * d, camTgt.z + cz * d);
    camPos.lerp(want, Math.min(1, dt * 14)); if (camPos.distanceTo(want) > 6) camPos.copy(want);
    camera.position.copy(camPos); camera.lookAt(camTgt.x, camTgt.y + 0.1, camTgt.z);
  });

  return <group ref={grp}><primitive object={C.root} /></group>;
}
