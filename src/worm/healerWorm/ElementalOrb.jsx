// src/worm/healerWorm/ElementalOrb.jsx
//
// The elemental offering as it sits on the board: a real orb, not a floating decal.
//
// It is built in layers, outside in:
//   • a ground pool of element-coloured light on the tile it hovers over, so the orb
//     is anchored to the cube instead of pasted over it (plus a one-shot shockwave
//     ring on spawn, which is what makes a new offering catch the eye);
//   • a glassy sphere whose interior churns with the element itself — see
//     elementalOrbShader.js for the core / shell / inner-bloom trio;
//   • two counter-rotating orbit rings and a handful of orbiting motes, giving the
//     silhouette movement that survives being seen from across the cube;
//   • a small field of the element's own drifting matter (bubbles / embers / spores /
//     flakes) contained around the orb, matching what ElementalAtmosphere plays at
//     scene scale once the element is claimed — the pickup previews its own effect;
//   • the enamel crest (ElementalBadge), billboarded and floated on the near face of
//     the sphere so the icon always reads and always matches the HUD chip;
//   • a countdown ring in the crest's plane that mirrors the HUD's draining ring;
//   • a point light in the element's colour, so the orb actually lights the face
//     under it. Skipped on mobile, where four extra dynamic lights is a real cost.
//
// Everything animates from one useFrame writing to refs: no React renders per frame
// and no per-frame allocation. Up to four of these exist at once (one offering =
// one orb per element), so geometry is shared at module level and each orb owns only
// its three shader materials and one small particle buffer, both disposed on unmount.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { readLiveTile } from '../wormHelpers.js';
import { prefersReducedMotion, isMobile } from '../../utils/device.js';
import { FACE_NORMALS, SPECIAL_HOVER_HEIGHT, SPECIAL_FADE_TIME } from './constants.js';
import { getElementalDef } from './elementalDefs.js';
import { ElementalBadge, getSoftGlowTexture } from './elementalBadge.jsx';
import { makeElementalOrbMaterials } from './elementalOrbShader.js';

// Extra clearance over SPECIAL_HOVER_HEIGHT: the flat badge could sit low, a
// half-unit sphere cannot without sinking into the face.
const ELEM_HOVER_LIFT = 0.3;
const SPAWN_TIME = 0.55; // seconds for the orb to pop in
const SHOCK_TIME = 0.7; // seconds the spawn shockwave takes to run out
const FADE_FLOOR = 0.5; // an offering never dims past half — it should stay grabbable

// One set for every elemental orb ever spawned.
const _geos = {
  core: new THREE.SphereGeometry(0.3, 24, 18),
  inner: new THREE.SphereGeometry(0.395, 20, 14),
  shell: new THREE.SphereGeometry(0.42, 28, 20),
  // The orbit rings graze the shell rather than hooping wide of it: sized out at
  // the countdown's radius they read as a second, duplicate outline.
  ringA: new THREE.TorusGeometry(0.46, 0.011, 8, 64),
  ringB: new THREE.TorusGeometry(0.4, 0.008, 8, 56),
  // The countdown hugs the orb rather than hooping around it — a wide bright ring
  // read as the orb's outline and swallowed the silhouette.
  countdown: new THREE.TorusGeometry(0.63, 0.012, 8, 56),
  pool: new THREE.PlaneGeometry(2.0, 2.0),
  shock: new THREE.TorusGeometry(0.42, 0.022, 8, 48)
};

// Orbiting motes: radius, orbit tilt, phase and rate, fixed so every orb of a
// given element traces the same recognisable pattern.
const MOTES = [
  { r: 0.58, incl: 0.35, phase: 0.0, speed: 1.05 },
  { r: 0.52, incl: -0.9, phase: 2.1, speed: -0.85 },
  { r: 0.62, incl: 1.25, phase: 4.0, speed: 0.7 },
  { r: 0.47, incl: -0.25, phase: 5.4, speed: 1.35 },
  { r: 0.66, incl: 0.75, phase: 3.0, speed: -0.55 }
];

// Per-element drifting matter around the orb, mirroring ElementalAtmosphere's
// scene-scale field. `vy` is along the face normal (+ = away from the cube).
const PARTICLE_KINDS = {
  bubbles: { count: 26, vy: 0.42, sway: 0.1, size: 0.055, opacity: 0.75 },
  embers: { count: 30, vy: 0.55, sway: 0.09, size: 0.05, opacity: 0.95 },
  spores: { count: 24, vy: -0.16, sway: 0.14, size: 0.05, opacity: 0.7 },
  flakes: { count: 26, vy: -0.3, sway: 0.13, size: 0.055, opacity: 0.85 }
};
const FIELD_EXTENT = 0.9; // half-height of the box the matter wraps inside

