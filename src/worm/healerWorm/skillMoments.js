// src/worm/healerWorm/skillMoments.js
//
// Moments of skill the run calls out: a jump that carries the head over its own
// body and lands it alive, a dive while the body still rides an earlier tunnel
// (a self-pass), a double heal, and a jump that carries the head over a turning
// layer's moving seam (sliceCrossing.js). The sim reports the last three (ctx.onSkill);
// the hop is tracked here from the same rule Story's body-jump goal uses
// (bodyJumpPractice.js), on a tracker of its own so Story's count is untouched.
// Each reaches the HUD as wormSkillCallout and plays the 'clutch' sting.
// A rescue jump the game paused for is not a skill moment.
import { trackPracticeBodyJump } from './bodyJumpPractice.js';

export const SKILL_CALLOUTS = {
  hop: 'Body hop!',
  pass: 'Self-pass!',
  double: 'Double heal!',
  seam: 'Seam jump!',
};

export const makeHopTracker = () => ({ airborne: false, crossedThisJump: false, bodyJumps: 0, assisted: false });

/** Advance the tracker one tick; true on the tick a body hop lands. */
export function trackBodyHop(sim, tracker, size) {
  if (sim.isJumping && sim.assistedJump) tracker.assisted = true;
  const before = tracker.bodyJumps;
  trackPracticeBodyJump(sim, tracker, size);
  if (sim.isJumping) return false;
  const assisted = tracker.assisted;
  tracker.assisted = false;
  return tracker.bodyJumps > before && !assisted;
}
