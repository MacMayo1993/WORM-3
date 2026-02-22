/**
 * Level Packs Index
 * Exports all available level packs
 */

import storyCampaign from './story-campaign.js';

/**
 * All official level packs
 */
export const OFFICIAL_PACKS = [
  storyCampaign,
];

/**
 * Built-in packs (always available)
 */
export const BUILT_IN_PACKS = {
  'story-campaign': storyCampaign,
};

/**
 * Get a pack by ID
 * @param {string} packId
 * @returns {LevelPack|undefined}
 */
export function getPack(packId) {
  return BUILT_IN_PACKS[packId];
}

/**
 * Get all pack IDs
 * @returns {string[]}
 */
export function getPackIds() {
  return Object.keys(BUILT_IN_PACKS);
}

export { storyCampaign };
