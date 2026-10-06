import { createOrbReveal, orbRevealProgress, orbRainLift } from './orbReveal.js';
import { prefersReducedMotion } from '../utils/device.js';
import { wormExpansion } from './wormExpansion.js';
import { WormPointLight } from './WormLighting.jsx';
import { createOrbBatches } from './orbBatches.js';
import { PARITY_ORB_GEOMETRIES } from './parityOrbGeometries.js';
import { getOrbMaterials, orbColorRoles } from './orbMaterials.js';
import { createOrbVisibility } from './orbVisibility.js';
// src/worm/ParityOrb.jsx
// Collectible parity orbs — crystal-core visual design with inner plasma,
// dual-layer aura, electron halos, and type-system foundation for power-ups.

import React, { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getSegmentWorldPos, getTunnelWorldPosInto } from './wormLogic.js';
import { liveCubies } from './liveCubies.js';
import { fxBudget } from './healerWorm/fxBudget.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { SURFACE_OFFSET } from '../utils/constants.js';
import { getTileStyleMaterial } from '../3d/styles/TileStyleMaterials.jsx';
import { PARITY_ORB_SCALE } from './healerWorm/constants.js';
import { createOrbBeacons, orbProximity, orbPerkInto, beaconPoseInto } from './orbBeacon.js';

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
const _head = new THREE.Vector3();
const _rootInverse = new THREE.Matrix4();
const _tile = new THREE.Vector3();
const _tileNormal = new THREE.Vector3();
const _perk = { scale: 1, spin: 1 };
const _beacon = {};
// Beacon ring diameters (world units) for an orb on its tile.
// The band sits at 70% of this radius: just inside a sticker's edge, clear of the gem.
const BEACON_DIAMETER = 0.98;
const BEACON_LIFT = 0.012; // just off the sticker so it never z-fights the tile

// ── Orb type definitions — foundation for power-up variants ─────────────────
// 'parity' is the standard collectible. Reserved slots for future power-ups.
export const ORB_TYPES = {
  parity: { electronColor: '#c6f6ff', electronEmissive: '#80e8ff', glowBoost: 1.0 },
  speed:  { electronColor: '#ffcc44', electronEmissive: '#ff9900', glowBoost: 1.3 },
  shield: { electronColor: '#88ccff', electronEmissive: '#4499ee', glowBoost: 0.8 },
  magnet: { electronColor: '#ffdd88', electronEmissive: '#ffaa00', glowBoost: 1.5 },
};

// ── Shared module-level geometries (M2) ─────────────────────────────────────
// Built once at PARITY_ORB_SCALE in parityOrbGeometries.js, shared by every orb.
const _orbGeos = PARITY_ORB_GEOMETRIES;

