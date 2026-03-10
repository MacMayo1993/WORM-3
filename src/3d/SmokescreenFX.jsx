// src/3d/SmokescreenFX.jsx
//
// Smoke & Mirrors Shuffle Effect
//
// When the player triggers a shuffle the cube gets "obscured" by a burst of
// volumetric smoke particles that expand from the cube's center, hide the
// scrambling, then fade away to reveal the newly scrambled state.
//
// This is the literal "smoke and mirrors" trick — the shuffle happens underneath
// the smoke so the player never sees the individual moves.
//
// Phase lifecycle (driven by store state `smokePhase`):
//   'off'       → invisible, particles idle at origin
//   'building'  → particles explode outward (0 → 1, ~0.4 s)
//   'peak'      → particles hold at max spread (optional brief hold)
//   'clearing'  → particles fade and drift outward (1 → 0, ~0.6 s)

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';

const PARTICLE_COUNT = 320;
const MAX_SPREAD = 4.5;   // Maximum radius of smoke cloud
const BUILD_DURATION = 0.38;
const CLEAR_DURATION = 0.7;

// Smoke colour palette — bluish-grey with slight purple tint to feel magical
const SMOKE_COLORS = [
  new THREE.Color(0x8b5cf6), // violet
  new THREE.Color(0x6366f1), // indigo
  new THREE.Color(0xa78bfa), // light violet
  new THREE.Color(0xc4b5fd), // pale violet
  new THREE.Color(0x94a3b8), // slate
];

export default function SmokescreenFX() {
  const smokePhase = useGameStore(s => s.smokePhase);
  const setSmokePhase = useGameStore(s => s.setSmokePhase);

  const pointsRef = useRef(null);
  const matRef = useRef(null);
  const phaseTimeRef = useRef(0);
  const prevPhaseRef = useRef('off');

  // Build particle geometry once
  const { geometry, velocities } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const vels = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Start all particles at cube center
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      // Random outward velocity on a sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 0.6 + Math.random() * 0.8;
      vels.push([
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.sin(phi) * Math.sin(theta) * speed,
        Math.cos(phi) * speed,
      ]);

      // Random smoke color from palette
      const col = SMOKE_COLORS[Math.floor(Math.random() * SMOKE_COLORS.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      // Random particle size
      sizes[i] = 0.08 + Math.random() * 0.22;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    return { geometry: geo, velocities: vels };
  }, []);

  // Reset phase timer whenever phase changes
  useEffect(() => {
    if (smokePhase !== prevPhaseRef.current) {
      phaseTimeRef.current = 0;
      prevPhaseRef.current = smokePhase;
    }
  }, [smokePhase]);

  useFrame((_state, delta) => {
    if (smokePhase === 'off') {
      if (matRef.current) matRef.current.opacity = 0;
      return;
    }

    phaseTimeRef.current += delta;
    const t = phaseTimeRef.current;

    const posAttr = geometry.attributes.position;
    const sizeAttr = geometry.attributes.size;

    if (smokePhase === 'building') {
      // Particles fly outward from center, opacity builds up
      const progress = Math.min(t / BUILD_DURATION, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const [vx, vy, vz] = velocities[i];
        posAttr.setXYZ(
          i,
          vx * MAX_SPREAD * eased,
          vy * MAX_SPREAD * eased,
          vz * MAX_SPREAD * eased
        );
        // Size grows as particles expand
        sizeAttr.setX(i, (0.08 + (i / PARTICLE_COUNT) * 0.22) * (0.5 + eased));
      }
      posAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;

      if (matRef.current) {
        matRef.current.opacity = Math.min(progress * 2.0, 0.85);
      }

      // Auto-advance to peak once building completes
      if (progress >= 1) setSmokePhase('peak');

    } else if (smokePhase === 'peak') {
      // Brief hold — just render at full opacity for a moment
      if (matRef.current) matRef.current.opacity = 0.85;
      // Auto-advance to clearing after 0.1 s
      if (t > 0.1) setSmokePhase('clearing');

    } else if (smokePhase === 'clearing') {
      // Particles continue drifting outward and fade away
      const progress = Math.min(t / CLEAR_DURATION, 1);
      const eased = Math.pow(progress, 2); // ease-in

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const [vx, vy, vz] = velocities[i];
        const spread = MAX_SPREAD + eased * MAX_SPREAD * 0.6;
        posAttr.setXYZ(i, vx * spread, vy * spread, vz * spread);
      }
      posAttr.needsUpdate = true;

      if (matRef.current) {
        matRef.current.opacity = 0.85 * (1 - eased);
      }

      // Transition back to 'off' once clear
      if (progress >= 1) setSmokePhase('off');
    }
  });

  if (smokePhase === 'off') return null;

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        ref={matRef}
        size={0.18}
        vertexColors
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}
