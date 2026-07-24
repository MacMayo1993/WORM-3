/**
 * WORM³ Levels Manager System
 *
 * A comprehensive system for managing game levels, progress, and level packs.
 *
 * Usage:
 *
 *   // Import the main managers
 *   import { levelsManager, progressManager } from './levels';
 *
 *   // Get a level
 *   const level = levelsManager.getLevel(1);
 *
 *   // Check if unlocked
 *   const unlocked = progressManager.isLevelUnlocked(2);
 *
 *   // Complete a level
 *   progressManager.completeLevel(1, { time: 120, moves: 50 });
 *
 *   // Get new features for a level
 *   const features = levelsManager.getNewFeatures(3);
 *
 * Architecture:
 *
 *   /levels
 *   ├── index.js              - Main exports (this file)
 *   ├── schema.js             - Level schema, constants, types
 *   ├── LevelsManager.js      - Level queries and management
 *   ├── ProgressManager.js    - Save/load, completion tracking
 *   ├── validation.js         - Level validation utilities
 *   ├── data/                 - Individual level definitions
 *   │   ├── index.js
 *   │   └── level-XX-*.js
 *   └── packs/                - Level pack collections
 *       ├── index.js
 *       └── story-campaign.js
 */

// ============================================================================
// MAIN EXPORTS
// ============================================================================

// Manager instances (use these for most operations)
export { levelsManager, LevelsManager } from './LevelsManager.js';
export { progressManager, ProgressManager } from './ProgressManager.js';
export { computeStars, getLevelPar, parSlack } from './scoring.js';

// ============================================================================
// SCHEMA & CONSTANTS
// ============================================================================

export {
  // Game constants
  GAME_MODES,
  WIN_CONDITIONS,
  BACKGROUNDS,
  DIFFICULTY,
  LEVEL_TAGS,

  // Feature system
  DEFAULT_FEATURES,
  FEATURE_UNLOCK_ORDER,
  FEATURE_NAMES,

  // Level creation helpers
  createLevel,
  createLevelPack,
} from './schema.js';

// ============================================================================
// LEVEL DATA
// ============================================================================

export { STORY_LEVELS, getStoryLevel, getStoryLevelIds, CUBE_CAMPAIGN_LEVELS, getCubeCampaignLevel, getCubeCampaignLevelIds } from './data/index.js';

// ============================================================================
// LEVEL PACKS
// ============================================================================

export { OFFICIAL_PACKS, BUILT_IN_PACKS, getPack, getPackIds, storyCampaign, cubeAcademy } from './packs/index.js';

// ============================================================================
// VALIDATION
// ============================================================================

export {
  validateLevel,
  validateLevelPack,
  validateAllLevels,
  printValidationReport,
} from './validation.js';

// ============================================================================
// CONVENIENCE FUNCTIONS (Backwards compatibility with old levels.js)
// ============================================================================

import { levelsManager } from './LevelsManager.js';
import { progressManager } from './ProgressManager.js';
import { STORY_LEVELS } from './data/index.js';

/**
 * @deprecated Use levelsManager.getStoryLevels() instead
 * Legacy export for backwards compatibility
 */
export const LEVELS = STORY_LEVELS;

/**
 * @deprecated Use levelsManager.getLevel(id) instead
 */
export const getLevel = (id) => levelsManager.getLevel(id);

/**
 * @deprecated Use levelsManager.getNextLevel(id) instead
 */
export const getNextLevel = (currentId) => levelsManager.getNextLevel(currentId);

/**
 * @deprecated Use progressManager.isLevelUnlocked(id) instead
 */
export const isLevelUnlocked = (levelId, _completedLevels) => {
  // For backwards compatibility, accept completedLevels parameter
  // but use progressManager internally
  return progressManager.isLevelUnlocked(levelId);
};

/**
 * @deprecated Use progressManager.loadProgress() instead
 */
export const loadProgress = () => progressManager.loadProgress();

/**
 * @deprecated Use progressManager.saveProgress(levels) instead
 */
export const saveProgress = (completedLevels) => progressManager.saveProgress(completedLevels);

/**
 * @deprecated Use progressManager.completeLevel(id) instead
 */
export const completeLevel = (levelId, stats = {}) => {
  progressManager.completeLevel(levelId, stats);
  return progressManager.loadProgress();
};

/**
 * @deprecated Use levelsManager.getNewFeatures(id) instead
 */
export const getNewFeatures = (levelId) => levelsManager.getNewFeatures(levelId);
