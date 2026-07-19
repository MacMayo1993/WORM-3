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
import { buildManifoldGridMap, findAntipodalStickerByGrid, flipStickerPair } from './manifoldLogic.js';

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

// ── Native paired-flip completion (the "antipodal commutator") ───────────────
//
// The game's native colour operator is the paired wormhole flip
// (`flipStickerPair`): it toggles a sticker AND its antipodal partner together
// (curr ↦ α(curr)) and moves no piece. That is exactly a clean single
// *antipodal-pair* flip that changes nothing else — the commutator u·φ·u⁻¹
// collapses to this primitive, because rotations never touch flip parity, so
// conjugation can only reposition which pair is hit, never break antipodal
// symmetry (docs/antipodal-solving.md, Theorem 5).
//
// Consequently the residual parity of any rotation+flip-reachable state is
// β-symmetric: residual tiles come in antipodal pairs, and ONE native flip
// clears each pair — half the operations of heal-based completion, in the
// game's own moves. The only residuals a native flip cannot clear are
// asymmetric ones (one member of a pair dirty, the other clean), which arise
// only from an external single-sticker heal; those fall back to heal.

/**
 * Flip exactly one antipodal pair (the sticker at the given cell and its
 * antipodal partner), leaving every other sticker and all piece positions
 * unchanged. This is the clean single-pair operator; it is its own inverse.
 * @returns {Array} new cubies
 */
export function antipodalPairFlip(cubies, size, x, y, z, dir) {
  const map = buildManifoldGridMap(cubies, size);
  return flipStickerPair(cubies, size, x, y, z, dir, map);
}

/**
 * Phase-2 plan in native paired flips. Groups residual tiles into antipodal
 * pairs and emits one flip per pair; any asymmetric residual (partner already
 * home) falls back to a single heal.
 * @returns {{flips:Array<{x,y,z,dir}>, heals:Array<{x,y,z,dir}>, asymmetric:boolean}}
 */
export function planNativeFlipCompletion(cubies, size) {
  const map = buildManifoldGridMap(cubies, size);
  const visited = new Set();
  const flips = [];
  const heals = [];

  for (const r of flipResiduals(cubies, size)) {
    const key = `${r.x},${r.y},${r.z},${r.dir}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const st = cubies[r.x][r.y][r.z].stickers[r.dir];
    const partner = findAntipodalStickerByGrid(map, st, size);
    const partnerResidual = partner && partner.sticker.curr !== partner.sticker.orig;

    if (partnerResidual) {
      visited.add(`${partner.x},${partner.y},${partner.z},${partner.dirKey}`);
      flips.push({ x: r.x, y: r.y, z: r.z, dir: r.dir }); // one flip clears both
    } else {
      heals.push({ x: r.x, y: r.y, z: r.z, dir: r.dir }); // asymmetric → heal
    }
  }

  return { flips, heals, asymmetric: heals.length > 0 };
}

/**
 * Apply a native-flip completion plan: paired flips first, then any heal
 * fallbacks. Piece positions never change, so the manifold map built once up
 * front stays valid across all flips.
 * @returns {Array} new cubies
 */
export function applyNativeFlipCompletion(cubies, size, plan = planNativeFlipCompletion(cubies, size)) {
  const map = buildManifoldGridMap(cubies, size);
  let next = cubies;
  for (const f of plan.flips) next = flipStickerPair(next, size, f.x, f.y, f.z, f.dir, map);
  for (const h of plan.heals) next = healSticker(next, size, h.x, h.y, h.z, h.dir);
  return next;
}
