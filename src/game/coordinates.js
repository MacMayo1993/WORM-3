// src/game/coordinates.js
// Grid and position calculation utilities
import * as THREE from 'three';
import { SURFACE_OFFSET } from '../utils/constants.js';
import { faceRCFor } from './gridIds.js';

// Pure grid math lives in gridIds.js (no Three.js import) so the chaos worker
// shares the exact same formulas. Re-exported here so existing importers of
// coordinates.js keep working unchanged.
export { faceRCFor, getGridRC, getManifoldGridId, getStickerWorldPos } from './gridIds.js';

// Get face value for Latin square (Sudokube mode)
export const faceValue = (dirKey, x, y, z, size) => {
  const { r, c } = faceRCFor(dirKey, x, y, z, size);
  // Latin square: value = (row + col) mod size + 1
  return ((r + c) % size) + 1;
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

  switch (dirKey) {
    case 'PX': _localOffset.set(SURFACE_OFFSET, 0, 0); break;
    case 'NX': _localOffset.set(-SURFACE_OFFSET, 0, 0); break;
    case 'PY': _localOffset.set(0, SURFACE_OFFSET, 0); break;
    case 'NY': _localOffset.set(0, -SURFACE_OFFSET, 0); break;
    case 'PZ': _localOffset.set(0, 0, SURFACE_OFFSET); break;
    case 'NZ': _localOffset.set(0, 0, -SURFACE_OFFSET); break;
    default: _localOffset.set(0, 0, 0); break;
  }

  _localOffset.applyQuaternion(_worldQuat);
  _worldPos.add(_localOffset);

  return [_worldPos.x, _worldPos.y, _worldPos.z];
};
