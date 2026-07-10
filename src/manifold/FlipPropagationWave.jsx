import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FACE_COLORS, ANTIPODAL_COLOR, FLIP_CAP, getHalfLifeMultiplier } from '../utils/constants.js';

// Shared geometries for wave effects - created once, reused
const sharedWaveRingGeometry = new THREE.RingGeometry(0.8, 1.0, 32);

// Three trailing rings per origin: lead ring + 2 followers at increasing delay.
const RING_DELAYS    = [0, 0.14, 0.28];   // seconds behind the lead
const RING_OPACITIES = [0.50, 0.32, 0.18]; // lead is darkest/most opaque
const RING_DURATION  = 0.85;               // seconds per ring
// Shared geometries for heat map
const sharedHeatOuterCircle = new THREE.CircleGeometry(0.55, 32);
const sharedHeatInnerCircle = new THREE.CircleGeometry(0.3, 32);

/**
 * FlipPropagationWave - Visual ring wave that propagates from flip origins.
 * Renders 3 staggered rings per origin (lead + 2 trailing followers).
 * Rings use NormalBlending for a darker, more grounded look.
 * Calls onComplete when all rings have finished.
 */
const FlipPropagationWave = ({ origins, onComplete }) => {
  const elapsedRef   = useRef(0);
  const doneRef      = useRef(false);
  // Flat array: origins.length × RING_DELAYS.length refs
  const ringsRef     = useRef([]);

  useEffect(() => {
    elapsedRef.current = 0;
    doneRef.current    = false;
    ringsRef.current   = [];
  }, [origins]);

  const totalDuration = RING_DURATION + RING_DELAYS[RING_DELAYS.length - 1];

  useFrame((_state, delta) => {
    if (doneRef.current) return;

    elapsedRef.current += delta;
    const elapsed = elapsedRef.current;

    for (let i = 0; i < ringsRef.current.length; i++) {
      const ring = ringsRef.current[i];
      if (!ring) continue;
      const delay   = RING_DELAYS[i % RING_DELAYS.length];
      const ringT   = elapsed - delay;
      if (ringT <= 0) {
        ring.scale.setScalar(0.01);
        if (ring.material) ring.material.opacity = 0;
        continue;
      }
      const rawT   = Math.min(1, ringT / RING_DURATION);
      const easeOut = 1 - Math.pow(1 - rawT, 3);
      ring.scale.setScalar(easeOut * 4 + 0.5);
      if (ring.material) {
        ring.material.opacity = (1 - easeOut) * RING_OPACITIES[i % RING_DELAYS.length];
      }
    }

    if (elapsed >= totalDuration) {
      doneRef.current = true;
      onComplete?.();
    }
  });

  if (!origins || origins.length === 0) return null;

  return (
    <group>
      {origins.map((origin, oIdx) =>
        RING_DELAYS.map((_, rIdx) => {
          const flatIdx = oIdx * RING_DELAYS.length + rIdx;
          return (
            <mesh
              key={`${oIdx}-${rIdx}`}
              ref={el => { ringsRef.current[flatIdx] = el; }}
              position={origin.position}
              rotation={origin.rotation || [0, 0, 0]}
              geometry={sharedWaveRingGeometry}
            >
              <meshBasicMaterial
                color={origin.color}
                transparent
                opacity={0}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          );
        })
      )}
    </group>
  );
};

/**
 * ChaosHeatMap - Overlay showing cumulative flip intensity on each sticker.
 * Heartbeat pulse rate tied to half-life acceleration:
 *   0-49 flips = slow breath, 50+ = 2x, 75+ = 4x, etc.
 * At FLIP_CAP the tile is dead — flat gray, no pulse.
 */
const computeHeatHSL = (intensity) => {
  if (intensity < 0.33) return [0.55 - intensity * 0.5, 1, 0.5];
  if (intensity < 0.66) return [0.15, 1, 0.5];
  return [0.05 - (intensity - 0.66) * 0.15, 1, 0.5 + intensity * 0.3];
};

export const ChaosHeatMap = ({ position, rotation, flips, maxFlips = 10 }) => {
  const glowRef = useRef();
  const pulseRef = useRef(0);
  const dead = flips >= FLIP_CAP;

  const intensity = Math.min(1, flips / maxFlips);
  const heatColor = useMemo(() => {
    if (dead || flips === 0) return null;
    const [h, s, l] = computeHeatHSL(intensity);
    return new THREE.Color().setHSL(h, s, l);
  }, [dead, flips, intensity]);

  useFrame((_state, delta) => {
    if (!glowRef.current) return;

    if (dead) {
      glowRef.current.material.opacity = 0.4;
      glowRef.current.scale.setScalar(1);
      return;
    }

    const halfLife = getHalfLifeMultiplier(flips);
    const baseRate = 1.5;
    const heartRate = baseRate * halfLife;
    pulseRef.current += delta * heartRate;

    const t = pulseRef.current % (Math.PI * 2);
    const bump1 = Math.exp(-Math.pow((t - 1.0) * 3, 2));
    const bump2 = Math.exp(-Math.pow((t - 1.8) * 4, 2)) * 0.6;
    const heartbeat = bump1 + bump2;

    glowRef.current.material.opacity = intensity * (0.3 + heartbeat * 0.5);

    const scale = 1 + heartbeat * 0.15 * intensity;
    glowRef.current.scale.set(scale, scale, 1);
  });

  if (flips === 0) return null;

  if (dead) {
    return (
      <group position={position} rotation={rotation}>
        <mesh ref={glowRef} position={[0, 0, 0.01]} geometry={sharedHeatOuterCircle}>
          <meshBasicMaterial
            color="#555555"
            transparent
            opacity={0.4}
            blending={THREE.NormalBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    );
  }

  return (
    <group position={position} rotation={rotation}>
      <mesh ref={glowRef} position={[0, 0, 0.01]} geometry={sharedHeatOuterCircle}>
        <meshBasicMaterial
          color={heatColor}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {intensity > 0.5 && (
        <mesh position={[0, 0, 0.015]} geometry={sharedHeatInnerCircle}>
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={intensity * 0.3}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
};

export default FlipPropagationWave;
