import { describe, expect, it } from 'vitest';
import {
  CUBE_CAMPAIGN_LEVELS,
  STORY_LEVELS,
  LIFE_JOURNEY_LEVELS,
  STORY_DESCENT_LEVELS,
  getStoryLevelIds,
} from '../levels/data/index.js';
import { getLevel, getNextLevel, levelsManager } from '../levels/index.js';
import { getPack, getPackIds } from '../levels/packs/index.js';
import { makeCubies } from '../game/cubeState.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { checkRubiksSolved } from '../game/winDetection.js';
import { fibreCosts } from '../game/antipodalEngine.js';

describe('Topological Descent story campaign', () => {
  it('uses the analytically generated descent as Story mode', () => {
    expect(STORY_LEVELS).toBe(STORY_DESCENT_LEVELS);
    expect(STORY_LEVELS).toHaveLength(12);
    expect(getStoryLevelIds()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(STORY_LEVELS[0].name).toBe('First Reflection');
    expect(STORY_LEVELS.at(-1).name).toBe('Singularity');
    expect(STORY_LEVELS.at(-1).hasCutscene).toBe(true);
    // Par climbs monotonically through the descent.
    const pars = STORY_LEVELS.map((l) => l.par);
    expect(pars).toEqual([...pars].sort((a, b) => a - b));
  });

  it('registers the full story sequence with the level manager', () => {
    expect(levelsManager.getTotalLevels()).toBe(STORY_LEVELS.length);
    expect(getLevel(1)).toBe(STORY_LEVELS[0]);
    expect(getNextLevel(11)).toBe(STORY_LEVELS[11]);
    expect(getNextLevel(12)).toBeNull();
  });

  it('keeps the authored Life Journey arc intact but unlisted', () => {
    // Nothing was deleted: the ten Daycare→Black Hole chapters still exist.
    expect(LIFE_JOURNEY_LEVELS).toHaveLength(10);
    expect(LIFE_JOURNEY_LEVELS[0].name).toBe('Baby Cube');
    expect(LIFE_JOURNEY_LEVELS.at(-1).name).toBe('Black Hole');
    // But it is no longer the active Story campaign.
    expect(STORY_LEVELS).not.toBe(LIFE_JOURNEY_LEVELS);
  });

  it('keeps the six lesson sequence available as the separate Cube Academy pack', () => {
    expect(getPackIds()).toEqual(expect.arrayContaining(['story-campaign', 'cube-academy']));
    expect(getPack('cube-academy').levels).toBe(CUBE_CAMPAIGN_LEVELS);
    expect(getPack('cube-academy').levels).toHaveLength(6);
  });

  it('gives every story chapter a reproducible flip-solve state whose fibre par is exact', () => {
    for (const level of STORY_LEVELS) {
      // Descent chapters author flips, not scrambles, and never fall back to random.
      expect(level.scrambleMoves).toBe(0);
      expect(level.scrambleSequence).toBeNull();
      expect(level.flipSequence.length).toBeGreaterThan(0);
      expect(level.tutorial.objective).not.toHaveLength(0);

      let state = makeCubies(level.cubeSize);
      const map = buildManifoldGridMap(state, level.cubeSize);
      for (const flip of level.flipSequence) {
        state = flipStickerPair(state, level.cubeSize, flip.x, flip.y, flip.z, flip.dirKey, map);
      }
      // The staged state is unsolved, symmetric (n_A = 0), and its exact repair
      // cost equals the authored par.
      expect(checkRubiksSolved(state, level.cubeSize)).toBe(false);
      const fc = fibreCosts(state, level.cubeSize);
      expect(fc.asymmetricPairs).toBe(0);
      expect(fc.strictCost).toBe(level.par);

      // Reversible: undoing each flip restores the solved cube.
      for (const flip of [...level.flipSequence].reverse()) {
        state = flipStickerPair(state, level.cubeSize, flip.x, flip.y, flip.z, flip.dirKey, map);
      }
      expect(checkRubiksSolved(state, level.cubeSize)).toBe(true);
    }
  });
});
