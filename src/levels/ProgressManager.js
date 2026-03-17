/**
 * WORM³ Progress Manager
 *
 * Handles all progress-related operations: save/load, completion tracking,
 * star ratings, achievements, and unlock logic.
 */

import { levelsManager } from './LevelsManager.js';

// Storage keys
const STORAGE_KEYS = {
  COMPLETED_LEVELS: 'worm3_completed_levels',
  LEVEL_STATS: 'worm3_level_stats',
  ACHIEVEMENTS: 'worm3_achievements',
  SETTINGS: 'worm3_progress_settings',
};

/**
 * @typedef {Object} LevelStats
 * @property {number} bestTime - Best completion time in seconds
 * @property {number} bestMoves - Fewest moves to complete
 * @property {number} stars - Star rating (1-3)
 * @property {number} completionCount - Number of times completed
 * @property {Date} firstCompleted - First completion timestamp
 * @property {Date} lastCompleted - Last completion timestamp
 */

/**
 * Progress Manager - Handles save/load and progress tracking
 */
class ProgressManager {
  constructor(options = {}) {
    // Configuration
    this.testMode = options.testMode ?? false;  // Set true to unlock all levels
    this.autoSave = options.autoSave ?? true;

    // In-memory cache
    this._completedLevels = null;
    this._levelStats = null;
    this._achievements = null;

    // Event listeners
    this._listeners = new Map();
  }

  // ============================================================================
  // PROGRESS LOADING
  // ============================================================================

  /**
   * Load completed levels from storage
   * @returns {number[]} Array of completed level IDs
   */
  loadProgress() {
    if (this._completedLevels !== null) {
      return [...this._completedLevels];
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEYS.COMPLETED_LEVELS);
      this._completedLevels = saved ? JSON.parse(saved) : [];
    } catch {
      this._completedLevels = [];
    }

