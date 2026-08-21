/**
 * Level Data Index
 * Exports all individual level definitions
 */

import level01 from './level-01-baby-cube.js';
import level02 from './level-02-twin-paradox.js';
import level03 from './level-03-flip-gateway.js';
import level04 from './level-04-chaos-ripple.js';
import level05 from './level-05-parity-gate.js';
import level06 from './level-06-manifold-axes.js';
import level07 from './level-07-sudokube-veil.js';
import level08 from './level-08-ultimate-seam.js';
import level09 from './level-09-quotient-collapse.js';
import level10 from './level-10-black-hole.js';
import { CUBE_CAMPAIGN_LEVELS, getCubeCampaignLevel } from './cube-campaign.js';
import { ALGORITHM_CODEX_LEVELS, getAlgorithmLevel, getAlgorithmLevelIds } from './algorithm-codex.js';
import { STORY_DESCENT_LEVELS, getStoryDescentLevel, getStoryDescentLevelIds } from './story-descent.js';

/**
 * The authored "Life Journey" arc (Daycare → Black Hole). It is no longer the
 * active Story campaign — Topological Descent replaced it — but the ten chapter
 * files remain the single source of truth for this arc, kept here so restoring
 * it is one edit (`export const STORY_LEVELS = LIFE_JOURNEY_LEVELS`).
 */
export const LIFE_JOURNEY_LEVELS = [
  level01,
  level02,
  level03,
  level04,
  level05,
  level06,
  level07,
  level08,
  level09,
  level10,
];

/**
 * The active Story campaign. Story mode = the analytically generated
 * Topological Descent (see data/story-descent.js). Everything that asks for the
 * "story levels" — LevelsManager, the tutorial, the dev console — resolves here,
 * so this alias is the one switch that chooses which campaign is Story mode.
 */
export const STORY_LEVELS = STORY_DESCENT_LEVELS;

/**
 * Individual level exports for direct access
 */
export {
  CUBE_CAMPAIGN_LEVELS,
  getCubeCampaignLevel,
  ALGORITHM_CODEX_LEVELS,
  getAlgorithmLevel,
  getAlgorithmLevelIds,
  STORY_DESCENT_LEVELS,
  getStoryDescentLevel,
  getStoryDescentLevelIds,
  level01,
  level02,
  level03,
  level04,
  level05,
  level06,
  level07,
  level08,
  level09,
  level10,
};

/**
 * Get level by ID from story campaign
 * @param {number} id - Level ID
 * @returns {LevelDefinition|undefined}
 */
export function getStoryLevel(id) {
  return STORY_LEVELS.find(level => level.id === id);
}

/**
 * Get all level IDs
 * @returns {number[]}
 */
export function getStoryLevelIds() {
  return STORY_LEVELS.map(level => level.id);
}

/** All progressive CUBE Campaign level IDs. */
export function getCubeCampaignLevelIds() {
  return CUBE_CAMPAIGN_LEVELS.map(level => level.id);
}
