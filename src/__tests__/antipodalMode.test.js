import { describe, it, expect } from 'vitest';
import {
  getAntipodalSliceIndex,
  getReverseDirection,
  shouldTriggerEcho,
  calculateEchoSync,
  getAntipodalFaceInfo,
} from '../game/antipodalMode.js';

describe('getAntipodalSliceIndex', () => {
  it('should return opposite slice for 3x3 cube', () => {
    const size = 3;
    expect(getAntipodalSliceIndex('row', 0, size)).toBe(2); // top → bottom
    expect(getAntipodalSliceIndex('row', 1, size)).toBe(1); // middle → middle
    expect(getAntipodalSliceIndex('row', 2, size)).toBe(0); // bottom → top
  });

  it('should return opposite slice for 2x2 cube', () => {
    const size = 2;
    expect(getAntipodalSliceIndex('col', 0, size)).toBe(1); // left → right
    expect(getAntipodalSliceIndex('col', 1, size)).toBe(0); // right → left
  });

  it('should return opposite slice for 4x4 cube', () => {
    const size = 4;
    expect(getAntipodalSliceIndex('depth', 0, size)).toBe(3); // back → front
    expect(getAntipodalSliceIndex('depth', 1, size)).toBe(2);
    expect(getAntipodalSliceIndex('depth', 2, size)).toBe(1);
    expect(getAntipodalSliceIndex('depth', 3, size)).toBe(0); // front → back
  });

  it('should work for all axes', () => {
    const size = 3;
    expect(getAntipodalSliceIndex('row', 0, size)).toBe(2);
    expect(getAntipodalSliceIndex('col', 0, size)).toBe(2);
    expect(getAntipodalSliceIndex('depth', 0, size)).toBe(2);
  });
});

describe('getReverseDirection', () => {
  it('should reverse clockwise to counterclockwise', () => {
    expect(getReverseDirection(1)).toBe(-1);
  });

  it('should reverse counterclockwise to clockwise', () => {
    expect(getReverseDirection(-1)).toBe(1);
  });

  it('should handle double reversal', () => {
    const dir = 1;
    const reversed = getReverseDirection(dir);
    const doubleReversed = getReverseDirection(reversed);
    expect(doubleReversed).toBe(dir);
  });
});

describe('shouldTriggerEcho', () => {
  it('should always return true for all slices', () => {
    const size = 3;
    expect(shouldTriggerEcho('row', 0, size)).toBe(true);
    expect(shouldTriggerEcho('row', 1, size)).toBe(true);
    expect(shouldTriggerEcho('row', 2, size)).toBe(true);
  });

  it('should work for all axes', () => {
    const size = 3;
    expect(shouldTriggerEcho('row', 1, size)).toBe(true);
    expect(shouldTriggerEcho('col', 1, size)).toBe(true);
    expect(shouldTriggerEcho('depth', 1, size)).toBe(true);
  });
});

describe('calculateEchoSync', () => {
  it('should return 100% for perfect sync (all moves triggered echoes)', () => {
    expect(calculateEchoSync(10, 10)).toBe(100);
  });

  it('should return 50% for half sync', () => {
    expect(calculateEchoSync(10, 5)).toBe(50);
  });

  it('should return 0% for no echoes', () => {
    expect(calculateEchoSync(10, 0)).toBe(0);
  });

  it('should return 100% for zero moves', () => {
    expect(calculateEchoSync(0, 0)).toBe(100);
  });

  it('should cap at 100% even if reversals exceed moves', () => {
    expect(calculateEchoSync(5, 10)).toBe(100);
  });

  it('should round to nearest integer', () => {
    expect(calculateEchoSync(3, 1)).toBe(33); // 33.33... → 33
    expect(calculateEchoSync(3, 2)).toBe(67); // 66.66... → 67
  });
});

