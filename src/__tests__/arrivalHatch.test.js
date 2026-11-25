import { describe, it, expect } from 'vitest';
import { HATCH_SHARDS, SHARD_FLIGHT, hatchDone, hatchesHere, shardPoseInto, shellRock } from '../worm/healerWorm/arrivalHatch.js';
import { ARRIVAL_PORTAL_RADIUS as R } from '../worm/healerWorm/storyArrival.js';

describe('the first arrival hatches', () => {
  it('only on Story level 1 before it has been cleared, and never on a quick retry', () => {
    const fresh = { wormStoryLevel: 1, playerProgress: { wormStory: { stars: {} } } };
    expect(hatchesHere(fresh)).toBe(true);
    expect(hatchesHere(fresh, true)).toBe(false);
    expect(hatchesHere({ ...fresh, playerProgress: { wormStory: { stars: { 1: 2 } } } })).toBe(false);
    expect(hatchesHere({ ...fresh, wormStoryLevel: 2 })).toBe(false);
    expect(hatchesHere({ ...fresh, wormStoryLevel: null })).toBe(false);
  });

  it('rocks the shell harder as the head pushes up', () => {
    expect(shellRock(0)).toBe(0);
    expect(shellRock(0.2)).toBeGreaterThan(0);
    expect(shellRock(1)).toBe(1);
  });

  it('bursts shards out of the rim that land on the tile, rest, then shrink away', () => {
    const p = {};
    for (let i = 0; i < HATCH_SHARDS; i++) {
      expect(shardPoseInto(p, i, -0.1, R).scale).toBe(0);
      shardPoseInto(p, i, 0, R);
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(R * 0.55, 6);
      expect(p.scale).toBeGreaterThan(0);
      for (let t = 0; t < 2; t += 0.05) expect(shardPoseInto(p, i, t, R).z).toBeGreaterThanOrEqual(0.015);
      // Landed and lying still.
      const landed = { ...shardPoseInto(p, i, SHARD_FLIGHT + 0.1, R) };
      expect(landed.z).toBe(0.015);
      expect(shardPoseInto(p, i, SHARD_FLIGHT + 0.5, R)).toMatchObject({ x: landed.x, y: landed.y, z: landed.z });
      // Out past the rim, not back in the hole.
      expect(Math.hypot(landed.x, landed.y)).toBeGreaterThan(R);
      expect(shardPoseInto(p, i, 5, R).scale).toBe(0);
    }
    expect(hatchDone(0.5)).toBe(false);
    expect(hatchDone(5)).toBe(true);
  });
});
