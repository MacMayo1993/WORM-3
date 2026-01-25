// src/worm/ParityOrb.jsx
// Collectible parity orbs with pulsing glow effect
// Supports both surface mode and tunnel mode

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getSegmentWorldPos, getTunnelWorldPos } from './wormLogic.js';

// Orb colors - radiant energy
const ORB_COLORS = [
  '#ffd700', // Gold
  '#ff6b6b', // Coral
  '#4ecdc4', // Teal
  '#a855f7', // Purple
  '#f97316'  // Orange
];

function SingleOrb({ position, colorIndex = 0, collected = false, isTarget = false }) {
  const meshRef = useRef();
  const glowRef = useRef();
  const targetGlowRef = useRef();
  const timeOffset = useMemo(() => Math.random() * Math.PI * 2, []);

  const color = ORB_COLORS[colorIndex % ORB_COLORS.length];

  useFrame((state) => {
    if (!meshRef.current) return;

    const t = state.clock.elapsedTime + timeOffset;

    // Floating bob animation - more intense if target
    const bobIntensity = isTarget ? 0.12 : 0.05;
    meshRef.current.position.y = position[1] + Math.sin(t * 2) * bobIntensity;

    // Rotation - faster if target
    const rotSpeed = isTarget ? 1.5 : 0.5;
    meshRef.current.rotation.y = t * rotSpeed;
    meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.2;

    // Pulse scale - larger pulse if target
    const pulseIntensity = isTarget ? 0.3 : 0.15;
    const pulse = 1 + Math.sin(t * 4) * pulseIntensity;
    meshRef.current.scale.setScalar(pulse);

    // Glow intensity pulse
    if (glowRef.current) {
      const baseOpacity = isTarget ? 0.5 : 0.3;
      glowRef.current.material.opacity = baseOpacity + Math.sin(t * 4) * 0.15;
    }

    // Target highlight glow
    if (targetGlowRef.current && isTarget) {
      targetGlowRef.current.scale.setScalar(1 + Math.sin(t * 6) * 0.2);
      targetGlowRef.current.material.opacity = 0.2 + Math.sin(t * 6) * 0.1;
    }
  });

  if (collected) return null;

  return (
    <group position={[position[0], position[1], position[2]]}>
      {/* Core orb */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[isTarget ? 0.22 : 0.18, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isTarget ? 1.8 : 1.2}
          metalness={0.3}
          roughness={0.2}
        />
      </mesh>

      {/* Outer glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[isTarget ? 0.45 : 0.35, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isTarget ? 0.5 : 0.3}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Target highlight ring */}
      {isTarget && (
        <mesh ref={targetGlowRef}>
          <torusGeometry args={[0.4, 0.05, 8, 32]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.3}
          />
        </mesh>
      )}

      {/* Inner sparkle - brighter for target */}
      <pointLight
        color={color}
        intensity={isTarget ? 1.0 : 0.5}
        distance={isTarget ? 3 : 2}
        decay={2}
      />
    </group>
  );
}

/**
 * @param {Object} props
 * @param {Array} props.orbs - Orb positions (surface or tunnel)
 * @param {number} props.size - Cube size
 * @param {number} props.explosionFactor - Explosion animation factor
 * @param {string} props.mode - 'surface' or 'tunnel'
 * @param {string} props.targetTunnelId - ID of tunnel to highlight (for tunnel mode)
 */
export default function ParityOrbs({ orbs, size, explosionFactor = 0, mode = 'surface', targetTunnelId = null }) {
  const isTunnelMode = mode === 'tunnel';

  // Calculate world positions for all orbs
  const orbData = useMemo(() => {
    return orbs.map((orb, i) => {
      let position;
      let key;

      if (isTunnelMode && orb.tunnel) {
        // Tunnel mode: use tunnel position
        position = getTunnelWorldPos(orb.tunnel, orb.t, size, explosionFactor);
        key = `${orb.tunnelId}-${orb.t}`;
      } else {
        // Surface mode: use grid position
        position = getSegmentWorldPos(orb, size, explosionFactor);
        key = `${orb.x}-${orb.y}-${orb.z}-${orb.dirKey}`;
      }

      return {
        position,
        colorIndex: i,
        key,
        isTarget: isTunnelMode && orb.tunnelId === targetTunnelId
      };
    });
  }, [orbs, size, explosionFactor, isTunnelMode, targetTunnelId]);

  return (
    <group>
      {orbData.map((data) => (
        <SingleOrb
          key={data.key}
          position={data.position}
          colorIndex={data.colorIndex}
          isTarget={data.isTarget}
        />
      ))}
    </group>
  );
}

// Explosion effect when orb is collected
export function OrbCollectEffect({ position, color = '#ffd700' }) {
  const particlesRef = useRef();
  const timeRef = useRef(0);
  const particleCount = 12;

  // Generate random velocities for particles
  const velocities = useMemo(() => {
    return Array.from({ length: particleCount }, () => ({
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: (Math.random() - 0.5) * 2
    }));
  }, []);

  useFrame((state, delta) => {
    timeRef.current += delta;

    if (particlesRef.current && timeRef.current < 0.5) {
      const t = timeRef.current;
      particlesRef.current.children.forEach((particle, i) => {
        const v = velocities[i];
        particle.position.x = v.x * t * 3;
        particle.position.y = v.y * t * 3;
        particle.position.z = v.z * t * 3;
        particle.scale.setScalar(1 - t * 2);
        particle.material.opacity = 1 - t * 2;
      });
    }
  });

  if (timeRef.current > 0.5) return null;

  return (
    <group ref={particlesRef} position={position}>
      {Array.from({ length: particleCount }).map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={1} />
        </mesh>
      ))}
    </group>
  );
}
