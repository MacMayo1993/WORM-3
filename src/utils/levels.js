/**
 * WORM³ Level Definitions
 *
 * @deprecated This file is deprecated. Use the new levels manager system instead:
 *
 *   import { levelsManager, progressManager } from '../levels';
 *
 * This file re-exports from the new system for backwards compatibility.
 * All imports from this file will continue to work, but new code should
 * use the new levels manager API.
 *
 * New Architecture:
 *   /src/levels/
 *   ├── index.js              - Main exports
 *   ├── schema.js             - Level schema & constants
 *   ├── LevelsManager.js      - Level queries
 *   ├── ProgressManager.js    - Progress tracking
 *   ├── validation.js         - Validation utilities
 *   ├── data/                 - Individual level files
 *   └── packs/                - Level pack collections
 */

// Re-export everything from the new system for backwards compatibility
export {
  // Legacy exports (deprecated but still work)
  LEVELS,
  getLevel,
  getNextLevel,
  isLevelUnlocked,
  loadProgress,
  saveProgress,
  completeLevel,
  getNewFeatures,

  // New exports (use these going forward)
  levelsManager,
  progressManager,
  LevelsManager,
  ProgressManager,

  // Schema and constants
  GAME_MODES,
  WIN_CONDITIONS,
  BACKGROUNDS,
  DIFFICULTY,
  LEVEL_TAGS,
  DEFAULT_FEATURES,
  FEATURE_NAMES,
  createLevel,
  createLevelPack,

  // Level data
  STORY_LEVELS,
  getStoryLevel,
  getStoryLevelIds,

  // Packs
  OFFICIAL_PACKS,
  BUILT_IN_PACKS,
  getPack,
  getPackIds,

  // Validation
  validateLevel,
  validateLevelPack,
  validateAllLevels,
  printValidationReport,
} from '../levels/index.js';
