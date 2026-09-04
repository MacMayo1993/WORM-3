// story-descent.js — the Topological Descent story campaign.
//
// This is the Story-mode campaign: a ramp of puzzles that need BOTH kinds of
// move. A cube is solved when every sticker shows the colour its face wants, and
// there are two ways to make that true of a tile — TURN it back to where its
// colour belongs, or FLIP it so its colour becomes the one it is standing on.
// Both cost one move (useCubeState charges a move for either).
//
// Every chapter is staged with layer turns AND flipped β-pairs, and is verified
// to need both: neither turning alone nor flipping alone can solve any of these
// boards. Chapters used to be flip-only — a solved cube plus N flipped pairs,
// every wrong tile obvious and one tap from right — which taught the flip but
// never asked when to use it. Adding turns is what makes the choice real: a tile
// can now be wrong because it MOVED or because it FLIPPED, and telling those
// apart is the campaign.
//
// ── Par ──────────────────────────────────────────────────────────────────────
// Par is the exact minimum number of moves, turns and flips together, proven by
// exhausting every shorter sequence (levels/parSolver.js). It is NOT the staging
// length: turns cancel, and a tile a turn left on its antipodal face is one flip
// from correct rather than several turns from home.
//
// ── Why the boards are hardcoded ─────────────────────────────────────────────
// Proving par optimal costs ~17x per additional move, so generating this
// campaign takes a couple of seconds — far too long to spend at import, which
// every screen and every test pays. The stagings below were generated once
// (seed 20260904) and pinned. The suite re-derives par and the move-mix proof
// from these boards, so a wrong number here fails rather than ships.
//
// That cost also sets the ramp's ceiling. Par 5 is provable in ~400ms on a 3x3
// but ~10s on a 4x4, so the 4x4 chapters top out at par 4 and difficulty climbs
// through board size and the turn/flip interleave rather than raw move count —
// four moves among a 4x4's 48 β-pairs is a longer hunt than five among a 3x3's
// 27. Raising the ceiling means giving up the exactness of par, not just
// spending more time.
//
// The previous authored "Life Journey" chapters (data/level-01..10) are kept in
// the repo, unreferenced, so restoring them is a one-line change in
// packs/story-campaign.js.

import { createLevel, GAME_MODES, WIN_CONDITIONS, BACKGROUNDS, DIFFICULTY, LEVEL_TAGS } from '../schema.js';

/**
 * Pinned stagings, generated with seed 20260904 and verified: each `par` is the
 * proven optimum for its board, and neither move type alone reaches it — in fact
 * neither alone can solve these boards at all.
 *
 * `scramble` is applied first, then `flips`, matching levelStaging's order. Flip
 * anchors name positions on the SCRAMBLED board, because that is where staging
 * applies them; a β-pair is a pair of sticker identities and the pairing has
 * already moved by then.
 */