describe('getAntipodalFaceInfo', () => {
  const size = 3;

  describe('row axis (Y-axis)', () => {
    it('should identify top face (PY)', () => {
      const info = getAntipodalFaceInfo('row', 2, size);
      expect(info.originalFace).toBe('PY');
      expect(info.antipodalFace).toBe('NY');
      expect(info.antipodalSlice).toBe(0);
      expect(info.isMiddleLayer).toBe(false);
    });

    it('should identify bottom face (NY)', () => {
      const info = getAntipodalFaceInfo('row', 0, size);
      expect(info.originalFace).toBe('NY');
      expect(info.antipodalFace).toBe('PY');
      expect(info.antipodalSlice).toBe(2);
      expect(info.isMiddleLayer).toBe(false);
    });

    it('should identify middle layer', () => {
      const info = getAntipodalFaceInfo('row', 1, size);
      expect(info.originalFace).toBe('middle');
      expect(info.antipodalFace).toBe('middle');
      expect(info.antipodalSlice).toBe(1);
      expect(info.isMiddleLayer).toBe(true);
    });
  });

  describe('col axis (X-axis)', () => {
    it('should identify right face (PX)', () => {
      const info = getAntipodalFaceInfo('col', 2, size);
      expect(info.originalFace).toBe('PX');
      expect(info.antipodalFace).toBe('NX');
      expect(info.antipodalSlice).toBe(0);
      expect(info.isMiddleLayer).toBe(false);
    });

    it('should identify left face (NX)', () => {
      const info = getAntipodalFaceInfo('col', 0, size);
      expect(info.originalFace).toBe('NX');
      expect(info.antipodalFace).toBe('PX');
      expect(info.antipodalSlice).toBe(2);
      expect(info.isMiddleLayer).toBe(false);
    });
  });

  describe('depth axis (Z-axis)', () => {
    it('should identify front face (PZ)', () => {
      const info = getAntipodalFaceInfo('depth', 2, size);
      expect(info.originalFace).toBe('PZ');
      expect(info.antipodalFace).toBe('NZ');
      expect(info.antipodalSlice).toBe(0);
      expect(info.isMiddleLayer).toBe(false);
    });

    it('should identify back face (NZ)', () => {
      const info = getAntipodalFaceInfo('depth', 0, size);
      expect(info.originalFace).toBe('NZ');
      expect(info.antipodalFace).toBe('PZ');
      expect(info.antipodalSlice).toBe(2);
      expect(info.isMiddleLayer).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should work for 2x2 cube (no middle layer)', () => {
      const info1 = getAntipodalFaceInfo('row', 0, 2);
      expect(info1.isMiddleLayer).toBe(false);
      expect(info1.antipodalSlice).toBe(1);

      const info2 = getAntipodalFaceInfo('row', 1, 2);
      expect(info2.isMiddleLayer).toBe(false);
      expect(info2.antipodalSlice).toBe(0);
    });

    it('should work for 5x5 cube', () => {
      const info = getAntipodalFaceInfo('row', 2, 5);
      expect(info.originalFace).toBe('middle');
      expect(info.antipodalFace).toBe('middle');
      expect(info.isMiddleLayer).toBe(true);
    });
  });
});

describe('antipodal mode integration', () => {
  it('should maintain symmetry: reverse of reverse equals original', () => {
    const originalDir = 1;
    const reversed = getReverseDirection(originalDir);
    const doubleReversed = getReverseDirection(reversed);
    expect(doubleReversed).toBe(originalDir);
  });

  it('should map slices symmetrically', () => {
    const size = 3;
    for (let i = 0; i < size; i++) {
      const antipodal = getAntipodalSliceIndex('row', i, size);
      const backToOriginal = getAntipodalSliceIndex('row', antipodal, size);
      expect(backToOriginal).toBe(i);
    }
  });

  it('should calculate realistic echo sync values', () => {
    // Scenario: User made 20 moves, 18 triggered echoes (2 were during animation delay)
    const sync = calculateEchoSync(20, 18);
    expect(sync).toBe(90);
  });
});
