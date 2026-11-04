import { createOrbReveal, orbRevealProgress } from '../orbReveal.js';
import { WormPointLight } from '../WormLighting.jsx';
import { useGameStore } from '../../hooks/useGameStore.js';
import NatureClaimLeaves from './NatureClaimLeaves.jsx';
// src/worm/healerWorm/ElementalOrb.jsx
//
// The elemental offering as it sits on the board: a small relic of the element
// hovering over a sigil on its tile. Telling the elements apart at a glance is the
// whole job (Water, Ice and Air share a pale-blue palette), so identity is carried
// by shape first and colour last:
//
//   • the relic (elementalOrbShapes.js), a 3D piece whose silhouette is the HUD
//     icon: a droplet, a crown of flame, a floating island, a crystal cluster, the
//     bolt, a tornado. It is lit like a glazed toy and inked round its outline
//     (elementalOrbShader.js), turns on its upright axis so it reads as solid, and
//     is billboarded upright so a flame always points up the screen. A per-element
//     tilt leans it toward the lens so the island's grass and trees show;
//   • the sigil on the tile under it (elementalOrbMaterials.js): a pool of the
//     element's light, the glyph at its heart, a dashed rune ring and a draining
//     countdown arc mirroring the HUD's ring. It ties the relic to its tile and
//     carries the name tag the old floating medal did, without a second object;
//   • a one-shot shockwave across the tile on spawn, which is what makes a new
//     offering catch the eye;
//   • a few motes and a small field of the element's own drifting matter
//     (bubbles / embers / spores / flakes / ions / wind), matching what
//     ElementalAtmosphere plays at scene scale once the element is claimed;
//   • a point light in the element's colour, so the relic lights the face under
//     it. Skipped on mobile, where several extra dynamic lights is a real cost.
//
// Everything animates from one useFrame writing to refs: no React renders per frame
// and no per-frame allocation. Several of these exist at once (one per element on
// offer), so geometry AND the shader materials are shared at module level; the orb
// owns only one small particle buffer, disposed on unmount.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getWormStickerWorldPos as getStickerWorldPos } from '../wormExpansion.js';
import { readLiveTile } from '../wormHelpers.js';
import { prefersReducedMotion, isMobile } from '../../utils/device.js';
import { FACE_NORMALS, SPECIAL_FADE_TIME } from './constants.js';
import { getSpecialDef } from './specialDefs.js';
import { getSoftGlowTexture, getOrbTrimMaterials, PARTICLE_KINDS } from './elementalOrbMaterials.js';
import { getElementalOrbMaterials } from './elementalOrbShader.js';
import { getElementalOrbShape } from './elementalOrbShapes.js';

// One knob for how big the relic reads. The relic, its motes, its drifting matter,
// its hover height and the reach of its light are authored at ORB_SCALE 1 and
// multiplied through here. At 1.08 a relic stands about one tile across, so it
// reads as the pickup ON that tile; the old 1.5 spread each one over its
// neighbours and floated it a full tile off the face.
const ORB_SCALE = 1.08;
// Height of the relic's centre over the tile (before ORB_SCALE): its foot clears
// the sigil by about a tenth of a tile.
const RELIC_HOVER = 0.66;
const SIGIL_SIZE = 0.94; // the sigil stays inside its own tile at every scale
const SHOCK_TIME = 0.7; // seconds the spawn shockwave takes to run out
const FADE_FLOOR = 0.5; // an offering never dims past half: it should stay grabbable

// Spin about the upright axis, an optional tumble for the shapes that have no
// natural up, and a lean toward the lens. The bolt is flat, so it swings to and fro
// (`swing`, radians either side) instead of turning edge-on and vanishing.
const SPIN = {
  water: { rate: 0.5, wobble: 0, tilt: 0.1 },
  fire: { rate: 0.7, wobble: 0, tilt: 0.05 },
  grass: { rate: 0.45, wobble: 0.06, tilt: 0.42 },
  ice: { rate: 0.6, wobble: 0.05, tilt: 0.22 },
  lightning: { rate: 1.3, wobble: 0.08, tilt: 0.08, swing: 0.55 },
  air: { rate: 2.2, wobble: 0, tilt: 0.18 }
};
const DEFAULT_SPIN = { rate: 0.45, wobble: 0.2, tilt: 0 };

// One set for every elemental orb ever spawned.
const _geos = {
  sigil: new THREE.PlaneGeometry(SIGIL_SIZE, SIGIL_SIZE),
  shock: new THREE.TorusGeometry(0.42, 0.022, 8, 48)
};

