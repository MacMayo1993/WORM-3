// levelStaging.js — builds the cube a level opens on.
//
// A level can stage its board three ways, and the order below is what keeps
// them from fighting each other:
//
//   1. `scrambleSequence` — hand-authored turns. The level knows exactly what
//      it wants out of place.
//   2. `flipSequence` — hand-authored antipodal flips, applied on top.
//   3. neither — a random scramble, depth from `scrambleMoves` or the level
//      number.
//
// The rule that matters: a level that authored ANY of its setup never gets the
// random scramble as well. A flip-teaching level ("three middle tiles are the
// wrong colour — tap them back") was being handed 25 random turns first,
// because it authored flips but no turns and so fell through to the random
// branch. Its three flips were still applied, but on top of a fully scrambled
// cube, which is not the puzzle the level describes.

import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';

const AXES = ['row', 'col', 'depth'];

/**
 * How many random turns a level gets when it authors no setup of its own.
 * `scrambleMoves: 0` is honoured (an explicit "start solved"); only a missing
 * value falls back to scaling with the level number.
 */
export function randomScrambleDepth(level, levelNumber = 0) {
  if (!level) return 25;
  return level.scrambleMoves ?? Math.min(25, 10 + levelNumber * 2);
}

/**
 * Whether a level lays out its own board. Such levels are staged exactly as
 * authored — never randomised on top.
 */
export function hasAuthoredSetup(level) {
  return !!(level?.scrambleSequence?.length || level?.flipSequence?.length);
}

/**
 * The cubie state a level starts from.
 *
 * @param {object|null} level        level data (null = freeplay defaults)
 * @param {number} size              cube size
 * @param {object} [opts]
 * @param {() => number} [opts.random]      RNG, injectable for tests
 * @param {number} [opts.levelNumber]       level id, scales the random depth
 */
export function buildLevelStartState(level, size, { random = Math.random, levelNumber = 0 } = {}) {
  let state = makeCubies(size);

  const scrambleSequence = level?.scrambleSequence;
  const flipSequence = level?.flipSequence;

  if (scrambleSequence?.length) {
    // Authored turns. numTurns is honoured for completeness, though authored
    // data emits one entry per quarter turn: getLevelPar counts entries, so a
    // numTurns:2 kept as one entry would score par 1 for a two-move fix.
    for (const { axis, sliceIndex, dir, numTurns } of scrambleSequence) {
      for (let t = 0; t < (numTurns ?? 1); t++) {
        state = rotateSliceCubies(state, size, axis, sliceIndex, dir);
      }
    }
  } else if (!hasAuthoredSetup(level)) {
    const count = randomScrambleDepth(level, levelNumber);
    for (let i = 0; i < count; i++) {
      const axis = AXES[Math.floor(random() * 3)];
      const slice = Math.floor(random() * size);
      const dir = random() > 0.5 ? 1 : -1;
      state = rotateSliceCubies(state, size, axis, slice, dir);
    }
  }

  // Authored antipodal flips. flipStickerPair moves the partner too, so one
  // entry per pair is enough. Flips don't relocate stickers, so a single
  // manifold map built here stays valid for the whole sequence.
  if (flipSequence?.length) {
    const flipMap = buildManifoldGridMap(state, size);
    for (const { x, y, z, dirKey } of flipSequence) {
      state = flipStickerPair(state, size, x, y, z, dirKey, flipMap);
    }
  }

  return state;
}
