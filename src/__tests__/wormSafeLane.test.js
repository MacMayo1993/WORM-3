import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  chooseSafeLane,
  pendingLayers,
  sliceTileCount,
  isTileOnLane,
  AXIS_COORD
} from '../worm/healerWorm/safeLane.js';
import { getAllSurfaceTiles, randomFreeTile } from '../worm/healerWorm/surfaceTiles.js';
import { selfCollisionGraceAfterRotation, SAFE_LANE_MAX_SIZE } from '../worm/healerWorm/constants.js';

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── The geometry the whole feature rests on ──────────────────────────────────

describe('slice coverage', () => {
  it('counts an end slice as its cap face plus the ring it cuts', () => {
    // 3x3 end slice: 9 cap + 12 ring = 21 of 54 surface tiles (39%).
    expect(sliceTileCount(3, 0)).toBe(21);
    expect(sliceTileCount(3, 2)).toBe(21);
  });

  it('counts an interior slice as the ring alone', () => {
    // The same 3x3, middle slice: 12 of 54 (22%) — why end slices hurt more.
    expect(sliceTileCount(3, 1)).toBe(12);
  });

  it('agrees with the actual surface tile set for every supported size', () => {
    for (let size = 2; size <= 7; size++) {
      const tiles = getAllSurfaceTiles(size);
      expect(tiles).toHaveLength(6 * size * size);
      for (const axis of Object.keys(AXIS_COORD)) {
        for (let i = 0; i < size; i++) {
          const onSlice = tiles.filter((t) => isTileOnLane({ axis, sliceIndex: i }, t.x, t.y, t.z));
          expect(onSlice).toHaveLength(sliceTileCount(size, i));
        }
      }
    }
  });

  it('partitions the surface across the slices of one axis', () => {
    // Each tile has exactly one coordinate per axis, so an axis's slices are
    // disjoint and cover everything. This is what makes "any other slice on the
    // same axis" a sound definition of safe.
    for (let size = 2; size <= 5; size++) {
      let total = 0;
      for (let i = 0; i < size; i++) total += sliceTileCount(size, i);
      expect(total).toBe(6 * size * size);
    }
  });
});

// ─── Lane selection ───────────────────────────────────────────────────────────

describe('pendingLayers', () => {
  it('prefers the full plane list over the anchor', () => {
    expect(pendingLayers({ axis: 'col', sliceIndex: 3, sliceIndices: [3, 7] })).toEqual([3, 7]);
  });

  it('falls back to the anchor when a move turns one plane', () => {
    expect(pendingLayers({ axis: 'col', sliceIndex: 2 })).toEqual([2]);
  });

  it('is empty for a missing or index-less move', () => {
    expect(pendingLayers(null)).toEqual([]);
    expect(pendingLayers({ axis: 'col' })).toEqual([]);
  });
});

describe('chooseSafeLane', () => {
  it('gives a 2x2 the opposite half', () => {
    expect(chooseSafeLane(2, { axis: 'col', sliceIndex: 0 })).toMatchObject({ axis: 'col', sliceIndex: 1 });
    expect(chooseSafeLane(2, { axis: 'col', sliceIndex: 1 })).toMatchObject({ axis: 'col', sliceIndex: 0 });
  });

  it('picks the farthest slice from the threat', () => {
    expect(chooseSafeLane(3, { axis: 'row', sliceIndex: 0 })).toMatchObject({ sliceIndex: 2, margin: 2 });
    expect(chooseSafeLane(5, { axis: 'depth', sliceIndex: 0 })).toMatchObject({ sliceIndex: 4, margin: 4 });
  });

  it('breaks a distance tie toward the roomier slice', () => {
    // 3x3 middle threatened: both ends sit at margin 1, both carry 21 tiles, so
    // the lowest index settles it — but the lane must be an end slice, never the
    // 12-tile ring, whenever an end slice ties on margin.
    const lane = chooseSafeLane(3, { axis: 'col', sliceIndex: 1 });
    expect(lane.margin).toBe(1);
    expect(lane.tiles).toBe(21);
  });

  it('excludes every plane of a two-plane turn', () => {
    const lane = chooseSafeLane(5, { axis: 'col', sliceIndex: 0, sliceIndices: [0, 4] });
    expect([0, 4]).not.toContain(lane.sliceIndex);
    expect(lane.sliceIndex).toBe(2);
  });

  it('is deterministic, so the lane never flickers mid-warning', () => {
    const move = { axis: 'col', sliceIndex: 1 };
    const first = chooseSafeLane(4, move);
    for (let i = 0; i < 20; i++) expect(chooseSafeLane(4, move)).toEqual(first);
  });

  it('returns null when there is no move, no axis, or no free slice', () => {
    expect(chooseSafeLane(3, null)).toBeNull();
    expect(chooseSafeLane(3, { sliceIndex: 0 })).toBeNull();
    expect(chooseSafeLane(2, { axis: 'col', sliceIndex: 0, sliceIndices: [0, 1] })).toBeNull();
  });

  it('never names a slice the move actually turns', () => {
    for (let size = 2; size <= SAFE_LANE_MAX_SIZE; size++) {
      for (const axis of Object.keys(AXIS_COORD)) {
        for (let i = 0; i < size; i++) {
          const lane = chooseSafeLane(size, { axis, sliceIndex: i });
          if (size === 1) continue;
          expect(lane).not.toBeNull();
          expect(lane.sliceIndex).not.toBe(i);
          expect(lane.axis).toBe(axis);
        }
      }
    }
  });
});

