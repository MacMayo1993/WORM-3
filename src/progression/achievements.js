// Definitions and evaluators are independent of React, the store and rendering.
const feat = (id, mode, title, description, xp, family = id) => ({ id, mode, title, description, xp, family });
export const ACHIEVEMENTS = [
  feat('worm-palette', 'worm', 'Color Curious', 'Collect three different face colors in one run.', 25, 'worm-colors'),
  feat('worm-spectrum', 'worm', 'Full Spectrum', 'Collect all six face colors in one run.', 50, 'worm-colors'),
  feat('worm-gatherer', 'worm', 'Orb Gatherer', 'Collect 20 orbs in one run.', 25, 'worm-orbs'),
  feat('worm-hoard', 'worm', 'Living Rainbow', 'Collect 80 orbs in one run.', 50, 'worm-orbs'),
  feat('worm-crossing', 'worm', 'Front Is Back', 'Finish a tunnel traversal and resume crawling.', 25, 'worm-routes'),
  feat('worm-routes', 'worm', 'Thread the Cube', 'Complete three different tunnel color routes in one run.', 50, 'worm-routes'),
  feat('worm-healer', 'worm', 'First Aid', 'Heal a tunnel pair in one run.', 25, 'worm-heals'),
  feat('worm-surgeon', 'worm', 'Cube Surgeon', 'Heal three tunnel pairs in one run.', 50, 'worm-heals'),
  feat('worm-grass', 'worm', 'Green Thumb', 'Collect eight orbs during one grass activation.', 50),
  feat('worm-elements', 'worm', 'Element Hopper', 'Activate three different elements in one run.', 50),
  feat('worm-restored', 'worm', 'Whole Again', 'Heal the entire cube.', 100, 'worm-clear'),
  feat('worm-mega', 'worm', 'Mega Medic', 'Heal an entire Mega cube (15×15×15).', 100, 'worm-clear'),
  feat('story-clear', 'story', 'Chapter Written', 'Independently complete a story chapter.', 25),
  feat('story-stars', 'story', 'Perfect Chapter', 'Earn three stars on an independent chapter clear.', 50),
  feat('story-best', 'story', 'Rewrite History', 'Beat your previous independent chapter move record.', 50),
  feat('cube-clear', 'cube', 'Cube Graduate', 'Independently complete a Cube Academy lesson.', 25),
  feat('cube-par', 'cube', 'Under Budget', 'Finish a Cube Academy lesson below its authored par.', 50),
  feat('codex-clear', 'codex', 'Code Cracker', 'Independently complete an Algorithm Codex chapter.', 25),
  feat('codex-par', 'codex', 'Elegant Algorithm', 'Complete a Codex chapter at or below its authored par.', 50),
  feat('freeplay-clear', 'freeplay', 'Your Own Way', 'Independently solve a fresh Freeplay scramble.', 25),
  feat('freeplay-large', 'freeplay', 'Big Thinking', 'Independently solve a fresh Freeplay cube of size 4 or larger.', 50),
  feat('random-clear', 'random', 'Order from Chaos', 'Independently solve a fresh Random puzzle.', 25),
  feat('random-efficient', 'random', 'Short Circuit', 'Solve a fresh Random puzzle in fewer moves than its scramble.', 50),
  feat('biome-clear', 'biome', 'City Planner', 'Shuffle and independently restore a Biome cube.', 25),
  feat('biome-efficient', 'biome', 'Urban Renewal', 'Restore a shuffled Biome cube in fewer moves than its scramble.', 50),
  feat('daily-clear', 'daily', 'Descent Complete', 'Independently finish today’s Daily Descent.', 25),
  feat('daily-par', 'daily', 'Precision Landing', 'Independently finish a Daily Descent at or below par.', 50),
  feat('chaos-round', 'chaos', 'Eye of the Storm', 'See a standalone Chaos round through to its result.', 25),
  feat('chaos-colors', 'chaos', 'Every Color Has Its Day', 'See all six face colors among winning pairs across completed Chaos rounds.', 50),
  feat('teach-algorithm', 'teach', 'Muscle Memory', 'Finish an algorithm’s final turn.', 25),
  feat('teach-quiz', 'teach', 'Read the Cube', 'Correctly answer a lesson quiz.', 25),
  feat('teach-session', 'teach', 'Study Session', 'Complete three different algorithms in one Teach session.', 50),
  feat('explore-pairs', 'explore', 'Opposites Attract', 'Explore all three antipodal pairs in the Cubelet viewer.', 25),
  feat('demo-intro', 'demo', 'Welcome to the Other Side', 'Complete the introduction.', 25),
];
export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
export const DISCOVERY_XP = 10;

export function wormFeats(run) {
  const f = run.featStats || {}, ids = [];
  if ((f.colors?.length || 0) >= 3) ids.push('worm-palette');
  if (f.colors?.length === 6) ids.push('worm-spectrum');
  if (f.orbs >= 20) ids.push('worm-gatherer');
  if (f.orbs >= 80) ids.push('worm-hoard');
  if (run.seen.length >= 1) ids.push('worm-crossing');
  if (run.seen.length >= 3) ids.push('worm-routes');
  if (run.counters.healed >= 1) ids.push('worm-healer');
  if (run.counters.healed >= 3) ids.push('worm-surgeon');
  if (f.grassOrbs >= 8) ids.push('worm-grass');
  if (f.elements?.length >= 3) ids.push('worm-elements');
  return ids;
}

export function puzzleFeats(state, run, stars, priorBest) {
  if (run.assisted || !run.eligible) return [];
  const ids = [`${run.mode}-clear`];
  if (run.mode === 'story' && stars === 3) ids.push('story-stars');
  if (run.mode === 'story' && priorBest && state.moves < priorBest) ids.push('story-best');
  if (run.mode === 'cube' && run.par > 0 && state.moves < run.par) ids.push('cube-par');
  if (['codex', 'daily'].includes(run.mode) && run.par > 0 && state.moves <= run.par) ids.push(`${run.mode}-par`);
  if (run.mode === 'freeplay' && run.size >= 4) ids.push('freeplay-large');
  if (['random', 'biome'].includes(run.mode) && state.moves < run.scrambleMoves) ids.push(`${run.mode}-efficient`);
  return ids;
}
