// src/components/overlays/SolveHighlight.jsx
// Visual highlighting for solve mode pieces

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';

// Individual highlight for one piece
const PieceHighlight = React.memo(({ x, y, z, dir, solved, type }) => {
  const { size, explosionFactor } = useGameStore(
    useShallow(s => ({ size: s.size, explosionFactor: s.explosionT }))
  );
  const meshRef = useRef();
  const glowRef = useRef();
  const phaseRef = useRef(Math.random() * Math.PI * 2);

  // Convert grid position to world position
  const position = useMemo(() => {
    const k = (size - 1) / 2;
    const baseX = x - k;
    const baseY = y - k;
    const baseZ = z - k;

    const exploded = [
      baseX * (1 + explosionFactor * 1.8),
      baseY * (1 + explosionFactor * 1.8),
      baseZ * (1 + explosionFactor * 1.8)
    ];

    const offset = 0.54;
    switch (dir) {
      case 'PZ': return [exploded[0], exploded[1], exploded[2] + offset];
      case 'NZ': return [exploded[0], exploded[1], exploded[2] - offset];
      case 'PX': return [exploded[0] + offset, exploded[1], exploded[2]];
      case 'NX': return [exploded[0] - offset, exploded[1], exploded[2]];
      case 'PY': return [exploded[0], exploded[1] + offset, exploded[2]];
      case 'NY': return [exploded[0], exploded[1] - offset, exploded[2]];
      default: return exploded;
    }
  }, [x, y, z, dir, size, explosionFactor]);

  // Get rotation for the highlight to face outward
  const rotation = useMemo(() => {
    switch (dir) {
      case 'PZ': return [0, 0, 0];
      case 'NZ': return [0, Math.PI, 0];
      case 'PX': return [0, Math.PI / 2, 0];
      case 'NX': return [0, -Math.PI / 2, 0];
      case 'PY': return [-Math.PI / 2, 0, 0];
      case 'NY': return [Math.PI / 2, 0, 0];
      default: return [0, 0, 0];
    }
  }, [dir]);

  // Colors based on state
  const colors = useMemo(() => {
    if (solved) {
      return { ring: '#00ff88', glow: '#00cc66' }; // Green for solved
    }
    switch (type) {
      case 'target':
        return { ring: '#fbbf24', glow: '#f59e0b' }; // Gold for target position
      case 'current':
        return { ring: '#60a5fa', glow: '#3b82f6' }; // Blue for current position
      case 'corner':
        return { ring: '#c084fc', glow: '#a855f7' }; // Purple for corners
      case 'edge':
        return { ring: '#f472b6', glow: '#ec4899' }; // Pink for edges
      case 'oll':
      case 'pll':
        return { ring: '#fde047', glow: '#facc15' }; // Yellow for OLL/PLL
      default:
        return { ring: '#fbbf24', glow: '#f59e0b' };
    }
  }, [solved, type]);

  // Animate glow
  useFrame((state) => {
    const t = state.clock.elapsedTime + phaseRef.current;

    if (meshRef.current) {
      const pulse = Math.sin(t * 2.5) * 0.2 + 0.8;
      meshRef.current.material.opacity = (solved ? 0.5 : 0.6) * pulse;
    }
    if (glowRef.current) {
      const pulse = Math.sin(t * 2.5) * 0.1 + 1;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* Inner highlight ring */}
      <mesh ref={meshRef}>
        <ringGeometry args={[0.32, 0.44, 24]} />
        <meshBasicMaterial
          color={colors.ring}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Outer glow */}
      <mesh ref={glowRef}>
        <ringGeometry args={[0.28, 0.50, 24]} />
        <meshBasicMaterial
          color={colors.glow}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Solved checkmark indicator */}
      {solved && (
        <mesh position={[0, 0, 0.01]}>
          <circleGeometry args={[0.15, 16]} />
          <meshBasicMaterial
            color="#00ff88"
            transparent
            opacity={0.8}
          />
        </mesh>
      )}
    </group>
  );
});

// Main component that renders all highlights
const SolveHighlight = ({ highlights }) => {
  if (!highlights || highlights.length === 0) return null;

  return (
    <group>
      {highlights.map((h, idx) => (
        <PieceHighlight
          key={`${h.x}-${h.y}-${h.z}-${h.dir}-${idx}`}
          x={h.x}
          y={h.y}
          z={h.z}
          dir={h.dir}
          solved={h.solved}
          type={h.type}
        />
      ))}
    </group>
  );
};

export default SolveHighlight;
