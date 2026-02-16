/**
 * WORM³ Level Validation
 *
 * Utilities for validating level definitions and level packs.
 * Ensures levels conform to the expected schema.
 */

import { GAME_MODES, WIN_CONDITIONS, BACKGROUNDS, DIFFICULTY, LEVEL_TAGS } from './schema.js';

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string[]} errors - List of error messages
 * @property {string[]} warnings - List of warning messages
 */

/**
 * Validate a level definition
 * @param {Object} level - Level to validate
 * @returns {ValidationResult}
 */
export function validateLevel(level) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (typeof level.id !== 'number' || level.id < 1) {
    errors.push('Level must have a positive numeric ID');
  }

  if (!level.name || typeof level.name !== 'string') {
    errors.push('Level must have a name');
  }

  // Cube size validation
  if (typeof level.cubeSize !== 'number' || level.cubeSize < 2 || level.cubeSize > 10) {
    errors.push('Cube size must be between 2 and 10');
  }

  // Chaos level validation
  if (typeof level.chaosLevel !== 'number' || level.chaosLevel < 0 || level.chaosLevel > 10) {
    errors.push('Chaos level must be between 0 and 10');
  }

  // Mode validation
  const validModes = Object.values(GAME_MODES);
  if (!validModes.includes(level.mode)) {
    errors.push(`Invalid mode "${level.mode}". Valid modes: ${validModes.join(', ')}`);
  }

  // Background validation
  const validBackgrounds = Object.values(BACKGROUNDS);
  if (level.background && !validBackgrounds.includes(level.background)) {
    warnings.push(`Unknown background "${level.background}". Consider using: ${validBackgrounds.join(', ')}`);
  }

  // Win condition validation
  const validWinConditions = Object.values(WIN_CONDITIONS);
  if (!validWinConditions.includes(level.winCondition)) {
    errors.push(`Invalid win condition "${level.winCondition}". Valid conditions: ${validWinConditions.join(', ')}`);
  }

  // Mode and win condition consistency
  if (level.mode === GAME_MODES.SUDOKUBE && level.winCondition !== WIN_CONDITIONS.SUDOKUBE) {
    warnings.push('Sudokube mode typically uses sudokube win condition');
  }
  if (level.mode === GAME_MODES.ULTIMATE && level.winCondition !== WIN_CONDITIONS.ULTIMATE) {
    warnings.push('Ultimate mode typically uses ultimate win condition');
  }

  // Features validation
  if (!level.features || typeof level.features !== 'object') {
    errors.push('Level must have a features object');
  } else {
    // Check feature types
    const featureKeys = ['rotations', 'tunnels', 'flips', 'chaos', 'explode', 'parity', 'net'];
    for (const key of featureKeys) {
      if (typeof level.features[key] !== 'boolean') {
        warnings.push(`Feature "${key}" should be a boolean`);
      }
    }

    // Chaos feature should match chaos level
    if (level.chaosLevel > 0 && !level.features.chaos) {
      warnings.push('Chaos level > 0 but chaos feature is disabled');
    }
  }

  // Tutorial validation
  if (!level.tutorial || typeof level.tutorial !== 'object') {
    warnings.push('Level should have a tutorial object');
  } else {
    if (!level.tutorial.title) {
      warnings.push('Tutorial should have a title');
    }
    if (!level.tutorial.text) {
      warnings.push('Tutorial should have text');
    }
  }

  // Difficulty validation
  const validDifficulties = Object.values(DIFFICULTY);
  if (level.difficulty && !validDifficulties.includes(level.difficulty)) {
    warnings.push(`Unknown difficulty "${level.difficulty}". Valid difficulties: ${validDifficulties.join(', ')}`);
  }

  // Tags validation
  if (level.tags && Array.isArray(level.tags)) {
    const validTags = Object.values(LEVEL_TAGS);
    for (const tag of level.tags) {
      if (!validTags.includes(tag)) {
        warnings.push(`Unknown tag "${tag}". Valid tags: ${validTags.join(', ')}`);
      }
    }
  }

  // Time/move limits
  if (level.timeLimit !== null && level.timeLimit !== undefined) {
    if (typeof level.timeLimit !== 'number' || level.timeLimit <= 0) {
      errors.push('Time limit must be a positive number');
    }
  }

  if (level.moveLimit !== null && level.moveLimit !== undefined) {
    if (typeof level.moveLimit !== 'number' || level.moveLimit <= 0) {
      errors.push('Move limit must be a positive number');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a level pack
 * @param {Object} pack - Level pack to validate
 * @returns {ValidationResult}
 */
export function validateLevelPack(pack) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!pack.id || typeof pack.id !== 'string') {
    errors.push('Pack must have a string ID');
  }

  if (!pack.name || typeof pack.name !== 'string') {
    errors.push('Pack must have a name');
  }

  // Levels array
  if (!Array.isArray(pack.levels) || pack.levels.length === 0) {
    errors.push('Pack must have at least one level');
  } else {
    // Validate each level
    const levelIds = new Set();
    for (let i = 0; i < pack.levels.length; i++) {
      const level = pack.levels[i];
      const result = validateLevel(level);

      if (!result.valid) {
        errors.push(`Level ${i + 1} (${level.name || 'unnamed'}): ${result.errors.join(', ')}`);
      }

      if (result.warnings.length > 0) {
        warnings.push(`Level ${i + 1} (${level.name || 'unnamed'}): ${result.warnings.join(', ')}`);
      }

      // Check for duplicate IDs
      if (levelIds.has(level.id)) {
        errors.push(`Duplicate level ID: ${level.id}`);
      }
      levelIds.add(level.id);
    }

    // Check level ordering
    const ids = pack.levels.map(l => l.id);
    const sortedIds = [...ids].sort((a, b) => a - b);
    if (JSON.stringify(ids) !== JSON.stringify(sortedIds)) {
      warnings.push('Levels are not in ascending order by ID');
    }
  }

  // Version format
  if (pack.version && !/^\d+\.\d+\.\d+$/.test(pack.version)) {
    warnings.push('Version should follow semver format (e.g., 1.0.0)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate all built-in levels
 * @param {LevelDefinition[]} levels - Array of levels to validate
 * @returns {ValidationResult}
 */
export function validateAllLevels(levels) {
  const errors = [];
  const warnings = [];

  for (const level of levels) {
    const result = validateLevel(level);
    if (!result.valid) {
      errors.push(`Level ${level.id} (${level.name}): ${result.errors.join(', ')}`);
    }
    if (result.warnings.length > 0) {
      warnings.push(`Level ${level.id} (${level.name}): ${result.warnings.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Print validation report to console
 * @param {ValidationResult} result
 * @param {string} name - Name of what was validated
 */
export function printValidationReport(result, name = 'Level') {
  console.group(`Validation Report: ${name}`);

  if (result.valid) {
    console.log('%c PASS ', 'background: green; color: white; font-weight: bold');
  } else {
    console.log('%c FAIL ', 'background: red; color: white; font-weight: bold');
  }

  if (result.errors.length > 0) {
    console.group('Errors:');
    result.errors.forEach(e => console.error(`  - ${e}`));
    console.groupEnd();
  }

  if (result.warnings.length > 0) {
    console.group('Warnings:');
    result.warnings.forEach(w => console.warn(`  - ${w}`));
    console.groupEnd();
  }

  console.groupEnd();
}
