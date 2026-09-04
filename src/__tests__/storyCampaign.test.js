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
import { buildLevelStartState } from '../levels/levelStaging.js';
import { checkRubiksSolved } from '../game/winDetection.js';

describe('Topological Descent story campaign', () => {
  it('uses the analytically generated descent as Story mode', () => {
    expect(STORY_LEVELS).toBe(STORY_DESCENT_LEVELS);
    expect(STORY_LEVELS).toHaveLength(12);
    expect(getStoryLevelIds()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(STORY_LEVELS[0].name).toBe('First Reflection');
    expect(STORY_LEVELS.at(-1).name).toBe('Singularity');
    expect(STORY_LEVELS.at(-1).hasCutscene).toBe(true);
    // The descent ramps by cube size first, then by par within each size.
    // Par is no longer globally monotonic: proving it optimal costs ~17x per
    // move, so the 4x4 chapters top out lower than the 3x3 ones and lean on
    // board size for their difficulty instead (see data/story-descent.js).
    const sizes = STORY_LEVELS.map((l) => l.cubeSize);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    for (const size of new Set(sizes)) {
      const pars = STORY_LEVELS.filter((l) => l.cubeSize === size).map((l) => l.par);
      expect(pars, `${size}x${size} pars are not non-decreasing`).toEqual([...pars].sort((a, b) => a - b));
    }
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

  it('stages every chapter with turns AND flips, and never randomly', () => {
    // The campaign's premise: a tile can be wrong because it MOVED or because it
    // FLIPPED, and both repairs are needed. A chapter missing either kind of
    // staging cannot teach the distinction. That neither move type alone can
    // solve these boards — and that par is the proven optimum — is re-derived
    // per chapter in storyDescent.test.js.
    for (const level of STORY_LEVELS) {
      expect(level.scrambleSequence.length, `chapter ${level.id} has no turns`).toBeGreaterThan(0);
      expect(level.flipSequence.length, `chapter ${level.id} has no flips`).toBeGreaterThan(0);
      // Authored setup must never be topped up with a random scramble, which
      // would make the pinned par meaningless.
      expect(level.scrambleMoves).toBe(0);
      expect(level.tutorial.objective).not.toHaveLength(0);

      const staged = buildLevelStartState(level, level.cubeSize);
      expect(checkRubiksSolved(staged, level.cubeSize), `chapter ${level.id} opens solved`).toBe(false);
      // Par is a real cost: at least one move, and never more than the staging
      // it was built from.
      expect(level.par).toBeGreaterThan(0);
      expect(level.par).toBeLessThanOrEqual(level.scrambleSequence.length + level.flipSequence.length);
    }
  })
});
