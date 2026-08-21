// antipodalEngine.js — the antipodal-pairs (central-quotient) engine.
//
// Implements the fibre algebra of the WORM-3 monograph ("The WORM-3 Antipodal
// Flip Cube", rev 4, §6–§9, §13) on top of the existing Phase-1/Phase-2 solve:
//
//   · The 27 β-pairs (for a 3×3; (size³−(size−2)³)·3 pairs in general): each
//     sticker identity is paired with the opposite-home-colour identity at the
//     same manifold grid cell (findAntipodalStickerByGrid). A native wormhole
//     flip toggles exactly one β-pair and moves no piece.
//   · The residual f: a sticker is "dirty" when curr ≠ orig. Per β-pair the
//     residual is clean (0,0), symmetric dirty (1,1), or asymmetric (1,0).
//   · The ∆ invariant (Theorem 3): ∆(f)[pair] = dirtyA XOR dirtyB. Face turns
//     and paired flips both preserve ∆, so wt(∆) — the number of asymmetric
//     pairs — is exactly the minimum number of heals ever needed.
//   · The global colour flip γ (Lemma 5): the product of all paired flips,
//     the all-one residual. γ is central, and quotienting by {1, γ} gives the
//     solved orbit {(e, 0), (e, 1)} — strict-solved OR fully-flipped-solved
//     (the latter is checkWormVictory's colour condition).
//   · The quotient planner (Theorem 4): after wt(∆) mandatory heals, reaching
//     the solved orbit costs min(k, P−k) paired flips, where k is the number
//     of dirty pairs and P the total — flip the dirty pairs toward the zero
//     residual, or the clean pairs toward the all-one residual, whichever is
//     fewer. Worst case on the in-play sector: 13 flips (P=27).
//
// Everything here is pure and position-preserving: no function moves a piece,
// so a manifold grid map built once stays valid across an entire plan.

import { FLIP_CAP } from '../utils/constants.js';
import { healSticker } from './cubeState.js';
import { buildManifoldGridMap, findAntipodalStickerByGrid, flipStickerPair } from './manifoldLogic.js';

const EXTERIOR = (x, y, z, size) =>
  x === 0 || x === size - 1 || y === 0 || y === size - 1 || z === 0 || z === size - 1;

/**
 * Enumerate every β-pair with its residual classification.
 *
 * @returns {Array<{
 *   a: {x,y,z,dir}, b: {x,y,z,dir}|null,
 *   dirtyA: boolean, dirtyB: boolean,
 *   kind: 'clean'|'dirty'|'asymmetric',
 *   flippable: boolean,   // both members below FLIP_CAP → a native flip works
 * }>}
 */
export function enumerateBetaPairs(cubies, size, map = buildManifoldGridMap(cubies, size)) {
  const pairs = [];
  const visited = new Set();

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        if (!EXTERIOR(x, y, z, size)) continue;
        const stickers = cubies[x][y][z].stickers;
        for (const dir in stickers) {
          const key = `${x},${y},${z},${dir}`;
          if (visited.has(key)) continue;
          visited.add(key);

          const st = stickers[dir];
          const partner = findAntipodalStickerByGrid(map, st, size);
          if (partner) visited.add(`${partner.x},${partner.y},${partner.z},${partner.dirKey}`);

          const dirtyA = st.curr !== st.orig;
          const dirtyB = !!partner && partner.sticker.curr !== partner.sticker.orig;
          pairs.push({
            a: { x, y, z, dir },
            b: partner ? { x: partner.x, y: partner.y, z: partner.z, dir: partner.dirKey } : null,
            dirtyA,
            dirtyB,
            kind: dirtyA === dirtyB ? (dirtyA ? 'dirty' : 'clean') : 'asymmetric',
            flippable: (st.flips ?? 0) < FLIP_CAP && !!partner && (partner.sticker.flips ?? 0) < FLIP_CAP,
          });
        }
      }
    }
  }
  return pairs;
}

/**
 * The complete fibre invariant ∆ (Theorem 3): the set of asymmetric β-pairs.
 * Invariant under every face turn and every paired flip; wt(∆) is exactly the
 * minimum number of heals needed before the fibre becomes flip-clearable.
 * ∆ = 0 throughout ordinary play (flips are always paired).
 */
export function deltaInvariant(cubies, size) {
  const support = enumerateBetaPairs(cubies, size).filter((p) => p.kind === 'asymmetric');
  return { weight: support.length, support };
}

/**
 * The global colour flip γ (Lemma 5): flip every β-pair once, sending the
 * residual f to f + 1. Central in the native move group and an involution
 * (up to FLIP_CAP-dead tiles, which no flip can touch). On the strict solved
 * state it produces the fully-flipped solved state — the other member of the
 * canonical solved orbit, and the colour half of the Worm victory condition.
 */
