// src/game/cubeRotation.js
// Cube rotation logic
import { DIR_TO_VEC, VEC_TO_DIR } from '../utils/constants.js';

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

// StickerPlane's local +X/+Y basis on each cube face. Transporting this
// basis preserves artwork orientation when the animated cubie resets to its
// canonical grid slot at commit (colors alone cannot encode a tile's twist).
export const STICKER_BASIS = {
  PZ: [[1, 0, 0], [0, 1, 0]], NZ: [[-1, 0, 0], [0, 1, 0]],
  PX: [[0, 0, -1], [0, 1, 0]], NX: [[0, 0, 1], [0, 1, 0]],
  PY: [[1, 0, 0], [0, 0, -1]], NY: [[1, 0, 0], [0, 0, 1]],
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

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
    const tangent = rotateVec90(...STICKER_BASIS[k][0], axis, dir);
    const [right, up] = STICKER_BASIS[newKey];
    const twist = Math.round(Math.atan2(dot(tangent, up), dot(tangent, right)) / (Math.PI / 2));
    const uvTurns = ((stickers[k].uvTurns ?? 0) + twist + 4) % 4;
    const sticker = { ...stickers[k] };
    // Canonical zero keeps old saves and four-turn/inverse round trips equal.
    if (uvTurns) sticker.uvTurns = uvTurns;
    else delete sticker.uvTurns;
    next[newKey] = sticker;
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
