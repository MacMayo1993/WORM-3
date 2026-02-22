// src/worm/CrawlerCharacter.jsx
// 3D worm character for the platformer mode.
// Rendered as a segmented caterpillar-like creature with eyes and antennae.

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FACE_NORMALS } from './crawlerPhysics.js';

const BODY_COLOR = '#00ff88';
const BELLY_COLOR = '#00cc66';
const EYE_WHITE = '#ffffff';
const PUPIL = '#111111';
const ANTENNA_COLOR = '#88ffbb';
const GLOW_COLOR = '#00ff88';

export default function CrawlerCharacter({ position, forward, face, jumpHeight, velocity, alive = true }) {
  const groupRef = useRef();
  const timeRef = useRef(0);

  // Compute orientation: look along forward, up along face normal
  const quaternion = useMemo(() => {
    if (!forward || !face) return new THREE.Quaternion();
    const fwd = forward.clone().normalize();
    const up = FACE_NORMALS[face]?.clone() || new THREE.Vector3(0, 1, 0);
    const mat = new THREE.Matrix4().lookAt(
      new THREE.Vector3(0, 0, 0),
      fwd,
      up
    );
    return new THREE.Quaternion().setFromRotationMatrix(mat);
  }, [forward, face]);

  // Animate
  useFrame((_, delta) => {
    timeRef.current += delta;
  });

  if (!position) return null;

  const t = timeRef.current;
  const bobble = alive ? Math.sin(t * 6) * 0.03 * Math.min(1, velocity || 0) : 0;
  const breathe = 1 + Math.sin(t * 3) * 0.04;
  const opacity = alive ? 1 : 0.4;

  return (
    <group ref={groupRef} position={position.toArray ? position.toArray() : position}>
      <group quaternion={quaternion}>
        {/* Body segments */}
        {[0, -0.32, -0.6, -0.85].map((zOff, i) => {
          const isHead = i === 0;
          const segScale = isHead ? 0.28 : 0.24 - i * 0.02;
          const segBob = Math.sin(t * 6 + i * 0.8) * 0.02 * Math.min(1, velocity || 0);
          const segColor = isHead ? BODY_COLOR : BELLY_COLOR;

          return (
            <group key={i} position={[0, segBob + bobble, zOff]}>
              <mesh scale={[segScale * breathe, segScale * breathe, segScale]}>
                <sphereGeometry args={[1, 12, 12]} />
                <meshStandardMaterial
                  color={segColor}
                  emissive={segColor}
                  emissiveIntensity={isHead ? 0.5 : 0.2}
                  transparent={!alive}
                  opacity={opacity}
                />
              </mesh>

              {/* Tiny legs on body segments */}
              {!isHead && (
                <>
                  <mesh position={[segScale * 0.8, -segScale * 0.5, 0]}
                    rotation={[0, 0, Math.sin(t * 8 + i) * 0.4]}>
                    <capsuleGeometry args={[0.02, 0.12, 4, 4]} />
                    <meshStandardMaterial color={BELLY_COLOR} />
                  </mesh>
                  <mesh position={[-segScale * 0.8, -segScale * 0.5, 0]}
                    rotation={[0, 0, -Math.sin(t * 8 + i) * 0.4]}>
                    <capsuleGeometry args={[0.02, 0.12, 4, 4]} />
                    <meshStandardMaterial color={BELLY_COLOR} />
                  </mesh>
                </>
              )}
            </group>
          );
        })}

        {/* Eyes */}
        <mesh position={[0.1, 0.12, 0.2]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color={EYE_WHITE} />
        </mesh>
        <mesh position={[-0.1, 0.12, 0.2]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color={EYE_WHITE} />
        </mesh>
        <mesh position={[0.1, 0.12, 0.27]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color={PUPIL} />
        </mesh>
        <mesh position={[-0.1, 0.12, 0.27]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color={PUPIL} />
        </mesh>

        {/* Antennae */}
        <group position={[0.06, 0.22, 0.15]}
          rotation={[Math.sin(t * 4) * 0.15, 0, 0.3]}>
          <mesh>
            <capsuleGeometry args={[0.015, 0.2, 4, 4]} />
            <meshStandardMaterial color={ANTENNA_COLOR} emissive={ANTENNA_COLOR} emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <sphereGeometry args={[0.035, 6, 6]} />
            <meshStandardMaterial color={GLOW_COLOR} emissive={GLOW_COLOR} emissiveIntensity={1} />
          </mesh>
        </group>
        <group position={[-0.06, 0.22, 0.15]}
          rotation={[Math.sin(t * 4 + 1) * 0.15, 0, -0.3]}>
          <mesh>
            <capsuleGeometry args={[0.015, 0.2, 4, 4]} />
            <meshStandardMaterial color={ANTENNA_COLOR} emissive={ANTENNA_COLOR} emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <sphereGeometry args={[0.035, 6, 6]} />
            <meshStandardMaterial color={GLOW_COLOR} emissive={GLOW_COLOR} emissiveIntensity={1} />
          </mesh>
        </group>

        {/* Glow halo */}
        {alive && (
          <mesh>
            <sphereGeometry args={[0.45, 16, 16]} />
            <meshBasicMaterial
              color={GLOW_COLOR}
              transparent
              opacity={0.12 + Math.sin(t * 4) * 0.05}
              side={THREE.BackSide}
            />
          </mesh>
        )}
      </group>

      {/* Ground shadow */}
      {jumpHeight > 0.1 && (
        <mesh position={[0, -jumpHeight, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.25, 16]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.3 * Math.max(0, 1 - jumpHeight / 3)} />
        </mesh>
      )}

      {/* Point light on crawler */}
      <pointLight color={GLOW_COLOR} intensity={0.6} distance={3} decay={2} />
    </group>
  );
}

/**
 * Simple orb mesh for platformer mode.
 */
export function CrawlerOrb({ position, color = '#ffd700', collected }) {
  const meshRef = useRef();
  const timeRef = useRef(Math.random() * 100);

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (meshRef.current && !collected) {
      const t = timeRef.current;
      meshRef.current.rotation.y = t * 1.5;
      meshRef.current.position.y = position.y + Math.sin(t * 3) * 0.08;
      meshRef.current.scale.setScalar(1 + Math.sin(t * 4) * 0.1);
    }
  });

  if (collected) return null;

  return (
    <group position={position.toArray ? position.toArray() : position}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[0.15, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.2}
          metalness={0.4}
          roughness={0.2}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} side={THREE.BackSide} />
      </mesh>
      <pointLight color={color} intensity={0.4} distance={2} decay={2} />
    </group>
  );
}
