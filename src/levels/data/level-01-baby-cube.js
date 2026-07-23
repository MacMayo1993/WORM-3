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
  // A single, reversible turn lets the first chapter teach observation before
  // asking the player to solve an open-ended scramble.
  scrambleSequence: [{ axis: 'row', sliceIndex: 1, dir: 1 }],
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
    objective: 'Return the one mixed layer so every face is one color again.',
    tip: 'Match all the colors on each side. You got this!',
    mobiLines: [
      "Aloha! I'm Mobi. This little cube is our map.",
      'Only one layer wandered away from home. Watch the colors, then turn that layer back.',
      'No tricks yet: one clean turn restores the whole daycare block.',
    ],
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
