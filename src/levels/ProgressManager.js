/**
 * WORM³ Progress Manager
 *
 * Handles all progress-related operations: save/load, completion tracking,
 * star ratings, achievements, and unlock logic.
 */

import { levelsManager } from './LevelsManager.js';
import { computeStars } from './scoring.js';
import { starsForMoves } from './antipodalRandomizer.js';
import {
  DAILY_STORAGE_KEY, emptyDailyRecord, advanceStreak, isDailyDone, currentStreak,
} from './dailyChallenge.js';
import { UNLOCK_ALL } from '../utils/testUnlock.js';

// Storage keys
const STORAGE_KEYS = {
  COMPLETED_LEVELS: 'worm3_completed_levels',
  LEVEL_STATS: 'worm3_level_stats',
  ACHIEVEMENTS: 'worm3_achievements',
  SETTINGS: 'worm3_progress_settings',
  // The Daily Descent keeps its own record rather than joining the flat
  // completed-levels array: "done" for a daily means "done today", which a
  // set of level ids cannot express (see levels/dailyChallenge.js).
  DAILY: DAILY_STORAGE_KEY,
  // One-time Parity Point awards that have no natural counter — a first
  // Freeplay solve at a cube size, an algorithm run to the end, a Möbius loop.
  // This ledger is what stops them being farmed (see levels/rewards.js).
  MILESTONES: 'worm3_earned_milestones',
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
    this._dailyRecord = null;
    this._milestones = null;

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

  /**
   * Load the Daily Descent record (streak, best, total, last result).
   * @returns {Object} always a complete record — never null
   */
  loadDailyRecord() {
    if (this._dailyRecord !== null) {
      return { ...this._dailyRecord };
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DAILY);
      const parsed = saved ? JSON.parse(saved) : null;
      // Merged onto the empty shape so a record written by an older build (or a
      // hand-edited one) still has every field the UI reads.
      this._dailyRecord = parsed && typeof parsed === 'object'
        ? { ...emptyDailyRecord(), ...parsed }
        : emptyDailyRecord();
    } catch {
      this._dailyRecord = emptyDailyRecord();
    }

    return { ...this._dailyRecord };
  }

  /**
   * Load the claimed one-time award keys.
   * @returns {string[]}
   */
  loadMilestones() {
    if (this._milestones !== null) {
      return [...this._milestones];
    }

    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MILESTONES);
      const parsed = saved ? JSON.parse(saved) : [];
      // A corrupted ledger must fail CLOSED-ish: an empty list lets a player
      // re-earn awards, which is far better than throwing on every level end.
      this._milestones = Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : [];
    } catch {
      this._milestones = [];
    }

    return [...this._milestones];
  }

  /** Has this one-time award already been paid? */
  hasMilestone(key) {
    return this.loadMilestones().includes(key);
  }

  /**
   * Claim a one-time award.
   * @param {string} key
   * @returns {boolean} true only on the FIRST claim — the caller pays on true
   */
  claimMilestone(key) {
    if (typeof key !== 'string' || !key) return false;

    const claimed = this.loadMilestones();
    if (claimed.includes(key)) return false;

    const next = [...claimed, key];
    this._milestones = next;

    if (this.autoSave) {
      try {
        localStorage.setItem(STORAGE_KEYS.MILESTONES, JSON.stringify(next));
      } catch {
        // Ignore storage errors — the in-memory ledger still prevents a
        // double-award inside this session.
      }
    }

    this._emit('milestone-claimed', { key });
    return true;
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

  /**
   * Persist the Daily Descent record.
   * @param {Object} record
   */
  saveDailyRecord(record) {
    this._dailyRecord = { ...record };

    if (this.autoSave) {
      try {
        localStorage.setItem(STORAGE_KEYS.DAILY, JSON.stringify(this._dailyRecord));
      } catch {
        // Ignore storage errors
      }
    }

    this._emit('daily-updated', { record: { ...this._dailyRecord } });
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
    return computeStars(levelsManager.getLevel(levelId), stats);
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

    // Final story level completed
    if (levelId === levelsManager.getLastLevel()?.id && isFirstCompletion && !achievements.includes('topology_master')) {
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

  /**
   * Grant `ids` that are not already held, persisting only if any are new.
   * @private
   * @returns {string[]} the ids actually newly granted
   */
  _awardAchievements(ids) {
    const held = this.loadAchievements();
    const fresh = [...new Set(ids)].filter((id) => !held.includes(id));
    if (fresh.length > 0) this.saveAchievements([...held, ...fresh]);
    return fresh;
  }

  // ============================================================================
  // DAILY DESCENT
  // ============================================================================

  /**
   * Has today's Daily Descent already been solved?
   * @param {string} dateKey - 'YYYY-MM-DD' (see dailyChallenge.dailyKeyFor)
   */
  isDailyComplete(dateKey) {
    return isDailyDone(this.loadDailyRecord(), dateKey);
  }

  /**
   * The streak as it stands on `dateKey` — 0 once a run has lapsed, so the UI
   * never advertises a streak that the next solve would reset.
   * @param {string} dateKey
   */
  getDailyStreak(dateKey) {
    return currentStreak(this.loadDailyRecord(), dateKey);
  }

  /**
   * Record a Daily Descent solve.
   *
   * Deliberately NOT routed through completeLevel: the daily reuses one level id
   * for a different puzzle every day, so a flat "completed" flag and best-moves
   * stats keyed on that id would be meaningless (yesterday's 6 moves are not
   * comparable to today's par-9 draw). Replaying the same day is a no-op on the
   * streak but still refreshes the day's best result.
   *
   * @param {string} dateKey - 'YYYY-MM-DD'
   * @param {{ par: number, moves?: number, time?: number }} result
   * @returns {{ record, stars, isFirstToday, streak, newAchievements }}
   */
  completeDailyChallenge(dateKey, result = {}) {
    const previous = this.loadDailyRecord();
    const isFirstToday = !isDailyDone(previous, dateKey);

    const par = Number.isFinite(result.par) ? result.par : null;
    const moves = Number.isFinite(result.moves) ? result.moves : null;
    // Golf scoring against the day's exact analytic par. Falls back to one star
    // for a completion we cannot measure, matching computeStars' own floor.
    const stars = par != null && moves != null ? starsForMoves(par, moves) : 1;

    const advanced = advanceStreak(previous, dateKey);
    const record = {
      ...advanced,
      lastPar: par,
      // Keep the day's BEST result when the same day is replayed.
      lastMoves: !isFirstToday && previous.lastMoves != null && moves != null
        ? Math.min(previous.lastMoves, moves)
        : moves,
      lastStars: isFirstToday ? stars : Math.max(previous.lastStars ?? 0, stars),
    };

    this.saveDailyRecord(record);

    const earned = ['daily_first'];
    if (record.current >= 3) earned.push('daily_streak_3');
    if (record.current >= 7) earned.push('daily_streak_7');
    if (par != null && moves != null && moves <= par) earned.push('daily_par');
    const newAchievements = this._awardAchievements(earned);

    this._emit('daily-completed', { dateKey, record, stars, isFirstToday, newAchievements });

    return { record, stars, isFirstToday, streak: record.current, newAchievements };
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
    // The daily streak is progress too — leaving it behind would let a reset
    // player keep a run they can no longer see the history of.
    this._dailyRecord = emptyDailyRecord();
    // Clearing the ledger deliberately makes the one-time awards earnable again:
    // a reset player has to replay the levels, so they should be paid for it.
    this._milestones = [];

    try {
      localStorage.removeItem(STORAGE_KEYS.COMPLETED_LEVELS);
      localStorage.removeItem(STORAGE_KEYS.LEVEL_STATS);
      localStorage.removeItem(STORAGE_KEYS.ACHIEVEMENTS);
      localStorage.removeItem(STORAGE_KEYS.DAILY);
      localStorage.removeItem(STORAGE_KEYS.MILESTONES);
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

// Dev/preview builds unlock the whole campaign so every level can be opened
// without grinding up to it — the same bargain useGameStore strikes for the
// store economy (DEV_FREE_ECONOMY). A deployed build keeps real progression
// unless this browser opted in with ?unlockall=1, since testMode bypasses every
// unlock requirement and must not be on for players who did not ask for it.
export const progressManager = new ProgressManager({
  testMode: !!import.meta.env?.DEV || UNLOCK_ALL,
});

// Also export the class for testing or custom instances
export { ProgressManager };
