import { describe, it, expect } from 'vitest';
import { createLevel } from '../levels/schema.js';
import { CUBE_CAMPAIGN_LEVELS, getCubeCampaignLevel } from '../levels/data/cube-campaign.js';
import { getNextLevel, getLevel } from '../levels/index.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';

// makeCubies returns a 3D array [x][y][z]; flatten then snapshot each sticker's
// current color so two cube states can be compared for equality.
const solvedKey = (cubies) =>
  JSON.stringify(
    cubies.flat(2).map((c) => ({
      x: c.x, y: c.y, z: c.z,
      stickers: Object.fromEntries(Object.entries(c.stickers).map(([d, s]) => [d, s.curr])),
    }))
  );

describe('createLevel scrambleMoves', () => {
  it('preserves an explicit scrambleMoves override', () => {
    const level = createLevel({ id: 1, scrambleMoves: 3 });
    expect(level.scrambleMoves).toBe(3);
  });

  it('defaults scrambleMoves to null when omitted', () => {
    const level = createLevel({ id: 1 });
    expect(level.scrambleMoves).toBeNull();
  });
});

describe('CUBE campaign levels', () => {
  it('carries each level scrambleMoves through createLevel', () => {
    // Level 1 uses a deterministic scrambleSequence instead of a random count.
    const expected = { 2: 5, 3: 4, 4: 6, 5: 8, 6: 12 };
    for (const level of CUBE_CAMPAIGN_LEVELS) {
      if (level.id === 1) continue;
      expect(level.scrambleMoves).toBe(expected[level.id]);
    }
  });

  it('scrambles level 1 with a single middle-layer turn', () => {
    const level1 = getCubeCampaignLevel(1);
    expect(level1.scrambleMoves).toBeNull();
    expect(level1.scrambleSequence).toEqual([{ axis: 'row', sliceIndex: 1, dir: 1 }]);
  });

  it('gives level 1 its own Mobi briefing lines', () => {
    const level1 = getCubeCampaignLevel(1);
    expect(Array.isArray(level1.tutorial.mobiLines)).toBe(true);
    expect(level1.tutorial.mobiLines.length).toBeGreaterThan(0);
  });

  it("level 1's scramble is unsolved and reversible by one middle-layer turn", () => {
    const level1 = getCubeCampaignLevel(1);
    const size = level1.cubeSize;
    const solved = makeCubies(size);
    let scrambled = makeCubies(size);
    for (const { axis, sliceIndex, dir } of level1.scrambleSequence) {
      scrambled = rotateSliceCubies(scrambled, size, axis, sliceIndex, dir);
    }
    // One middle-layer turn must actually disturb the cube...
    expect(solvedKey(scrambled)).not.toBe(solvedKey(solved));
    // ...and turning that same layer back must solve it again.
    const { axis, sliceIndex, dir } = level1.scrambleSequence[0];
    const fixed = rotateSliceCubies(scrambled, size, axis, sliceIndex, -dir);
    expect(solvedKey(fixed)).toBe(solvedKey(solved));
  });

  it('exposes the campaign through the level manager', () => {
    expect(getLevel(1)).toBe(getCubeCampaignLevel(1));
  });

  it('has a next level for every level except the last', () => {
    const lastId = CUBE_CAMPAIGN_LEVELS[CUBE_CAMPAIGN_LEVELS.length - 1].id;
    for (const level of CUBE_CAMPAIGN_LEVELS) {
      if (level.id === lastId) {
        expect(getNextLevel(level.id)).toBeNull();
      } else {
        expect(getNextLevel(level.id)).not.toBeNull();
      }
    }
  });
});
