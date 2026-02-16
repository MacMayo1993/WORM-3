// src/game/cubeRotation.js
// Cube rotation logic
import { DIR_TO_VEC, VEC_TO_DIR } from '../utils/constants.js';
import { clone3D } from './cubeState.js';

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

// Rotate stickers on a cubie (remap keys to match new face orientation)
export const rotateStickers = (stickers, axis, dir) => {
  const next = {};
  for (const [k, st] of Object.entries(stickers)) {
    const [vx, vy, vz] = DIR_TO_VEC[k];
    const [rx, ry, rz] = rotateVec90(vx, vy, vz, axis, dir);
    next[VEC_TO_DIR(rx, ry, rz)] = st;
  }
  return next;
};

// Rotate a slice of cubies around an axis
export const rotateSliceCubies = (cubies, size, axis, sliceIndex, dir) => {
  const k = (size - 1) / 2, next = clone3D(cubies), moves = [];

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const inSlice = (axis === 'col' && x === sliceIndex) ||
                        (axis === 'row' && y === sliceIndex) ||
                        (axis === 'depth' && z === sliceIndex);
        if (!inSlice) continue;

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
      }
    }
  }

  const originals = new Map();
  for (const m of moves) {
    originals.set(m.from.join(','), next[m.from[0]][m.from[1]][m.from[2]]);
  }

  for (const m of moves) {
    const src = originals.get(m.from.join(','));
    next[m.to[0]][m.to[1]][m.to[2]] = {
      ...src,
      x: m.to[0], y: m.to[1], z: m.to[2],
      stickers: rotateStickers(src.stickers, axis, dir)
    };
  }

  return next;
};
