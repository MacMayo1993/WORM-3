/**
 * Level 9: Quotient Collapse
 * The Moon - Full RP² mastery
 */

import { createLevel, GAME_MODES, WIN_CONDITIONS, BACKGROUNDS, DIFFICULTY, LEVEL_TAGS } from '../schema.js';

export default createLevel({
  id: 9,
  name: 'Quotient Collapse',
  description: 'Full RP² mastery',

  cubeSize: 5,
  chaosLevel: 3,
  mode: GAME_MODES.ULTIMATE,
  background: BACKGROUNDS.MOON,

  features: {
    rotations: true,
    tunnels: true,
    flips: true,
    chaos: true,
    explode: true,
    parity: true,
    net: true,
  },

  tutorial: {
    title: 'The Moon 🌙',
    text: 'One small step for cubes... Press N for the NET view - see everything unfolded! You can see Earth from here. One more challenge awaits...',
    tip: 'The net shows all connections at once.',
  },

  winCondition: WIN_CONDITIONS.ULTIMATE,
  winMessage: 'MOONWALK COMPLETE! The stars are calling... 🌍',
  cutsceneText: 'Enter the singularity.',

  difficulty: DIFFICULTY.EXPERT,
  tags: [LEVEL_TAGS.STORY, LEVEL_TAGS.CHALLENGE],

  requirements: {
    previousLevel: 8,
    stars: 0,
    achievements: [],
  },
});
