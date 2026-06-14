// src/worm/ParityOrb.jsx
// Collectible parity orbs — crystal-core visual design with inner plasma,
// dual-layer aura, electron halos, and type-system foundation for power-ups.

import React, { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getSegmentWorldPos, getTunnelWorldPosInto } from './wormLogic.js';
import { liveCubies } from './liveCubies.js';
import { SURFACE_OFFSET } from '../utils/constants.js';

const BOB_NORMALS = {
  PX: [1, 0, 0], NX: [-1, 0, 0],
  PY: [0, 1, 0], NY: [0, -1, 0],
  PZ: [0, 0, 1], NZ: [0, 0, -1],
};

// Scratch vectors — never allocated during render
const _scratchPos = new THREE.Vector3();
const _scratchBob = new THREE.Vector3();
const _rainbowColor = new THREE.Color();
const _tunnelOrbScratch = new THREE.Vector3();

// ── Orb type definitions — foundation for power-up variants ─────────────────
// 'parity' is the standard collectible. Reserved slots for future power-ups.
export const ORB_TYPES = {
  parity: { electronColor: '#c6f6ff', electronEmissive: '#80e8ff', glowBoost: 1.0 },
  speed:  { electronColor: '#ffcc44', electronEmissive: '#ff9900', glowBoost: 1.3 },
  shield: { electronColor: '#88ccff', electronEmissive: '#4499ee', glowBoost: 0.8 },
  magnet: { electronColor: '#ffdd88', electronEmissive: '#ffaa00', glowBoost: 1.5 },
};

// ── Shared module-level geometries (M2) ─────────────────────────────────────
// Pre-built once, shared across all instances.  geometry={} prop prevents disposal.
const _orbGeos = {
  normal: {
    core:         new THREE.OctahedronGeometry(0.16, 1),           // crystal-faceted nucleus
    innerCore:    new THREE.SphereGeometry(0.075, 8, 8),           // hot plasma center
    shell:        new THREE.SphereGeometry(0.22, 20, 20),
    innerGlow:    new THREE.SphereGeometry(0.30, 12, 12),          // tight inner aura
    ringA:        new THREE.TorusGeometry(0.350, 0.012, 8, 32),    // thicker rings
    ringB:        new THREE.TorusGeometry(0.350 * 0.95, 0.010, 8, 32),
    ringC:        new THREE.TorusGeometry(0.350 * 1.05, 0.008, 8, 32),
    electron:     new THREE.SphereGeometry(0.042, 10, 10),
    electronGlow: new THREE.SphereGeometry(0.072, 6, 6),           // electron halo
    glow:         new THREE.SphereGeometry(0.50, 16, 16),          // larger outer aura
  },
  target: {
    core:         new THREE.OctahedronGeometry(0.20, 1),
    innerCore:    new THREE.SphereGeometry(0.092, 8, 8),
    shell:        new THREE.SphereGeometry(0.27, 20, 20),
    innerGlow:    new THREE.SphereGeometry(0.37, 12, 12),
    ringA:        new THREE.TorusGeometry(0.420, 0.015, 8, 32),
    ringB:        new THREE.TorusGeometry(0.420 * 0.95, 0.012, 8, 32),
    ringC:        new THREE.TorusGeometry(0.420 * 1.05, 0.010, 8, 32),
    electron:     new THREE.SphereGeometry(0.052, 10, 10),
    electronGlow: new THREE.SphereGeometry(0.088, 6, 6),
    glow:         new THREE.SphereGeometry(0.60, 16, 16),
    lockRing:     new THREE.TorusGeometry(0.5, 0.03, 10, 48),
  },
};

