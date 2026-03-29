// src/worm/CrawlerCharacter.jsx
// 3D worm character for the platformer mode.
// Rendered as a segmented caterpillar-like creature with eyes and antennae.

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FACE_NORMALS } from './crawlerPhysics.js';
import { useGameStore } from '../hooks/useGameStore.js';
import WormHat3D from './wormCosmetics.jsx';
import { getSkin } from './wormCosmeticsData.js';

const EYE_WHITE = '#ffffff';
const PUPIL = '#111111';
const SEGMENT_OFFSETS = [0, -0.32, -0.6, -0.85];
const HISTORY_SIZE = 100;
const HISTORY_STEP = 10;
const TRAIL_LIFETIME = 2.0;
const TRAIL_SPAWN_INTERVAL = 0.08;
const TRAIL_MAX_POINTS = 28;

const _worldPos = new THREE.Vector3();
const _rootPos = new THREE.Vector3();
const _segPos = new THREE.Vector3();
const _invQuat = new THREE.Quaternion();
const _tailWorldPos = new THREE.Vector3();
const _trailLocalPos = new THREE.Vector3();

// Circular buffer helpers — avoids per-frame unshift/clone allocations
function makeCircularBuffer(capacity) {
  return {
    buf: Array.from({ length: capacity }, () => new THREE.Vector3()),
    head: 0,  // points to the slot where the NEXT write will go
    count: 0,
    capacity,
  };
}
// Write a new entry (overwrites oldest when full)
function cbWrite(cb, v) {
  cb.buf[cb.head].copy(v);
  cb.head = (cb.head + 1) % cb.capacity;
  if (cb.count < cb.capacity) cb.count++;
}
// Read the entry that is `offset` steps behind the most-recent write (0 = newest)
function cbRead(cb, offset) {
  if (offset >= cb.count) return null;
  const idx = (cb.head - 1 - offset + cb.capacity) % cb.capacity;
  return cb.buf[idx];
}

