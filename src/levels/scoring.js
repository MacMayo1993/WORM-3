/**
 * Golf-style star scoring for Story mode.
 *
 * Every authored chapter is disturbed by a known, reversible `scrambleSequence`
 * (+ optional `flipSequence`), so the length of the intended solution is known
 * exactly. That length is the level's "par": reverse each authored turn (one
 * move) and undo each authored flip (one tap). Players are then scored like golf
 * — matching or beating par is a perfect run, a little over is still good, and
 * simply finishing always earns a star.
 *
 * Levels without a par (random-scramble / freeplay-style) fall back to the older
 * cube-size heuristic on time and moves.
 */

// Par for a level: an explicit override wins, otherwise it is derived from the
// authored disturbance. Returns null when the level has no authored solution to
// measure against (so callers can fall back to the heuristic scoring).
export function getLevelPar(level) {
  if (!level) return null;
  if (level.scoring === 'flips') return level.flipPar;
  if (typeof level.par === 'number') return level.par;
  const turns = level.scrambleSequence?.length || 0;
  const flips = level.flipSequence?.length || 0;
  const total = turns + flips;
  return total > 0 ? total : null;
}

// How many moves over par still earns 2 stars. Scales with par so short puzzles
// (par 1-2) keep a fair window and long ones don't demand pixel-perfect play.
export function parSlack(par) {
  return Math.max(2, Math.ceil(par * 0.5));
}

// A Flip Cube level's star lines in flips: three stars at its target or fewer,
// two up to half again over (at least one), one for any solve.
export function flipStarLines(level) {
  return { three: level.flipPar, two: level.flipPar + Math.max(1, Math.ceil(level.flipPar / 2)) };
}

/**
 * What the next star asks for after a run of `flips` on a flip level:
 * { stars, flips } for the next star up, or null when the run already has three.
 */
export function nextFlipStar(level, flips) {
  const lines = flipStarLines(level);
  if (flips <= lines.three) return null;
  return flips <= lines.two ? { stars: 3, flips: lines.three } : { stars: 2, flips: lines.two };
}

// Star rating (1-3) for a completion. `stats` carries { moves, time }.
export function computeStars(level, stats = {}) {
  if (!level) return 1;
  if (level.scoring === 'flips') {
    if (!Number.isInteger(stats.flips)) return 1;
    const lines = flipStarLines(level);
    if (stats.flips <= lines.three) return 3;
    return stats.flips <= lines.two ? 2 : 1;
  }
  const moves = typeof stats.moves === 'number' && stats.moves > 0 ? stats.moves : null;
  const par = getLevelPar(level);

  // Golf scoring for authored puzzles.
  if (par && moves != null) {
    if (moves <= par) return 3;
    if (moves <= par + parSlack(par)) return 2;
    return 1;
  }

  // Fallback heuristic for levels without a par.
  let stars = 1; // Base star for completion.
  const timeThreshold = level.timeLimit || (level.cubeSize * level.cubeSize * 30);
  if (stats.time && stats.time < timeThreshold) stars++;
  const moveThreshold = level.moveLimit || (level.cubeSize * level.cubeSize * 10);
  if (moves && moves < moveThreshold) stars++;
  return Math.min(stars, 3);
}
