/**
 * Level 4: Growing Pains
 * High School - Untangle a bigger scramble using turns and flips
 */

import { createLevel, GAME_MODES, WIN_CONDITIONS, BACKGROUNDS, DIFFICULTY, LEVEL_TAGS } from '../schema.js';

export default createLevel({
  id: 4,
  name: 'Growing Pains',
  description: 'Untangle a bigger scramble',

  cubeSize: 3,
  scrambleSequence: [
    { axis: 'row', sliceIndex: 0, dir: 1 },
    { axis: 'col', sliceIndex: 2, dir: -1 },
    { axis: 'depth', sliceIndex: 1, dir: 1 }
  ],
  flipSequence: [{ x: 1, y: 2, z: 1, dirKey: 'PY' }],
  chaosLevel: 0,
  mode: GAME_MODES.CLASSIC,
  background: BACKGROUNDS.HIGHSCHOOL,

  features: {
    rotations: true,
    tunnels: true,
    flips: true,
    chaos: false,
    explode: false,
    parity: false,
    net: false
  },

  tutorial: {
    title: 'High School 🏫',
    text: 'Welcome to high school! Things get a little tougher now: three layers are twisted and one center tile has flipped through a seam to its twin. Take your time and set them all right.',
    objective: 'Flip the top center back through its twin, then reverse the three twisted layers.',
    tip: 'No rush — fix one layer at a time, then tap the odd center to flip it home.',
    mobiLines: [
      'High school already? Three layers are twisted, and one center wandered through a seam to the far side.',
      'Start with that flipped top center — tap it to send it back through to its twin.',
      'Then undo the three twisted layers, one calm turn at a time. You have got this.'
    ]
  },

  winCondition: WIN_CONDITIONS.CLASSIC,
  winMessage: 'You conquered high school! Nothing can stop you now! 🎓',
  cutsceneText: 'The halls settle down.',

  difficulty: DIFFICULTY.MEDIUM,
  tags: [LEVEL_TAGS.STORY],

  requirements: {
    previousLevel: 3,
    stars: 0,
    achievements: []
  }
});
