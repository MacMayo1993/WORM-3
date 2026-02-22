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
  chaosLevel: 4,
  mode: GAME_MODES.ULTIMATE,
  background: BACKGROUNDS.BLACKHOLE,

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
    title: 'The Singularity 🕳️',
    text: "Maximum chaos. Maximum complexity. You're at the edge of a BLACK HOLE. Everything you've learned leads to this moment. Good luck.",
    tip: 'May the topology be with you.',
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
