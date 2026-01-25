// src/worm/ParityOrb.jsx
// Collectible parity orbs with pulsing glow effect

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getSegmentWorldPos } from './wormLogic.js';

// Orb colors - radiant energy
const ORB_COLORS = [
  '#ffd700', // Gold
  '#ff6b6b', // Coral
  '#4ecdc4', // Teal
  '#a855f7', // Purple
  '#f97316'  // Orange
];

function SingleOrb({ position, colorIndex = 0, collected = false }) {
  const meshRef = useRef();
  const glowRef = useRef();
  const timeOffset = useMemo(() => Math.random() * Math.PI * 2, []);

  const color = ORB_COLORS[colorIndex % ORB_COLORS.length];

  useFrame((state) => {
    if (!meshRef.current) return;

    const t = state.clock.elapsedTime + timeOffset;

    // Floating bob animation
    meshRef.current.position.y = position[1] + Math.sin(t * 2) * 0.05;

    // Rotation
    meshRef.current.rotation.y = t * 0.5;
    meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.2;

    // Pulse scale
    const pulse = 1 + Math.sin(t * 4) * 0.15;
    meshRef.current.scale.setScalar(pulse);

    // Glow intensity pulse
    if (glowRef.current) {
      glowRef.current.material.opacity = 0.3 + Math.sin(t * 4) * 0.15;
    }
  });

  if (collected) return null;

  return (
    <group position={[position[0], position[1], position[2]]}>
      {/* Core orb */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[0.18, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.2}
          metalness={0.3}
          roughness={0.2}
        />
      </mesh>

      {/* Outer glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.3}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Inner sparkle */}
      <pointLight
        color={color}
        intensity={0.5}
        distance={2}
        decay={2}
      />
    </group>
  );
}

export default function ParityOrbs({ orbs, size, explosionFactor = 0 }) {
  // Calculate world positions for all orbs
  const orbData = useMemo(() => {
    return orbs.map((orb, i) => ({
      position: getSegmentWorldPos(orb, size, explosionFactor),
      colorIndex: i,
      key: `${orb.x}-${orb.y}-${orb.z}-${orb.dirKey}`
    }));
  }, [orbs, size, explosionFactor]);

  return (
    <group>
      {orbData.map((data) => (
        <SingleOrb
          key={data.key}
          position={data.position}
          colorIndex={data.colorIndex}
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
