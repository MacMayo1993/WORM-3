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

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { getElementalDef } from './healerWorm/elementalDefs.js';
import { resolveElementalQuality } from './healerWorm/elementalQuality.js';
import { elementalEnvelope } from './healerWorm/elementalLifecycle.js';
import { isMobile, prefersReducedMotion } from '../utils/device.js';
import { wormBuffs } from './wormBuffs.js';
import { getElementalParticleMaterial } from './healerWorm/elementalParticleMaterial.js';
import ElementalCubeSkin from './ElementalCubeSkin.jsx';

// Per-behaviour motion. `vy` is the vertical drift (units/sec, sign = direction),
// `sway` the horizontal wobble amplitude, `blend` the material blending, and
// `size` the point size. Bubbles and embers glow additively; spores and flakes
// are lit motes that read against the bright cube, so they blend normally.
const PARTICLE_KINDS = {
  bubbles: { vy: 0.55, sway: 0.35, size: 0.09, blend: THREE.AdditiveBlending, opacity: 0.55 },
  embers: { vy: 0.85, sway: 0.28, size: 0.075, blend: THREE.AdditiveBlending, opacity: 0.9 },
  spores: { vy: -0.22, sway: 0.5, size: 0.07, blend: THREE.NormalBlending, opacity: 0.7 },
  flakes: { vy: -0.45, sway: 0.45, size: 0.08, blend: THREE.NormalBlending, opacity: 0.8 },
  // Ion motes drift UP and slowly, the way charge bleeds off a surface — fast
  // sparks would read as embers and put lightning in fire's register.
  ions: { vy: 0.32, sway: 0.22, size: 0.055, blend: THREE.AdditiveBlending, opacity: 0.75 }
};

// Drifting particle field. Positions live in a plain Float32Array animated straight
// in useFrame — zero React renders per frame and one allocation on mount.
//
// `count` comes from the quality budget rather than a fixed constant: the field is
// one draw call at any size, but its CPU cost is a loop over every particle every
// frame, which is exactly the kind of work a phone cannot spare.
function ElementalParticles({ element, kind, color, extent, count }) {
  const pointsRef = useRef();

  const elapsedRef = useRef(0);
  const cfg = PARTICLE_KINDS[kind] ?? PARTICLE_KINDS.bubbles;
  const material = useMemo(() => getElementalParticleMaterial(kind, color, cfg.size * 1.8), [kind, color, cfg.size]);
  useEffect(() => { material.uniforms.uOpacity.value = 0; }, [material]);

  // Seeds: each particle gets a random start position, a per-particle sway phase
  // and a slight speed jitter so the field never looks like a marching grid.
  const { geometry, seeds, origins } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const originArr = new Float32Array(count * 2); // stable [x, z] anchors
    const seedArr = new Float32Array(count * 2); // [phase, speedJitter]
    for (let i = 0; i < count; i++) {
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
    // Rebuild only when the element (hence extent/kind) or the budget changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element, extent, count]);

  useFrame((state, delta) => {
    const pts = pointsRef.current;
    if (!pts) return;
    if (useGameStore.getState().wormPaused) return;
    const dt = Math.min(delta, 0.05);
    const arr = pts.geometry.attributes.position.array;
    const t = elapsedRef.current;
    for (let i = 0; i < count; i++) {
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
    if (material) {
      // Same envelope the skin and the fill light run on, so the field can no
      // longer arrive before the element it belongs to or outlive it. It used to
      // read elementalT and divide by its own copy of the fade constant.
      elapsedRef.current += dt;
      const env = elementalEnvelope({ element, elapsed: elapsedRef.current, remaining: wormBuffs.elementalT });
      material.uniforms.uOpacity.value = cfg.opacity * env.intensity;
      material.uniforms.uTime.value = t;
      material.uniforms.uScale.value = state.size.height * state.gl.getPixelRatio() / (2 * Math.tan(state.camera.fov * Math.PI / 360));
    }
  });

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false} raycast={() => null}>
      <primitive object={material} attach="material" />
    </points>
  );
}

