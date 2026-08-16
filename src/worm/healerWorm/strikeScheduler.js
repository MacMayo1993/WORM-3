// src/worm/healerWorm/strikeScheduler.js
//
// When the lightning theme strikes the worm, and where.
//
// The staging is "the worm is a lightning rod": while a lightning wash is up, bolts
// arc out of the charged cube and hit the body. It is entirely presentation — no
// damage, no stun, no score, no speed change, no heal, no input interruption, and
// nothing written back to the simulation. If a later design task wants lightning to
// DO something, that is a separate change; this module must stay incapable of it,
// which is why it is pure and takes no sim handle at all.
//
// Everything the effect needs to be fair is decided here rather than in the
// renderer:
//
//   • it never fires while the player is not in control — countdown, pause, tunnel
//     transit, death, victory, or the elemental claim freeze
//   • it never fires under reduced motion
//   • it never fires at a body point the camera cannot see, so a strike is never
//     "heard" without being seen
//   • a minimum gap between strikes, and never twice running on the same point
//
// Randomness is a seeded LCG, never Math.random: strikes must be reproducible for
// tests and must not perturb replay or network determinism.

/** Shortest and longest wait between strikes, in seconds. */
export const STRIKE_MIN_GAP = 0.85;
export const STRIKE_MAX_GAP = 2.3;
/** Wait before re-checking when the schedule fires but nothing is strikeable. */
export const STRIKE_RETRY_GAP = 0.25;

// Numerical Recipes' LCG constants — small, fast, and good enough for picking a
// body segment. Kept inline so this module has no dependencies at all.
const LCG_A = 1664525;
const LCG_C = 1013904223;
const LCG_M = 4294967296;

/**
 * @param {number} [seed]
 * @returns {{t:number, seed:number, lastTarget:number, seq:number}}
 */
export function makeStrikeState(seed = 1) {
  return {
    // Time until the next attempt. Starts at a full gap so a claim does not fire a
    // bolt on its very first frame, before the player has seen the cube charge.
    t: STRIKE_MAX_GAP,
    seed: seed >>> 0,
    lastTarget: -1,
    seq: 0
  };
}

/** Next draw in [0, 1), advancing the state's own generator. */
function nextRand(state) {
  state.seed = (Math.imul(state.seed, LCG_A) + LCG_C) >>> 0;
  return state.seed / LCG_M;
}

/**
 * Advance the schedule by `dt` and decide whether a strike happens this frame.
 *
 * @param {object} state    from makeStrikeState, mutated in place
 * @param {number} dt       seconds since the last tick
 * @param {object} ctx
 * @param {boolean} ctx.enabled     false for every gate: not lightning, paused, in a
 *                                  tunnel, mid-claim-freeze, dead, reduced motion…
 * @param {number}  ctx.targetCount how many body points exist right now
 * @param {(i:number)=>boolean} [ctx.visible] is this body point on camera?
 * @returns {{targetIndex:number, seed:number, id:number}|null}
 */
export function tickStrikes(state, dt, { enabled = false, targetCount = 0, visible = null } = {}) {
  if (!enabled || targetCount <= 0) {
    // Hold the timer rather than resetting it. Resetting would make every pause and
    // every tunnel exit restart the full wait, so on a board with frequent transits
    // the strikes would never land; freezing means the schedule resumes exactly
    // where the interruption caught it, the same way every other worm clock does.
    return null;
  }

  state.t -= dt;
  if (state.t > 0) return null;

  // Collect the points actually worth hitting. Building this per attempt rather
  // than per frame keeps the cost off the frame budget — attempts are ~1/second.
  const candidates = [];
  for (let i = 0; i < targetCount; i++) {
    if (i === state.lastTarget) continue; // never twice running on the same point
    if (visible && !visible(i)) continue; // never strike what the camera cannot see
    candidates.push(i);
  }

  if (candidates.length === 0) {
    // The worm is off-camera or too short to offer a second point. Re-check soon
    // instead of burning a whole gap, so the effect resumes promptly once it swings
    // back into view.
    state.t = STRIKE_RETRY_GAP;
    return null;
  }

  const targetIndex = candidates[Math.min(candidates.length - 1, Math.floor(nextRand(state) * candidates.length))];
  state.lastTarget = targetIndex;
  state.t = STRIKE_MIN_GAP + (STRIKE_MAX_GAP - STRIKE_MIN_GAP) * nextRand(state);
  state.seq++;

  return {
    targetIndex,
    // The bolt's own shape seed. Derived from the generator, so a given scheduler
    // seed replays the identical sequence of bolts.
    seed: Math.floor(nextRand(state) * 100000),
    id: state.seq
  };
}
