/**
 * Level 6: Manifold Axes
 * First Job - Explore projective planes
 */

import { createLevel, GAME_MODES, WIN_CONDITIONS, BACKGROUNDS, DIFFICULTY, LEVEL_TAGS } from '../schema.js';

export default createLevel({
  id: 6,
  name: 'Manifold Axes',
  description: 'Explore projective planes',

  cubeSize: 4,
  chaosLevel: 2,
  mode: GAME_MODES.CLASSIC,
  background: BACKGROUNDS.JOB,

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
    title: 'First Job 💼',
    text: 'Welcome to the real world! Press X to EXPLODE the cube and see its internal structure. Time to think in 3D like a professional!',
    tip: 'Explode view reveals how the pieces connect.',
  },

  winCondition: WIN_CONDITIONS.CLASSIC,
  winMessage: 'Promotion earned! You see the bigger picture now! 📊',
  cutsceneText: 'Navigate RP² axes.',

  difficulty: DIFFICULTY.HARD,
  tags: [LEVEL_TAGS.STORY],

  requirements: {
    previousLevel: 5,
    stars: 0,
    achievements: [],
  },
});
