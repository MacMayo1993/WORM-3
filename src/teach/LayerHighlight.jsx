// src/teach/LayerHighlight.jsx
// 3D layer highlight that shows which slice will be rotated next
// Renders a translucent colored plane on the target slice

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const LayerHighlight = ({ axis, sliceIndex, dir, size }) => {
  const meshRef = useRef();
  const arrowRef = useRef();

  const k = (size - 1) / 2;
  const offset = sliceIndex - k;

  // Position and rotation based on axis
  let position, rotation;
  if (axis === 'col') {
    position = [offset, 0, 0];
    rotation = [0, 0, Math.PI / 2];
  } else if (axis === 'row') {
    position = [0, offset, 0];
    rotation = [0, 0, 0];
  } else {
    position = [0, 0, offset];
    rotation = [Math.PI / 2, 0, 0];
  }

  const planeSize = size * 0.95;

  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.elapsedTime;
      meshRef.current.material.opacity = 0.08 + Math.sin(t * 3) * 0.04;
    }
    if (arrowRef.current) {
      const t = state.clock.elapsedTime;
      // Rotate the arrow indicator to show direction
      arrowRef.current.rotation.z = dir * t * 2;
    }
  });

  return (
    <group>
      {/* Translucent slice plane */}
      <mesh ref={meshRef} position={position} rotation={rotation}>
        <planeGeometry args={[planeSize, planeSize]} />
        <meshBasicMaterial
          color="#00d9ff"
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Direction arrow ring */}
      <mesh ref={arrowRef} position={position} rotation={rotation}>
        <ringGeometry args={[size * 0.4, size * 0.45, 32, 1, 0, Math.PI * 1.5]} />
        <meshBasicMaterial
          color={dir === 1 ? '#00ff88' : '#fbbf24'}
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};

export default LayerHighlight;