// Motes: radius, orbit tilt, phase and rate, fixed so every orb of a given element
// traces the same recognisable pattern. Just outside the relic's 0.7 bound.
const MOTES = [
  { r: 0.74, incl: 0.35, phase: 0.0, speed: 1.05 },
  { r: 0.7, incl: -0.9, phase: 2.1, speed: -0.85 },
  { r: 0.8, incl: 1.25, phase: 4.0, speed: 0.7 },
  { r: 0.72, incl: -0.25, phase: 5.4, speed: 1.35 }
];

const FIELD_EXTENT = 0.9; // half-height of the box the matter wraps inside

// Frame-loop scratch, shared across orbs, never retained.
const _pos = new THREE.Vector3();
const _norm = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _billboard = new THREE.Quaternion();

export default function ElementalOrb({ special, size }) {
  const def = getSpecialDef(special.type);

  const groupRef = useRef();
  const arrival = useRef({ effect: null, done: false });
  useEffect(() => () => arrival.current.effect?.dispose(), []);
  const bodyRef = useRef();
  const spinRef = useRef();
  const motesRef = useRef([]);
  const pointsRef = useRef();
  const billboardRef = useRef();
  const groundRef = useRef();
  const shockRef = useRef();
  const lightRef = useRef();

  const ageRef = useRef(0);
  const reducedRef = useRef(prefersReducedMotion());
  const lightsRef = useRef(!isMobile);

  const color = def?.color ?? '#ffffff';
  const accent = def?.accent ?? '#ffffff';

  // Shared per element and never disposed: disposing them on unmount destroyed
  // the compiled programs, so every offering relinked the relic shaders and stalled
  // the frame. See the note at the top of elementalOrbShader.js.
  const ink = def?.fogColor ?? '#0b0f1a';
  const mats = useMemo(() => getElementalOrbMaterials(special.type, color, accent, ink), [special.type, color, accent, ink]);
  const shape = useMemo(() => getElementalOrbShape(special.type), [special.type]);
  const spin = SPIN[special.type] ?? DEFAULT_SPIN;

  const trim = useMemo(
    () => getOrbTrimMaterials(special.type, color, accent, PARTICLE_KINDS[def?.particle]?.size ?? 0.055),
    [special.type, color, accent, def?.particle]
  );

  // The drifting matter field: a plain Float32Array animated straight in useFrame.
  const field = useMemo(() => {
    const cfg = PARTICLE_KINDS[def?.particle] ?? PARTICLE_KINDS.bubbles;
    const positions = new Float32Array(cfg.count * 3);
    const anchors = new Float32Array(cfg.count * 2); // stable [x, z] the sway hangs off
    const seeds = new Float32Array(cfg.count * 2); // [phase, speed jitter]
    for (let i = 0; i < cfg.count; i++) {
      // Ring the relic rather than filling a box: matter inside it is hidden
      // anyway, and the silhouette reads better with a clear centre.
      const a = Math.random() * Math.PI * 2;
      const r = 0.6 + Math.random() * 0.5;
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
    const reduced = reducedRef.current;
    ageRef.current += dt;

    // Anchor to the live cubie mesh so the orb rides a mid-rotation slice exactly
    // like the worm's head does; fall back to grid math before the meshes exist.
    if (!readLiveTile(special, _pos, _norm)) {
      const wp = getStickerWorldPos(special.x, special.y, special.z, special.dirKey, size, 0);
      _pos.set(wp[0], wp[1], wp[2]);
      _norm.copy(FACE_NORMALS[special.dirKey] ?? FACE_NORMALS.PZ);
    }
    // The group sits on the tile; only the relic hovers and bobs above it.
    group.position.copy(_pos);
    // Stand the orb up off its face: +Y local is the surface normal.
    _quat.setFromUnitVectors(_up, _norm);
    group.quaternion.copy(_quat);

    // Lifetime fade. No urgency blink: if you don't want this element you just take
    // another, so there is nothing to panic about. The sigil's arc carries the clock.
    const ttl = special.ttl ?? SPECIAL_FADE_TIME;
    const life = special.maxTtl || SPECIAL_FADE_TIME;
    const fade = ttl >= SPECIAL_FADE_TIME ? 1 : Math.max(0, ttl / SPECIAL_FADE_TIME);
    const alpha = Math.max(FADE_FLOOR, fade);

    const bob = reduced ? 0 : Math.sin(t * 1.9) * 0.05;
    const breathe = reduced ? 1 : 1 + Math.sin(t * 2.6) * 0.03;
    if (billboardRef.current) billboardRef.current.position.y = (RELIC_HOVER + bob) * ORB_SCALE;
    if (bodyRef.current) {
      bodyRef.current.scale.setScalar(ORB_SCALE * breathe);
      bodyRef.current.rotation.x = spin.tilt;
    }
    if (spinRef.current && !reduced) {
      spinRef.current.rotation.y = spin.swing ? Math.sin(t * spin.rate) * spin.swing : t * spin.rate;
      spinRef.current.rotation.x = Math.sin(t * 0.7) * spin.wobble;
      spinRef.current.rotation.z = Math.cos(t * 0.55) * spin.wobble * 0.6;
    }

    // Motes.
    if (!reduced) {
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
    if (pts && !reduced) {
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

    // Stand the relic upright on screen. The parent already carries the tile's
    // orientation, so undo it before applying the camera's.
    if (billboardRef.current) {
      _billboard.copy(group.quaternion).invert().multiply(state.camera.quaternion);
      billboardRef.current.quaternion.copy(_billboard);
    }

    if (lightRef.current) {
      // Fire gutters, lightning crackles, ice is steady, water and earth breathe.
      const flicker = reduced
        ? 1
        : special.type === 'fire'
          ? 0.75 + 0.25 * Math.sin(t * 9.0)
          : special.type === 'lightning'
            ? 0.8 + 0.2 * Math.sin(t * 23.0) * Math.sin(t * 3.1)
            : 0.85 + 0.15 * Math.sin(t * 2.2);
      lightRef.current.intensity = 1.35 * alpha * flicker;
    }

    // One traverse drives every tagged transparent material's lifetime fade.
    group.traverse((o) => {
      if (o.material && o.material.transparent && o.userData.baseOpacity !== undefined) o.material.opacity = o.userData.baseOpacity * alpha;
    });
    // Shader materials read their own alpha uniform, not material.opacity.
    mats.uniforms.uTime.value = t;
    mats.uniforms.uAlpha.value = alpha;
    // The sigil: countdown arc draining clockwise as the offering runs out, and the
    // rune ring turning (held still under reduced motion).
    const sigil = trim.sigil.uniforms;
    sigil.uRemaining.value = Math.max(0, Math.min(1, ttl / life));
    sigil.uAlpha.value = alpha;
    sigil.uTime.value = reduced ? 0 : t;

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
    group.visible = true;
    const reveal = arrival.current;
    if (!reveal.done) {
      reveal.effect ??= createOrbReveal(group, { radius: 1.6, reducedMotion: reduced });
      reveal.done = !reveal.effect.update(orbRevealProgress(ageRef.current));
    }
  });

  if (!def) return null;

  return (
    <group ref={groupRef} visible={false}>
      {/* ── The relic, upright on screen, hovering over its tile ─────────────── */}
      <group ref={billboardRef}>
        <group ref={bodyRef}>
          <group ref={spinRef}>
            <mesh geometry={shape} material={mats.hull} renderOrder={0} raycast={() => null} />
            <mesh geometry={shape} material={mats.body} renderOrder={1} raycast={() => null} />
          </group>

          {/* Sprites, not spheres: at this size a low-poly sphere reads as a visible
              hexagon, and a soft billboarded dot is both prettier and cheaper. */}
          {MOTES.map((m, i) => (
            <sprite
              key={i}
              material={trim.mote}
              scale={[0.1, 0.1, 0.1]}
              ref={(el) => {
                motesRef.current[i] = el;
                if (el) el.userData.baseOpacity = 0.85;
              }}
            />
          ))}
        </group>
      </group>

      {/* ── The element's own matter drifting round the relic, in the tile's
          frame so bubbles rise and flakes settle relative to the cube ──────── */}
      {!reducedRef.current && (
        <group position={[0, RELIC_HOVER * ORB_SCALE, 0]} scale={1.1 * ORB_SCALE}>
          <points
            ref={pointsRef}
            geometry={field.geometry}
            material={trim.points}
            frustumCulled={false}
            raycast={() => null}
            userData={{ baseOpacity: field.cfg.opacity }}
          />
        </group>
      )}

      {/* ── The sigil on the tile, and the spawn shockwave across it ─────────── */}
      <group ref={groundRef} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh geometry={_geos.sigil} material={trim.sigil} renderOrder={-1} raycast={() => null} />
        <mesh ref={shockRef} geometry={_geos.shock} material={trim.shock} raycast={() => null} userData={{ baseOpacity: 0.8 }} />
      </group>

      {lightsRef.current && (
        <WormPointLight ref={lightRef} color={color} intensity={0} distance={3.0 * ORB_SCALE} decay={2} position={[0, RELIC_HOVER * ORB_SCALE, 0]} />
      )}
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
  const def = getSpecialDef(type);
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
    if (useGameStore.getState().wormPaused) return;
    tRef.current += delta;
    const t = Math.min(1, tRef.current / (type === 'grass' ? 1.1 : BURST_TIME));
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
      {type === 'grass' ? <NatureClaimLeaves progressRef={tRef} /> : <points ref={sparksRef} geometry={spray.geometry} frustumCulled={false} renderOrder={23} raycast={() => null}>
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
      </points>}
    </group>
  );
}