export function globalColorFlip(cubies, size) {
  const map = buildManifoldGridMap(cubies, size);
  let next = cubies;
  for (const p of enumerateBetaPairs(cubies, size, map)) {
    next = flipStickerPair(next, size, p.a.x, p.a.y, p.a.z, p.a.dir, map);
  }
  return next;
}

/**
 * Exact non-positional cost accounting (Theorem 7): with a = asymmetric pairs
 * and b = symmetric dirty pairs out of P total,
 *   strict target (e,0):        a heals + b flips        → a + b
 *   quotient orbit {(e,0),(e,1)}: a heals + min(b, P−b)   → a + min(b, P−b)
 */
export function fibreCosts(cubies, size) {
  const pairs = enumerateBetaPairs(cubies, size);
  const totalPairs = pairs.length;
  const asymmetricPairs = pairs.filter((p) => p.kind === 'asymmetric').length;
  const dirtyPairs = pairs.filter((p) => p.kind === 'dirty').length;
  return {
    totalPairs,
    asymmetricPairs,
    dirtyPairs,
    strictCost: asymmetricPairs + dirtyPairs,
    quotientCost: asymmetricPairs + Math.min(dirtyPairs, totalPairs - dirtyPairs),
  };
}

/**
 * True iff the fibre residual lies in the solved orbit {0, 1}: every sticker
 * home (strict) or every sticker showing its antipode (global flip). Combined
 * with a position check this is the central-quotient win condition.
 */
export function isFibreInSolvedOrbit(cubies, size) {
  const pairs = enumerateBetaPairs(cubies, size);
  return pairs.every((p) => p.kind === 'clean') || pairs.every((p) => p.kind === 'dirty');
}

/**
 * Quotient completion plan (Theorem 4). Heals the dirty member of every
 * asymmetric pair (the mandatory wt(∆) heals), then flips toward whichever
 * quotient representative is closer:
 *   target 0 — flip the k dirty pairs (k flips),
 *   target 1 — flip the P−k clean pairs (P−k flips, including pairs just
 *              healed clean).
 * FLIP_CAP-dead tiles cannot be flipped, so a dead dirty pair falls back to
 * two heals under target 0, and target 1 is only chosen when every pair it
 * must flip is flippable.
 *
 * Repair model — this is the CANONICAL model, and it is optimal for WORM's
 * operations. `healSticker` restores only (dirty→clean); there is no one-sided
 * "flip toward antipode", and the paired flip preserves ∆ so it cannot fix an
 * asymmetric pair. So an asymmetric pair can only heal to (0,0), giving q with
 * k = (dirty pairs), and completion is min(k, P−k) flips — optimal here. A
 * strictly cheaper wt(∆) + min(n_clean, n_dirty) exists only under a FREE repair
 * model (a one-sided op that can drive an asymmetric pair to (1,1) in one step),
 * which WORM deliberately does not expose; adding it would be a gameplay change,
 * not a planner fix. See docs/antipodal-identification-engine.md §7.4.
 *
 * @returns {{ target: 0|1, heals: Array<{x,y,z,dir}>, flips: Array<{x,y,z,dir}>,
 *             healCost: number, flipCost: number, totalCost: number }}
 */
export function planQuotientCompletion(cubies, size) {
  const pairs = enumerateBetaPairs(cubies, size);
  const P = pairs.length;

  const asymmetric = pairs.filter((p) => p.kind === 'asymmetric');
  const dirty = pairs.filter((p) => p.kind === 'dirty');
  const k = dirty.length;

  // Mandatory heals: the dirty member of each asymmetric pair.
  const heals = asymmetric.map((p) => (p.dirtyA ? p.a : p.b));

  // Pairs each representative would flip (post-heal, asymmetric pairs are clean).
  const towardZero = dirty;
  const towardOne = pairs.filter((p) => p.kind !== 'dirty');
  const oneFeasible = towardOne.every((p) => p.flippable);

  const target = oneFeasible && P - k < k ? 1 : 0;

  const flips = [];
  if (target === 1) {
    for (const p of towardOne) flips.push(p.a);
  } else {
    for (const p of towardZero) {
      if (p.flippable) flips.push(p.a);
      else heals.push(p.a, p.b); // dead pair: native flip impossible, heal both
    }
  }

  return {
    target,
    heals,
    flips,
    healCost: heals.length,
    flipCost: flips.length,
    totalCost: heals.length + flips.length,
  };
}

/**
 * Apply a quotient completion plan: heals first (restoring ∆ = 0), then the
 * paired flips. Positions never change, so one grid map serves every flip.
 * @returns {Array} new cubies whose fibre lies in the solved orbit
 */
export function applyQuotientCompletion(cubies, size, plan = planQuotientCompletion(cubies, size)) {
  let next = cubies;
  for (const h of plan.heals) next = healSticker(next, size, h.x, h.y, h.z, h.dir);
  const map = buildManifoldGridMap(next, size);
  for (const f of plan.flips) next = flipStickerPair(next, size, f.x, f.y, f.z, f.dir, map);
  return next;
}
