// src/utils/smartRouting.js
// Smart tunnel routing that avoids cube intersection
import * as THREE from 'three';

export const calculateSmartControlPoint = (start, end, size) => {
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
  // Choose the perpendicular axis with the larger midpoint component
  if (dx >= dy && dx >= dz) {
    // X-axis tunnel - push along Y or Z
    if (Math.abs(midPoint.y) >= Math.abs(midPoint.z)) {
      midPoint.y = midPoint.y >= 0 ? cubeRadius : -cubeRadius;
    } else {
      midPoint.z = midPoint.z >= 0 ? cubeRadius : -cubeRadius;
    }
  } else if (dy >= dx && dy >= dz) {
    // Y-axis tunnel - push along X or Z
    if (Math.abs(midPoint.x) >= Math.abs(midPoint.z)) {
      midPoint.x = midPoint.x >= 0 ? cubeRadius : -cubeRadius;
    } else {
      midPoint.z = midPoint.z >= 0 ? cubeRadius : -cubeRadius;
    }
  } else {
    // Z-axis tunnel - push along X or Y
    if (Math.abs(midPoint.x) >= Math.abs(midPoint.y)) {
      midPoint.x = midPoint.x >= 0 ? cubeRadius : -cubeRadius;
    } else {
      midPoint.y = midPoint.y >= 0 ? cubeRadius : -cubeRadius;
    }
  }

  return midPoint;
};
