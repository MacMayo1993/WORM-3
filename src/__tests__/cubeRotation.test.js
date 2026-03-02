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

  it('should return to original state after 4 rotations (face slice)', () => {
    let cubies = makeCubies(3);
    const original = JSON.stringify(cubies);

    for (let i = 0; i < 4; i++) {
      cubies = rotateSliceCubies(cubies, 3, 'col', 2, 1);
    }

    expect(JSON.stringify(cubies)).toBe(original);
  });

  describe('exact sticker positions after depth rotation', () => {
    // depth=2, dir=1 rotates the front face (z=2 slice).
    // The mapping is: PX→PY, PY→NX, NX→NY, NY→PX (right→top, top→left, left→bottom, bottom→right)
    // Adjacent-face stickers at z=2 shift accordingly.
    let rotated;
    beforeEach(() => {
      rotated = rotateSliceCubies(makeCubies(3), 3, 'depth', 2, 1);
    });

    it('should keep PZ stickers on the front face unchanged', () => {
      for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
          expect(rotated[x][y][2].stickers.PZ?.curr).toBe(1); // red
        }
      }
    });

    it('should move the bottom-middle PZ edge: NY→PX at (2,1,2)', () => {
      // old (1,0,2).NY=yellow(6) → PX at (2,1,2)
      expect(rotated[2][1][2].stickers.PX?.curr).toBe(6);
    });

    it('should move the right-middle PZ edge: PX→PY at (1,2,2)', () => {
      // old (2,1,2).PX=blue(5) → PY at (1,2,2)
      expect(rotated[1][2][2].stickers.PY?.curr).toBe(5);
    });

    it('should move the top-middle PZ edge: PY→NX at (0,1,2)', () => {
      // old (1,2,2).PY=white(3) → NX at (0,1,2)
      expect(rotated[0][1][2].stickers.NX?.curr).toBe(3);
    });

    it('should move the left-middle PZ edge: NX→NY at (1,0,2)', () => {
      // old (0,1,2).NX=green(2) → NY at (1,0,2)
      expect(rotated[1][0][2].stickers.NY?.curr).toBe(2);
    });
  });

  describe('exact sticker positions after col rotation', () => {
    // col=2, dir=1 rotates the right face (x=2 slice).
    // Mapping: PY→PZ, PZ→NY, NY→NZ, NZ→PY (top→front, front→bottom, bottom→back, back→top)
    let rotated;
    beforeEach(() => {
      rotated = rotateSliceCubies(makeCubies(3), 3, 'col', 2, 1);
    });

    it('should keep PX stickers on the right face after col rotation', () => {
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          expect(rotated[2][y][z].stickers.PX?.curr).toBe(5); // blue
        }
      }
    });

    it('should move the front-middle edge: PZ→NY at (2,0,1)', () => {
      // old (2,1,2).PZ=red(1) → NY at (2,0,1)
      expect(rotated[2][0][1].stickers.NY?.curr).toBe(1);
    });

    it('should move the top-middle edge: PY→PZ at (2,1,2)', () => {
      // old (2,2,1).PY=white(3) → PZ at (2,1,2)
      expect(rotated[2][1][2].stickers.PZ?.curr).toBe(3);
    });

    it('should move the back-middle edge: NZ→PY at (2,2,1)', () => {
      // old (2,1,0).NZ=orange(4) → PY at (2,2,1)
      expect(rotated[2][2][1].stickers.PY?.curr).toBe(4);
    });

    it('should move the bottom-middle edge: NY→NZ at (2,1,0)', () => {
      // old (2,0,1).NY=yellow(6) → NZ at (2,1,0)
      expect(rotated[2][1][0].stickers.NZ?.curr).toBe(6);
    });
  });

  describe('exact sticker positions after row rotation', () => {
    // row=2, dir=1 rotates the top face (y=2 slice).
    // Mapping: PZ→PX, PX→NZ, NZ→NX, NX→PZ (front→right, right→back, back→left, left→front)
    let rotated;
    beforeEach(() => {
      rotated = rotateSliceCubies(makeCubies(3), 3, 'row', 2, 1);
    });

    it('should keep PY stickers on the top face after row rotation', () => {
      for (let x = 0; x < 3; x++) {
        for (let z = 0; z < 3; z++) {
          expect(rotated[x][2][z].stickers.PY?.curr).toBe(3); // white
        }
      }
    });

    it('should move the front-middle edge: PZ→PX at (2,2,1)', () => {
      // old (1,2,2).PZ=red(1) → PX at (2,2,1)
      expect(rotated[2][2][1].stickers.PX?.curr).toBe(1);
    });

    it('should move the right-middle edge: PX→NZ at (1,2,0)', () => {
      // old (2,2,1).PX=blue(5) → NZ at (1,2,0)
      expect(rotated[1][2][0].stickers.NZ?.curr).toBe(5);
    });

    it('should move the back-middle edge: NZ→NX at (0,2,1)', () => {
      // old (1,2,0).NZ=orange(4) → NX at (0,2,1)
      expect(rotated[0][2][1].stickers.NX?.curr).toBe(4);
    });

    it('should move the left-middle edge: NX→PZ at (1,2,2)', () => {
      // old (0,2,1).NX=green(2) → PZ at (1,2,2)
      expect(rotated[1][2][2].stickers.PZ?.curr).toBe(2);
    });
  });

});
