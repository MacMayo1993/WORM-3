// Authored chapter one. Cosmetic IDs are shared with the existing Parity Store.
export const WORM_STORY_LEVELS = [
  { id: 1, title: 'First Crawl', subtitle: 'The whole cube is your route.',
    goal: 'Collect 18 orbs, including all six colors, before time runs out.',
    kind: 'orbs', target: 18, colors: 6, speed: 2, par: 50, limit: 90, points: 25 },
  { id: 2, title: 'Through the Looking Glass', subtitle: 'A long tail. Four different ways through.',
    goal: 'Traverse four different tunnel pairs with your long body. The marker points to an unvisited pair. Clear your tail to finish.',
    kind: 'tunnel', target: 4, speed: 2.2, par: 70, limit: 120, points: 25 },
  { id: 3, title: 'Clear Your Tail', subtitle: 'Lay your path. Cross it. Keep moving.',
    goal: 'Land four jumps over your own body and collect 12 orbs. Empty jumps do not count.',
    kind: 'jump', target: 4, orbs: 12, speed: 2.35, par: 75, limit: 130,
    reward: ['hat_party', 'hat_tophat'], rewardLabel: 'Choose a hat', fallback: 100 },
  { id: 4, title: 'Moving Ground', subtitle: 'The route will not stay still.',
    goal: 'Collect 18 orbs and survive six layer turns. Turns keep coming until you finish.',
    kind: 'rotation', target: 6, orbs: 18, speed: 2.5, rotateEvery: 10, par: 95, limit: 150, points: 25 },
  { id: 5, title: 'Color Collector', subtitle: 'Plan your colors while the cube shifts.',
    goal: 'Collect all six colors and heal four tunnel pairs while layers turn. Clear your tail to finish.',
    kind: 'collector', target: 4, colors: 6, speed: 2.75, rotateEvery: 10, par: 120, limit: 190,
    reward: ['scheme_forest', 'scheme_tropical'], rewardLabel: 'Choose a palette', fallback: 100 },
  { id: 6, title: 'Restore the Cube', subtitle: 'Bring every skill. Leave no tunnel open.',
    goal: 'Heal six tunnel pairs, collect 30 orbs and survive six turns. Clear your tail before the clock runs out.',
    kind: 'restore', target: 6, orbs: 30, rotations: 6, speed: 3, rotateEvery: 8, par: 160, limit: 250,
    reward: ['skin_royal', 'skin_ocean'], rewardLabel: 'Choose a skin', fallback: 150 },
  { id: 7, title: 'Full Throttle', subtitle: 'Own the air. Control the landing.',
    goal: 'Finish two boosts, land two double jumps and a rocket flight, attract four remote orbs with a magnet, collect 24 orbs and heal two pairs.',
    kind: 'mastery', target: 2, orbs: 24, speed: 3, rotateEvery: 9, par: 170, limit: 280,
    mechanics: { boosts: 2, doubleJumps: 2, rockets: 1, magnetOrbs: 4 },
    reward: ['trail_comet', 'trail_circuit'], rewardLabel: 'Choose a trail', fallback: 200 },
  { id: 8, title: 'Force of Nature', subtitle: 'Five elements. Five different ways to move.',
    goal: 'Master water, fire, grass, ice and lightning. Collect 24 orbs and heal three pairs while layers turn. Follow the marked power and its instruction.',
    kind: 'mastery', target: 3, orbs: 24, speed: 3, rotateEvery: 9, par: 220, limit: 350,
    mechanics: { elements: 5 },
    reward: ['scheme_aurora', 'scheme_cosmic'], rewardLabel: 'Choose a palette', fallback: 150 },
  { id: 9, title: 'Under Siege', subtitle: 'Fight. Encircle. Turn danger into a route.',
    goal: 'Surround a tunnel to heal it, use your character signature twice, disarm two bombs by encircling them, defeat four enemies, collect 24 orbs and restore four pairs. Tunnel deposits seal after the ring and signature goals.',
    kind: 'mastery', target: 4, orbs: 24, speed: 3, rotateEvery: 10, par: 240, limit: 380,
    mechanics: { ringHeals: 1, signatures: 2, bombs: 2, kills: 4 },
    reward: ['hat_crown', 'hat_wizard'], rewardLabel: 'Choose a hat', fallback: 150 },
  { id: 10, title: 'Worm Ascendant', subtitle: 'Everything you learned. One restless cube.',
    goal: 'Master all five elements, boost twice, land two double jumps and a rocket flight, attract four remote orbs, surround a tunnel, use two signatures, disarm two bombs and defeat six enemies. Collect 36 orbs, survive eight turns and restore all six pairs. Ring and signature goals unlock tunnel sealing.',
    kind: 'mastery', target: 6, orbs: 36, rotations: 8, speed: 3.2, rotateEvery: 8, par: 360, limit: 540,
    mechanics: { ringHeals: 1, signatures: 2, boosts: 2, doubleJumps: 2, rockets: 1, magnetOrbs: 4, elements: 5, bombs: 2, kills: 6 },
    reward: ['skin_gold', 'skin_galaxy'], rewardLabel: 'Choose a champion skin', fallback: 300 },
];
export const STORY_MECHANIC_LABELS = { boosts: 'boosts finished', doubleJumps: 'double jumps landed', rockets: 'rocket landings',
  magnetOrbs: 'remote magnet catches', elements: 'elements mastered', ringHeals: 'ring heals', signatures: 'signatures used', bombs: 'bombs disarmed', kills: 'enemies defeated' };
