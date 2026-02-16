/**
 * Story Campaign Level Pack
 *
 * The main "Life Journey" campaign from Daycare to Black Hole.
 */

import { createLevelPack, DIFFICULTY, LEVEL_TAGS } from '../schema.js';
import { STORY_LEVELS } from '../data/index.js';

export default createLevelPack({
  id: 'story-campaign',
  name: 'Life Journey',
  description: 'Progress through life from Daycare to the Singularity. Master topology one step at a time.',
  author: 'WORM³ Team',
  version: '1.0.0',
  levels: STORY_LEVELS,

  difficulty: DIFFICULTY.MEDIUM,
  tags: [LEVEL_TAGS.STORY, LEVEL_TAGS.TUTORIAL],
  thumbnail: null,

  requirements: {
    completedPacks: [],
    totalStars: 0,
  },
});
