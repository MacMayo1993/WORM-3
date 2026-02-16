/**
 * WORM³ Levels Manager
 *
 * Central class for managing levels, level packs, and level queries.
 * Provides a clean API for all level-related operations.
 */

import { STORY_LEVELS } from './data/index.js';
import { FEATURE_NAMES, GAME_MODES } from './schema.js';

/**
 * Levels Manager - Central API for level management
 */
class LevelsManager {
  constructor() {
    // Built-in story campaign levels
    this.storyCampaign = [...STORY_LEVELS];

    // Custom level packs (can be extended)
    this.customPacks = new Map();

    // All registered levels (for quick lookup)
    this.levelRegistry = new Map();

    // Register story campaign levels
    this._registerLevels(this.storyCampaign, 'story');
  }

  // ============================================================================
  // REGISTRATION
  // ============================================================================

  /**
   * Register levels in the registry
   * @private
   */
  _registerLevels(levels, packId) {
    for (const level of levels) {
      const key = `${packId}:${level.id}`;
      this.levelRegistry.set(key, { ...level, packId });
    }
  }

  /**
   * Register a custom level pack
   * @param {LevelPack} pack - Level pack to register
   */
  registerPack(pack) {
    if (this.customPacks.has(pack.id)) {
      console.warn(`Level pack "${pack.id}" already registered, overwriting.`);
    }
    this.customPacks.set(pack.id, pack);
    this._registerLevels(pack.levels, pack.id);
  }

  /**
   * Unregister a custom level pack
   * @param {string} packId - Pack ID to unregister
   */
  unregisterPack(packId) {
    const pack = this.customPacks.get(packId);
    if (pack) {
      for (const level of pack.levels) {
        this.levelRegistry.delete(`${packId}:${level.id}`);
      }
      this.customPacks.delete(packId);
    }
  }

  // ============================================================================
  // LEVEL QUERIES
  // ============================================================================

  /**
   * Get all story campaign levels
   * @returns {LevelDefinition[]}
   */
  getStoryLevels() {
    return [...this.storyCampaign];
  }

  /**
   * Get story level by ID
   * @param {number} id - Level ID
   * @returns {LevelDefinition|null}
   */
  getLevel(id) {
    return this.storyCampaign.find(l => l.id === id) || null;
  }

  /**
   * Get level from any pack
   * @param {string} packId - Pack ID
   * @param {number} levelId - Level ID
   * @returns {LevelDefinition|null}
   */
  getLevelFromPack(packId, levelId) {
    const key = `${packId}:${levelId}`;
    return this.levelRegistry.get(key) || null;
  }

  /**
   * Get next level in story campaign
   * @param {number} currentId - Current level ID
   * @returns {LevelDefinition|null}
   */
  getNextLevel(currentId) {
    return this.storyCampaign.find(l => l.id === currentId + 1) || null;
  }

  /**
   * Get previous level in story campaign
   * @param {number} currentId - Current level ID
   * @returns {LevelDefinition|null}
   */
  getPreviousLevel(currentId) {
    return this.storyCampaign.find(l => l.id === currentId - 1) || null;
  }

  /**
   * Get first level
   * @returns {LevelDefinition}
   */
  getFirstLevel() {
    return this.storyCampaign[0];
  }

  /**
   * Get last level
   * @returns {LevelDefinition}
   */
  getLastLevel() {
    return this.storyCampaign[this.storyCampaign.length - 1];
  }

  /**
   * Get total number of story levels
   * @returns {number}
   */
  getTotalLevels() {
    return this.storyCampaign.length;
  }

  /**
   * Check if level exists
   * @param {number} id - Level ID
   * @returns {boolean}
   */
  hasLevel(id) {
    return this.storyCampaign.some(l => l.id === id);
  }

  // ============================================================================
  // LEVEL FILTERING
  // ============================================================================

  /**
   * Get levels by difficulty
   * @param {string} difficulty - Difficulty rating
   * @returns {LevelDefinition[]}
   */
  getLevelsByDifficulty(difficulty) {
    return this.storyCampaign.filter(l => l.difficulty === difficulty);
  }

  /**
   * Get levels by tag
   * @param {string} tag - Level tag
   * @returns {LevelDefinition[]}
   */
  getLevelsByTag(tag) {
    return this.storyCampaign.filter(l => l.tags.includes(tag));
  }

  /**
   * Get levels by mode
   * @param {string} mode - Game mode
   * @returns {LevelDefinition[]}
   */
  getLevelsByMode(mode) {
    return this.storyCampaign.filter(l => l.mode === mode);
  }

