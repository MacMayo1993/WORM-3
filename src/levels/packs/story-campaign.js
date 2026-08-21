/**
 * Story Campaign Level Pack
 *
 * Story mode is the **Topological Descent**: an analytically generated ramp of
 * antipodal flip puzzles whose par is exact from the monograph's decoder
 * (docs/antipodal-math). It replaced the authored "Life Journey" arc as the
 * story campaign.
 *
 * Life Journey is not gone — its ten authored chapters still live in
 * data/level-01..10 and `LIFE_JOURNEY_LEVELS`. To restore it as Story mode, set
 * `export const STORY_LEVELS = LIFE_JOURNEY_LEVELS` in data/index.js and swap
 * `levels`/name/description below; nothing was deleted.
 */

import { createLevelPack, DIFFICULTY, LEVEL_TAGS } from '../schema.js';
import { STORY_DESCENT_LEVELS } from '../data/index.js';

export default createLevelPack({
  id: 'story-campaign',
  name: 'Topological Descent',
  description: 'Descend the antipodal quotient from a single reflection to the Singularity. Every level has an exact par.',
  author: 'WORM³ Team',
  version: '2.0.0',
  levels: STORY_DESCENT_LEVELS,

  difficulty: DIFFICULTY.MEDIUM,
  tags: [LEVEL_TAGS.STORY, LEVEL_TAGS.TUTORIAL],
  thumbnail: null,

  requirements: {
    completedPacks: [],
    totalStars: 0,
  },
});
