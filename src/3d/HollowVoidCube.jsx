/**
 * HollowVoidCube.jsx
 *
 * Hollow void cube - Simplified working version
 * - 20 visible mini-cubes (corners + edges)
 * - 7 void tunnels through center
 * - Basic colored faces
 * - Camera controls included
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { TrackballControls } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../hooks/useGameStore.js';
import { FACE_COLORS } from '../utils/constants.js';

/**
 * Calculate hollow cube positions
 */
function calculateHollowPositions() {
  const positions = [];
  const scale = 0.7; // Larger scale for visibility

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        // Exclude 7 center voids (Manhattan distance <= 1)
        const manhattan = Math.abs(x) + Math.abs(y) + Math.abs(z);
        if (manhattan > 1) {
          positions.push({
            x: x * scale,
            y: y * scale,
            z: z * scale,
            gridX: x,
            gridY: y,
            gridZ: z,
          });
        }
      }
    }
  }
  return positions; // 20 positions
}

/**
 * HollowCubelet - Single colored mini-cube
 */
function HollowCubelet({ position, size = 0.65 }) {
  const meshRef = useRef();

  // Create materials for each face
  const materials = useMemo(() => {
    return [
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[5], side: THREE.DoubleSide }), // PX - Right (Blue)
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[2], side: THREE.DoubleSide }), // NX - Left (Green)
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[3], side: THREE.DoubleSide }), // PY - Top (White)
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[6], side: THREE.DoubleSide }), // NY - Bottom (Yellow)
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[1], side: THREE.DoubleSide }), // PZ - Front (Red)
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[4], side: THREE.DoubleSide }), // NZ - Back (Orange)
    ];
  }, []);

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* Solid cube with colored faces */}
      <mesh ref={meshRef} material={materials}>
        <boxGeometry args={[size, size, size]} />
      </mesh>

      {/* Wireframe edges */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(size, size, size)]} />
        <lineBasicMaterial color="#000000" linewidth={2} />
      </lineSegments>
    </group>
  );
}

/**
 * VoidSpaceGlow - Shader effect for tunnels
 */
function VoidSpaceGlow() {
  const meshRef = useRef();
  const parityCurrent = useGameStore((state) => state.parityCurrent);
  const chaosCurrent = useGameStore((state) => state.chaosCurrent);

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uParity: { value: 0 },
        uChaos: { value: 0 },
      },
      vertexShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;
        void main() {
          vPosition = position;
          vNormal = normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uParity;
        uniform float uChaos;
        varying vec3 vPosition;
        varying vec3 vNormal;

        void main() {
          float dist = length(vPosition);
          float proximity = 1.0 - smoothstep(0.2, 1.2, dist);

          // Parity color gradient
          vec3 cyan = vec3(0.0, 1.0, 1.0);
          vec3 purple = vec3(0.6, 0.0, 1.0);
          vec3 color = mix(cyan, purple, uParity);

          // Pulse
          float pulse = sin(uTime * 2.0) * 0.3 + 0.7;
          float intensity = proximity * pulse * 0.8;

          gl_FragColor = vec4(color * intensity, intensity * 0.5);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, []);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.material.uniforms.uTime.value = state.clock.elapsedTime;
      meshRef.current.material.uniforms.uParity.value = parityCurrent;
      meshRef.current.material.uniforms.uChaos.value = chaosCurrent;
    }
  });

  return (
    <mesh ref={meshRef} material={shaderMaterial}>
      <boxGeometry args={[1.8, 1.8, 1.8]} />
    </mesh>
  );
}

/**
 * HollowVoidCube - Main component
 */
export default function HollowVoidCube() {
  const hollowMode = useGameStore((state) => state.hollowMode);
  const positions = useMemo(() => calculateHollowPositions(), []);

  // Shader value lerping
  useFrame(() => {
    const lerpShaderValues = useGameStore.getState().lerpShaderValues;
    lerpShaderValues();
  });

  if (!hollowMode) {
    return null;
  }

  return (
    <>
      {/* Camera controls */}
      <TrackballControls
        makeDefault
        rotateSpeed={1.5}
        zoomSpeed={0.8}
        panSpeed={0.5}
        staticMoving
        enabled={hollowMode}
      />

      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <directionalLight position={[-5, -5, -5]} intensity={0.4} />
      <pointLight position={[0, 0, 0]} intensity={0.5} color="#ffffff" />

      {/* Hollow cube group */}
      <group name="hollow-void-cube">
        {/* 20 mini-cubes */}
        {positions.map((pos, idx) => (
          <HollowCubelet
            key={`hollow-${idx}`}
            position={pos}
          />
        ))}

        {/* Void glow effect */}
        <VoidSpaceGlow />
      </group>
    </>
  );
}
