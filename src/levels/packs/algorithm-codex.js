/**
 * Algorithm Codex Level Pack
 *
 * Ten 3×3 levels, one per famous speedcubing algorithm, ordered so each builds
 * on the last: two primitive triggers, the F2L insert, an orientation pair, a
 * commutator, three permutations, and Superflip as the finale.
 */

import { createLevelPack, DIFFICULTY, LEVEL_TAGS } from '../schema.js';
import { ALGORITHM_CODEX_LEVELS } from '../data/algorithm-codex.js';

export default createLevelPack({
  id: 'algorithm-codex',
  name: 'Algorithm Codex',
  description: 'Ten levels, ten famous speedcubing algorithms. Each cube is scrambled by exactly the inverse of its algorithm, so par is the algorithm itself.',
  author: 'WORM³ Team',
  version: '1.0.0',
  levels: ALGORITHM_CODEX_LEVELS,
  difficulty: DIFFICULTY.MEDIUM,
  tags: [LEVEL_TAGS.PUZZLE, LEVEL_TAGS.TUTORIAL],
  thumbnail: null,
  requirements: {
    completedPacks: [],
    totalStars: 0,
  },
});
