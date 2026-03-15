// src/worm/WormMode.jsx
// Main WORM mode game component - manages game state, loop, and coordination

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
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
  updateTunnelWormAfterRotation,
  // Weight & healing
  pressState,
  getPressedTileKeys,
  checkHealingCandidates,
  getSegmentWorldPos,
} from './wormLogic.js';
import { healSticker } from '../game/cubeState.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { play } from '../utils/audio.js';
import { FACE_COLORS, ANTIPODAL_COLOR } from '../utils/constants.js';
import { resolveColors } from '../utils/colorSchemes.js';

// Game configuration for surface mode
const CONFIG = {
  initialOrbs: 15,        // Starting number of orbs
  baseSpeed: 0.8,         // Base tiles per second
  speedIncrement: 0.05,   // Speed increase per segment
  maxSpeed: 3.0,          // Maximum speed
  growthPerOrb: 1,        // Segments gained per orb
  warpBonus: 25,          // Score bonus per warp
  healBonus: 75,          // Score bonus per healed wormhole tile
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

const EMPTY_INACTIVE_TUNNEL_SIDES = new Set();

// Custom hook for WORM mode game logic
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

// Face rotation to align plane with each cube face normal (pointing outward)
const HIGHLIGHT_ROT = {
  PZ: [0, 0, 0],
  NZ: [0, Math.PI, 0],
  PX: [0, Math.PI / 2, 0],
  NX: [0, -Math.PI / 2, 0],
  PY: [-Math.PI / 2, 0, 0],
  NY: [Math.PI / 2, 0, 0],
};

// Face outward normals for lifting the highlight plane above the sticker surface
const HIGHLIGHT_NORMALS = {
  PX: [1, 0, 0], NX: [-1, 0, 0],
  PY: [0, 1, 0], NY: [0, -1, 0],
  PZ: [0, 0, 1], NZ: [0, 0, -1],
};

// Sticker surface sits at 0.51 from cubie center; lift slightly above
const HIGHLIGHT_LIFT = 0.53;

const _highlightGeo = new THREE.PlaneGeometry(0.95, 0.95);

// One pre-built material per face color (keyed by hex string) — no per-frame allocation
const _highlightMats = {};
for (const hex of Object.values(FACE_COLORS)) {
  _highlightMats[hex] = new THREE.MeshBasicMaterial({
    color: new THREE.Color(hex),
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}
// Fallback material for unknown colors
const _highlightMatFallback = new THREE.MeshBasicMaterial({
  color: new THREE.Color('#00ff88'),
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
});

/**
 * Renders glowing tile highlights at each surface-mode worm segment position.
 * Each tile glows in the antipodal color of its sticker.
 */
function WormTileHighlight({ segments, size, explosionFactor }) {
  const cubies = useGameStore(s => s.cubies);
  const settings = useGameStore(s => s.settings);
  const faceColors = useMemo(() => resolveColors(settings), [settings]);
  const timeRef = useRef(0);

  const tileData = useMemo(() => {
    return segments
      .filter(seg => seg.dirKey) // surface segments only
      .map(seg => {
        const base = getSegmentWorldPos(seg, size, explosionFactor);
        const n = HIGHLIGHT_NORMALS[seg.dirKey] || [0, 0, 1];
        const pos = [base[0] + n[0] * HIGHLIGHT_LIFT, base[1] + n[1] * HIGHLIGHT_LIFT, base[2] + n[2] * HIGHLIGHT_LIFT];
        const rot = HIGHLIGHT_ROT[seg.dirKey] || [0, 0, 0];
        // Look up the sticker's antipodal face color using the current color scheme
        const faceId = cubies?.[seg.x]?.[seg.y]?.[seg.z]?.stickers?.[seg.dirKey]?.curr;
        const antipodalId = ANTIPODAL_COLOR[faceId];
        const hex = faceColors[antipodalId] || null;
        const mat = (hex && _highlightMats[hex]) || _highlightMatFallback;
        return { pos, rot, mat };
      });
  }, [segments, size, explosionFactor, cubies, faceColors]);

  useFrame((_state, delta) => {
    timeRef.current += delta;
    const opacity = 0.25 + Math.sin(timeRef.current * 6) * 0.15;
    // Update all materials each frame (7 objects max — cheap)
    for (const mat of Object.values(_highlightMats)) mat.opacity = opacity;
    _highlightMatFallback.opacity = opacity;
  });

  if (tileData.length === 0) return null;

  return (
    <group>
      {tileData.map(({ pos, rot, mat }, i) => (
        <mesh
          key={i}
          position={pos}
          rotation={rot}
          geometry={_highlightGeo}
          material={mat}
          frustumCulled={false}
        />
      ))}
    </group>
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
  inactiveTunnelSides
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

      {/* Tile highlight overlay - shows which tiles the worm is pressing */}
      {!isTunnelMode && (
        <WormTileHighlight
          segments={worm}
          size={size}
          explosionFactor={explosionFactor}
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
    pendingGrowthColorsRef,
    lastOrbColorRef,
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
    CONFIG
  } = game;

  const setCubies = useGameStore(s => s.setCubies);
  const recentlyHealedRef = useRef(new Set());

  // Clear press state on unmount so tiles don't stay depressed after leaving worm mode
  useEffect(() => {
    return () => { pressState.tiles.clear(); };
  }, []);

  useFrame((state, delta) => {
    if (gameState !== 'playing') return;
    if (animState) return;

    // ── Press state: set depth=1 for current worm tiles, decay released tiles ──
    const currentPressedKeys = getPressedTileKeys(worm);
    pressState.tiles.forEach((_depth, key) => {
      if (currentPressedKeys.has(key)) return;
      const next = pressState.tiles.get(key) * 0.78;
      if (next < 0.01) pressState.tiles.delete(key);
      else pressState.tiles.set(key, next);
    });
    for (const key of currentPressedKeys) {
      pressState.tiles.set(key, 1.0);
    }

    // ── Healing check: fires every frame, guarded by recentlyHealedRef ──
    const candidates = checkHealingCandidates(cubies, size, worm);
    if (candidates.length > 0) {
      let updatedCubies = cubies;
      let healed = false;
      for (const c of candidates) {
        const key = positionKey(c);
        if (!recentlyHealedRef.current.has(key)) {
          updatedCubies = healSticker(updatedCubies, size, c.x, c.y, c.z, c.dirKey);
          recentlyHealedRef.current.add(key);
          setScore(s => s + CONFIG.healBonus);
          healed = true;
          setTimeout(() => recentlyHealedRef.current.delete(key), 500);
        }
      }
      if (healed) {
        setCubies(updatedCubies);
        play('/sounds/eat.mp3');
      }
    }

    // Track time alive (update display state at whole-second boundaries)
    const prevSecs = Math.floor(timeAliveAcc.current);
    timeAliveAcc.current += delta;
    const newSecs = Math.floor(timeAliveAcc.current);
    if (newSecs !== prevSecs) setTimeAlive(newSecs);

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

    if (checkSelfCollision(finalPos, worm, pendingGrowth > 0)) {
      setGameState('gameover');
      play('/sounds/gameover.mp3');
      return;
    }

    const orbKey = positionKey(finalPos);
    const orbIndex = orbs.findIndex(o => positionKey(o) === orbKey);

    // ateOrbColor is set this frame so we can apply color immediately (avoids stale pendingGrowth)
    let ateOrbColor = null;
    if (orbIndex !== -1) {
      ateOrbColor = orbs[orbIndex].color ?? null;
      lastOrbColorRef.current = ateOrbColor; // remember for all subsequent segments
      setOrbs(prev => prev.filter((_, i) => i !== orbIndex));
      // Push extra growth colors for growthPerOrb > 1 (first is handled this frame)
      for (let g = 1; g < CONFIG.growthPerOrb; g++) pendingGrowthColorsRef.current.push(ateOrbColor);
      setPendingGrowth(g => g + CONFIG.growthPerOrb - 1);
      setScore(s => s + 50 + (worm.length * 10));
      play('/sounds/eat.mp3');

      if (orbs.length === 1) {
        setGameState('victory');
        play('/sounds/victory.mp3');
      }
    }

    // segColor applies to every new segment — worm inherits color of last eaten orb
    const segColor = lastOrbColorRef.current;

    if (ateOrbColor !== null) {
      // Orb eaten this frame — grow immediately with orb color (bypasses stale pendingGrowth)
      setWorm(prev => [{ ...finalPos, moveDir, color: ateOrbColor }, ...prev]);
    } else if (pendingGrowth > 0) {
      const growthColor = pendingGrowthColorsRef.current.shift() ?? segColor;
      setPendingGrowth(g => g - 1);
      setWorm(prev => {
        const newHead = growthColor ? { ...finalPos, moveDir, color: growthColor } : { ...finalPos, moveDir };
        return [newHead, ...prev];
      });
    } else {
      // Regular movement — apply lastOrbColor so worm trail stays colored after eating
      const newHead = segColor ? { ...finalPos, moveDir, color: segColor } : { ...finalPos, moveDir };
      setWorm(prev => [newHead, ...prev].slice(0, -1));
    }
  });

  return null;
}

// ============================================================================
// TUNNEL MODE - Worm travels inside the cube through antipodal wormhole tunnels
// ============================================================================

// Custom hook for TUNNEL mode game logic
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
    lastOrbColorRef,

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
    pendingGrowthColorsRef,
    lastOrbColorRef,
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

    // Determine growth state BEFORE collision check so we can exclude the tail
    // correctly — when growing, the tail stays; when not growing, it vacates.
    const growing = pendingGrowth > 0;

    // Check for self-collision
    const newHead = {
      tunnelId: newTunnelId,
      t: Math.max(0, Math.min(1, newT)),
      tunnel: newTunnel,
      direction: newDirection
    };
    if (checkTunnelSelfCollision(newHead, worm, growing)) {
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

    // ateOrbColor set this frame so color applies immediately (avoids stale pendingGrowth)
    let ateOrbColor = null;
    if (orbIndex !== -1) {
      ateOrbColor = orbs[orbIndex].color ?? null;
      lastOrbColorRef.current = ateOrbColor;
      setOrbs(prev => prev.filter((_, i) => i !== orbIndex));
      for (let g = 1; g < TUNNEL_CONFIG.growthPerOrb; g++) pendingGrowthColorsRef.current.push(ateOrbColor);
      setPendingGrowth(g => g + TUNNEL_CONFIG.growthPerOrb - 1);
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

    // segColor keeps the worm colored after an orb pickup
    const segColor = lastOrbColorRef.current;

    // Update worm positions
    let growthColor;
    let effectiveGrowing = growing;
    if (ateOrbColor !== null) {
      growthColor = ateOrbColor; // use orb color immediately
      effectiveGrowing = true;   // grow this frame without waiting for pendingGrowth state
    } else {
      growthColor = growing ? (pendingGrowthColorsRef.current.shift() ?? segColor) : segColor;
      if (growing) setPendingGrowth(g => g - 1);
    }

    setWorm(prev => {
      const head = growthColor ? { ...newHead, color: growthColor } : newHead;
      const newWorm = [head];

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
          direction: seg.direction ?? 1,
          color: seg.color
        });
      }

      return effectiveGrowing ? newWorm : newWorm.slice(0, -1);
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