  /**
   * Get levels by cube size
   * @param {number} size - Cube size
   * @returns {LevelDefinition[]}
   */
  getLevelsByCubeSize(size) {
    return this.storyCampaign.filter(l => l.cubeSize === size);
  }

  /**
   * Get levels with specific feature enabled
   * @param {string} feature - Feature name
   * @returns {LevelDefinition[]}
   */
  getLevelsWithFeature(feature) {
    return this.storyCampaign.filter(l => l.features[feature]);
  }

  // ============================================================================
  // FEATURE COMPARISON
  // ============================================================================

  /**
   * Get new features unlocked at a specific level
   * @param {number} levelId - Level ID
   * @returns {string[]} Array of feature display names
   */
  getNewFeatures(levelId) {
    const level = this.getLevel(levelId);
    if (!level || levelId === 1) return [];

    const prevLevel = this.getLevel(levelId - 1);
    if (!prevLevel) return [];

    const newFeatures = [];
    const features = level.features;
    const prevFeatures = prevLevel.features;

    // Check each feature
    if (features.tunnels && !prevFeatures.tunnels) {
      newFeatures.push(FEATURE_NAMES.tunnels);
    }
    if (features.flips && !prevFeatures.flips) {
      newFeatures.push(FEATURE_NAMES.flips);
    }
    if (features.chaos && !prevFeatures.chaos) {
      newFeatures.push(FEATURE_NAMES.chaos);
    }
    if (features.explode && !prevFeatures.explode) {
      newFeatures.push(FEATURE_NAMES.explode);
    }
    if (features.parity && !prevFeatures.parity) {
      newFeatures.push(FEATURE_NAMES.parity);
    }
    if (features.net && !prevFeatures.net) {
      newFeatures.push(FEATURE_NAMES.net);
    }

    // Check mode changes
    if (level.mode !== prevLevel.mode) {
      if (level.mode === GAME_MODES.SUDOKUBE) {
        newFeatures.push('Sudokube Mode');
      }
      if (level.mode === GAME_MODES.ULTIMATE) {
        newFeatures.push('Ultimate Mode');
      }
    }

    return newFeatures;
  }

  /**
   * Get all features available at a specific level
   * @param {number} levelId - Level ID
   * @returns {string[]} Array of enabled feature names
   */
  getAvailableFeatures(levelId) {
    const level = this.getLevel(levelId);
    if (!level) return [];

    return Object.entries(level.features)
      .filter(([_, enabled]) => enabled)
      .map(([feature]) => FEATURE_NAMES[feature] || feature);
  }

  /**
   * Check if a feature is available at a specific level
   * @param {number} levelId - Level ID
   * @param {string} feature - Feature name
   * @returns {boolean}
   */
  isFeatureAvailable(levelId, feature) {
    const level = this.getLevel(levelId);
    return level?.features[feature] ?? false;
  }

  // ============================================================================
  // LEVEL PACKS
  // ============================================================================

  /**
   * Get all registered level packs
   * @returns {LevelPack[]}
   */
  getAllPacks() {
    return Array.from(this.customPacks.values());
  }

  /**
   * Get a specific level pack
   * @param {string} packId - Pack ID
   * @returns {LevelPack|null}
   */
  getPack(packId) {
    return this.customPacks.get(packId) || null;
  }

  /**
   * Get levels from a specific pack
   * @param {string} packId - Pack ID
   * @returns {LevelDefinition[]}
   */
  getPackLevels(packId) {
    const pack = this.customPacks.get(packId);
    return pack ? [...pack.levels] : [];
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  /**
   * Get level statistics summary
   * @returns {Object}
   */
  getStatistics() {
    const levels = this.storyCampaign;

    return {
      total: levels.length,
      byDifficulty: this._countBy(levels, 'difficulty'),
      byMode: this._countBy(levels, 'mode'),
      byCubeSize: this._countBy(levels, 'cubeSize'),
      byBackground: this._countBy(levels, 'background'),
      customPacks: this.customPacks.size,
      totalCustomLevels: Array.from(this.customPacks.values())
        .reduce((sum, pack) => sum + pack.levels.length, 0),
    };
  }

  /**
   * Count levels by property
   * @private
   */
  _countBy(levels, property) {
    return levels.reduce((acc, level) => {
      const value = level[property];
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }
}

// Export singleton instance
export const levelsManager = new LevelsManager();

// Also export the class for testing or custom instances
export { LevelsManager };
