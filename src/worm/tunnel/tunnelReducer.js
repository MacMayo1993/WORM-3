// src/worm/tunnel/tunnelReducer.js
// Reducer + initial state factory for WORM tunnel mode.
// All per-tick state transitions flow through here — one action per tick,
// deterministic and replay-friendly.

import { TUNNEL_CONFIG } from './useTunnelWormGame.js';

// Action type constants
export const TA = {
  // Lifecycle
  INIT: 'INIT',
  RESTART: 'RESTART',
  UPDATE_TUNNELS: 'UPDATE_TUNNELS',
  // UI controls
  PAUSE: 'PAUSE',
  RESUME: 'RESUME',
  SET_CAMERA: 'SET_CAMERA',
  // Tick events (one dispatched per movement step)
  STEP: 'STEP',                     // normal tunnel advance
  STEP_TUNNEL_EXIT: 'STEP_TUNNEL_EXIT', // worm exited a tunnel and entered the next
  STEP_EAT: 'STEP_EAT',             // worm ate an orb this step
  TICK_TIME: 'TICK_TIME',           // second boundary crossed, no movement step this frame
  // Terminal
  GAMEOVER: 'GAMEOVER',
  VICTORY: 'VICTORY',
};

/**
 * Returns a fresh initial tunnel game state.
 * Tunnels, worm, and orbs start empty — populated via INIT after first render.
 */
export function makeTunnelState() {
  return {
    gameState: 'playing',
    worm: [],
    orbs: [],
    tunnels: [],
    score: 0,
    tunnelsTraversed: 0,
    pendingGrowth: 0,
    orbInventory: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    timeAlive: 0,
    wormCameraEnabled: false,
    targetTunnelId: null,
    inactiveTunnelSides: new Set(),
    orbsTotal: TUNNEL_CONFIG.initialOrbs,
    mode: 'tunnel',
  };
}

/**
 * Pure reducer for tunnel game state.
 * Tick actions (STEP, STEP_TUNNEL_EXIT, STEP_EAT, TICK_TIME) carry a `payload`
 * object that is spread onto the current state.
 */
export function tunnelReducer(state, action) {
  switch (action.type) {
    case TA.INIT:
      return { ...state, tunnels: action.tunnels, worm: action.worm, orbs: action.orbs, targetTunnelId: action.targetTunnelId };

    case TA.RESTART:
      return action.state;

    case TA.UPDATE_TUNNELS:
      return {
        ...state,
        tunnels: action.tunnels,
        worm: action.worm,
        orbs: action.orbs,
        inactiveTunnelSides: new Set(),
      };

    case TA.PAUSE:
      return { ...state, gameState: 'paused' };

    case TA.RESUME:
      return { ...state, gameState: 'playing' };

    case TA.SET_CAMERA:
      return { ...state, wormCameraEnabled: action.enabled };

    case TA.GAMEOVER:
      return { ...state, gameState: 'gameover' };

    case TA.VICTORY:
      return { ...state, gameState: 'victory' };

    // All tick actions apply their payload as a partial state diff
    case TA.STEP:
    case TA.STEP_TUNNEL_EXIT:
    case TA.STEP_EAT:
    case TA.TICK_TIME:
      return { ...state, ...action.payload };

    default:
      return state;
  }
}
