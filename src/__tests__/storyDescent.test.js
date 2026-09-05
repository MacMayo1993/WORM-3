import { describe, it, expect } from 'vitest';
import { STORY_DESCENT_LEVELS, getStoryDescentLevel, getStoryDescentLevelIds } from '../levels/data/story-descent.js';
import { buildMoveTable, analyseMoveMix, solveLine } from '../levels/parSolver.js';
import { buildLevelStartState } from '../levels/levelStaging.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { checkRubiksWin } from '../game/winDetection.js';
import { WIN_CONDITIONS } from '../levels/schema.js';

const boardFor = (level) => buildLevelStartState(level, level.cubeSize);

describe('the Topological Descent campaign', () => {
  it('runs 12 chapters in an unbroken unlock chain', () => {
    expect(getStoryDescentLevelIds()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    STORY_DESCENT_LEVELS.forEach((level, i) => {
      expect(level.requirements.previousLevel).toBe(i === 0 ? null : level.id - 1);
      expect(getStoryDescentLevel(level.id)).toBe(level);
    });
  });

  it('stages every chapter with BOTH turns and flips', () => {
    for (const level of STORY_DESCENT_LEVELS) {
      expect(level.scrambleSequence.length, `chapter ${level.id} has no turns`).toBeGreaterThan(0);
      expect(level.flipSequence.length, `chapter ${level.id} has no flips`).toBeGreaterThan(0);
      // A random scramble on top of authored setup would destroy the pinned par.
      expect(level.scrambleMoves).toBe(0);
      expect(level.features.rotations).toBe(true);
      expect(level.features.flips).toBe(true);
      expect(level.winCondition).toBe(WIN_CONDITIONS.CLASSIC);
    }
  });

  it('opens every chapter genuinely disturbed', () => {
    for (const level of STORY_DESCENT_LEVELS) {
      expect(checkRubiksWin(boardFor(level), level.cubeSize), `chapter ${level.id} opens solved`).toBe(false);
    }
  });

  it('ramps difficulty without ever going backwards within a cube size', () => {
    const bySize = new Map();
    for (const level of STORY_DESCENT_LEVELS) {
      const seen = bySize.get(level.cubeSize) ?? [];
      seen.push(level.par);
      bySize.set(level.cubeSize, seen);
    }
    for (const [size, pars] of bySize) {
      const sorted = [...pars].sort((a, b) => a - b);
      expect(pars, `${size}x${size} chapters are not in non-decreasing par order`).toEqual(sorted);
    }
    // Cube size never shrinks as the campaign goes on.
    const sizes = STORY_DESCENT_LEVELS.map((l) => l.cubeSize);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
  });
});

describe('every chapter needs turns AND flips', () => {
  // The point of the campaign, and the thing a pinned board can silently lose.
  // Re-derived from the staged board rather than trusted: `par` in the data file
  // is a claim, and this is the proof.
  for (const level of STORY_DESCENT_LEVELS) {
    it(`chapter ${level.id} (${level.name}) — par ${level.par} is optimal, and neither move type alone reaches it`, () => {
      const size = level.cubeSize;
      const table = buildMoveTable(size);
      const board = boardFor(level);
      const staged = level.scrambleSequence.length + level.flipSequence.length;

      const mix = analyseMoveMix(board, size, { maxMoves: staged, table });
      expect(mix.par, `pinned par disagrees with the solver`).toBe(level.par);
      expect(mix.turnsMandatory, `flips alone solve this in ${mix.flipOnly}`).toBe(true);
      expect(mix.flipsMandatory, `turns alone solve this in ${mix.turnOnly}`).toBe(true);
    });
  }
});

describe('every chapter is actually winnable in par', () => {
  for (const level of STORY_DESCENT_LEVELS) {
    it(`chapter ${level.id} (${level.name}) solves in exactly ${level.par}`, () => {
      const size = level.cubeSize;
      const table = buildMoveTable(size);
      let state = boardFor(level);
      const line = solveLine(state, size, { maxMoves: level.par, table });
      expect(line, 'no solution within par').not.toBeNull();
      expect(line.cost).toBe(level.par);
      expect(line.turns.length + line.flips.length).toBe(level.par);

      const wonAfter = [];
      for (const m of line.turns) {
        state = rotateSliceCubies(state, size, m.axis, m.sliceIndex, m.dir);
        wonAfter.push(checkRubiksWin(state, size));
      }
      for (const a of line.flips) {
        state = flipStickerPair(state, size, a.x, a.y, a.z, a.dirKey, buildManifoldGridMap(state, size));
        wonAfter.push(checkRubiksWin(state, size));
      }
      // Solved at the last move and not before, or par overstates the cost.
      expect(wonAfter.indexOf(true) + 1).toBe(level.par);
    });
  }
});
