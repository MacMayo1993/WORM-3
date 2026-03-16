// src/worm/surface/useSurfaceWormGame.js
// Custom hook for WORM surface-mode game logic

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  createInitialWorm,
  turnWorm,
  spawnOrbs,
  updateWormAfterRotation,
} from '../wormLogic.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { resolveColors } from '../../utils/colorSchemes.js';

export const CONFIG = {
  initialOrbs: 22,       // Starting number of orbs
  baseSpeed: 1.2,        // Base tiles per second
  speedIncrement: 0.05,  // Speed increase per segment
  maxSpeed: 3.0,         // Maximum speed
  growthPerOrb: 1,       // Segments gained per orb
  warpBonus: 25,         // Score bonus per warp
  healBonus: 75,         // Score bonus per healed wormhole tile
};

// Custom hook for WORM mode game logic (surface crawling)
export function useWormGame(cubies, size, animState, onRotate) {
  const settings = useGameStore(s => s.settings);
  const faceColors = useMemo(() => resolveColors(settings), [settings]);

  // Game state
  const [gameState, setGameState] = useState('playing');
  const [worm, setWorm] = useState(() => createInitialWorm(size));
  const [moveDir, setMoveDir] = useState('up');
  const [orbs, setOrbs] = useState([]);
  const [score, setScore] = useState(0);
  const [warps, setWarps] = useState(0);
  const [pendingGrowth, setPendingGrowth] = useState(0);
  const [orbInventory, setOrbInventory] = useState({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
  const pendingGrowthColorsRef = useRef([]);
  const lastOrbColorRef = useRef(null); // persists last-eaten orb color; applied to all new segments

  // Camera mode - first-person worm view
  const [wormCameraEnabled, setWormCameraEnabled] = useState(false);

  // Timing
  const lastMoveTime = useRef(0);
  const rotationQueue = useRef([]);
  const timeAliveAcc = useRef(0); // Accumulated seconds (ref avoids per-frame renders)

  // Time alive display state (updated at whole-second intervals)
  const [timeAlive, setTimeAlive] = useState(0);

  // Ref for current worm state (avoids stale closures in event handlers)
  const wormRef = useRef(worm);
  wormRef.current = worm;

  // Calculate current speed
  const speed = useMemo(() => {
    const s = CONFIG.baseSpeed + (worm.length * CONFIG.speedIncrement);
    return Math.min(s, CONFIG.maxSpeed);
  }, [worm.length]);

  // Initialize orbs on mount only (intentionally empty deps)
  // Orbs should only spawn once when the game starts, not on every cubies/size change
  useEffect(() => {
    const initialOrbs = spawnOrbs(cubies, size, CONFIG.initialOrbs, worm, [], faceColors);
    setOrbs(initialOrbs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restart handler
  const restart = useCallback(() => {
    const newWorm = createInitialWorm(size);
    setWorm(newWorm);
    setMoveDir('up');
    setOrbs(spawnOrbs(cubies, size, CONFIG.initialOrbs, newWorm, [], faceColors));
    setScore(0);
    setWarps(0);
    setPendingGrowth(0);
    setOrbInventory({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
    pendingGrowthColorsRef.current = [];
    lastOrbColorRef.current = null;
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

      // Queue rotation
      const queueRotation = (axis, dir, sliceIndex) => {
        if (rotationQueue.current.length < 2) {
          rotationQueue.current.push({ axis, dir, sliceIndex });
        }
      };

      // Use ref to get current worm state (avoids stale closure)
      const head = wormRef.current[0];
      if (!head) return;

      switch (key) {
        case 'w':
          e.preventDefault();
          queueRotation('col', -1, head.x);
          break;
        case 's':
          e.preventDefault();
          queueRotation('col', 1, head.x);
          break;
        case 'a':
          e.preventDefault();
          queueRotation('row', -1, head.y);
          break;
        case 'd':
          e.preventDefault();
          queueRotation('row', 1, head.y);
          break;
        case 'q':
          e.preventDefault();
          queueRotation('depth', 1, head.z);
          break;
        case 'e':
          e.preventDefault();
          queueRotation('depth', -1, head.z);
          break;
        case 'arrowleft':
          e.preventDefault();
          setMoveDir(prev => turnWorm(prev, 'left'));
          break;
        case 'arrowright':
          e.preventDefault();
          setMoveDir(prev => turnWorm(prev, 'right'));
          break;
        case 'c':
          // Toggle worm camera (first-person view)
          e.preventDefault();
          setWormCameraEnabled(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, restart]); // worm accessed via wormRef to avoid stale closure

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

  // Update worm after cube rotation
  const updateAfterRotation = useCallback((axis, sliceIndex, dir) => {
    setWorm(prev => updateWormAfterRotation(prev, axis, sliceIndex, dir, size));
    setOrbs(prev => {
      // Orbs also ride the cube
      return prev.map(orb => {
        const updated = updateWormAfterRotation([orb], axis, sliceIndex, dir, size);
        return updated[0];
      });
    });
  }, [size]);

  return {
    // State
    gameState,
    worm,
    moveDir,
    orbs,
    score,
    warps,
    speed,
    pendingGrowth,
    pendingGrowthColorsRef,
    orbInventory,
    orbsTotal: CONFIG.initialOrbs,
    wormCameraEnabled,
    timeAlive,

    // Setters for game loop
    setGameState,
    setWorm,
    setMoveDir,
    setOrbs,
    setScore,
    setWarps,
    setPendingGrowth,
    setOrbInventory,
    setWormCameraEnabled,
    setTimeAlive,

    // Refs
    lastMoveTime,
    timeAliveAcc,
    lastOrbColorRef,

    // Actions
    restart,
    updateAfterRotation,

    // Config
    CONFIG
  };
}
