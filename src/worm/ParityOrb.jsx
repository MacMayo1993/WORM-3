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
  const orbGroupRef = useRef();
  const coreRef = useRef();
  const shellRef = useRef();
  const glowRef = useRef();
  const targetGlowRef = useRef();
  const orbitSystemRef = useRef();
  const ringARef = useRef();
  const ringBRef = useRef();
  const ringCRef = useRef();
  const electronRefs = useRef([]);
  const timeOffset = useMemo(() => Math.random() * Math.PI * 2, []);

  const color = ORB_COLORS[colorIndex % ORB_COLORS.length];

  useFrame((state) => {
    const core = coreRef.current;
    const orbGroup = orbGroupRef.current;
    if (!core || !orbGroup) return;

    const t = state.clock.elapsedTime + timeOffset;

    // Whole-orb floating motion
    const bobIntensity = isTarget ? 0.13 : 0.06;
    orbGroup.position.y = position[1] + Math.sin(t * 2.1) * bobIntensity;

    // Core quantum-spin wobble
    core.rotation.y = t * (isTarget ? 1.7 : 1.0);
    core.rotation.x = Math.sin(t * 1.4) * 0.2;

    // Pulse for energy breathing
    const pulse = 1 + Math.sin(t * (isTarget ? 5.2 : 3.8)) * (isTarget ? 0.18 : 0.1);
    core.scale.setScalar(pulse);

    // Outer shell subtle counter-spin
    if (shellRef.current) {
      shellRef.current.rotation.y = -t * 0.65;
      shellRef.current.rotation.x = t * 0.35;
      const shellPulse = 1 + Math.sin(t * 2.8) * 0.06;
      shellRef.current.scale.setScalar(shellPulse);
    }

    // Electron orbit system rotates as a whole
    if (orbitSystemRef.current) {
      orbitSystemRef.current.rotation.y = t * (isTarget ? 2.6 : 1.8);
      orbitSystemRef.current.rotation.x = Math.sin(t * 0.8) * 0.65;
      orbitSystemRef.current.rotation.z = Math.cos(t * 0.55) * 0.5;
    }

    // Three intersecting orbit rings
    if (ringARef.current) ringARef.current.rotation.z = t * 1.5;
    if (ringBRef.current) ringBRef.current.rotation.x = t * 1.2;
    if (ringCRef.current) ringCRef.current.rotation.y = t * 1.35;

    // Electron points running on different paths
    electronRefs.current.forEach((el, i) => {
      if (!el) return;
      const radius = isTarget ? 0.43 : 0.36;
      const speed = (isTarget ? 2.4 : 1.8) + i * 0.35;
      const phase = t * speed + i * (Math.PI * 2 / 3);
      if (i === 0) {
        el.position.set(Math.cos(phase) * radius, Math.sin(phase) * radius, 0);
      } else if (i === 1) {
        el.position.set(Math.cos(phase) * radius, 0, Math.sin(phase) * radius);
      } else {
        el.position.set(0, Math.cos(phase) * radius, Math.sin(phase) * radius);
      }
      const ePulse = 1 + Math.sin(t * 8 + i * 2) * 0.18;
      el.scale.setScalar((isTarget ? 1.15 : 1) * ePulse);
    });

    // Global glow pulse
    if (glowRef.current) {
      const baseOpacity = isTarget ? 0.48 : 0.28;
      glowRef.current.material.opacity = baseOpacity + Math.sin(t * 4.5) * 0.14;
      glowRef.current.scale.setScalar(1 + Math.sin(t * 2.7) * 0.08);
    }

    if (targetGlowRef.current && isTarget) {
      targetGlowRef.current.rotation.z = t * 0.9;
      targetGlowRef.current.scale.setScalar(1 + Math.sin(t * 6.5) * 0.2);
      targetGlowRef.current.material.opacity = 0.22 + Math.sin(t * 6.2) * 0.08;
    }
  });

  if (collected) return null;

  const coreRadius = isTarget ? 0.2 : 0.16;
  const orbitRadius = isTarget ? 0.42 : 0.35;

  return (
    <group ref={orbGroupRef} position={[position[0], position[1], position[2]]}>
      {/* Core nucleus */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[coreRadius, 2]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isTarget ? 2.0 : 1.35}
          metalness={0.22}
          roughness={0.15}
        />
      </mesh>

      {/* Energy shell */}
      <mesh ref={shellRef}>
        <sphereGeometry args={[isTarget ? 0.26 : 0.21, 20, 20]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isTarget ? 0.22 : 0.14}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Electron orbital rings + electrons */}
      <group ref={orbitSystemRef}>
        <mesh ref={ringARef} rotation={[0.3, 0.4, 0]}>
          <torusGeometry args={[orbitRadius, isTarget ? 0.01 : 0.008, 8, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.38} depthWrite={false} />
        </mesh>
        <mesh ref={ringBRef} rotation={[-0.6, 0, 0.5]}>
          <torusGeometry args={[orbitRadius * 0.95, isTarget ? 0.01 : 0.008, 8, 48]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.3} depthWrite={false} />
        </mesh>
        <mesh ref={ringCRef} rotation={[0, 0.85, -0.35]}>
          <torusGeometry args={[orbitRadius * 1.05, isTarget ? 0.008 : 0.006, 8, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.26} depthWrite={false} />
        </mesh>

        {Array.from({ length: 3 }, (_, i) => (
          <mesh key={i} ref={(el) => { electronRefs.current[i] = el; }}>
            <sphereGeometry args={[isTarget ? 0.045 : 0.035, 10, 10]} />
            <meshBasicMaterial color="#c6f6ff" transparent opacity={0.92} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        ))}
      </group>

      {/* Outer aura */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[isTarget ? 0.52 : 0.42, 18, 18]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isTarget ? 0.48 : 0.28}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Target lock ring */}
      {isTarget && (
        <mesh ref={targetGlowRef}>
          <torusGeometry args={[0.5, 0.03, 10, 48]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}

      <pointLight
        color={color}
        intensity={isTarget ? 1.1 : 0.65}
        distance={isTarget ? 3.3 : 2.3}
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

// Shared geometry for collect-effect particles (one sphere, used by all instances).
const _collectSphere = new THREE.SphereGeometry(0.08, 8, 8);
// Scratch Object3D for matrix updates.
const _collectDummy = new THREE.Object3D();
const COLLECT_PARTICLE_COUNT = 12;

// Explosion effect when orb is collected
export function OrbCollectEffect({ position, color = '#ffd700' }) {
  const meshRef = useRef();
  const timeRef = useRef(0);

  // Random velocities are stable for the lifetime of this effect.
  const velocities = useMemo(
    () =>
      Array.from({ length: COLLECT_PARTICLE_COUNT }, () => ({
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2,
        z: (Math.random() - 0.5) * 2
      })),
    []
  );

  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    if (!mesh || timeRef.current >= 0.5) return;

    timeRef.current += delta;
    const t = timeRef.current;
    const alpha = Math.max(0, 1 - t * 2);

    for (let i = 0; i < COLLECT_PARTICLE_COUNT; i++) {
      const v = velocities[i];
      _collectDummy.position.set(v.x * t * 3, v.y * t * 3, v.z * t * 3);
      _collectDummy.scale.setScalar(alpha);
      _collectDummy.updateMatrix();
      mesh.setMatrixAt(i, _collectDummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.material.opacity = alpha;
  });

  if (timeRef.current > 0.5) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[_collectSphere, null, COLLECT_PARTICLE_COUNT]}
      position={position}
    >
      <meshBasicMaterial color={color} transparent opacity={1} />
    </instancedMesh>
  );
}