// SingleOrb renders geometry and registers refs with the parent OrbAnimator.
// NO useFrame here — all animation driven by the single loop in ParityOrbs.
function SingleOrbImpl({
  position, color = '#ffd700', antipodalColor = '#ffd700', styleKey = 'solid',
  collected = false, isTarget = false, elevated = false,
  dirKey = 'PY', orbKey, type = 'parity', shower = false,
  registerAnim, unregisterAnim,
  gridX = -1, gridY = -1, gridZ = -1, isGlowWorm = false, reducedDetail = false,
}) {
  // The band wears the manifold the orb sits on; the gem wears its antipodal partner.
  const { gem: gemColor, band: bandColor } = orbColorRoles(color, antipodalColor);
  // Share sticker materials where possible, but never apply planar eye relief
  // to the curved Möbius band. 'solid' keeps the emissive band below instead.
  const bandMaterial = useMemo(
    () => (!shower && styleKey && styleKey !== 'solid' ? getTileStyleMaterial(styleKey, bandColor, false, null, gemColor, { surfaceOnly: true }) : null),
    [shower, styleKey, bandColor, gemColor]
  );
  const mat = useMemo(() => getOrbMaterials(gemColor, bandColor, isTarget, elevated, isGlowWorm), [gemColor, bandColor, isTarget, elevated, isGlowWorm]);
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
  const poleRefs = useRef([]);

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
  const styledBandRef = useRef(false); styledBandRef.current = !!bandMaterial;
  const gemColorRef   = useRef(gemColor);   gemColorRef.current   = gemColor;

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
      get poles()         { return poleRefs.current; },
      get styledBand()    { return styledBandRef.current; },
      timeOffset, shower, reducedDetail, age: 0, reveal: null, arrived: false,
      near: 0, spin: 0,
      get color()         { return gemColorRef.current; },
    });
    return () => unregisterAnim(orbKey);
  }, [orbKey, timeOffset, shower, reducedDetail, registerAnim, unregisterAnim]);

  if (collected) return null;

  const g = isTarget ? _orbGeos.target : _orbGeos.normal;

  // Dense showers retain the current gem, Möbius band and crossed orbit rings,
  // but use four opaque proxies. After their entrance these become shared
  // instanced draws per colour pair, with no per-orb transparent layers.
  if (shower) {
    return (
      <group ref={orbGroupRef} visible={false} position={[position[0], position[1], position[2]]}>
        <mesh ref={shellRef} visible={false} geometry={g.shell} material={mat.reduced} />
        <mesh ref={coreRef} visible={false} geometry={g.core} material={mat.band} />
        <group ref={orbitSystemRef}>
          <mesh ref={ringARef} visible={false} geometry={g.ringA} material={mat.nodeGem} rotation={[0.3, 0.4, 0]} />
          <mesh ref={ringBRef} visible={false} geometry={g.ringB} material={mat.nodeBand} rotation={[-0.6, 0, 0.5]} />
        </group>
      </group>
    );
  }

  // Ordinary pickups follow the shared effects budget.
  if (reducedDetail) {
    return (
      <group ref={orbGroupRef} visible={false} position={[position[0], position[1], position[2]]}>
        <mesh ref={coreRef} geometry={g.shell} material={mat.reduced} />
      </group>
    );
  }

  return (
    <group ref={orbGroupRef} visible={false} position={[position[0], position[1], position[2]]}>

      {/* Smooth glassy gem shell — iridescent + clearcoat so it catches the light and
          shimmers with view angle. Low emissive (vs the old flat glowing ball) so the
          sheen and thin-film iridescence actually read; the brightness now comes from
          the inner core glowing through, not a blown-out surface. */}
      <mesh ref={shellRef} geometry={g.shell} material={mat.shell} />

      {/* Inner energy core — a small, bright, counter-spinning faceted gem that glows
          through the glassy shell, giving the orb visible depth and a molten centre. */}
      <mesh ref={innerCoreRef} visible={false} geometry={g.innerCore} material={mat.innerCore} />

      {/* Inner additive halo — soft bloom around the core, pulsed by the animator. */}
      <mesh ref={innerGlowRef} geometry={g.innerGlow} material={mat.innerGlow} />

      {/* Parity signature: two smooth crossed great-circle halos and two opposite
          poles connected by a luminous axis through the core. It reads as
          "antipodal pair" even when tile colours are close, but its outline is now
          all curves — no diamond, no hard edges. */}
      <group ref={parityMarkRef} rotation={[Math.PI / 4, 0, Math.PI / 4]}>
        <mesh name="ParityOrbCageBatch" geometry={g.cage} material={mat.cage} />
        <mesh ref={el => { poleRefs.current[0] = el; }} visible={false} geometry={g.parityNode} material={mat.nodeGem} position={[0, (isTarget ? 0.34 : 0.27) * PARITY_ORB_SCALE, 0]} />
        <mesh ref={el => { poleRefs.current[1] = el; }} visible={false} geometry={g.parityNode} material={mat.nodeBand} position={[0, (isTarget ? -0.34 : -0.27) * PARITY_ORB_SCALE, 0]} />
      </group>

      {/* Möbius strip — the orb's own face, in that face's colour AND its tile
          style, so a patterned board is still legible from the pickup. Falls back
          to the emissive band on plain (solid) faces, where there is no pattern to
          carry and the glow reads better. DoubleSide either way: a Möbius band is
          one-sided, so front faces alone would drop half the loop. */}
      <mesh ref={coreRef} geometry={g.core} material={bandMaterial ?? mat.band} />

      {/* Electron orbital rings + electrons */}
      <group ref={orbitSystemRef}>
        <mesh ref={ringARef} geometry={g.ringA} material={mat.ringA} rotation={[0.3, 0.4, 0]} />
        <mesh ref={ringBRef} geometry={g.ringB} material={mat.ringB} rotation={[-0.6, 0, 0.5]} />
        {/* Third ring — target only (geometry only exists on target set) */}
        {isTarget && g.ringC && (
          <mesh ref={ringCRef} geometry={g.ringC} material={mat.ringC} rotation={[0, 0.85, -0.35]} />
        )}

        {/* Orbiting electrons removed — the small low-poly glowing spheres read as faceted
            "icosahedron" clutter around the orb. The clean orbit rings stay. */}
      </group>

      {/* Outer aura removed per design — the orb reads off the gem, core glow and rings. */}

      {/* Target lock ring */}
      {isTarget && (
        <mesh ref={targetGlowRef} geometry={_orbGeos.target.lockRing} material={mat.lockRing} />
      )}

      {/* Point light — target orbs only; non-target glow via emissive + AdditiveBlending */}
      {isTarget && (
        <WormPointLight color={gemColor} intensity={1.1} distance={3.3} decay={2} />
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
  a.styleKey === b.styleKey &&
  a.dirKey === b.dirKey &&
  a.type === b.type &&
  a.shower === b.shower &&
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
  mode = 'surface', targetTunnelId = null, isGlowWorm = false, wormMode = false,
  focusRef = null,
}) {
  const isTunnelMode = mode === 'tunnel';

  const animMapRef = useRef(new Map());
  const orbRootRef = useRef();
  const reducedMotion = useRef(prefersReducedMotion());
  const visibility = useMemo(() => createOrbVisibility(), []);
  const batches = useMemo(() => createOrbBatches(), []);
  useEffect(() => () => batches.dispose(), [batches]);
  // Every orb's tile beacon, in one additive draw (orbBeacon.js).
  const beacons = useMemo(() => createOrbBeacons(), []);
  useEffect(() => () => beacons.dispose(), [beacons]);
  const registerAnim   = useCallback((key, refs) => { animMapRef.current.set(key, refs); }, []);
  const unregisterAnim = useCallback((key) => { animMapRef.current.get(key)?.reveal?.dispose(); animMapRef.current.delete(key); }, []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    // PiP renders a second camera: main-camera culling must not hide its orbs.
    const cull = !useGameStore.getState().showAntipodalPiP;
    if (cull) visibility.begin(state.camera, orbRootRef.current);
    batches.begin(orbRootRef.current);
    beacons.begin();
    // The worm's head in the orbs' own frame, so each orb can perk up as it nears.
    const focus = focusRef?.current;
    if (focus && orbRootRef.current) {
      _rootInverse.copy(orbRootRef.current.matrixWorld).invert();
      _head.copy(focus).applyMatrix4(_rootInverse);
    }
    const frameDelta = Math.min(delta, 0.05);

    for (const refs of animMapRef.current.values()) {
      const {
        group, core, innerCore, innerGlow, shell, glow, targetGlow,
        orbitSystem, ringA, ringB, ringC,
        electrons, electronGlows, outline, parityMark,
        isTarget, position, dirKey, gridX, gridY, gridZ, timeOffset,
      } = refs;
      if (!group || !core) continue;
      const time = t + timeOffset;
      refs.age += Math.min(delta, 0.05);
      const arrival = orbRevealProgress(refs.age, refs.shower);

      // ── World position — glued to live cubie transform ─────────────────────
      const bn = BOB_NORMALS[dirKey] || BOB_NORMALS.PY;
      const { elevated } = refs;
      const lSize = liveCubies.size;
      const cubie = (gridX >= 0 && liveCubies.refs && lSize > 0)
        ? liveCubies.refs[gridX * lSize * lSize + gridY * lSize + gridZ]
        : null;

      if (cubie) {
        _scratchBob.set(bn[0], bn[1], bn[2]).applyQuaternion(cubie.quaternion);
        _tileNormal.copy(_scratchBob);
        _tile.copy(cubie.position).addScaledVector(_scratchBob, SURFACE_OFFSET + BEACON_LIFT);
        _scratchPos.copy(cubie.position).addScaledVector(_scratchBob, SURFACE_OFFSET + HOVER_ABOVE);
        if (elevated) _scratchPos.addScaledVector(_scratchBob, 1.2);
        const bobAmt = Math.sin(time * 2.1) * (isTarget ? 0.13 : 0.06);
        _scratchPos.addScaledVector(_scratchBob, bobAmt);
        group.position.copy(_scratchPos);
      } else {
        const base = wormMode && gridX >= 0
          ? getSegmentWorldPos({ x: gridX, y: gridY, z: gridZ, dirKey }, size, wormExpansion.amount) : position;
        const elevatedLift = wormMode && gridX >= 0 && elevated ? 1.2 : 0;
        _tileNormal.set(bn[0], bn[1], bn[2]);
        _tile.set(base[0], base[1], base[2]).addScaledVector(_tileNormal, BEACON_LIFT);
        const _bob = elevatedLift + HOVER_ABOVE + Math.sin(time * 2.1) * (isTarget ? 0.13 : 0.06);
        group.position.set(
          base[0] + bn[0] * _bob,
          base[1] + bn[1] * _bob,
          base[2] + bn[2] * _bob
        );
      }

      if (refs.shower && arrival < 1) {
        if (!cubie) _scratchBob.set(...bn);
        group.position.addScaledVector(_scratchBob, orbRainLift(arrival, reducedMotion.current));
      }
      // Advance off-screen arrivals too: camera moves never replay the entrance.
      if (!refs.arrived) {
        refs.reveal ??= createOrbReveal(group, { radius: (isTarget ? 0.75 : 0.6) * PARITY_ORB_SCALE, reducedMotion: reducedMotion.current });
        refs.arrived = !refs.reveal.update(arrival);
      }

      // Keep placement current even when hidden so turning slices and camera
      // moves bring the complete orb back immediately. Off-screen parts skip
      // their individual animation and render-list traversal.
      group.visible = !cull || visibility.contains(group.position, (isTarget ? 1.1 : 0.85) * PARITY_ORB_SCALE);
      if (!group.visible) continue;

      // ── Anticipation: the orb perks up as the worm's head closes in ────────
      // Eased toward its target so the swell never snaps, and the spin runs on an
      // accumulated phase so speeding it up never jumps the rotation.
      const nearTarget = focus && !refs.shower ? orbProximity(group.position.distanceTo(_head)) : 0;
      refs.near += (nearTarget - refs.near) * Math.min(1, frameDelta * 8);
      orbPerkInto(_perk, refs.near, reducedMotion.current);
      refs.spin += frameDelta * _perk.spin;
      const spinTime = refs.spin + timeOffset;
      group.scale.setScalar(_perk.scale);

      // ── Tile beacon: which tile collects this orb ──────────────────────────
      if (!refs.shower && !isTunnelMode) {
        beaconPoseInto(_beacon, time, refs.near, arrival, reducedMotion.current);
        // Parse the orb's colour once per change, not every frame.
        if (refs.beaconHex !== refs.color) {
          refs.beaconHex = refs.color;
          (refs.beaconColor ??= new THREE.Color()).set(refs.color);
        }
        const color = refs.beaconColor;
        beacons.add(_tile, _tileNormal, BEACON_DIAMETER * _beacon.ringScale, color, _beacon.ringIntensity);
        if (_beacon.pingVisible) beacons.add(_tile, _tileNormal, BEACON_DIAMETER * _beacon.pingScale, color, _beacon.pingIntensity);
      }

      // ── Crystal core spin ──────────────────────────────────────────────────
      if (core) {
        core.rotation.y = spinTime * (isTarget ? 1.7 : 1.0);
        core.rotation.x = Math.sin(time * 1.4) * 0.2;
        // A slow breath, not a flutter: the old ±10% at 3.8 Hz read as jitter.
        core.scale.setScalar(1 + Math.sin(time * (isTarget ? 5.2 : 2.4)) * (isTarget ? 0.18 : 0.05));
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
        innerCore.scale.setScalar(1 + Math.sin(time * 3.2) * 0.14);
      }

      // ── Sphere body — gentle breathing pulse ───────────────────────────────
      if (shell) {
        shell.scale.setScalar(1 + Math.sin(time * (isTarget ? 4.0 : 2.0)) * (isTarget ? 0.10 : 0.035));
      }

      // ── Inner glow — pulses offset from outer glow ─────────────────────────
      if (innerGlow) {
        innerGlow.material.opacity = (isTarget ? 0.28 : 0.18) + Math.sin(t * 3.8 + 1.2) * 0.07;
        innerGlow.scale.setScalar(1 + Math.sin(time * 3.2) * 0.05);
      }

      // ── Orbit system ───────────────────────────────────────────────────────
      if (orbitSystem) {
        orbitSystem.rotation.y = spinTime * (isTarget ? 2.6 : 1.8);
        orbitSystem.rotation.x = Math.sin(time * 0.8) * 0.65;
        orbitSystem.rotation.z = Math.cos(time * 0.55) * 0.5;
      }

      if (ringA) ringA.rotation.z = spinTime * 1.5;
      if (ringB) ringB.rotation.x = spinTime * 1.2;
      if (isTarget && ringC) ringC.rotation.y = time * 1.35;
      if (parityMark) {
        parityMark.rotation.y = -spinTime * (isTarget ? 1.15 : 0.8);
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
        if (core && core.material?.emissive && !refs.styledBand) core.material.emissiveIntensity = (isTarget ? 2.4 : 1.8) + Math.sin(t * 4.0) * 0.6;
        if (glow) glow.material.opacity = (isTarget ? 0.65 : 0.50) + Math.sin(t * 4.0) * 0.22;
      }

      // ── Rainbow cycle for elevated (flipped-tile) orbs ────────────────────
      if (elevated) {
        const hue = (t * 0.3) % 1;
        _rainbowColor.setHSL(hue, 1.0, 0.62);
        if (shell && shell.material) {
          shell.material.color.copy(_rainbowColor);
          shell.material.emissive.copy(_rainbowColor);
        }
        // The Möbius band carries its face's TILE STYLE on patterned boards, and a
        // tile-style ShaderMaterial has neither `.emissive` nor a meaningful
        // `.color` — touching emissive here threw on every frame, inside the R3F
        // render loop, for any elevated orb on a patterned face. That is a hard
        // freeze, not a glitch. The pattern is the information; leave it alone and
        // let the gem carry the rainbow.
        if (core && core.material?.emissive && !refs.styledBand) {
          _rainbowColor.setHSL((hue + 0.5) % 1, 1.0, 0.62);
          core.material.color.copy(_rainbowColor);
          core.material.emissive.copy(_rainbowColor);
        }
        _rainbowColor.setHSL((hue + 0.5) % 1, 1.0, 0.62);
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
        targetGlow.material.opacity = 0.22 + Math.sin(t * 6.2) * 0.08;
      }
      // Hidden proxy meshes retain the exact animated transforms. Shower orbs
      // batch their entire opaque silhouette; ordinary orbs batch core and poles.
      group.updateWorldMatrix(false, true);
      // Arriving parts dissolve in one common orb frame. Once formed, put the
      // opaque pieces back into their shared draw calls.
      if (refs.shower) {
        for (const part of [shell, core, ringA, ringB]) {
          part.visible = !refs.arrived;
          if (refs.arrived) batches.add(part);
        }
        continue;
      }
      if (refs.reducedDetail) core.visible = !refs.arrived;
      if (innerCore) innerCore.visible = !refs.arrived;
      for (const pole of refs.poles) if (pole) pole.visible = !refs.arrived;
      if (refs.arrived) {
        if (refs.reducedDetail) batches.add(core);
        else {
          batches.add(innerCore);
          for (const pole of refs.poles) batches.add(pole);
        }
      }
    }
    batches.end();
    beacons.end();
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
        position = getSegmentWorldPos(orb, size, wormMode ? wormExpansion.amount : explosionFactor);
        if (orb.elevated) {
          const bn = BOB_NORMALS[orb.dirKey] || BOB_NORMALS.PY;
          const ELEVATED_HOVER = 1.2;
          position = [
            position[0] + bn[0] * ELEVATED_HOVER,
            position[1] + bn[1] * ELEVATED_HOVER,
            position[2] + bn[2] * ELEVATED_HOVER,
          ];
        }
        key = orb.spawnId ?? `${orb.x}-${orb.y}-${orb.z}-${orb.dirKey}`;
      }

      return {
        position,
        color:          orb.color          || '#ffd700',
        antipodalColor: orb.antipodalColor || orb.color || '#ffd700',
        styleKey:       orb.styleKey       || 'solid',
        dirKey:         orb.dirKey         || 'PY',
        type:           orb.type           || 'parity',
        key,
        shower: !!orb.shower,
        isTarget:  isTunnelMode && orb.tunnelId === targetTunnelId,
        elevated:  orb.elevated || false,
        gridX:     orb.x  ?? -1,
        gridY:     orb.y  ?? -1,
        gridZ:     orb.z  ?? -1,
      };
    });
  }, [orbs, size, explosionFactor, isTunnelMode, targetTunnelId, wormMode]);

  return (
    <group ref={orbRootRef}>
      <primitive object={batches.group} />
      <primitive object={beacons.mesh} />
      {orbData.map((data) => (
        <SingleOrb
          key={data.key}
          orbKey={data.key}
          position={data.position}
          color={data.color}
          antipodalColor={data.antipodalColor}
          styleKey={data.styleKey}
          dirKey={data.dirKey}
          type={data.type}
          shower={data.shower}
          isTarget={data.isTarget}
          elevated={data.elevated}
          gridX={data.gridX}
          gridY={data.gridY}
          gridZ={data.gridZ}
          isGlowWorm={isGlowWorm}
          registerAnim={registerAnim}
          unregisterAnim={unregisterAnim}
          reducedDetail={fxBudget(size).orbDetail === 'reduced' && !isTunnelMode}
        />
      ))}
    </group>
  );
}
