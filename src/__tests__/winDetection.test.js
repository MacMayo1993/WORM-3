import { describe, it, expect } from 'vitest';
import {
  checkRubiksSolved,
  checkFaceLatinSquare,
  checkWormVictory,
  detectWinConditions,
} from '../game/winDetection.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';

describe('checkRubiksSolved', () => {
  it('should return true for a freshly created cube', () => {
    const cubies = makeCubies(3);
    expect(checkRubiksSolved(cubies, 3)).toBe(true);
  });

  it('should return false for a scrambled cube', () => {
    let cubies = makeCubies(3);
    cubies = rotateSliceCubies(cubies, 3, 'col', 0, 1);
    expect(checkRubiksSolved(cubies, 3)).toBe(false);
  });

  it('should return true after applying and reversing a rotation', () => {
    let cubies = makeCubies(3);
    cubies = rotateSliceCubies(cubies, 3, 'col', 0, 1);
    cubies = rotateSliceCubies(cubies, 3, 'col', 0, -1);
    expect(checkRubiksSolved(cubies, 3)).toBe(true);
  });

  it('should work for different cube sizes', () => {
    const cubies2 = makeCubies(2);
    expect(checkRubiksSolved(cubies2, 2)).toBe(true);

    const cubies4 = makeCubies(4);
    expect(checkRubiksSolved(cubies4, 4)).toBe(true);
  });
});

describe('checkFaceLatinSquare', () => {
  it('should return true for a valid 3x3 Latin square', () => {
    const grid = [
      [1, 2, 3],
      [2, 3, 1],
      [3, 1, 2],
    ];
    expect(checkFaceLatinSquare(grid, 3)).toBe(true);
  });

  it('should return false for a grid with duplicate in row', () => {
    const grid = [
      [1, 1, 3],
      [2, 3, 1],
      [3, 1, 2],
    ];
    expect(checkFaceLatinSquare(grid, 3)).toBe(false);
  });

  it('should return false for a grid with duplicate in column', () => {
    const grid = [
      [1, 2, 3],
      [1, 3, 2],
      [3, 1, 2],
    ];
    expect(checkFaceLatinSquare(grid, 3)).toBe(false);
  });

  it('should return false for a grid with out-of-range values', () => {
    const grid = [
      [1, 2, 4], // 4 is out of range for 3x3
      [2, 3, 1],
      [3, 1, 2],
    ];
    expect(checkFaceLatinSquare(grid, 3)).toBe(false);
  });

  it('should work for 2x2 Latin square', () => {
    const valid = [
      [1, 2],
      [2, 1],
    ];
    expect(checkFaceLatinSquare(valid, 2)).toBe(true);

    const invalid = [
      [1, 1],
      [2, 2],
    ];
    expect(checkFaceLatinSquare(invalid, 2)).toBe(false);
  });
});

describe('checkWormVictory', () => {
  it('should return false for a solved cube with no flips', () => {
    const cubies = makeCubies(3);
    // Cube is solved but no stickers have been flipped
    expect(checkWormVictory(cubies, 3)).toBe(false);
  });

  it('should return false for a cube with some flips but not solved', () => {
    let cubies = makeCubies(3);
    // Scramble the cube
    cubies = rotateSliceCubies(cubies, 3, 'col', 0, 1);
    // Mark some stickers as flipped
    cubies[0][0][2].stickers.PZ.flips = 1;
    expect(checkWormVictory(cubies, 3)).toBe(false);
  });

  it('should return true for solved cube where all stickers have flips', () => {
    const cubies = makeCubies(3);
    // Mark all stickers as having been flipped
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          for (const st of Object.values(cubies[x][y][z].stickers)) {
            st.flips = 1;
          }
        }
      }
    }
    expect(checkWormVictory(cubies, 3)).toBe(true);
  });
});

describe('detectWinConditions', () => {
  it('should detect all conditions for fresh cube', () => {
    const cubies = makeCubies(3);
    const result = detectWinConditions(cubies, 3);

    expect(result.rubiks).toBe(true);
    expect(result.sudokube).toBe(true);
    expect(result.ultimate).toBe(true);
    expect(result.worm).toBe(false); // No flips yet
  });

  it('should return all false for scrambled cube', () => {
    let cubies = makeCubies(3);
    cubies = rotateSliceCubies(cubies, 3, 'col', 0, 1);
    cubies = rotateSliceCubies(cubies, 3, 'row', 1, 1);
    cubies = rotateSliceCubies(cubies, 3, 'depth', 2, -1);

    const result = detectWinConditions(cubies, 3);

    expect(result.rubiks).toBe(false);
    expect(result.ultimate).toBe(false);
    expect(result.worm).toBe(false);
  });
});
