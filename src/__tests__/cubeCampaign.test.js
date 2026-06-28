import { describe, it, expect } from 'vitest';
import { createLevel } from '../levels/schema.js';
import { CUBE_CAMPAIGN_LEVELS, getCubeCampaignLevel } from '../levels/data/cube-campaign.js';
import { getNextLevel, getLevel } from '../levels/index.js';
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
    // Level 1 uses a deterministic scrambleSequence and level 2 a flipSequence,
    // so neither carries a random scrambleMoves count.
    const expected = { 3: 4, 4: 6, 5: 8, 6: 12 };
    for (const level of CUBE_CAMPAIGN_LEVELS) {
      if (level.id === 1 || level.id === 2) continue;
      expect(level.scrambleMoves).toBe(expected[level.id]);
    }
  });

  it('level 2 flips all six centers to their antipodal and is solved by flipping them back', () => {
    const level2 = getCubeCampaignLevel(2);
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
