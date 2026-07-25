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
  // Gentle 4×4 finale: three outer-face turns plus one seam flip. Still a step up
  // from the earlier 4×4s, but no hard inner slices and a much shorter route.
  scrambleSequence: [
    { axis: 'row', sliceIndex: 0, dir: 1 },
    { axis: 'col', sliceIndex: 3, dir: -1 },
    { axis: 'depth', sliceIndex: 0, dir: 1 },
  ],
  flipSequence: [{ x: 2, y: 2, z: 3, dirKey: 'PZ' }],
  chaosLevel: 0,
  mode: GAME_MODES.ULTIMATE,
  background: BACKGROUNDS.ROCKET,

  features: {
    rotations: true,
    tunnels: true,
    flips: true,
    chaos: false,
    explode: true,
    parity: true,
    net: false,
  },

  tutorial: {
    title: 'Rocket Launch 🚀',
    text: "3... 2... 1... LIFTOFF! Colors AND numbers must BOTH be correct! This is the ultimate challenge. You're leaving Earth!",
    objective: 'Repair the seam, then reverse the three-layer route while checking color and number rules.',
    tip: 'Get the colors right first and ignore the numbers. Once a face is one solid color, the numbers only have to shuffle around within it.',
    mobiLines: [
      'Liftoff. Color and number rules are both live now, and neither can be ignored.',
      'Clear the seam marker first. Then retrace the three layers in reverse, checking each view when the route feels ambiguous.',
      'Ultimate does not mean faster. It means holding two true ideas at once.',
    ],
  },

  winCondition: WIN_CONDITIONS.ULTIMATE,
  winMessage: 'WE HAVE LIFTOFF! Dual mastery achieved! 🔥',
  cutsceneText: 'Dual symmetries collide.',

  difficulty: DIFFICULTY.HARD,
  tags: [LEVEL_TAGS.STORY, LEVEL_TAGS.CHALLENGE],

  requirements: {
    previousLevel: 7,
    stars: 0,
    achievements: [],
  },
});
