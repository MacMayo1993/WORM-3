// src/worm/tunnel/useTunnelWormGame.js
// Custom hook for WORM tunnel-mode game logic

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  getActiveTunnels,
  createInitialTunnelWorm,
  spawnTunnelOrbs,
  updateTunnelWormAfterRotation,
} from '../wormLogic.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { resolveColors } from '../../utils/colorSchemes.js';

export const TUNNEL_CONFIG = {
  initialOrbs: 15,       // Starting number of orbs in tunnels
  baseSpeed: 0.6,        // Base tunnel progress per second (t units)
  speedIncrement: 0.02,  // Speed increase per segment
  maxSpeed: 1.2,         // Maximum speed
  growthPerOrb: 1,       // Segments gained per orb
  tunnelBonus: 50,       // Bonus for completing a tunnel
  minFlipsForStart: 3    // Minimum flipped stickers needed to start tunnel mode
};

// Custom hook for tunnel mode game logic
export function useTunnelWormGame(cubies, size, animState, onRotate) {
  const settings = useGameStore(s => s.settings);
  const faceColors = useMemo(() => resolveColors(settings), [settings]);

  // Game state
  const [gameState, setGameState] = useState('playing');
  const [worm, setWorm] = useState([]);
  const [orbs, setOrbs] = useState([]);
  const [tunnels, setTunnels] = useState([]);
  const [score, setScore] = useState(0);
  const [tunnelsTraversed, setTunnelsTraversed] = useState(0);
  const [pendingGrowth, setPendingGrowth] = useState(0);
  const [orbInventory, setOrbInventory] = useState({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
  const pendingGrowthColorsRef = useRef([]);
  const lastOrbColorRef = useRef(null); // persists last-eaten orb color; applied to all new segments
  const [targetTunnelId, setTargetTunnelId] = useState(null);
  const [inactiveTunnelSides, setInactiveTunnelSides] = useState(() => new Set());

  // Camera mode - first-person worm view
  const [wormCameraEnabled, setWormCameraEnabled] = useState(false);

  // Timing
  const lastMoveTime = useRef(0);
  const rotationQueue = useRef([]);
  const timeAliveAcc = useRef(0); // Accumulated seconds (ref avoids per-frame renders)

  // Time alive display state (updated at whole-second intervals)
  const [timeAlive, setTimeAlive] = useState(0);

  // Ref for current worm state
  const wormRef = useRef(worm);
  wormRef.current = worm;

  // Calculate current speed
  const speed = useMemo(() => {
    const s = TUNNEL_CONFIG.baseSpeed + (worm.length * TUNNEL_CONFIG.speedIncrement);
    return Math.min(s, TUNNEL_CONFIG.maxSpeed);
  }, [worm.length]);

  // Initialize tunnels and worm on mount
  useEffect(() => {
    const activeTunnels = getActiveTunnels(cubies, size);
    setTunnels(activeTunnels);

    if (activeTunnels.length >= 1) {
      const initialWorm = createInitialTunnelWorm(activeTunnels, 3);
      setWorm(initialWorm);

      const initialOrbs = spawnTunnelOrbs(activeTunnels, TUNNEL_CONFIG.initialOrbs, initialWorm, faceColors);
      setOrbs(initialOrbs);

      // Set initial target
      if (initialOrbs.length > 0) {
        setTargetTunnelId(initialOrbs[0].tunnelId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update tunnels when cube state changes (after rotation)
  const updateTunnels = useCallback(() => {
    const newTunnels = getActiveTunnels(cubies, size);
    const oldTunnels = tunnels;

    setTunnels(newTunnels);

    // Update worm positions for new tunnel configuration
    setWorm(prev => updateTunnelWormAfterRotation(prev, newTunnels, oldTunnels));

    // Clear inactive side tracking — old tunnel IDs are invalid after a rotation,
    // so stale entries would block the worm from entering any tunnel
    setInactiveTunnelSides(new Set());

    // Update orb positions
    setOrbs(prev => prev.map(orb => {
      const newTunnel = newTunnels.find(t => t.id === orb.tunnelId);
      if (newTunnel) {
        return { ...orb, tunnel: newTunnel };
      }
      // Orb's tunnel disappeared - respawn in random tunnel
      if (newTunnels.length > 0) {
        const randomTunnel = newTunnels[Math.floor(Math.random() * newTunnels.length)];
        return {
          tunnelId: randomTunnel.id,
          t: 0.5,
          tunnel: randomTunnel
        };
      }
      return orb;
    }));
  }, [cubies, size, tunnels, setInactiveTunnelSides]);

  // Restart handler
  const restart = useCallback(() => {
    const activeTunnels = getActiveTunnels(cubies, size);
    setTunnels(activeTunnels);

    if (activeTunnels.length >= 1) {
      const newWorm = createInitialTunnelWorm(activeTunnels, 3);
      setWorm(newWorm);
      setOrbs(spawnTunnelOrbs(activeTunnels, TUNNEL_CONFIG.initialOrbs, newWorm, faceColors));
    } else {
      setWorm([]);
      setOrbs([]);
    }

    setScore(0);
    setTunnelsTraversed(0);
    setPendingGrowth(0);
    setOrbInventory({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
    pendingGrowthColorsRef.current = [];
    lastOrbColorRef.current = null;
    setInactiveTunnelSides(new Set());
    setTimeAlive(0);
    setGameState('playing');
    lastMoveTime.current = 0;
    timeAliveAcc.current = 0;
    rotationQueue.current = [];
  }, [cubies, size, faceColors]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Restart on enter/space when game over
      if (gameState === 'gameover' || gameState === 'victory') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          restart();
        }
        return;
      }

      const key = e.key.toLowerCase();

      // Pause toggle
      if (key === ' ' || key === 'escape' || key === 'p') {
        e.preventDefault();
        if (gameState === 'playing') {
          setGameState('paused');
        } else if (gameState === 'paused') {
          setGameState('playing');
        }
        return;
      }

      if (gameState !== 'playing') return;

      // Queue rotation - in tunnel mode, rotations realign the tunnel network
      const queueRotation = (axis, dir, sliceIndex) => {
        if (rotationQueue.current.length < 2) {
          rotationQueue.current.push({ axis, dir, sliceIndex });
        }
      };

      // For tunnel mode, use center slice rotations
      const center = Math.floor(size / 2);

      switch (key) {
        case 'w':
          e.preventDefault();
          queueRotation('col', -1, center);
          break;
        case 's':
          e.preventDefault();
          queueRotation('col', 1, center);
          break;
        case 'a':
          e.preventDefault();
          queueRotation('row', -1, center);
          break;
        case 'd':
          e.preventDefault();
          queueRotation('row', 1, center);
          break;
        case 'q':
          e.preventDefault();
          queueRotation('depth', 1, center);
          break;
        case 'e':
          e.preventDefault();
          queueRotation('depth', -1, center);
          break;
        case 'c':
          e.preventDefault();
          setWormCameraEnabled(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, restart, size]);

  // Process rotation queue
  useEffect(() => {
    if (animState) return;
    if (rotationQueue.current.length === 0) return;
    if (gameState !== 'playing') return;

    const rotation = rotationQueue.current.shift();
    if (rotation && onRotate) {
      onRotate(rotation.axis, rotation.dir, rotation.sliceIndex);
    }
  }, [animState, gameState, onRotate]);

  // Update after rotation
  const updateAfterRotation = useCallback((_axis, _sliceIndex, _dir) => {
    // In tunnel mode, we need to recalculate the tunnel network
    updateTunnels();
  }, [updateTunnels]);

  return {
    // State
    gameState,
    worm,
    orbs,
    tunnels,
    score,
    tunnelsTraversed,
    speed,
    pendingGrowth,
    pendingGrowthColorsRef,
    orbInventory,
    orbsTotal: TUNNEL_CONFIG.initialOrbs,
    wormCameraEnabled,
    targetTunnelId,
    inactiveTunnelSides,
    mode: 'tunnel',
    timeAlive,

    // Setters
    setGameState,
    setWorm,
    setOrbs,
    setScore,
    setTunnelsTraversed,
    setPendingGrowth,
    setOrbInventory,
    setWormCameraEnabled,
    setTargetTunnelId,
    setInactiveTunnelSides,
    setTimeAlive,

    // Refs
    lastMoveTime,
    timeAliveAcc,
    lastOrbColorRef,

    // Actions
    restart,
    updateAfterRotation,
    updateTunnels,

    // Config
    CONFIG: TUNNEL_CONFIG
  };
}