const STAGINGS = {
  1: {
    par: 2,
    scramble: [{ axis: 'depth', sliceIndex: 0, dir: -1, numTurns: 1 }],
    flips: [
      { x: 0, y: 0, z: 1, dirKey: 'PZ' }
    ]
  },
  2: {
    par: 3,
    scramble: [{ axis: 'row', sliceIndex: 1, dir: -1, numTurns: 1 }],
    flips: [
      { x: 0, y: 0, z: 0, dirKey: 'NZ' },
      { x: 0, y: 0, z: 0, dirKey: 'NX' }
    ]
  },
  3: {
    par: 4,
    scramble: [{ axis: 'depth', sliceIndex: 1, dir: 1, numTurns: 1 }, { axis: 'depth', sliceIndex: 1, dir: 1, numTurns: 1 }],
    flips: [
      { x: 0, y: 0, z: 0, dirKey: 'NZ' },
      { x: 0, y: 0, z: 0, dirKey: 'NX' }
    ]
  },
  4: {
    par: 3,
    scramble: [{ axis: 'row', sliceIndex: 1, dir: 1, numTurns: 1 }],
    flips: [
      { x: 0, y: 2, z: 0, dirKey: 'PY' },
      { x: 0, y: 0, z: 1, dirKey: 'NX' }
    ]
  },
  5: {
    par: 4,
    scramble: [{ axis: 'col', sliceIndex: 1, dir: 1, numTurns: 1 }],
    flips: [
      { x: 0, y: 0, z: 1, dirKey: 'NY' },
      { x: 1, y: 0, z: 0, dirKey: 'NZ' },
      { x: 0, y: 1, z: 2, dirKey: 'PZ' }
    ]
  },
  6: {
    par: 4,
    scramble: [{ axis: 'depth', sliceIndex: 2, dir: -1, numTurns: 1 }, { axis: 'depth', sliceIndex: 2, dir: -1, numTurns: 1 }],
    flips: [
      { x: 0, y: 2, z: 0, dirKey: 'NZ' },
      { x: 0, y: 2, z: 0, dirKey: 'PY' }
    ]
  },
  7: {
    par: 5,
    scramble: [{ axis: 'row', sliceIndex: 2, dir: -1, numTurns: 1 }, { axis: 'depth', sliceIndex: 2, dir: -1, numTurns: 1 }],
    flips: [
      { x: 0, y: 0, z: 2, dirKey: 'PZ' },
      { x: 1, y: 2, z: 0, dirKey: 'PY' },
      { x: 0, y: 2, z: 2, dirKey: 'PY' }
    ]
  },
  8: {
    par: 5,
    scramble: [{ axis: 'row', sliceIndex: 0, dir: 1, numTurns: 1 }, { axis: 'depth', sliceIndex: 0, dir: -1, numTurns: 1 }, { axis: 'row', sliceIndex: 1, dir: 1, numTurns: 1 }],
    flips: [
      { x: 0, y: 0, z: 0, dirKey: 'NZ' },
      { x: 0, y: 2, z: 0, dirKey: 'NZ' }
    ]
  },
  9: {
    par: 3,
    scramble: [{ axis: 'depth', sliceIndex: 1, dir: 1, numTurns: 1 }],
    flips: [
      { x: 0, y: 0, z: 3, dirKey: 'NX' },
      { x: 0, y: 0, z: 0, dirKey: 'NZ' }
    ]
  },
  10: {
    par: 4,
    scramble: [{ axis: 'col', sliceIndex: 1, dir: -1, numTurns: 1 }],
    flips: [
      { x: 0, y: 0, z: 1, dirKey: 'NX' },
      { x: 0, y: 0, z: 0, dirKey: 'NY' },
      { x: 0, y: 2, z: 0, dirKey: 'NX' }
    ]
  },
  11: {
    par: 4,
    scramble: [{ axis: 'depth', sliceIndex: 2, dir: -1, numTurns: 1 }, { axis: 'col', sliceIndex: 2, dir: -1, numTurns: 1 }, { axis: 'row', sliceIndex: 1, dir: -1, numTurns: 1 }],
    flips: [
      { x: 1, y: 3, z: 2, dirKey: 'PY' }
    ]
  },
  12: {
    par: 4,
    scramble: [{ axis: 'col', sliceIndex: 1, dir: 1, numTurns: 1 }, { axis: 'depth', sliceIndex: 1, dir: -1, numTurns: 1 }],
    flips: [
      { x: 0, y: 3, z: 1, dirKey: 'PY' },
      { x: 0, y: 0, z: 2, dirKey: 'NY' }
    ]
  },
};

/**
 * Chapter specs. Narrative and presentation only — the board, and therefore the
 * difficulty, lives in STAGINGS above.
 */
