import { describe, expect, it } from 'vitest';
import {
  CUBE_CAMPAIGN_LEVELS,
  STORY_LEVELS,
  getStoryLevelIds,
} from '../levels/data/index.js';
import { getLevel, getNextLevel, levelsManager } from '../levels/index.js';
import { getPack, getPackIds } from '../levels/packs/index.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { checkRubiksSolved } from '../game/winDetection.js';

describe('Life Journey story campaign', () => {
  it('uses the authored Daycare-to-Singularity chapters as Story mode', () => {
    expect(STORY_LEVELS).toHaveLength(10);
    expect(getStoryLevelIds()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(STORY_LEVELS[0].name).toBe('Baby Cube');
    expect(STORY_LEVELS.at(-1).name).toBe('Black Hole');
    expect(STORY_LEVELS.at(-1).hasCutscene).toBe(true);
  });

  it('registers the full story sequence with the level manager', () => {
    expect(levelsManager.getTotalLevels()).toBe(STORY_LEVELS.length);
    expect(getLevel(1)).toBe(STORY_LEVELS[0]);
    expect(getNextLevel(9)).toBe(STORY_LEVELS[9]);
    expect(getNextLevel(10)).toBeNull();
  });

  it('keeps the six lesson sequence available as the separate Cube Academy pack', () => {
    expect(getPackIds()).toEqual(expect.arrayContaining(['story-campaign', 'cube-academy']));
    expect(getPack('cube-academy').levels).toBe(CUBE_CAMPAIGN_LEVELS);
    expect(getPack('cube-academy').levels).toHaveLength(6);
  });

  it('gives every story chapter a reproducible, reversible authored puzzle state', () => {
    for (const level of STORY_LEVELS) {
      expect(level.scrambleMoves).toBeNull();
      expect(level.scrambleSequence?.length).toBeGreaterThan(0);
      expect(level.tutorial.objective).not.toHaveLength(0);
      expect(level.tutorial.mobiLines?.length).toBeGreaterThanOrEqual(3);

      let state = makeCubies(level.cubeSize);
      for (const move of level.scrambleSequence) {
        state = rotateSliceCubies(state, level.cubeSize, move.axis, move.sliceIndex, move.dir);
      }

      const map = buildManifoldGridMap(state, level.cubeSize);
      for (const flip of level.flipSequence || []) {
        state = flipStickerPair(state, level.cubeSize, flip.x, flip.y, flip.z, flip.dirKey, map);
      }
      expect(checkRubiksSolved(state, level.cubeSize)).toBe(false);

      for (const flip of [...(level.flipSequence || [])].reverse()) {
        state = flipStickerPair(state, level.cubeSize, flip.x, flip.y, flip.z, flip.dirKey, map);
      }
      for (const move of [...level.scrambleSequence].reverse()) {
        state = rotateSliceCubies(state, level.cubeSize, move.axis, move.sliceIndex, -move.dir);
      }
      expect(checkRubiksSolved(state, level.cubeSize)).toBe(true);
    }
  });
});
