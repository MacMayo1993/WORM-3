import { BASE_TAIL_LENGTH, ORB_SEGMENT_GROWTH } from '../healerWorm/constants.js';

// Peak physical length survives healing deposits; lifetime pickups alone cannot
// satisfy this goal. Pocket cubes get a smaller, board-appropriate target.
export function storyGrowthTarget(level) {
  const size = level.cubeSize ?? 5;
  const pickups = Math.min(Math.max(4, Math.floor(size * size / 2)), 12 + 2 * Math.floor((level.id - 1) / 10));
  return level.starLength ?? BASE_TAIL_LENGTH + ORB_SEGMENT_GROWTH * pickups;
}

export function storyStarGoals(level, metrics = {}) {
  const fast = Number.isFinite(metrics.elapsed) && metrics.elapsed <= level.par;
  const clean = metrics.cuts === 0;
  const peakLength = Math.floor(metrics.peakLength ?? 0);
  const target = storyGrowthTarget(level);
  const grown = peakLength >= target;
  return {
    fast, clean, grown, peakLength, target,
    // Preserve the old two-star alternatives; all three bonuses are needed
    // for the top rating. Every tier still requires all level tasks.
    stars: fast && clean && grown ? 3 : fast || clean ? 2 : 1,
  };
}

export function storyStarRules(level) {
  const target = storyGrowthTarget(level);
  return [
      `Complete all tasks within ${level.limit}s.`,
      `Complete all tasks, plus finish within ${level.par}s OR avoid all tail cuts.`,
      `Complete all tasks within ${level.par}s, no tail cuts, AND reach ${target} body segments.`,
  ];
}

// Allow a food hunt after the tasks are done, while a third star is attainable.
// At par expiry (or after a cut), finish normally instead of forcing a wait.
export function shouldFinishStory(level, metrics, outcome) {
  return !!outcome && (outcome.stars === 3 || metrics.cuts > 0 || metrics.elapsed >= level.par);
}