// Frame-loop scratch — shared across orbs, never retained.
const _pos = new THREE.Vector3();
const _norm = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _billboard = new THREE.Quaternion();

const easeOutBack = (t) => {
  const c = 1.9;
  const p = t - 1;
  return 1 + (c + 1) * p * p * p + c * p * p;
};

export default function ElementalOrb({ special, size }) {
  const def = getElementalDef(special.type);

  const groupRef = useRef();
  const bodyRef = useRef();
  const spinRef = useRef();
  const ringARef = useRef();
  const ringBRef = useRef();
  const motesRef = useRef([]);
  const pointsRef = useRef();
  const billboardRef = useRef();
  const crestRef = useRef();
  const sparksRef = useRef();
  const raysRef = useRef();
  const countdownRef = useRef();
  const groundRef = useRef();
  const poolRef = useRef();
  const shockRef = useRef();
  const lightRef = useRef();

  const ageRef = useRef(0);
  const reducedRef = useRef(prefersReducedMotion());
  const lightsRef = useRef(!isMobile);

  const color = def?.color ?? '#ffffff';
  const accent = def?.accent ?? '#ffffff';

  // The orb body's three shader materials, owned by this orb (each drives its own
  // lifetime alpha) and disposed with it.
  const mats = useMemo(() => makeElementalOrbMaterials(special.type, color, accent), [special.type, color, accent]);
  useEffect(() => () => mats.dispose(), [mats]);

  const glowTex = useMemo(() => getSoftGlowTexture(), []);

  // The drifting matter field: a plain Float32Array animated straight in useFrame.
  const field = useMemo(() => {
    const cfg = PARTICLE_KINDS[def?.particle] ?? PARTICLE_KINDS.bubbles;
    const positions = new Float32Array(cfg.count * 3);
    const anchors = new Float32Array(cfg.count * 2); // stable [x, z] the sway hangs off
    const seeds = new Float32Array(cfg.count * 2); // [phase, speed jitter]
    for (let i = 0; i < cfg.count; i++) {
      // Ring the orb rather than filling a box: matter inside the sphere is hidden
      // by the shell anyway, and the silhouette reads better with a clear centre.
      const a = Math.random() * Math.PI * 2;
      const r = 0.55 + Math.random() * 0.55;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * FIELD_EXTENT;
      positions[i * 3 + 2] = Math.sin(a) * r;
      anchors[i * 2] = positions[i * 3];
      anchors[i * 2 + 1] = positions[i * 3 + 2];
      seeds[i * 2] = Math.random() * Math.PI * 2;
      seeds[i * 2 + 1] = 0.6 + Math.random() * 0.8;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { cfg, geometry, anchors, seeds };
  }, [def?.particle]);
  useEffect(() => () => field.geometry.dispose(), [field]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group || !def) return;
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    ageRef.current += dt;

    // Anchor to the live cubie mesh so the orb rides a mid-rotation slice exactly
    // like the worm's head does; fall back to grid math before the meshes exist.
    if (!readLiveTile(special, _pos, _norm)) {
      const wp = getStickerWorldPos(special.x, special.y, special.z, special.dirKey, size, 0);
      _pos.set(wp[0], wp[1], wp[2]);
      _norm.copy(FACE_NORMALS[special.dirKey] ?? FACE_NORMALS.PZ);
    }

    const bob = reducedRef.current ? 0 : Math.sin(t * 1.9) * 0.07;
    const hover = SPECIAL_HOVER_HEIGHT + ELEM_HOVER_LIFT;
    group.position.copy(_pos).addScaledVector(_norm, hover + bob);
    // Stand the orb up off its face — +Y local is the surface normal.
    _quat.setFromUnitVectors(_up, _norm);
    group.quaternion.copy(_quat);

    // Lifetime fade. No urgency blink: if you don't want this element you just take
    // another, so there is nothing to panic about — the ring carries the clock.
    const ttl = special.ttl ?? SPECIAL_FADE_TIME;
    const life = special.maxTtl || SPECIAL_FADE_TIME;
    const fade = ttl >= SPECIAL_FADE_TIME ? 1 : Math.max(0, ttl / SPECIAL_FADE_TIME);
    const alpha = Math.max(FADE_FLOOR, fade);

    // Spawn pop, with a slight overshoot so a new offering announces itself.
    const spawn = Math.min(1, ageRef.current / SPAWN_TIME);
    const pop = reducedRef.current ? spawn : easeOutBack(spawn);
    const breathe = reducedRef.current ? 1 : 1 + Math.sin(t * 2.6) * 0.035;

    if (bodyRef.current) bodyRef.current.scale.setScalar(1.15 * pop * breathe);
    if (spinRef.current && !reducedRef.current) {
      spinRef.current.rotation.y = t * 0.45;
      spinRef.current.rotation.x = Math.sin(t * 0.3) * 0.25;
    }
    if (ringARef.current && !reducedRef.current) {
      ringARef.current.rotation.z = t * 0.9;
      ringARef.current.rotation.y = 0.55 + Math.sin(t * 0.4) * 0.15;
    }
    if (ringBRef.current && !reducedRef.current) {
      ringBRef.current.rotation.z = -t * 0.6;
      ringBRef.current.rotation.x = 1.1 + Math.cos(t * 0.35) * 0.2;
    }

    // Orbiting motes.
    if (!reducedRef.current) {
      for (let i = 0; i < MOTES.length; i++) {
        const mesh = motesRef.current[i];
        if (!mesh) continue;
        const m = MOTES[i];
        const a = t * m.speed + m.phase;
        const cx = Math.cos(a) * m.r;
        const cz = Math.sin(a) * m.r;
        mesh.position.set(cx, cz * Math.sin(m.incl), cz * Math.cos(m.incl));
      }
    }

    // Drifting element matter. Vertical drift integrates and wraps; the lateral
    // sway is placed directly off a stable anchor so it can never walk out of the
    // envelope over a long session.
    const pts = pointsRef.current;
    if (pts && !reducedRef.current) {
      const cfg = field.cfg;
      const arr = pts.geometry.attributes.position.array;
      for (let i = 0; i < cfg.count; i++) {
        const yi = i * 3 + 1;
        arr[yi] += cfg.vy * field.seeds[i * 2 + 1] * dt;
        if (arr[yi] > FIELD_EXTENT) arr[yi] = -FIELD_EXTENT;
        else if (arr[yi] < -FIELD_EXTENT) arr[yi] = FIELD_EXTENT;
        const phase = field.seeds[i * 2];
        arr[i * 3] = field.anchors[i * 2] + Math.sin(t * 0.9 + phase) * cfg.sway;
        arr[i * 3 + 2] = field.anchors[i * 2 + 1] + Math.cos(t * 0.8 + phase) * cfg.sway;
      }
      pts.geometry.attributes.position.needsUpdate = true;
    }

    // Face the crest and its countdown ring at the camera. The parent already
    // carries the tile's orientation, so undo it before applying the camera's.
    if (billboardRef.current) {
      _billboard.copy(group.quaternion).invert().multiply(state.camera.quaternion);
      billboardRef.current.quaternion.copy(_billboard);
    }
    if (crestRef.current) crestRef.current.scale.setScalar(0.58 * pop);
    if (sparksRef.current && !reducedRef.current) sparksRef.current.rotation.z = t * 1.1;
    if (raysRef.current && !reducedRef.current) raysRef.current.rotation.z = -t * 0.22;

    // Ground pool: hold it on the tile while the orb bobs above it, and swell it
    // gently so the face looks lit rather than stickered.
    if (groundRef.current) {
      groundRef.current.position.y = -(hover + bob) + 0.03;
      groundRef.current.scale.setScalar(pop * (reducedRef.current ? 1 : 1 + Math.sin(t * 2.1) * 0.05));
    }

    if (lightRef.current) {
      // Lava gutters, ice is steady, water and nature breathe.
      const flicker = reducedRef.current ? 1 : special.type === 'lava' ? 0.75 + 0.25 * Math.sin(t * 9.0) : 0.85 + 0.15 * Math.sin(t * 2.2);
      lightRef.current.intensity = 1.35 * alpha * pop * flicker;
    }

    // One traverse drives every tagged transparent material's lifetime fade.
    group.traverse((o) => {
      if (o.material && o.material.transparent) o.material.opacity = (o.userData.baseOpacity ?? 1) * alpha;
    });
    // Shader materials read their own alpha uniform, not material.opacity.
    mats.uniforms.uTime.value = t;
    mats.uniforms.uAlpha.value = alpha * pop;

    // Countdown ring — tightens toward the crest as the offering runs out. Set
    // after the traverse, which would otherwise overwrite its opacity.
    if (countdownRef.current) {
      const remaining = Math.max(0, Math.min(1, ttl / life));
      countdownRef.current.scale.setScalar((0.82 + 0.18 * remaining) * pop);
      countdownRef.current.rotation.z = t * 0.5;
      countdownRef.current.material.opacity = 0.45 * alpha;
    }

    // One-shot spawn shockwave across the face, then it stays hidden.
    if (shockRef.current) {
      const s = ageRef.current / SHOCK_TIME;
      if (s >= 1) {
        shockRef.current.visible = false;
      } else {
        shockRef.current.visible = true;
        shockRef.current.scale.setScalar(0.4 + s * 2.6);
        shockRef.current.material.opacity = 0.8 * (1 - s) * (1 - s);
      }
    }
  });

  if (!def) return null;

  return (
    <group ref={groupRef}>
      {/* ── Orb body ───────────────────────────────────────────────────────── */}
      <group ref={bodyRef}>
        <group ref={spinRef}>
          <mesh geometry={_geos.core} material={mats.core} renderOrder={1} raycast={() => null} />
          <mesh geometry={_geos.inner} material={mats.inner} renderOrder={2} raycast={() => null} />
          <mesh geometry={_geos.shell} material={mats.shell} renderOrder={3} raycast={() => null} />
        </group>

        {/* Counter-rotating orbit rings — movement the silhouette keeps at distance. */}
        <mesh
          geometry={_geos.ringA}
          ref={(el) => {
            ringARef.current = el;
            if (el) el.userData.baseOpacity = 0.34;
          }}
        >
          <meshBasicMaterial
            color={accent}
            transparent
            opacity={0.34}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh
          geometry={_geos.ringB}
          ref={(el) => {
            ringBRef.current = el;
            if (el) el.userData.baseOpacity = 0.3;
          }}
        >
          <meshBasicMaterial color={color} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>

        {/* Sprites, not spheres: at this size a low-poly sphere reads as a visible
            hexagon, and a soft billboarded dot is both prettier and cheaper. */}
        {MOTES.map((m, i) => (
          <sprite
            key={i}
            scale={[0.14, 0.14, 0.14]}
            ref={(el) => {
              motesRef.current[i] = el;
              if (el) el.userData.baseOpacity = 0.85;
            }}
          >
            <spriteMaterial
              map={glowTex}
              color={accent}
              transparent
              opacity={0.85}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </sprite>
        ))}

        {/* The element's own matter drifting around the orb. */}
        {!reducedRef.current && (
          <points ref={pointsRef} geometry={field.geometry} frustumCulled={false} raycast={() => null} userData={{ baseOpacity: field.cfg.opacity }}>
            <pointsMaterial
              map={glowTex}
              color={accent}
              size={field.cfg.size}
              sizeAttenuation
              transparent
              opacity={field.cfg.opacity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </points>
        )}
      </group>

      {/* ── Crest, floated on the near face of the sphere ──────────────────── */}
      <group ref={billboardRef}>
        <group ref={crestRef} position={[0, 0, 0.5]}>
          <ElementalBadge type={special.type} color={color} sparksRef={sparksRef} raysRef={raysRef} />
        </group>
        <mesh ref={countdownRef} geometry={_geos.countdown} position={[0, 0, 0.5]}>
          <meshBasicMaterial color={color} transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>

      {/* ── Light pooled on the tile below ─────────────────────────────────── */}
      <group ref={groundRef} rotation={[-Math.PI / 2, 0, 0]}>
        {glowTex && (
          <mesh
            geometry={_geos.pool}
            raycast={() => null}
            ref={(el) => {
              poolRef.current = el;
              if (el) el.userData.baseOpacity = 0.42;
            }}
          >
            <meshBasicMaterial
              map={glowTex}
              color={color}
              transparent
              opacity={0.42}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        )}
        <mesh ref={shockRef} geometry={_geos.shock} raycast={() => null}>
          <meshBasicMaterial color={accent} transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>

      {lightsRef.current && <pointLight ref={lightRef} color={color} intensity={0} distance={3.0} decay={2} />}
    </group>
  );
}

