import { describe, it, expect } from 'vitest';
import {
  isOnEdge,
  getEdgeFlags,
  getVisibleDirections,
  forEachEdgeSticker,
  countEdgeStickers,
} from '../game/cubeUtils.js';

describe('isOnEdge', () => {
  it('should return true for PX when x is at max', () => {
    expect(isOnEdge(2, 1, 1, 'PX', 3)).toBe(true);
    expect(isOnEdge(1, 1, 1, 'PX', 3)).toBe(false);
    expect(isOnEdge(0, 1, 1, 'PX', 3)).toBe(false);
  });

  it('should return true for NX when x is 0', () => {
    expect(isOnEdge(0, 1, 1, 'NX', 3)).toBe(true);
    expect(isOnEdge(1, 1, 1, 'NX', 3)).toBe(false);
    expect(isOnEdge(2, 1, 1, 'NX', 3)).toBe(false);
  });

  it('should return true for PY when y is at max', () => {
    expect(isOnEdge(1, 2, 1, 'PY', 3)).toBe(true);
    expect(isOnEdge(1, 1, 1, 'PY', 3)).toBe(false);
  });

  it('should return true for NY when y is 0', () => {
    expect(isOnEdge(1, 0, 1, 'NY', 3)).toBe(true);
    expect(isOnEdge(1, 1, 1, 'NY', 3)).toBe(false);
  });

  it('should return true for PZ when z is at max', () => {
    expect(isOnEdge(1, 1, 2, 'PZ', 3)).toBe(true);
    expect(isOnEdge(1, 1, 1, 'PZ', 3)).toBe(false);
  });

  it('should return true for NZ when z is 0', () => {
    expect(isOnEdge(1, 1, 0, 'NZ', 3)).toBe(true);
    expect(isOnEdge(1, 1, 1, 'NZ', 3)).toBe(false);
  });

  it('should return false for invalid direction', () => {
    expect(isOnEdge(1, 1, 1, 'INVALID', 3)).toBe(false);
  });

  it('should work for different cube sizes', () => {
    expect(isOnEdge(4, 2, 2, 'PX', 5)).toBe(true);
    expect(isOnEdge(3, 2, 2, 'PX', 5)).toBe(false);
    expect(isOnEdge(1, 1, 1, 'PX', 2)).toBe(true);
  });
});

describe('getEdgeFlags', () => {
  it('should return correct flags for corner cubie', () => {
    const flags = getEdgeFlags(0, 0, 0, 3);
    expect(flags).toEqual({
      px: false,
      nx: true,
      py: false,
      ny: true,
      pz: false,
      nz: true,
    });
  });

  it('should return correct flags for center cubie', () => {
    const flags = getEdgeFlags(1, 1, 1, 3);
    expect(flags).toEqual({
      px: false,
      nx: false,
      py: false,
      ny: false,
      pz: false,
      nz: false,
    });
  });

  it('should return correct flags for edge cubie', () => {
    const flags = getEdgeFlags(2, 1, 0, 3);
    expect(flags).toEqual({
      px: true,
      nx: false,
      py: false,
      ny: false,
      pz: false,
      nz: true,
    });
  });
});

describe('getVisibleDirections', () => {
  it('should return 3 directions for corner cubie', () => {
    const dirs = getVisibleDirections(0, 0, 0, 3);
    expect(dirs).toHaveLength(3);
    expect(dirs).toContain('NX');
    expect(dirs).toContain('NY');
    expect(dirs).toContain('NZ');
  });

  it('should return 2 directions for edge cubie', () => {
    const dirs = getVisibleDirections(1, 0, 0, 3);
    expect(dirs).toHaveLength(2);
    expect(dirs).toContain('NY');
    expect(dirs).toContain('NZ');
  });

  it('should return 1 direction for face center cubie', () => {
    const dirs = getVisibleDirections(1, 1, 0, 3);
    expect(dirs).toHaveLength(1);
    expect(dirs).toContain('NZ');
  });

  it('should return 0 directions for internal cubie', () => {
    const dirs = getVisibleDirections(1, 1, 1, 3);
    expect(dirs).toHaveLength(0);
  });
});

describe('forEachEdgeSticker', () => {
  it('should iterate over all edge stickers', () => {
    const stickers = [];
    forEachEdgeSticker(3, (x, y, z, dirKey) => {
      stickers.push({ x, y, z, dirKey });
    });

    // 3x3 cube has 6 faces * 9 stickers = 54 edge stickers
    expect(stickers).toHaveLength(54);
  });

  it('should include corner stickers', () => {
    const stickers = [];
    forEachEdgeSticker(3, (x, y, z, dirKey) => {
      stickers.push({ x, y, z, dirKey });
    });

    // Check that corner (0,0,0) has 3 stickers
    const cornerStickers = stickers.filter(s => s.x === 0 && s.y === 0 && s.z === 0);
    expect(cornerStickers).toHaveLength(3);
  });
});

describe('countEdgeStickers', () => {
  it('should return correct count for 3x3 cube', () => {
    expect(countEdgeStickers(3)).toBe(54);
  });

  it('should return correct count for 4x4 cube', () => {
    expect(countEdgeStickers(4)).toBe(96);
  });

  it('should return correct count for 2x2 cube', () => {
    expect(countEdgeStickers(2)).toBe(24);
  });
});
