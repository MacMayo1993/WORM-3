import { advancePlatformFormation, platformFormationHeld } from '../worm/platformFormation.js';
import { getViewPowerDef } from '../worm/healerWorm/viewPowerups.js';
import { useRaisedCubieSpring } from './raisedCubieContext.js';
import { cubieHasFlippedFace, selectiveCubieOffsetRatio, wormRaisedAmount, cubeRaisedAmount } from '../game/raisedCubie.js';
import { advancePieceSpring } from './padPose.js';
import { publishRaisedCubie } from './raisedCubieMotion.js';
import { cubieKicks, cubieKickAmount, KICK_DURATION_MS } from './cubieKick.js';
import { prefersReducedMotion } from '../utils/device.js';
import { cubeExpansionScale } from '../game/cubeWorldGeometry.js';
import React, { useMemo, useRef, useEffect, useState, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS, FACE_COLORS } from '../utils/constants.js';
import { getEdgeFlags } from '../game/cubeUtils.js';
import { useGameStore, selectEffectiveFlipCap } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import StickerPlane from './StickerPlane.jsx';
import MergedLedEdges from './MergedLedEdges.jsx';
import { hollowFrameGeometry } from './hollowFrameGeometry.js';
import { getMirrorDimensions } from '../game/mirrorBlocks.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { PER_CUBELET_VIEW_STYLES, LED_EDGE_MODES, pickCubeletViewStyle, bodyMaterialProps } from './cubeViewStyles.js';
// Canonical Sudokube number (matches win detection in winDetection.js).
import { faceValue as sudokuValue, getManifoldGridId, faceRCFor } from '../game/coordinates.js';

// Cube-pop bursts (the little outward hops on a disparity heal tap) touch only a
// handful of cubies and never fire in Worm/Mega mode at all. Rather than have
// every one of Mega's ~1,350 cubies read the store and index cubiePops on every
// frame, a single module-level subscription flips this flag whenever the pop map
// gains or loses entries. Idle cubies then leave the pop useFrame on one cheap
// boolean check. subscribeWithSelector (used by the store) fires the listener
// only when the cubiePops reference actually changes, so Object.keys runs rarely.
let _anyCubiePops = false;
useGameStore.subscribe(
  (s) => s.cubiePops,
  (pops) => { _anyCubiePops = !!pops && Object.keys(pops).length > 0; }
);

// Shared hollow beam materials — one per visualMode string.
// Each cubie uses one merged frame mesh and a shared material.
// All beams in the same mode share identical properties so one GPU material suffices.
const _hollowBeamMaterials = {};
function getHollowBeamMaterial(visualMode) {
  if (_hollowBeamMaterials[visualMode]) return _hollowBeamMaterials[visualMode];
  const mat = new THREE.MeshStandardMaterial({
    color: visualMode === 'wireframe' ? '#000000' : visualMode === 'glass' ? '#111111' : '#0a0a0a',
    roughness: visualMode === 'wireframe' ? 0.9 : visualMode === 'glass' ? 0.05 : 0.25,
    metalness: visualMode === 'wireframe' ? 0 : visualMode === 'glass' ? 0.3 : 0.15,
    envMapIntensity: visualMode === 'glass' ? 0.8 : 0.4,
    transparent: visualMode === 'glass',
    opacity: visualMode === 'glass' ? 0.12 : 1.0,
  });
  _hollowBeamMaterials[visualMode] = mat;
  return mat;
}

// Stable sticker position/rotation arrays (allocated once, never recreated).
// Prevents StickerPlane from re-rendering due to new array references.
const STICKER_POS = {
  PZ: [0, 0, 0.51],
  NZ: [0, 0, -0.51],
  PX: [0.51, 0, 0],
  NX: [-0.51, 0, 0],
  PY: [0, 0.51, 0],
  NY: [0, -0.51, 0],
};
const STICKER_ROT = {
  PZ: [0, 0, 0],
  NZ: [0, Math.PI, 0],
  PX: [0, Math.PI / 2, 0],
  NX: [0, -Math.PI / 2, 0],
  PY: [-Math.PI / 2, 0, 0],
  NY: [Math.PI / 2, 0, 0],
};

