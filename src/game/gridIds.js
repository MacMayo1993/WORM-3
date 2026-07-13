// src/game/gridIds.js
// Pure grid/manifold-ID math, extracted from coordinates.js so that code which
// cannot afford the Three.js import chain (the chaos worker) can share the ONE
// canonical implementation. The chaos worker previously carried its own copy of
// these formulas which had drifted for the NX/NY/NZ faces — giving the worker a
// different antipodal pairing than the main thread and silently desyncing the
// two copies of the cube. Every consumer must go through this module.
import { SURFACE_OFFSET } from '../utils/constants.js';

// Get row/column position for a face direction
export const faceRCFor = (dirKey, x, y, z, size) => {
  if (dirKey === 'PZ') {
    return { r: size - 1 - y, c: x };
  }
  if (dirKey === 'NZ') {
    return { r: y, c: size - 1 - x };
  }
  if (dirKey === 'PX') {
    return { r: size - 1 - y, c: size - 1 - z };
  }
  if (dirKey === 'NX') {
    return { r: y, c: z };
  }
  if (dirKey === 'PY') {
    return { r: z, c: x };
  }
  // NY
  return { r: size - 1 - z, c: size - 1 - x };
};

// Get grid (r,c) position for a sticker based on its original position
// Ensures M*-001 is always top-left when viewing face head-on
export const getGridRC = (origPos, origDir, size) => faceRCFor(origDir, origPos.x, origPos.y, origPos.z, size);

// Get manifold-grid ID like "M1-001"
export const getManifoldGridId = (sticker, size) => {
  const { r, c } = getGridRC(sticker.origPos, sticker.origDir, size);
  const idx = r * size + c + 1;
  const idStr = String(idx).padStart(3, '0');
  return `M${sticker.orig}-${idStr}`;
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

  switch (dirKey) {
    case 'PX': return [exploded[0] + SURFACE_OFFSET, exploded[1], exploded[2]];
    case 'NX': return [exploded[0] - SURFACE_OFFSET, exploded[1], exploded[2]];
    case 'PY': return [exploded[0], exploded[1] + SURFACE_OFFSET, exploded[2]];
    case 'NY': return [exploded[0], exploded[1] - SURFACE_OFFSET, exploded[2]];
    case 'PZ': return [exploded[0], exploded[1], exploded[2] + SURFACE_OFFSET];
    case 'NZ': return [exploded[0], exploded[1], exploded[2] - SURFACE_OFFSET];
    default: return exploded;
  }
};
