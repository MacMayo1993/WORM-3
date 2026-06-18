// src/worm/CrawlerCharacter.jsx
// 3D worm character for the platformer mode.
// Rendered as a segmented caterpillar-like creature with eyes and antennae.

import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FACE_NORMALS } from './crawlerPhysics.js';
import { useGameStore } from '../hooks/useGameStore.js';
import WormHat3D from './wormCosmetics.jsx';
import { getSkin } from './wormCosmeticsData.js';
import { getWormCharacter } from './wormCharacterData.js';

const EYE_WHITE = '#ffffff';
const PUPIL = '#111111';
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
// Bookworm per-segment orientation (reusable to avoid GC)
const _bookDirWorld = new THREE.Vector3();
const _bookDirLocal = new THREE.Vector3();
const _bookMat = new THREE.Matrix4();
const _localOrigin = new THREE.Vector3(0, 0, 0);
const _localUp = new THREE.Vector3(0, 1, 0);
// Connector cylinder scratch (avoids per-frame GC)
const _connDir = new THREE.Vector3();
const _connQuat = new THREE.Quaternion();

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
  const wormCharacterId = useGameStore(s => s.wormCharacter ?? 'classic');
  const skin = getSkin(wormSkinId);
  const wormCharacter = getWormCharacter(wormCharacterId);
  const BODY_COLOR = skin.body;
  const BELLY_COLOR = skin.belly;
  const ANTENNA_COLOR = skin.antenna;
  const GLOW_COLOR = skin.glow;
  const isInch = wormCharacter.id === 'inch';
  const isGlow = wormCharacter.id === 'glow';
  const isBook = wormCharacter.id === 'book';
  const isWiggle = wormCharacter.id === 'wiggle';
  const isPrism = wormCharacter.id === 'prism';
  const segmentOffsets = isInch ? [0, -0.18, -0.38] : [0, -0.28, -0.52, -0.73];
  const historyStep = isInch ? 11 : HISTORY_STEP;

  const groupRef = useRef();
  const bodyRootRef = useRef();
  const timeRef = useRef(0);
  // Inch Worm accordion gait — accumulates only while the worm is actually moving so the
  // bunch→extend cycle is synced to locomotion and freezes (spread out) when it stops.
  const inchGaitRef = useRef(0);
  const positionHistory = useRef(makeCircularBuffer(HISTORY_SIZE));
  const bodySegmentRefs = useRef([]);
  const connectorRefs = useRef([]);
  const glowRingRefs = useRef([]);
  const glowTailRef = useRef();
  const trailRefs = useRef([]);
  const trailSpawnT = useRef(0);
  // nextTrailSlot: round-robin index so finding a free slot is O(1)
  const nextTrailSlot = useRef(0);
  const trailData = useRef(Array.from({ length: TRAIL_MAX_POINTS }, () => ({
    active: false,
    age: 0,
    pos: new THREE.Vector3(),
  })));

  // Compute orientation: look along forward, up along face normal.
  // Depend on forward.x/y/z (primitives) instead of the Vector3 reference so the
  // memo only recalculates when the direction actually changes, not every 30ms interval.
  const quaternion = useMemo(() => {
    if (!forward || !face) return new THREE.Quaternion();
    const fwd = forward.clone().normalize();
    const up = FACE_NORMALS[face]?.clone() || new THREE.Vector3(0, 1, 0);
    const mat = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), fwd, up);
    return new THREE.Quaternion().setFromRotationMatrix(mat);
  }, [forward?.x, forward?.y, forward?.z, face]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // Advance the accordion gait by how fast the worm is moving (frozen when idle).
    if (isInch) inchGaitRef.current += moveFactor * delta * 1.6;
    for (let i = 1; i < segmentOffsets.length; i++) {
      const segGroup = bodySegmentRefs.current[i];
      if (!segGroup) continue;

      const sampled = cbRead(positionHistory.current, i * historyStep);
      if (!sampled) continue;

      _segPos.copy(sampled).sub(_rootPos).applyQuaternion(_invQuat);
      _segPos.y += Math.sin(timeRef.current * 6 + i * 0.8) * 0.02 * moveFactor;

      if (isWiggle) {
        // Sidewinder: a wide, smooth side-to-side wave travelling down the body. Keep the
        // per-segment phase step gentle so the few body segments read as a coherent S-curve
        // rather than snapping to opposite sides.
        const wigglePhase = timeRef.current * 8 + i * 0.8;
        _segPos.x += Math.sin(wigglePhase) * 0.12 * moveFactor;
        _segPos.y += Math.sin(wigglePhase) * 0.03 * moveFactor;
      }

      if (isInch) {
        // Accordion gait synced to movement: the gather travels down the body (rear segments
        // lag via the i-phase offset), bunching toward the head, then the front extends
        // forward — 40% gather, 60% extend for the "inch then lunge" feel. Amplitude scales
        // with moveFactor so the body relaxes to its spread-out resting pose when stopped.
        const gaitRaw = ((inchGaitRef.current - i * 0.15) % 1.0 + 1.0) % 1.0;
        const gL = gaitRaw < 0.4 ? gaitRaw / 0.4 : 1.0 - (gaitRaw - 0.4) / 0.6;
        const gait = gL * gL * (3 - 2 * gL) * moveFactor; // smoothstep — distinct phases
        _segPos.z += gait * (i === 1 ? 0.16 : 0.26); // rear bunches toward head
        _segPos.y += gait * (i === 1 ? 0.04 : 0.09); // arch upward while gathered
      }

      segGroup.position.copy(_segPos);

      if (isBook) {
        // Orient each box segment toward the segment ahead of it (toward head),
        // so body boxes rotate properly through turns instead of snapping with the head.
        const sampledAhead = cbRead(positionHistory.current, (i - 1) * historyStep);
        if (sampledAhead) {
          _bookDirWorld.subVectors(sampledAhead, sampled).normalize();
          if (_bookDirWorld.lengthSq() > 0.001) {
            _bookDirLocal.copy(_bookDirWorld).applyQuaternion(_invQuat);
            _bookMat.lookAt(_localOrigin, _bookDirLocal, _localUp);
            segGroup.quaternion.setFromRotationMatrix(_bookMat);
          }
        }
      }
    }

    // Update inter-segment connector cylinders (bridge the gap between adjacent spheres)
    for (let ci = 0; ci < segmentOffsets.length - 1; ci++) {
      const conn = connectorRefs.current[ci];
      const segA = bodySegmentRefs.current[ci];
      const segB = bodySegmentRefs.current[ci + 1];
      if (!conn || !segA || !segB) continue;
      const pA = segA.position, pB = segB.position;
      conn.position.set((pA.x + pB.x) * 0.5, (pA.y + pB.y) * 0.5, (pA.z + pB.z) * 0.5);
      _connDir.subVectors(pA, pB);
      const dist = _connDir.length();
      if (dist < 0.001) { conn.visible = false; continue; }
      conn.visible = true;
      _connDir.normalize();
      _connQuat.setFromUnitVectors(_localUp, _connDir);
      conn.quaternion.copy(_connQuat);
      conn.scale.y = dist;
    }

    // Prism: each segment cycles through a rainbow that flows down the body over time.
    if (isPrism) {
      for (let pi = 0; pi < segmentOffsets.length; pi++) {
        const segGrp = bodySegmentRefs.current[pi];
        if (!segGrp || !segGrp.children[0]) continue;
        const mat = segGrp.children[0].material;
        if (!mat) continue;
        const hue = ((pi * 0.12) + timeRef.current * 0.15) % 1;
        mat.color.setHSL(hue, 0.85, 0.6);
        if (mat.emissive) {
          mat.emissive.setHSL(hue, 0.85, 0.5);
          mat.emissiveIntensity = 0.35;
        }
      }
      for (let ci = 0; ci < connectorRefs.current.length; ci++) {
        const conn = connectorRefs.current[ci];
        if (!conn || !conn.material) continue;
        const hue = ((ci * 0.12 + 0.06) + timeRef.current * 0.15) % 1;
        conn.material.color.setHSL(hue, 0.85, 0.6);
        if (conn.material.emissive) conn.material.emissive.setHSL(hue, 0.85, 0.5);
      }
    }

    // Alternating emissive glow for glow worm segments
    if (isGlow) {
      for (let gi = 0; gi < segmentOffsets.length; gi++) {
        const segGrp = bodySegmentRefs.current[gi];
        if (!segGrp || !segGrp.children[0]) continue;
        const mat = segGrp.children[0].material;
        if (!mat) continue;
        const isOn = gi % 2 === 0;
        mat.emissiveIntensity = isOn
          ? 2.8 + Math.sin(timeRef.current * 3.5 + gi) * 0.7
          : 0.45 + Math.sin(timeRef.current * 3.5 + gi + Math.PI) * 0.15;
      }
    }

    const tailRef = bodySegmentRefs.current[segmentOffsets.length - 1];
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
      mesh.scale.setScalar((isGlow ? 0.70 : 0.35) + life * (isGlow ? 1.0 : 0.55));
      mesh.material.opacity = life * (isGlow ? 0.55 : 0.25);
    }

    // Animate glow worm bioluminescent rings + firefly tail
    if (isGlow) {
      for (let ri = 0; ri < glowRingRefs.current.length; ri++) {
        const ring = glowRingRefs.current[ri];
        if (ring && ring.material) {
          ring.material.opacity = 0.78 + Math.sin(timeRef.current * 3.8 + ri * 1.4) * 0.18;
        }
      }
      const tail = glowTailRef.current;
      if (tail) {
        if (tail.material) tail.material.opacity = 0.72 + Math.sin(timeRef.current * 5.2) * 0.20;
        tail.scale.setScalar(0.85 + Math.sin(timeRef.current * 3.8) * 0.2);
      }
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
        {segmentOffsets.map((zOff, i) => {
          const isHead = i === 0;
          const segScale = isInch
            ? (isHead ? 0.24 : (i === 1 ? 0.17 : 0.15))
            : (isHead ? 0.28 : 0.24 - i * 0.02);
          const segBob = Math.sin(t * 6 + i * 0.8) * 0.02 * Math.min(1, velocity || 0);
          const segColor = isHead ? BODY_COLOR : BELLY_COLOR;
          const stretch = isInch && !isHead ? 1 + Math.sin(t * 8 + i) * 0.24 * Math.min(1, velocity || 0) : 1;

          return (
            <group ref={el => (bodySegmentRefs.current[i] = el)} key={i} position={[0, segBob + bobble, zOff]}>
              <mesh scale={[segScale * breathe * stretch, segScale * breathe * (isBook ? 0.78 : 1), segScale * (isBook ? 1.15 : 1)]}>
                {isBook && !isHead ? <boxGeometry args={[1, 0.8, 1.2]} /> : <sphereGeometry args={[1, 12, 12]} />}
                <meshPhysicalMaterial
                  color={segColor}
                  emissive={segColor}
                  emissiveIntensity={isGlow ? (isHead ? 2.4 : 1.6) : (isHead ? 0.4 : 0.12)}
                  clearcoat={1}
                  clearcoatRoughness={0.1}
                  thickness={0.5}
                  roughness={isBook ? 0.52 : 0.2}
                  metalness={0}
                  transmission={isGlow ? 0 : 0.2}
                  ior={1.45}
                  iridescence={0.16}
                  iridescenceIOR={1.3}
                  transparent={!alive}
                  opacity={opacity}
                />
              </mesh>

              {/* Tiny legs on body segments — inch worm only has prolegs at the very back */}
              {!isHead && !isGlow && !(isInch && i < segmentOffsets.length - 1) && (
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

              {/* Glow ring anchored to this segment so it tracks through turns */}
              {isGlow && !isHead && (
                <mesh ref={el => { glowRingRefs.current[i - 1] = el; }} position={[0, 0, 0]} rotation={[0, 0, 0]} scale={[segScale, segScale, segScale]}>
                  <torusGeometry args={[1.3, 0.12, 8, 24]} />
                  <meshBasicMaterial color={GLOW_COLOR} transparent opacity={0.82} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
                </mesh>
              )}

              {/* ── Head-only: hat, eyes, mouth, glasses, antennae ── */}
              {isHead && (
                <>
                  {/* Hat on top of head */}
                  <group position={[0, segScale, 0]}>
                    <WormHat3D type={wormHatId} scale={segScale} />
                  </group>

                  {/* Eyes — positioned on head sphere surface */}
                  <mesh position={[0.10, 0.10, 0.22]}>
                    <sphereGeometry args={[0.08, 8, 8]} />
                    <meshBasicMaterial color={EYE_WHITE} />
                  </mesh>
                  <mesh position={[-0.10, 0.10, 0.22]}>
                    <sphereGeometry args={[0.08, 8, 8]} />
                    <meshBasicMaterial color={EYE_WHITE} />
                  </mesh>
                  <mesh position={[0.10, 0.10, 0.27]}>
                    <sphereGeometry args={[0.04, 8, 8]} />
                    <meshBasicMaterial color={PUPIL} />
                  </mesh>
                  <mesh position={[-0.10, 0.10, 0.27]}>
                    <sphereGeometry args={[0.04, 8, 8]} />
                    <meshBasicMaterial color={PUPIL} />
                  </mesh>

                  {/* Mouth — 3-dot smile */}
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

                  {/* Book worm glasses */}
                  {isBook && (
                    <>
                      <mesh position={[0.10, 0.10, 0.23]}>
                        <torusGeometry args={[0.063, 0.013, 8, 18]} />
                        <meshStandardMaterial color="#1a1a1a" metalness={0.88} roughness={0.12} />
                      </mesh>
                      <mesh position={[-0.10, 0.10, 0.23]}>
                        <torusGeometry args={[0.063, 0.013, 8, 18]} />
                        <meshStandardMaterial color="#1a1a1a" metalness={0.88} roughness={0.12} />
                      </mesh>
                      <mesh position={[0, 0.10, 0.24]} rotation={[0, Math.PI / 2, 0]}>
                        <capsuleGeometry args={[0.007, 0.074, 4, 4]} />
                        <meshStandardMaterial color="#1a1a1a" metalness={0.88} roughness={0.12} />
                      </mesh>
                    </>
                  )}

                  {/* Classic / Book antennae */}
                  {!isInch && !isGlow && (
                    <>
                      <group position={[0.06, 0.22, 0.15]} rotation={[Math.sin(t * 4) * 0.15, 0, 0.3]}>
                        <mesh>
                          <capsuleGeometry args={[0.015, 0.2, 4, 4]} />
                          <meshStandardMaterial color={ANTENNA_COLOR} emissive={ANTENNA_COLOR} emissiveIntensity={0.3} />
                        </mesh>
                        <mesh position={[0, 0.12, 0]}>
                          <sphereGeometry args={[0.035, 6, 6]} />
                          <meshStandardMaterial color={GLOW_COLOR} emissive={GLOW_COLOR} emissiveIntensity={1} />
                        </mesh>
                      </group>
                      <group position={[-0.06, 0.22, 0.15]} rotation={[Math.sin(t * 4 + 1) * 0.15, 0, -0.3]}>
                        <mesh>
                          <capsuleGeometry args={[0.015, 0.2, 4, 4]} />
                          <meshStandardMaterial color={ANTENNA_COLOR} emissive={ANTENNA_COLOR} emissiveIntensity={0.3} />
                        </mesh>
                        <mesh position={[0, 0.12, 0]}>
                          <sphereGeometry args={[0.035, 6, 6]} />
                          <meshStandardMaterial color={GLOW_COLOR} emissive={GLOW_COLOR} emissiveIntensity={1} />
                        </mesh>
                      </group>
                    </>
                  )}

                  {/* Glow worm bioluminescent tendrils */}
                  {isGlow && (
                    <>
                      <group position={[0.07, 0.26, 0.1]} rotation={[Math.sin(t * 3.0) * 0.25, 0, 0.4]}>
                        <mesh>
                          <capsuleGeometry args={[0.018, 0.3, 4, 4]} />
                          <meshStandardMaterial color={GLOW_COLOR} emissive={GLOW_COLOR} emissiveIntensity={2.0} transparent opacity={0.95} />
                        </mesh>
                        <mesh position={[0, 0.18, 0]}>
                          <sphereGeometry args={[0.065, 8, 8]} />
                          <meshStandardMaterial color={GLOW_COLOR} emissive={GLOW_COLOR} emissiveIntensity={4.0} />
                        </mesh>
                      </group>
                      <group position={[-0.07, 0.26, 0.1]} rotation={[Math.sin(t * 3.0 + 1.2) * 0.25, 0, -0.4]}>
                        <mesh>
                          <capsuleGeometry args={[0.018, 0.3, 4, 4]} />
                          <meshStandardMaterial color={GLOW_COLOR} emissive={GLOW_COLOR} emissiveIntensity={2.0} transparent opacity={0.95} />
                        </mesh>
                        <mesh position={[0, 0.18, 0]}>
                          <sphereGeometry args={[0.065, 8, 8]} />
                          <meshStandardMaterial color={GLOW_COLOR} emissive={GLOW_COLOR} emissiveIntensity={4.0} />
                        </mesh>
                      </group>
                    </>
                  )}
                </>
              )}
            </group>
          );
        })}

        {/* Connector cylinders — bridge gaps between body spheres, making the worm continuous */}
        {segmentOffsets.slice(0, -1).map((_, ci) => {
          // Radius ≈ average of the two adjacent segment scales × 0.92 (slightly narrower than spheres)
          const rA = isInch ? (ci === 0 ? 0.24 : 0.17) : (ci === 0 ? 0.28 : 0.24 - ci * 0.02);
          const rB = isInch ? (ci === 0 ? 0.17 : 0.15) : (0.24 - (ci + 1) * 0.02);
          const r = (rA + rB) * 0.5 * 0.9;
          return (
            <mesh key={`conn-${wormCharacterId}-${ci}`} ref={el => (connectorRefs.current[ci] = el)} scale={[1, 0, 1]}>
              <cylinderGeometry args={[r, r, 1, 10, 1]} />
              <meshPhysicalMaterial
                color={BELLY_COLOR}
                emissive={BELLY_COLOR}
                emissiveIntensity={isGlow ? 1.2 : 0.10}
                clearcoat={0.8}
                clearcoatRoughness={0.15}
                roughness={isBook ? 0.52 : 0.22}
                metalness={0}
                transparent={!alive}
                opacity={opacity}
              />
            </mesh>
          );
        })}

        {/* Book accessory */}
        {isBook && (
          <group position={[0, 0.08, -0.26]} rotation={[0.25, 0.2, 0]}>
            <mesh>
              <boxGeometry args={[0.22, 0.05, 0.32]} />
              <meshStandardMaterial color="#4b2e20" />
            </mesh>
            <mesh position={[0, 0.001, 0]}>
              <boxGeometry args={[0.18, 0.052, 0.28]} />
              <meshStandardMaterial color="#f8f5dd" />
            </mesh>
          </group>
        )}

        {/* Glow worm firefly butt — bright tail light */}
        {isGlow && (
          <mesh ref={glowTailRef} position={[0, 0, segmentOffsets[segmentOffsets.length - 1] - 0.13]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshBasicMaterial color="#ccffaa" transparent opacity={0.88} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        )}

        {/* Glow halo */}
        {alive && (
          <mesh>
            <sphereGeometry args={[isGlow ? 0.82 : 0.45, 16, 16]} />
            <meshBasicMaterial
              color={GLOW_COLOR}
              transparent
              opacity={(isGlow ? 0.36 : 0.12) + Math.sin(t * 4) * (isGlow ? 0.14 : 0.05)}
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
      <pointLight color={GLOW_COLOR} intensity={isGlow ? 3.5 : 0.6} distance={isGlow ? 7.0 : 3} decay={2} />

      {/* Slimy trail — each blob fades out completely after 2 seconds */}
      {Array.from({ length: TRAIL_MAX_POINTS }, (_, i) => (
        <mesh
          key={`trail-${i}`}
          ref={el => (trailRefs.current[i] = el)}
          visible={false}
          renderOrder={5}
        >
          <sphereGeometry args={[0.08, 8, 8]} />
          {isGlow ? (
            // Glow worm keeps its bioluminescent additive bloom trail.
            <meshBasicMaterial
              color={GLOW_COLOR}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          ) : (
            // Everyone else leaves wet, glossy slime droplets.
            <meshStandardMaterial
              color={GLOW_COLOR}
              emissive={GLOW_COLOR}
              emissiveIntensity={0.3}
              roughness={0.1}
              metalness={0}
              transparent
              opacity={0}
              depthWrite={false}
              toneMapped={false}
            />
          )}
        </mesh>
      ))}
    </group>
  );
}

/**
 * Simple orb mesh for platformer mode.
 * isGlowChar: when true (glow worm), shows an expanding color bloom on collect
 *             instead of immediately vanishing.
 */
export function CrawlerOrb({ position, color = '#ffd700', collected, isGlowChar = false }) {
  const meshRef = useRef();
  const bloomRef = useRef();
  const timeRef = useRef(Math.random() * 100);
  const collectTimeRef = useRef(null);
  const [bloomDone, setBloomDone] = useState(false);

  useFrame((_, delta) => {
    timeRef.current += delta;

    // Mark the moment of collection
    if (collected && collectTimeRef.current === null) {
      collectTimeRef.current = 0;
    }
    if (collectTimeRef.current !== null) {
      collectTimeRef.current += delta;
    }

    // Normal idle animation
    if (meshRef.current && !collected) {
      const t = timeRef.current;
      meshRef.current.rotation.y = t * 1.5;
      meshRef.current.position.y = position.y + Math.sin(t * 3) * 0.08;
      meshRef.current.scale.setScalar(1 + Math.sin(t * 4) * 0.1);
    }

    // Glow worm bloom: expands from orb-size to ~3.5 units and fades over 0.45 s
    if (isGlowChar && bloomRef.current && collectTimeRef.current !== null && !bloomDone) {
      const ct = collectTimeRef.current;
      const bloomT = Math.min(1, ct / 0.45);
      bloomRef.current.scale.setScalar(0.3 + bloomT * 3.2);
      bloomRef.current.material.opacity = Math.max(0, 0.65 * (1 - bloomT));
      if (ct >= 0.5) setBloomDone(true);
    }
  });

  // Non-glow: vanish immediately. Glow worm: stay alive until bloom finishes.
  if (collected && (!isGlowChar || bloomDone)) return null;

  const pos = position.toArray ? position.toArray() : position;

  return (
    <group position={pos}>
      {!collected && (
        <>
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
        </>
      )}
      {/* Glow worm: expanding color bloom on pickup */}
      {isGlowChar && !bloomDone && (
        <mesh ref={bloomRef} scale={[0.3, 0.3, 0.3]}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.BackSide}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
}
