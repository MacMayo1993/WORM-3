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
  // Gentle 4×4: two outer-face turns (the intuitive part of a big cube) plus one
  // seam flip. Inner-slice turns are what make 4×4s hard, so this route avoids them.
  scrambleSequence: [
    { axis: 'row', sliceIndex: 0, dir: 1 },
    { axis: 'col', sliceIndex: 3, dir: -1 },
  ],
  flipSequence: [{ x: 1, y: 3, z: 2, dirKey: 'PY' }],
  chaosLevel: 0,
  mode: GAME_MODES.CLASSIC,
  background: BACKGROUNDS.JOB,

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
    title: 'First Job 💼',
    text: 'Welcome to the real world! Use Explode to blow the cube apart and see its internal structure. Time to think in 3D like a professional!',
    objective: 'Open explode view, identify the seam marker, and reverse the two moved layers.',
    tip: 'Open Explode — Views → Explode, or press X — to pull the cubies apart and see exactly which two layers moved.',
    mobiLines: [
      'At work, a problem is easier once you can see its structure.',
      'Open explode view and find the two layers that moved. The top-center flip is the seam marker for this route.',
      'Plan the inverse path before turning. The cube is large now, but its logic is still readable.',
    ],
  },

  winCondition: WIN_CONDITIONS.CLASSIC,
  winMessage: 'Promotion earned! You see the bigger picture now! 📊',
  cutsceneText: 'Navigate RP² axes.',

  difficulty: DIFFICULTY.MEDIUM,
  tags: [LEVEL_TAGS.STORY],

  requirements: {
    previousLevel: 5,
    stars: 0,
    achievements: [],
  },
});
