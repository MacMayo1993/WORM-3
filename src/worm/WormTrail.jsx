// src/worm/WormTrail.jsx
// Visual worm body using connected spheres with glow effect

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getSegmentWorldPos } from './wormLogic.js';

// Worm segment colors - gradient from head to tail
const HEAD_COLOR = '#00ff88';
const BODY_COLOR = '#00cc66';
const TAIL_COLOR = '#009944';

export default function WormTrail({ segments, size, explosionFactor = 0, alive = true }) {
  const groupRef = useRef();
  const timeRef = useRef(0);

  // Calculate world positions for all segments
  const positions = useMemo(() => {
    return segments.map(seg => getSegmentWorldPos(seg, size, explosionFactor));
  }, [segments, size, explosionFactor]);

  // Animate pulse effect
  useFrame((state, delta) => {
    timeRef.current += delta;
  });

  if (segments.length === 0) return null;

  return (
    <group ref={groupRef}>
      {positions.map((pos, i) => {
        const isHead = i === 0;
        const isTail = i === positions.length - 1;
        const t = positions.length > 1 ? i / (positions.length - 1) : 0;

        // Interpolate color from head to tail
        const headCol = new THREE.Color(HEAD_COLOR);
        const tailCol = new THREE.Color(TAIL_COLOR);
        const segColor = headCol.clone().lerp(tailCol, t);

        // Size decreases from head to tail
        const baseSize = isHead ? 0.35 : isTail ? 0.2 : 0.28 - (t * 0.08);
        // Pulse animation for head
        const pulseScale = isHead ? 1 + Math.sin(timeRef.current * 8) * 0.1 : 1;
        const finalSize = baseSize * pulseScale;

        // Opacity for dead state
        const opacity = alive ? 1 : 0.5;

        return (
          <group key={i} position={pos}>
            {/* Main segment sphere */}
            <mesh>
              <sphereGeometry args={[finalSize, 16, 16]} />
              <meshStandardMaterial
                color={segColor}
                emissive={segColor}
                emissiveIntensity={isHead ? 0.8 : 0.4}
                transparent={!alive}
                opacity={opacity}
              />
            </mesh>

            {/* Glow halo for head */}
            {isHead && alive && (
              <mesh>
                <sphereGeometry args={[finalSize * 1.5, 16, 16]} />
                <meshBasicMaterial
                  color={HEAD_COLOR}
                  transparent
                  opacity={0.2 + Math.sin(timeRef.current * 8) * 0.1}
                  side={THREE.BackSide}
                />
              </mesh>
            )}

            {/* Eyes on head */}
            {isHead && (
              <>
                <mesh position={[0.12, 0.1, 0.25]}>
                  <sphereGeometry args={[0.08, 8, 8]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
                <mesh position={[-0.12, 0.1, 0.25]}>
                  <sphereGeometry args={[0.08, 8, 8]} />
                  <meshBasicMaterial color="#ffffff" />
                </mesh>
                {/* Pupils */}
                <mesh position={[0.12, 0.1, 0.32]}>
                  <sphereGeometry args={[0.04, 8, 8]} />
                  <meshBasicMaterial color="#000000" />
                </mesh>
                <mesh position={[-0.12, 0.1, 0.32]}>
                  <sphereGeometry args={[0.04, 8, 8]} />
                  <meshBasicMaterial color="#000000" />
                </mesh>
              </>
            )}
          </group>
        );
      })}

      {/* Connecting tubes between segments */}
      {positions.length > 1 && positions.map((pos, i) => {
        if (i === 0) return null;
        const prevPos = positions[i - 1];
        const midPoint = [
          (pos[0] + prevPos[0]) / 2,
          (pos[1] + prevPos[1]) / 2,
          (pos[2] + prevPos[2]) / 2
        ];
        const distance = Math.sqrt(
          Math.pow(pos[0] - prevPos[0], 2) +
          Math.pow(pos[1] - prevPos[1], 2) +
          Math.pow(pos[2] - prevPos[2], 2)
        );

        // Skip if segments are at same position or too far apart
        if (distance < 0.1 || distance > 2) return null;

        // Calculate rotation to align cylinder
        const direction = new THREE.Vector3(
          pos[0] - prevPos[0],
          pos[1] - prevPos[1],
          pos[2] - prevPos[2]
        ).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);

        const t = i / (positions.length - 1);
        const tubeColor = new THREE.Color(HEAD_COLOR).lerp(new THREE.Color(TAIL_COLOR), t);

        return (
          <mesh key={`tube-${i}`} position={midPoint} quaternion={quaternion}>
            <cylinderGeometry args={[0.15, 0.18, distance * 0.8, 8]} />
            <meshStandardMaterial
              color={tubeColor}
              emissive={tubeColor}
              emissiveIntensity={0.3}
              transparent={!alive}
              opacity={alive ? 1 : 0.5}
            />
          </mesh>
        );
      })}
    </group>
  );
}