// SingleOrb renders geometry and registers refs with the parent OrbAnimator.
// NO useFrame here — all animation driven by the single loop in ParityOrbs.
function SingleOrb({
  position, color = '#ffd700', antipodalColor = '#ffd700',
  collected = false, isTarget = false, elevated = false,
  dirKey = 'PY', orbKey, type = 'parity',
  registerAnim, unregisterAnim,
  gridX = -1, gridY = -1, gridZ = -1, isGlowWorm = false,
}) {
  const orbGroupRef    = useRef();
  const coreRef        = useRef();
  const innerCoreRef   = useRef();
  const shellRef       = useRef();
  const innerGlowRef   = useRef();
  const glowRef        = useRef();
  const targetGlowRef  = useRef();
  const orbitSystemRef = useRef();
  const ringARef       = useRef();
  const ringBRef       = useRef();
  const ringCRef       = useRef();
  const electronRefs     = useRef([]);
  const electronGlowRefs = useRef([]);
  const outlineRef     = useRef();

  const timeOffset = useMemo(() => Math.random() * Math.PI * 2, []);

  // Mutable refs so the animator always reads current values without causing re-renders
  const isTargetRef   = useRef(isTarget);   isTargetRef.current   = isTarget;
  const elevatedRef   = useRef(elevated);   elevatedRef.current   = elevated;
  const positionRef   = useRef(position);   positionRef.current   = position;
  const dirKeyRef     = useRef(dirKey);     dirKeyRef.current     = dirKey;
  const gridXRef      = useRef(gridX);      gridXRef.current      = gridX;
  const gridYRef      = useRef(gridY);      gridYRef.current      = gridY;
  const gridZRef      = useRef(gridZ);      gridZRef.current      = gridZ;
  const isGlowWormRef = useRef(isGlowWorm); isGlowWormRef.current = isGlowWorm;
  const typeRef       = useRef(type);       typeRef.current       = type;

  useEffect(() => {
    registerAnim(orbKey, {
      get group()         { return orbGroupRef.current; },
      get core()          { return coreRef.current; },
      get innerCore()     { return innerCoreRef.current; },
      get shell()         { return shellRef.current; },
      get innerGlow()     { return innerGlowRef.current; },
      get glow()          { return glowRef.current; },
      get targetGlow()    { return targetGlowRef.current; },
      get orbitSystem()   { return orbitSystemRef.current; },
      get ringA()         { return ringARef.current; },
      get ringB()         { return ringBRef.current; },
      get ringC()         { return ringCRef.current; },
      get electrons()     { return electronRefs.current; },
      get electronGlows() { return electronGlowRefs.current; },
      get outline()       { return outlineRef.current; },
      get isTarget()      { return isTargetRef.current; },
      get elevated()      { return elevatedRef.current; },
      get position()      { return positionRef.current; },
      get dirKey()        { return dirKeyRef.current; },
      get gridX()         { return gridXRef.current; },
      get gridY()         { return gridYRef.current; },
      get gridZ()         { return gridZRef.current; },
      get isGlowWorm()    { return isGlowWormRef.current; },
      get type()          { return typeRef.current; },
      timeOffset,
    });
    return () => unregisterAnim(orbKey);
  }, [orbKey, timeOffset, registerAnim, unregisterAnim]);

  if (collected) return null;

  const g = isTarget ? _orbGeos.target : _orbGeos.normal;
  const typeConfig = ORB_TYPES[type] || ORB_TYPES.parity;

  return (
    <group ref={orbGroupRef} position={[position[0], position[1], position[2]]}>

      {/* Crystal core outline — back-face scale trick */}
      <mesh ref={outlineRef} geometry={g.core}>
        <meshBasicMaterial color="#000000" side={THREE.BackSide} />
      </mesh>

      {/* Crystal nucleus — OctahedronGeometry for faceted gem look */}
      <mesh ref={coreRef} geometry={g.core}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isTarget ? 2.0 : 1.4}
          metalness={0.35}
          roughness={0.10}
        />
      </mesh>

      {/* Inner plasma core — bright hot center, counter-spins vs crystal */}
      <mesh ref={innerCoreRef} geometry={g.innerCore}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.92}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Energy shell — outer transparent envelope */}
      <mesh ref={shellRef} geometry={g.shell}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isTarget ? 0.22 : 0.14}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Inner tight aura — main color, close-in glow halo */}
      <mesh ref={innerGlowRef} geometry={g.innerGlow}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isTarget ? 0.28 : 0.18}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Electron orbital rings + electrons */}
      <group ref={orbitSystemRef}>
        <mesh ref={ringARef} geometry={g.ringA} rotation={[0.3, 0.4, 0]}>
          <meshBasicMaterial color={color} transparent opacity={0.42} depthWrite={false} />
        </mesh>
        <mesh ref={ringBRef} geometry={g.ringB} rotation={[-0.6, 0, 0.5]}>
          <meshBasicMaterial color={antipodalColor} transparent opacity={0.34} depthWrite={false} />
        </mesh>
        <mesh ref={ringCRef} geometry={g.ringC} rotation={[0, 0.85, -0.35]}>
          <meshBasicMaterial color={color} transparent opacity={0.28} depthWrite={false} />
        </mesh>

        {/* Electrons with glow halos */}
        {Array.from({ length: 3 }, (_, i) => (
          <React.Fragment key={i}>
            <mesh ref={(el) => { electronRefs.current[i] = el; }} geometry={g.electron}>
              <meshStandardMaterial
                color={typeConfig.electronColor}
                emissive={typeConfig.electronEmissive}
                emissiveIntensity={1.6}
                metalness={0}
                roughness={0}
              />
            </mesh>
            <mesh ref={(el) => { electronGlowRefs.current[i] = el; }} geometry={g.electronGlow}>
              <meshBasicMaterial
                color={typeConfig.electronColor}
                transparent
                opacity={0.45}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          </React.Fragment>
        ))}
      </group>

      {/* Outer aura — antipodal color flags the manifold pair */}
      <mesh ref={glowRef} geometry={g.glow}>
        <meshBasicMaterial
          color={antipodalColor}
          transparent
          opacity={isTarget ? 0.50 : 0.30}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Target lock ring */}
      {isTarget && (
        <mesh ref={targetGlowRef} geometry={_orbGeos.target.lockRing}>
          <meshBasicMaterial color="#ffffff" transparent opacity={0.30} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}

      {/* Point light — full intensity on target, subtle ambient on all orbs */}
      <pointLight
        color={color}
        intensity={isTarget ? 1.1 : 0.22}
        distance={isTarget ? 3.3 : 1.8}
        decay={2}
      />
    </group>
  );
}

