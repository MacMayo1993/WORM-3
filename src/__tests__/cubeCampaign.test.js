import { describe, it, expect } from 'vitest';
import { createLevel } from '../levels/schema.js';
import { CUBE_CAMPAIGN_LEVELS, getCubeCampaignLevel } from '../levels/data/cube-campaign.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';

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
    // Lesson 1 uses a deterministic scrambleSequence and lesson 2 a flipSequence,
    // so neither carries a random scrambleMoves count. Indexed by position, not
    // by id, so the pack can be renumbered into its own id range without this
    // pinning the old numbers.
    const expectedByIndex = [null, null, 4, 6, 8, 12];
    CUBE_CAMPAIGN_LEVELS.forEach((level, i) => {
      expect(level.scrambleMoves).toBe(expectedByIndex[i]);
    });
  });

  it('level 2 flips all six centers to their antipodal and is solved by flipping them back', () => {
    const level2 = getCubeCampaignLevel(CUBE_CAMPAIGN_LEVELS[1].id);
    const size = level2.cubeSize;
    expect(level2.features.flips).toBe(true);
    expect(level2.scrambleMoves).toBeNull();
    expect(level2.flipSequence).toHaveLength(3);

    const solved = makeCubies(size);
    const map = buildManifoldGridMap(solved, size);

    // Apply the setup flips.
    let state = solved;
    for (const { x, y, z, dirKey } of level2.flipSequence) {
      state = flipStickerPair(state, size, x, y, z, dirKey, map);
    }

    // Exactly the six face centers must now show a non-original (antipodal) color.
    const CENTERS = [
      { x: 1, y: 1, z: 2, d: 'PZ' }, { x: 1, y: 1, z: 0, d: 'NZ' },
      { x: 2, y: 1, z: 1, d: 'PX' }, { x: 0, y: 1, z: 1, d: 'NX' },
      { x: 1, y: 2, z: 1, d: 'PY' }, { x: 1, y: 0, z: 1, d: 'NY' },
    ];
    for (const c of CENTERS) {
      const st = state[c.x][c.y][c.z].stickers[c.d];
      expect(st.curr).not.toBe(st.orig); // flipped
    }
    expect(solvedKey(state)).not.toBe(solvedKey(solved));

    // Flipping the same three centers again restores the solved cube.
    for (const { x, y, z, dirKey } of level2.flipSequence) {
      state = flipStickerPair(state, size, x, y, z, dirKey, map);
    }
    expect(solvedKey(state)).toBe(solvedKey(solved));
  });

  it('scrambles level 1 with a single middle-layer turn', () => {
    const level1 = getCubeCampaignLevel(CUBE_CAMPAIGN_LEVELS[0].id);
    expect(level1.scrambleMoves).toBeNull();
    expect(level1.scrambleSequence).toEqual([{ axis: 'row', sliceIndex: 1, dir: 1 }]);
  });

  it('gives level 1 its own Mobi briefing lines', () => {
    const level1 = getCubeCampaignLevel(CUBE_CAMPAIGN_LEVELS[0].id);
    expect(Array.isArray(level1.tutorial.mobiLines)).toBe(true);
    expect(level1.tutorial.mobiLines.length).toBeGreaterThan(0);
  });

  it("level 1's scramble is unsolved and reversible by one middle-layer turn", () => {
    const level1 = getCubeCampaignLevel(CUBE_CAMPAIGN_LEVELS[0].id);
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

  it('chains every cube lesson to its predecessor (story ordering lives with the level manager)', () => {
    // Cube Academy is a standalone practice pack, so its progression is defined
    // by each level's own `previousLevel` link rather than the level manager's
    // story getNextLevel (which walks the separate Life Journey campaign).
    CUBE_CAMPAIGN_LEVELS.forEach((level, index) => {
      const expectedPrev = index === 0 ? null : CUBE_CAMPAIGN_LEVELS[index - 1].id;
      expect(level.requirements.previousLevel).toBe(expectedPrev);
    });
  });
});
