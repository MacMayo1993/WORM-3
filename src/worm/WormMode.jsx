// src/worm/WormMode.jsx
// Main WORM mode game component - manages game state, loop, and coordination

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import WormTrail from './WormTrail.jsx';
import ParityOrbs from './ParityOrb.jsx';
import WormTunnelNetwork from './WormTunnelNetwork.jsx';
import WormAmputationEffects from './WormAmputationEffect.jsx';
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
  getSegmentWorldPos,
  isAnySegmentInTunnel,
  getSegmentsInSlice,
  // Tunnel mode imports
  getActiveTunnels,
  createInitialTunnelWorm,
  findNextTunnel,
  checkTunnelSelfCollision,
  spawnTunnelOrbs,
  updateTunnelWormAfterRotation
} from './wormLogic.js';
import * as THREE from 'three';
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

// Auto-rotate configuration
const AUTO_ROTATE_INTERVAL = 5.0;  // Seconds between rotations
const DANGER_WARN_LEAD    = 2.5;   // Seconds of warning before rotation fires

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

const EMPTY_INACTIVE_TUNNEL_SIDES = new Set();

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

  // Auto-rotate danger slice: null when safe, {axis, sliceIndex, dir} during warning phase
  const [dangerSlice, setDangerSlice] = useState(null);
  // Countdown in whole seconds shown in HUD (null when no pending rotation warning)
  const [autoRotateCountdown, setAutoRotateCountdown] = useState(null);
  // Pending amputation particle effects
  const [amputationEffects, setAmputationEffects] = useState([]);
  const amputationIdRef = useRef(0);

  // Timing
  const lastMoveTime = useRef(0);
  const rotationQueue = useRef([]);
  const timeAliveAcc = useRef(0); // Accumulated seconds (ref avoids per-frame renders)

  // Time alive display state (updated at whole-second intervals)
  const [timeAlive, setTimeAlive] = useState(0);

  // Ref for current worm state (avoids stale closures in event handlers)
  const wormRef = useRef(worm);
  wormRef.current = worm;

  // Ref for onRotate (lets the game loop call it without a stale closure)
  const onRotateRef = useRef(onRotate);
  onRotateRef.current = onRotate;

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
    setTimeAlive(0);
    setDangerSlice(null);
    setAutoRotateCountdown(null);
    setAmputationEffects([]);
    setGameState('playing');
    lastMoveTime.current = 0;
    timeAliveAcc.current = 0;
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

  // Process rotation queue — blocked while animating or any segment is in a tunnel
  useEffect(() => {
    if (animState) return;
    if (rotationQueue.current.length === 0) return;
    if (gameState !== 'playing') return;
    if (isAnySegmentInTunnel(worm)) return;

    const rotation = rotationQueue.current.shift();
    if (rotation && onRotate) {
      onRotate(rotation.axis, rotation.dir, rotation.sliceIndex);
    }
  }, [animState, gameState, onRotate, worm]);

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
    timeAlive,
    dangerSlice,
    autoRotateCountdown,
    amputationEffects,

    // Setters for game loop
    setGameState,
    setWorm,
    setMoveDir,
    setOrbs,
    setScore,
    setWarps,
    setPendingGrowth,
    setWormCameraEnabled,
    setTimeAlive,
    setDangerSlice,
    setAutoRotateCountdown,
    setAmputationEffects,
    amputationIdRef,

    // Refs
    lastMoveTime,
    timeAliveAcc,
    onRotateRef,

    // Actions
    restart,
    updateAfterRotation,

    // Config
    CONFIG
  };
}

// Face-normal for a slice plane perpendicular to each axis
const _SLICE_PLANE_NORMAL = {
  col:   new THREE.Vector3(1, 0, 0),
  row:   new THREE.Vector3(0, 1, 0),
  depth: new THREE.Vector3(0, 0, 1),
};

