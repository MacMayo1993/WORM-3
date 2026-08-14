// src/worm/ElementalAtmosphere.jsx
//
// The ambiance around an active elemental orb. The element itself is laid ON the
// cube by ElementalCubeSkin (a water/fire/grass/ice layer over every
// face); this component adds the space around it so the worm reads as moving
// *through* the element:
//   • a field of drifting particles enveloping the cube — bubbles rising through
//     water, embers off the fire, spores through grass, snow through ice, and
//   • a soft element-coloured fill light so the worm and cube pick up the element's
//     hue as they move through it.
//
// It deliberately does NOT touch scene.fog or the canvas background — an earlier
// version tinted the whole backdrop, which read as "the background changed" rather
// than "the cube is in the element". The visible element now lives on the cube.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { getElementalDef } from './healerWorm/elementalDefs.js';
import { prefersReducedMotion } from '../utils/device.js';
import { wormBuffs } from './wormBuffs.js';
import ElementalCubeSkin from './ElementalCubeSkin.jsx';

const PARTICLE_COUNT = 130;
const FADE_IN = 0.55; // seconds to ramp the fill light up on claim
const FADE_OUT = 1.25; // soften the end instead of popping the light/particles away

// Per-behaviour motion. `vy` is the vertical drift (units/sec, sign = direction),
// `sway` the horizontal wobble amplitude, `blend` the material blending, and
// `size` the point size. Bubbles and embers glow additively; spores and flakes
// are lit motes that read against the bright cube, so they blend normally.
const PARTICLE_KINDS = {
  bubbles: { vy: 0.55, sway: 0.35, size: 0.09, blend: THREE.AdditiveBlending, opacity: 0.55 },
  embers: { vy: 0.85, sway: 0.28, size: 0.075, blend: THREE.AdditiveBlending, opacity: 0.9 },
  spores: { vy: -0.22, sway: 0.5, size: 0.07, blend: THREE.NormalBlending, opacity: 0.7 },
  flakes: { vy: -0.45, sway: 0.45, size: 0.08, blend: THREE.NormalBlending, opacity: 0.8 }
};

// Drifting particle field. Positions live in a plain Float32Array animated straight
// in useFrame — zero React renders per frame and one allocation on mount.
function ElementalParticles({ element, kind, color, extent }) {
  const pointsRef = useRef();
  const materialRef = useRef();
  const cfg = PARTICLE_KINDS[kind] ?? PARTICLE_KINDS.bubbles;

  // Seeds: each particle gets a random start position, a per-particle sway phase
  // and a slight speed jitter so the field never looks like a marching grid.
  const { geometry, seeds, origins } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const originArr = new Float32Array(PARTICLE_COUNT * 2); // stable [x, z] anchors
    const seedArr = new Float32Array(PARTICLE_COUNT * 2); // [phase, speedJitter]
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * extent;
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * extent;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * extent;
      originArr[i * 2] = positions[i * 3];
      originArr[i * 2 + 1] = positions[i * 3 + 2];
      seedArr[i * 2] = Math.random() * Math.PI * 2;
      seedArr[i * 2 + 1] = 0.6 + Math.random() * 0.8;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return { geometry: geo, seeds: seedArr, origins: originArr };
    // Rebuild only when the element (hence extent/kind) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element, extent]);

  useFrame((state, delta) => {
    const pts = pointsRef.current;
    if (!pts) return;
    const dt = Math.min(delta, 0.05);
    const arr = pts.geometry.attributes.position.array;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const yi = i * 3 + 1;
      arr[yi] += cfg.vy * seeds[i * 2 + 1] * dt;
      // Wrap around the box so the field never empties out.
      if (arr[yi] > extent) arr[yi] = -extent;
      else if (arr[yi] < -extent) arr[yi] = extent;
      // Gentle lateral sway, phase-offset per particle.
      const phase = seeds[i * 2];
      // Derive sway from stable anchors. Integrating it every frame lets particles
      // drift outside their envelope over long sessions and makes motion frame-rate
      // dependent; direct placement stays bounded and does less arithmetic.
      arr[i * 3] = origins[i * 2] + Math.sin(t * 0.8 + phase) * cfg.sway;
      arr[i * 3 + 2] = origins[i * 2 + 1] + Math.cos(t * 0.7 + phase) * cfg.sway;
    }
    pts.geometry.attributes.position.needsUpdate = true;
    if (materialRef.current) {
      const remainingFade = Math.min(1, wormBuffs.elementalT / FADE_OUT);
      materialRef.current.opacity = cfg.opacity * remainingFade;
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false} raycast={() => null}>
      <pointsMaterial
        ref={materialRef}
        color={color}
        size={cfg.size}
        sizeAttenuation
        transparent
        opacity={cfg.opacity}
        blending={cfg.blend}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

export default function ElementalAtmosphere({ size = 3 }) {
  const element = useGameStore((s) => s.wormElementalTheme);
  const lightRef = useRef();
  const fadeRef = useRef(0);
  const reducedRef = useRef(prefersReducedMotion());

  const def = element ? getElementalDef(element) : null;

  // Reset the fade ramp whenever the active element changes so a swap fades in
  // cleanly rather than snapping to full strength.
  const lastElementRef = useRef(null);
  if (lastElementRef.current !== element) {
    lastElementRef.current = element;
    fadeRef.current = 0;
  }

  // Particle envelope large enough to surround the whole cube.
  const extent = size * 0.75 + 1.6;

  const lightColor = useMemo(() => (def ? new THREE.Color(def.color) : new THREE.Color('#fff')), [def]);

  useFrame((_, delta) => {
    if (!def) return;
    fadeRef.current = Math.min(1, fadeRef.current + delta / FADE_IN);
    // Ramp the fill light down over the buff's final second so it eases out rather
    // than snapping off. wormBuffs mirrors the sim clock (freezes on pause/tunnel).
    const remainingFade = Math.min(1, wormBuffs.elementalT / FADE_OUT);
    const f = Math.min(fadeRef.current, remainingFade);
    if (lightRef.current) lightRef.current.intensity = 0.55 * f;
  });

  if (!def) return null;

  return (
    <group>
      {/* The element laid on the cube itself — the main event. */}
      <ElementalCubeSkin size={size} />

      {/* Element-coloured fill light — the worm and cube pick up the element's hue
          as they move through it. */}
      <hemisphereLight ref={lightRef} color={lightColor} groundColor={lightColor} intensity={0} />

      {/* Drifting medium around the cube — bubbles/embers/spores/snow. */}
      {!reducedRef.current && (
        <ElementalParticles
          element={element}
          kind={def.particle}
          color={def.accent}
          extent={extent}
        />
      )}
    </group>
  );
}
