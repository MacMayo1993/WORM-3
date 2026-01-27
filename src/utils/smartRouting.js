// src/utils/smartRouting.js
// Smart tunnel routing that avoids cube intersection
import * as THREE from 'three';

// Cached vectors for reuse - avoids creating new objects on every call
const _vStart = new THREE.Vector3();
const _vEnd = new THREE.Vector3();
const _midPoint = new THREE.Vector3();
const _delta = new THREE.Vector3();
// Output vector that callers should copy from (not mutate)
const _result = new THREE.Vector3();

/**
 * Calculate a control point for bezier curve that avoids the cube
 * @param start - Start position [x, y, z]
 * @param end - End position [x, y, z]
 * @param size - Cube size
 * @param side - Which side to curve towards: 1 for positive, -1 for negative (default: auto-detect)
 * @returns THREE.Vector3 - Note: returns a reused vector, caller should copy if storing
 */
export const calculateSmartControlPoint = (start, end, size, side = null) => {
  _vStart.set(start[0], start[1], start[2]);
  _vEnd.set(end[0], end[1], end[2]);
  _midPoint.addVectors(_vStart, _vEnd).multiplyScalar(0.5);

  // Calculate which axis the tunnel travels along
  _delta.subVectors(_vEnd, _vStart);
  const dx = Math.abs(_delta.x);
  const dy = Math.abs(_delta.y);
  const dz = Math.abs(_delta.z);

  const cubeRadius = ((size - 1) / 2) * 1.4;

  // Push perpendicular to the tunnel's main axis
  // If side is specified, use that; otherwise auto-detect based on midpoint
  if (dx >= dy && dx >= dz) {
    // X-axis tunnel - push along Y or Z
    if (Math.abs(_midPoint.y) >= Math.abs(_midPoint.z)) {
      const autoSide = _midPoint.y >= 0 ? 1 : -1;
      _midPoint.y = (side !== null ? side : autoSide) * cubeRadius;
    } else {
      const autoSide = _midPoint.z >= 0 ? 1 : -1;
      _midPoint.z = (side !== null ? side : autoSide) * cubeRadius;
    }
  } else if (dy >= dx && dy >= dz) {
    // Y-axis tunnel - push along X or Z
    if (Math.abs(_midPoint.x) >= Math.abs(_midPoint.z)) {
      const autoSide = _midPoint.x >= 0 ? 1 : -1;
      _midPoint.x = (side !== null ? side : autoSide) * cubeRadius;
    } else {
      const autoSide = _midPoint.z >= 0 ? 1 : -1;
      _midPoint.z = (side !== null ? side : autoSide) * cubeRadius;
    }
  } else {
    // Z-axis tunnel - push along X or Y
    if (Math.abs(_midPoint.x) >= Math.abs(_midPoint.y)) {
      const autoSide = _midPoint.x >= 0 ? 1 : -1;
      _midPoint.x = (side !== null ? side : autoSide) * cubeRadius;
    } else {
      const autoSide = _midPoint.y >= 0 ? 1 : -1;
      _midPoint.y = (side !== null ? side : autoSide) * cubeRadius;
    }
  }

  // Return a copy to avoid mutation issues with shared reference
  return _result.copy(_midPoint);
};
