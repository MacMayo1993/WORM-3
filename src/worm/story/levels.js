// Authored chapter one. Cosmetic IDs are shared with the existing Parity Store.
export const WORM_STORY_LEVELS = [
  { id: 1, title: 'First Crawl', subtitle: 'Every journey starts with a little appetite.', goal: 'Collect the four orbs ahead.', kind: 'orbs', target: 4, par: 20, points: 25 },
  { id: 2, title: 'Through the Looking Glass', subtitle: 'The other side is closer than you think.', goal: 'Enter the marked tunnel and let your tail clear the exit.', kind: 'tunnel', target: 1, par: 35, points: 25 },
  { id: 3, title: 'Clear Your Tail', subtitle: 'Your old path is your next obstacle.', goal: 'Jump over your body two tiles ahead, then land safely.', kind: 'jump', target: 1, par: 20, reward: ['hat_party', 'hat_tophat'], rewardLabel: 'Choose a hat', fallback: 100 },
  { id: 4, title: 'Moving Ground', subtitle: 'Watch the warning. Find your footing.', goal: 'Stay alive through one warned layer turn.', kind: 'rotation', target: 1, par: 25, points: 25 },
  { id: 5, title: 'Color Collector', subtitle: 'A useful color opens the way home.', goal: 'Collect the two orbs ahead. Find the marked tunnel on the opposite face and enter to heal it.', kind: 'collector', target: 1, par: 45, reward: ['scheme_forest', 'scheme_tropical'], rewardLabel: 'Choose a palette', fallback: 100 },
  { id: 6, title: 'Restore the Cube', subtitle: 'Three open paths. One whole world.', goal: 'Find and heal all three tunnel pairs. Matching orbs are near their exits.', kind: 'restore', target: 3, par: 180, reward: ['skin_royal', 'skin_ocean'], rewardLabel: 'Choose a skin', fallback: 150 },
];
export const storyLevel = id => WORM_STORY_LEVELS.find(level => level.id === id) ?? null;
export const storyStars = (progress, id) => progress?.wormStory?.stars?.[id] || 0;
export const storyUnlocked = (progress, id) => !!storyLevel(id) && (id === 1 || storyStars(progress, id - 1) > 0);
export const nextStoryLevel = progress => WORM_STORY_LEVELS.find(level => !storyStars(progress, level.id)) ?? WORM_STORY_LEVELS[5];
export function sanitizeStoryProgress(raw) {
  const result = { stars: {}, claimed: {} };
  for (const level of WORM_STORY_LEVELS) {
    const stars = raw?.stars?.[level.id];
    // Invalid/gapped progress cannot unlock later chapters or reward claims.
    if (!Number.isInteger(stars) || stars < 1 || stars > 3 || (level.id > 1 && !result.stars[level.id - 1])) break;
    result.stars[level.id] = stars;
    const claim = raw?.claimed?.[level.id];
    if (level.reward && (claim === 'points' || level.reward.includes(claim))) result.claimed[level.id] = claim;
  }
  return result;
}
export function storyOutcome(level, metrics) {
  if (!level || !metrics.alive || !Number.isFinite(metrics.elapsed) || metrics.elapsed <= 0) return null;
  const complete = level.kind === 'orbs' ? metrics.orbs >= level.target
    : level.kind === 'tunnel' ? metrics.tunnels >= 1 && metrics.tailClear
    : level.kind === 'jump' ? metrics.crossedBody && metrics.landed
    : level.kind === 'rotation' ? metrics.rotations >= 1 && metrics.rotationSettled
    : level.kind === 'collector' ? metrics.orbs >= 2 && metrics.healed >= 1 && metrics.tailClear
    : metrics.healed >= 3 && metrics.remaining === 0 && metrics.tailClear;
  if (!complete) return null;
  return { stars: 1 + Number(metrics.elapsed <= level.par) + Number(metrics.cuts === 0), seconds: Math.ceil(metrics.elapsed) };
}
