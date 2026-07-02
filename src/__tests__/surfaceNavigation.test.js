import { describe, it, expect } from 'vitest';
import { getNextSurfacePosition } from '../worm/wormLogic.js';
import { HEAL_COST, ORB_SEGMENT_GROWTH } from '../worm/healerWorm/constants.js';

// ─── getNextSurfacePosition ────────────────────────────────────────────────────

describe('getNextSurfacePosition — intra-face moves', () => {
  const size = 3;

  it('moves right within the PZ face without wrapping', () => {
    // Center tile of front face moving right
    const result = getNextSurfacePosition({ x: 1, y: 1, z: 2, dirKey: 'PZ' }, 'right', size);
    expect(result).not.toBeNull();
    expect(result.dirKey).toBe('PZ');
    expect(result.x).toBe(2);
    expect(result.y).toBe(1);
    expect(result.z).toBe(2);
  });

  it('moves up within the PZ face without wrapping', () => {
    const result = getNextSurfacePosition({ x: 1, y: 1, z: 2, dirKey: 'PZ' }, 'up', size);
    expect(result).not.toBeNull();
    expect(result.dirKey).toBe('PZ');
    expect(result.y).toBe(2);
  });

  it('returns null for an unrecognised dirKey', () => {
    const result = getNextSurfacePosition({ x: 1, y: 1, z: 2, dirKey: 'INVALID' }, 'up', size);
    expect(result).toBeNull();
  });
});

describe('getNextSurfacePosition — face wrap (size 3)', () => {
  const size = 3;

  it('wraps PZ→PY when moving off the top edge', () => {
    // Top row of PZ face (y = size-1 = 2)
    const result = getNextSurfacePosition({ x: 1, y: 2, z: 2, dirKey: 'PZ' }, 'up', size);
    expect(result).not.toBeNull();
    expect(result.dirKey).toBe('PY');
  });

  it('wraps PZ→NY when moving off the bottom edge', () => {
    const result = getNextSurfacePosition({ x: 1, y: 0, z: 2, dirKey: 'PZ' }, 'down', size);
    expect(result).not.toBeNull();
    expect(result.dirKey).toBe('NY');
  });

  it('wraps PZ→PX when moving off the right edge', () => {
    const result = getNextSurfacePosition({ x: 2, y: 1, z: 2, dirKey: 'PZ' }, 'right', size);
    expect(result).not.toBeNull();
    expect(result.dirKey).toBe('PX');
  });

  it('wraps PZ→NX when moving off the left edge', () => {
    const result = getNextSurfacePosition({ x: 0, y: 1, z: 2, dirKey: 'PZ' }, 'left', size);
    expect(result).not.toBeNull();
    expect(result.dirKey).toBe('NX');
  });

  it('NZ face reverses left/right — moving right wraps to NX not PX', () => {
    // On NZ the X axis is mirrored so "right" goes toward -X (NX face).
    // Start at x=0 (left edge in world space) so dx=-1 wraps to NX.
    const result = getNextSurfacePosition({ x: 0, y: 1, z: 0, dirKey: 'NZ' }, 'right', size);
    expect(result).not.toBeNull();
    expect(result.dirKey).toBe('NX');
  });

  it('wraps PX→PY when moving off the top edge of the right face', () => {
    const result = getNextSurfacePosition({ x: 2, y: 2, z: 1, dirKey: 'PX' }, 'up', size);
    expect(result).not.toBeNull();
    expect(result.dirKey).toBe('PY');
  });
});

describe('getNextSurfacePosition — size-2 cube', () => {
  it('wraps a corner tile immediately on a 2×2 cube', () => {
    const size = 2;
    // Right edge of PZ face (x = 1 = size-1) moving right → PX face
    const result = getNextSurfacePosition({ x: 1, y: 1, z: 1, dirKey: 'PZ' }, 'right', size);
    expect(result).not.toBeNull();
    expect(result.dirKey).toBe('PX');
  });
});

// ─── Healing cost invariants ───────────────────────────────────────────────────

describe('healing cost constants', () => {
  it('HEAL_COST equals 4 (two full orb pickups)', () => {
    expect(HEAL_COST).toBe(4);
  });

  it('ORB_SEGMENT_GROWTH equals 3 (each orb grows tail by 3)', () => {
    expect(ORB_SEGMENT_GROWTH).toBe(3);
  });

  it('a single orb pickup is not enough to fully heal a tunnel', () => {
    expect(ORB_SEGMENT_GROWTH).toBeLessThan(HEAL_COST);
  });

  it('two orb pickups cover the heal cost', () => {
    expect(ORB_SEGMENT_GROWTH * 2).toBeGreaterThanOrEqual(HEAL_COST);
  });
});

