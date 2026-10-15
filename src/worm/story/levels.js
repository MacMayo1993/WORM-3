import { storyStarGoals } from './starGoals.js';
import { STORY_LEVEL_DATA, STORY_CHAPTER_DATA } from './campaign.js';
import { storyGoalText, TAIL_KINDS } from './goalText.js';
import { STORY_ELEMENTS, storyElementNames, storyElementsRandom } from './elementGoals.js';

// Every level is authored in campaign.js; the mission sentence is derived from
// its targets so the map, pause card and checklist never disagree.
export const WORM_STORY_LEVELS = STORY_LEVEL_DATA.map(level => ({ ...level, goal: storyGoalText(level) }));
// Ten levels to a chapter. Unlocks stay linear across chapter boundaries: the
// first level of a chapter opens when the last level of the one before is cleared.
export const STORY_CHAPTER_SIZE = 10;
export const WORM_STORY_CHAPTERS = STORY_CHAPTER_DATA
  .map(chapter => ({ ...chapter, levels: WORM_STORY_LEVELS.filter(level => storyChapterId(level.id) === chapter.id) }));
export function storyChapterId(id) { return Math.ceil(id / STORY_CHAPTER_SIZE); }
export const storyChapter = id => WORM_STORY_CHAPTERS.find(chapter => chapter.id === storyChapterId(id)) ?? null;
// Position within the chapter, 1-10.
export const storyChapterIndex = id => ((id - 1) % STORY_CHAPTER_SIZE) + 1;
export const isChapterFinale = id => storyChapterIndex(id) === STORY_CHAPTER_SIZE || id === WORM_STORY_LEVELS.at(-1).id;
// Everything a launch needs from a level, so every entry point starts it the
// same way (the 15×15 board also needs Mega's lighter effects tier).
export const storyLaunchSettings = level => ({ storyLevel: level.id, cubeSize: level.cubeSize ?? 5, megaMode: (level.cubeSize ?? 5) >= 15,
  wormSpeed: level.speed, wormOrbCount: 1, wormholeInterval: 30, wormCombatMode: false, wormEnemiesEnabled: false });
export const STORY_MECHANIC_LABELS = { steamFusions: 'Steam fusions (Fire → Water)', quenchFusions: 'Quench fusions (Water → Fire)', boosts: 'boosts finished', doubleJumps: 'double jumps landed', rockets: 'rocket landings',
  magnetOrbs: 'remote magnet catches', explodes: 'explosions ridden out', elements: 'elements mastered', uniqueElements: 'different elements collected', elementPickups: 'elemental orbs collected', ringHeals: 'ring heals', signatures: 'signatures used', bombs: 'bombs disarmed', kills: 'enemies defeated',
  bodyLength: 'body segments', bodyJumps: 'body jumps', selfPasses: 'passes through the Core', multiHeals: 'double heals', fusions: 'fusions', uniqueFusions: 'different fusions' };
// Short nouns for the plain progress line, keyed like the checklist.
const PROGRESS_NOUNS = { ...STORY_MECHANIC_LABELS, orbs: 'orbs', colors: 'colors', rotations: 'turns', uniqueTunnels: 'pairs crossed', healed: 'pairs healed' };
// A repeating authored cycle spans all axes and includes central layers. Retain
// the normal warning and collision transaction; never steer hazards at the head.
export const storyDoubleLayerEvery = (level, size = level?.cubeSize ?? 5) =>
  size > 7 && level?.rotateEvery && [1, 2, 3].includes(level.doubleLayerEvery) ? level.doubleLayerEvery : 0;
export function storyRotationCycle(size, level = null) {
  const cycle = [
    { axis: 'col', sliceIndex: 0, dir: 1 },
    { axis: 'row', sliceIndex: Math.floor(size / 2), dir: -1 },
    { axis: 'depth', sliceIndex: size - 1, dir: 1 },
    { axis: 'col', sliceIndex: Math.floor(size / 2), dir: -1 },
    { axis: 'row', sliceIndex: size - 1, dir: 1 },
    { axis: 'depth', sliceIndex: 0, dir: -1 },
  ];
  const every = storyDoubleLayerEvery(level, size);
  if (!every) return cycle;
  // Reuse Mega's two separated, counter-rotating planes. The other outer
  // layer leaves stationary space between both bands, including on 8×8.
  return cycle.map((move, index) => (index + 1) % every ? move : {
    ...move,
    sliceIndices: [move.sliceIndex, move.sliceIndex < size / 2 ? size - 1 : 0],
    sliceDirs: [move.dir, -move.dir],
  });
}
export function storyRotationDescription(level) {
  if (!level.rotateEvery) return '';
  const every = storyDoubleLayerEvery(level);
  const pattern = every === 1 ? 'two layers each turn' : every === 2 ? 'two layers every other turn' : 'two layers every third turn';
  return `Turns every ${level.rotateEvery}s${every ? ` · ${pattern}` : ''}`;
}
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
    // Mastery levels ask for a fixed number of heals. Already-earned task credit
    // must not gain extra requirements from retained tail routes or new tunnels.
    : level.kind === 'mastery' ? metrics.healed >= level.target && metrics.rotationSettled && metrics.healSettled !== false
    : metrics.healed >= level.target && metrics.remaining === 0 && metrics.tailClear && metrics.rotationSettled;
  if (!complete) return null;
  const goals = storyStarGoals(level, metrics);
  return { stars: goals.stars, seconds: Math.ceil(metrics.elapsed), peakLength: goals.peakLength,
    finalLength: metrics.currentLength,
    starGoals: { fast: goals.fast, clean: goals.clean, grown: goals.grown } };
}