/**
 * ParityOrbs — renders all active orbs and drives their animation via a single useFrame.
 *
 * @param {Array}  props.orbs            - Orb data (surface or tunnel)
 * @param {number} props.size            - Cube size
 * @param {number} props.explosionFactor - Explosion animation factor
 * @param {string} props.mode            - 'surface' | 'tunnel'
 * @param {string} props.targetTunnelId  - Tunnel to highlight
 * @param {boolean} props.isGlowWorm     - Glow worm visual mode
 */
export default function ParityOrbs({
  orbs, size, explosionFactor = 0,
  mode = 'surface', targetTunnelId = null, isGlowWorm = false,
}) {
  const isTunnelMode = mode === 'tunnel';

  const animMapRef = useRef(new Map());
  const registerAnim   = useCallback((key, refs) => { animMapRef.current.set(key, refs); }, []);
  const unregisterAnim = useCallback((key) => { animMapRef.current.delete(key); }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    for (const refs of animMapRef.current.values()) {
      const {
        group, core, innerCore, innerGlow, shell, glow, targetGlow,
        orbitSystem, ringA, ringB, ringC,
        electrons, electronGlows, outline,
        isTarget, position, dirKey, gridX, gridY, gridZ, timeOffset,
      } = refs;
      if (!group || !core) continue;
      const time = t + timeOffset;

      // ── World position — glued to live cubie transform ─────────────────────
      const bn = BOB_NORMALS[dirKey] || BOB_NORMALS.PY;
      const { elevated } = refs;
      const lSize = liveCubies.size;
      const cubie = (gridX >= 0 && liveCubies.refs && lSize > 0)
        ? liveCubies.refs[gridX * lSize * lSize + gridY * lSize + gridZ]
        : null;

      if (cubie) {
        _scratchBob.set(bn[0], bn[1], bn[2]).applyQuaternion(cubie.quaternion);
        _scratchPos.copy(cubie.position).addScaledVector(_scratchBob, SURFACE_OFFSET);
        if (elevated) _scratchPos.addScaledVector(_scratchBob, 1.2);
        const bobAmt = Math.sin(time * 2.1) * (isTarget ? 0.13 : 0.06);
        _scratchPos.addScaledVector(_scratchBob, bobAmt);
        group.position.copy(_scratchPos);
      } else {
        const _bob = Math.sin(time * 2.1) * (isTarget ? 0.13 : 0.06);
        group.position.set(
          position[0] + bn[0] * _bob,
          position[1] + bn[1] * _bob,
          position[2] + bn[2] * _bob
        );
      }

      // ── Crystal core spin ──────────────────────────────────────────────────
      core.rotation.y = time * (isTarget ? 1.7 : 1.0);
      core.rotation.x = Math.sin(time * 1.4) * 0.2;
      core.scale.setScalar(1 + Math.sin(time * (isTarget ? 5.2 : 3.8)) * (isTarget ? 0.18 : 0.10));

      if (outline) {
        outline.rotation.y = core.rotation.y;
        outline.rotation.x = core.rotation.x;
        outline.scale.setScalar(core.scale.x * 1.22);
      }

      // ── Inner plasma core — counter-spins for parallax depth ──────────────
      if (innerCore) {
        innerCore.rotation.y = -time * 2.5;
        innerCore.rotation.z =  time * 1.8;
        innerCore.scale.setScalar(1 + Math.sin(time * 6.0) * 0.30);
      }

      // ── Energy shell ───────────────────────────────────────────────────────
      if (shell) {
        shell.rotation.y = -time * 0.65;
        shell.rotation.x =  time * 0.35;
        shell.scale.setScalar(1 + Math.sin(time * 2.8) * 0.06);
      }

      // ── Inner glow — pulses offset from outer glow ─────────────────────────
      if (innerGlow) {
        innerGlow.material.opacity = (isTarget ? 0.28 : 0.18) + Math.sin(time * 3.8 + 1.2) * 0.07;
        innerGlow.scale.setScalar(1 + Math.sin(time * 3.2) * 0.05);
      }

      // ── Orbit system ───────────────────────────────────────────────────────
      if (orbitSystem) {
        orbitSystem.rotation.y = time * (isTarget ? 2.6 : 1.8);
        orbitSystem.rotation.x = Math.sin(time * 0.8) * 0.65;
        orbitSystem.rotation.z = Math.cos(time * 0.55) * 0.5;
      }

      if (ringA) ringA.rotation.z = time * 1.5;
      if (ringB) ringB.rotation.x = time * 1.2;
      if (ringC) ringC.rotation.y = time * 1.35;

      // ── Electrons + halos ──────────────────────────────────────────────────
      const elRadius    = isTarget ? 0.43 : 0.36;
      const elBaseSpeed = isTarget ? 2.4  : 1.8;
      for (let i = 0; i < electrons.length; i++) {
        const el = electrons[i];
        if (!el) continue;
        const phase = time * (elBaseSpeed + i * 0.35) + i * (Math.PI * 2 / 3);
        if      (i === 0) el.position.set(Math.cos(phase) * elRadius, Math.sin(phase) * elRadius, 0);
        else if (i === 1) el.position.set(Math.cos(phase) * elRadius, 0, Math.sin(phase) * elRadius);
        else              el.position.set(0, Math.cos(phase) * elRadius, Math.sin(phase) * elRadius);
        const elScale = (isTarget ? 1.15 : 1) * (1 + Math.sin(time * 8 + i * 2) * 0.18);
        el.scale.setScalar(elScale);

        const elGlow = electronGlows[i];
        if (elGlow) {
          elGlow.position.copy(el.position);
          elGlow.scale.setScalar(elScale * 1.6);
        }
      }

      // ── Outer aura pulse ───────────────────────────────────────────────────
      const { type } = refs;
      const glowBoost = (ORB_TYPES[type] || ORB_TYPES.parity).glowBoost;
      if (glow) {
        glow.material.opacity = ((isTarget ? 0.50 : 0.30) + Math.sin(time * 4.5) * 0.14) * glowBoost;
        glow.scale.setScalar(1 + Math.sin(time * 2.7) * 0.08);
      }

      // ── Glow worm emissive pulse ───────────────────────────────────────────
      const { isGlowWorm } = refs;
      if (isGlowWorm && core.material && !elevated) {
        const baseI = isTarget ? 2.0 : 1.4;
        core.material.emissiveIntensity = baseI + Math.sin(t * 4.0) * 0.9;
        if (glow) glow.material.opacity = (isTarget ? 0.65 : 0.50) + Math.sin(t * 4.0) * 0.22;
      }

      // ── Rainbow cycle for elevated (flipped-tile) orbs ────────────────────
      if (elevated) {
        const hue = (time * 0.3) % 1;
        _rainbowColor.setHSL(hue, 1.0, 0.62);
        if (core.material) {
          core.material.color.copy(_rainbowColor);
          core.material.emissive.copy(_rainbowColor);
        }
        if (innerCore && innerCore.material) innerCore.material.color.copy(_rainbowColor);
        if (shell && shell.material) shell.material.color.copy(_rainbowColor);
        if (innerGlow && innerGlow.material) {
          _rainbowColor.setHSL((hue + 0.15) % 1, 1.0, 0.70);
          innerGlow.material.color.copy(_rainbowColor);
        }
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
            el.material.emissive?.copy(_rainbowColor);
            el.material.color.copy(_rainbowColor);
          }
          const elGlow = electronGlows[i];
          if (elGlow && elGlow.material) {
            _rainbowColor.setHSL((hue + i * 0.33) % 1, 1.0, 0.75);
            elGlow.material.color.copy(_rainbowColor);
          }
        }
        if (glow && glow.material) {
          _rainbowColor.setHSL((hue + 0.5) % 1, 1.0, 0.65);
          glow.material.color.copy(_rainbowColor);
        }
      }

      // ── Target lock ring ───────────────────────────────────────────────────
      if (targetGlow && isTarget) {
        targetGlow.rotation.z = time * 0.9;
        targetGlow.scale.setScalar(1 + Math.sin(time * 6.5) * 0.2);
        targetGlow.material.opacity = 0.22 + Math.sin(time * 6.2) * 0.08;
      }
    }
  });

  const orbData = useMemo(() => {
    return orbs.map((orb) => {
      let position;
      let key;

      if (isTunnelMode && orb.tunnel) {
        getTunnelWorldPosInto(_tunnelOrbScratch, orb.tunnel, orb.t, size, explosionFactor);
        position = [_tunnelOrbScratch.x, _tunnelOrbScratch.y, _tunnelOrbScratch.z];
        key = `${orb.tunnelId}-${orb.t}`;
      } else {
        position = getSegmentWorldPos(orb, size, explosionFactor);
        if (orb.elevated) {
          const bn = BOB_NORMALS[orb.dirKey] || BOB_NORMALS.PY;
          const ELEVATED_HOVER = 1.2;
          position = [
            position[0] + bn[0] * ELEVATED_HOVER,
            position[1] + bn[1] * ELEVATED_HOVER,
            position[2] + bn[2] * ELEVATED_HOVER,
          ];
        }
        key = `${orb.x}-${orb.y}-${orb.z}-${orb.dirKey}`;
      }

      return {
        position,
        color:          orb.color          || '#ffd700',
        antipodalColor: orb.antipodalColor || orb.color || '#ffd700',
        dirKey:         orb.dirKey         || 'PY',
        type:           orb.type           || 'parity',
        key,
        isTarget:  isTunnelMode && orb.tunnelId === targetTunnelId,
        elevated:  orb.elevated || false,
        gridX:     orb.x  ?? -1,
        gridY:     orb.y  ?? -1,
        gridZ:     orb.z  ?? -1,
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
          type={data.type}
          isTarget={data.isTarget}
          elevated={data.elevated}
          gridX={data.gridX}
          gridY={data.gridY}
          gridZ={data.gridZ}
          isGlowWorm={isGlowWorm}
          registerAnim={registerAnim}
          unregisterAnim={unregisterAnim}
        />
      ))}
    </group>
  );
}

