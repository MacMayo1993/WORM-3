/**
 * Level Packs Index
 * Exports all available level packs
 */

import storyCampaign from './story-campaign.js';
import cubeAcademy from './cube-academy.js';

/**
 * All official level packs
 */
export const OFFICIAL_PACKS = [
  storyCampaign,
  cubeAcademy,
];

/**
 * Built-in packs (always available)
 */
export const BUILT_IN_PACKS = {
  'story-campaign': storyCampaign,
  'cube-academy': cubeAcademy,
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

export { storyCampaign, cubeAcademy };
