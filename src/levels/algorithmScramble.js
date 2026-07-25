// algorithmScramble.js — author an algorithm level from its notation.
//
// An algorithm level is a cube disturbed by exactly the INVERSE of a famous
// algorithm, so performing that algorithm solves it. That gives three things
// for free:
//
//   • the level is authored by writing one notation string
//   • par (getLevelPar counts scramble entries) equals the algorithm's
//     quarter-turn count — the metric speedcubers already think in
//   • the level is checkable: scramble, then apply the algorithm, assert solved
//
// Entries are emitted one quarter turn each rather than carrying numTurns,
// because par is a count of entries: a `U2` left as a single numTurns:2 entry
// would score par 1 for a move that costs the player two.

import { namedMoveToRotation } from '../game/handsInput.js';

/** Invert a single notation token: R → R', R' → R, R2 → R2. */
export function invertToken(token) {
  if (token.endsWith('2')) return token;      // a double is its own inverse
  if (token.endsWith("'")) return token.slice(0, -1);
  return `${token}'`;
}

/**
 * Invert a whole algorithm: reverse the order and invert each move.
 * (A B C)⁻¹ = C⁻¹ B⁻¹ A⁻¹.
 */
export function invertAlgorithm(notation) {
  return notation.trim().split(/\s+/).filter(Boolean).map(invertToken).reverse().join(' ');
}

/**
 * Expand a notation string into single-quarter-turn rotation entries.
 * Unknown tokens throw rather than silently vanishing — a typo in an authored
 * algorithm would otherwise produce a level whose par is quietly wrong and
 * whose intended solution no longer solves it.
 */
export function notationToQuarterTurns(notation, size = 3) {
  const out = [];
  for (const token of notation.trim().split(/\s+/).filter(Boolean)) {
    const isDouble = token.endsWith('2');
    const base = isDouble ? token.slice(0, -1) : token;
    const rot = namedMoveToRotation(base, size);
    if (!rot) throw new Error(`algorithmScramble: unsupported move "${token}"`);
    const entry = { axis: rot.axis, sliceIndex: rot.sliceIndex, dir: rot.dir };
    out.push(entry);
    if (isDouble) out.push({ ...entry });
  }
  return out;
}

/**
 * The scrambleSequence for a level whose intended solution is `notation`.
 * @param {string} notation e.g. "R U R' U'"
 * @param {number} size cube size (all shipped algorithm levels are 3×3)
 */
export function algorithmToScramble(notation, size = 3) {
  return notationToQuarterTurns(invertAlgorithm(notation), size);
}

/** Quarter-turn count of an algorithm — equals the level's par. */
export function quarterTurnCount(notation) {
  return notation.trim().split(/\s+/).filter(Boolean)
    .reduce((n, t) => n + (t.endsWith('2') ? 2 : 1), 0);
}