// Explain the actual physical transition, rather than calling every completion
// delay a tail-clearance problem. Called only after the checklist is complete.
export function storyFinishHint(level, metrics) {
  const needsTail = TAIL_KINDS.includes(level.kind);
  if (metrics.onSurface === false && (needsTail || level.mechanics)) return 'Return to the surface to finish';
  if ((level.mechanics || level.kind === 'jump') && !metrics.landed) return 'Land to finish';
  if (metrics.healSettled === false && (needsTail || level.mechanics)) return 'Let the healing animation finish';
  if (needsTail && !metrics.tailClear) return 'Your tail is still leaving a tunnel';
  if (['rotation', 'collector', 'restore', 'mastery'].includes(level.kind) && !metrics.rotationSettled) return 'Wait for the layer turn to finish';
  if (['collector', 'restore'].includes(level.kind) && metrics.remaining > 0) return `Heal ${metrics.remaining} remaining tunnel ${metrics.remaining === 1 ? 'pair' : 'pairs'}`;
  return null;
}

// One status line from the same checklist the HUD shows. Short lists name every
// count; long ones summarize and name the next unfinished task.
export function storyProgressText(level, metrics) {
  const goals = storyChecklist(level, metrics);
  const line = goal => `${goal.value}/${goal.target} ${PROGRESS_NOUNS[goal.key]}`;
  const clock = `${Math.max(0, Math.ceil(level.limit - metrics.elapsed))}s left`;
  if (goals.length > 4) {
    const next = goals.find(goal => !goal.done);
    return [`${goals.filter(goal => goal.done).length}/${goals.length} goals`, next ? line(next) : storyFinishHint(level, metrics) ?? 'Tasks complete',
      metrics.powerHint, clock].filter(Boolean).join(' · ');
  }
  const parts = goals.map(line);
  if (!metrics.tailClear && TAIL_KINDS.includes(level.kind)) parts.push('Tail in transit');
  if (metrics.powerHint) parts.push(metrics.powerHint);
  parts.push(clock);
  return parts.join(' · ');
}

// Shared objective data for the preflight checklist and live completion marks.
export function storyChecklist(level, metrics = {}) {
  const primary = { orbs: 'orbs', tunnel: 'uniqueTunnels', jump: 'bodyJumps', rotation: 'rotations' }[level.kind] ?? 'healed';
  const targets = { ...level.mechanics, [primary]: level.target };
  for (const key of ['orbs', 'colors', 'rotations']) if (level[key]) targets[key] = level[key];
  const labels = { steamFusions: 'Make Steam: Fire → Water', quenchFusions: 'Make Quench: Water → Fire', boosts: 'Finish boosts', doubleJumps: 'Land double-jumps', rockets: 'Land a rocket flight',
    magnetOrbs: 'Catch orbs with a magnet', explodes: 'Ride out an explosion', elements: 'Use each element', uniqueElements: 'Collect different elements', elementPickups: 'Pick up elemental orbs', ringHeals: 'Surround a tunnel',
    signatures: 'Use your ability', bombs: 'Disarm bombs', kills: 'Defeat enemies',
    bodyLength: 'Grow your worm', selfPasses: 'Pass yourself in the Core', multiHeals: 'Double heals', fusions: 'Fuse two elements', uniqueFusions: 'Different fusions',
    orbs: 'Collect orbs', colors: "Collect each color", uniqueTunnels: "Cross tunnel pairs",
    bodyJumps: 'Jump over your body', rotations: 'Survive layer turns', healed: 'Heal tunnel pairs' };
  return Object.entries(targets).map(([key, target]) => {
    const value = Math.min(target, Math.max(0, metrics[key] ?? 0));
    // A run deals its own elements (metrics.elementOrder); before one, a random level says so.
    const elementLabel = target === STORY_ELEMENTS.length ? `all ${target} elements`
      : storyElementsRandom(level) && !metrics.elementOrder ? `${target} random elements`
      : storyElementNames(level, target, metrics.elementOrder).join(', ');
    const label = ['elements', 'uniqueElements'].includes(key)
      ? `${key === 'elements' ? 'Master' : 'Collect'} ${elementLabel}`
      : labels[key];
    return { key, label, value, target, done: value >= target };
  });
}
