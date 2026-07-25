/**
 * Level 7: Sudokube Veil
 * NASA Lab - Numbers meet topology
 */

import { createLevel, GAME_MODES, WIN_CONDITIONS, BACKGROUNDS, DIFFICULTY, LEVEL_TAGS } from '../schema.js';

export default createLevel({
  id: 7,
  name: 'Sudokube Veil',
  description: 'Numbers meet topology',

  cubeSize: 4,
  // Gentle 4×4: two outer-face turns plus one seam flip — no hard inner slices.
  scrambleSequence: [
    { axis: 'depth', sliceIndex: 0, dir: 1 },
    { axis: 'row', sliceIndex: 3, dir: -1 },
  ],
  flipSequence: [{ x: 2, y: 1, z: 3, dirKey: 'PZ' }],
  chaosLevel: 0,
  mode: GAME_MODES.SUDOKUBE,
  background: BACKGROUNDS.NASA,

  features: {
    rotations: true,
    tunnels: true,
    flips: true,
    chaos: false,
    explode: true,
    parity: true,
    net: false,
  },

  tutorial: {
    title: 'NASA Lab 🔬',
    text: "You made it to NASA! Colors become numbers now. Each face needs every number 1-16, one of each. It's Sudoku in SPACE!",
    objective: 'Use the number view to inspect the pattern, clear the front seam, and restore the two layers.',
    tip: 'Swap between numbers and colors from Views, or press V. Every face wants 1 through 16, one of each — no repeats.',
    mobiLines: [
      'NASA gave us a new instrument: every face now speaks in number patterns as well as color.',
      'Switch views when you need to inspect a row or column. The front flip marks the seam; the two turns restore the experiment.',
      'Do not guess at the veil. Read one constraint, make one deliberate move.',
    ],
  },

  winCondition: WIN_CONDITIONS.SUDOKUBE,
  winMessage: 'Mission Specialist certified! Sudoku + Topology = Genius! 🧪',
  cutsceneText: 'Numbers on the manifold.',

  difficulty: DIFFICULTY.MEDIUM,
  tags: [LEVEL_TAGS.STORY, LEVEL_TAGS.PUZZLE],

  requirements: {
    previousLevel: 6,
    stars: 0,
    achievements: [],
  },
});
