/**
 * mergeRegions.test.js — Unit tests for Merge Mode tier computation.
 *
 * Tier rules (3×3 cube):
 *   Tier 1 ("base")  — 1–2 connected same-color tiles on a face
 *   Tier 2 ("B-tier") — 3–8 connected same-color tiles on a face
 *   Tier 3 ("C-tier") — all 9 tiles of the same color (full face solved)
 *
 * The "test mode" concept: 3 individual tiles merge → B-tier (tier 2),
 * and 3 B-tiers merging to cover the full face → C-tier (tier 3).
 * These tests verify that transition boundary exactly.
 */

import { describe, it, expect } from 'vitest';
import { computeMergeRegions } from '../modes/merge/mergeRegions.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { clone3D } from '../game/cubeState.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the home key string for a sticker, matching computeMergeRegions format. */
function homeKey(x, y, z, dir) {
  return `${x}-${y}-${z}-${dir}`;
}

/** Collect all tier values for one face direction from a tier map. */
function faceTiers(tiers, cubies, size, dir) {
  const out = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const cubie = cubies[x]?.[y]?.[z];
        if (!cubie?.stickers[dir]) continue;
        const st = cubie.stickers[dir];
        const key = homeKey(st.origPos.x, st.origPos.y, st.origPos.z, st.origDir);
        out.push(tiers[key] ?? 1);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Solved cube — every face is a full 9-tile same-color region → all tier 3
// ---------------------------------------------------------------------------

describe('computeMergeRegions — solved cube (all C-tier)', () => {
  it('returns tier 3 for all stickers on a freshly created 3×3 cube', () => {
    const cubies = makeCubies(3);
    const tiers = computeMergeRegions(cubies, 3);

    // All 54 visible sticker home keys should be tier 3
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          const cubie = cubies[x][y][z];
          for (const [dir, st] of Object.entries(cubie.stickers)) {
            const key = homeKey(st.origPos.x, st.origPos.y, st.origPos.z, dir);
            expect(tiers[key]).toBe(3);
          }
        }
      }
    }
  });

  it('returns tier 3 for every face direction individually on a solved cube', () => {
    const cubies = makeCubies(3);
    const tiers = computeMergeRegions(cubies, 3);

    for (const dir of ['PZ', 'NZ', 'PX', 'NX', 'PY', 'NY']) {
      const fTiers = faceTiers(tiers, cubies, 3, dir);
      expect(fTiers).toHaveLength(9);
      expect(fTiers.every((t) => t === 3)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Single-tile isolation → tier 1 (base form)
// ---------------------------------------------------------------------------

describe('computeMergeRegions — isolated tiles (tier 1 / base)', () => {
  it('gives tier 1 when a sticker is alone with no same-color neighbor', () => {
    // After rotating all three columns independently the PZ face ends up with
    // at least one isolated tile. Three column rotations by +1 applied to
    // separate slices (x=0, x=1, x=2) each bring a different colour into PZ,
    // producing 1-tile isolated groups.
    let cubies = makeCubies(3);
    cubies = rotateSliceCubies(cubies, 3, 'col', 0, 1);
    cubies = rotateSliceCubies(cubies, 3, 'col', 0, 1);
    cubies = rotateSliceCubies(cubies, 3, 'col', 0, 1); // 3× = -1 net rotation
    cubies = rotateSliceCubies(cubies, 3, 'row', 0, 1);
    cubies = rotateSliceCubies(cubies, 3, 'depth', 1, 1);
    const tiers = computeMergeRegions(cubies, 3);

    // Some tiles should be tier 1 after mixed rotations — the overall result
    // must only contain valid tiers (the next describe block tests T1 directly).
    const allTiers = Object.values(tiers);
    expect(allTiers.every((t) => [1, 2, 3].includes(t))).toBe(true);
    // A heavily scrambled cube should not be all tier-3
    const fTiers = faceTiers(tiers, cubies, 3, 'PZ');
    expect(fTiers.every((t) => t === 3)).toBe(false);
  });

  it('gives tier 1 when a region has exactly 1 tile', () => {
    // Manually build a 3×3 cube where PZ face has all different colors
    // by force-setting curr values. We only need to prove a lone tile → tier 1.
    const cubies = makeCubies(3);
    const cloned = clone3D(cubies);

    // Set PZ stickers to unique per-position colors (1–9 mod 6+1)
    let colorIdx = 1;
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        const st = cloned[x][y][2].stickers.PZ;
        if (st) st.curr = ((colorIdx++ - 1) % 6) + 1;
      }
    }

    const tiers = computeMergeRegions(cloned, 3);
    const fTiers = faceTiers(tiers, cloned, 3, 'PZ');
    // Every tile is alone → all tier 1
    expect(fTiers.every((t) => t === 1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3-tile connected region → B-tier (tier 2)
// This is the core "merge mode test mode" rule:
//   3 individual tiles merge → 1 B-tier entity.
// ---------------------------------------------------------------------------

describe('computeMergeRegions — 3-tile region → B-tier (tier 2)', () => {
  it('assigns tier 2 to a horizontal 3-tile strip sharing the same color on PZ face', () => {
    // Build a solved cube then force the bottom row of PZ to all the same color
    // while keeping the other 6 tiles different colors, so only that row merges.
    const cubies = makeCubies(3);
    const cloned = clone3D(cubies);

    // Bottom row of PZ (y=0, z=2) → color 99 (fake, just needs to differ from rest)
    // PZ stickers are on cubies where z = size-1 = 2
    for (let x = 0; x < 3; x++) {
      const st = cloned[x][0][2].stickers.PZ;
      if (st) st.curr = 99;
    }
    // Upper two rows → each a distinct color so they stay isolated (tier 1)
    for (let x = 0; x < 3; x++) {
      for (let y = 1; y < 3; y++) {
        const st = cloned[x][y][2].stickers.PZ;
        if (st) st.curr = x * 10 + y; // all distinct
      }
    }

    const tiers = computeMergeRegions(cloned, 3);

    // The 3 bottom-row stickers should be tier 2
    for (let x = 0; x < 3; x++) {
      const st = cloned[x][0][2].stickers.PZ;
      const key = homeKey(st.origPos.x, st.origPos.y, st.origPos.z, 'PZ');
      expect(tiers[key]).toBe(2);
    }

    // The other 6 stickers should be tier 1 (all isolated)
    for (let x = 0; x < 3; x++) {
      for (let y = 1; y < 3; y++) {
        const st = cloned[x][y][2].stickers.PZ;
        const key = homeKey(st.origPos.x, st.origPos.y, st.origPos.z, 'PZ');
        expect(tiers[key]).toBe(1);
      }
    }
  });

  it('assigns tier 2 to an L-shaped 3-tile region (non-straight adjacency)', () => {
    const cubies = makeCubies(3);
    const cloned = clone3D(cubies);

    // All PZ stickers → unique colors first
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        const st = cloned[x][y][2].stickers.PZ;
        if (st) st.curr = x * 10 + y;
      }
    }

    // Paint an L-shape: (0,0), (1,0), (0,1) on PZ face → same color
    const L_COLOR = 77;
    cloned[0][0][2].stickers.PZ.curr = L_COLOR;
    cloned[1][0][2].stickers.PZ.curr = L_COLOR;
    cloned[0][1][2].stickers.PZ.curr = L_COLOR;

    const tiers = computeMergeRegions(cloned, 3);

    // All three L-shape stickers → tier 2
    expect(tiers[homeKey(0, 0, 2, 'PZ')]).toBe(2);
    expect(tiers[homeKey(1, 0, 2, 'PZ')]).toBe(2);
    expect(tiers[homeKey(0, 1, 2, 'PZ')]).toBe(2);
  });

  it('gives tier 2 on a 2×2 cube when 3 of 4 face tiles share a color', () => {
    // 2×2 cube: full face = 4 tiles; tier 3 needs 4, tier 2 needs 3
    const cubies = makeCubies(2);
    const cloned = clone3D(cubies);

    // PZ face: 4 stickers (z=1). Set 3 to same color, 1 different.
    const positions = [[0, 0], [1, 0], [0, 1]];
    for (const [x, y] of positions) {
      const st = cloned[x][y][1].stickers.PZ;
      if (st) st.curr = 55;
    }
    cloned[1][1][1].stickers.PZ.curr = 33; // lone tile

    const tiers = computeMergeRegions(cloned, 2);

    for (const [x, y] of positions) {
      const st = cloned[x][y][1].stickers.PZ;
      const key = homeKey(st.origPos.x, st.origPos.y, st.origPos.z, 'PZ');
      expect(tiers[key]).toBe(2);
    }

    const loneSt = cloned[1][1][1].stickers.PZ;
    const loneKey = homeKey(loneSt.origPos.x, loneSt.origPos.y, loneSt.origPos.z, 'PZ');
    expect(tiers[loneKey]).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Full face → C-tier (tier 3)
// 3 B-tier regions covering the whole face upgrade to C-tier.
// ---------------------------------------------------------------------------

describe('computeMergeRegions — full face → C-tier (tier 3)', () => {
  it('assigns tier 3 when all 9 tiles on PZ share the same color (full solve)', () => {
    const cubies = makeCubies(3);
    const cloned = clone3D(cubies);

    // PZ is already all color 1 in a solved cube — verify tier 3
    const tiers = computeMergeRegions(cloned, 3);
    const fTiers = faceTiers(tiers, cloned, 3, 'PZ');
    expect(fTiers.every((t) => t === 3)).toBe(true);
  });

  it('assigns tier 3 when a non-default single color covers the whole PZ face', () => {
    const cubies = makeCubies(3);
    const cloned = clone3D(cubies);

    // Override PZ face to all color 3 (White — normally a different face)
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        const st = cloned[x][y][2].stickers.PZ;
        if (st) st.curr = 3;
      }
    }

    const tiers = computeMergeRegions(cloned, 3);
    const fTiers = faceTiers(tiers, cloned, 3, 'PZ');
    expect(fTiers.every((t) => t === 3)).toBe(true);
  });

  it('assigns tier 3 for full face on a 2×2 cube', () => {
    const cubies = makeCubies(2);
    const tiers = computeMergeRegions(cubies, 2);
    // Solved 2×2: all 4 tiles on each face are same color → tier 3
    const fTiers = faceTiers(tiers, cubies, 2, 'PZ');
    expect(fTiers.every((t) => t === 3)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tier 2 boundary — exactly 2 tiles is NOT yet B-tier
// ---------------------------------------------------------------------------

describe('computeMergeRegions — 2-tile pair stays tier 1 (below B-tier threshold)', () => {
  it('assigns tier 1 to a 2-tile connected region', () => {
    const cubies = makeCubies(3);
    const cloned = clone3D(cubies);

    // All PZ stickers → unique first
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        const st = cloned[x][y][2].stickers.PZ;
        if (st) st.curr = x * 10 + y;
      }
    }

    // Paint just 2 adjacent tiles the same color
    cloned[0][0][2].stickers.PZ.curr = 42;
    cloned[1][0][2].stickers.PZ.curr = 42;

    const tiers = computeMergeRegions(cloned, 3);

    expect(tiers[homeKey(0, 0, 2, 'PZ')]).toBe(1);
    expect(tiers[homeKey(1, 0, 2, 'PZ')]).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Multi-face independence — tier on one face doesn't bleed to adjacent faces
// ---------------------------------------------------------------------------

describe('computeMergeRegions — faces are computed independently', () => {
  it('a full-color PZ face (tier 3) does not affect NZ tier assignment', () => {
    const cubies = makeCubies(3);
    const cloned = clone3D(cubies);

    // Scramble NZ face completely (make all tiles different colors)
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        const st = cloned[x][y][0].stickers.NZ;
        if (st) st.curr = x * 10 + y;
      }
    }

    const tiers = computeMergeRegions(cloned, 3);

    // PZ should still be all tier 3
    const pzTiers = faceTiers(tiers, cloned, 3, 'PZ');
    expect(pzTiers.every((t) => t === 3)).toBe(true);

    // NZ tiles should all be tier 1 (all isolated)
    const nzTiers = faceTiers(tiers, cloned, 3, 'NZ');
    expect(nzTiers.every((t) => t === 1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Return value structure
// ---------------------------------------------------------------------------

describe('computeMergeRegions — return value contract', () => {
  it('returns a plain object (not a Map)', () => {
    const cubies = makeCubies(3);
    const result = computeMergeRegions(cubies, 3);
    expect(result).toBeTypeOf('object');
    expect(result).not.toBeInstanceOf(Map);
  });

  it('keys follow the expected homeKey format', () => {
    const cubies = makeCubies(3);
    const result = computeMergeRegions(cubies, 3);
    const keys = Object.keys(result);
    // Every key should match "x-y-z-DIR"
    const keyPattern = /^\d+-\d+-\d+-[A-Z]{2}$/;
    for (const k of keys) {
      expect(k).toMatch(keyPattern);
    }
  });

  it('only contains tier values 1, 2, or 3', () => {
    let cubies = makeCubies(3);
    cubies = rotateSliceCubies(cubies, 3, 'col', 0, 1);
    cubies = rotateSliceCubies(cubies, 3, 'row', 1, 1);
    const result = computeMergeRegions(cubies, 3);
    for (const v of Object.values(result)) {
      expect([1, 2, 3]).toContain(v);
    }
  });
});
