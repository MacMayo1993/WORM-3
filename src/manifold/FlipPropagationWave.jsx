import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FACE_COLORS, ANTIPODAL_COLOR, FLIP_CAP, getHalfLifeMultiplier } from '../utils/constants.js';
import WormParticle from './WormParticle.jsx';

// Shared geometries for wave effects - created once, reused
const sharedWaveRingGeometry = new THREE.RingGeometry(0.8, 1.0, 32);
const sharedInnerRingGeometry = new THREE.RingGeometry(0.3, 0.6, 32);
// Shared geometries for heat map
const sharedHeatOuterCircle = new THREE.CircleGeometry(0.55, 32);
const sharedHeatInnerCircle = new THREE.CircleGeometry(0.3, 32);

/**
 * FlipPropagationWave - Visual wave that propagates from flip origins across the cube
 * Shows the "ripple" of chaos spreading through the manifold
 */
const FlipPropagationWave = ({ origins, onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const ringsRef = useRef([]);
  const startTimeRef = useRef(null);
  const wormCompleteCount = useRef(0);
  const { clock } = useThree();

  // ── Stable worm destinations — computed ONCE per origins change, not per render ──
  // If Math.random() is called inside JSX it fires on every re-render and
  // makes the worm teleport to a new destination each frame.
  const wormEnds = useMemo(() => {
    if (!origins) return [];

    // Flip events are usually emitted as antipodal pairs. When we have a pair,
    // each worm should travel toward the opposite tile so it actually crosses
    // through the cube instead of drifting away from the source face.
    if (origins.length === 2) {
      return origins.map((_, idx) => origins[(idx + 1) % 2].position);
    }

    // Fallback for non-paired origins: target the approximate antipodal point
    // through the cube center with a tiny deterministic jitter so paths don't
    // look perfectly mechanical.
    return origins.map((origin) => {
      const originPos = new THREE.Vector3(...origin.position);
      const inward = originPos.clone().multiplyScalar(-1);
      const axis = originPos.clone().normalize();

      const fallbackUp = Math.abs(axis.dot(new THREE.Vector3(0, 1, 0))) > 0.9
        ? new THREE.Vector3(1, 0, 0)
        : new THREE.Vector3(0, 1, 0);

      const jitterRight = new THREE.Vector3().crossVectors(axis, fallbackUp).normalize();
      const jitterUp = new THREE.Vector3().crossVectors(jitterRight, axis).normalize();
      const jitter = 0.18;

      return inward
        .addScaledVector(jitterRight, (Math.random() - 0.5) * jitter)
        .addScaledVector(jitterUp, (Math.random() - 0.5) * jitter)
        .toArray();
    });
  }, [origins]);  // only recalculated when origins reference changes

  useEffect(() => {
    setProgress(0);
    wormCompleteCount.current = 0;
    startTimeRef.current = clock.getElapsedTime();
    setCurrentTime(clock.getElapsedTime());
  }, [origins, clock]);

  // Cleanup materials on unmount
  useEffect(() => {
    return () => {
      ringsRef.current = [];
    };
  }, []);

  useFrame((state, delta) => {
    if (progress >= 1) return;

    const now = state.clock.getElapsedTime();
    setCurrentTime(now);                          // ← pass live clock to WormParticle

    const newProgress = Math.min(1, progress + delta * 1.2);
    setProgress(newProgress);

    // Ease out for natural wave spread
    const easeOut = 1 - Math.pow(1 - newProgress, 3);

    // Update each wave ring
    ringsRef.current.forEach((ring) => {
      if (!ring) return;

      const scale = easeOut * 4 + 0.5;
      ring.scale.set(scale, scale, scale);

      if (ring.material) {
        ring.material.opacity = (1 - easeOut) * 0.8;
      }
    });

    // Rings are done — worms own the component lifetime now
  });

  if (!origins || origins.length === 0) return null;

  return (
    <group>
      {origins.map((origin, idx) => (
        <group key={idx} position={origin.position}>
          {/* Main expanding ring - uses shared geometry */}
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

          {/* Secondary glow ring - uses shared geometry */}
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

          {/* Worm — positioned at world origin (0,0,0) so start/end are world coords.
              The group above is at origin.position, so we MUST pass world-space coords
              to WormParticle rather than local-space offsets. */}
        </group>
      ))}

      {origins.map((origin, idx) => (
        <WormParticle
          key={`worm-${idx}`}
          start={origin.position}
          end={wormEnds[idx] || origin.position}
          color1={origin.color}
          color2={origin.color}
          startTime={startTimeRef.current || 0}
          currentTime={currentTime}
          onComplete={() => {
            wormCompleteCount.current += 1;
            if (wormCompleteCount.current >= origins.length) onComplete?.();
          }}
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
      // Dead tile: static dim gray glow, no pulse
      glowRef.current.material.opacity = 0.4;
      glowRef.current.scale.setScalar(1);
      return;
    }

    // Heartbeat rate scales with half-life multiplier
    const halfLife = getHalfLifeMultiplier(flips);
    const baseRate = 1.5; // resting heartbeat ~1.5 Hz
    const heartRate = baseRate * halfLife;
    pulseRef.current += delta * heartRate;

    // Double-bump heartbeat waveform: two sharp peaks per cycle
    const t = pulseRef.current % (Math.PI * 2);
    const bump1 = Math.exp(-Math.pow((t - 1.0) * 3, 2));
    const bump2 = Math.exp(-Math.pow((t - 1.8) * 4, 2)) * 0.6;
    const heartbeat = bump1 + bump2;

    const intensity = Math.min(1, flips / maxFlips);
    glowRef.current.material.opacity = intensity * (0.3 + heartbeat * 0.5);

    // Scale pulse follows heartbeat
    const scale = 1 + heartbeat * 0.15 * intensity;
    glowRef.current.scale.set(scale, scale, 1);
  });

  if (flips === 0) return null;

  // Dead tile: flat gray
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

  // Color gradient from cool (low flips) to hot (high flips)
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
      {/* Outer heat glow - uses shared geometry */}
      <mesh ref={glowRef} position={[0, 0, 0.01]} geometry={sharedHeatOuterCircle}>
        <meshBasicMaterial
          color={heatColor}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Inner core glow for high chaos - uses shared geometry */}
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