export default function CrawlerCharacter({ position, forward, face, jumpHeight, velocity, alive = true }) {
  const wormSkinId = useGameStore(s => s.wormSkin);
  const wormHatId = useGameStore(s => s.wormHat);
  const skin = getSkin(wormSkinId);
  const BODY_COLOR = skin.body;
  const BELLY_COLOR = skin.belly;
  const ANTENNA_COLOR = skin.antenna;
  const GLOW_COLOR = skin.glow;

  const groupRef = useRef();
  const bodyRootRef = useRef();
  const timeRef = useRef(0);
  const positionHistory = useRef(makeCircularBuffer(HISTORY_SIZE));
  const bodySegmentRefs = useRef([]);
  const trailRefs = useRef([]);
  const trailSpawnT = useRef(0);
  // nextTrailSlot: round-robin index so finding a free slot is O(1)
  const nextTrailSlot = useRef(0);
  const trailData = useRef(Array.from({ length: TRAIL_MAX_POINTS }, () => ({
    active: false,
    age: 0,
    pos: new THREE.Vector3(),
  })));

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

    if (!groupRef.current) return;

    groupRef.current.getWorldPosition(_worldPos);
    cbWrite(positionHistory.current, _worldPos);

    if (!bodyRootRef.current) return;

    groupRef.current.getWorldPosition(_rootPos);
    _invQuat.copy(quaternion).invert();

    const moveFactor = Math.min(1, velocity || 0);
    for (let i = 1; i < SEGMENT_OFFSETS.length; i++) {
      const segGroup = bodySegmentRefs.current[i];
      if (!segGroup) continue;

      const sampled = cbRead(positionHistory.current, i * HISTORY_STEP);
      if (!sampled) continue;

      _segPos.copy(sampled).sub(_rootPos).applyQuaternion(_invQuat);
      _segPos.y += Math.sin(timeRef.current * 6 + i * 0.8) * 0.02 * moveFactor;
      segGroup.position.copy(_segPos);
    }

    const tailRef = bodySegmentRefs.current[SEGMENT_OFFSETS.length - 1];
    if (tailRef) {
      trailSpawnT.current += delta;
      tailRef.getWorldPosition(_tailWorldPos);

      if (alive && moveFactor > 0.05 && trailSpawnT.current >= TRAIL_SPAWN_INTERVAL) {
        trailSpawnT.current = 0;
        // Round-robin: scan at most TRAIL_MAX_POINTS slots starting from nextTrailSlot
        const data = trailData.current;
        let slotIdx = nextTrailSlot.current;
        for (let s = 0; s < TRAIL_MAX_POINTS; s++) {
          if (!data[slotIdx].active) break;
          slotIdx = (slotIdx + 1) % TRAIL_MAX_POINTS;
        }
        nextTrailSlot.current = (slotIdx + 1) % TRAIL_MAX_POINTS;
        const slot = data[slotIdx];
        slot.active = true;
        slot.age = 0;
        slot.pos.copy(_tailWorldPos);
      }
    }

    for (let i = 0; i < TRAIL_MAX_POINTS; i++) {
      const tp = trailData.current[i];
      const mesh = trailRefs.current[i];
      if (!mesh) continue;

      if (!tp.active) {
        mesh.visible = false;
        continue;
      }

      tp.age += delta;
      if (tp.age >= TRAIL_LIFETIME) {
        tp.active = false;
        mesh.visible = false;
        continue;
      }

      const life = 1 - tp.age / TRAIL_LIFETIME;
      mesh.visible = true;
      _trailLocalPos.copy(tp.pos).sub(_rootPos);
      mesh.position.copy(_trailLocalPos);
      mesh.scale.setScalar(0.35 + life * 0.55);
      mesh.material.opacity = life * 0.25;
    }
  });

  if (!position) return null;

  const t = timeRef.current;
  const bobble = alive ? Math.sin(t * 6) * 0.03 * Math.min(1, velocity || 0) : 0;
  const breathe = 1 + Math.sin(t * 3) * 0.04;
  const opacity = alive ? 1 : 0.4;

  return (
    <group ref={groupRef} position={position.toArray ? position.toArray() : position}>
      <group ref={bodyRootRef} quaternion={quaternion}>
        {/* Body segments */}
        {SEGMENT_OFFSETS.map((zOff, i) => {
          const isHead = i === 0;
          const segScale = isHead ? 0.28 : 0.24 - i * 0.02;
          const segBob = Math.sin(t * 6 + i * 0.8) * 0.02 * Math.min(1, velocity || 0);
          const segColor = isHead ? BODY_COLOR : BELLY_COLOR;

          return (
            <group ref={el => (bodySegmentRefs.current[i] = el)} key={i} position={[0, segBob + bobble, zOff]}>
              <mesh scale={[segScale * breathe, segScale * breathe, segScale]}>
                <sphereGeometry args={[1, 12, 12]} />
                <meshPhysicalMaterial
                  color={segColor}
                  emissive={segColor}
                  emissiveIntensity={isHead ? 0.4 : 0.12}
                  clearcoat={1}
                  clearcoatRoughness={0.1}
                  thickness={0.5}
                  roughness={0.2}
                  metalness={0}
                  transmission={0.2}
                  ior={1.45}
                  iridescence={0.16}
                  iridescenceIOR={1.3}
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

        {/* Hat — sits on top of the head, Y is outward from the face */}
        <group position={[0, 0.28, 0]}>
          <WormHat3D type={wormHatId} scale={0.28} />
        </group>

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

        {/* Mouth — 3-dot smile matching HealerWormMode */}
        <mesh position={[-0.07, 0.01, 0.27]}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshBasicMaterial color={PUPIL} />
        </mesh>
        <mesh position={[0, -0.025, 0.27]}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshBasicMaterial color={PUPIL} />
        </mesh>
        <mesh position={[0.07, 0.01, 0.27]}>
          <sphereGeometry args={[0.025, 6, 6]} />
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

      {/* Slimy trail — each blob fades out completely after 2 seconds */}
      {Array.from({ length: TRAIL_MAX_POINTS }, (_, i) => (
        <mesh
          key={`trail-${i}`}
          ref={el => (trailRefs.current[i] = el)}
          visible={false}
          renderOrder={5}
        >
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial
            color={GLOW_COLOR}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
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
