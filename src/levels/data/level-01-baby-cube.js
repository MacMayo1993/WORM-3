/**
 * Level 1: Baby Cube
 * The first step in the life journey - Daycare
 */

import { createLevel, GAME_MODES, WIN_CONDITIONS, BACKGROUNDS, DIFFICULTY, LEVEL_TAGS } from '../schema.js';

export default createLevel({
  id: 1,
  name: 'Baby Cube',
  description: 'Learn basic rotations',

  cubeSize: 2,
  chaosLevel: 0,
  mode: GAME_MODES.CLASSIC,
  background: BACKGROUNDS.DAYCARE,

  features: {
    rotations: true,
    tunnels: false,
    flips: false,
    chaos: false,
    explode: false,
    parity: false,
    net: false,
  },

  tutorial: {
    title: 'Welcome to Daycare! 🧒',
    text: "Let's play with blocks! This colorful 2×2 cube has 6 faces. Drag to spin the pieces around!",
    tip: 'Match all the colors on each side. You got this!',
  },

  winCondition: WIN_CONDITIONS.CLASSIC,
  winMessage: 'Gold star! ⭐ You solved your first puzzle! Ready for elementary school?',
  cutsceneText: 'Learn the colors.',

  difficulty: DIFFICULTY.TUTORIAL,
  tags: [LEVEL_TAGS.STORY, LEVEL_TAGS.TUTORIAL],

  requirements: {
    previousLevel: null,
    stars: 0,
    achievements: [],
  },
});