    return [...this._completedLevels];
  }

  /**
   * Load detailed stats for all levels
   * @returns {Object.<number, LevelStats>}
   */
  loadLevelStats() {
    if (this._levelStats !== null) {
      return { ...this._levelStats };
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LEVEL_STATS);
      this._levelStats = saved ? JSON.parse(saved) : {};
    } catch {
      this._levelStats = {};
    }

    return { ...this._levelStats };
  }

  /**
   * Load achievements
   * @returns {string[]}
   */
  loadAchievements() {
    if (this._achievements !== null) {
      return [...this._achievements];
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS);
      this._achievements = saved ? JSON.parse(saved) : [];
    } catch {
      this._achievements = [];
    }

    return [...this._achievements];
  }

  // ============================================================================
  // PROGRESS SAVING
  // ============================================================================

  /**
   * Save completed levels to storage
   * @param {number[]} completedLevels
   */
  saveProgress(completedLevels) {
    this._completedLevels = [...completedLevels];

    if (this.autoSave) {
      try {
        localStorage.setItem(
          STORAGE_KEYS.COMPLETED_LEVELS,
          JSON.stringify(completedLevels)
        );
      } catch {
        // Ignore storage errors
      }
    }

    this._emit('progress-saved', { completedLevels });
  }

  /**
   * Save level stats to storage
   * @param {Object.<number, LevelStats>} stats
   */
  saveLevelStats(stats) {
    this._levelStats = { ...stats };

    if (this.autoSave) {
      try {
        localStorage.setItem(STORAGE_KEYS.LEVEL_STATS, JSON.stringify(stats));
      } catch {
        // Ignore storage errors
      }
    }
  }

  /**
   * Save achievements to storage
   * @param {string[]} achievements
   */
  saveAchievements(achievements) {
    this._achievements = [...achievements];

    if (this.autoSave) {
      try {
        localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(achievements));
      } catch {
        // Ignore storage errors
      }
    }

    this._emit('achievements-updated', { achievements });
  }

  // ============================================================================
  // LEVEL COMPLETION
  // ============================================================================

  /**
   * Mark a level as completed
   * @param {number} levelId - Level ID
   * @param {Object} stats - Completion stats (time, moves, etc.)
   * @returns {Object} Result with new unlocks and achievements
   */
  completeLevel(levelId, stats = {}) {
    const completed = this.loadProgress();
    const levelStats = this.loadLevelStats();
    const isFirstCompletion = !completed.includes(levelId);

    // Add to completed if not already
    if (isFirstCompletion) {
      completed.push(levelId);
      this.saveProgress(completed);
    }

    // Update level stats
    const existingStats = levelStats[levelId] || {};
    const now = new Date().toISOString();

    levelStats[levelId] = {
      bestTime: Math.min(existingStats.bestTime ?? Infinity, stats.time ?? Infinity),
      bestMoves: Math.min(existingStats.bestMoves ?? Infinity, stats.moves ?? Infinity),
      stars: Math.max(existingStats.stars ?? 0, this._calculateStars(levelId, stats)),
      completionCount: (existingStats.completionCount ?? 0) + 1,
      firstCompleted: existingStats.firstCompleted ?? now,
      lastCompleted: now,
    };

    this.saveLevelStats(levelStats);

    // Check for new unlocks
    const nextLevel = levelsManager.getNextLevel(levelId);
    const newUnlocks = [];

    if (nextLevel && isFirstCompletion) {
      newUnlocks.push(nextLevel);
    }

    // Check for new achievements
    const newAchievements = this._checkAchievements(levelId, stats, isFirstCompletion);

    // Emit event
    this._emit('level-completed', {
      levelId,
      stats: levelStats[levelId],
      isFirstCompletion,
      newUnlocks,
      newAchievements,
    });

    return {
      isFirstCompletion,
      newUnlocks,
      newAchievements,
      stats: levelStats[levelId],
    };
  }

  /**
   * Calculate star rating for level completion
   * @private
   */
  _calculateStars(levelId, stats) {
    const level = levelsManager.getLevel(levelId);
    if (!level) return 1;

    let stars = 1; // Base star for completion

    // Time-based star (if time limit exists or based on cube size)
    const timeThreshold = level.timeLimit || (level.cubeSize * level.cubeSize * 30);
    if (stats.time && stats.time < timeThreshold) {
      stars++;
    }

    // Move-based star (based on cube size)
    const moveThreshold = level.moveLimit || (level.cubeSize * level.cubeSize * 10);
    if (stats.moves && stats.moves < moveThreshold) {
      stars++;
    }

    return Math.min(stars, 3);
  }

  /**
   * Check for new achievements
   * @private
   */
  _checkAchievements(levelId, stats, isFirstCompletion) {
    const achievements = this.loadAchievements();
    const newAchievements = [];

    // First level completed
    if (levelId === 1 && isFirstCompletion && !achievements.includes('first_steps')) {
      newAchievements.push('first_steps');
    }

    // Final level completed
    if (levelId === 10 && isFirstCompletion && !achievements.includes('topology_master')) {
      newAchievements.push('topology_master');
    }

    // Speed demon (any level under 60 seconds)
    if (stats.time && stats.time < 60 && !achievements.includes('speed_demon')) {
      newAchievements.push('speed_demon');
    }

    // Perfectionist (3 stars on any level)
    if (this._calculateStars(levelId, stats) === 3 && !achievements.includes('perfectionist')) {
      newAchievements.push('perfectionist');
    }

    // All levels completed
    const completed = this.loadProgress();
    if (completed.length === levelsManager.getTotalLevels() && !achievements.includes('completionist')) {
      newAchievements.push('completionist');
    }

    // Save new achievements
    if (newAchievements.length > 0) {
      this.saveAchievements([...achievements, ...newAchievements]);
    }

    return newAchievements;
  }

  // ============================================================================
  // UNLOCK LOGIC
  // ============================================================================

  /**
   * Check if a level is unlocked
   * @param {number} levelId - Level ID
   * @returns {boolean}
   */
  isLevelUnlocked(levelId) {
    // Test mode: all levels unlocked
    if (this.testMode) return true;

    // Level 1 is always unlocked
    if (levelId === 1) return true;

    // Check requirements
    const level = levelsManager.getLevel(levelId);
    if (!level) return false;

    const completed = this.loadProgress();
    const { requirements } = level;

    // Previous level must be completed
    if (requirements.previousLevel && !completed.includes(requirements.previousLevel)) {
      return false;
    }

    // Star requirement
    if (requirements.stars > 0) {
      const totalStars = this.getTotalStars();
      if (totalStars < requirements.stars) return false;
    }

    // Achievement requirements
    if (requirements.achievements?.length > 0) {
      const achievements = this.loadAchievements();
      if (!requirements.achievements.every(a => achievements.includes(a))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a level is completed
   * @param {number} levelId - Level ID
   * @returns {boolean}
   */
  isLevelCompleted(levelId) {
    const completed = this.loadProgress();
    return completed.includes(levelId);
  }

  /**
   * Get all unlocked levels
   * @returns {LevelDefinition[]}
   */
  getUnlockedLevels() {
    return levelsManager.getStoryLevels().filter(level =>
      this.isLevelUnlocked(level.id)
    );
  }

  /**
   * Get all locked levels
   * @returns {LevelDefinition[]}
   */
  getLockedLevels() {
    return levelsManager.getStoryLevels().filter(level =>
      !this.isLevelUnlocked(level.id)
    );
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  /**
   * Get stats for a specific level
   * @param {number} levelId - Level ID
   * @returns {LevelStats|null}
   */
  getLevelStats(levelId) {
    const stats = this.loadLevelStats();
    return stats[levelId] || null;
  }

  /**
   * Get total stars earned across all levels
   * @returns {number}
   */
  getTotalStars() {
    const stats = this.loadLevelStats();
    return Object.values(stats).reduce((sum, s) => sum + (s.stars || 0), 0);
  }

  /**
   * Get maximum possible stars
   * @returns {number}
   */
  getMaxStars() {
    return levelsManager.getTotalLevels() * 3;
  }

  /**
   * Get completion percentage
   * @returns {number}
   */
  getCompletionPercentage() {
    const completed = this.loadProgress();
    const total = levelsManager.getTotalLevels();
    return total > 0 ? Math.round((completed.length / total) * 100) : 0;
  }

  /**
   * Get full progress summary
   * @returns {Object}
   */
  getProgressSummary() {
    const completed = this.loadProgress();
    const stats = this.loadLevelStats();
    const achievements = this.loadAchievements();
    const total = levelsManager.getTotalLevels();

    return {
      completedLevels: completed.length,
      totalLevels: total,
      completionPercentage: this.getCompletionPercentage(),
      totalStars: this.getTotalStars(),
      maxStars: this.getMaxStars(),
      achievements: achievements.length,
      totalPlayTime: Object.values(stats).reduce((sum, s) => sum + (s.bestTime || 0), 0),
      totalMoves: Object.values(stats).reduce((sum, s) => sum + (s.bestMoves || 0), 0),
    };
  }

  // ============================================================================
  // RESET
  // ============================================================================

  /**
   * Reset all progress
   * @param {boolean} confirm - Must be true to reset
   */
  resetAllProgress(confirm = false) {
    if (!confirm) {
      console.warn('Progress reset requires confirm=true');
      return false;
    }

    this._completedLevels = [];
    this._levelStats = {};
    this._achievements = [];

    try {
      localStorage.removeItem(STORAGE_KEYS.COMPLETED_LEVELS);
      localStorage.removeItem(STORAGE_KEYS.LEVEL_STATS);
      localStorage.removeItem(STORAGE_KEYS.ACHIEVEMENTS);
    } catch {
      // Ignore
    }

    this._emit('progress-reset');
    return true;
  }

  /**
   * Reset stats for a specific level
   * @param {number} levelId - Level ID
   */
  resetLevelStats(levelId) {
    const stats = this.loadLevelStats();
    delete stats[levelId];
    this.saveLevelStats(stats);
  }

  // ============================================================================
  // EVENTS
  // ============================================================================

  /**
   * Subscribe to progress events
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);

    return () => {
      this._listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Emit an event
   * @private
   */
  _emit(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(data);
        } catch (err) {
          console.error(`Error in progress event listener: ${err}`);
        }
      }
    }
  }

  // ============================================================================
  // TEST MODE
  // ============================================================================

  /**
   * Enable test mode (all levels unlocked)
   */
  enableTestMode() {
    this.testMode = true;
  }

  /**
   * Disable test mode
   */
  disableTestMode() {
    this.testMode = false;
  }
}

export const progressManager = new ProgressManager({
  testMode: false,
});

// Also export the class for testing or custom instances
export { ProgressManager };
