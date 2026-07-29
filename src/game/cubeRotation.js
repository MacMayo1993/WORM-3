// src/game/cubeRotation.js
// Cube rotation logic
import { DIR_TO_VEC, VEC_TO_DIR } from '../utils/constants.js';
import { forEachSliceCoordinate } from './sliceIndex.js';

// Rotate a vector 90 degrees around an axis
export const rotateVec90 = (vx, vy, vz, axis, dir) => {
  if (axis === 'col') {
    const ny = -dir * vz, nz = dir * vy;
    return [vx, ny, nz];
  }
  if (axis === 'row') {
    const nx = dir * vz, nz = -dir * vx;
    return [nx, vy, nz];
  }
  const nx = -dir * vy, ny = dir * vx;
  return [nx, ny, vz];
};

// Rotate stickers on a cubie (remap keys to match new face orientation).
// for...in iterates own enumerable string keys in insertion order without
// allocating a temporary [key,value] tuple array as Object.entries() does
// (~150 throwaway allocations on a 5×5 rotation).
export const rotateStickers = (stickers, axis, dir) => {
  const next = {};
  for (const k in stickers) {
    const [vx, vy, vz] = DIR_TO_VEC[k];
    const [rx, ry, rz] = rotateVec90(vx, vy, vz, axis, dir);
    const newKey = VEC_TO_DIR(rx, ry, rz);
    next[newKey] = { ...stickers[k] };
  }
  return next;
};

// Rotate a slice of cubies around an axis.
// Only deep-clones cubies that are IN the rotating slice — cubies outside the
// slice keep their original object references.  This lets React.memo correctly
// short-circuit re-renders for non-rotating stickers (corners, opposite face, etc.),
// preventing a mass concurrent re-render that would corrupt the InstancedMesh
// color buffer and cause corner stickers to display the wrong color.
export const rotateSliceCubies = (cubies, size, axis, sliceIndex, dir) => {
  const k = (size - 1) / 2;
  const moves = [];

  // Shallow-clone only the outer arrays so we can write new cubie refs
  // without mutating the original state.  Non-slice cubies are shared by reference.
  const next = cubies.map(L => L.map(R => R.slice()));

  // Generate the slice's cells directly instead of walking the whole lattice and
  // discarding the misses: O(size²) rather than O(size³). At size 7 that is 49
  // iterations instead of 343; at the Mega Worm size of 15, 225 instead of 3,375.
  forEachSliceCoordinate(size, axis, sliceIndex, (x, y, z) => {
    let cx = x - k, cy = y - k, cz = z - k;
    if (axis === 'col') {
      const ny = -dir * cz, nz = dir * cy;
      cy = ny; cz = nz;
    } else if (axis === 'row') {
      const nx = dir * cz, nz = -dir * cx;
      cx = nx; cz = nz;
    } else {
      const nx = -dir * cy, ny = dir * cx;
      cx = nx; cy = ny;
    }
    const nxI = Math.round(cx + k), nyI = Math.round(cy + k), nzI = Math.round(cz + k);
    moves.push({ from: [x, y, z], to: [nxI, nyI, nzI] });
  });

  // Snapshot each cubie's original reference before any writes happen
  for (const m of moves) {
    m.original = cubies[m.from[0]][m.from[1]][m.from[2]];
  }

  for (const m of moves) {
    const src = m.original;
    next[m.to[0]][m.to[1]][m.to[2]] = {
      ...src,
      x: m.to[0], y: m.to[1], z: m.to[2],
      stickers: rotateStickers(src.stickers, axis, dir)
    };
  }

  return next;
};
