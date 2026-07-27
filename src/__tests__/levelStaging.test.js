import { describe, it, expect } from 'vitest';
import { buildLevelStartState, hasAuthoredSetup, randomScrambleDepth } from '../levels/levelStaging.js';
import { CUBE_CAMPAIGN_LEVELS, STORY_LEVELS } from '../levels/data/index.js';
import { makeCubies } from '../game/cubeState.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { checkRubiksSolved } from '../game/winDetection.js';

const displaced = (cubies) => {
  let n = 0;
  for (const plane of cubies)
    for (const col of plane)
      for (const cubie of col)
        for (const key in cubie.stickers) {
          const st = cubie.stickers[key];
          if (st.curr !== st.orig) n++;
        }
  return n;
};

// An RNG that fails loudly: any level that touches it was randomised when it
// should have been staged exactly as authored.
const noRandom = () => { throw new Error('random scramble used on an authored level'); };

describe('level staging', () => {
  it('leaves a flip-only level solved apart from its authored flips', () => {
    // Regression: "Through the Cube" (102) authors three flips and no turns.
    // It fell through to the random branch and opened on a 25-move scramble
    // with the flips buried in it, so the level's own instructions ("only the
    // six middle tiles are wrong, tap them back") described a different cube.
    const level = CUBE_CAMPAIGN_LEVELS.find((l) => l.id === 102);
    expect(level.flipSequence).toHaveLength(3);
    expect(level.scrambleSequence ?? null).toBeNull();

    const state = buildLevelStartState(level, level.cubeSize, { random: noRandom, levelNumber: 102 });

    // Three flips move three pairs — six stickers, and nothing else.
    expect(displaced(state)).toBe(6);

    // And the level is solvable exactly as its tutorial says: tap those same
    // three tiles back.
    const map = buildManifoldGridMap(state, level.cubeSize);
    let solved = state;
    for (const { x, y, z, dirKey } of level.flipSequence) {
      solved = flipStickerPair(solved, level.cubeSize, x, y, z, dirKey, map);
    }
    expect(checkRubiksSolved(solved, level.cubeSize)).toBe(true);
  });

  it('stages every authored campaign and story level without touching the RNG', () => {
    const authored = [...CUBE_CAMPAIGN_LEVELS, ...STORY_LEVELS].filter(hasAuthoredSetup);
    expect(authored.length).toBeGreaterThan(0);
    for (const level of authored) {
      expect(
        () => buildLevelStartState(level, level.cubeSize, { random: noRandom, levelNumber: level.id }),
        `level ${level.id} (${level.name})`,
      ).not.toThrow();
    }
  });

  it('stages authored levels identically every time', () => {
    const level = CUBE_CAMPAIGN_LEVELS.find((l) => l.id === 102);
    const a = buildLevelStartState(level, level.cubeSize, { random: noRandom });
    const b = buildLevelStartState(level, level.cubeSize, { random: noRandom });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('still randomises a level that authors nothing', () => {
    // Deterministic stand-in for Math.random (a constant would emit the same
    // turn every time, and four of those cancel back to solved).
    let seed = 1;
    let calls = 0;
    const random = () => {
      calls++;
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const state = buildLevelStartState({ cubeSize: 3, scrambleMoves: 8 }, 3, { random });
    expect(calls).toBe(24); // three draws per turn: axis, slice, direction
    expect(checkRubiksSolved(state, 3)).toBe(false);
  });

  it('honours an explicit "start solved" and scales depth with the level number otherwise', () => {
    expect(randomScrambleDepth({ scrambleMoves: 0 }, 9)).toBe(0);
    expect(randomScrambleDepth({}, 3)).toBe(16);
    expect(randomScrambleDepth({}, 99)).toBe(25); // capped
    expect(randomScrambleDepth(null)).toBe(25);   // freeplay default

    const solved = buildLevelStartState({ scrambleMoves: 0 }, 3, { random: noRandom });
    expect(checkRubiksSolved(solved, 3)).toBe(true);
    expect(JSON.stringify(solved)).toBe(JSON.stringify(makeCubies(3)));
  });

  it('applies authored turns before authored flips', () => {
    const level = {
      cubeSize: 3,
      scrambleSequence: [{ axis: 'row', sliceIndex: 0, dir: 1 }],
      flipSequence: [{ x: 1, y: 1, z: 2, dirKey: 'PZ' }],
    };
    const state = buildLevelStartState(level, 3, { random: noRandom });
    expect(checkRubiksSolved(state, 3)).toBe(false);
    expect(displaced(state)).toBe(2); // exactly the one authored pair
  });

  it('expands numTurns into repeated quarter turns', () => {
    const once = buildLevelStartState(
      { scrambleSequence: [{ axis: 'row', sliceIndex: 0, dir: 1 }] }, 3, { random: noRandom });
    const four = buildLevelStartState(
      { scrambleSequence: [{ axis: 'row', sliceIndex: 0, dir: 1, numTurns: 4 }] }, 3, { random: noRandom });
    expect(checkRubiksSolved(once, 3)).toBe(false);
    expect(checkRubiksSolved(four, 3)).toBe(true); // four quarter turns = identity
  });
});
