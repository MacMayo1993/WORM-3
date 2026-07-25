/**
 * Level 10: Black Hole
 * The Singularity - Full antipodal topology mastery
 */

import { createLevel, GAME_MODES, WIN_CONDITIONS, BACKGROUNDS, DIFFICULTY, LEVEL_TAGS } from '../schema.js';

export default createLevel({
  id: 10,
  name: 'Black Hole',
  description: 'Full antipodal topology',

  cubeSize: 5,
  scrambleSequence: [
    { axis: 'row', sliceIndex: 1, dir: 1 },
    { axis: 'col', sliceIndex: 3, dir: -1 },
    { axis: 'depth', sliceIndex: 2, dir: 1 },
    { axis: 'row', sliceIndex: 4, dir: -1 },
    { axis: 'col', sliceIndex: 0, dir: 1 },
    { axis: 'depth', sliceIndex: 4, dir: -1 },
    { axis: 'row', sliceIndex: 2, dir: 1 },
  ],
  flipSequence: [
    { x: 2, y: 2, z: 4, dirKey: 'PZ' },
    { x: 4, y: 2, z: 2, dirKey: 'PX' },
    { x: 2, y: 4, z: 2, dirKey: 'PY' },
  ],
  chaosLevel: 0,
  mode: GAME_MODES.ULTIMATE,
  background: BACKGROUNDS.BLACKHOLE,

  features: {
    rotations: true,
    tunnels: true,
    flips: true,
    chaos: false,
    explode: true,
    parity: true,
    net: true,
  },

  tutorial: {
    title: 'The Singularity 🕳️',
    text: "Maximum complexity. You're at the edge of a BLACK HOLE. Everything you've learned leads to this moment. Good luck.",
    objective: 'Use parity and the net to clear three seam pairs and restore all seven layers.',
    tip: 'Seams first: clear all three flipped pairs, then unwind the layer turns in reverse order. May the topology be with you.',
    mobiLines: [
      'This is the Singularity. Every tool you learned is part of the same map.',
      'Three seams are inverted and seven layers have drifted. Read parity, unfold the net, and choose a calm route back.',
      'You are not escaping the manifold. You understand it now.',
    ],
  },

  winCondition: WIN_CONDITIONS.ULTIMATE,
  winMessage: 'YOU ESCAPED THE SINGULARITY! TOPOLOGY MASTER! 🏆',
  cutsceneText: 'Survive the Singularity.',
  hasCutscene: true,  // Special epic cutscene

  difficulty: DIFFICULTY.MASTER,
  tags: [LEVEL_TAGS.STORY, LEVEL_TAGS.CHALLENGE],

  requirements: {
    previousLevel: 9,
    stars: 0,
    achievements: [],
  },
});
