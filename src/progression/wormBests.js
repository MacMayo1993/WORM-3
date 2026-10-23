// src/progression/wormBests.js
//
// Personal bests for WORM, kept in playerProgress.bests (positive integers under
// bounded keys, which sanitizeProgress already accepts and caps).
//
//   Free play, per board size, higher is better: orbs collected, pairs healed,
//   the longest orb chain, and whole seconds survived.
//   Story, per level, lower is better: the fastest clear, in whole seconds.
//
// A first record is not reported as beaten: the first run on a size sets the bar,
// it does not clear one. Combat arenas, the demo and Story runs never write free
// play's records.

export const FREE_BEST_METRICS = ['orbs', 'heals', 'chain', 'time'];
export const freeBestKey = (size, metric) => `worm:free:${size}:${metric}`;
export const storyTimeKey = id => `worm:story:${id}:time`;

const whole = value => (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);

/**
 * Fold one finished free-play run into the bests.
 * @returns {{ bests: object, beaten: string[], previous: object }} beaten names the
 * metrics this run raised above an earlier record; previous holds those records.
 */
export function recordFreeBests(bests, size, run) {
  const next = { ...bests };
  const beaten = [], previous = {};
  for (const metric of FREE_BEST_METRICS) {
    const value = whole(run[metric]), key = freeBestKey(size, metric), prior = whole(bests?.[key]);
    if (value <= prior) continue;
    next[key] = value;
    if (prior > 0) { beaten.push(metric); previous[metric] = prior; }
  }
  return { bests: next, beaten, previous };
}

/** Fold one Story clear's time in; previous is null on a level's first clear. */
export function recordStoryTime(bests, id, seconds) {
  const key = storyTimeKey(id), prior = whole(bests?.[key]), value = whole(seconds);
  if (!value) return { bests, previous: prior || null, improved: false };
  return { bests: !prior || value < prior ? { ...bests, [key]: value } : bests, previous: prior || null, improved: prior > 0 && value < prior };
}
