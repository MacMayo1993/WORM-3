import { segmentsToTiles } from '../healerWorm/tileUnits.js';
import { BASE_TAIL_LENGTH, ORB_SEGMENT_GROWTH } from '../healerWorm/constants.js';

// Peak physical length survives healing deposits; lifetime pickups alone cannot
// satisfy this goal. Pocket cubes get a smaller, board-appropriate target.
// Extra growth scales with the board: 2/3/4 pickups on pocket decks, 8 elsewhere.
export const STAR_GROWTH_BEYOND_TASK = 8 * ORB_SEGMENT_GROWTH;
export function storyGrowthTarget(level) {
  const size = level.cubeSize ?? 5;
  const pickups = Math.min(Math.max(4, Math.floor(size * size / 2)), 12 + 2 * Math.floor((level.id - 1) / 10));
  const required = level.mechanics?.bodyLength;
  return level.starLength ?? Math.max(BASE_TAIL_LENGTH + ORB_SEGMENT_GROWTH * pickups, required ? required + (size <= 4 ? size * ORB_SEGMENT_GROWTH : STAR_GROWTH_BEYOND_TASK) : 0);
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

/**
 * What the next star needs, from a clear's own star goals: the clear card's one
 * line of advice. Null at three stars.
 */
export function nextStarHint(level, stars, goals = {}) {
  if (stars >= 3) return null;
  if (stars <= 1) return `finish within ${level.par}s or avoid tail cuts`;
  const missing = [];
  if (!goals.fast) missing.push(`finish within ${level.par}s`);
  if (!goals.clean) missing.push('no tail cuts');
  if (!goals.grown) missing.push(`reach ${segmentsToTiles(storyGrowthTarget(level))} tiles`);
  return missing.join(', ') || null;
}

export function storyStarRules(level) {
  const target = storyGrowthTarget(level);
  return [
      `Complete all tasks within ${level.limit}s.`,
      `Complete all tasks, plus finish within ${level.par}s OR avoid all tail cuts.`,
      `Complete all tasks within ${level.par}s, no tail cuts, AND reach ${segmentsToTiles(target)} tiles long.`,
  ];
}

// Allow a food hunt after the tasks are done, while a third star is attainable.
// At par expiry (or after a cut), finish normally instead of forcing a wait.
export function shouldFinishStory(level, metrics, outcome) {
  return !!outcome && (outcome.stars === 3 || metrics.cuts > 0 || metrics.elapsed >= level.par);
}
