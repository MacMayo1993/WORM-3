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

// Star rating (1-3) for a completion. `stats` carries { moves, time }.
export function computeStars(level, stats = {}) {
  if (!level) return 1;
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
