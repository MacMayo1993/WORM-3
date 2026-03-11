import React, { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS, FACE_COLORS } from '../utils/constants.js';
import { getEdgeFlags } from '../game/cubeUtils.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';
import StickerPlane from './StickerPlane.jsx';
import WireframeEdge from './WireframeEdge.jsx';
import { getMirrorDimensions } from '../game/mirrorBlocks.js';
import { resolveColors } from '../utils/colorSchemes.js';

// Hollow cube edge beams — 12 beams forming a skeletal cube frame
const EDGE_H = 0.49; // half of cube size
const BEAM_T = 0.04;  // beam half-thickness — slimmer for a more open cage

// Dimension arrays for each beam orientation (used by declarative <boxGeometry>)
const BEAM_DIMS = {
  x: [EDGE_H * 2, BEAM_T * 2, BEAM_T * 2],
  y: [BEAM_T * 2, EDGE_H * 2, BEAM_T * 2],
  z: [BEAM_T * 2, BEAM_T * 2, EDGE_H * 2],
};

const HOLLOW_EDGES = [
  // X-axis edges (4)
  { pos: [0, -EDGE_H, -EDGE_H], geo: 'x' },
  { pos: [0, -EDGE_H, EDGE_H], geo: 'x' },
  { pos: [0, EDGE_H, -EDGE_H], geo: 'x' },
  { pos: [0, EDGE_H, EDGE_H], geo: 'x' },
  // Y-axis edges (4)
  { pos: [-EDGE_H, 0, -EDGE_H], geo: 'y' },
  { pos: [-EDGE_H, 0, EDGE_H], geo: 'y' },
  { pos: [EDGE_H, 0, -EDGE_H], geo: 'y' },
  { pos: [EDGE_H, 0, EDGE_H], geo: 'y' },
  // Z-axis edges (4)
  { pos: [-EDGE_H, -EDGE_H, 0], geo: 'z' },
  { pos: [-EDGE_H, EDGE_H, 0], geo: 'z' },
  { pos: [EDGE_H, -EDGE_H, 0], geo: 'z' },
  { pos: [EDGE_H, EDGE_H, 0], geo: 'z' },
];

// Shared hollow beam materials — one per visualMode string.
// 12 beams × 27 cubies = 324 draws, but only 3 material instances (classic/wireframe/glass).
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

// Helper functions for grid and sudokube modes
const faceRCFor = (dirKey, x, y, z, size) => {
  if (dirKey === 'PZ') {
    return { r: size - 1 - y, c: x };
  }
  if (dirKey === 'NZ') {
    return { r: size - 1 - y, c: size - 1 - x };
  }
  if (dirKey === 'PX') {
    return { r: size - 1 - y, c: size - 1 - z };
  }
  if (dirKey === 'NX') {
    return { r: size - 1 - y, c: z };
  }
  if (dirKey === 'PY') {
    return { r: z, c: x };
  }
  // NY
  return { r: size - 1 - z, c: x };
};

const faceValue = (dirKey, x, y, z, size) => {
  const { r, c } = faceRCFor(dirKey, x, y, z, size);
  // Latin square: value = (row + col) mod size + 1
  return ((r + c) % size) + 1;
};

