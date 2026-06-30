import { describe, it, expect } from 'vitest';
import { makeCubies, isSurfaceSticker } from '../game/cubeState.js';
import { flipStickerPair, buildManifoldGridMap } from '../game/manifoldLogic.js';
import { buildTunnelLookup, updateTunnelLookupIncremental } from '../worm/wormLogic.js';

// The crawler keeps a tileKey → tunnel lookup that is updated incrementally on every flip
// (only the changed cubies are re-examined) and fully rebuilt on rotation. These tests lock
// in the contract that the incremental update produces byte-identical entries to a from-scratch
// full rebuild — otherwise the worm could enter a tunnel that doesn't exist, miss one, or land
// on the wrong exit.

// Reduce a lookup Map to a plain comparable object (Map iteration order is irrelevant).
function comparable(lookup) {
  const obj = {};
  for (const [k, v] of lookup) {
    obj[k] = {
      tunnelKey: v.tunnelKey,
      reversed: v.reversed,
      entry: v.tunnel.entry,
      exit: v.tunnel.exit,
      entryColor: v.tunnel.entryColor,
      exitColor: v.tunnel.exitColor,
      pairId: v.tunnel.pairId,
    };
  }
  return obj;
}

// All surface stickers for a size, as a flat flip-target list.
function surfaceStickers(cubies, size) {
  const out = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const c = cubies[x]?.[y]?.[z];
        if (!c) continue;
        for (const dirKey of Object.keys(c.stickers || {})) {
          if (isSurfaceSticker(x, y, z, dirKey, size)) out.push({ x, y, z, dirKey });
        }
      }
    }
  }
  return out;
}

// Small deterministic PRNG so a failure is reproducible from the seed.
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('worm tunnel lookup — incremental vs full rebuild', () => {
  for (const size of [3, 4, 5]) {
    it(`stays identical to a full rebuild across a flip sequence (size ${size})`, () => {
      let cubies = makeCubies(size);
      let map = buildManifoldGridMap(cubies, size);

      // Seed both paths from the same initial full build.
      const lookup = buildTunnelLookup(cubies, size, map);
      let prevCubies = cubies;

      const targets = surfaceStickers(cubies, size);
      const rand = lcg(1234 + size);

      for (let step = 0; step < 200; step++) {
        const t = targets[Math.floor(rand() * targets.length)];
        // Flipping the same tile twice toggles it back, so this sequence both creates and
        // removes tunnels (exercising the add and delete branches of the incremental update).
        cubies = flipStickerPair(cubies, size, t.x, t.y, t.z, t.dirKey, map);
        // Geometry is unchanged by a flip, so the map structure is stable; rebuild it from the
        // current cubies and feed the SAME map to both paths (mirrors getManifoldMap's contract).
        map = buildManifoldGridMap(cubies, size);

        updateTunnelLookupIncremental(lookup, cubies, prevCubies, size, map);
        const full = buildTunnelLookup(cubies, size, map);

        expect(comparable(lookup)).toEqual(comparable(full));
        prevCubies = cubies;
      }
    });
  }

  it('handles two tunnels sharing one corner cubie without clobbering either', () => {
    const size = 3;
    let cubies = makeCubies(size);
    let map = buildManifoldGridMap(cubies, size);
    const lookup = buildTunnelLookup(cubies, size, map);
    let prev = cubies;

    // A corner cubie carries three surface stickers on different faces. Flip two of them so the
    // same cubie is an endpoint of two distinct tunnels — the case where a naive "delete every
    // tileKey on a changed cubie" pass could drop a tunnel whose partner cubie didn't change.
    const a = { x: size - 1, y: size - 1, z: size - 1, dirKey: 'PX' };
    const b = { x: size - 1, y: size - 1, z: size - 1, dirKey: 'PY' };

    for (const flip of [a, b]) {
      cubies = flipStickerPair(cubies, size, flip.x, flip.y, flip.z, flip.dirKey, map);
      map = buildManifoldGridMap(cubies, size);
      updateTunnelLookupIncremental(lookup, cubies, prev, size, map);
      prev = cubies;
    }

    const full = buildTunnelLookup(cubies, size, map);
    expect(comparable(lookup)).toEqual(comparable(full));
    // Both corner stickers should resolve to tunnels.
    expect(lookup.has(`${a.x},${a.y},${a.z},${a.dirKey}`)).toBe(true);
    expect(lookup.has(`${b.x},${b.y},${b.z},${b.dirKey}`)).toBe(true);
  });
});