// Lego stud: a single molded stud centered on each face. The face group's +Y axis is
// rotated to the outward normal, then the stud is built up the local +Y axis.
const LEGO_STUD_BODY_GEO = [0.2, 0.21, 0.14, 26];   // slightly tapered cylinder (radiusTop < bottom)
const LEGO_STUD_RING_GEO = [0.14, 0.022, 10, 28];   // torus — embossed ring on the stud top
const LEGO_STUD_PIP_GEO = [0.055, 0.055, 0.05, 18]; // small raised center pip
const LEGO_FACE_TRANSFORMS = {
  PZ: { pos: [0, 0, 0.49], rot: [Math.PI / 2, 0, 0] },
  NZ: { pos: [0, 0, -0.49], rot: [-Math.PI / 2, 0, 0] },
  PX: { pos: [0.49, 0, 0], rot: [0, 0, -Math.PI / 2] },
  NX: { pos: [-0.49, 0, 0], rot: [0, 0, Math.PI / 2] },
  PY: { pos: [0, 0.49, 0], rot: [0, 0, 0] },
  NY: { pos: [0, -0.49, 0], rot: [Math.PI, 0, 0] }
};

// A single detailed Lego stud on a given face, colored to match the face's sticker:
// a tapered cylinder body, an embossed ring on top, and a small center pip.
function LegoStud({ dir, color, enableShadows = true }) {
  const t = LEGO_FACE_TRANSFORMS[dir];
  if (!t) return null;
  return (
    <group position={t.pos} rotation={t.rot}>
      <mesh position={[0, 0.07, 0]} castShadow={enableShadows}>
        <cylinderGeometry args={LEGO_STUD_BODY_GEO} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0} envMapIntensity={0.6} />
      </mesh>
      <mesh position={[0, 0.142, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow={enableShadows}>
        <torusGeometry args={LEGO_STUD_RING_GEO} />
        <meshStandardMaterial color={color} roughness={0.28} metalness={0} envMapIntensity={0.75} />
      </mesh>
      <mesh position={[0, 0.155, 0]} castShadow={enableShadows}>
        <cylinderGeometry args={LEGO_STUD_PIP_GEO} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0} envMapIntensity={0.7} />
      </mesh>
    </group>
  );
}

// Helper functions for grid and sudokube modes

