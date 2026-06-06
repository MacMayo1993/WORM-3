import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FACE_COLORS, ANTIPODAL_COLOR, FLIP_CAP, getHalfLifeMultiplier } from '../utils/constants.js';

// Shared geometries for wave effects - created once, reused
const sharedWaveRingGeometry = new THREE.RingGeometry(0.8, 1.0, 32);
const sharedInnerRingGeometry = new THREE.RingGeometry(0.3, 0.6, 32);
// Shared geometries for heat map
const sharedHeatOuterCircle = new THREE.CircleGeometry(0.55, 32);
const sharedHeatInnerCircle = new THREE.CircleGeometry(0.3, 32);

/**
 * FlipPropagationWave - Visual ring wave that propagates from flip origins.
 * Rings only — no worm. Calls onComplete when the ring animation finishes (~0.83s).
 */
const FlipPropagationWave = ({ origins, onComplete }) => {
  const [progress, setProgress] = useState(0);
  const ringsRef = useRef([]);

  useEffect(() => {
    setProgress(0);
  }, [origins]);

  useEffect(() => {
    return () => { ringsRef.current = []; };
  }, []);

  useFrame((_state, delta) => {
    if (progress >= 1) return;

    const newProgress = Math.min(1, progress + delta * 1.2);
    setProgress(newProgress);

    const easeOut = 1 - Math.pow(1 - newProgress, 3);

    ringsRef.current.forEach((ring) => {
      if (!ring) return;
      const scale = easeOut * 4 + 0.5;
      ring.scale.set(scale, scale, scale);
      if (ring.material) ring.material.opacity = (1 - easeOut) * 0.8;
    });

    if (newProgress >= 1) {
      onComplete?.();
    }
  });

  if (!origins || origins.length === 0) return null;

  return (
    <group>
      {origins.map((origin, idx) => (
        <group key={idx} position={origin.position}>
          <mesh
            ref={el => ringsRef.current[idx] = el}
            rotation={origin.rotation || [0, 0, 0]}
            geometry={sharedWaveRingGeometry}
          >
            <meshBasicMaterial
              color={origin.color}
              transparent
              opacity={0.8}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          <mesh rotation={origin.rotation || [0, 0, 0]} geometry={sharedInnerRingGeometry}>
            <meshBasicMaterial
              color={origin.color}
              transparent
              opacity={0.4 * (1 - progress)}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/**
 * ChaosHeatMap - Overlay showing cumulative flip intensity on each sticker.
 * Heartbeat pulse rate tied to half-life acceleration:
 *   0-49 flips = slow breath, 50+ = 2x, 75+ = 4x, etc.
 * At FLIP_CAP the tile is dead — flat gray, no pulse.
 */
export const ChaosHeatMap = ({ position, rotation, flips, maxFlips = 10 }) => {
  const glowRef = useRef();
  const pulseRef = useRef(0);
  const dead = flips >= FLIP_CAP;

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

    const intensity = Math.min(1, flips / maxFlips);
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

  const intensity = Math.min(1, flips / maxFlips);
  const heatColor = new THREE.Color();

  if (intensity < 0.33) {
    heatColor.setHSL(0.55 - intensity * 0.5, 1, 0.5);
  } else if (intensity < 0.66) {
    heatColor.setHSL(0.15, 1, 0.5);
  } else {
    heatColor.setHSL(0.05 - (intensity - 0.66) * 0.15, 1, 0.5 + intensity * 0.3);
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
