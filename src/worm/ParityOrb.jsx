// src/worm/ParityOrb.jsx
// Collectible parity orbs with pulsing glow effect
// Supports both surface mode and tunnel mode

import React, { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getSegmentWorldPos, getTunnelWorldPos } from './wormLogic.js';
import { liveRotation } from './liveRotation.js';

// Face-normal directions for bob animation — indexed by dirKey
const BOB_NORMALS = {
  PX: [1, 0, 0], NX: [-1, 0, 0],
  PY: [0, 1, 0], NY: [0, -1, 0],
  PZ: [0, 0, 1], NZ: [0, 0, -1],
};

// World axis vectors matching CubeAssembly — same instances as pre-allocated there,
// but we need our own for applyAxisAngle calls (Three.js doesn't mutate these).
const _worldAxes = {
  col:   new THREE.Vector3(1, 0, 0),
  row:   new THREE.Vector3(0, 1, 0),
  depth: new THREE.Vector3(0, 0, 1),
};

// Scratch vectors used per-frame in the animator (never allocated during render).
const _scratchPos = new THREE.Vector3();
const _scratchBob = new THREE.Vector3();
const _rainbowColor = new THREE.Color();

// ── Shared module-level geometries (M2) ─────────────────────────────────────
// Pre-built once at module load, shared across all SingleOrb instances.
// Using the geometry={} prop (not JSX children) prevents R3F auto-disposal.
const _orbGeos = {
  normal: {
    core:      new THREE.IcosahedronGeometry(0.16, 2),
    shell:     new THREE.SphereGeometry(0.21, 20, 20),
    ringA:     new THREE.TorusGeometry(0.35, 0.008, 8, 32),
    ringB:     new THREE.TorusGeometry(0.35 * 0.95, 0.008, 8, 32),
    ringC:     new THREE.TorusGeometry(0.35 * 1.05, 0.006, 8, 32),
    electron:  new THREE.SphereGeometry(0.035, 10, 10),
    glow:      new THREE.SphereGeometry(0.42, 18, 18),
  },
  target: {
    core:      new THREE.IcosahedronGeometry(0.2, 2),
    shell:     new THREE.SphereGeometry(0.26, 20, 20),
    ringA:     new THREE.TorusGeometry(0.42, 0.01, 8, 32),
    ringB:     new THREE.TorusGeometry(0.42 * 0.95, 0.01, 8, 32),
    ringC:     new THREE.TorusGeometry(0.42 * 1.05, 0.008, 8, 32),
    electron:  new THREE.SphereGeometry(0.045, 10, 10),
    glow:      new THREE.SphereGeometry(0.52, 18, 18),
    lockRing:  new THREE.TorusGeometry(0.5, 0.03, 10, 48),
  },
};

