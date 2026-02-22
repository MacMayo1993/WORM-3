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
  chaosLevel: 2,
  mode: GAME_MODES.SUDOKUBE,
  background: BACKGROUNDS.NASA,

  features: {
    rotations: true,
    tunnels: true,
    flips: true,
    chaos: true,
    explode: true,
    parity: true,
    net: false,
  },

  tutorial: {
    title: 'NASA Lab 🔬',
    text: "You made it to NASA! Colors become numbers now. Each face needs digits 1-16 with no repeats in any row or column. It's Sudoku in SPACE!",
    tip: 'Press V to toggle between colors and numbers.',
  },

  winCondition: WIN_CONDITIONS.SUDOKUBE,
  winMessage: 'Mission Specialist certified! Sudoku + Topology = Genius! 🧪',
  cutsceneText: 'Numbers on the manifold.',

  difficulty: DIFFICULTY.HARD,
  tags: [LEVEL_TAGS.STORY, LEVEL_TAGS.PUZZLE],

  requirements: {
    previousLevel: 6,
    stars: 0,
    achievements: [],
  },
});