const Cubie = React.forwardRef(function Cubie({
  position, cubie, size, onPointerDown,
}, ref) {
  const { hollowMode, mirrorMode, visualMode, explosionFactor, settings } = useGameStore(
    useShallow(s => ({
      hollowMode: s.hollowMode,
      mirrorMode: s.mirrorMode,
      visualMode: s.visualMode,
      explosionFactor: s.explosionT,
      settings: s.settings,
    }))
  );
  // faceColors needed locally for wireframe edge coloring
  const faceColors = useMemo(() => resolveColors(settings, settings?.biomeMode?.faceAssignment), [settings]);
  const isEdge = (p, v) => Math.abs(p - v) < 0.01;

  const explodedPos = useMemo(() => {
    if (explosionFactor === 0) return position;
    const expansionFactor = 1.8;
    return [
      position[0] * (1 + explosionFactor * expansionFactor),
      position[1] * (1 + explosionFactor * expansionFactor),
      position[2] * (1 + explosionFactor * expansionFactor)
    ];
  }, [position, explosionFactor]);

  const handleDown = (e) => {
    e.stopPropagation();
    onPointerDown({ pos: { x: cubie.x, y: cubie.y, z: cubie.z }, worldPos: new THREE.Vector3(...position), event: e });
  };

  const meta = (d) => cubie.stickers[d] || null;

  // Stable logical identity for a sticker piece (face + original cubie coordinates).
  // Cube rotations swap which logical sticker occupies each rendered face slot.
  // Keying StickerPlane by this identity forces a remount when that swap happens,
  // so refs initialized from `meta` (gridId, flip timeline, etc.) never stay bound
  // to the previous sticker and bleed styles onto the wrong corner tile.
  const stickerKey = (dirKey) => {
    const m = meta(dirKey);
    if (!m?.origPos) return `${dirKey}-empty`;
    const { x, y, z } = m.origPos;
    return `${dirKey}-${m.orig}-${x}-${y}-${z}`;
  };

  const gridPos = (dirKey) => {
    const m = meta(dirKey);
    if (!m?.origPos) return {};
    const { r, c } = faceRCFor(m.origDir, m.origPos.x, m.origPos.y, m.origPos.z, size);
    return { faceRow: r, faceCol: c };
  };

  const overlay = (dirKey) => {
    const m = meta(dirKey); if (!m) return '';
    if (visualMode === 'grid') {
      const { r, c } = faceRCFor(m.origDir, m.origPos.x, m.origPos.y, m.origPos.z, size);
      const idx = r * size + c + 1;
      const idStr = String(idx).padStart(3, '0');
      return `M${m.curr}-${idStr}`;
    }
    if (visualMode === 'sudokube') {
      const v = faceValue(dirKey, cubie.x, cubie.y, cubie.z, size);
      return String(v);
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
  // Skipped (empty string) when not in wireframe mode to avoid wasted work.
  const stickerColorKey = visualMode === 'wireframe'
    ? `${cubie.stickers.PZ?.curr},${cubie.stickers.NZ?.curr},${cubie.stickers.PX?.curr},${cubie.stickers.NX?.curr},${cubie.stickers.PY?.curr},${cubie.stickers.NY?.curr}`
    : '';

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Generate wireframe edges for wireframe mode ONLY
  const wireframeEdges = useMemo(() => {
    if (visualMode !== 'wireframe') return [];

    const halfSize = 0.49;
    const eps = 0.01;
    const edgeList = [];

    // Front face (PZ) - 4 edges
    if (isOnEdge.pz) {
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
    if (isOnEdge.nz) {
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
    if (isOnEdge.px) {
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
    if (isOnEdge.nx) {
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
    if (isOnEdge.py) {
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
    if (isOnEdge.ny) {
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
  }, [visualMode, isOnEdge, size, faceColors, stickerColorKey]);

  // Mirror mode: derive this piece's intrinsic box dimensions from its *original*
  // home position (origPos), not its current grid slot.  rotateSliceCubies writes
  // new x/y/z on every move, but origPos is set once in makeCubies and preserved
  // by the {...src} spread in rotateSliceCubies.  Using origPos means each piece
  // keeps its own unique shape as it travels around the lattice — the core
  // mechanic of a mirror cube.  Interior pieces (no stickers) use current
  // position as a safe fallback; they're not part of the scramble identity.
  //
  // Use primitive origPos coordinates as deps instead of `cubie.stickers` (a new
  // object reference on every rotation) to avoid spurious recalculations.
  const _firstStickerOrigPos = Object.values(cubie.stickers)[0]?.origPos;
  const origHomeX = _firstStickerOrigPos?.x ?? cubie.x;
  const origHomeY = _firstStickerOrigPos?.y ?? cubie.y;
  const origHomeZ = _firstStickerOrigPos?.z ?? cubie.z;
  const mirrorDims = useMemo(() => {
    if (!mirrorMode) return null;
    return getMirrorDimensions(origHomeX, origHomeY, origHomeZ, size);
  }, [mirrorMode, origHomeX, origHomeY, origHomeZ, size]);

  return (
    <group position={explodedPos} ref={ref}>
      {/* Mirror mode: plain asymmetric box with chrome material, no stickers */}
      {mirrorMode ? (
        <mesh onPointerDown={handleDown} castShadow receiveShadow>
          <boxGeometry args={mirrorDims} />
          <meshStandardMaterial color="#c8c8c8" roughness={0.08} metalness={0.92} envMapIntensity={1.2} />
        </mesh>
      ) : hollowMode ? (
        <>
          {/* Invisible hit box for pointer events */}
          <mesh onPointerDown={handleDown} visible={false}>
            <boxGeometry args={[0.98, 0.98, 0.98]} />
          </mesh>

          {/* 12 edge beams forming a hollow cube frame */}
          {HOLLOW_EDGES.map((edge, idx) => (
            <mesh key={idx} position={edge.pos} castShadow receiveShadow>
              <boxGeometry args={BEAM_DIMS[edge.geo]} />
              <primitive object={getHollowBeamMaterial(visualMode)} attach="material" />
            </mesh>
          ))}
        </>
      ) : (
        <RoundedBox args={[0.98, 0.98, 0.98]} radius={0.08} smoothness={4} onPointerDown={handleDown} castShadow receiveShadow>
          <meshStandardMaterial
            color={visualMode === 'wireframe' ? "#000000" : visualMode === 'glass' ? "#111111" : "#0a0a0a"}
            roughness={visualMode === 'wireframe' ? 0.9 : visualMode === 'glass' ? 0.05 : 0.25}
            metalness={visualMode === 'wireframe' ? 0 : visualMode === 'glass' ? 0.3 : 0.15}
            envMapIntensity={visualMode === 'glass' ? 0.8 : 0.4}
            transparent={visualMode === 'glass'}
            opacity={visualMode === 'glass' ? 0.12 : 1.0}
          />
        </RoundedBox>
      )}

      {/* LED Wireframe edges ONLY in wireframe mode (skip in hollow/mirror mode) */}
      {visualMode === 'wireframe' && !hollowMode && !mirrorMode && wireframeEdges.map((edge, idx) => (
        <WireframeEdge
          key={idx}
          start={edge.start}
          end={edge.end}
          color={edge.color}
          intensity={edge.intensity}
          pulsePhase={edge.pulsePhase}
        />
      ))}

      {/* Stickers — frame-shaped when hollow, solid plane otherwise; none in mirror mode */}
      {visualMode !== 'wireframe' && !mirrorMode && (
        <>
          {isEdge(position[2], (size - 1) / 2) && meta('PZ') && <StickerPlane key={stickerKey('PZ')} currentDir="PZ" meta={meta('PZ')} pos={STICKER_POS.PZ} rot={STICKER_ROT.PZ} mode={visualMode} overlay={overlay('PZ')} faceSize={size} {...gridPos('PZ')} hollow={hollowMode} />}
          {isEdge(position[2], -(size - 1) / 2) && meta('NZ') && <StickerPlane key={stickerKey('NZ')} currentDir="NZ" meta={meta('NZ')} pos={STICKER_POS.NZ} rot={STICKER_ROT.NZ} mode={visualMode} overlay={overlay('NZ')} faceSize={size} {...gridPos('NZ')} hollow={hollowMode} />}
          {isEdge(position[0], (size - 1) / 2) && meta('PX') && <StickerPlane key={stickerKey('PX')} currentDir="PX" meta={meta('PX')} pos={STICKER_POS.PX} rot={STICKER_ROT.PX} mode={visualMode} overlay={overlay('PX')} faceSize={size} {...gridPos('PX')} hollow={hollowMode} />}
          {isEdge(position[0], -(size - 1) / 2) && meta('NX') && <StickerPlane key={stickerKey('NX')} currentDir="NX" meta={meta('NX')} pos={STICKER_POS.NX} rot={STICKER_ROT.NX} mode={visualMode} overlay={overlay('NX')} faceSize={size} {...gridPos('NX')} hollow={hollowMode} />}
          {isEdge(position[1], (size - 1) / 2) && meta('PY') && <StickerPlane key={stickerKey('PY')} currentDir="PY" meta={meta('PY')} pos={STICKER_POS.PY} rot={STICKER_ROT.PY} mode={visualMode} overlay={overlay('PY')} faceSize={size} {...gridPos('PY')} hollow={hollowMode} />}
          {isEdge(position[1], -(size - 1) / 2) && meta('NY') && <StickerPlane key={stickerKey('NY')} currentDir="NY" meta={meta('NY')} pos={STICKER_POS.NY} rot={STICKER_ROT.NY} mode={visualMode} overlay={overlay('NY')} faceSize={size} {...gridPos('NY')} hollow={hollowMode} />}
        </>
      )}
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
  }
  return true;
}

export default React.memo(Cubie, cubiePropsAreEqual);
