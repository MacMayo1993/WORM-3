/**
 * WORM³ Level Schema Definitions
 *
 * This module defines the structure and constants for level definitions.
 * All levels must conform to these schemas.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Available game modes
 */
export const GAME_MODES = {
  CLASSIC: 'classic',      // Match all face colors
  SUDOKUBE: 'sudokube',    // Every number 1..size² once per face
  ULTIMATE: 'ultimate',    // Both color + sudoku constraints
};

/**
 * Available win conditions
 */
export const WIN_CONDITIONS = {
  CLASSIC: 'classic',
  SUDOKUBE: 'sudokube',
  ULTIMATE: 'ultimate',
  // Solved up to antipodal identification — the RP² quotient notion of solved.
  // Every face uniform *in its antipodal class*, so the all-flipped board (every
  // sticker showing its antipode) counts as a solve alongside the literal one.
  //
  // This is what makes the polarity choice of C_dir = n_A + min(n11, P − n11)
  // playable: the formula's `P − n11` branch IS the all-dirty target, and a level
  // scored against that par is unfair under CLASSIC, which only ever accepts the
  // all-clean branch. Levels that want the choice must opt in here.
  ANTIPODAL: 'antipodal',
};

/**
 * Available background environments
 */
/**
 * Level id ranges, one block per pack.
 *
 * ProgressManager stores completion as a flat array of numeric level ids and
 * stats in an object keyed by the same, with no pack qualifier. So ids must be
 * unique ACROSS packs, not just within one — Cube Academy originally reused
 * 1-6 alongside Story's 1-10, which meant beating Story chapter 3 also marked
 * Academy lesson 3 complete. Nothing surfaced it only because Academy had no
 * entry point. A new pack takes the next free hundred.
 */
export const LEVEL_ID_RANGES = {
  'story-campaign': [1, 99],
  'cube-academy': [101, 199],
  'algorithm-codex': [201, 299],
  // 301–399 is reserved for the standalone antipodal-descent builder
  // (antipodalLevelBridge). That pack is not registered by default — the
  // Topological Descent it generates is Story mode itself — so it is intentionally
  // omitted from this map, which only lists registered packs.
  //
  // 401–499 is likewise reserved, for the Daily Descent (levels/dailyChallenge.js).
  // It holds one live id at a time: the daily pack is rebuilt and re-registered
  // whenever the calendar date turns over, so a single id carries a different
  // puzzle each day. Like the band above it is registered at runtime rather than
  // shipped in BUILT_IN_PACKS, so it stays out of this map too.
};

export const BACKGROUNDS = {
  DAYCARE: 'daycare',
  ELEMENTARY: 'elementary',
  MIDDLESCHOOL: 'middleschool',
  HIGHSCHOOL: 'highschool',
  COLLEGE: 'college',
  JOB: 'job',
  NASA: 'nasa',
  ROCKET: 'rocket',
  MOON: 'moon',
  BLACKHOLE: 'blackhole',
  // Extensible for custom backgrounds
  SPACE: 'space',
  FOREST: 'forest',
  OCEAN: 'ocean',
  CITY: 'city',
  ABSTRACT: 'abstract',
};

/**
 * Difficulty ratings
 */
export const DIFFICULTY = {
  TUTORIAL: 'tutorial',
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
  EXPERT: 'expert',
  MASTER: 'master',
};

/**
 * Level categories/tags
 */
export const LEVEL_TAGS = {
  STORY: 'story',
  TUTORIAL: 'tutorial',
  CHALLENGE: 'challenge',
  SPEEDRUN: 'speedrun',
  PUZZLE: 'puzzle',
  BONUS: 'bonus',
  COMMUNITY: 'community',
};

// ============================================================================
// FEATURE FLAGS
// ============================================================================

/**
 * Default feature flags - all disabled
 */
export const DEFAULT_FEATURES = {
  rotations: true,   // Basic rotation (always on)
  tunnels: false,    // Wormhole visualization
  flips: false,      // Antipodal flip mechanic
  chaos: false,      // Chaos cascade system
  explode: false,    // Explode view
  parity: false,     // Parity indicators
  net: false,        // Net/unfolded view
};

