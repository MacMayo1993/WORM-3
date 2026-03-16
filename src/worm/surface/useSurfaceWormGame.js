// src/worm/surface/useSurfaceWormGame.js
// Custom hook for WORM surface-mode game logic.
// Uses a single useReducer (surfaceReducer) so all game state transitions are
// deterministic and traceable. A stateRef is kept in sync every render so that
// the game loop (SurfaceWormGameLoop) can always read the latest state without
// stale-closure bugs.

import { useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  createInitialWorm,
  turnWorm,
  spawnOrbs,
  updateWormAfterRotation,
} from '../wormLogic.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { resolveColors } from '../../utils/colorSchemes.js';
import { surfaceReducer, makeSurfaceState, SA } from './surfaceReducer.js';

export const CONFIG = {
  initialOrbs: 22,       // Starting number of orbs
  baseSpeed: 1.2,        // Base tiles per second
  speedIncrement: 0.05,  // Speed increase per segment
  maxSpeed: 3.0,         // Maximum speed
  growthPerOrb: 1,       // Segments gained per orb
  warpBonus: 25,         // Score bonus per warp
  healBonus: 75,         // Score bonus per healed wormhole tile
};

export function useWormGame(cubies, size, animState, onRotate) {
  const settings = useGameStore(s => s.settings);
  const faceColors = useMemo(() => resolveColors(settings), [settings]);

  // ── Single reducer for all game state ──────────────────────────────────────
  const [state, dispatch] = useReducer(surfaceReducer, null, () => makeSurfaceState(size));

  // stateRef — always reflects the latest state so the game loop reads fresh values
  const stateRef = useRef(state);
  stateRef.current = state;

  // Mutable refs (timing + growth queues — not rendered, so not in state)
  const lastMoveTime = useRef(0);
  const rotationQueue = useRef([]);
  const timeAliveAcc = useRef(0);
  const pendingGrowthColorsRef = useRef([]);
  const lastOrbColorRef = useRef(null);

  // Derived: current speed (used by HUD + game loop)
  const speed = useMemo(() => {
    const s = CONFIG.baseSpeed + (state.worm.length * CONFIG.speedIncrement);
    return Math.min(s, CONFIG.maxSpeed);
  }, [state.worm.length]);

  // Initialize orbs on mount only
  useEffect(() => {
    const initialOrbs = spawnOrbs(cubies, size, CONFIG.initialOrbs, stateRef.current.worm, [], faceColors);
    dispatch({ type: SA.INIT_ORBS, orbs: initialOrbs });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restart handler
  const restart = useCallback(() => {
    const newWorm = createInitialWorm(size);
    const newOrbs = spawnOrbs(cubies, size, CONFIG.initialOrbs, newWorm, [], faceColors);
    dispatch({
      type: SA.RESTART,
      state: { ...makeSurfaceState(size), worm: newWorm, orbs: newOrbs },
    });
    pendingGrowthColorsRef.current = [];
    lastOrbColorRef.current = null;
    lastMoveTime.current = 0;
    timeAliveAcc.current = 0;
    rotationQueue.current = [];
  }, [cubies, size, faceColors]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      const { gameState } = stateRef.current;

      if (gameState === 'gameover' || gameState === 'victory') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          restart();
        }
        return;
      }

      const key = e.key.toLowerCase();

      if (key === ' ' || key === 'escape' || key === 'p') {
        e.preventDefault();
        if (gameState === 'playing') dispatch({ type: SA.PAUSE });
        else if (gameState === 'paused') dispatch({ type: SA.RESUME });
        return;
      }

      if (gameState !== 'playing') return;

      const queueRotation = (axis, dir, sliceIndex) => {
        if (rotationQueue.current.length < 2) {
          rotationQueue.current.push({ axis, dir, sliceIndex });
        }
      };

      const head = stateRef.current.worm[0];
      if (!head) return;

      switch (key) {
        case 'w': e.preventDefault(); queueRotation('col', -1, head.x); break;
        case 's': e.preventDefault(); queueRotation('col', 1, head.x); break;
        case 'a': e.preventDefault(); queueRotation('row', -1, head.y); break;
        case 'd': e.preventDefault(); queueRotation('row', 1, head.y); break;
        case 'q': e.preventDefault(); queueRotation('depth', 1, head.z); break;
        case 'e': e.preventDefault(); queueRotation('depth', -1, head.z); break;
        case 'arrowleft':
          e.preventDefault();
          dispatch({ type: SA.SET_MOVE_DIR, moveDir: turnWorm(stateRef.current.moveDir, 'left') });
          break;
        case 'arrowright':
          e.preventDefault();
          dispatch({ type: SA.SET_MOVE_DIR, moveDir: turnWorm(stateRef.current.moveDir, 'right') });
          break;
        case 'c':
          e.preventDefault();
          dispatch({ type: SA.SET_CAMERA, enabled: !stateRef.current.wormCameraEnabled });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [restart]); // all state accessed via stateRef — no stale-closure risk

  // Process rotation queue
  useEffect(() => {
    if (animState) return;
    if (rotationQueue.current.length === 0) return;
    if (stateRef.current.gameState !== 'playing') return;

    const rotation = rotationQueue.current.shift();
    if (rotation && onRotate) {
      onRotate(rotation.axis, rotation.dir, rotation.sliceIndex);
    }
  }, [animState, onRotate]);

  // Update worm + orbs after cube rotation
  const updateAfterRotation = useCallback((axis, sliceIndex, dir) => {
    const { worm, orbs } = stateRef.current;
    const newWorm = updateWormAfterRotation(worm, axis, sliceIndex, dir, size);
    const newOrbs = orbs.map(orb => {
      const updated = updateWormAfterRotation([orb], axis, sliceIndex, dir, size);
      return updated[0];
    });
    dispatch({ type: SA.UPDATE_AFTER_ROTATION, worm: newWorm, orbs: newOrbs });
  }, [size]);

  // ── Convenience setters (dispatch wrappers) — preserve backward-compat API ─
  const setGameState = useCallback((gs) => {
    if (gs === 'paused') dispatch({ type: SA.PAUSE });
    else if (gs === 'playing') dispatch({ type: SA.RESUME });
    else if (gs === 'gameover') dispatch({ type: SA.GAMEOVER });
    else if (gs === 'victory') dispatch({ type: SA.VICTORY });
  }, []);

  const setWormCameraEnabled = useCallback((val) => {
    const enabled = typeof val === 'function' ? val(stateRef.current.wormCameraEnabled) : val;
    dispatch({ type: SA.SET_CAMERA, enabled });
  }, []);

  return {
    // State (destructured for consumers)
    gameState: state.gameState,
    worm: state.worm,
    moveDir: state.moveDir,
    orbs: state.orbs,
    score: state.score,
    warps: state.warps,
    speed,
    pendingGrowth: state.pendingGrowth,
    orbInventory: state.orbInventory,
    orbsTotal: CONFIG.initialOrbs,
    wormCameraEnabled: state.wormCameraEnabled,
    timeAlive: state.timeAlive,

    // Reducer interface (used by game loop)
    dispatch,
    stateRef,

    // Mutable refs (used by game loop)
    lastMoveTime,
    timeAliveAcc,
    lastOrbColorRef,
    pendingGrowthColorsRef,

    // Actions / callbacks
    restart,
    updateAfterRotation,

    // Backward-compat setters (used by WormModeGame / WormModeController)
    setGameState,
    setWormCameraEnabled,

    // Config
    CONFIG,
  };
}
