// src/worm/WormMode.jsx
// Main WORM mode game component - manages game state, loop, and coordination

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import WormTrail from './WormTrail.jsx';
import ParityOrbs from './ParityOrb.jsx';
import WormTunnelNetwork from './WormTunnelNetwork.jsx';
import {
  createInitialWorm,
  getNextSurfacePosition,
  turnWorm,
  isPositionFlipped,
  getAntipodalPosition,
  checkSelfCollision,
  positionKey,
  spawnOrbs,
  updateWormAfterRotation,
  // Tunnel mode imports
  getActiveTunnels,
  createInitialTunnelWorm,
  findNextTunnel,
  checkTunnelSelfCollision,
  spawnTunnelOrbs,
  updateTunnelWormAfterRotation
} from './wormLogic.js';
import { play } from '../utils/audio.js';

// Game configuration for surface mode
const CONFIG = {
  initialOrbs: 15,        // Starting number of orbs
  baseSpeed: 0.8,         // Base tiles per second
  speedIncrement: 0.05,   // Speed increase per segment
  maxSpeed: 3.0,          // Maximum speed
  growthPerOrb: 1,        // Segments gained per orb
  warpBonus: 25           // Score bonus per warp
};

// Game configuration for tunnel mode
const TUNNEL_CONFIG = {
  initialOrbs: 10,        // Starting number of orbs in tunnels
  baseSpeed: 0.4,         // Base tunnel progress per second (t units)
  speedIncrement: 0.02,   // Speed increase per segment
  maxSpeed: 1.2,          // Maximum speed
  growthPerOrb: 1,        // Segments gained per orb
  tunnelBonus: 50,        // Bonus for completing a tunnel
  minFlipsForStart: 3     // Minimum flipped stickers needed to start tunnel mode
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
// Supports both surface and tunnel modes
export function WormMode3D({
  worm,
  orbs,
  size,
  explosionFactor,
  gameState,
  mode = 'surface',
  targetTunnelId = null,
  tunnels = [],
  inactiveTunnelSides = new Set()
}) {
  const isTunnelMode = mode === 'tunnel';
  const wormTunnelId = isTunnelMode && worm[0] ? worm[0].tunnelId : null;

  return (
    <>
      {/* Tunnel network visualization (only in tunnel mode) */}
      {isTunnelMode && tunnels.length > 0 && (
        <WormTunnelNetwork
          tunnels={tunnels}
          size={size}
          explosionFactor={explosionFactor}
          targetTunnelId={targetTunnelId}
          wormTunnelId={wormTunnelId}
          inactiveSideKeys={inactiveTunnelSides}
        />
      )}

      <WormTrail
        segments={worm}
        size={size}
        explosionFactor={explosionFactor}
        alive={gameState === 'playing' || gameState === 'paused'}
        mode={mode}
      />
      <ParityOrbs
        orbs={orbs}
        size={size}
        explosionFactor={explosionFactor}
        mode={mode}
        targetTunnelId={targetTunnelId}
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

// ============================================================================
// TUNNEL MODE - Worm travels inside the cube through antipodal wormhole tunnels
// ============================================================================

// Custom hook for TUNNEL mode game logic
export function useTunnelWormGame(cubies, size, animState, onRotate) {
  // Game state
  const [gameState, setGameState] = useState('playing');
  const [worm, setWorm] = useState([]);
  const [orbs, setOrbs] = useState([]);
  const [tunnels, setTunnels] = useState([]);
  const [score, setScore] = useState(0);
  const [tunnelsTraversed, setTunnelsTraversed] = useState(0);
  const [pendingGrowth, setPendingGrowth] = useState(0);
  const [targetTunnelId, setTargetTunnelId] = useState(null);
  const [inactiveTunnelSides, setInactiveTunnelSides] = useState(() => new Set());

  // Camera mode - first-person worm view
  const [wormCameraEnabled, setWormCameraEnabled] = useState(false);

  // Timing
  const lastMoveTime = useRef(0);
  const rotationQueue = useRef([]);

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

      const initialOrbs = spawnTunnelOrbs(activeTunnels, TUNNEL_CONFIG.initialOrbs, initialWorm);
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
  }, [cubies, size, tunnels]);

  // Restart handler
  const restart = useCallback(() => {
    const activeTunnels = getActiveTunnels(cubies, size);
    setTunnels(activeTunnels);

    if (activeTunnels.length >= 1) {
      const newWorm = createInitialTunnelWorm(activeTunnels, 3);
      setWorm(newWorm);
      setOrbs(spawnTunnelOrbs(activeTunnels, TUNNEL_CONFIG.initialOrbs, newWorm));
    } else {
      setWorm([]);
      setOrbs([]);
    }

    setScore(0);
    setTunnelsTraversed(0);
    setPendingGrowth(0);
    setInactiveTunnelSides(new Set());
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
    orbsTotal: TUNNEL_CONFIG.initialOrbs,
    wormCameraEnabled,
    targetTunnelId,
    inactiveTunnelSides,
    mode: 'tunnel',

    // Setters
    setGameState,
    setWorm,
    setOrbs,
    setScore,
    setTunnelsTraversed,
    setPendingGrowth,
    setWormCameraEnabled,
    setTargetTunnelId,
    setInactiveTunnelSides,

    // Refs
    lastMoveTime,

    // Actions
    restart,
    updateAfterRotation,
    updateTunnels,

    // Config
    CONFIG: TUNNEL_CONFIG
  };
}

// Game loop component for TUNNEL mode
export function TunnelWormGameLoop({
  cubies: _cubies,
  size,
  animState,
  game // from useTunnelWormGame
}) {
  const {
    gameState,
    worm,
    orbs,
    tunnels,
    speed,
    pendingGrowth,
    lastMoveTime,
    setGameState,
    setWorm,
    setOrbs,
    setScore,
    setTunnelsTraversed,
    setPendingGrowth,
    setTargetTunnelId,
    inactiveTunnelSides,
    setInactiveTunnelSides,
    CONFIG
  } = game;

  useFrame((state, delta) => {
    if (gameState !== 'playing') return;
    if (animState) return;
    if (worm.length === 0 || tunnels.length === 0) return;

    lastMoveTime.current += delta;

    // Continuous movement through tunnel
    const moveAmount = speed * delta;

    const head = worm[0];
    if (!head || !head.tunnel) return;

    // Advance worm through tunnel
    const movementDir = head.direction ?? 1;
    let newT = head.t + (moveAmount * movementDir);
    let newTunnelId = head.tunnelId;
    let newTunnel = head.tunnel;
    let newDirection = movementDir;

    // Check if we've reached the end of the tunnel
    if (newT >= 1.0 || newT <= 0.0) {
      // Exited tunnel - find next tunnel to enter
      const exitedFromEntry = newT <= 0.0;
      const exitPos = exitedFromEntry ? head.tunnel.entry : head.tunnel.exit;
      const nextTunnelInfo = findNextTunnel(exitPos, tunnels, head.tunnelId, size, inactiveTunnelSides);

      if (nextTunnelInfo) {
        // Entering from this side consumes only that side; opposite side remains usable.
        setInactiveTunnelSides(prev => {
          const next = new Set(prev);
          next.add(nextTunnelInfo.enteredSideKey);
          return next;
        });

        newTunnel = nextTunnelInfo.tunnel;
        newTunnelId = newTunnel.id;
        // Enter from appropriate end
        newT = nextTunnelInfo.enterFromEntry ? 0.0 : 1.0;
        // If entering from exit, travel backwards (decreasing t).
        newDirection = nextTunnelInfo.enterFromEntry ? 1 : -1;
        setTunnelsTraversed(t => t + 1);
        setScore(s => s + CONFIG.tunnelBonus);
        play('/sounds/warp.mp3');
      } else {
        // No connected tunnel - game over or bounce back
        setGameState('gameover');
        play('/sounds/gameover.mp3');
        return;
      }
    }

    // Check for self-collision
    const newHead = {
      tunnelId: newTunnelId,
      t: Math.max(0, Math.min(1, newT)),
      tunnel: newTunnel,
      direction: newDirection
    };
    if (checkTunnelSelfCollision(newHead, worm)) {
      setGameState('gameover');
      play('/sounds/gameover.mp3');
      return;
    }

    // Check for orb collision
    const collisionThreshold = 0.15;
    const orbIndex = orbs.findIndex(orb =>
      orb.tunnelId === newTunnelId &&
      Math.abs(orb.t - newT) < collisionThreshold
    );

    if (orbIndex !== -1) {
      setOrbs(prev => prev.filter((_, i) => i !== orbIndex));
      setPendingGrowth(g => g + CONFIG.growthPerOrb);
      setScore(s => s + 50 + (worm.length * 10));
      play('/sounds/eat.mp3');

      // Update target tunnel
      const remainingOrbs = orbs.filter((_, i) => i !== orbIndex);
      if (remainingOrbs.length > 0) {
        setTargetTunnelId(remainingOrbs[0].tunnelId);
      }

      if (orbs.length === 1) {
        setGameState('victory');
        play('/sounds/victory.mp3');
      }
    }

    // Update worm positions
    setWorm(prev => {
      const newWorm = [newHead];

      // Move body segments along their tunnels
      for (let i = 0; i < prev.length; i++) {
        const seg = prev[i];
        if (i === 0) continue; // Skip old head

        // Body follows head with delay
        const _followT = i < prev.length - 1 ? prev[i].t : prev[i].t;
        newWorm.push({
          tunnelId: seg.tunnelId,
          t: seg.t,
          tunnel: seg.tunnel,
          direction: seg.direction ?? 1
        });
      }

      // Handle growth or tail removal
      if (pendingGrowth > 0) {
        setPendingGrowth(g => g - 1);
        // Keep all segments (growth)
        return newWorm;
      } else {
        // Remove tail segment
        return newWorm.slice(0, -1);
      }
    });
  });

  return null;
}

export default {
  useWormGame,
  useTunnelWormGame,
  WormMode3D,
  WormGameLoop,
  TunnelWormGameLoop
};