const CHAPTERS = [
  { id: 1, name: 'First Reflection', size: 2, background: BACKGROUNDS.DAYCARE, difficulty: DIFFICULTY.TUTORIAL,
    concept: 'One tile is out of place and one is the wrong colour. Turn the first home; tap the second to recolour it.' },
  { id: 2, name: 'Twin Tiles', size: 2, background: BACKGROUNDS.ELEMENTARY, difficulty: DIFFICULTY.EASY,
    concept: 'Two tiles show their opposite. A tap sends a pair across the manifold — but a turn is still needed first.' },
  { id: 3, name: 'The Quiet Quotient', size: 2, background: BACKGROUNDS.MIDDLESCHOOL, difficulty: DIFFICULTY.EASY,
    concept: 'Two turns and two flips. Neither kind of move alone will finish this cube.' },
  { id: 4, name: 'Descent Begins', size: 3, background: BACKGROUNDS.HIGHSCHOOL, difficulty: DIFFICULTY.EASY,
    concept: 'The 3x3 hides its faults further apart. Find the tile that moved before you hunt the ones that flipped.' },
  { id: 5, name: 'Parity Gate', size: 3, background: BACKGROUNDS.COLLEGE, difficulty: DIFFICULTY.MEDIUM,
    concept: 'One turn, three flips. Read the parity glow: a flipped tile is wrong in colour, not in place.' },
  { id: 6, name: 'Working the Fibre', size: 3, background: BACKGROUNDS.JOB, difficulty: DIFFICULTY.MEDIUM,
    concept: 'Two of each. Par is exact — four moves, no wasted motion, is a perfect run.' },
  { id: 7, name: 'Launch Window', size: 3, background: BACKGROUNDS.NASA, difficulty: DIFFICULTY.MEDIUM,
    concept: 'Five moves, mixed. Plan the order: turning after flipping moves what you just fixed.' },
  { id: 8, name: 'Escape Velocity', size: 3, background: BACKGROUNDS.ROCKET, difficulty: DIFFICULTY.HARD,
    concept: 'Three turns and two flips. The geometry comes apart further before it comes back.' },
  { id: 9, name: 'Far Side', size: 4, background: BACKGROUNDS.MOON, difficulty: DIFFICULTY.HARD,
    concept: 'A 4x4 opens 48 pairs. Three moves — but finding which three is the whole job.' },
  { id: 10, name: 'Deep Field', size: 4, background: BACKGROUNDS.MOON, difficulty: DIFFICULTY.EXPERT,
    concept: 'One turn, three flips, across the far faces. Rotate the whole cube to hunt each antipode.' },
  { id: 11, name: 'Event Horizon', size: 4, background: BACKGROUNDS.BLACKHOLE, difficulty: DIFFICULTY.EXPERT,
    concept: 'Three turns and a single flip. The one recoloured tile is easy to miss and impossible to skip.' },
  { id: 12, name: 'Singularity', size: 4, background: BACKGROUNDS.BLACKHOLE, difficulty: DIFFICULTY.MASTER,
    concept: 'Two turns, two flips, the biggest board. Zero margin. Restore the fibre.' }
];

function buildChapter(chapter, index) {
  const staging = STAGINGS[chapter.id];
  if (!staging) throw new RangeError(`Chapter ${chapter.id} has no pinned staging`);
  const { par, scramble, flips } = staging;
  const isFinale = index === CHAPTERS.length - 1;
  const turnWord = `${scramble.length} turn${scramble.length === 1 ? '' : 's'}`;
  const flipWord = `${flips.length} flipped pair${flips.length === 1 ? '' : 's'}`;

  return createLevel({
    id: chapter.id,
    name: chapter.name,
    description: `${turnWord} and ${flipWord} — solvable in ${par} moves`,
    cubeSize: chapter.size,
    scrambleSequence: scramble,
    scrambleMoves: 0, // never a random scramble on top of the authored staging
    flipSequence: flips,
    par,
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
      objective: `Par is ${par} move${par === 1 ? '' : 's'} — turns and flips count the same.`,
      tip: 'A tile on the opposite face is showing exactly the wrong colour: one flip fixes it where it stands. A tile on any other face has to be turned home.'
    },
    winCondition: WIN_CONDITIONS.CLASSIC,
    winMessage: isFinale
      ? 'The descent is complete — the fibre is whole. ⭐'
      : `Solved in ${par}. On to the next depth. ⭐`,
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
