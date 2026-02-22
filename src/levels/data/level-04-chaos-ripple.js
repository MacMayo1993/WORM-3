/**
 * Level 4: Chaos Ripple
 * High School - Survive the instability
 */

import { createLevel, GAME_MODES, WIN_CONDITIONS, BACKGROUNDS, DIFFICULTY, LEVEL_TAGS } from '../schema.js';

export default createLevel({
  id: 4,
  name: 'Chaos Ripple',
  description: 'Survive the instability',

  cubeSize: 3,
  chaosLevel: 1,
  mode: GAME_MODES.CLASSIC,
  background: BACKGROUNDS.HIGHSCHOOL,

  features: {
    rotations: true,
    tunnels: true,
    flips: true,
    chaos: true,
    explode: false,
    parity: false,
    net: false,
  },

  tutorial: {
    title: 'High School 🏫',
    text: 'Welcome to the chaos! Just like high school, things can get WILD. Flipped stickers might trigger chain reactions. Stay calm and solve fast!',
    tip: "Don't panic! Solve before the chaos spreads!",
  },

  winCondition: WIN_CONDITIONS.CLASSIC,
  winMessage: 'You survived high school! Nothing can stop you now! 🎓',
  cutsceneText: 'Chaos spreads...',

  difficulty: DIFFICULTY.MEDIUM,
  tags: [LEVEL_TAGS.STORY],

  requirements: {
    previousLevel: 3,
    stars: 0,
    achievements: [],
  },
});
