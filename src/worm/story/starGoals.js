// Stars count fresh ordinary orb pickups, just like the level checklist. Spending
// body energy, losing tail, or bonus growth never changes this run-total tally.
export function storyOrbTarget(level) {
  const size = level.cubeSize ?? 5;
  const baseline = Math.min(Math.max(4, Math.floor(size * size / 2)), 12 + 2 * Math.floor((level.id - 1) / 10));
  return Math.max(level.starOrbs ?? baseline, level.orbs ?? 0, level.kind === 'orbs' ? level.target : 0);
}

export function storyStarGoals(level, metrics = {}) {
  const fast = Number.isFinite(metrics.elapsed) && metrics.elapsed <= level.par;
  const clean = metrics.cuts === 0;
  const orbs = Math.max(0, Math.floor(metrics.orbs ?? 0));
  const target = storyOrbTarget(level);
  const collected = orbs >= target;
  return {
    fast, clean, collected, orbs, target,
    // Preserve the two-star alternatives; every tier still needs all level tasks.
    stars: fast && clean && collected ? 3 : fast || clean ? 2 : 1,
  };
}

/** Advice for the next star, based on the completed run's own requirements. */
export function nextStarHint(level, stars, goals = {}) {
  if (stars >= 3) return null;
  if (stars <= 1) return `finish within ${level.par}s or avoid tail cuts`;
  const missing = [];
  if (!goals.fast) missing.push(`finish within ${level.par}s`);
  if (!goals.clean) missing.push('no tail cuts');
  if (!goals.collected) missing.push(`collect ${storyOrbTarget(level)} total orbs`);
  return missing.join(', ') || null;
}

export function storyStarRules(level) {
  return [
      `Complete all tasks within ${level.limit}s.`,
      `Complete all tasks, plus finish within ${level.par}s OR avoid all tail cuts.`,
      `Complete all tasks within ${level.par}s, no tail cuts, AND collect ${storyOrbTarget(level)} total orbs.`,
  ];
}

// Keep the optional orb hunt while three stars are still attainable. At par
// expiry (or after a cut), finish normally instead of forcing a wait.
export function shouldFinishStory(level, metrics, outcome) {
  return !!outcome && (outcome.stars === 3 || metrics.cuts > 0 || metrics.elapsed >= level.par);
}