// Semi-transparent warning plane shown across the at-risk slice
function SliceWarning({ dangerSlice, size, explosionFactor = 0 }) {
  const timeRef = useRef(0);
  const meshRef = useRef();

  // Animate the opacity to pulse
  useFrame((_state, delta) => {
    timeRef.current += delta;
    if (meshRef.current) {
      meshRef.current.material.opacity = 0.18 + Math.sin(timeRef.current * 6) * 0.12;
    }
  });

  if (!dangerSlice) return null;

  const { axis, sliceIndex } = dangerSlice;
  const center = (size - 1) / 2;
  const scale = 1 + explosionFactor * 1.8;
  const coord = (sliceIndex - center) * scale;
  const planeSize = size * scale * 1.3;

  let position, rotation;
  if (axis === 'col') {
    position = [coord, 0, 0];
    rotation = [0, Math.PI / 2, 0];
  } else if (axis === 'row') {
    position = [0, coord, 0];
    rotation = [Math.PI / 2, 0, 0];
  } else {
    position = [0, 0, coord];
    rotation = [0, 0, 0];
  }

  return (
    <mesh ref={meshRef} position={position} rotation={rotation}>
      <planeGeometry args={[planeSize, planeSize]} />
      <meshBasicMaterial color="#ff3333" transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
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
  inactiveTunnelSides,
  dangerSlice = null,
  amputationEffects = [],
  onAmputationEffectDone
}) {
  const isTunnelMode = mode === 'tunnel';
  const wormTunnelId = isTunnelMode && worm[0] ? worm[0].tunnelId : null;
  const inactiveSideKeys = inactiveTunnelSides || EMPTY_INACTIVE_TUNNEL_SIDES;

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
          inactiveSideKeys={inactiveSideKeys}
        />
      )}

      {/* Auto-rotate danger slice highlight */}
      {dangerSlice && (
        <SliceWarning dangerSlice={dangerSlice} size={size} explosionFactor={explosionFactor} />
      )}

      {/* Tail amputation disintegration particles */}
      <WormAmputationEffects effects={amputationEffects} onEffectDone={onAmputationEffectDone} />

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
    timeAliveAcc,
    setGameState,
    setWorm,
    setMoveDir,
    setOrbs,
    setScore,
    setWarps,
    setPendingGrowth,
    setTimeAlive,
    setDangerSlice,
    setAutoRotateCountdown,
    setAmputationEffects,
    amputationIdRef,
    onRotateRef,
    CONFIG
  } = game;

  // Auto-rotate timer: counts down from AUTO_ROTATE_INTERVAL each frame
  const autoRotateTimerRef = useRef(AUTO_ROTATE_INTERVAL);
  // The chosen rotation stored as soon as warning phase begins
  const pendingAutoRotationRef = useRef(null);
  // Previous whole-second countdown value (avoids unnecessary setState calls)
  const prevCountdownSecRef = useRef(null);

  useFrame((state, delta) => {
    if (gameState !== 'playing') return;
    if (animState) return;

    // Track time alive (update display state at whole-second boundaries)
    const prevSecs = Math.floor(timeAliveAcc.current);
    timeAliveAcc.current += delta;
    const newSecs = Math.floor(timeAliveAcc.current);
    if (newSecs !== prevSecs) setTimeAlive(newSecs);

    lastMoveTime.current += delta;

    // ── Auto-rotate countdown ──────────────────────────────────────────────
    const inTunnel = isAnySegmentInTunnel(worm);
    if (!inTunnel) {
      autoRotateTimerRef.current -= delta;

      // Enter warning phase: pick the rotation that will fire
      if (autoRotateTimerRef.current <= DANGER_WARN_LEAD && !pendingAutoRotationRef.current) {
        const axes = ['col', 'row', 'depth'];
        const axis = axes[Math.floor(Math.random() * axes.length)];
        const sliceIndex = Math.floor(Math.random() * size);
        const dir = Math.random() < 0.5 ? 1 : -1;
        pendingAutoRotationRef.current = { axis, sliceIndex, dir };
        setDangerSlice({ axis, sliceIndex, dir });
      }

      // Update displayed countdown (whole seconds only)
      if (pendingAutoRotationRef.current) {
        const secsLeft = Math.ceil(Math.max(0, autoRotateTimerRef.current));
        if (secsLeft !== prevCountdownSecRef.current) {
          prevCountdownSecRef.current = secsLeft;
          setAutoRotateCountdown(secsLeft);
        }
      }

      // Fire the rotation
      if (autoRotateTimerRef.current <= 0 && pendingAutoRotationRef.current) {
        const rot = pendingAutoRotationRef.current;

        // Check for worm intersection before dispatching
        const hits = getSegmentsInSlice(worm, rot.axis, rot.sliceIndex);
        if (hits.length > 0) {
          const firstHit = hits[0]; // Lowest index = closest to head
          if (firstHit.segmentIndex === 0) {
            // Head hit — instant death
            setDangerSlice(null);
            setAutoRotateCountdown(null);
            pendingAutoRotationRef.current = null;
            prevCountdownSecRef.current = null;
            autoRotateTimerRef.current = AUTO_ROTATE_INTERVAL;
            setGameState('gameover');
            play('/sounds/gameover.mp3');
            return;
          } else {
            // Body hit — amputate at first hit, disintegrate the rest
            const cutIndex = firstHit.segmentIndex;
            const cutSegments = worm.slice(cutIndex); // segments to disintegrate
            const FACE_NORMALS_MAP = {
              PX: [1, 0, 0], NX: [-1, 0, 0],
              PY: [0, 1, 0], NY: [0, -1, 0],
              PZ: [0, 0, 1], NZ: [0, 0, -1],
            };
            const LIFT = 0.45;
            const effectPositions = cutSegments.map(seg => {
              const base = getSegmentWorldPos(seg, size, 0);
              const n = FACE_NORMALS_MAP[seg.dirKey] || [0, 0, 1];
              return [base[0] + n[0] * LIFT, base[1] + n[1] * LIFT, base[2] + n[2] * LIFT];
            });
            const effectId = amputationIdRef.current++;
            setAmputationEffects(prev => [...prev, { id: effectId, positions: effectPositions }]);
            setWorm(prev => prev.slice(0, cutIndex));
          }
        }

        // Fire the actual cube rotation
        onRotateRef.current?.(rot.axis, rot.dir, rot.sliceIndex);

        // Reset
        setDangerSlice(null);
        setAutoRotateCountdown(null);
        pendingAutoRotationRef.current = null;
        prevCountdownSecRef.current = null;
        autoRotateTimerRef.current = AUTO_ROTATE_INTERVAL;
      }
    } else {
      // Worm is in tunnel — suspend the countdown display but keep the timer frozen
      // (don't decrement, so we resume from the same point when worm exits)
      if (autoRotateTimerRef.current <= DANGER_WARN_LEAD && pendingAutoRotationRef.current) {
        // Keep warning visible but clear countdown number while in tunnel
        const secsLeft = Math.ceil(Math.max(0, autoRotateTimerRef.current));
        if (secsLeft !== prevCountdownSecRef.current) {
          prevCountdownSecRef.current = secsLeft;
          setAutoRotateCountdown(secsLeft);
        }
      }
    }
    // ── End auto-rotate ────────────────────────────────────────────────────

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
      setOrbs(spawnTunnelOrbs(activeTunnels, TUNNEL_CONFIG.initialOrbs, newWorm));
    } else {
      setWorm([]);
      setOrbs([]);
    }

    setScore(0);
    setTunnelsTraversed(0);
    setPendingGrowth(0);
    setInactiveTunnelSides(new Set());
    setTimeAlive(0);
    setGameState('playing');
    lastMoveTime.current = 0;
    timeAliveAcc.current = 0;
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

  // Process rotation queue — blocked while any segment is in a tunnel (always true in tunnel mode,
  // but the guard ensures consistency if the worm straddles tunnel entry/exit)
  useEffect(() => {
    if (animState) return;
    if (rotationQueue.current.length === 0) return;
    if (gameState !== 'playing') return;
    if (isAnySegmentInTunnel(worm)) return;

    const rotation = rotationQueue.current.shift();
    if (rotation && onRotate) {
      onRotate(rotation.axis, rotation.dir, rotation.sliceIndex);
    }
  }, [animState, gameState, onRotate, worm]);

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
    timeAlive,

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
    setTimeAlive,

    // Refs
    lastMoveTime,
    timeAliveAcc,

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
    timeAliveAcc,
    setGameState,
    setWorm,
    setOrbs,
    setScore,
    setTunnelsTraversed,
    setPendingGrowth,
    setTargetTunnelId,
    setTimeAlive,
    inactiveTunnelSides,
    setInactiveTunnelSides,
    CONFIG
  } = game;

  useFrame((state, delta) => {
    if (gameState !== 'playing') return;
    if (animState) return;
    if (worm.length === 0 || tunnels.length === 0) return;

    // Track time alive (update display state at whole-second boundaries)
    const prevSecs = Math.floor(timeAliveAcc.current);
    timeAliveAcc.current += delta;
    const newSecs = Math.floor(timeAliveAcc.current);
    if (newSecs !== prevSecs) setTimeAlive(newSecs);

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