// ─── Claim burst ─────────────────────────────────────────────────────────────
// Claiming an element is the biggest single beat in a worm run — it re-skins the
// whole cube and the camera pulls out to show it. The generic orb pop was far too
// small for that, so elements get their own: a shockwave ring, an expanding shell
// of element light, and a spray of the element's own colour.

const BURST_TIME = 0.85;
const BURST_SPARKS = 24;
const _burstGeos = {
  shell: new THREE.SphereGeometry(1, 20, 14),
  ring: new THREE.TorusGeometry(1, 0.035, 8, 56),
  flash: new THREE.PlaneGeometry(1.7, 1.7)
};
const _burstBillboard = new THREE.Quaternion();

export function ElementalClaimBurst({ position, type, onDone }) {
  const def = getElementalDef(type);
  const shellRef = useRef();
  const ringRef = useRef();
  const flashRef = useRef();
  const sparksRef = useRef();
  const groupRef = useRef();
  const tRef = useRef(0);
  const doneRef = useRef(false);
  const glowTex = useMemo(() => getSoftGlowTexture(), []);

  // Radial spray, biased along the element's own drift so water bursts upward in
  // bubbles and nature settles outward.
  const spray = useMemo(() => {
    const positions = new Float32Array(BURST_SPARKS * 3);
    const vel = new Float32Array(BURST_SPARKS * 3);
    for (let i = 0; i < BURST_SPARKS; i++) {
      const a = Math.random() * Math.PI * 2;
      const z = Math.random() * 2 - 1;
      const r = Math.sqrt(1 - z * z);
      const speed = 2.2 + Math.random() * 2.6;
      vel[i * 3] = Math.cos(a) * r * speed;
      vel[i * 3 + 1] = z * speed;
      vel[i * 3 + 2] = Math.sin(a) * r * speed;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { geometry, vel };
  }, []);
  useEffect(() => () => spray.geometry.dispose(), [spray]);

  useFrame((state, delta) => {
    tRef.current += delta;
    const t = Math.min(1, tRef.current / BURST_TIME);
    // Ease-out: everything leaves fast and coasts, which reads as an impact.
    const e = 1 - (1 - t) * (1 - t) * (1 - t);

    // Sizes are deliberately close to the orb's own: the claim happens on a tile,
    // and a shell that outgrows the cube stops reading as a burst and just washes
    // the screen in the element's colour.
    if (shellRef.current) {
      shellRef.current.scale.setScalar(0.25 + e * 1.05);
      shellRef.current.material.opacity = 0.34 * (1 - t) * (1 - t);
    }
    if (ringRef.current) {
      ringRef.current.scale.setScalar(0.25 + e * 1.7);
      ringRef.current.material.opacity = 0.9 * (1 - t) * (1 - t);
      if (groupRef.current) {
        _burstBillboard.copy(state.camera.quaternion);
        ringRef.current.quaternion.copy(_burstBillboard);
        if (flashRef.current) flashRef.current.quaternion.copy(_burstBillboard);
      }
    }
    if (flashRef.current) {
      // A hard bloom on the first fifth of the burst, gone before it can smear.
      const f = Math.min(1, tRef.current / (BURST_TIME * 0.22));
      flashRef.current.scale.setScalar(0.4 + f * 0.75);
      flashRef.current.material.opacity = 0.85 * (1 - f);
    }
    if (sparksRef.current) {
      const arr = sparksRef.current.geometry.attributes.position.array;
      for (let i = 0; i < BURST_SPARKS * 3; i++) arr[i] = spray.vel[i] * e * 0.3;
      sparksRef.current.geometry.attributes.position.needsUpdate = true;
      sparksRef.current.material.opacity = 0.95 * (1 - t);
    }

    if (t >= 1 && !doneRef.current) {
      doneRef.current = true;
      onDone?.();
    }
  });

  if (!def) return null;

  return (
    <group ref={groupRef} position={position}>
      <mesh ref={shellRef} geometry={_burstGeos.shell} renderOrder={20} raycast={() => null}>
        <meshBasicMaterial
          color={def.color}
          transparent
          opacity={0.45}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={ringRef} geometry={_burstGeos.ring} renderOrder={21} raycast={() => null}>
        <meshBasicMaterial
          color={def.accent}
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      {glowTex && (
        <mesh ref={flashRef} geometry={_burstGeos.flash} renderOrder={22} raycast={() => null}>
          <meshBasicMaterial
            map={glowTex}
            color={def.accent}
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
          />
        </mesh>
      )}
      <points ref={sparksRef} geometry={spray.geometry} frustumCulled={false} renderOrder={23} raycast={() => null}>
        <pointsMaterial
          map={glowTex}
          color={def.accent}
          size={0.13}
          sizeAttenuation
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </points>
    </group>
  );
}
