import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const CursorHighlight = ({ cursor, size, explosionFactor = 0 }) => {
  const meshRef = useRef();
  const glowRef = useRef();

  // Convert cursor to world position
  const getWorldPos = () => {
    const { face, row, col } = cursor;
    const k = (size - 1) / 2;
    const maxIdx = size - 1;

    let x, y, z;
    switch (face) {
      case 'PZ': x = col - k; y = (maxIdx - row) - k; z = maxIdx - k; break;
      case 'NZ': x = (maxIdx - col) - k; y = (maxIdx - row) - k; z = -k; break;
      case 'PX': x = maxIdx - k; y = (maxIdx - row) - k; z = (maxIdx - col) - k; break;
      case 'NX': x = -k; y = (maxIdx - row) - k; z = col - k; break;
      case 'PY': x = col - k; y = maxIdx - k; z = row - k; break;
      case 'NY': x = col - k; y = -k; z = (maxIdx - row) - k; break;
      default: x = 0; y = 0; z = k;
    }

    // Apply explosion factor
    const exploded = [
      x * (1 + explosionFactor * 1.8),
      y * (1 + explosionFactor * 1.8),
      z * (1 + explosionFactor * 1.8)
    ];

    // Offset slightly outward from face
    const offset = 0.53;
    switch (face) {
      case 'PZ': return [exploded[0], exploded[1], exploded[2] + offset];
      case 'NZ': return [exploded[0], exploded[1], exploded[2] - offset];
      case 'PX': return [exploded[0] + offset, exploded[1], exploded[2]];
      case 'NX': return [exploded[0] - offset, exploded[1], exploded[2]];
      case 'PY': return [exploded[0], exploded[1] + offset, exploded[2]];
      case 'NY': return [exploded[0], exploded[1] - offset, exploded[2]];
      default: return exploded;
    }
  };

  // Get rotation for the highlight to face outward
  const getRotation = () => {
    const { face } = cursor;
    switch (face) {
      case 'PZ': return [0, 0, 0];
      case 'NZ': return [0, Math.PI, 0];
      case 'PX': return [0, Math.PI / 2, 0];
      case 'NX': return [0, -Math.PI / 2, 0];
      case 'PY': return [-Math.PI / 2, 0, 0];
      case 'NY': return [Math.PI / 2, 0, 0];
      default: return [0, 0, 0];
    }
  };

  // Animate glow
  useFrame((state) => {
    if (meshRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.15 + 0.85;
      meshRef.current.material.opacity = 0.4 * pulse;
    }
    if (glowRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.1 + 0.9;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  const position = getWorldPos();
  const rotation = getRotation();

  return (
    <group position={position} rotation={rotation}>
      {/* Inner glow ring */}
      <mesh ref={meshRef}>
        <ringGeometry args={[0.35, 0.48, 32]} />
        <meshBasicMaterial
          color="#fbbf24"
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Outer glow */}
      <mesh ref={glowRef}>
        <ringGeometry args={[0.3, 0.55, 32]} />
        <meshBasicMaterial
          color="#f59e0b"
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Corner indicators */}
      {[0, 1, 2, 3].map(i => (
        <mesh key={i} position={[
          Math.cos(i * Math.PI / 2 + Math.PI / 4) * 0.42,
          Math.sin(i * Math.PI / 2 + Math.PI / 4) * 0.42,
          0.01
        ]}>
          <circleGeometry args={[0.06, 16]} />
          <meshBasicMaterial
            color="#fbbf24"
            transparent
            opacity={0.7}
          />
        </mesh>
      ))}
    </group>
  );
};

export default CursorHighlight;