// A repeating authored cycle spans all axes and includes central layers. Retain
// the normal warning and collision transaction; never steer hazards at the head.
export const storyRotationCycle = size => [
  { axis: 'col', sliceIndex: 0, dir: 1 },
  { axis: 'row', sliceIndex: Math.floor(size / 2), dir: -1 },
  { axis: 'depth', sliceIndex: size - 1, dir: 1 },
  { axis: 'col', sliceIndex: Math.floor(size / 2), dir: -1 },
  { axis: 'row', sliceIndex: size - 1, dir: 1 },
  { axis: 'depth', sliceIndex: 0, dir: -1 },
];
export const storyLevel = id => WORM_STORY_LEVELS.find(level => level.id === id) ?? null;
export const storyStars = (progress, id) => progress?.wormStory?.stars?.[id] || 0;
export const storyUnlocked = (progress, id) => !!storyLevel(id) && (id === 1 || storyStars(progress, id - 1) > 0);
export const nextStoryLevel = progress => WORM_STORY_LEVELS.find(level => !storyStars(progress, level.id)) ?? WORM_STORY_LEVELS.at(-1);
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
  if (!level || !metrics.alive || !Number.isFinite(metrics.elapsed) || metrics.elapsed <= 0 || metrics.elapsed > level.limit) return null;
  if ((metrics.orbs ?? 0) < (level.orbs ?? 0) || (metrics.colors ?? 0) < (level.colors ?? 0) ||
      (metrics.rotations ?? 0) < (level.rotations ?? 0)) return null;
  if (Object.entries(level.mechanics ?? {}).some(([key, target]) => (metrics[key] ?? 0) < target)) return null;
  if (level.mechanics && !metrics.landed) return null;
  const complete = level.kind === 'orbs' ? metrics.orbs >= level.target
    : level.kind === 'tunnel' ? metrics.uniqueTunnels >= level.target && metrics.tailClear
    : level.kind === 'jump' ? metrics.bodyJumps >= level.target && metrics.landed
    : level.kind === 'rotation' ? metrics.rotations >= level.target && metrics.rotationSettled
    : metrics.healed >= level.target && metrics.remaining === 0 && metrics.tailClear && metrics.rotationSettled;
  if (!complete) return null;
  return { stars: 1 + Number(metrics.elapsed <= level.par) + Number(metrics.cuts === 0), seconds: Math.ceil(metrics.elapsed) };
}

export function storyProgressText(level, metrics) {
  const count = (n, target, label) => `${Math.min(n || 0, target)}/${target} ${label}`;
  if (level.mechanics) {
    const goals = [...Object.entries(level.mechanics), ['healed', level.target], ['orbs', level.orbs], ...(level.rotations ? [['rotations', level.rotations]] : [])];
    const missing = goals.filter(([key, target]) => (metrics[key] ?? 0) < target);
    const next = missing[0];
    return `${goals.length - missing.length}/${goals.length} goals · ${next ? count(metrics[next[0]], next[1], STORY_MECHANIC_LABELS[next[0]] ?? { healed: 'pairs healed', orbs: 'orbs', rotations: 'turns' }[next[0]]) : 'Clear your tail and land'}${metrics.powerHint ? ` · ${metrics.powerHint}` : ''} · ${Math.max(0, Math.ceil(level.limit - metrics.elapsed))}s left`;
  }
  const parts = [count(level.kind === 'orbs' ? metrics.orbs : level.kind === 'tunnel' ? metrics.uniqueTunnels
    : level.kind === 'jump' ? metrics.bodyJumps : level.kind === 'rotation' ? metrics.rotations : metrics.healed,
  level.target, { orbs: 'orbs', tunnel: 'pairs crossed', jump: 'body jumps', rotation: 'turns', collector: 'pairs healed', restore: 'pairs healed' }[level.kind])];
  if (level.orbs) parts.push(count(metrics.orbs, level.orbs, 'orbs'));
  if (level.colors) parts.push(count(metrics.colors, level.colors, 'colors'));
  if (level.rotations) parts.push(count(metrics.rotations, level.rotations, 'turns'));
  if (!metrics.tailClear && ['tunnel', 'collector', 'restore'].includes(level.kind)) parts.push('Tail in transit');
  parts.push(`${Math.max(0, Math.ceil(level.limit - metrics.elapsed))}s left`);
  return parts.join(' · ');
}
