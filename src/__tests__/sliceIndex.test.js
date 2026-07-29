// Slice indexing is load-bearing in four places that must agree exactly: the
// logical rotation, the renderer's animation transform, the worm's ride/collision
// checks, and the warning geometry. The old code answered the question with a
// size³ walk in each of them; these tests pin the direct O(size²) generator to
// that brute-force answer so the optimisation can't quietly drift.
import { describe, it, expect } from 'vitest';
import {
  isTileInSlice,
  forEachSliceCoordinate,
  getSliceLinearIndices,
  getActivePlaneForCoordinate,
  resetSliceIndexCache,
  MAX_STANDARD_SIZE,
  MEGA_SIZE,
} from '../game/sliceIndex.js';

const AXES = ['col', 'row', 'depth'];
// Every standard size plus the Mega Worm size — the one that motivated the change.
const SIZES = [2, 3, 4, 5, 6, 7, MEGA_SIZE];

// The implementation this replaced: walk the whole lattice, keep the hits.
function bruteForceLinearIndices(size, axis, sliceIndex) {
  const out = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        if (isTileInSlice(axis, sliceIndex, x, y, z)) out.push(x * size * size + y * size + z);
      }
    }
  }
  return out;
}

describe('size constants', () => {
  it('keeps the standard ceiling at 7 and the Mega size at 15', () => {
    expect(MAX_STANDARD_SIZE).toBe(7);
    expect(MEGA_SIZE).toBe(15);
  });
});

describe('isTileInSlice', () => {
  it('maps axis names to grid coordinates the way the rest of the pipeline does', () => {
    expect(isTileInSlice('col', 2, 2, 0, 0)).toBe(true);
    expect(isTileInSlice('row', 2, 0, 2, 0)).toBe(true);
    expect(isTileInSlice('depth', 2, 0, 0, 2)).toBe(true);
    expect(isTileInSlice('col', 2, 1, 2, 2)).toBe(false);
  });

  it('rejects an unknown axis instead of silently picking one', () => {
    // rotateVec90 treats an unrecognised axis as 'depth' via a fallthrough; this
    // predicate deliberately does not, so a typo'd axis selects nothing rather
    // than rotating the wrong layer.
    expect(isTileInSlice('bogus', 0, 0, 0, 0)).toBe(false);
  });
});

describe('forEachSliceCoordinate', () => {
  it('visits exactly the slice, once each, for every axis and slice', () => {
    for (const size of SIZES) {
      for (const axis of AXES) {
        for (let s = 0; s < size; s++) {
          const seen = new Set();
          forEachSliceCoordinate(size, axis, s, (x, y, z) => {
            expect(isTileInSlice(axis, s, x, y, z)).toBe(true);
            seen.add(`${x},${y},${z}`);
          });
          expect(seen.size, `${size} ${axis} ${s}`).toBe(size * size);
        }
      }
    }
  });

  it('visits nothing for an out-of-range slice or an unknown axis', () => {
    const calls = [];
    const record = (x, y, z) => calls.push([x, y, z]);
    forEachSliceCoordinate(5, 'col', -1, record);
    forEachSliceCoordinate(5, 'col', 5, record);
    forEachSliceCoordinate(5, 'col', 1.5, record);
    forEachSliceCoordinate(5, 'nope', 0, record);
    expect(calls).toHaveLength(0);
  });
});

describe('getSliceLinearIndices', () => {
  it('matches a brute-force size³ scan for every size, axis and slice', () => {
    for (const size of SIZES) {
      for (const axis of AXES) {
        for (let s = 0; s < size; s++) {
          expect(
            Array.from(getSliceLinearIndices(size, axis, s)),
            `${size} ${axis} ${s}`
          ).toEqual(bruteForceLinearIndices(size, axis, s));
        }
      }
    }
  });

  it('uses the x*size² + y*size + z flattening the cubie refs are built in', () => {
    // liveCubies, CubeAssembly's positionCache and WormholeNetwork all index this
    // way; a different order here would address the wrong cubie.
    const size = 3;
    const indices = Array.from(getSliceLinearIndices(size, 'row', 1));
    expect(indices).toContain(0 * 9 + 1 * 3 + 0);
    expect(indices).toContain(2 * 9 + 1 * 3 + 2);
    expect(indices).not.toContain(0 * 9 + 0 * 3 + 0);
  });

  it('returns an empty list rather than throwing on a bad slice or axis', () => {
    expect(getSliceLinearIndices(5, 'col', -1)).toHaveLength(0);
    expect(getSliceLinearIndices(5, 'col', 5)).toHaveLength(0);
    expect(getSliceLinearIndices(5, 'sideways', 0)).toHaveLength(0);
  });

  it('caches, so a frame loop asking every frame allocates nothing', () => {
    resetSliceIndexCache();
    const first = getSliceLinearIndices(7, 'depth', 3);
    expect(getSliceLinearIndices(7, 'depth', 3)).toBe(first);
    resetSliceIndexCache();
    expect(getSliceLinearIndices(7, 'depth', 3)).not.toBe(first);
  });
});

describe('getActivePlaneForCoordinate', () => {
  const wave = {
    axis: 'row',
    rotations: [
      { sliceIndex: 2, dir: 1, numTurns: 1 },
      { sliceIndex: 7, dir: -1, numTurns: 1 },
      { sliceIndex: 12, dir: 1, numTurns: 1 },
    ],
  };

  it('finds the owning plane by the cell coordinate on the wave axis', () => {
    expect(getActivePlaneForCoordinate(wave, 0, 2, 0)).toBe(0);
    expect(getActivePlaneForCoordinate(wave, 4, 7, 9)).toBe(1);
    expect(getActivePlaneForCoordinate(wave, 14, 12, 3)).toBe(2);
  });

  it('returns -1 for a cell on no plane', () => {
    expect(getActivePlaneForCoordinate(wave, 2, 0, 12)).toBe(-1);
    expect(getActivePlaneForCoordinate(wave, 7, 5, 2)).toBe(-1);
  });

  it('returns -1 for a null wave or an unknown axis', () => {
    expect(getActivePlaneForCoordinate(null, 0, 0, 0)).toBe(-1);
    expect(getActivePlaneForCoordinate({ axis: 'nope', rotations: [{ sliceIndex: 0 }] }, 0, 0, 0)).toBe(-1);
  });

  it('agrees with isTileInSlice on every cell of a Mega-sized cube', () => {
    for (let x = 0; x < MEGA_SIZE; x++) {
      for (let y = 0; y < MEGA_SIZE; y++) {
        for (let z = 0; z < MEGA_SIZE; z++) {
          const plane = getActivePlaneForCoordinate(wave, x, y, z);
          const expected = wave.rotations.findIndex(r => isTileInSlice(wave.axis, r.sliceIndex, x, y, z));
          expect(plane).toBe(expected);
        }
      }
    }
  });
});
