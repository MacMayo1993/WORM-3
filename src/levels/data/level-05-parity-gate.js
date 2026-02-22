/**
 * Level 5: Parity Gate
 * College - Understand orientation
 */

import { createLevel, GAME_MODES, WIN_CONDITIONS, BACKGROUNDS, DIFFICULTY, LEVEL_TAGS } from '../schema.js';

export default createLevel({
  id: 5,
  name: 'Parity Gate',
  description: 'Understand orientation',

  cubeSize: 3,
  chaosLevel: 1,
  mode: GAME_MODES.CLASSIC,
  background: BACKGROUNDS.COLLEGE,

  features: {
    rotations: true,
    tunnels: true,
    flips: true,
    chaos: true,
    explode: false,
    parity: true,
    net: false,
  },

  tutorial: {
    title: 'College 🎓',
    text: 'Time for advanced concepts! EVEN parity (cyan) = normal. ODD parity (purple) = you crossed a "seam". This is real topology!',
    tip: 'The sledgehammer algorithm fixes parity issues.',
  },

  winCondition: WIN_CONDITIONS.CLASSIC,
  winMessage: "Bachelor's degree earned! You understand parity! 📜",
  cutsceneText: 'Untwist the quotient.',

  difficulty: DIFFICULTY.MEDIUM,
  tags: [LEVEL_TAGS.STORY],

  requirements: {
    previousLevel: 4,
    stars: 0,
    achievements: [],
  },
});
