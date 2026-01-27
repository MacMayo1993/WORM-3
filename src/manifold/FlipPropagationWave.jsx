import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FACE_COLORS, ANTIPODAL_COLOR } from '../utils/constants.js';

// Shared geometries for wave effects - created once, reused
const sharedWaveRingGeometry = new THREE.RingGeometry(0.8, 1.0, 32);
const sharedInnerRingGeometry = new THREE.RingGeometry(0.3, 0.6, 32);
const sharedTrailCircleGeometry = new THREE.CircleGeometry(0.15, 16);
// Shared geometries for heat map
const sharedHeatOuterCircle = new THREE.CircleGeometry(0.55, 32);
const sharedHeatInnerCircle = new THREE.CircleGeometry(0.3, 32);

/**
 * FlipPropagationWave - Visual wave that propagates from flip origins across the cube
 * Shows the "ripple" of chaos spreading through the manifold
 */
const FlipPropagationWave = ({ origins, onComplete }) => {
  const [progress, setProgress] = useState(0);
  const ringsRef = useRef([]);
  const trailsRef = useRef([]);
  const materialsRef = useRef([]);

  useEffect(() => {
    setProgress(0);
  }, [origins]);

  // Cleanup materials on unmount
  useEffect(() => {
    return () => {
      materialsRef.current.forEach(mat => mat?.dispose?.());
      materialsRef.current = [];
    };
  }, []);

  useFrame((_, delta) => {
    if (progress >= 1) return;

    const newProgress = Math.min(1, progress + delta * 1.2);
    setProgress(newProgress);

    // Ease out for natural wave spread
    const easeOut = 1 - Math.pow(1 - newProgress, 3);

    // Update each wave ring
    ringsRef.current.forEach((ring, i) => {
      if (!ring) return;

      // Expand outward
      const scale = easeOut * 4 + 0.5;
      ring.scale.set(scale, scale, scale);

      // Fade out as it expands
      if (ring.material) {
        ring.material.opacity = (1 - easeOut) * 0.8;
      }
    });

    // Update trail particles
    trailsRef.current.forEach((trail, i) => {
      if (!trail) return;

      const trailProgress = Math.max(0, easeOut - i * 0.1);
      const trailScale = 0.1 + trailProgress * 0.3;
      trail.scale.set(trailScale, trailScale, trailScale);

      if (trail.material) {
        trail.material.opacity = Math.max(0, (1 - trailProgress) * 0.6);
      }
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

          {/* Trail particles showing propagation direction - uses shared geometry */}
          {[0, 1, 2, 3, 4, 5].map((t, ti) => {
            const angle = (ti / 6) * Math.PI * 2;
            const dist = progress * 2;
            return (
              <mesh
                key={ti}
                ref={el => trailsRef.current[idx * 6 + ti] = el}
                position={[
                  Math.cos(angle) * dist,
                  Math.sin(angle) * dist,
                  0.05
                ]}
                geometry={sharedTrailCircleGeometry}
              >
                <meshBasicMaterial
                  color={origin.color}
                  transparent
                  opacity={0.5}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
};

/**
 * ChaosHeatMap - Overlay showing cumulative flip intensity on each sticker
 * Rendered as a glowing aura around high-chaos tiles
 */
export const ChaosHeatMap = ({ position, rotation, flips, maxFlips = 10 }) => {
  const glowRef = useRef();
  const pulseRef = useRef(0);

  useFrame((state, delta) => {
    if (!glowRef.current) return;

    pulseRef.current += delta * 2;

    // Pulse intensity based on flip count
    const intensity = Math.min(1, flips / maxFlips);
    const pulse = Math.sin(pulseRef.current * (1 + intensity * 2)) * 0.2 + 0.8;

    glowRef.current.material.opacity = intensity * pulse * 0.6;

    // Slight scale pulse
    const scale = 1 + intensity * 0.1 * Math.sin(pulseRef.current);
    glowRef.current.scale.set(scale, scale, 1);
  });

  if (flips === 0) return null;

  // Color gradient from cool (low flips) to hot (high flips)
  const intensity = Math.min(1, flips / maxFlips);
  const heatColor = new THREE.Color();

  if (intensity < 0.33) {
    // Blue to cyan
    heatColor.setHSL(0.55 - intensity * 0.5, 1, 0.5);
  } else if (intensity < 0.66) {
    // Cyan to yellow
    heatColor.setHSL(0.15, 1, 0.5);
  } else {
    // Yellow to red/white hot
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
