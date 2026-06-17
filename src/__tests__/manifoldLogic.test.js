import { describe, it, expect } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { buildManifoldGridMap, buildManifoldGridMapIncremental, flipStickerPair } from '../game/manifoldLogic.js';

// Compares two manifoldMap-shaped Maps for identical (x, y, z, dirKey) entries per gridId.
// Sticker object identity is allowed to differ (incremental patches may revisit a cell
// whose sticker reference is unchanged); only the location each gridId resolves to matters.
function expectSameLocations(mapA, mapB) {
  expect(mapA.size).toBe(mapB.size);
  for (const [gridId, locA] of mapA) {
    const locB = mapB.get(gridId);
    expect(locB).toBeTruthy();
    expect({ x: locB.x, y: locB.y, z: locB.z, dirKey: locB.dirKey }).toEqual({
      x: locA.x, y: locA.y, z: locA.z, dirKey: locA.dirKey,
    });
  }
}

describe('buildManifoldGridMapIncremental', () => {
  it('matches a full rebuild on the initial (solved) cube', () => {
    const size = 3;
    const cubies = makeCubies(size);
    const cache = { map: null, prevCubies: null, size: null };

    const full = buildManifoldGridMap(cubies, size);
    const incremental = buildManifoldGridMapIncremental(cubies, size, cache);
    expectSameLocations(full, incremental);
  });

  it('stays correct across a sequence of flips (no rotations)', () => {
    const size = 3;
    let cubies = makeCubies(size);
    const cache = { map: null, prevCubies: null, size: null };

    // Prime the cache on the initial state.
    buildManifoldGridMapIncremental(cubies, size, cache);

    const flipTargets = [
      [0, 0, 0, 'PZ'],
      [2, 1, 0, 'PX'],
      [1, 2, 2, 'PY'],
    ];

    for (const [x, y, z, dirKey] of flipTargets) {
      const fullMapForFlip = buildManifoldGridMap(cubies, size);
      cubies = flipStickerPair(cubies, size, x, y, z, dirKey, fullMapForFlip);

      const expectedFull = buildManifoldGridMap(cubies, size);
      const incremental = buildManifoldGridMapIncremental(cubies, size, cache);
      expectSameLocations(expectedFull, incremental);
    }
  });

  it('stays correct across rotations that move stickers between cells', () => {
    const size = 3;
    let cubies = makeCubies(size);
    const cache = { map: null, prevCubies: null, size: null };

    buildManifoldGridMapIncremental(cubies, size, cache);

    const rotations = [
      ['col', 0, 1],
      ['row', 1, -1],
      ['depth', 2, 1],
    ];

    for (const [axis, sliceIndex, dir] of rotations) {
      cubies = rotateSliceCubies(cubies, size, axis, sliceIndex, dir);

      const expectedFull = buildManifoldGridMap(cubies, size);
      const incremental = buildManifoldGridMapIncremental(cubies, size, cache);
      expectSameLocations(expectedFull, incremental);
    }
  });

  it('stays correct across interleaved flips and rotations', () => {
    const size = 4;
    let cubies = makeCubies(size);
    const cache = { map: null, prevCubies: null, size: null };

    buildManifoldGridMapIncremental(cubies, size, cache);

    const steps = [
      { type: 'flip', args: [0, 0, 0, 'PZ'] },
      { type: 'rotate', args: ['col', 0, 1] },
      { type: 'flip', args: [3, 2, 1, 'PX'] },
      { type: 'rotate', args: ['depth', 3, -1] },
      { type: 'flip', args: [1, 3, 3, 'PY'] },
    ];

    for (const step of steps) {
      if (step.type === 'flip') {
        const fullMapForFlip = buildManifoldGridMap(cubies, size);
        cubies = flipStickerPair(cubies, size, ...step.args, fullMapForFlip);
      } else {
        cubies = rotateSliceCubies(cubies, size, ...step.args);
      }

      const expectedFull = buildManifoldGridMap(cubies, size);
      const incremental = buildManifoldGridMapIncremental(cubies, size, cache);
      expectSameLocations(expectedFull, incremental);
    }
  });

  it('falls back to a full rebuild when size changes', () => {
    const cubies3 = makeCubies(3);
    const cubies4 = makeCubies(4);
    const cache = { map: null, prevCubies: null, size: null };

    buildManifoldGridMapIncremental(cubies3, 3, cache);
    const incremental = buildManifoldGridMapIncremental(cubies4, 4, cache);
    const full = buildManifoldGridMap(cubies4, 4);
    expectSameLocations(full, incremental);
  });
});
