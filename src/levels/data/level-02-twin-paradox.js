/**
 * Level 2: Twin Paradox
 * Elementary School - Discover antipodal pairs
 */

import { createLevel, GAME_MODES, WIN_CONDITIONS, BACKGROUNDS, DIFFICULTY, LEVEL_TAGS } from '../schema.js';

export default createLevel({
  id: 2,
  name: 'Twin Paradox',
  description: 'Discover antipodal pairs',

  cubeSize: 2,
  chaosLevel: 0,
  mode: GAME_MODES.CLASSIC,
  background: BACKGROUNDS.ELEMENTARY,

  features: {
    rotations: true,
    tunnels: true,
    flips: false,
    chaos: false,
    explode: false,
    parity: false,
    net: false,
  },

  tutorial: {
    title: 'Elementary School 📚',
    text: 'Time to learn something cool! Every sticker has a TWIN on the opposite side. Press T to see the secret tunnels connecting them!',
    tip: 'Opposites are connected - just like in math class!',
  },

  winCondition: WIN_CONDITIONS.CLASSIC,
  winMessage: 'A+ work! You discovered that opposites are connected! 📝',
  cutsceneText: 'Opposites are ONE.',

  difficulty: DIFFICULTY.TUTORIAL,
  tags: [LEVEL_TAGS.STORY, LEVEL_TAGS.TUTORIAL],

  requirements: {
    previousLevel: 1,
    stars: 0,
    achievements: [],
  },
});
