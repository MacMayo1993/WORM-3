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
  scrambleSequence: [
    { axis: 'row', sliceIndex: 2, dir: 1 },
    { axis: 'col', sliceIndex: 0, dir: -1 },
    { axis: 'depth', sliceIndex: 1, dir: 1 },
    { axis: 'row', sliceIndex: 0, dir: -1 },
    { axis: 'col', sliceIndex: 3, dir: 1 },
  ],
  flipSequence: [
    { x: 2, y: 2, z: 3, dirKey: 'PZ' },
    { x: 3, y: 1, z: 2, dirKey: 'PX' },
  ],
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
    objective: 'Repair both seam pairs, then reverse the five-layer route while checking color and number rules.',
    tip: 'Focus on one constraint first, then adjust.',
    mobiLines: [
      'Liftoff. Color and number rules are both live now, and neither can be ignored.',
      'Clear the two seam markers first. Then retrace the five layers in reverse, checking each view when the route feels ambiguous.',
      'Ultimate does not mean faster. It means holding two true ideas at once.',
    ],
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
