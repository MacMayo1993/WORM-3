// src/worm/healerWorm/runStart.js
//
// How the next WORM run starts. A retry (Try again, or Retry on a Story result)
// asks for the quick start, because the player has just watched the full show and
// wants back in:
//   • free play commits its scramble in one go instead of turn by turn
//     (commitShuffleNow), holding the scrambling phase two frames so the run's
//     warm-up still compiles;
//   • a Story level skips its ready card (the briefing was read at launch);
//   • the portal arrival runs on the short clock with only GO
//     (STORY_ARRIVAL_QUICK_SECONDS).
// A first run, a new game and every launch from a menu keep the full show.
//
// A plain bridge rather than store state: three renderers (the phase driver in
// HealerWormMode, StoryArrival and the chase camera) read it inside frame loops.
export const runStart = { requested: false, quick: false };

/** Ask for the quick start on the next run (call before initWormMode). */
export function requestQuickStart() { runStart.requested = true; }

/** Adopt, and clear, a pending request as a run is set up. */
export function beginRun() {
  runStart.quick = runStart.requested;
  runStart.requested = false;
  return runStart.quick;
}