// ── Collect effect ───────────────────────────────────────────────────────────
const _collectSphere = new THREE.SphereGeometry(0.08, 8, 8);
const _collectDummy  = new THREE.Object3D();
const COLLECT_PARTICLE_COUNT = 12;

export function OrbCollectEffect({ position, color = '#ffd700', onDone }) {
  const meshRef  = useRef();
  const bloomRef = useRef();
  const timeRef  = useRef(0);
  const calledDoneRef = useRef(false);

  const velocities = useMemo(
    () => Array.from({ length: COLLECT_PARTICLE_COUNT }, () => ({
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: (Math.random() - 0.5) * 2,
    })),
    []
  );

  useFrame((_state, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;

    const mesh = meshRef.current;
    if (mesh && t < 0.5) {
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
    }

    if (bloomRef.current) {
      const bloomT = Math.min(1, t / 0.45);
      bloomRef.current.scale.setScalar(0.3 + bloomT * 3.2);
      bloomRef.current.material.opacity = Math.max(0, 0.65 * (1 - bloomT));
    }

    if (t >= 0.5 && !calledDoneRef.current) {
      calledDoneRef.current = true;
      onDone?.();
    }
  });

  return (
    <group position={position}>
      <instancedMesh ref={meshRef} args={[_collectSphere, null, COLLECT_PARTICLE_COUNT]}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
      <mesh ref={bloomRef} scale={[0.3, 0.3, 0.3]}>
        <sphereGeometry args={[1, 14, 14]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
