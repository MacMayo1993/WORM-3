/**
 * Level 8: Ultimate Seam
 * Rocket Launch - Dual constraints collide
 */

import { createLevel, GAME_MODES, WIN_CONDITIONS, BACKGROUNDS, DIFFICULTY, LEVEL_TAGS } from '../schema.js';

export default createLevel({
  id: 8,
  name: 'Ultimate Seam',
  description: 'Dual constraints collide',

  cubeSize: 4,
  chaosLevel: 3,
  mode: GAME_MODES.ULTIMATE,
  background: BACKGROUNDS.ROCKET,

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
    title: 'Rocket Launch 🚀',
    text: "3... 2... 1... LIFTOFF! Colors AND numbers must BOTH be correct! This is the ultimate challenge. You're leaving Earth!",
    tip: 'Focus on one constraint first, then adjust.',
  },

  winCondition: WIN_CONDITIONS.ULTIMATE,
  winMessage: 'WE HAVE LIFTOFF! Dual mastery achieved! 🔥',
  cutsceneText: 'Dual symmetries collide.',

  difficulty: DIFFICULTY.EXPERT,
  tags: [LEVEL_TAGS.STORY, LEVEL_TAGS.CHALLENGE],

  requirements: {
    previousLevel: 7,
    stars: 0,
    achievements: [],
  },
});
