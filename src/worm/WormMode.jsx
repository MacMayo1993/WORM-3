// src/worm/WormMode.jsx
// Main WORM mode game component - manages game state, loop, and coordination

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import WormTrail from './WormTrail.jsx';
import ParityOrbs from './ParityOrb.jsx';
import {
  createInitialWorm,
  getNextSurfacePosition,
  turnWorm,
  isPositionFlipped,
  getAntipodalPosition,
  checkSelfCollision,
  positionKey,
  spawnOrbs,
  updateWormAfterRotation
} from './wormLogic.js';
import { play } from '../utils/audio.js';

// Game configuration
const CONFIG = {
  initialOrbs: 15,        // Starting number of orbs
  baseSpeed: 0.8,         // Base tiles per second
  speedIncrement: 0.05,   // Speed increase per segment
  maxSpeed: 3.0,          // Maximum speed
  growthPerOrb: 1,        // Segments gained per orb
  warpBonus: 25           // Score bonus per warp
};

// Custom hook for WORM mode game logic
export function useWormGame(cubies, size, animState, onRotate) {
  // Game state
  const [gameState, setGameState] = useState('playing');
  const [worm, setWorm] = useState(() => createInitialWorm(size));
  const [moveDir, setMoveDir] = useState('up');
  const [orbs, setOrbs] = useState([]);
  const [score, setScore] = useState(0);
  const [warps, setWarps] = useState(0);
  const [orbsEaten, setOrbsEaten] = useState(0);
  const [pendingGrowth, setPendingGrowth] = useState(0);

  // Camera mode - first-person worm view
  const [wormCameraEnabled, setWormCameraEnabled] = useState(false);

  // Timing
  const lastMoveTime = useRef(0);
  const rotationQueue = useRef([]);

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
    const initialOrbs = spawnOrbs(cubies, size, CONFIG.initialOrbs, worm, []);
    setOrbs(initialOrbs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restart handler
  const restart = useCallback(() => {
    const newWorm = createInitialWorm(size);
    setWorm(newWorm);
    setMoveDir('up');
    setOrbs(spawnOrbs(cubies, size, CONFIG.initialOrbs, newWorm, []));
    setScore(0);
    setWarps(0);
    setOrbsEaten(0);
    setPendingGrowth(0);
    setGameState('playing');
    lastMoveTime.current = 0;
    rotationQueue.current = [];
  }, [cubies, size]);

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
    orbsTotal: CONFIG.initialOrbs,
    wormCameraEnabled,

    // Setters for game loop
    setGameState,
    setWorm,
    setMoveDir,
    setOrbs,
    setScore,
    setWarps,
    setPendingGrowth,
    setWormCameraEnabled,

    // Refs
    lastMoveTime,

    // Actions
    restart,
    updateAfterRotation,

    // Config
    CONFIG
  };
}

// 3D component for rendering worm and orbs inside Canvas
export function WormMode3D({
  worm,
  orbs,
  size,
  explosionFactor,
  gameState
}) {
  return (
    <>
      <WormTrail
        segments={worm}
        size={size}
        explosionFactor={explosionFactor}
        alive={gameState === 'playing' || gameState === 'paused'}
      />
      <ParityOrbs
        orbs={orbs}
        size={size}
        explosionFactor={explosionFactor}
      />
    </>
  );
}

// Game loop component - must be inside Canvas for useFrame
export function WormGameLoop({
  cubies,
  size,
  animState,
  game // from useWormGame
}) {
  const {
    gameState,
    worm,
    moveDir,
    orbs,
    speed,
    pendingGrowth,
    lastMoveTime,
    setGameState,
    setWorm,
    setMoveDir,
    setOrbs,
    setScore,
    setWarps,
    setPendingGrowth,
    CONFIG
  } = game;

  useFrame((state, delta) => {
    if (gameState !== 'playing') return;
    if (animState) return;

    lastMoveTime.current += delta;

    const moveInterval = 1 / speed;
    if (lastMoveTime.current < moveInterval) return;

    lastMoveTime.current = 0;

    const head = worm[0];
    if (!head) return;

    const nextPos = getNextSurfacePosition(
      { x: head.x, y: head.y, z: head.z, dirKey: head.dirKey },
      moveDir,
      size
    );

    if (!nextPos) {
      setGameState('gameover');
      play('/sounds/gameover.mp3');
      return;
    }

    if (nextPos.moveDir && nextPos.moveDir !== moveDir) {
      setMoveDir(nextPos.moveDir);
    }

    let finalPos = nextPos;

    if (isPositionFlipped(nextPos, cubies)) {
      const antipodalPos = getAntipodalPosition(nextPos, cubies, size);
      if (antipodalPos) {
        finalPos = { ...antipodalPos, moveDir: moveDir };
        setWarps(w => w + 1);
        setScore(s => s + CONFIG.warpBonus);
        play('/sounds/warp.mp3');
      }
    }

    if (checkSelfCollision(finalPos, worm)) {
      setGameState('gameover');
      play('/sounds/gameover.mp3');
      return;
    }

    const orbKey = positionKey(finalPos);
    const orbIndex = orbs.findIndex(o => positionKey(o) === orbKey);

    if (orbIndex !== -1) {
      setOrbs(prev => prev.filter((_, i) => i !== orbIndex));
      setPendingGrowth(g => g + CONFIG.growthPerOrb);
      setScore(s => s + 50 + (worm.length * 10));
      play('/sounds/eat.mp3');

      if (orbs.length === 1) {
        setGameState('victory');
        play('/sounds/victory.mp3');
      }
    }

    setWorm(prev => {
      const newWorm = [{ ...finalPos, moveDir }, ...prev];

      if (pendingGrowth > 0) {
        setPendingGrowth(g => g - 1);
        return newWorm;
      } else {
        return newWorm.slice(0, -1);
      }
    });
  });

  return null;
}

export default {
  useWormGame,
  WormMode3D,
  WormGameLoop
};
