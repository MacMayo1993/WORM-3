// src/worm/ParityOrb.jsx
// Collectible parity orbs — crystal-core visual design with inner plasma,
// dual-layer aura, electron halos, and type-system foundation for power-ups.

import React, { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getSegmentWorldPos, getTunnelWorldPosInto } from './wormLogic.js';
import { liveCubies } from './liveCubies.js';
import { SURFACE_OFFSET } from '../utils/constants.js';

// Orbs float this far above the tile surface so they're visible from any angle
const HOVER_ABOVE = 0.28;

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

// ── Möbius strip geometry factory ───────────────────────────────────────────
// Creates a mathematically correct Möbius strip: a band that makes one 180°
// half-twist as it loops around. The last ring reconnects to the first ring
// with vertices flipped top-to-bottom — that's the defining Möbius closure.
function _mkMobius(R, w) {
  const uS = 48, vS = 3, cols = vS + 1;
  const pos = [], uvs = [], idx = [];
  for (let i = 0; i <= uS; i++) {
    const u = (i / uS) * Math.PI * 2;
    for (let j = 0; j <= vS; j++) {
      const v = (j / vS) * 2 - 1;
      pos.push(
        (R + w * v * Math.cos(u * 0.5)) * Math.cos(u),
        (R + w * v * Math.cos(u * 0.5)) * Math.sin(u),
        w * v * Math.sin(u * 0.5)
      );
      uvs.push(i / uS, j / vS);
    }
  }
  for (let i = 0; i < uS; i++) {
    for (let j = 0; j < vS; j++) {
      const a = i * cols + j, b = i * cols + j + 1;
      const last = i === uS - 1;
      const c = last ? vS - j     : (i + 1) * cols + j;
      const d = last ? vS - j - 1 : (i + 1) * cols + j + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ── Shared module-level geometries (M2) ─────────────────────────────────────
// Pre-built once, shared across all instances.  geometry={} prop prevents disposal.
const _orbGeos = {
  normal: {
    shell:        new THREE.SphereGeometry(0.21, 32, 32),          // smooth glassy, iridescent gem shell
    innerCore:    new THREE.SphereGeometry(0.115, 20, 20),         // bright energy core seen through the shell
    innerGlow:    new THREE.SphereGeometry(0.30, 24, 18),          // soft additive inner halo (smooth, not faceted)
    core:         _mkMobius(0.24, 0.08),                           // Möbius strip — smaller accent ring, antipodal color
    ringA:        new THREE.TorusGeometry(0.370, 0.011, 6, 18),    // orbit rings sit just outside the strip
    ringB:        new THREE.TorusGeometry(0.370 * 0.92, 0.009, 6, 18),
    electron:     new THREE.SphereGeometry(0.042, 7, 7),
    glow:         new THREE.SphereGeometry(0.52, 40, 28),          // outer ambient aura — smooth round glow (was octagonal at 8 segs)
    parityCage:   new THREE.OctahedronGeometry(0.31, 0),           // unmistakable diamond frame around the round gem
    parityNode:   new THREE.SphereGeometry(0.055, 12, 10),         // antipodal pair at opposite cage poles
    parityAxis:   new THREE.CylinderGeometry(0.012, 0.012, 0.54, 8),
  },
  target: {
    shell:        new THREE.SphereGeometry(0.27, 36, 36),          // larger smooth gem for target
    innerCore:    new THREE.SphereGeometry(0.15, 24, 24),
    innerGlow:    new THREE.SphereGeometry(0.40, 24, 18),
    core:         _mkMobius(0.30, 0.10),                           // Möbius strip, antipodal color
    ringA:        new THREE.TorusGeometry(0.460, 0.015, 8, 24),
    ringB:        new THREE.TorusGeometry(0.460 * 0.92, 0.012, 8, 24),
    ringC:        new THREE.TorusGeometry(0.460 * 1.08, 0.010, 8, 24),
    electron:     new THREE.SphereGeometry(0.052, 8, 8),
    electronGlow: new THREE.SphereGeometry(0.088, 6, 6),
    glow:         new THREE.SphereGeometry(0.66, 40, 28),          // outer ambient aura — smooth round glow (was decagonal at 10 segs)
    lockRing:     new THREE.TorusGeometry(0.56, 0.03, 8, 36),
    parityCage:   new THREE.OctahedronGeometry(0.39, 0),
    parityNode:   new THREE.SphereGeometry(0.068, 12, 10),
    parityAxis:   new THREE.CylinderGeometry(0.015, 0.015, 0.68, 8),
  },
};

// SingleOrb renders geometry and registers refs with the parent OrbAnimator.
// NO useFrame here — all animation driven by the single loop in ParityOrbs.
function SingleOrbImpl({
  position, color = '#ffd700', antipodalColor = '#ffd700',
  collected = false, isTarget = false, elevated = false,
  dirKey = 'PY', orbKey, type = 'parity',
  registerAnim, unregisterAnim,
  gridX = -1, gridY = -1, gridZ = -1, isGlowWorm = false, reducedDetail = false,
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
  const ringCRef       = useRef();   // target only
  const electronRefs     = useRef([]);
  const electronGlowRefs = useRef([]); // target only
  const outlineRef     = useRef();
  const parityMarkRef  = useRef();

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
      get parityMark()    { return parityMarkRef.current; },
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

  // Mega Mode can carry more than a hundred pickups. Rendering the full gem,
  // cage, Möbius strip, and orbital system for every one turns those pickups
  // into hundreds of draw calls. A single emissive gem keeps them readable at
  // the much smaller on-screen tile size while preserving movement and pickup.
  if (reducedDetail) {
    return (
      <group ref={orbGroupRef} position={[position[0], position[1], position[2]]}>
        <mesh ref={coreRef} geometry={g.shell}>
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={1.4}
            roughness={0.18}
            metalness={0.05}
            toneMapped={false}
          />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={orbGroupRef} position={[position[0], position[1], position[2]]}>

      {/* Smooth glassy gem shell — iridescent + clearcoat so it catches the light and
          shimmers with view angle. Low emissive (vs the old flat glowing ball) so the
          sheen and thin-film iridescence actually read; the brightness now comes from
          the inner core glowing through, not a blown-out surface. */}
      <mesh ref={shellRef} geometry={g.shell}>
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isTarget ? 0.85 : 0.6}
          metalness={0}
          roughness={0.06}
          iridescence={1}
          iridescenceIOR={1.4}
          clearcoat={1}
          clearcoatRoughness={0.08}
          transparent
          opacity={0.78}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Inner energy core — a small, bright, counter-spinning faceted gem that glows
          through the glassy shell, giving the orb visible depth and a molten centre. */}
      <mesh ref={innerCoreRef} geometry={g.innerCore}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isTarget ? 2.6 : 2.0}
          metalness={0}
          roughness={0.1}
          toneMapped={false}
        />
      </mesh>

      {/* Inner additive halo — soft bloom around the core, pulsed by the animator. */}
      <mesh ref={innerGlowRef} geometry={g.innerGlow}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Parity signature: a sharp diamond cage and two opposite poles connected
          through the core. It reads as "antipodal pair" even when tile colours are
          close, and its angular outline cannot be mistaken for either special. */}
      <group ref={parityMarkRef} rotation={[Math.PI / 4, 0, Math.PI / 4]}>
        <mesh geometry={g.parityCage}>
          <meshBasicMaterial
            color="#e8fbff" transparent opacity={isTarget ? 0.6 : 0.46}
            wireframe blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}
          />
        </mesh>
        <mesh geometry={g.parityAxis}>
          <meshBasicMaterial color="#ffffff" transparent opacity={0.72} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh geometry={g.parityNode} position={[0, isTarget ? 0.34 : 0.27, 0]}>
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        <mesh geometry={g.parityNode} position={[0, isTarget ? -0.34 : -0.27, 0]}>
          <meshBasicMaterial color={antipodalColor} toneMapped={false} />
        </mesh>
      </group>

      {/* Möbius strip — antipodal-color accent orbiting the sphere. DoubleSide so the twist reads clearly. */}
      <mesh ref={coreRef} geometry={g.core}>
        <meshStandardMaterial
          color={antipodalColor}
          emissive={antipodalColor}
          emissiveIntensity={isTarget ? 1.8 : 1.2}
          metalness={0.15}
          roughness={0.06}
          side={THREE.DoubleSide}
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
        {/* Third ring — target only (geometry only exists on target set) */}
        {isTarget && g.ringC && (
          <mesh ref={ringCRef} geometry={g.ringC} rotation={[0, 0.85, -0.35]}>
            <meshBasicMaterial color={color} transparent opacity={0.28} depthWrite={false} />
          </mesh>
        )}

        {/* Orbiting electrons removed — the small low-poly glowing spheres read as faceted
            "icosahedron" clutter around the orb. The clean orbit rings stay. */}
      </group>

      {/* Outer aura removed per design — the orb reads off the gem, core glow and rings. */}

      {/* Target lock ring */}
      {isTarget && (
        <mesh ref={targetGlowRef} geometry={_orbGeos.target.lockRing}>
          <meshBasicMaterial color="#ffffff" transparent opacity={0.30} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}

      {/* Point light — target orbs only; non-target glow via emissive + AdditiveBlending */}
      {isTarget && (
        <pointLight color={color} intensity={1.1} distance={3.3} decay={2} />
      )}
    </group>
  );
}

/**
 * An orb's rendered tree — ten meshes, each with its own material element — is
 * completely static between the handful of events that actually change an orb.
 * Everything that moves is driven imperatively by the animator loop below, which
 * writes to refs and never goes through React at all.
 *
 * Without this memo that tree was reconciled far more often than anything about
 * it changed. `PowerupOrbs` subscribes to `cubies`, so every wormhole spawn,
 * every heal and every rotation-hazard turn re-rendered all of it; and App's
 * one-second `gameTime` tick re-renders the whole R3F tree anyway, so the orbs
 * were being diffed — a dozen-odd props per mesh, times ten meshes, times every
 * orb on the board — at least once a second all run long. That is a hitch on a
 * timer, which is what makes it read as stutter rather than a low frame rate.
 *
 * This is purely a reconciliation guard: it changes nothing about what is drawn
 * or when. Every orb keeps every one of its meshes visible at all times.
 *
 * Every prop is a primitive except `position` (a fresh array each time the
 * parent's memo recomputes) and the two register callbacks (already stable via
 * useCallback), so the comparison is exact rather than a heuristic: when one
 * orb's colour changes, only that orb re-renders.
 */
const SingleOrb = React.memo(SingleOrbImpl, (a, b) => (
  a.orbKey === b.orbKey &&
  a.color === b.color &&
  a.antipodalColor === b.antipodalColor &&
  a.dirKey === b.dirKey &&
  a.type === b.type &&
  a.collected === b.collected &&
  a.isTarget === b.isTarget &&
  a.elevated === b.elevated &&
  a.gridX === b.gridX &&
  a.gridY === b.gridY &&
  a.gridZ === b.gridZ &&
  a.isGlowWorm === b.isGlowWorm &&
  a.reducedDetail === b.reducedDetail &&
  a.registerAnim === b.registerAnim &&
  a.unregisterAnim === b.unregisterAnim &&
  a.position[0] === b.position[0] &&
  a.position[1] === b.position[1] &&
  a.position[2] === b.position[2]
));

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
        electrons, electronGlows, outline, parityMark,
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
        _scratchPos.copy(cubie.position).addScaledVector(_scratchBob, SURFACE_OFFSET + HOVER_ABOVE);
        if (elevated) _scratchPos.addScaledVector(_scratchBob, 1.2);
        const bobAmt = Math.sin(time * 2.1) * (isTarget ? 0.13 : 0.06);
        _scratchPos.addScaledVector(_scratchBob, bobAmt);
        group.position.copy(_scratchPos);
      } else {
        const _bob = HOVER_ABOVE + Math.sin(time * 2.1) * (isTarget ? 0.13 : 0.06);
        group.position.set(
          position[0] + bn[0] * _bob,
          position[1] + bn[1] * _bob,
          position[2] + bn[2] * _bob
        );
      }

      // ── Crystal core spin ──────────────────────────────────────────────────
      if (core) {
        core.rotation.y = time * (isTarget ? 1.7 : 1.0);
        core.rotation.x = Math.sin(time * 1.4) * 0.2;
        core.scale.setScalar(1 + Math.sin(time * (isTarget ? 5.2 : 3.8)) * (isTarget ? 0.18 : 0.10));
      }

      if (outline && core) {
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

      // ── Sphere body — gentle breathing pulse ───────────────────────────────
      if (shell) {
        shell.scale.setScalar(1 + Math.sin(time * (isTarget ? 4.0 : 3.0)) * (isTarget ? 0.10 : 0.07));
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
      if (isTarget && ringC) ringC.rotation.y = time * 1.35;
      if (parityMark) {
        parityMark.rotation.y = -time * (isTarget ? 1.15 : 0.8);
        parityMark.rotation.z = Math.PI / 4 + Math.sin(time * 1.4) * 0.12;
        parityMark.scale.setScalar(1 + Math.sin(time * 4.2) * 0.045);
      }

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

        // Electron glow halos are target-only
        if (isTarget) {
          const elGlow = electronGlows[i];
          if (elGlow) {
            elGlow.position.copy(el.position);
            elGlow.scale.setScalar(elScale * 1.6);
          }
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
      if (isGlowWorm && !elevated) {
        if (shell && shell.material) shell.material.emissiveIntensity = (isTarget ? 3.4 : 2.6) + Math.sin(t * 4.0) * 0.9;
        if (core && core.material) core.material.emissiveIntensity = (isTarget ? 2.4 : 1.8) + Math.sin(t * 4.0) * 0.6;
        if (glow) glow.material.opacity = (isTarget ? 0.65 : 0.50) + Math.sin(t * 4.0) * 0.22;
      }

      // ── Rainbow cycle for elevated (flipped-tile) orbs ────────────────────
      if (elevated) {
        const hue = (time * 0.3) % 1;
        _rainbowColor.setHSL(hue, 1.0, 0.62);
        if (shell && shell.material) {
          shell.material.color.copy(_rainbowColor);
          shell.material.emissive.copy(_rainbowColor);
        }
        if (core && core.material) {
          _rainbowColor.setHSL((hue + 0.5) % 1, 1.0, 0.62);
          core.material.color.copy(_rainbowColor);
          core.material.emissive.copy(_rainbowColor);
        }
        if (innerCore && innerCore.material) innerCore.material.color.copy(_rainbowColor);
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
          if (isTarget) {
            const elGlow = electronGlows[i];
            if (elGlow && elGlow.material) {
              _rainbowColor.setHSL((hue + i * 0.33) % 1, 1.0, 0.75);
              elGlow.material.color.copy(_rainbowColor);
            }
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
          reducedDetail={size >= 15 && !isTunnelMode}
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