const Cubie = React.forwardRef(function Cubie({
  position, cubie, size, wormMode = false, hideBody = false, omitBody = false, onPointerDown,
}, ref) {
  const { hollowMode, mirrorMode: storedMirrorMode, visualMode, explosionFactor, settings, randomMode, randomStyleTick, perfReducedFX, wormViewPower, effectiveFlipCap } = useGameStore(
    useShallow(s => ({
      hollowMode: s.hollowMode,
      mirrorMode: s.mirrorMode,
      visualMode: s.visualMode,
      wormViewPower: s.wormViewPower,
      explosionFactor: s.explosionT,
      settings: s.settings,
      randomMode: s.randomMode,
      randomStyleTick: s.randomStyleTick,
      perfReducedFX: s.perfReducedFX,
      effectiveFlipCap: selectEffectiveFlipCap(s),
    }))
  );
  const enableShadows = !perfReducedFX;
  const wormPads = wormMode && !useGameStore.getState().demoMode;
  const wormWindow = wormPads && cubieHasFlippedFace(cubie, effectiveFlipCap);
  // Hollow's 12-beam-per-cubie representation would create more than 14,000
  // meshes on a 15×15 shell. Mega disables that view and keeps its optimized chassis.
  const powerView = wormMode ? getViewPowerDef(wormViewPower)?.view : null;
  const mirrorMode = !powerView && storedMirrorMode;
  const effectiveHollowMode = !powerView && hollowMode && size < 15;
  // faceColors needed locally for wireframe edge coloring
  const faceColors = useMemo(() => resolveColors(settings, settings?.biomeMode?.faceAssignment), [settings]);

  // Physical-piece identity (original home position). origPos is set once in makeCubies
  // and preserved through every move, so it's stable across rotations. Interior pieces
  // (no stickers) fall back to their current grid position.
  const _firstStickerOrigPos = Object.values(cubie.stickers)[0]?.origPos;
  const origHomeX = _firstStickerOrigPos?.x ?? cubie.x;
  const origHomeY = _firstStickerOrigPos?.y ?? cubie.y;
  const origHomeZ = _firstStickerOrigPos?.z ?? cubie.z;

  // Worm mode: pieces carrying a flipped (wormhole) sticker wear the neon view style —
  // dark emissive body + pulsing LED edge frame — isolated to just those tiles so the
  // antipodal flip reads instantly against the rest of the cube. wormFlipKey encodes
  // per-face flip state as a primitive string, so the memos below only recompute when a
  // flip actually lands or heals; the LED frame itself is gated to the flipped faces.
  const isFaceFlipped = (dirKey) => {
    const s = cubie.stickers[dirKey];
    return !!(s && s.flips > 0 && s.curr !== s.orig);
  };
  const wormFlipKey = wormMode
    ? _DIRS.reduce((acc, d) => acc + (isFaceFlipped(d) ? '1' : '0'), '')
    : '';
  const wormNeon = wormFlipKey.indexOf('1') !== -1;

  // In Random Mode each cubelet wears its own view style, reshuffled every cycle
  // (randomStyleTick). Keyed by the piece's home position so the style follows the
  // physical cubelet through rotations rather than flickering. Outside Random Mode the
  // global View-tab visualMode applies to the whole cube exactly as before.
  const effectiveVisualMode = useMemo(
    () => (powerView ?? (wormNeon ? 'neon' : randomMode ? pickCubeletViewStyle(origHomeX, origHomeY, origHomeZ, randomStyleTick) : visualMode)),
    [powerView, wormNeon, randomMode, randomStyleTick, visualMode, origHomeX, origHomeY, origHomeZ]
  );

  // Derived per-style render switches.
  const isLego = effectiveVisualMode === 'lego';
  const showLedEdges = LED_EDGE_MODES.has(effectiveVisualMode);
  // Gap mode shrinks the whole cubie in place so visible gaps open between pieces.
  const contentScale = effectiveVisualMode === 'gap' ? 0.82 : 1;
  // Body material props (+ wormMode transparency layered on).
  const _bmp = bodyMaterialProps(effectiveVisualMode);
  const bodyMatProps = {
    color: _bmp.color,
    roughness: _bmp.roughness,
    metalness: _bmp.metalness,
    envMapIntensity: _bmp.envMapIntensity,
    transparent: !!_bmp.transparent || wormMode,
    opacity: wormWindow ? 0.16 : _bmp.opacity ?? (wormMode ? 0.8 : 1.0),
    // A dark depth-writing shell hid the entire band behind the raised tile.
    depthWrite: !wormWindow,
    side: wormMode ? THREE.DoubleSide : THREE.FrontSide,
    ...(_bmp.emissive ? { emissive: _bmp.emissive, emissiveIntensity: _bmp.emissiveIntensity ?? 1 } : {})
  };
  const isEdge = (p, v) => Math.abs(p - v) < 0.01;

  const explodedPos = useMemo(() => {
    if (explosionFactor === 0) return position;
    const expansionScale = cubeExpansionScale(size, explosionFactor);
    return [
      position[0] * expansionScale,
      position[1] * expansionScale,
      position[2] * expansionScale
    ];
  }, [position, explosionFactor, size]);

  const handleDown = (e) => {
    e.stopPropagation();
    onPointerDown({ pos: { x: cubie.x, y: cubie.y, z: cubie.z }, worldPos: e.point?.clone() ?? new THREE.Vector3(...position), event: e });
  };

  const meta = (d) => cubie.stickers[d] || null;

  // Stable logical identity for a sticker piece (face + original cubie coordinates).
  // Cube rotations swap which logical sticker occupies each rendered face slot.
  // Keying StickerPlane by this identity forces a remount when that swap happens,
  // so refs initialized from `meta` (gridId, flip timeline, etc.) never stay bound
  // to the previous sticker and bleed styles onto the wrong corner tile.
  const stickerKey = (dirKey) => {
    // Worm mode: key by GRID SLOT (this cubie's current position, which cubeRotation
    // writes as the destination coords, so it is stable as pieces turn through the
    // slot). The StickerPlane then persists across turns and updates its meta in
    // place instead of unmounting + remounting — eliminating the ~150-sticker remount
    // storm that makes the 15x15 Mega board lag at the end of every rotation.
    // StickerPlane re-syncs its physical identity in place (see its stickerGridId
    // handling), so ref-bleed is still prevented without the remount.
    if (wormMode) return `${dirKey}-slot-${cubie.x}-${cubie.y}-${cubie.z}-${size}`;
    // All other modes keep the physical-piece identity key, which forces the remount
    // that resets meta-derived refs when a turn swaps which sticker fills this slot.
    const m = meta(dirKey);
    if (!m?.origPos) return `${dirKey}-empty`;
    const { x, y, z } = m.origPos;
    return `${dirKey}-${m.orig}-${x}-${y}-${z}-${size}`;
  };

  const gridPos = (dirKey) => {
    const m = meta(dirKey);
    if (!m?.origPos) return {};
    const { r, c } = faceRCFor(m.origDir, m.origPos.x, m.origPos.y, m.origPos.z, size);
    return { faceRow: r, faceCol: c };
  };

  const overlay = (dirKey) => {
    const m = meta(dirKey); if (!m) return '';
    if (effectiveVisualMode === 'grid') {
      // Use the ONE canonical grid ID (same function every flip/antipodal/worker
      // path uses). The previous local formula had drifted for the NZ/NX/NY
      // faces and a GRID_FACE swap hack was layered on top, so the on-screen
      // label disagreed with the logic: flipping the tile labelled M1-001
      // visibly flipped "M4-007" (its true same-index partner M4-001, mislabelled).
      return getManifoldGridId(m, size);
    }
    if (effectiveVisualMode === 'sudokube') {
      // Show the sticker's IDENTITY number (from its original face + position),
      // not its current cell. Each home cell has a unique number 1..size² (1-9 on
      // a 3×3), and the number travels with the sticker as it moves — using the
      // current cell instead would show a fixed 1..size² grid that never changes.
      // This matches the value used by checkSudokubeSolved in win detection.
      if (!m.origPos) return '';
      return String(sudokuValue(m.origDir, m.origPos.x, m.origPos.y, m.origPos.z, size));
    }
    return '';
  };

  // Helper to get edge color for wireframe mode
  const getEdgeColor = (dirKey) => {
    const sticker = cubie.stickers[dirKey];
    if (!sticker) return COLORS.black;
    return (faceColors || FACE_COLORS)[sticker.curr];
  };

  // Memoize edge flags so wireframeEdges dep is stable across renders.
  // Only recomputes when the cubie's grid position or cube size changes.
  const isOnEdge = useMemo(
    () => getEdgeFlags(cubie.x, cubie.y, cubie.z, size),
    [cubie.x, cubie.y, cubie.z, size]
  );

  // Primitive fingerprint of each face's current color — a plain string that
  // React can compare by value. Changes only when sticker colors actually change,
  // not on every object-reference re-creation during rotation.
  // Memoized so the template-literal is not evaluated on every render; in non-wireframe
  // mode the memo short-circuits immediately (no string allocation at all).
  const stickerColorKey = useMemo(
    () => LED_EDGE_MODES.has(effectiveVisualMode)
      ? `${cubie.stickers.PZ?.curr},${cubie.stickers.NZ?.curr},${cubie.stickers.PX?.curr},${cubie.stickers.NX?.curr},${cubie.stickers.PY?.curr},${cubie.stickers.NY?.curr}`
      : '',
    [
      effectiveVisualMode,
      cubie.stickers.PZ?.curr, cubie.stickers.NZ?.curr,
      cubie.stickers.PX?.curr, cubie.stickers.NX?.curr,
      cubie.stickers.PY?.curr, cubie.stickers.NY?.curr,
    ]
  );

  // Stable per-cubie pulse phase derived from original position.
  // Using Math.random() inside useMemo caused a new phase on every deps change
  // (e.g. each cube rotation), producing visible wireframe flicker.
  const pulsePhase = useMemo(() => {
    const s = Object.values(cubie.stickers)[0];
    const ox = s?.origPos?.x ?? cubie.x;
    const oy = s?.origPos?.y ?? cubie.y;
    const oz = s?.origPos?.z ?? cubie.z;
    return ((ox * 7 + oy * 13 + oz * 17) & 31) * (Math.PI * 2 / 32);
  // origPos never changes after cube creation — this runs exactly once per cubie mount.
  }, []);

  // Generate wireframe edges for wireframe mode ONLY
  const wireframeEdges = useMemo(() => {
    if (!LED_EDGE_MODES.has(effectiveVisualMode)) return [];

    const halfSize = 0.49;
    const eps = 0.01;
    const edgeList = [];

    // Worm-neon isolation: the LED frame outlines the flipped (wormhole) faces only,
    // so the glow traces the tile itself rather than every exposed face of the piece.
    const faceGlows = (onEdge, dirKey) => onEdge && (powerView || !wormNeon || isFaceFlipped(dirKey));

    // Front face (PZ) - 4 edges
    if (faceGlows(isOnEdge.pz, 'PZ')) {
      const color = getEdgeColor('PZ');
      const intensity = 1.0;

      edgeList.push(
        { start: [-halfSize, -halfSize, halfSize + eps], end: [halfSize, -halfSize, halfSize + eps], color, intensity, pulsePhase },
        { start: [-halfSize, halfSize, halfSize + eps], end: [halfSize, halfSize, halfSize + eps], color, intensity, pulsePhase },
        { start: [-halfSize, -halfSize, halfSize + eps], end: [-halfSize, halfSize, halfSize + eps], color, intensity, pulsePhase },
        { start: [halfSize, -halfSize, halfSize + eps], end: [halfSize, halfSize, halfSize + eps], color, intensity, pulsePhase }
      );
    }

    // Back face (NZ) - 4 edges
    if (faceGlows(isOnEdge.nz, 'NZ')) {
      const color = getEdgeColor('NZ');
      const intensity = 1.0;

      edgeList.push(
        { start: [-halfSize, -halfSize, -halfSize - eps], end: [halfSize, -halfSize, -halfSize - eps], color, intensity, pulsePhase },
        { start: [-halfSize, halfSize, -halfSize - eps], end: [halfSize, halfSize, -halfSize - eps], color, intensity, pulsePhase },
        { start: [-halfSize, -halfSize, -halfSize - eps], end: [-halfSize, halfSize, -halfSize - eps], color, intensity, pulsePhase },
        { start: [halfSize, -halfSize, -halfSize - eps], end: [halfSize, halfSize, -halfSize - eps], color, intensity, pulsePhase }
      );
    }

    // Right face (PX) - 4 edges (all edges, not just 2)
    if (faceGlows(isOnEdge.px, 'PX')) {
      const color = getEdgeColor('PX');
      const intensity = 1.0;

      edgeList.push(
        { start: [halfSize + eps, -halfSize, -halfSize], end: [halfSize + eps, halfSize, -halfSize], color, intensity, pulsePhase },
        { start: [halfSize + eps, -halfSize, halfSize], end: [halfSize + eps, halfSize, halfSize], color, intensity, pulsePhase },
        { start: [halfSize + eps, -halfSize, -halfSize], end: [halfSize + eps, -halfSize, halfSize], color, intensity, pulsePhase },
        { start: [halfSize + eps, halfSize, -halfSize], end: [halfSize + eps, halfSize, halfSize], color, intensity, pulsePhase }
      );
    }

    // Left face (NX) - 4 edges
    if (faceGlows(isOnEdge.nx, 'NX')) {
      const color = getEdgeColor('NX');
      const intensity = 1.0;

      edgeList.push(
        { start: [-halfSize - eps, -halfSize, -halfSize], end: [-halfSize - eps, halfSize, -halfSize], color, intensity, pulsePhase },
        { start: [-halfSize - eps, -halfSize, halfSize], end: [-halfSize - eps, halfSize, halfSize], color, intensity, pulsePhase },
        { start: [-halfSize - eps, -halfSize, -halfSize], end: [-halfSize - eps, -halfSize, halfSize], color, intensity, pulsePhase },
        { start: [-halfSize - eps, halfSize, -halfSize], end: [-halfSize - eps, halfSize, halfSize], color, intensity, pulsePhase }
      );
    }

    // Top face (PY) - 4 edges
    if (faceGlows(isOnEdge.py, 'PY')) {
      const color = getEdgeColor('PY');
      const intensity = 1.0;

      edgeList.push(
        { start: [-halfSize, halfSize + eps, -halfSize], end: [halfSize, halfSize + eps, -halfSize], color, intensity, pulsePhase },
        { start: [-halfSize, halfSize + eps, halfSize], end: [halfSize, halfSize + eps, halfSize], color, intensity, pulsePhase },
        { start: [-halfSize, halfSize + eps, -halfSize], end: [-halfSize, halfSize + eps, halfSize], color, intensity, pulsePhase },
        { start: [halfSize, halfSize + eps, -halfSize], end: [halfSize, halfSize + eps, halfSize], color, intensity, pulsePhase }
      );
    }

    // Bottom face (NY) - 4 edges
    if (faceGlows(isOnEdge.ny, 'NY')) {
      const color = getEdgeColor('NY');
      const intensity = 1.0;

      edgeList.push(
        { start: [-halfSize, -halfSize - eps, -halfSize], end: [halfSize, -halfSize - eps, -halfSize], color, intensity, pulsePhase },
        { start: [-halfSize, -halfSize - eps, halfSize], end: [halfSize, -halfSize - eps, halfSize], color, intensity, pulsePhase },
        { start: [-halfSize, -halfSize - eps, -halfSize], end: [-halfSize, -halfSize - eps, halfSize], color, intensity, pulsePhase },
        { start: [halfSize, -halfSize - eps, -halfSize], end: [halfSize, -halfSize - eps, halfSize], color, intensity, pulsePhase }
      );
    }

    return edgeList;
  }, [effectiveVisualMode, isOnEdge, size, faceColors, stickerColorKey, powerView, wormNeon, wormFlipKey]);

  // Mirror mode: derive this piece's intrinsic box dimensions from its *original*
  // home position (origHomeX/Y/Z above), not its current grid slot. rotateSliceCubies
  // writes new x/y/z on every move, but origPos is set once in makeCubies and preserved
  // by the {...src} spread, so each piece keeps its own unique shape as it travels
  // around the lattice — the core mechanic of a mirror cube.
  const mirrorDims = useMemo(() => {
    if (!mirrorMode) return null;
    return getMirrorDimensions(origHomeX, origHomeY, origHomeZ, size);
  }, [mirrorMode, origHomeX, origHomeY, origHomeZ, size]);

  // CubeAssembly owns the inner group's grid position and live slice rotation.
  // Offset the entire piece in a separate parent, along that LIVE centre vector:
  // a corner's three faces move together, and the displacement rotates with it.
  const popGroupRef = useRef();
  const pieceRef = useRef();
  useImperativeHandle(ref, () => pieceRef.current, []);
  const popKey = `${cubie.x},${cubie.y},${cubie.z}`;
  const liftSpring = useRaisedCubieSpring(`${size}:${origHomeX},${origHomeY},${origHomeZ}`);
  const poppedRef = useRef(false);
  const raised = (!wormMode || wormPads) && (wormPads || (!mirrorMode && settings?.flipPads !== 'off'))
    && cubieHasFlippedFace(cubie, effectiveFlipCap);
  // Mega normally omits individual bodies. Materialize a body for a raised
  // piece and keep it through its return; otherwise it would still be a sheet.
  const [returningBody, setReturningBody] = useState(false);
  useEffect(() => { if (raised && omitBody) setReturningBody(true); }, [raised, omitBody]);


  useFrame((_state, delta) => {
    const spring = liftSpring.current;
    // Chaos lightning jolts: an empty map costs one size check per idle cubie.
    const kick = cubieKicks.size ? cubieKicks.get(popKey) : undefined;
    if (!kick && !_anyCubiePops && !poppedRef.current && !raised && spring.lift === 0) return;
    if (!popGroupRef.current || !pieceRef.current) return;
    const state = useGameStore.getState();
    const reduced = settings?.reducedMotion || prefersReducedMotion();
    if (wormPads) {
      advancePlatformFormation(spring, raised, platformFormationHeld(state) ? 0 : delta, reduced);
      pieceRef.current.userData.wormPlatformFormation = spring;
    } else if (reduced) { spring.lift = raised ? 1 : 0; spring.velocity = 0; }
    else advancePieceSpring(spring, raised ? 1 : 0, Math.min(delta, 0.05));
    if (!wormPads) delete pieceRef.current.userData.wormPlatformFormation;
    // WORM eases to tape height; cube modes retain their small springing pop.
    const amount = Math.max(0, spring.lift) * (wormPads ? wormRaisedAmount(size) : cubeRaisedAmount(size));
    publishRaisedCubie(spring, amount);
    const entry = state.cubiePops[popKey];
    const rawT = entry ? (performance.now() - entry.startMs) / entry.durationMs : 1;
    const impact = !wormPads && !reduced && entry && rawT >= 0 && rawT < 1 ? Math.sin(rawT * Math.PI) * 1.5 : 0;
    const center = pieceRef.current.position;
    const ratio = selectiveCubieOffsetRatio(size, state.explosionT, amount);
    // Preserve the original impact hop, but do not add a second full explosion.
    const distance = Math.max(center.length() * ratio, impact);
    popGroupRef.current.position.copy(center).normalize().multiplyScalar(distance);
    if (kick) {
      // The strike punches the whole piece in along the struck face's normal and
      // lets it rebound — on top of the lift, so a raised piece takes the hit too.
      const elapsed = performance.now() - kick.startMs;
      if (elapsed >= KICK_DURATION_MS) {
        if (cubieKicks.get(popKey) === kick) cubieKicks.delete(popKey);
      } else {
        const k = cubieKickAmount(elapsed, kick.amp);
        popGroupRef.current.position.x += kick.x * k;
        popGroupRef.current.position.y += kick.y * k;
        popGroupRef.current.position.z += kick.z * k;
      }
    }
    poppedRef.current = distance > 0 || spring.lift !== 0 || !!kick;
    if (!raised && spring.lift === 0 && returningBody) setReturningBody(false);
  }, -0.75); // after CubeAssembly (-1), before pad stalks (-0.5) and tunnel anchors

  return (
    <group ref={popGroupRef}>
    <group position={explodedPos} ref={pieceRef}>
    <group scale={contentScale}>
      {/* Mirror mode: plain asymmetric box with chrome material, no stickers */}
      {mirrorMode ? (
        <mesh onPointerDown={handleDown} castShadow={enableShadows} receiveShadow={enableShadows}>
          <boxGeometry args={mirrorDims} />
          <meshStandardMaterial color="#c8c8c8" roughness={0.08} metalness={0.92} envMapIntensity={1.2}
            transparent={wormWindow} opacity={wormWindow ? 0.16 : 1} depthWrite={!wormWindow} />
        </mesh>
      ) : effectiveHollowMode ? (
        <>
          {/* Invisible hit box for pointer events */}
          <mesh onPointerDown={handleDown} visible={false}>
            <boxGeometry args={[0.98, 0.98, 0.98]} />
          </mesh>

          {/* Shared merged beams keep the open frame with one draw per cubie. */}
          <mesh castShadow={enableShadows} receiveShadow={enableShadows} dispose={null}
            geometry={hollowFrameGeometry} material={getHollowBeamMaterial(effectiveVisualMode)} />
        </>
      ) : omitBody && !raised && !returningBody ? null : hideBody ? (
        // Exit-arm ride: camera is inside the cube and the solid body would occlude the
        // antipodal back-face stickers, so swap it for an invisible hit box (pointer
        // interaction stays intact, but nothing opaque sits between camera and stickers).
        <mesh onPointerDown={handleDown} visible={false}>
          <boxGeometry args={[0.98, 0.98, 0.98]} />
        </mesh>
      ) : (
        // In worm mode the body is a see-through shell, so it sorts with the other
        // transparent objects — by origin, back to front. A layer laid over the whole
        // cube (the elemental skins, patches) has its origin at the cube's centre, so
        // the nearer bodies drew AFTER it and painted their 0.8-opacity faces over it
        // wherever no opaque sticker sat in front: every seam turned into a black
        // bar across the water, the moss and the fire's lava cracks. Drawing bodies
        // first fixes that. Raised WORM pieces keep a translucent shell without
        // writing depth, revealing the band underneath their lifted tile.
        <RoundedBox args={wormMode ? [0.92, 0.92, 0.92] : [0.98, 0.98, 0.98]} radius={0.08} smoothness={4} onPointerDown={handleDown} castShadow={enableShadows} receiveShadow={enableShadows} renderOrder={wormMode ? -1 : 0}>
          <meshStandardMaterial {...bodyMatProps} />
        </RoundedBox>
      )}

      {/* LED edges for wireframe + neon (skip in hollow/mirror mode).
          All of this cubie's edges render as one segmented, vertex-colored line with a
          single pulse subscription — one draw instead of up to 12. */}
      {showLedEdges && !effectiveHollowMode && !mirrorMode && wireframeEdges.length > 0 && (
        <MergedLedEdges edges={wireframeEdges} />
      )}

      {/* Stickers — frame-shaped when hollow, solid plane otherwise; none in mirror/wireframe mode. */}
      {effectiveVisualMode !== 'wireframe' && !mirrorMode && (
        <>
          {isEdge(position[2], (size - 1) / 2) && meta('PZ') && <StickerPlane key={stickerKey('PZ')} currentDir="PZ" surfaceTileKey={`${cubie.x},${cubie.y},${cubie.z},PZ`} meta={meta('PZ')} pos={STICKER_POS.PZ} rot={STICKER_ROT.PZ} mode={effectiveVisualMode} overlay={overlay('PZ')} faceSize={size} {...gridPos('PZ')} hollow={effectiveHollowMode} />}
          {isEdge(position[2], -(size - 1) / 2) && meta('NZ') && <StickerPlane key={stickerKey('NZ')} currentDir="NZ" surfaceTileKey={`${cubie.x},${cubie.y},${cubie.z},NZ`} meta={meta('NZ')} pos={STICKER_POS.NZ} rot={STICKER_ROT.NZ} mode={effectiveVisualMode} overlay={overlay('NZ')} faceSize={size} {...gridPos('NZ')} hollow={effectiveHollowMode} />}
          {isEdge(position[0], (size - 1) / 2) && meta('PX') && <StickerPlane key={stickerKey('PX')} currentDir="PX" surfaceTileKey={`${cubie.x},${cubie.y},${cubie.z},PX`} meta={meta('PX')} pos={STICKER_POS.PX} rot={STICKER_ROT.PX} mode={effectiveVisualMode} overlay={overlay('PX')} faceSize={size} {...gridPos('PX')} hollow={effectiveHollowMode} />}
          {isEdge(position[0], -(size - 1) / 2) && meta('NX') && <StickerPlane key={stickerKey('NX')} currentDir="NX" surfaceTileKey={`${cubie.x},${cubie.y},${cubie.z},NX`} meta={meta('NX')} pos={STICKER_POS.NX} rot={STICKER_ROT.NX} mode={effectiveVisualMode} overlay={overlay('NX')} faceSize={size} {...gridPos('NX')} hollow={effectiveHollowMode} />}
          {isEdge(position[1], (size - 1) / 2) && meta('PY') && <StickerPlane key={stickerKey('PY')} currentDir="PY" surfaceTileKey={`${cubie.x},${cubie.y},${cubie.z},PY`} meta={meta('PY')} pos={STICKER_POS.PY} rot={STICKER_ROT.PY} mode={effectiveVisualMode} overlay={overlay('PY')} faceSize={size} {...gridPos('PY')} hollow={effectiveHollowMode} />}
          {isEdge(position[1], -(size - 1) / 2) && meta('NY') && <StickerPlane key={stickerKey('NY')} currentDir="NY" surfaceTileKey={`${cubie.x},${cubie.y},${cubie.z},NY`} meta={meta('NY')} pos={STICKER_POS.NY} rot={STICKER_ROT.NY} mode={effectiveVisualMode} overlay={overlay('NY')} faceSize={size} {...gridPos('NY')} hollow={effectiveHollowMode} />}
        </>
      )}

      {/* Lego stud — one detailed stud on each visible face, colored by the face's current sticker */}
      {isLego && !mirrorMode && !effectiveHollowMode && (
        <>
          {isEdge(position[2], (size - 1) / 2) && meta('PZ') && <LegoStud dir="PZ" color={getEdgeColor('PZ')} enableShadows={enableShadows} />}
          {isEdge(position[2], -(size - 1) / 2) && meta('NZ') && <LegoStud dir="NZ" color={getEdgeColor('NZ')} enableShadows={enableShadows} />}
          {isEdge(position[0], (size - 1) / 2) && meta('PX') && <LegoStud dir="PX" color={getEdgeColor('PX')} enableShadows={enableShadows} />}
          {isEdge(position[0], -(size - 1) / 2) && meta('NX') && <LegoStud dir="NX" color={getEdgeColor('NX')} enableShadows={enableShadows} />}
          {isEdge(position[1], (size - 1) / 2) && meta('PY') && <LegoStud dir="PY" color={getEdgeColor('PY')} enableShadows={enableShadows} />}
          {isEdge(position[1], -(size - 1) / 2) && meta('NY') && <LegoStud dir="NY" color={getEdgeColor('NY')} enableShadows={enableShadows} />}
        </>
      )}
    </group>
    </group>
    </group>
  );
});

