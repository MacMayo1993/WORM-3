/**
 * WORM³ Levels Manager
 *
 * Central class for managing levels, level packs, and level queries.
 * Provides a clean API for all level-related operations.
 */

import { STORY_LEVELS } from './data/index.js';
import { BUILT_IN_PACKS } from './packs/index.js';
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

    // Register every built-in pack so cross-pack lookup, pack-relative
    // next/previous, and the pack selector all see the same set. Without this
    // the shipped packs existed only as exported data that nothing could reach.
    for (const pack of Object.values(BUILT_IN_PACKS)) {
      this.customPacks.set(pack.id, pack);
      this._registerLevels(pack.levels, pack.id);
    }
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
    const story = this.storyCampaign.find(l => l.id === id);
    if (story) return story;
    // Fall through to every registered pack. Level ids are globally unique
    // across packs (see LEVEL_ID_RANGES in schema.js) precisely so this lookup —
    // and the flat completed-levels array in ProgressManager — stay unambiguous.
    for (const level of this.levelRegistry.values()) {
      if (level.id === id) return level;
    }
    return null;
  }

  /**
   * The pack a level belongs to, or null for an unregistered id.
   * @param {number} id
   * @returns {LevelPack|null}
   */
  getPackForLevel(id) {
    if (this.storyCampaign.some(l => l.id === id)) return this.getPack('story-campaign');
    for (const pack of this.customPacks.values()) {
      if (pack.levels.some(l => l.id === id)) return pack;
    }
    return null;
  }

  /** Ordered level list of the pack containing `id` (story campaign by default). */
  _siblingLevels(id) {
    const pack = this.getPackForLevel(id);
    return pack?.levels ?? this.storyCampaign;
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
    // Walk the containing pack's own ordering rather than assuming id + 1, so a
    // pack numbered in its own range still advances correctly.
    const siblings = this._siblingLevels(currentId);
    const i = siblings.findIndex(l => l.id === currentId);
    return i >= 0 ? (siblings[i + 1] ?? null) : null;
  }

  /**
   * Get previous level in story campaign
   * @param {number} currentId - Current level ID
   * @returns {LevelDefinition|null}
   */
  getPreviousLevel(currentId) {
    const siblings = this._siblingLevels(currentId);
    const i = siblings.findIndex(l => l.id === currentId);
    return i > 0 ? siblings[i - 1] : null;
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
    return this.getLevel(id) !== null;
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
    if (!level) return [];

    // Pack-relative, not id - 1: a pack numbered in its own range has no level
    // at id - 1, which previously made every one of its chapters report no new
    // features at all.
    const prevLevel = this.getPreviousLevel(levelId);
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