/**
 * Feature unlock order (for progressive unlocking)
 */
export const FEATURE_UNLOCK_ORDER = [
  'rotations',
  'tunnels',
  'flips',
  'chaos',
  'parity',
  'explode',
  'net',
];

/**
 * Feature display names for UI
 */
export const FEATURE_NAMES = {
  rotations: 'Rotations',
  tunnels: 'Wormhole Tunnels (T)',
  flips: 'Antipodal Flip (Click)',
  chaos: 'Disparity Mode',
  explode: 'Explode View (X)',
  parity: 'Parity Indicators',
  net: 'Net View (N)',
};

// ============================================================================
// LEVEL STRUCTURE
// ============================================================================

/**
 * Create a level definition with defaults
 * @param {Partial<LevelDefinition>} overrides - Level properties to override
 * @returns {LevelDefinition} Complete level definition
 */
export function createLevel(overrides) {
  return {
    // Required fields (must be provided)
    id: overrides.id,
    name: overrides.name || `Level ${overrides.id}`,
    description: overrides.description || '',

    // Gameplay settings
    cubeSize: overrides.cubeSize || 3,
    chaosLevel: overrides.chaosLevel || 0,
    mode: overrides.mode || GAME_MODES.CLASSIC,
    // Scramble depth for this level. null = let the shuffler fall back to its
    // default count (so freeplay/legacy levels keep their old behavior).
    scrambleMoves: overrides.scrambleMoves ?? null,
    // Optional deterministic scramble. When set, the shuffler applies exactly
    // these moves instead of a random scramble — used for hand-authored
    // teaching levels (e.g. "undo this one middle-layer turn"). Each entry is
    // { axis: 'row'|'col'|'depth', sliceIndex: number, dir: 1|-1 }.
    scrambleSequence: overrides.scrambleSequence ?? null,
    // Optional deterministic antipodal flips applied AFTER the scramble, to author
    // flip-teaching puzzles (e.g. "every center shows its antipodal twin — flip them
    // back"). Each entry { x, y, z, dirKey } is flipped via flipStickerPair, which also
    // flips that sticker's antipodal partner — so listing one sticker per antipodal pair
    // is enough. null = no setup flips.
    flipSequence: overrides.flipSequence ?? null,

    // Golf-style "par" — the number of player actions in the intended solution:
    // reverse each authored scramble turn (one move) and undo each authored flip
    // (one tap). Used for Story-mode star scoring. An explicit override wins;
    // otherwise it is derived from the authored sequences. null = no par (the
    // level is graded by the cube-size heuristic instead).
    par: overrides.par ?? (((overrides.scrambleSequence?.length || 0) + (overrides.flipSequence?.length || 0)) || null),

    // The named algorithm this level teaches, for levels built around one:
    // { notation: "R U R' U'", quarterTurns: 4 }. The level is scrambled by the
    // inverse of `notation`, so performing it solves the level and par equals
    // quarterTurns. null for levels that are not algorithm lessons.
    algorithm: overrides.algorithm ?? null,

    // Visual settings
    background: overrides.background || BACKGROUNDS.ABSTRACT,

    // Feature flags (merge with defaults)
    features: {
      ...DEFAULT_FEATURES,
      ...(overrides.features || {}),
    },

    // Tutorial content
    tutorial: {
      title: overrides.tutorial?.title || overrides.name || `Level ${overrides.id}`,
      text: overrides.tutorial?.text || '',
      // A concise, persistent in-play instruction. Unlike the briefing copy,
      // this should describe the next concrete action the player can take.
      objective: overrides.tutorial?.objective || '',
      tip: overrides.tutorial?.tip || '',
      // Optional hand-authored Mobi dialogue lines for the level briefing.
      // When omitted, the level screen derives lines from text/tip.
      mobiLines: overrides.tutorial?.mobiLines || null,
    },

    // Win conditions
    winCondition: overrides.winCondition || WIN_CONDITIONS.CLASSIC,
    winMessage: overrides.winMessage || 'Level Complete!',

    // Story/cutscene
    cutsceneText: overrides.cutsceneText || '',
    hasCutscene: overrides.hasCutscene || false,

    // Metadata
    difficulty: overrides.difficulty || DIFFICULTY.MEDIUM,
    tags: overrides.tags || [],
    author: overrides.author || 'WORM³ Team',
    version: overrides.version || '1.0.0',

    // Optional constraints
    timeLimit: overrides.timeLimit || null,  // In seconds, null = no limit
    moveLimit: overrides.moveLimit || null,  // Max moves, null = no limit

    // Unlock requirements
    requirements: overrides.requirements || {
      previousLevel: overrides.id > 1 ? overrides.id - 1 : null,
      stars: 0,
      achievements: [],
    },
  };
}

