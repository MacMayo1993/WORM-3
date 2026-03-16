// src/worm/tunnel/useTunnelWormGame.js
// Custom hook for WORM tunnel-mode game logic.
// Uses a single useReducer (tunnelReducer) so all game state transitions are
// deterministic and traceable. A stateRef is kept in sync every render so that
// the game loop (TunnelWormGameLoop) can always read the latest state without
// stale-closure bugs.

import { useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  getActiveTunnels,
  createInitialTunnelWorm,
  spawnTunnelOrbs,
  updateTunnelWormAfterRotation,
} from '../wormLogic.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { resolveColors } from '../../utils/colorSchemes.js';
import { tunnelReducer, makeTunnelState, TA } from './tunnelReducer.js';

export const TUNNEL_CONFIG = {
  initialOrbs: 15,       // Starting number of orbs in tunnels
  baseSpeed: 0.6,        // Base tunnel progress per second (t units)
  speedIncrement: 0.02,  // Speed increase per segment
  maxSpeed: 1.2,         // Maximum speed
  growthPerOrb: 1,       // Segments gained per orb
  tunnelBonus: 50,       // Bonus for completing a tunnel
  minFlipsForStart: 3    // Minimum flipped stickers needed to start tunnel mode
};

export function useTunnelWormGame(cubies, size, animState, onRotate) {
  const settings = useGameStore(s => s.settings);
  const faceColors = useMemo(() => resolveColors(settings), [settings]);

  // ── Single reducer for all game state ──────────────────────────────────────
  const [state, dispatch] = useReducer(tunnelReducer, null, makeTunnelState);

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
    const s = TUNNEL_CONFIG.baseSpeed + (state.worm.length * TUNNEL_CONFIG.speedIncrement);
    return Math.min(s, TUNNEL_CONFIG.maxSpeed);
  }, [state.worm.length]);

  // Initialize tunnels and worm on mount
  useEffect(() => {
    const activeTunnels = getActiveTunnels(cubies, size);
    let initialWorm = [];
    let initialOrbs = [];
    let targetTunnelId = null;

    if (activeTunnels.length >= 1) {
      initialWorm = createInitialTunnelWorm(activeTunnels, 3);
      initialOrbs = spawnTunnelOrbs(activeTunnels, TUNNEL_CONFIG.initialOrbs, initialWorm, faceColors);
      if (initialOrbs.length > 0) targetTunnelId = initialOrbs[0].tunnelId;
    }

    dispatch({ type: TA.INIT, tunnels: activeTunnels, worm: initialWorm, orbs: initialOrbs, targetTunnelId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update tunnels when cube state changes (after rotation)
  const updateTunnels = useCallback(() => {
    const { worm: currentWorm, orbs: currentOrbs, tunnels: currentTunnels } = stateRef.current;
    const newTunnels = getActiveTunnels(cubies, size);
    const newWorm = updateTunnelWormAfterRotation(currentWorm, newTunnels, currentTunnels);
    const newOrbs = currentOrbs.map(orb => {
      const newTunnel = newTunnels.find(t => t.id === orb.tunnelId);
      if (newTunnel) return { ...orb, tunnel: newTunnel };
      if (newTunnels.length > 0) {
        const randomTunnel = newTunnels[Math.floor(Math.random() * newTunnels.length)];
        return { tunnelId: randomTunnel.id, t: 0.5, tunnel: randomTunnel };
      }
      return orb;
    });
    dispatch({ type: TA.UPDATE_TUNNELS, tunnels: newTunnels, worm: newWorm, orbs: newOrbs });
  }, [cubies, size]);

  // Restart handler
  const restart = useCallback(() => {
    const activeTunnels = getActiveTunnels(cubies, size);
    let newWorm = [];
    let newOrbs = [];

    if (activeTunnels.length >= 1) {
      newWorm = createInitialTunnelWorm(activeTunnels, 3);
      newOrbs = spawnTunnelOrbs(activeTunnels, TUNNEL_CONFIG.initialOrbs, newWorm, faceColors);
    }

    dispatch({
      type: TA.RESTART,
      state: {
        ...makeTunnelState(),
        tunnels: activeTunnels,
        worm: newWorm,
        orbs: newOrbs,
        targetTunnelId: newOrbs.length > 0 ? newOrbs[0].tunnelId : null,
      },
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
        if (gameState === 'playing') dispatch({ type: TA.PAUSE });
        else if (gameState === 'paused') dispatch({ type: TA.RESUME });
        return;
      }

      if (gameState !== 'playing') return;

      const queueRotation = (axis, dir, sliceIndex) => {
        if (rotationQueue.current.length < 2) {
          rotationQueue.current.push({ axis, dir, sliceIndex });
        }
      };

      const center = Math.floor(size / 2);

      switch (key) {
        case 'w': e.preventDefault(); queueRotation('col', -1, center); break;
        case 's': e.preventDefault(); queueRotation('col', 1, center); break;
        case 'a': e.preventDefault(); queueRotation('row', -1, center); break;
        case 'd': e.preventDefault(); queueRotation('row', 1, center); break;
        case 'q': e.preventDefault(); queueRotation('depth', 1, center); break;
        case 'e': e.preventDefault(); queueRotation('depth', -1, center); break;
        case 'c':
          e.preventDefault();
          dispatch({ type: TA.SET_CAMERA, enabled: !stateRef.current.wormCameraEnabled });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [restart, size]); // all state accessed via stateRef — no stale-closure risk

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

  // Update after rotation
  const updateAfterRotation = useCallback((_axis, _sliceIndex, _dir) => {
    updateTunnels();
  }, [updateTunnels]);

  // ── Convenience setters (dispatch wrappers) — preserve backward-compat API ─
  const setGameState = useCallback((gs) => {
    if (gs === 'paused') dispatch({ type: TA.PAUSE });
    else if (gs === 'playing') dispatch({ type: TA.RESUME });
    else if (gs === 'gameover') dispatch({ type: TA.GAMEOVER });
    else if (gs === 'victory') dispatch({ type: TA.VICTORY });
  }, []);

  const setWormCameraEnabled = useCallback((val) => {
    const enabled = typeof val === 'function' ? val(stateRef.current.wormCameraEnabled) : val;
    dispatch({ type: TA.SET_CAMERA, enabled });
  }, []);

  return {
    // State (destructured for consumers)
    gameState: state.gameState,
    worm: state.worm,
    orbs: state.orbs,
    tunnels: state.tunnels,
    score: state.score,
    tunnelsTraversed: state.tunnelsTraversed,
    speed,
    pendingGrowth: state.pendingGrowth,
    orbInventory: state.orbInventory,
    orbsTotal: TUNNEL_CONFIG.initialOrbs,
    wormCameraEnabled: state.wormCameraEnabled,
    targetTunnelId: state.targetTunnelId,
    inactiveTunnelSides: state.inactiveTunnelSides,
    mode: 'tunnel',
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
    updateTunnels,

    // Backward-compat setters (used by WormModeGame / WormModeController)
    setGameState,
    setWormCameraEnabled,

    // Config
    CONFIG: TUNNEL_CONFIG,
  };
}
