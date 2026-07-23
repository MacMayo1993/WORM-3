/**
 * Cube Academy Level Pack
 *
 * A compact, deterministic 3×3 onboarding sequence. It deliberately lives
 * beside (rather than inside) Life Journey so Story mode can retain its full
 * Daycare-to-Singularity arc without losing these focused practice lessons.
 */

import { createLevelPack, DIFFICULTY, LEVEL_TAGS } from '../schema.js';
import { CUBE_CAMPAIGN_LEVELS } from '../data/index.js';

export default createLevelPack({
  id: 'cube-academy',
  name: 'Cube Academy',
  description: 'Six focused 3×3 lessons for learning turns, antipodal flips, and planning tools.',
  author: 'WORM³ Team',
  version: '1.0.0',
  levels: CUBE_CAMPAIGN_LEVELS,
  difficulty: DIFFICULTY.TUTORIAL,
  tags: [LEVEL_TAGS.TUTORIAL, LEVEL_TAGS.PUZZLE],
  thumbnail: null,
  requirements: {
    completedPacks: [],
    totalStars: 0,
  },
});
