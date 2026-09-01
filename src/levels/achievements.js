// achievements.js — the player-facing catalogue for the awards ProgressManager
// has been recording all along.
//
// ProgressManager._checkAchievements has always granted and persisted these ids,
// and has always emitted them on 'level-completed'. Nothing ever rendered them,
// so the whole system was invisible: a player could hold five awards and never
// learn that any existed. This module is the missing vocabulary — id → label,
// description, and the glyph the card draws — so the ids stay the single source
// of truth in logic while the words live somewhere a designer can edit them.
//
// Pure data. No React, no storage, no imports.

/**
 * @typedef {Object} AchievementDef
 * @property {string} id       persisted identifier — never change a shipped one
 * @property {string} label    short name for the card
 * @property {string} description  how it is earned, in the player's terms
 * @property {string} glyph    a single character drawn on the card face
 * @property {'campaign'|'daily'} group
 */

/** @type {AchievementDef[]} */
export const ACHIEVEMENTS = [
  {
    id: 'first_steps',
    label: 'First Steps',
    description: 'Finish the opening chapter of the Topological Descent.',
    glyph: '◔',
    group: 'campaign'
  },
  {
    id: 'perfectionist',
    label: 'Perfectionist',
    description: 'Take all three stars on any level by matching its par.',
    glyph: '★',
    group: 'campaign'
  },
  {
    id: 'speed_demon',
    label: 'Speed Demon',
    description: 'Solve any level in under a minute.',
    glyph: '⏱',
    group: 'campaign'
  },
  {
    id: 'topology_master',
    label: 'Topology Master',
    description: 'Reach the end of the Topological Descent.',
    glyph: '∞',
    group: 'campaign'
  },
  {
    id: 'completionist',
    label: 'Completionist',
    description: 'Complete every chapter of the Topological Descent.',
    glyph: '◉',
    group: 'campaign'
  },
  {
    id: 'daily_first',
    label: 'Daily Descent',
    description: 'Solve your first Daily Descent.',
    glyph: '☀',
    group: 'daily'
  },
  {
    id: 'daily_streak_3',
    label: 'Three Running',
    description: 'Solve the Daily Descent three days in a row.',
    glyph: '❯',
    group: 'daily'
  },
  {
    id: 'daily_streak_7',
    label: 'Perfect Week',
    description: 'Solve the Daily Descent seven days in a row.',
    glyph: '❖',
    group: 'daily'
  },
  {
    id: 'daily_par',
    label: 'Exactly Par',
    description: 'Solve a Daily Descent in exactly par moves.',
    glyph: '⌾',
    group: 'daily'
  }
];

/** id → def, for the O(1) lookups the UI does per card. */
const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

/** Every catalogued id, in display order. */
export const ACHIEVEMENT_IDS = ACHIEVEMENTS.map((a) => a.id);

/**
 * The definition for an id, or a readable placeholder for one this build does
 * not know. Storage outlives the catalogue — a player who earned an award on a
 * later build and rolled back must not crash the grid or see a blank card.
 */
export function getAchievement(id) {
  return BY_ID.get(id) ?? {
    id,
    label: String(id).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    description: 'Earned in another version of the game.',
    glyph: '?',
    group: 'campaign'
  };
}

/** Is this a known, catalogued award? */
export function isKnownAchievement(id) {
  return BY_ID.has(id);
}

/**
 * The full catalogue decorated with whether each has been earned, in display
 * order, with any unknown earned ids appended so nothing a player holds is
 * silently dropped from the grid.
 */
export function decorateAchievements(earned = []) {
  const held = new Set(earned);
  const known = ACHIEVEMENTS.map((a) => ({ ...a, earned: held.has(a.id) }));
  const extras = earned
    .filter((id) => !BY_ID.has(id))
    .map((id) => ({ ...getAchievement(id), earned: true }));
  return [...known, ...extras];
}
