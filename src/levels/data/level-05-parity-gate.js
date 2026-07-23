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
  scrambleSequence: [
    { axis: 'col', sliceIndex: 0, dir: 1 },
    { axis: 'row', sliceIndex: 2, dir: -1 },
    { axis: 'depth', sliceIndex: 0, dir: 1 },
  ],
  flipSequence: [
    { x: 1, y: 1, z: 2, dirKey: 'PZ' },
    { x: 1, y: 2, z: 1, dirKey: 'PY' },
  ],
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
    objective: 'Use parity as a compass: clear the two seam pairs, then restore the three layers.',
    tip: 'The sledgehammer algorithm fixes parity issues.',
    mobiLines: [
      'College lesson: the parity light remembers whether a path crossed the seam.',
      'Use it as a compass, not a grade. Clear the two flipped center pairs, then return the three layers.',
      'A purple path is not wrong—it tells you how the cube has been oriented.',
    ],
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
