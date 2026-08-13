// src/worm/ElementalAtmosphere.jsx
//
// The visible payload of an elemental orb. When the worm claims one, the store's
// `wormElementalTheme` flips to that element and this overlay mounts, bathing the
// entire cube in the element: a translucent colour dome washes the whole scene,
// a coloured fill light shifts the cube's lighting toward the element, and a field
// of drifting particles (bubbles, embers, spores or flakes) fills the air around it.
//
// The wash is deliberately thin and the dome uses normal blending at low opacity,
// so every sticker's own tile style keeps rendering and stays readable underneath —
// the cube reads as "water" or "lava" as a whole while each face is still itself.
//
// The effect temporarily owns scene.fog, but restores the previous fog on cleanup.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { getElementalDef } from './healerWorm/elementalDefs.js';
import { prefersReducedMotion } from '../utils/device.js';
import { wormBuffs } from './wormBuffs.js';

const PARTICLE_COUNT = 130;
const FADE_IN = 0.55; // seconds to ramp the wash up on claim
const FADE_OUT = 1.25; // soften the end instead of popping the atmosphere away

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
  const scene = useThree((s) => s.scene);
  const lightRef = useRef();
  const ownedFogRef = useRef(null);
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

  // Envelope large enough to surround the whole cube.
  const extent = size * 0.75 + 1.6;
  // How far the wash reaches. Near tiles stay clear (readable); everything past
  // FOG_FAR recedes fully into the element colour, so the whole world reads as it.
  const FOG_NEAR = size * 0.6 + 1.0;
  const FOG_FAR = size * 2.4 + 9.0;

  // The wash colour is a saturated blend of the element's vivid colour with its
  // deep fog tone — bright enough to read unmistakably as "water"/"lava" rather
  // than merely darkening the cube, deep enough not to blow out the tiles.
  const fogColor = useMemo(() => {
    if (!def) return new THREE.Color('#000');
    return new THREE.Color(def.color).lerp(new THREE.Color(def.fogColor), 0.45);
  }, [def]);
  const lightColor = useMemo(() => (def ? new THREE.Color(def.color) : new THREE.Color('#fff')), [def]);

  // Own scene.fog for the element's lifetime, restoring whatever was there before.
  // This is the reliable full-world wash: it tints the cube, the worm and the
  // backdrop by distance, regardless of where the chase camera sits.
  useEffect(() => {
    if (!def) return undefined;
    const prevFog = scene.fog;
    const fog = new THREE.Fog(fogColor.clone(), FOG_NEAR, 400);
    ownedFogRef.current = fog;
    scene.fog = fog;
    return () => {
      // Do not clobber fog installed by another scene effect after this one mounted.
      if (scene.fog === fog) scene.fog = prevFog;
      if (ownedFogRef.current === fog) ownedFogRef.current = null;
    };
    // Re-own on element change so the new colour takes over cleanly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def, scene]);

  useFrame((_, delta) => {
    if (!def) return;
    fadeRef.current = Math.min(1, fadeRef.current + delta / FADE_IN);
    const remainingFade = Math.min(1, wormBuffs.elementalT / FADE_OUT);
    const f = Math.min(fadeRef.current, remainingFade);
    // Pull the fog's far plane in as the wash ramps up: far away → barely any tint,
    // at FOG_FAR → the world is fully bathed. A smooth, reversible intensity knob.
    if (ownedFogRef.current) {
      ownedFogRef.current.far = THREE.MathUtils.lerp(400, FOG_FAR, f);
    }
    if (lightRef.current) lightRef.current.intensity = 0.75 * f;
  });

  if (!def) return null;

  return (
    <group>
      {/* Element-coloured fill light — shifts the cube's lighting toward the element
          so the whole solid reads as bathed in it, not just fogged around. */}
      <hemisphereLight ref={lightRef} color={lightColor} groundColor={fogColor} intensity={0} />

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