// Sticker direction keys — used by propsAreEqual to avoid Object.keys() per comparison.
const _DIRS = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];

// Semantic equality for Cubie props.
// Default React.memo uses reference equality for the `cubie` object, which is
// correct for rotation (rotateSliceCubies preserves references for non-slice cubies).
// A custom comparator also handles undo/reset paths where sticker data may be
// structurally identical despite a new object reference, and makes position
// comparison element-wise so future refactors can't silently regress it.
function cubiePropsAreEqual(prev, next) {
  if (prev.size !== next.size || prev.onPointerDown !== next.onPointerDown) return false;
  if (prev.wormMode !== next.wormMode || prev.hideBody !== next.hideBody || prev.omitBody !== next.omitBody) return false;
  if (
    prev.position[0] !== next.position[0] ||
    prev.position[1] !== next.position[1] ||
    prev.position[2] !== next.position[2]
  ) return false;
  const pc = prev.cubie, nc = next.cubie;
  if (pc === nc) return true;
  if (pc.x !== nc.x || pc.y !== nc.y || pc.z !== nc.z) return false;
  for (let i = 0; i < _DIRS.length; i++) {
    const d = _DIRS[i];
    const ps = pc.stickers[d], ns = nc.stickers[d];
    if (ps === ns) continue;
    if (!ps || !ns) return false;
    if (ps.curr !== ns.curr || ps.flips !== ns.flips) return false;
    // Two same-colour stickers can exchange grid slots during a rotation. Their
    // visible state is identical, but their animation registration and manifold
    // identity are not. Treating them as equal strands StickerPlane with stale
    // metadata/surface wiring, so Worm pressure wakes a callback in a different
    // slot and apparently random body tiles stay flat and dark.
    if (ps.orig !== ns.orig || ps.origDir !== ns.origDir) return false;
    if (
      ps.origPos?.x !== ns.origPos?.x ||
      ps.origPos?.y !== ns.origPos?.y ||
      ps.origPos?.z !== ns.origPos?.z
    ) return false;
  }
  return true;
}

export default React.memo(Cubie, cubiePropsAreEqual);
