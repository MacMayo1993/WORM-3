/**
 * uiSurfaces.js — which surface owns the screen, and what Escape should close.
 *
 * Screen state in WORM³ is a bag of independent `show*` booleans spread across
 * the store and App's local state. Nothing makes them mutually exclusive, so
 * before this module every consumer that needed to know "is a menu up right
 * now?" had to re-list them by hand — and the global keyboard handler simply
 * never did, leaving W/A/S/D rotating the cube behind an open menu and arrow
 * keys stealing scroll from the settings panel.
 *
 * This is the read-side of that state: one ordered list of modal surfaces, with
 * selectors derived from it. Migrating the booleans themselves into a real
 * state machine can happen behind these selectors without touching call sites.
 *
 * Pure — no React, no store import — so the ordering is unit-testable.
 */

/**
 * Surfaces that OWN the screen while open: cube input must not reach past them,
 * and Escape should close the topmost one.
 *
 * Order is dismissal priority, innermost first. When two are somehow open at
 * once (nothing prevents it today) Escape closes the one nearest the player.
 * `flag` is the store key; `close` names the store action that dismisses it.
 */
export const MODAL_SURFACES = [
  { id: 'devConsole',        flag: 'showDevConsole',        close: (s) => s.setShowDevConsole(false) },
  { id: 'help',              flag: 'showHelp',              close: (s) => s.setShowHelp(false) },
  { id: 'settings',          flag: 'showSettings',          close: (s) => s.setShowSettings(false) },
  { id: 'levelTutorial',     flag: 'showLevelTutorial',     close: (s) => s.setShowLevelTutorial(false) },
  { id: 'firstFlipTutorial', flag: 'showFirstFlipTutorial', close: (s) => s.setShowFirstFlipTutorial(false) },
  { id: 'tutorial',          flag: 'showTutorial',          close: (s) => s.setShowTutorial(false) },
  { id: 'leaderboard',       flag: 'showLeaderboard',       close: (s) => s.setShowLeaderboard(false) },
  { id: 'netPanel',          flag: 'showNetPanel',          close: (s) => s.setShowNetPanel(false) },
  { id: 'packSelect',        flag: 'showPackSelect',        close: (s) => s.setShowPackSelect(false) },
  { id: 'levelSelect',       flag: 'showLevelSelect',       close: (s) => s.setShowLevelSelect(false) },
];

/**
 * Surfaces that block cube input but must NOT be dismissible with Escape —
 * either because they are the app's ground state (menu, welcome), because
 * escaping them would strand the player mid-flow (cutscene), or because they
 * demand an explicit decision (victory, death menu).
 */
export const BLOCKING_FLAGS = [
  'showWelcome',
  'showMainMenu',
  'showCutscene',
  'showDisparityWinner',
  'showWormDeathMenu',
];

/**
 * Panels that sit alongside live play and deliberately do NOT block cube input:
 * a player can leave the tile leaderboard or the net panel open and keep
 * turning. They are still Escape-dismissible (see MODAL_SURFACES) — being
 * closable is not the same as owning the screen.
 */
const AMBIENT_IDS = new Set(['leaderboard', 'netPanel']);

/**
 * The topmost modal surface currently open, or null.
 * @param {object} state - Zustand store state
 * @returns {{id: string, flag: string, close: Function}|null}
 */
export const selectTopSurface = (state) => MODAL_SURFACES.find((s) => state[s.flag]) ?? null;

/**
 * True when some surface owns the screen and raw cube input (rotation keys,
 * cursor movement, flips) must not reach the puzzle.
 *
 * `victory` counts: the win screen is a decision point, and turning the cube
 * underneath it would invalidate the result being celebrated.
 *
 * @param {object} state - Zustand store state
 * @returns {boolean}
 */
export const selectCubeInputBlocked = (state) => {
  if (state.victory) return true;
  if (BLOCKING_FLAGS.some((flag) => state[flag])) return true;
  return MODAL_SURFACES.some((s) => !AMBIENT_IDS.has(s.id) && state[s.flag]);
};