/**
 * Level pack metadata structure
 */
export function createLevelPack(overrides) {
  return {
    id: overrides.id,
    name: overrides.name || 'Unnamed Pack',
    description: overrides.description || '',
    author: overrides.author || 'WORM³ Team',
    version: overrides.version || '1.0.0',
    levels: overrides.levels || [],

    // Pack metadata
    difficulty: overrides.difficulty || DIFFICULTY.MEDIUM,
    tags: overrides.tags || [],
    thumbnail: overrides.thumbnail || null,

    // Unlock requirements
    requirements: overrides.requirements || {
      completedPacks: [],
      totalStars: 0,
    },
  };
}

// ============================================================================
// TYPE DEFINITIONS (JSDoc for IDE support)
// ============================================================================

/**
 * @typedef {Object} Features
 * @property {boolean} rotations - Basic rotation enabled
 * @property {boolean} tunnels - Wormhole visualization
 * @property {boolean} flips - Antipodal flip mechanic
 * @property {boolean} chaos - Chaos cascade system
 * @property {boolean} explode - Explode view
 * @property {boolean} parity - Parity indicators
 * @property {boolean} net - Net/unfolded view
 */

/**
 * @typedef {Object} Tutorial
 * @property {string} title - Tutorial title
 * @property {string} text - Main tutorial text
 * @property {string} objective - Persistent in-play objective
 * @property {string} tip - Helpful tip
 * @property {string[]|null} mobiLines - Optional Mobi dialogue lines for the briefing
 */

/**
 * @typedef {Object} Requirements
 * @property {number|null} previousLevel - Previous level ID required
 * @property {number} stars - Minimum stars required
 * @property {string[]} achievements - Required achievement IDs
 */

/**
 * @typedef {Object} LevelDefinition
 * @property {number} id - Unique level ID
 * @property {string} name - Display name
 * @property {string} description - Short description
 * @property {number} cubeSize - Cube dimension (2-5)
 * @property {number|null} scrambleMoves - Scramble depth (null = shuffler default)
 * @property {Array<{axis:string,sliceIndex:number,dir:number}>|null} scrambleSequence - Deterministic scramble moves (null = random)
 * @property {Array<{x:number,y:number,z:number,dirKey:string}>|null} flipSequence - Deterministic antipodal flips applied after the scramble (null = none)
 * @property {number} chaosLevel - Chaos intensity (0-4)
 * @property {string} mode - Game mode
 * @property {string} background - Background environment
 * @property {Features} features - Enabled features
 * @property {Tutorial} tutorial - Tutorial content
 * @property {string} winCondition - Win condition type
 * @property {string} winMessage - Victory message
 * @property {string} cutsceneText - Story cutscene text
 * @property {boolean} hasCutscene - Whether to show cutscene
 * @property {string} difficulty - Difficulty rating
 * @property {string[]} tags - Level tags
 * @property {string} author - Level author
 * @property {string} version - Level version
 * @property {number|null} timeLimit - Time limit in seconds
 * @property {number|null} moveLimit - Move limit
 * @property {Requirements} requirements - Unlock requirements
 */

/**
 * @typedef {Object} LevelPack
 * @property {string} id - Unique pack ID
 * @property {string} name - Pack name
 * @property {string} description - Pack description
 * @property {string} author - Pack author
 * @property {string} version - Pack version
 * @property {LevelDefinition[]} levels - Levels in pack
 * @property {string} difficulty - Overall difficulty
 * @property {string[]} tags - Pack tags
 * @property {string|null} thumbnail - Thumbnail image URL
 * @property {Object} requirements - Unlock requirements
 */
