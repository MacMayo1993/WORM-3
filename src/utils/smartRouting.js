// src/utils/smartRouting.js
// Smart tunnel routing that avoids cube intersection
import * as THREE from 'three';

/**
 * Calculate a control point for bezier curve that avoids the cube
 * @param start - Start position [x, y, z]
 * @param end - End position [x, y, z]
 * @param size - Cube size
 * @param side - Which side to curve towards: 1 for positive, -1 for negative (default: auto-detect)
 */
export const calculateSmartControlPoint = (start, end, size, side = null) => {
  const vStart = new THREE.Vector3(...start);
  const vEnd = new THREE.Vector3(...end);
  const midPoint = new THREE.Vector3().addVectors(vStart, vEnd).multiplyScalar(0.5);

  // Calculate which axis the tunnel travels along
  const delta = new THREE.Vector3().subVectors(vEnd, vStart);
  const dx = Math.abs(delta.x);
  const dy = Math.abs(delta.y);
  const dz = Math.abs(delta.z);

  const cubeRadius = ((size - 1) / 2) * 1.4;

  // Push perpendicular to the tunnel's main axis
  // If side is specified, use that; otherwise auto-detect based on midpoint
  if (dx >= dy && dx >= dz) {
    // X-axis tunnel - push along Y or Z
    if (Math.abs(midPoint.y) >= Math.abs(midPoint.z)) {
      const autoSide = midPoint.y >= 0 ? 1 : -1;
      midPoint.y = (side !== null ? side : autoSide) * cubeRadius;
    } else {
      const autoSide = midPoint.z >= 0 ? 1 : -1;
      midPoint.z = (side !== null ? side : autoSide) * cubeRadius;
    }
  } else if (dy >= dx && dy >= dz) {
    // Y-axis tunnel - push along X or Z
    if (Math.abs(midPoint.x) >= Math.abs(midPoint.z)) {
      const autoSide = midPoint.x >= 0 ? 1 : -1;
      midPoint.x = (side !== null ? side : autoSide) * cubeRadius;
    } else {
      const autoSide = midPoint.z >= 0 ? 1 : -1;
      midPoint.z = (side !== null ? side : autoSide) * cubeRadius;
    }
  } else {
    // Z-axis tunnel - push along X or Y
    if (Math.abs(midPoint.x) >= Math.abs(midPoint.y)) {
      const autoSide = midPoint.x >= 0 ? 1 : -1;
      midPoint.x = (side !== null ? side : autoSide) * cubeRadius;
    } else {
      const autoSide = midPoint.y >= 0 ? 1 : -1;
      midPoint.y = (side !== null ? side : autoSide) * cubeRadius;
    }
  }

  return midPoint;
};
