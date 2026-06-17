import { describe, it, expect, beforeEach } from 'vitest';
import { getManifoldMap, resetManifoldMap } from '../game/manifoldMapStore.js';
import { buildManifoldGridMap } from '../game/manifoldLogic.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { flipStickerPair } from '../game/manifoldLogic.js';

describe('manifoldMapStore', () => {
  beforeEach(() => {
    // Module-level singleton — isolate every case.
    resetManifoldMap();
  });

  it('matches a full buildManifoldGridMap for the current geometry', () => {
    const cubies = makeCubies(3);
    const got = getManifoldMap(cubies, 3, 0);
    const want = buildManifoldGridMap(cubies, 3);
    expect(got.size).toBe(want.size);
    for (const [k, v] of want) {
      expect(got.get(k)).toMatchObject({ x: v.x, y: v.y, z: v.z, dirKey: v.dirKey });
    }
  });

  it('returns the same Map reference within an epoch (cache hit)', () => {
    const cubies = makeCubies(3);
    const a = getManifoldMap(cubies, 3, 0);
    const b = getManifoldMap(cubies, 3, 0);
    expect(a).toBe(b);
  });

  it('returns a fresh Map reference when the epoch advances (rotation)', () => {
    const cubies = makeCubies(3);
    const before = getManifoldMap(cubies, 3, 0);
    const rotated = rotateSliceCubies(cubies, 3, 'col', 0, 1);
    const after = getManifoldMap(rotated, 3, 1);
    expect(after).not.toBe(before);
    // And it agrees with a from-scratch rebuild of the rotated geometry.
    const want = buildManifoldGridMap(rotated, 3);
    expect(after.size).toBe(want.size);
    for (const [k, v] of want) {
      expect(after.get(k)).toMatchObject({ x: v.x, y: v.y, z: v.z, dirKey: v.dirKey });
    }
  });

  it('reuses the cached map across flips (flips never change geometry)', () => {
    const cubies = makeCubies(3);
    const map = getManifoldMap(cubies, 3, 0);
    // Flip a corner sticker pair — same epoch, new cubies reference.
    const flipped = flipStickerPair(cubies, 3, 2, 2, 2, 'PZ', map);
    const afterFlip = getManifoldMap(flipped, 3, 0);
    expect(afterFlip).toBe(map);
    // Position index is unchanged by a flip: every entry still resolves to a valid cell.
    for (const v of afterFlip.values()) {
      expect(flipped[v.x][v.y][v.z].stickers[v.dirKey]).toBeDefined();
    }
  });

  it('rebuilds when size changes even if epoch collides', () => {
    const small = makeCubies(2);
    const mSmall = getManifoldMap(small, 2, 0);
    const big = makeCubies(4);
    const mBig = getManifoldMap(big, 4, 0);
    expect(mBig).not.toBe(mSmall);
    expect(mBig.size).toBe(buildManifoldGridMap(big, 4).size);
  });
});
