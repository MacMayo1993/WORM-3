// story-descent.js — the Topological Descent story campaign.
//
// This is the Story-mode campaign: a narrative ramp of antipodal flip puzzles
// whose par is *analytically exact*, straight from the monograph's decoder
// (docs/antipodal-math). Each chapter authors a deterministic flipSequence via
// the level bridge, so par = number of antipodal pairs to send home = C_dir on
// the symmetric (n_A = 0) sector — no pathfinding, identical for every player.
//
// Only the flip sector is stageable in Classic mode (native flips are paired, so
// n_A = 0). The asymmetric/heal tiers of the full 5-tier descent await the
// worm/heal move model; when that lands, later chapters extend this list.
//
// The previous authored "Life Journey" chapters (data/level-01..10) are kept in
// the repo, unreferenced, so restoring them is a one-line change in
// packs/story-campaign.js.

import { createLevel, GAME_MODES, WIN_CONDITIONS, BACKGROUNDS, DIFFICULTY, LEVEL_TAGS } from '../schema.js';
import { buildAntipodalFlipSequence, betaPairCount } from '../antipodalLevelBridge.js';

// One shared seed keeps the whole campaign reproducible across builds/players.
const DESCENT_SEED = 20260821;

/**
 * Chapter specs. `par` is the exact number of antipodal pairs shown flipped
 * (and therefore the exact solve length). `size` must satisfy par ≤ P(size)
 * (P = 12 / 27 / 48 for 2 / 3 / 4).
 */
const CHAPTERS = [
  { id: 1, name: 'First Reflection', size: 2, par: 1, background: BACKGROUNDS.DAYCARE, difficulty: DIFFICULTY.TUTORIAL,
    concept: 'One antipodal pair shows the opposite home colour. Tap it — both members return at once.' },
  { id: 2, name: 'Twin Tiles', size: 2, par: 2, background: BACKGROUNDS.ELEMENTARY, difficulty: DIFFICULTY.EASY,
    concept: 'Two pairs are flipped. A whole-orbit inversion always costs exactly one tap.' },
  { id: 3, name: 'The Quiet Quotient', size: 3, par: 2, background: BACKGROUNDS.MIDDLESCHOOL, difficulty: DIFFICULTY.EASY,
    concept: 'On a bigger cube the pairs hide further apart. Find the two that face their antipode.' },
  { id: 4, name: 'Descent Begins', size: 3, par: 3, background: BACKGROUNDS.HIGHSCHOOL, difficulty: DIFFICULTY.EASY,
    concept: 'Three flipped pairs. No layer turns are needed — the fibre solves by flips alone.' },
  { id: 5, name: 'Parity Gate', size: 3, par: 4, background: BACKGROUNDS.COLLEGE, difficulty: DIFFICULTY.MEDIUM,
    concept: 'Four pairs crossed the seam. Read the parity glow to find each one, then send it home.' },
  { id: 6, name: 'Working the Fibre', size: 3, par: 5, background: BACKGROUNDS.JOB, difficulty: DIFFICULTY.MEDIUM,
    concept: 'Five pairs. Par is exact: five taps, no wasted motion, is a perfect run.' },
  { id: 7, name: 'Launch Window', size: 3, par: 6, background: BACKGROUNDS.NASA, difficulty: DIFFICULTY.MEDIUM,
    concept: 'Six flipped pairs on the 3×3. Plan the order — every tap is counted.' },
  { id: 8, name: 'Escape Velocity', size: 4, par: 7, background: BACKGROUNDS.ROCKET, difficulty: DIFFICULTY.HARD,
    concept: 'A 4×4 opens 48 pairs. Seven are flipped — the search space grows, the method does not.' },
  { id: 9, name: 'Far Side', size: 4, par: 9, background: BACKGROUNDS.MOON, difficulty: DIFFICULTY.HARD,
    concept: 'Nine pairs across the far faces. Rotate the whole cube to hunt each antipode.' },
  { id: 10, name: 'Deep Field', size: 4, par: 11, background: BACKGROUNDS.MOON, difficulty: DIFFICULTY.EXPERT,
    concept: 'Eleven flipped pairs. Tight par, long chain — track what you have already sent home.' },
  { id: 11, name: 'Event Horizon', size: 4, par: 13, background: BACKGROUNDS.BLACKHOLE, difficulty: DIFFICULTY.EXPERT,
    concept: 'Thirteen pairs — the in-play worst case near the horizon. Exact execution only.' },
  { id: 12, name: 'Singularity', size: 4, par: 16, background: BACKGROUNDS.BLACKHOLE, difficulty: DIFFICULTY.MASTER,
    concept: 'Sixteen flipped pairs at the bottom of the descent. Zero margin. Restore the fibre.' }
];

function buildChapter(chapter, index) {
  const P = betaPairCount(chapter.size);
  if (chapter.par > P) {
    throw new RangeError(`Chapter ${chapter.id} par ${chapter.par} exceeds P=${P} on a ${chapter.size}×${chapter.size} cube`);
  }
  const flipSequence = buildAntipodalFlipSequence(chapter.size, chapter.par, `${DESCENT_SEED}:story:${chapter.id}`);
  const isFinale = index === CHAPTERS.length - 1;
  const plural = chapter.par === 1 ? '' : 's';

  return createLevel({
    id: chapter.id,
    name: chapter.name,
    description: `Return ${chapter.par} antipodal pair${plural} to solve the fibre`,
    cubeSize: chapter.size,
    scrambleSequence: null,
    scrambleMoves: 0, // never a random scramble on top of the authored flips
    flipSequence,
    par: chapter.par,
    chaosLevel: 0,
    mode: GAME_MODES.CLASSIC,
    background: chapter.background,
    features: {
      rotations: true,
      tunnels: false,
      flips: true,
      chaos: false,
      explode: false,
      parity: true,
      net: false
    },
    tutorial: {
      title: chapter.name,
      text: chapter.concept,
      objective: `Return every flipped pair. Par is ${chapter.par} flip${plural}.`,
      tip: 'A flipped pair shows its antipode. Tapping either member sends both home — no layer turns needed.'
    },
    winCondition: WIN_CONDITIONS.CLASSIC,
    winMessage: isFinale
      ? 'The descent is complete — the fibre is whole. ⭐'
      : `Fibre restored in ${chapter.par}. On to the next depth. ⭐`,
    cutsceneText: chapter.concept,
    hasCutscene: isFinale,
    difficulty: chapter.difficulty,
    tags: [LEVEL_TAGS.STORY],
    requirements: { previousLevel: index === 0 ? null : chapter.id - 1, stars: 0, achievements: [] }
  });
}

/** The Topological Descent story campaign (Story mode). */
export const STORY_DESCENT_LEVELS = CHAPTERS.map(buildChapter);

/** Get a descent chapter by id. */
export function getStoryDescentLevel(id) {
  return STORY_DESCENT_LEVELS.find((l) => l.id === id);
}

/** All descent chapter ids, in order. */
export function getStoryDescentLevelIds() {
  return STORY_DESCENT_LEVELS.map((l) => l.id);
}
