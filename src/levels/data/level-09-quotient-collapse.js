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
  scrambleSequence: [
    { axis: 'depth', sliceIndex: 1, dir: 1 },
    { axis: 'row', sliceIndex: 3, dir: -1 },
    { axis: 'col', sliceIndex: 2, dir: 1 },
    { axis: 'depth', sliceIndex: 4, dir: -1 },
    { axis: 'row', sliceIndex: 0, dir: 1 },
    { axis: 'col', sliceIndex: 4, dir: -1 },
  ],
  flipSequence: [
    { x: 2, y: 2, z: 4, dirKey: 'PZ' },
    { x: 2, y: 4, z: 2, dirKey: 'PY' },
  ],
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
    objective: 'Plan in net view, clear both center seams, and unwind the six-layer route.',
    tip: 'The net shows all connections at once.',
    mobiLines: [
      'On the Moon, distance finally looks different. Open the net and the whole surface becomes a route map.',
      'Two center seams and six layers are out of place. Plan their inverse order in the net before you touch the cube.',
      'The quotient only collapses when you look at one face at a time. Unfold it, and the path appears.',
    ],
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
