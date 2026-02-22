import { describe, it, expect } from 'vitest';
import { rotateVec90, rotateSliceCubies } from '../game/cubeRotation.js';
import { makeCubies } from '../game/cubeState.js';

// Helper to compare numbers, treating -0 as equal to 0
const isZero = (n) => n === 0 || Object.is(n, -0);

describe('rotateVec90', () => {
  describe('column axis rotation (around X)', () => {
    it('should rotate +Y to +Z with dir=1', () => {
      const [x, y, z] = rotateVec90(0, 1, 0, 'col', 1);
      expect(isZero(x)).toBe(true);
      expect(isZero(y)).toBe(true);
      expect(z).toBe(1);
    });

    it('should rotate +Z to -Y with dir=1', () => {
      const [x, y, z] = rotateVec90(0, 0, 1, 'col', 1);
      expect(isZero(x)).toBe(true);
      expect(y).toBe(-1);
      expect(isZero(z)).toBe(true);
    });

    it('should rotate +Y to -Z with dir=-1', () => {
      const [x, y, z] = rotateVec90(0, 1, 0, 'col', -1);
      expect(isZero(x)).toBe(true);
      expect(isZero(y)).toBe(true);
      expect(z).toBe(-1);
    });
  });

  describe('row axis rotation (around Y)', () => {
    it('should rotate +X to -Z with dir=1', () => {
      const [x, y, z] = rotateVec90(1, 0, 0, 'row', 1);
      expect(isZero(x)).toBe(true);
      expect(isZero(y)).toBe(true);
      expect(z).toBe(-1);
    });

    it('should rotate +Z to +X with dir=1', () => {
      const [x, y, z] = rotateVec90(0, 0, 1, 'row', 1);
      expect(x).toBe(1);
      expect(isZero(y)).toBe(true);
      expect(isZero(z)).toBe(true);
    });
  });

  describe('depth axis rotation (around Z)', () => {
    it('should rotate +X to +Y with dir=1', () => {
      const [x, y, z] = rotateVec90(1, 0, 0, 'depth', 1);
      expect(isZero(x)).toBe(true);
      expect(y).toBe(1);
      expect(isZero(z)).toBe(true);
    });

    it('should rotate +Y to -X with dir=1', () => {
      const [x, y, z] = rotateVec90(0, 1, 0, 'depth', 1);
      expect(x).toBe(-1);
      expect(isZero(y)).toBe(true);
      expect(isZero(z)).toBe(true);
    });
  });

  it('should leave X component unchanged during column rotation', () => {
    const [x, y, z] = rotateVec90(1, 0, 0, 'col', 1);
    expect(x).toBe(1);
    expect(isZero(y)).toBe(true);
    expect(isZero(z)).toBe(true);
  });

  it('should leave Y component unchanged during row rotation', () => {
    const [x, y, z] = rotateVec90(0, 1, 0, 'row', 1);
    expect(isZero(x)).toBe(true);
    expect(y).toBe(1);
    expect(isZero(z)).toBe(true);
  });

  it('should leave Z component unchanged during depth rotation', () => {
    const [x, y, z] = rotateVec90(0, 0, 1, 'depth', 1);
    expect(isZero(x)).toBe(true);
    expect(isZero(y)).toBe(true);
    expect(z).toBe(1);
  });
});

describe('rotateSliceCubies', () => {
  it('should not modify cubies outside the slice', () => {
    const original = makeCubies(3);
    const rotated = rotateSliceCubies(original, 3, 'col', 0, 1);

    // Check that cubie at x=1 is unchanged
    expect(rotated[1][0][0].x).toBe(1);
    expect(rotated[1][0][0].y).toBe(0);
    expect(rotated[1][0][0].z).toBe(0);

    // Check that cubie at x=2 is unchanged
    expect(rotated[2][0][0].x).toBe(2);
    expect(rotated[2][0][0].y).toBe(0);
    expect(rotated[2][0][0].z).toBe(0);
  });

  it('should update cubie positions in the slice', () => {
    const original = makeCubies(3);
    const rotated = rotateSliceCubies(original, 3, 'col', 0, 1);

    // After rotating column 0, positions within the slice should change
    // Verify the new positions are set correctly
    expect(rotated[0][2][2].y).toBe(2);
    expect(rotated[0][2][2].z).toBe(2);
  });

  it('should return a new array (immutable)', () => {
    const original = makeCubies(3);
    const rotated = rotateSliceCubies(original, 3, 'row', 1, 1);

    expect(rotated).not.toBe(original);
    expect(rotated[0]).not.toBe(original[0]);
  });

  it('should work for different cube sizes', () => {
    const original4 = makeCubies(4);
    const rotated4 = rotateSliceCubies(original4, 4, 'depth', 2, 1);
    expect(rotated4.length).toBe(4);

    const original2 = makeCubies(2);
    const rotated2 = rotateSliceCubies(original2, 2, 'col', 0, -1);
    expect(rotated2.length).toBe(2);
  });

  it('should preserve sticker color values during rotation', () => {
    const original = makeCubies(3);

    // Get all sticker colors on the front face before rotation
    const frontColors = [];
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        const st = original[x][y][2].stickers.PZ;
        if (st) frontColors.push(st.curr);
      }
    }

    const rotated = rotateSliceCubies(original, 3, 'depth', 2, 1);

    // Get all sticker colors on the front face after rotation
    const rotatedFrontColors = [];
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        const st = rotated[x][y][2].stickers.PZ;
        if (st) rotatedFrontColors.push(st.curr);
      }
    }

    // Should have same colors, just in different positions
    expect(rotatedFrontColors.sort()).toEqual(frontColors.sort());
  });

  it('should return to original state after 4 rotations', () => {
    let cubies = makeCubies(3);
    const original = JSON.stringify(cubies);

    // Rotate 4 times in same direction
    for (let i = 0; i < 4; i++) {
      cubies = rotateSliceCubies(cubies, 3, 'col', 1, 1);
    }

    expect(JSON.stringify(cubies)).toBe(original);
  });

  it('should reverse with opposite direction', () => {
    const original = makeCubies(3);
    const originalStr = JSON.stringify(original);

    let cubies = rotateSliceCubies(original, 3, 'row', 0, 1);
    cubies = rotateSliceCubies(cubies, 3, 'row', 0, -1);

    expect(JSON.stringify(cubies)).toBe(originalStr);
  });
});