export default function ElementalAtmosphere({ size = 3 }) {
  const element = useGameStore((s) => s.wormElementalTheme);
  // A fused pair: both elements wash over the cube at once (elementalFusion.js).
  const partner = useGameStore((s) => s.wormElementalPartner);
  const lightRef = useRef();
  const elapsedRef = useRef(0);

  const def = element ? getElementalDef(element) : null;
  const partnerDef = def && partner ? getElementalDef(partner) : null;

  // Device budget: how many particles this machine can afford, and whether the
  // viewer has asked for no motion at all. Fixed per mount — none of its inputs
  // change mid-session.
  const quality = useMemo(
    () => resolveElementalQuality({ mobile: isMobile, reducedMotion: prefersReducedMotion(), cubeSize: size }),
    [size]
  );

  // Reset the fade ramp whenever the active element changes so a swap fades in
  // cleanly rather than snapping to full strength.
  const lastElementRef = useRef(null);
  if (lastElementRef.current !== element) {
    lastElementRef.current = element;
    elapsedRef.current = 0;
  }

  // Particle envelope large enough to surround the whole cube.
  const extent = size * 0.75 + 1.6;

  // A fusion lights the cube halfway between its two elements.
  const lightColor = useMemo(() => {
    if (!def) return new THREE.Color('#fff');
    const c = new THREE.Color(def.color);
    return partnerDef ? c.lerp(new THREE.Color(partnerDef.color), 0.5) : c;
  }, [def, partnerDef]);


  useFrame((_, delta) => {
    if (!def) {
      if (lightRef.current) lightRef.current.intensity = 0;
      return;
    }
    if (useGameStore.getState().wormPaused) return;
    elapsedRef.current += Math.min(delta, 0.1);
    // The shared envelope — the same one the cube skin scales itself by — so the
    // light can no longer be at full strength while the layer is still welling up,
    // or still lit after it has dissolved. wormBuffs mirrors the sim clock, so this
    // freezes on pause and during tunnel transit.
    const env = elementalEnvelope({ element, elapsed: elapsedRef.current, remaining: wormBuffs.elementalT });
    if (lightRef.current) lightRef.current.intensity = 0.55 * env.intensity;
  });

  return (
    <group>
      {/* The element laid on the cube itself — the main event. */}
      {def && <ElementalCubeSkin size={size} element={element} />}
      {/* The fused partner's skin over the same cube. Shells sit at their own depths
          (water 0.105, ice 0.075, charge 0.016), so two never share a surface. */}
      {partnerDef && <ElementalCubeSkin size={size} element={partner} />}

      {/* Element-coloured fill light — the worm and cube pick up the element's hue
          as they move through it. */}
      <hemisphereLight ref={lightRef} color={lightColor} groundColor={lightColor} intensity={0} />

      {/* Lightning's strikes are gameplay now (lightningStorm.js, LightningStrikes.jsx), drawn by
          the mode: a bolt here that hurt nothing would teach the player to ignore the real ones. */}

      {/* Drifting medium around the cube — bubbles/embers/spores/snow. Reduced
          motion and the floor budget both zero the count, which drops the field
          entirely rather than animating an empty buffer. */}
      {def && quality.particleCount > 0 && (
        <ElementalParticles
          element={element}
          kind={def.particle}
          color={element === 'fire' ? def.color : def.accent}
          extent={extent}
          count={quality.particleCount}
        />
      )}
      {/* The partner's medium at half density, so a fusion costs one and a half fields. */}
      {partnerDef && quality.particleCount > 1 && (
        <ElementalParticles
          key={`partner-${partner}`}
          element={partner}
          kind={partnerDef.particle}
          color={partner === 'fire' ? partnerDef.color : partnerDef.accent}
          extent={extent}
          count={Math.floor(quality.particleCount / 2)}
        />
      )}
    </group>
  );
}
