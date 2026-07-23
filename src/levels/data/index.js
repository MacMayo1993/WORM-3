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

/**
 * The canonical Life Journey story campaign. Keep this list explicit so the
 * campaign order is obvious and the authored chapter files remain the single
 * source of truth for the player-facing story.
 */
export const STORY_LEVELS = [
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
 * Individual level exports for direct access
 */
export {
  CUBE_CAMPAIGN_LEVELS,
  getCubeCampaignLevel,
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
