import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FACE_COLORS, ANTIPODAL_COLOR, FLIP_CAP, getHalfLifeMultiplier } from '../utils/constants.js';
import WormParticle from './WormParticle.jsx';
import FlipParticles from '../3d/FlipParticles.jsx';

// Shared geometries for wave effects - created once, reused
const sharedWaveRingGeometry = new THREE.RingGeometry(0.8, 1.0, 32);
const sharedInnerRingGeometry = new THREE.RingGeometry(0.3, 0.6, 32);
// Shared geometries for heat map
const sharedHeatOuterCircle = new THREE.CircleGeometry(0.55, 32);
const sharedHeatInnerCircle = new THREE.CircleGeometry(0.3, 32);
// Tile flash disc — full face size
const sharedFlashDisc = new THREE.CircleGeometry(0.52, 32);

/**
 * Auto-triggers a FlipParticles burst on mount — like the disparity mode tile effect.
 * Scale=2 so shards are visible at the menu cube's distance.
 */
const AutoFlipParticles = ({ color }) => {
  const ref = useRef();
  useEffect(() => {
    const id = requestAnimationFrame(() => { ref.current?.trigger(color); });
    return () => cancelAnimationFrame(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <group scale={[2, 2, 2]}><FlipParticles ref={ref} /></group>;
};

/**
 * Bright disc that flashes on the tile face and expands/fades in ~0.45s.
 * Gives the "wormhole gate opening" look on the sticker.
 */
const TileFlash = ({ startTime, color }) => {
  const discRef = useRef();
  const flashDur = 0.45;

  useFrame((state) => {
    if (!discRef.current) return;
    const t = Math.min(state.clock.getElapsedTime() - startTime, flashDur);
    const p = t / flashDur;
    const s = 0.3 + p * 1.4;
    discRef.current.scale.set(s, s, 1);
    discRef.current.material.opacity = (1 - p) * 1.1;
  });

  return (
    <mesh ref={discRef} scale={[0.3, 0.3, 1]} geometry={sharedFlashDisc}>
      <meshBasicMaterial
        color={color}
        transparent
        opacity={1.1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

/**
 * FlipPropagationWave - Visual wave that propagates from flip origins across the cube.
 * startTime is passed in from the parent so it's correct on the very first frame.
 */
const WORM_TOTAL_DURATION = 2.0 + 0 + 1.5; // duration + lingerDur + flyDur, must match WormParticle

const FlipPropagationWave = ({ origins, startTime, onComplete }) => {
  const [progress, setProgress] = useState(0);
  const ringsRef = useRef([]);
  const onCompleteCalledRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Fallback timeout — guarantees the wave removes itself after worm lifetime
  // even if the worm's onComplete callback is never invoked.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!onCompleteCalledRef.current) {
        onCompleteCalledRef.current = true;
        onCompleteRef.current?.();
      }
    }, (WORM_TOTAL_DURATION + 0.3) * 1000);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stable worm destinations — computed ONCE per origins change ──
  const wormEnds = useMemo(() => {
    if (!origins) return [];
    if (origins.length === 2) {
      return origins.map((_, idx) => origins[(idx + 1) % 2].position);
    }
    return origins.map((origin) => {
      const originPos = new THREE.Vector3(...origin.position);
      const inward = originPos.clone().multiplyScalar(-1);
      const axis = originPos.clone().normalize();
      const fallbackUp = Math.abs(axis.dot(new THREE.Vector3(0, 1, 0))) > 0.9
        ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const jitterRight = new THREE.Vector3().crossVectors(axis, fallbackUp).normalize();
      const jitterUp = new THREE.Vector3().crossVectors(jitterRight, axis).normalize();
      return inward
        .addScaledVector(jitterRight, (Math.random() - 0.5) * 0.18)
        .addScaledVector(jitterUp, (Math.random() - 0.5) * 0.18)
        .toArray();
    });
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
  });

  if (!origins || origins.length === 0) return null;

  const wormCompleted = () => {
    if (onCompleteCalledRef.current) return;
    onCompleteCalledRef.current = true;
    onComplete?.();
  };

  return (
    <group>
      {origins.map((origin, idx) => (
        <group key={idx} position={origin.position} rotation={origin.rotation || [0, 0, 0]}>
          {/* Expanding ring */}
          <mesh ref={el => ringsRef.current[idx] = el} geometry={sharedWaveRingGeometry}>
            <meshBasicMaterial
              color={origin.color} transparent opacity={0.8}
              side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false}
            />
          </mesh>
          {/* Inner glow ring */}
          <mesh geometry={sharedInnerRingGeometry}>
            <meshBasicMaterial
              color={origin.color} transparent opacity={0.4 * (1 - progress)}
              side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false}
            />
          </mesh>
          {/* Tile face flash — bright disc that pops open like a wormhole gate */}
          <TileFlash startTime={startTime} color={origin.color} />
          {/* Shard burst particles — same effect as disparity mode */}
          <AutoFlipParticles color={origin.color} />
        </group>
      ))}

      {/* Worms rendered outside positioned groups — outer group anchored at origin.position */}
      {origins.map((origin, idx) => (
        <WormParticle
          key={`worm-${idx}`}
          start={origin.position}
          end={wormEnds[idx] || origin.position}
          color1={origin.color}
          color2={origin.color}
          startTime={startTime}
          onComplete={idx === 0 ? wormCompleted : undefined}
        />
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
            color="#555555" transparent opacity={0.4}
            blending={THREE.NormalBlending} depthWrite={false}
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
          color={heatColor} transparent opacity={0}
          blending={THREE.AdditiveBlending} depthWrite={false}
        />
      </mesh>
      {intensity > 0.5 && (
        <mesh position={[0, 0, 0.015]} geometry={sharedHeatInnerCircle}>
          <meshBasicMaterial
            color="#ffffff" transparent opacity={intensity * 0.3}
            blending={THREE.AdditiveBlending} depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
};

export default FlipPropagationWave;
