// antipodalSolver.js — Phase 2 of the WORM Antipodal Solve (WAS) method.
//
// Phase 1 (position solve) lives in the Kociemba pipeline: cubiesToKociembaString
// with { ignoreFlips: true } reads each sticker by its flip-invariant identity
// (orig), so standard Kociemba returns rotations that send every piece home.
// After Phase 1 the cube is QUOTIENT-solved (every face uniform up to antipodal
// identification), but tiles with odd wormhole-flip parity still *show* their
// antipode, so it is not yet STRICT-solved.
//
// Phase 2, implemented here, clears that residual flip parity. A wormhole flip
// toggles a sticker between its home colour (orig) and its antipode
// (ANTIPODAL_COLOR[orig]) and never moves a piece, so a sticker is "residual"
// exactly when curr !== orig. Healing each residual sticker (a single-sticker
// involution that restores curr = orig) drives the cube to the strict solved
// state. Because heal acts on one sticker at a time it can clear ANY residual
// pattern — unlike the paired wormhole flip, which always toggles a sticker and
// its antipodal partner together and so can only realise antipodally-symmetric
// residual patterns. See docs/antipodal-solving.md, Theorem 3.

import { healSticker } from './cubeState.js';

const EXTERIOR = (x, y, z, size) =>
  x === 0 || x === size - 1 || y === 0 || y === size - 1 || z === 0 || z === size - 1;

/**
 * List every exterior sticker whose painted colour differs from its home
 * identity — i.e. it is showing its antipode (odd flip parity).
 * @returns {Array<{x,y,z,dir,orig,curr,flips}>}
 */
export function flipResiduals(cubies, size) {
  const out = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        if (!EXTERIOR(x, y, z, size)) continue;
        const stickers = cubies[x][y][z].stickers;
        for (const dir in stickers) {
          const st = stickers[dir];
          if (st.curr !== st.orig) {
            out.push({ x, y, z, dir, orig: st.orig, curr: st.curr, flips: st.flips ?? 0 });
          }
        }
      }
    }
  }
  return out;
}

/**
 * Phase-2 plan: the heal operations that clear all residual flip parity.
 * Each op restores one sticker to its home colour. Applied to a position-solved
 * cube, the plan yields the strict solved state (Theorem 3).
 * @returns {Array<{x,y,z,dir,op:'heal'}>}
 */
export function planStrictCompletion(cubies, size) {
  return flipResiduals(cubies, size).map(({ x, y, z, dir }) => ({ x, y, z, dir, op: 'heal' }));
}

/**
 * Fold a completion plan over the cube, returning new cubies with every
 * targeted sticker healed (curr = orig, flips = 0).
 */
export function applyStrictCompletion(cubies, size, plan = planStrictCompletion(cubies, size)) {
  return plan.reduce((acc, { x, y, z, dir }) => healSticker(acc, size, x, y, z, dir), cubies);
}

/**
 * Total residual flip-parity weight — the number of tiles still showing their
 * antipode. Zero iff the cube is strict-solvable by rotations alone from here.
 */
export function residualWeight(cubies, size) {
  return flipResiduals(cubies, size).length;
}
