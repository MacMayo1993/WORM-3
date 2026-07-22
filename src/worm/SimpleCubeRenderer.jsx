// src/worm/SimpleCubeRenderer.jsx
// Lightweight cube renderer for the platformer split-screen views.
// Renders cubies as colored boxes with sticker planes — no interaction, no animation.

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';

// Shared geometries — allocated once at module level so every Sticker and SimpleCubie
// reuses the same Three.js object instead of creating a new one per render.
const _stickerGeo = new THREE.PlaneGeometry(0.88, 0.88);
const _cubieBodyGeo = new THREE.BoxGeometry(0.96, 0.96, 0.96);

// Module-level axis vectors — reused across all frames, never reallocated
const _AXIS_COL = new THREE.Vector3(1, 0, 0);
const _AXIS_ROW = new THREE.Vector3(0, 1, 0);
const _AXIS_DEPTH = new THREE.Vector3(0, 0, 1);

const STICKER_OFFSET = 0.505;

// Default face color map (face ID 1-6 → hex)
const DEFAULT_COLORS = {
  1: '#ef4444', // Red (PZ front)
  2: '#22c55e', // Green (NX left)
  3: '#f8fafc', // White (PY top)
  4: '#f97316', // Orange (NZ back)
  5: '#3b82f6', // Blue (PX right)
  6: '#FFD500', // Yellow (NY bottom)
};

const STICKER_CONFIG = {
  PX: { pos: [STICKER_OFFSET, 0, 0], rot: [0, Math.PI / 2, 0] },
  NX: { pos: [-STICKER_OFFSET, 0, 0], rot: [0, -Math.PI / 2, 0] },
  PY: { pos: [0, STICKER_OFFSET, 0], rot: [-Math.PI / 2, 0, 0] },
  NY: { pos: [0, -STICKER_OFFSET, 0], rot: [Math.PI / 2, 0, 0] },
  PZ: { pos: [0, 0, STICKER_OFFSET], rot: [0, 0, 0] },
  NZ: { pos: [0, 0, -STICKER_OFFSET], rot: [0, Math.PI, 0] },
};

const Sticker = React.memo(function Sticker({ position, rotation, color, isFlipped }) {
  return (
    <mesh position={position} rotation={rotation}>
      <primitive object={_stickerGeo} attach="geometry" />
      <meshStandardMaterial
        color={color}
        emissive={isFlipped ? '#a855f7' : color}
        emissiveIntensity={isFlipped ? 0.6 : 0.1}
        roughness={0.4}
        metalness={0.05}
      />
    </mesh>
  );
});

const SimpleCubie = React.memo(function SimpleCubie({ x, y, z, size, cubies, faceColors }) {
  const k = (size - 1) / 2;
  const cubie = cubies[x]?.[y]?.[z];
  if (!cubie) return null;

  const position = [x - k, y - k, z - k];
  const colors = faceColors || DEFAULT_COLORS;

  return (
    <group position={position}>
      {/* Dark cubie body */}
      <mesh>
        <primitive object={_cubieBodyGeo} attach="geometry" />
        <meshStandardMaterial color="#1a1a2e" roughness={0.8} />
      </mesh>

      {/* Visible stickers */}
      {Object.entries(cubie.stickers || {}).map(([dirKey, sticker]) => {
        const isVisible =
          (dirKey === 'PX' && x === size - 1) ||
          (dirKey === 'NX' && x === 0) ||
          (dirKey === 'PY' && y === size - 1) ||
          (dirKey === 'NY' && y === 0) ||
          (dirKey === 'PZ' && z === size - 1) ||
          (dirKey === 'NZ' && z === 0);

        if (!isVisible) return null;

        const cfg = STICKER_CONFIG[dirKey];
        const color = colors[sticker.curr] || '#888888';
        const isFlipped = sticker.curr !== sticker.orig;

        return (
          <Sticker
            key={dirKey}
            position={cfg.pos}
            rotation={cfg.rot}
            color={color}
            isFlipped={isFlipped}
          />
        );
      })}
    </group>
  );
});

export default function SimpleCubeRenderer({ cubies, size, faceColors, rotationAnim }) {
  // Build list of cubie positions
  const cubieList = useMemo(() => {
    const list = [];
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          if (cubies[x]?.[y]?.[z]) {
            list.push({ x, y, z, key: `${x}-${y}-${z}` });
          }
        }
      }
    }
    return list;
  }, [cubies, size]);

  // Memoize the rotation quaternion — recompute only when the animation parameters change.
  // Stored in a ref so the same Quaternion object is mutated in place rather than
  // allocating a new one on every render.
  const animQuatRef = useRef(new THREE.Quaternion());
  const sliceQuaternion = useMemo(() => {
    if (!rotationAnim) return null;
    const { axis, dir, progress } = rotationAnim;
    const angle = dir * progress * (Math.PI / 2);
    const rotAxis = axis === 'col' ? _AXIS_COL : axis === 'row' ? _AXIS_ROW : _AXIS_DEPTH;
    animQuatRef.current.setFromAxisAngle(rotAxis, angle);
    return animQuatRef.current;
  }, [rotationAnim]);

  // Returns the shared quaternion for cubies in the rotating slice, null otherwise
  const getSliceRotation = (x, y, z) => {
    if (!sliceQuaternion || !rotationAnim) return null;
    const { axis, sliceIndex } = rotationAnim;
    const inSlice = (axis === 'col' && x === sliceIndex) ||
                    (axis === 'row' && y === sliceIndex) ||
                    (axis === 'depth' && z === sliceIndex);
    return inSlice ? sliceQuaternion : null;
  };

  return (
    <group>
      {cubieList.map(({ x, y, z, key }) => {
        const quat = getSliceRotation(x, y, z);
        if (quat) {
          // For rotating cubies: rotate around origin, so wrap in a group that
          // applies the rotation at the origin (the cubie positions itself inside).
          return (
            <group key={key} quaternion={quat}>
              <SimpleCubie x={x} y={y} z={z} size={size} cubies={cubies} faceColors={faceColors} />
            </group>
          );
        }
        return (
          <SimpleCubie key={key} x={x} y={y} z={z} size={size} cubies={cubies} faceColors={faceColors} />
        );
      })}
    </group>
  );
}