// SingleOrb renders geometry and registers its refs with the parent animator.
// It has NO useFrame — all animation is driven by the single OrbAnimator in ParityOrbs.
function SingleOrb({ position, color = '#ffd700', antipodalColor = '#ffd700', collected = false, isTarget = false, elevated = false, dirKey = 'PY', orbKey, registerAnim, unregisterAnim, gridX = -1, gridY = -1, gridZ = -1 }) {
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
  const outlineRef = useRef();
  const timeOffset = useMemo(() => Math.random() * Math.PI * 2, []);
  // White orbs get a black outline so they're visible; everything else gets white
  const outlineColor = color.toLowerCase() === '#ffffff' ? '#000000' : '#ffffff';

  // Keep mutable refs so the animator always reads current values without causing re-renders
  const isTargetRef = useRef(isTarget);
  isTargetRef.current = isTarget;
  const elevatedRef = useRef(elevated);
  elevatedRef.current = elevated;
  const positionRef = useRef(position);
  positionRef.current = position;
  const dirKeyRef = useRef(dirKey);
  dirKeyRef.current = dirKey;
  const gridXRef = useRef(gridX);
  gridXRef.current = gridX;
  const gridYRef = useRef(gridY);
  gridYRef.current = gridY;
  const gridZRef = useRef(gridZ);
  gridZRef.current = gridZ;

  // Register animation refs with parent on mount, unregister on unmount
  useEffect(() => {
    registerAnim(orbKey, {
      get group() { return orbGroupRef.current; },
      get core() { return coreRef.current; },
      get shell() { return shellRef.current; },
      get glow() { return glowRef.current; },
      get targetGlow() { return targetGlowRef.current; },
      get orbitSystem() { return orbitSystemRef.current; },
      get ringA() { return ringARef.current; },
      get ringB() { return ringBRef.current; },
      get ringC() { return ringCRef.current; },
      get electrons() { return electronRefs.current; },
      get outline() { return outlineRef.current; },
      get isTarget() { return isTargetRef.current; },
      get elevated() { return elevatedRef.current; },
      get position() { return positionRef.current; },
      get dirKey() { return dirKeyRef.current; },
      get gridX() { return gridXRef.current; },
      get gridY() { return gridYRef.current; },
      get gridZ() { return gridZRef.current; },
      timeOffset
    });
    return () => unregisterAnim(orbKey);
  }, [orbKey, timeOffset, registerAnim, unregisterAnim]);

  if (collected) return null;

  const g = isTarget ? _orbGeos.target : _orbGeos.normal;

  return (
    <group ref={orbGroupRef} position={[position[0], position[1], position[2]]}>
      {/* Core outline — back-face scale trick; black for white orbs, white for everything else */}
      <mesh ref={outlineRef} geometry={g.core}>
        <meshBasicMaterial color={outlineColor} side={THREE.BackSide} />
      </mesh>

      {/* Core nucleus */}
      <mesh ref={coreRef} geometry={g.core}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isTarget ? 2.0 : 1.35}
          metalness={0.22}
          roughness={0.15}
        />
      </mesh>

      {/* Energy shell */}
      <mesh ref={shellRef} geometry={g.shell}>
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
        <mesh ref={ringARef} geometry={g.ringA} rotation={[0.3, 0.4, 0]}>
          <meshBasicMaterial color={color} transparent opacity={0.38} depthWrite={false} />
        </mesh>
        <mesh ref={ringBRef} geometry={g.ringB} rotation={[-0.6, 0, 0.5]}>
          <meshBasicMaterial color={antipodalColor} transparent opacity={0.3} depthWrite={false} />
        </mesh>
        <mesh ref={ringCRef} geometry={g.ringC} rotation={[0, 0.85, -0.35]}>
          <meshBasicMaterial color={color} transparent opacity={0.26} depthWrite={false} />
        </mesh>

        {Array.from({ length: 3 }, (_, i) => (
          <mesh key={i} geometry={g.electron} ref={(el) => { electronRefs.current[i] = el; }}>
            <meshBasicMaterial color="#c6f6ff" transparent opacity={0.92} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        ))}
      </group>

      {/* Outer aura — antipodal color flags the manifold pair */}
      <mesh ref={glowRef} geometry={g.glow}>
        <meshBasicMaterial
          color={antipodalColor}
          transparent
          opacity={isTarget ? 0.48 : 0.28}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Target lock ring */}
      {isTarget && (
        <mesh ref={targetGlowRef} geometry={g.lockRing}>
          <meshBasicMaterial color="#ffffff" transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}

      {/* Point light only on the target orb — 15 point lights was a significant GPU cost */}
      {isTarget && (
        <pointLight color={color} intensity={1.1} distance={3.3} decay={2} />
      )}
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

  // Single animation registry — all orb refs stored here, driven by one useFrame
  const animMapRef = useRef(new Map());

  const registerAnim = useCallback((key, refs) => { animMapRef.current.set(key, refs); }, []);
  const unregisterAnim = useCallback((key) => { animMapRef.current.delete(key); }, []);

  // Single useFrame drives ALL orb animations — replaces N individual useFrame callbacks
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (const refs of animMapRef.current.values()) {
      const { group, core, shell, glow, targetGlow, orbitSystem, ringA, ringB, ringC, electrons, outline, isTarget, position, dirKey, gridX, gridY, gridZ, timeOffset } = refs;
      if (!group || !core) continue;
      const time = t + timeOffset;

      // Whole-orb position — apply live slice rotation when this orb is on the moving slice
      const bn = BOB_NORMALS[dirKey] || BOB_NORMALS.PY;
      let px = position[0], py = position[1], pz = position[2];
      let bnx = bn[0], bny = bn[1], bnz = bn[2];

      if (liveRotation.active && gridX >= 0) {
        const lr = liveRotation;
        const inSlice =
          (lr.axis === 'col'   && gridX === lr.sliceIndex) ||
          (lr.axis === 'row'   && gridY === lr.sliceIndex) ||
          (lr.axis === 'depth' && gridZ === lr.sliceIndex);
        if (inSlice) {
          const worldAxis = _worldAxes[lr.axis];
          _scratchPos.set(px, py, pz).applyAxisAngle(worldAxis, lr.angle);
          px = _scratchPos.x; py = _scratchPos.y; pz = _scratchPos.z;
          _scratchBob.set(bnx, bny, bnz).applyAxisAngle(worldAxis, lr.angle);
          bnx = _scratchBob.x; bny = _scratchBob.y; bnz = _scratchBob.z;
        }
      }

      const _bob = Math.sin(time * 2.1) * (isTarget ? 0.13 : 0.06);
      group.position.set(px + bnx * _bob, py + bny * _bob, pz + bnz * _bob);

      // Core quantum-spin wobble
      core.rotation.y = time * (isTarget ? 1.7 : 1.0);
      core.rotation.x = Math.sin(time * 1.4) * 0.2;
      core.scale.setScalar(1 + Math.sin(time * (isTarget ? 5.2 : 3.8)) * (isTarget ? 0.18 : 0.1));

      // Outline tracks core scale, slightly larger for the rim
      if (outline) {
        outline.rotation.y = core.rotation.y;
        outline.rotation.x = core.rotation.x;
        outline.scale.setScalar(core.scale.x * 1.2);
      }

      // Shell counter-spin
      if (shell) {
        shell.rotation.y = -time * 0.65;
        shell.rotation.x = time * 0.35;
        shell.scale.setScalar(1 + Math.sin(time * 2.8) * 0.06);
      }

      // Orbit system rotation
      if (orbitSystem) {
        orbitSystem.rotation.y = time * (isTarget ? 2.6 : 1.8);
        orbitSystem.rotation.x = Math.sin(time * 0.8) * 0.65;
        orbitSystem.rotation.z = Math.cos(time * 0.55) * 0.5;
      }

      // Ring rotations
      if (ringA) ringA.rotation.z = time * 1.5;
      if (ringB) ringB.rotation.x = time * 1.2;
      if (ringC) ringC.rotation.y = time * 1.35;

      // Electron orbital paths
      const elRadius = isTarget ? 0.43 : 0.36;
      const elBaseSpeed = isTarget ? 2.4 : 1.8;
      for (let i = 0; i < electrons.length; i++) {
        const el = electrons[i];
        if (!el) continue;
        const phase = time * (elBaseSpeed + i * 0.35) + i * (Math.PI * 2 / 3);
        if (i === 0) el.position.set(Math.cos(phase) * elRadius, Math.sin(phase) * elRadius, 0);
        else if (i === 1) el.position.set(Math.cos(phase) * elRadius, 0, Math.sin(phase) * elRadius);
        else el.position.set(0, Math.cos(phase) * elRadius, Math.sin(phase) * elRadius);
        el.scale.setScalar((isTarget ? 1.15 : 1) * (1 + Math.sin(time * 8 + i * 2) * 0.18));
      }

      // Outer aura pulse
      if (glow) {
        glow.material.opacity = (isTarget ? 0.48 : 0.28) + Math.sin(time * 4.5) * 0.14;
        glow.scale.setScalar(1 + Math.sin(time * 2.7) * 0.08);
      }

      // Rainbow pulse for elevated orbs (on flipped tiles)
      const { elevated } = refs;
      if (elevated) {
        const hue = (time * 0.3) % 1; // full cycle every ~3.3 s
        _rainbowColor.setHSL(hue, 1.0, 0.62);
        if (core && core.material) {
          core.material.color.copy(_rainbowColor);
          core.material.emissive.copy(_rainbowColor);
        }
        if (shell && shell.material) shell.material.color.copy(_rainbowColor);
        _rainbowColor.setHSL((hue + 0.33) % 1, 1.0, 0.62);
        if (ringA && ringA.material) ringA.material.color.copy(_rainbowColor);
        _rainbowColor.setHSL((hue + 0.67) % 1, 1.0, 0.62);
        if (ringB && ringB.material) ringB.material.color.copy(_rainbowColor);
        _rainbowColor.setHSL(hue, 1.0, 0.62);
        if (ringC && ringC.material) ringC.material.color.copy(_rainbowColor);
        for (let i = 0; i < electrons.length; i++) {
          const el = electrons[i];
          if (el && el.material) {
            _rainbowColor.setHSL((hue + i * 0.33) % 1, 1.0, 0.75);
            el.material.color.copy(_rainbowColor);
          }
        }
        if (glow && glow.material) {
          _rainbowColor.setHSL((hue + 0.5) % 1, 1.0, 0.65);
          glow.material.color.copy(_rainbowColor);
        }
      }

      // Target lock ring
      if (targetGlow && isTarget) {
        targetGlow.rotation.z = time * 0.9;
        targetGlow.scale.setScalar(1 + Math.sin(time * 6.5) * 0.2);
        targetGlow.material.opacity = 0.22 + Math.sin(time * 6.2) * 0.08;
      }
    }
  });

  // Calculate world positions for all orbs
  const orbData = useMemo(() => {
    return orbs.map((orb) => {
      let position;
      let key;

      if (isTunnelMode && orb.tunnel) {
        position = getTunnelWorldPos(orb.tunnel, orb.t, size, explosionFactor);
        key = `${orb.tunnelId}-${orb.t}`;
      } else {
        position = getSegmentWorldPos(orb, size, explosionFactor);
        // Elevated orbs (on flipped tiles) hover well above the surface so the worm must jump to collect them
        if (orb.elevated) {
          const bn = BOB_NORMALS[orb.dirKey] || BOB_NORMALS.PY;
          const ELEVATED_HOVER = 1.2;
          position = [position[0] + bn[0] * ELEVATED_HOVER, position[1] + bn[1] * ELEVATED_HOVER, position[2] + bn[2] * ELEVATED_HOVER];
        }
        key = `${orb.x}-${orb.y}-${orb.z}-${orb.dirKey}`;
      }

      return {
        position,
        color: orb.color || '#ffd700',
        antipodalColor: orb.antipodalColor || orb.color || '#ffd700',
        dirKey: orb.dirKey || 'PY',
        key,
        isTarget: isTunnelMode && orb.tunnelId === targetTunnelId,
        elevated: orb.elevated || false,
        gridX: orb.x ?? -1,
        gridY: orb.y ?? -1,
        gridZ: orb.z ?? -1,
      };
    });
  }, [orbs, size, explosionFactor, isTunnelMode, targetTunnelId]);

  return (
    <group>
      {orbData.map((data) => (
        <SingleOrb
          key={data.key}
          orbKey={data.key}
          position={data.position}
          color={data.color}
          antipodalColor={data.antipodalColor}
          dirKey={data.dirKey}
          isTarget={data.isTarget}
          elevated={data.elevated}
          gridX={data.gridX}
          gridY={data.gridY}
          gridZ={data.gridZ}
          registerAnim={registerAnim}
          unregisterAnim={unregisterAnim}
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
