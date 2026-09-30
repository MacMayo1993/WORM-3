// src/worm/healerWorm/economy.js
// Pure gameplay-economy rules for the healer worm: orb deposits at tunnel entry
// (including the Prism Worm's wildcard drain), the traversal count → void-collapse
// classification, heal readiness, and the tail-length ↔ carried-orb conversion.
//
// Everything here is a pure function of its inputs — no store access, no refs —
// so the mode's most intricate rules (the ones that historically needed long
// comments to explain regressions) are directly unit-testable. useWormCrawler
// is the only production consumer; it applies the returned values to its refs
// and the Zustand store.

import { BASE_TAIL_LENGTH, ORB_SEGMENT_GROWTH, HEAL_COST, WORMHOLE_MAX_TRAVERSALS } from './constants.js';
import { ANTIPODAL_COLOR } from '../../utils/constants.js';

/**
 * The face a parity orb credits when it is picked up: its body's colour, which is
 * the antipode of the manifold it sits on (orbColorRoles). An orb on a white tile
 * has a yellow body, so it adds yellow to the reserve and a yellow bead to the worm,
 * and pays into yellow tunnels. 0 (no face) stays 0.
 */
export const orbCreditFace = (tileFace) => ANTIPODAL_COLOR[tileFace] ?? 0;

/**
 * Number of whole orbs currently carried on the worm's body for a given tail
 * length (in visual balls). BASE_TAIL_LENGTH balls are the worm itself; every
 * ORB_SEGMENT_GROWTH balls beyond that is one carried orb.
 */
export const orbsCarried = (tailLength) =>
  Math.max(0, Math.floor((tailLength - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH));

/**
 * Split the body segments a cut removed across the orbs it cost, head-side first,
 * so taking each one back restores exactly what was lost. Orbs past the cut lose
 * their whole ORB_SEGMENT_GROWTH (tip-side first); the first lost orb, the one the
 * cut went through, gets the remainder: only the segments it lost, since its
 * head-side ones are still on the body. Extra tip segments (refraction bonuses)
 * ride with it too, so the split always sums to `total`.
 * @param {number} total segments removed (tail length before − after)
 * @param {number} count orbs lost
 * @returns {number[]} segments per lost orb, head-side first
 */
export function splitRemovedSegments(total, count) {
  const out = new Array(Math.max(0, count)).fill(0);
  let left = Math.max(0, Math.round(total));
  for (let i = out.length - 1; i > 0 && left > 0; i--) {
    out[i] = Math.min(ORB_SEGMENT_GROWTH, left);
    left -= out[i];
  }
  if (out.length) out[0] = left;
  return out;
}

/** A tunnel heals on exit once enough orb segments have been deposited into it. */
export const isHealReady = (deposited) => (deposited ?? 0) >= HEAL_COST;

/**
 * Classify the n-th pass through a tunnel (nextTraversals = previous count + 1):
 *   'safe'     — one of the first maxTraversals passes; nothing happens.
 *   'void-arm' — the pass immediately after the safe ones. The tunnel collapses
 *                when the head reaches its interior midpoint. With the default of 3 safe traversals this is the
 *                documented "void on the 4th" behavior.
 *   'collapse' — any pass beyond that: the tunnel is fully voided and kills on
 *                contact.
 */
export function classifyTraversal(nextTraversals, maxTraversals = WORMHOLE_MAX_TRAVERSALS) {
  if (nextTraversals <= maxTraversals) return 'safe';
  if (nextTraversals === maxTraversals + 1) return 'void-arm';
  return 'collapse';
}

/**
 * Compute the orb deposit made when the worm enters a tunnel.
 *
 * The deposit is capped three ways: by what the inventory can pay, by what the
 * tunnel still needs (HEAL_COST − already deposited), and by the segments
 * physically on the worm's body (it can't deposit orbs it isn't carrying).
 *
 * Non-prism characters pay only with orbs matching the tunnel's entry face.
 * The Prism Worm ("Spectrum" wildcard) pays with ANY face color: availability is
 * the whole inventory, and the deduction drains the matching face first, then
 * spills into the remaining faces.
 *
 * @param {Object} args
 * @param {Object} args.inventory   - faceId → stored orb segments (never mutated)
 * @param {number} args.deposited   - segments already deposited into this tunnel
 * @param {number} args.entryFaceId - face color of the tunnel entry sticker
 * @param {number} args.tailLength  - current tail length in visual balls
 * @param {boolean} args.isPrism    - Prism Worm wildcard payment
 * @returns {null | {
 *   n: number,              // segments deposited this entry (> 0)
 *   nextInventory: Object,  // inventory after deduction (fresh object)
 *   nextTailLength: number, // tail after shrinking (never below BASE_TAIL_LENGTH)
 *   nextDeposited: number,  // tunnel progress after this deposit
 *   orbsLeft: number,       // whole orbs still carried (for wormBodyTiles)
 *   colorsToDrop: number,   // pickup-color entries to trim from the color list
 * }} null when nothing can be deposited.
 */
export function computeOrbDeposit({ inventory, deposited, entryFaceId, tailLength, isPrism }) {
  const inv = inventory ?? {};
  const segmentsOnWorm = tailLength - BASE_TAIL_LENGTH;
  const available = isPrism
    ? Object.values(inv).reduce((sum, v) => sum + (v || 0), 0)
    : (inv[entryFaceId] ?? 0);
  const n = Math.min(available, HEAL_COST - deposited, segmentsOnWorm);
  if (n <= 0) return null;

  let nextInventory;
  if (isPrism) {
    nextInventory = { ...inv };
    let remaining = n;
    const drainOrder = [entryFaceId, ...Object.keys(nextInventory).map(Number).filter(f => f !== entryFaceId)];
    for (const f of drainOrder) {
      if (remaining <= 0) break;
      const have = nextInventory[f] ?? 0;
      const take = Math.min(have, remaining);
      nextInventory[f] = have - take;
      remaining -= take;
    }
  } else {
    nextInventory = { ...inv, [entryFaceId]: (inv[entryFaceId] ?? 0) - n };
  }

  const nextTailLength = Math.max(BASE_TAIL_LENGTH, tailLength - n);
  return {
    n,
    nextInventory,
    nextTailLength,
    nextDeposited: deposited + n,
    orbsLeft: orbsCarried(nextTailLength),
    colorsToDrop: Math.round(n / ORB_SEGMENT_GROWTH),
  };
}
