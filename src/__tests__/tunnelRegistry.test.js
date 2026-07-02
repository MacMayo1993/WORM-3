import { describe, it, expect, beforeEach } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { flipStickerPair, buildManifoldGridMap } from '../game/manifoldLogic.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { buildTunnelLookup } from '../worm/wormLogic.js';
import { getTunnelLookup, hasActiveTunnels, resetTunnelRegistry } from '../worm/tunnelRegistry.js';
import { resetManifoldMap } from '../game/manifoldMapStore.js';

// The registry is the single shared owner of the tile→tunnel lookup, queried
// synchronously with the live store cubies by the crawler, WormholeRings, and the
// finalHealing sweep. These tests lock in its caching contract: same-input calls
// return the same Map, same-epoch flips take the incremental path and still match
// a from-scratch rebuild, and an epoch change (rotation) forces a full rebuild.

const flipAt = (cubies, size, x, y, z, dirKey) =>
  flipStickerPair(cubies, size, x, y, z, dirKey, buildManifoldGridMap(cubies, size));

// Plain-object form so Maps built by different paths can be deep-compared.
function comparable(lookup) {
  const obj = {};
  for (const [k, v] of lookup) {
    obj[k] = { tunnelKey: v.tunnelKey, reversed: v.reversed, entry: v.tunnel.entry, exit: v.tunnel.exit };
  }
  return obj;
}

beforeEach(() => {
  resetTunnelRegistry();
  resetManifoldMap();
});

describe('getTunnelLookup caching', () => {
  it('returns the identical Map for repeated calls with the same inputs', () => {
    const size = 3;
    const cubies = flipAt(makeCubies(size), size, 1, 1, 2, 'PZ');
    const a = getTunnelLookup(cubies, size, 0);
    const b = getTunnelLookup(cubies, size, 0);
    expect(b).toBe(a);
    expect(a.size).toBe(2); // one tunnel = two endpoint entries
  });

  it('matches a from-scratch build after a same-epoch flip (incremental path)', () => {
    const size = 3;
    let cubies = makeCubies(size);
    cubies = flipAt(cubies, size, 1, 1, 2, 'PZ');
    getTunnelLookup(cubies, size, 0); // prime the cache

    cubies = flipAt(cubies, size, 0, 1, 2, 'PZ'); // second flip, same geometry
    const incremental = getTunnelLookup(cubies, size, 0);
    const fresh = buildTunnelLookup(cubies, size, buildManifoldGridMap(cubies, size));
    expect(comparable(incremental)).toEqual(comparable(fresh));
    expect(incremental.size).toBe(4);
  });

  it('a heal (flip back) removes both endpoint entries', () => {
    const size = 3;
    let cubies = makeCubies(size);
    cubies = flipAt(cubies, size, 1, 1, 2, 'PZ');
    expect(getTunnelLookup(cubies, size, 0).size).toBe(2);

    cubies = flipAt(cubies, size, 1, 1, 2, 'PZ'); // flip the same pair back
    expect(getTunnelLookup(cubies, size, 0).size).toBe(0);
  });

  it('rebuilds correctly when the epoch advances (rotation)', () => {
    const size = 3;
    let cubies = makeCubies(size);
    cubies = flipAt(cubies, size, 1, 1, 2, 'PZ');
    getTunnelLookup(cubies, size, 0);

    cubies = rotateSliceCubies(cubies, size, 'row', 1, 1);
    const afterRotation = getTunnelLookup(cubies, size, 1);
    const fresh = buildTunnelLookup(cubies, size, buildManifoldGridMap(cubies, size));
    expect(comparable(afterRotation)).toEqual(comparable(fresh));
    expect(afterRotation.size).toBe(2); // still one tunnel, at rotated coordinates
  });

  it('rebuilds when the cube size changes', () => {
    const c3 = flipAt(makeCubies(3), 3, 1, 1, 2, 'PZ');
    expect(getTunnelLookup(c3, 3, 0).size).toBe(2);

    const c4 = flipAt(makeCubies(4), 4, 1, 1, 3, 'PZ');
    const fresh = buildTunnelLookup(c4, 4, buildManifoldGridMap(c4, 4));
    expect(comparable(getTunnelLookup(c4, 4, 0))).toEqual(comparable(fresh));
  });
});

describe('hasActiveTunnels', () => {
  it('is false on a pristine cube and true once a pair is flipped', () => {
    const size = 3;
    let cubies = makeCubies(size);
    expect(hasActiveTunnels(cubies, size, 0)).toBe(false);

    cubies = flipAt(cubies, size, 1, 1, 2, 'PZ');
    expect(hasActiveTunnels(cubies, size, 0)).toBe(true);
  });

  it('goes false again after the last tunnel heals', () => {
    const size = 3;
    let cubies = makeCubies(size);
    cubies = flipAt(cubies, size, 1, 1, 2, 'PZ');
    expect(hasActiveTunnels(cubies, size, 0)).toBe(true);
    cubies = flipAt(cubies, size, 1, 1, 2, 'PZ');
    expect(hasActiveTunnels(cubies, size, 0)).toBe(false);
  });
});
