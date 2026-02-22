/**
 * Level 3: Flip Gateway
 * Middle School - Master the antipodal flip
 */

import { createLevel, GAME_MODES, WIN_CONDITIONS, BACKGROUNDS, DIFFICULTY, LEVEL_TAGS } from '../schema.js';

export default createLevel({
  id: 3,
  name: 'Flip Gateway',
  description: 'Master the antipodal flip',

  cubeSize: 3,
  chaosLevel: 0,
  mode: GAME_MODES.CLASSIC,
  background: BACKGROUNDS.MIDDLESCHOOL,

  features: {
    rotations: true,
    tunnels: true,
    flips: true,
    chaos: false,
    explode: false,
    parity: false,
    net: false,
  },

  tutorial: {
    title: 'Middle School 🎒',
    text: "Things are getting interesting! Click any sticker to FLIP it with its twin. Both colors swap at once - it's like magic... or math!",
    tip: 'Use flips wisely - they change BOTH twins!',
  },

  winCondition: WIN_CONDITIONS.CLASSIC,
  winMessage: "You're getting smarter! Flipping mastered! 🔄",
  cutsceneText: 'Flip the manifold.',

  difficulty: DIFFICULTY.EASY,
  tags: [LEVEL_TAGS.STORY],

  requirements: {
    previousLevel: 2,
    stars: 0,
    achievements: [],
  },
});
