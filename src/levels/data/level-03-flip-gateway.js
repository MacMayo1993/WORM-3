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
  scrambleSequence: [
    { axis: 'row', sliceIndex: 1, dir: 1 },
    { axis: 'depth', sliceIndex: 2, dir: -1 },
  ],
  flipSequence: [
    { x: 1, y: 1, z: 2, dirKey: 'PZ' },
    { x: 2, y: 1, z: 1, dirKey: 'PX' },
  ],
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
    objective: 'Flip the two wrong center pairs, then return the disturbed layers.',
    tip: 'Use flips wisely - they change BOTH twins!',
    mobiLines: [
      'This is the gateway. A flip does not merely turn a face—it crosses the seam.',
      'Two center pairs are wearing their opposite colors. Tap one, then look through the cube for the matching repair.',
      'When the centers agree again, unwind the two disturbed layers. You are now navigating, not just rotating.',
    ],
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
