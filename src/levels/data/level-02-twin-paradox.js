/**
 * Level 2: Twin Paradox
 * Elementary School - Discover antipodal pairs
 */

import { createLevel, GAME_MODES, WIN_CONDITIONS, BACKGROUNDS, DIFFICULTY, LEVEL_TAGS } from '../schema.js';

export default createLevel({
  id: 2,
  name: 'Twin Paradox',
  description: 'Discover antipodal pairs',

  cubeSize: 2,
  scrambleSequence: [
    { axis: 'depth', sliceIndex: 0, dir: 1 },
    { axis: 'col', sliceIndex: 1, dir: -1 },
  ],
  chaosLevel: 0,
  mode: GAME_MODES.CLASSIC,
  background: BACKGROUNDS.ELEMENTARY,

  features: {
    rotations: true,
    tunnels: true,
    flips: false,
    chaos: false,
    explode: false,
    parity: false,
    net: false,
  },

  tutorial: {
    title: 'Elementary School 📚',
    text: 'Time to learn something cool! Every sticker has a TWIN on the opposite side. Turn on Tunnels to see the secret threads connecting them!',
    objective: 'Use the tunnel view to study opposite faces, then restore the two mixed layers.',
    tip: 'Turn on Tunnels — Views → Tunnels, or press T — to see the threads joining each tile to its twin on the far side.',
    mobiLines: [
      'The daycare block had one answer. This school cube has a secret: every tile has a twin.',
      'Press T and trace a tunnel from one face to its opposite. They are farther apart to your eyes, but adjacent in our world.',
      'Use ordinary turns to bring the two mixed layers home. Keep the twin connection in mind—we will cross it next.',
    ],
  },

  winCondition: WIN_CONDITIONS.CLASSIC,
  winMessage: 'A+ work! You discovered that opposites are connected! 📝',
  cutsceneText: 'Opposites are ONE.',

  difficulty: DIFFICULTY.TUTORIAL,
  tags: [LEVEL_TAGS.STORY, LEVEL_TAGS.TUTORIAL],

  requirements: {
    previousLevel: 1,
    stars: 0,
    achievements: [],
  },
});
