// src/worm/surface/surfaceReducer.js
// Reducer + initial state factory for WORM surface mode.
// All per-tick state transitions flow through here — one action per tick,
// deterministic and replay-friendly.

import { CONFIG } from './useSurfaceWormGame.js';

// Action type constants
export const SA = {
  // Lifecycle
  INIT: 'INIT',       // First-mount init: sets worm + orbs together (single dispatch, like tunnel mode)
  RESTART: 'RESTART',
  // UI controls
  PAUSE: 'PAUSE',
  RESUME: 'RESUME',
  SET_CAMERA: 'SET_CAMERA',
  SET_MOVE_DIR: 'SET_MOVE_DIR',
  UPDATE_AFTER_ROTATION: 'UPDATE_AFTER_ROTATION',
  // Tick events (one dispatched per movement step)
  STEP: 'STEP',           // normal movement, no special event
  STEP_WARP: 'STEP_WARP', // movement + antipodal warp
  STEP_EAT: 'STEP_EAT',  // movement + orb eaten (may coincide with warp)
  HEAL: 'HEAL',           // sticker healed this step (score-only; cubies written externally)
  TICK_TIME: 'TICK_TIME', // second boundary crossed, no movement step this frame
  // Terminal
  GAMEOVER: 'GAMEOVER',
  VICTORY: 'VICTORY',
};

/**
 * Returns a blank surface game state.
 * `worm` and `orbs` start empty — populated via SA.INIT after first render
 * (matching the tunnel mode single-dispatch init pattern).
 */
export function makeSurfaceState() {
  return {
    gameState: 'playing',
    worm: [],
    moveDir: 'up',
    orbs: [],
    score: 0,
    warps: 0,
    pendingGrowth: 0,
    orbInventory: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    timeAlive: 0,
    wormCameraEnabled: false,
    orbsTotal: CONFIG.initialOrbs,
  };
}

/**
 * Pure reducer for surface game state.
 * Tick actions (STEP, STEP_WARP, STEP_EAT, HEAL, TICK_TIME) carry a `payload`
 * object that is spread onto the current state — only changed fields need to be
 * included, keeping action objects small.
 */
export function surfaceReducer(state, action) {
  switch (action.type) {
    case SA.INIT:
      return { ...makeSurfaceState(), worm: action.worm, orbs: action.orbs };

    case SA.RESTART:
      // Caller provides the complete pre-computed fresh state
      return action.state;

    case SA.PAUSE:
      return { ...state, gameState: 'paused' };

    case SA.RESUME:
      return { ...state, gameState: 'playing' };

    case SA.SET_CAMERA:
      return { ...state, wormCameraEnabled: action.enabled };

    case SA.SET_MOVE_DIR:
      return { ...state, moveDir: action.moveDir };

    case SA.UPDATE_AFTER_ROTATION:
      return { ...state, worm: action.worm, orbs: action.orbs };

    case SA.GAMEOVER:
      return { ...state, gameState: 'gameover' };

    case SA.VICTORY:
      return { ...state, gameState: 'victory' };

    // All tick actions apply their payload as a partial state diff
    case SA.STEP:
    case SA.STEP_WARP:
    case SA.STEP_EAT:
    case SA.HEAL:
    case SA.TICK_TIME:
      return { ...state, ...action.payload };

    default:
      return state;
  }
}