describe('isTileOnLane', () => {
  it('maps each axis to its own coordinate', () => {
    expect(isTileOnLane({ axis: 'col', sliceIndex: 2 }, 2, 0, 0)).toBe(true);
    expect(isTileOnLane({ axis: 'row', sliceIndex: 2 }, 0, 2, 0)).toBe(true);
    expect(isTileOnLane({ axis: 'depth', sliceIndex: 2 }, 0, 0, 2)).toBe(true);
    expect(isTileOnLane({ axis: 'col', sliceIndex: 2 }, 0, 2, 2)).toBe(false);
  });

  it('is false for a null lane or an unknown axis', () => {
    expect(isTileOnLane(null, 0, 0, 0)).toBe(false);
    expect(isTileOnLane({ axis: 'nope', sliceIndex: 0 }, 0, 0, 0)).toBe(false);
  });
});

// ─── Orb respawn bias ─────────────────────────────────────────────────────────

describe('randomFreeTile lane bias', () => {
  const laneOf = (size, move) => {
    const lane = chooseSafeLane(size, move);
    return (t) => isTileOnLane(lane, t.x, t.y, t.z);
  };

  it('lands in the lane when the bias roll passes', () => {
    const prefer = laneOf(3, { axis: 'col', sliceIndex: 0 });
    // First random() is the bias roll, the rest index into the preferred pool.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const tile = randomFreeTile(3, [], prefer, 0.7);
    expect(prefer(tile)).toBe(true);
  });

  it('falls back to the whole board when the bias roll fails', () => {
    const prefer = laneOf(3, { axis: 'col', sliceIndex: 0 });
    // A failed roll must sample the FULL free pool, not the lane — so it lands on
    // exactly the tile an unbiased pick would have chosen from the same stream.
    // (Asserting the tile is off-lane would be wrong: the whole pool contains lane
    // tiles too, and a uniform pick may legitimately land on one.)
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const biased = randomFreeTile(3, [], prefer, 0.7);
    const uniform = randomFreeTile(3, []);
    expect(biased).toEqual(uniform);
  });

  it('reaches tiles off the lane over many biased picks', () => {
    const prefer = laneOf(3, { axis: 'col', sliceIndex: 0 });
    let offLane = 0;
    for (let i = 0; i < 400; i++) {
      if (!prefer(randomFreeTile(3, [], prefer, 0.7))) offLane++;
    }
    // A bias, not a rule: the rest of the board must never go barren.
    expect(offLane).toBeGreaterThan(0);
  });

  it('is the old uniform pick with no predicate or a zero bias', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const plain = randomFreeTile(3, []);
    expect(randomFreeTile(3, [], null, 0.7)).toEqual(plain);
    expect(randomFreeTile(3, [], () => true, 0)).toEqual(plain);
  });

  it('still returns a legal free tile when the lane is fully excluded', () => {
    const lane = chooseSafeLane(2, { axis: 'col', sliceIndex: 0 });
    const laneTiles = getAllSurfaceTiles(2).filter((t) => isTileOnLane(lane, t.x, t.y, t.z));
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const tile = randomFreeTile(2, laneTiles, (t) => isTileOnLane(lane, t.x, t.y, t.z), 1);
    // Every preferred tile is taken, so it degrades to the free pool rather than
    // returning an occupied tile or undefined.
    expect(tile).toBeDefined();
    expect(isTileOnLane(lane, tile.x, tile.y, tile.z)).toBe(false);
  });

  it('never returns an excluded tile while free tiles remain', () => {
    const all = getAllSurfaceTiles(3);
    const exclude = all.slice(0, 50);
    const excluded = new Set(exclude.map((t) => `${t.x},${t.y},${t.z},${t.dirKey}`));
    for (let i = 0; i < 50; i++) {
      const tile = randomFreeTile(3, exclude, () => true, 0.7);
      expect(excluded.has(`${tile.x},${tile.y},${tile.z},${tile.dirKey}`)).toBe(false);
    }
  });
});

// ─── Post-rotation grace ──────────────────────────────────────────────────────

describe('selfCollisionGraceAfterRotation', () => {
  it('gives the most relief where a turn moves the most of the board', () => {
    // 1/N chance of being caught: 50% at 2, 33% at 3, 20% at 5.
    expect(selfCollisionGraceAfterRotation(2)).toBe(5);
    expect(selfCollisionGraceAfterRotation(3)).toBe(4);
    expect(selfCollisionGraceAfterRotation(5)).toBe(3);
  });

  it('decreases monotonically with board size', () => {
    for (let size = 3; size <= 8; size++) {
      expect(selfCollisionGraceAfterRotation(size)).toBeLessThanOrEqual(
        selfCollisionGraceAfterRotation(size - 1)
      );
    }
  });

  it('leaves the roomy boards exactly as they were', () => {
    expect(selfCollisionGraceAfterRotation(6)).toBe(0);
    expect(selfCollisionGraceAfterRotation(7)).toBe(0);
    expect(selfCollisionGraceAfterRotation(15)).toBe(0);
  });
});
