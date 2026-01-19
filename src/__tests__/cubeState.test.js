// src/__tests__/cubeState.test.js
// Example test file for cube state logic
// To run tests, you'll need to install a test runner like Vitest:
// npm install -D vitest @vitest/ui

import { describe, it, expect } from 'vitest';
import { makeCubies, clone3D } from '../game/cubeState.js';

describe('makeCubies', () => {
  it('should create a 3x3x3 cube with correct dimensions', () => {
    const cubies = makeCubies(3);
    expect(cubies.length).toBe(3);
    expect(cubies[0].length).toBe(3);
    expect(cubies[0][0].length).toBe(3);
  });

  it('should initialize stickers with correct original colors', () => {
    const cubies = makeCubies(3);

    // Check corner cubie at (0, 0, 0)
    const cornerCubie = cubies[0][0][0];
    expect(cornerCubie.stickers.NX).toBeDefined();
    expect(cornerCubie.stickers.NY).toBeDefined();
    expect(cornerCubie.stickers.NZ).toBeDefined();

    // Check sticker colors
    expect(cornerCubie.stickers.NX.curr).toBe(2); // Green
    expect(cornerCubie.stickers.NY.curr).toBe(6); // Yellow
    expect(cornerCubie.stickers.NZ.curr).toBe(4); // Orange
  });

  it('should initialize stickers with zero flips', () => {
    const cubies = makeCubies(3);
    const allStickers = [];

    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          Object.values(cubies[x][y][z].stickers).forEach(sticker => {
            allStickers.push(sticker);
          });
        }
      }
    }

    expect(allStickers.every(s => s.flips === 0)).toBe(true);
  });

  it('should store original position for each sticker', () => {
    const cubies = makeCubies(3);
    const cubie = cubies[1][2][0];
    const sticker = cubie.stickers.NZ;

    expect(sticker.origPos).toEqual({ x: 1, y: 2, z: 0 });
    expect(sticker.origDir).toBe('NZ');
  });

  it('should work for different cube sizes', () => {
    const sizes = [3, 4, 5];

    sizes.forEach(size => {
      const cubies = makeCubies(size);
      expect(cubies.length).toBe(size);
      expect(cubies[0].length).toBe(size);
      expect(cubies[0][0].length).toBe(size);
    });
  });
});

describe('clone3D', () => {
  it('should create a deep copy of the cube state', () => {
    const original = makeCubies(3);
    const cloned = clone3D(original);

    // Modify the clone
    cloned[0][0][0].x = 999;

    // Original should be unchanged
    expect(original[0][0][0].x).toBe(0);
    expect(cloned[0][0][0].x).toBe(999);
  });
});

// TODO: Add more tests for:
// - cubeRotation.js (rotateSliceCubies, rotateVec90)
// - manifoldLogic.js (buildManifoldGridMap, flipStickerPair)
// - winDetection.js (checkRubiksSolved, checkSudokubeSolved)
// - coordinates.js (getGridRC, getStickerWorldPos)
