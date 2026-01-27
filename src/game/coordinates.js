// src/game/coordinates.js
// Grid and position calculation utilities
import * as THREE from 'three';

// Get grid (r,c) position for a sticker based on its original position
// Ensures M*-001 is always top-left when viewing face head-on
export const getGridRC = (origPos, origDir, size) => {
  const { x, y, z } = origPos;

  if (origDir === 'PZ') {
    // Red face (front) - viewed from front
    return { r: size - 1 - y, c: x };
  }
  if (origDir === 'NZ') {
    // Orange face (back) - viewed from back (flipped horizontally)
    return { r: size - 1 - y, c: size - 1 - x };
  }
  if (origDir === 'PX') {
    // Blue face (right) - viewed from right
    return { r: size - 1 - y, c: size - 1 - z };
  }
  if (origDir === 'NX') {
    // Green face (left) - viewed from left (flipped horizontally)
    return { r: size - 1 - y, c: z };
  }
  if (origDir === 'PY') {
    // White face (top) - viewed from top, looking down from +Y
    return { r: z, c: x };
  }
  // NY - Yellow face (bottom) - viewed from bottom, looking up from -Y
  return { r: size - 1 - z, c: x };
};

// Get manifold-grid ID like "M1-001"
export const getManifoldGridId = (sticker, size) => {
  const { r, c } = getGridRC(sticker.origPos, sticker.origDir, size);
  const idx = r * size + c + 1;
  const idStr = String(idx).padStart(3, '0');
  return `M${sticker.orig}-${idStr}`;
};

// Get row/column position for a face direction
export const faceRCFor = (dirKey, x, y, z, size) => {
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

// Get face value for Latin square (Sudokube mode)
export const faceValue = (dirKey, x, y, z, size) => {
  const { r, c } = faceRCFor(dirKey, x, y, z, size);
  // Latin square: value = (row + col) mod size + 1
  return ((r + c) % size) + 1;
};

// Get sticker world position (with optional explosion factor)
export const getStickerWorldPos = (x, y, z, dirKey, size, explosionFactor = 0) => {
  const k = (size - 1) / 2;
  const base = [x - k, y - k, z - k];

  const exploded = [
    base[0] * (1 + explosionFactor * 1.8),
    base[1] * (1 + explosionFactor * 1.8),
    base[2] * (1 + explosionFactor * 1.8)
  ];

  const offset = 0.52;
  switch (dirKey) {
    case 'PX': return [exploded[0] + offset, exploded[1], exploded[2]];
    case 'NX': return [exploded[0] - offset, exploded[1], exploded[2]];
    case 'PY': return [exploded[0], exploded[1] + offset, exploded[2]];
    case 'NY': return [exploded[0], exploded[1] - offset, exploded[2]];
    case 'PZ': return [exploded[0], exploded[1], exploded[2] + offset];
    case 'NZ': return [exploded[0], exploded[1], exploded[2] - offset];
    default: return exploded;
  }
};

// Cached vectors for getStickerWorldPosFromMesh - avoids GC pressure in hot paths
const _worldPos = new THREE.Vector3();
const _worldQuat = new THREE.Quaternion();
const _localOffset = new THREE.Vector3();

// Get sticker world position from Three.js mesh
// Note: Returns array to avoid exposing cached vector
export const getStickerWorldPosFromMesh = (meshRef, dirKey) => {
  if (!meshRef) return null;

  meshRef.getWorldPosition(_worldPos);
  meshRef.getWorldQuaternion(_worldQuat);

  const offset = 0.52;
  switch (dirKey) {
    case 'PX': _localOffset.set(offset, 0, 0); break;
    case 'NX': _localOffset.set(-offset, 0, 0); break;
    case 'PY': _localOffset.set(0, offset, 0); break;
    case 'NY': _localOffset.set(0, -offset, 0); break;
    case 'PZ': _localOffset.set(0, 0, offset); break;
    case 'NZ': _localOffset.set(0, 0, -offset); break;
    default: _localOffset.set(0, 0, 0); break;
  }

  _localOffset.applyQuaternion(_worldQuat);
  _worldPos.add(_localOffset);

  return [_worldPos.x, _worldPos.y, _worldPos.z];
};
