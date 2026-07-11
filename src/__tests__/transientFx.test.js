import { describe, it, expect } from 'vitest';
import { pruneExpiredFx } from '../utils/transientFx.js';

describe('pruneExpiredFx', () => {
  it('returns the same reference when nothing is expired', () => {
    const map = {
      a: { startMs: 1000, durationMs: 600 },
      b: { startMs: 1200, durationMs: 400 }
    };
    expect(pruneExpiredFx(map, 1300)).toBe(map);
  });

  it('returns the same reference for an empty map', () => {
    const map = {};
    expect(pruneExpiredFx(map, 99999)).toBe(map);
  });

  it('drops entries whose window has fully elapsed', () => {
    const map = {
      done: { startMs: 0, durationMs: 500 },
      live: { startMs: 400, durationMs: 500 }
    };
    const pruned = pruneExpiredFx(map, 600);
    expect(pruned).not.toBe(map);
    expect(pruned).toEqual({ live: { startMs: 400, durationMs: 500 } });
    // Input map is never mutated
    expect(map.done).toBeDefined();
  });

  it('treats an entry at exactly startMs + durationMs as expired', () => {
    const map = { edge: { startMs: 100, durationMs: 500 } };
    expect(pruneExpiredFx(map, 600)).toEqual({});
  });

  it('skips null/undefined entries without throwing', () => {
    const map = { ghost: null, live: { startMs: 0, durationMs: 1000 } };
    const pruned = pruneExpiredFx(map, 500);
    expect(pruned).toBe(map);
  });

  it('prunes everything when all entries are stale', () => {
    const map = {
      a: { startMs: 0, durationMs: 100 },
      b: { startMs: 50, durationMs: 100 }
    };
    expect(pruneExpiredFx(map, 1000)).toEqual({});
  });
});
