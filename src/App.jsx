// src/App.jsx
import React, { useState, useMemo, useRef, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import './App.css';

// Utils
import { play } from './utils/audio.js';

// Game logic
import { makeCubies } from './game/cubeState.js';
import { rotateSliceCubies } from './game/cubeRotation.js';
import { buildManifoldGridMap, flipStickerPair, findAntipodalStickerByGrid, getManifoldNeighbors } from './game/manifoldLogic.js';
import { detectWinConditions } from './game/winDetection.js';
import { getStickerWorldPos } from './game/coordinates.js';
import { FACE_COLORS, ANTIPODAL_COLOR } from './utils/constants.js';

// 3D components
import CubeAssembly from './3d/CubeAssembly.jsx';
import BlackHoleEnvironment from './3d/BlackHoleEnvironment.jsx';

// WORM mode
import {
  WormModeProvider,
  WormModeCanvasElements,
  WormModeHUD,
  WormModeStartScreen
} from './worm/WormModeGame.jsx';
import WormTouchControls from './worm/WormTouchControls.jsx';

// UI components
import TopMenuBar from './components/menus/TopMenuBar.jsx';
import MainMenu from './components/menus/MainMenu.jsx';
import SettingsMenu from './components/menus/SettingsMenu.jsx';
import HelpMenu from './components/menus/HelpMenu.jsx';
import WelcomeScreen from './components/screens/WelcomeScreen.jsx';
import VictoryScreen from './components/screens/VictoryScreen.jsx';
import Tutorial from './components/screens/Tutorial.jsx';
import FirstFlipTutorial from './components/screens/FirstFlipTutorial.jsx';
import RotationPreview from './components/overlays/RotationPreview.jsx';

export default function WORM3() {
  const [showWelcome, setShowWelcome] = useState(true);

  const [size, setSize] = useState(3);
  const [cubies, setCubies] = useState(() => makeCubies(size));
  const [moves, setMoves] = useState(0);
  const [visualMode, setVisualMode] = useState('classic');
  const [flipMode, setFlipMode] = useState(true);
  const [chaosLevel, setChaosLevel] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMainMenu, setShowMainMenu] = useState(true);

  // Win condition state
  const [victory, setVictory] = useState(null); // null, 'rubiks', 'sudokube', 'ultimate', or 'worm'
  const [achievedWins, setAchievedWins] = useState({ rubiks: false, sudokube: false, ultimate: false, worm: false });
  const [gameTime, setGameTime] = useState(0);
  const gameStartTime = useRef(Date.now());
  const [hasShuffled, setHasShuffled] = useState(false); // Only check wins after shuffle

  // Keyboard cursor state for speedcube controls
  // face: which face the cursor is on (PZ, NZ, PX, NX, PY, NY)
  // row/col: position on that face (0 to size-1)
  const [cursor, setCursor] = useState({ face: 'PZ', row: 1, col: 1 });
  const [showCursor, setShowCursor] = useState(false); // Show cursor when keyboard is used

  const chaosMode = chaosLevel > 0;

  const [animState, setAnimState] = useState(null);
  const [pendingMove, setPendingMove] = useState(null);

  const [showTutorial, setShowTutorial] = useState(false);
  const [hasFlippedOnce, setHasFlippedOnce] = useState(() => {
    try {
      return localStorage.getItem('worm3_first_flip_done') === '1';
    } catch {
      return false;
    }
  });
  const [showFirstFlipTutorial, setShowFirstFlipTutorial] = useState(false);

  const [showTunnels, setShowTunnels] = useState(true);
  const [exploded, setExploded] = useState(false);
  const [explosionT, setExplosionT] = useState(0);
  const [cascades, setCascades] = useState([]);
  const [blackHolePulse, setBlackHolePulse] = useState(0); // Timestamp of last flip for black hole pulse
  const [flipWaveOrigins, setFlipWaveOrigins] = useState([]); // Origins for propagation wave effect

  // Auto-rotate mode state
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(false);

  // WORM mode state
  const [wormModeActive, setWormModeActive] = useState(false);
  const [showWormModeStart, setShowWormModeStart] = useState(false);
  const [wormGameData, setWormGameData] = useState(null); // Game state from inside Canvas

  const [upcomingRotation, setUpcomingRotation] = useState(null); // { axis, dir, sliceIndex }
  const [rotationCountdown, setRotationCountdown] = useState(0); // Time until next rotation (ms)
  const cubiesRef = useRef(cubies); // Ref to track current cubies for auto-rotate effect
  cubiesRef.current = cubies; // Keep ref updated

  const handleWelcomeComplete = () => {
    setShowWelcome(false);
    try {
      localStorage.setItem('worm3_intro_seen', '1');
    } catch {}
    setShowTutorial(true);
  };

  const closeTutorial = () => {
    setShowTutorial(false);
    try {
      localStorage.setItem('worm3_tutorial_done', '1');
    } catch {}
  };

  useEffect(() => {
    let raf;
    const animate = () => {
      setExplosionT((t) => {
        if (exploded && t < 1) return Math.min(1, t + 0.05);
        if (!exploded && t > 0) return Math.max(0, t - 0.05);
        return t;
      });
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [exploded]);

  const manifoldMap = useMemo(() => {
    // Guard against size/cubies mismatch during size transitions
    if (cubies.length !== size) return new Map();
    return buildManifoldGridMap(cubies, size);
  }, [cubies, size]);

  const metrics = useMemo(() => {
    let flips = 0,
      wormholes = 0,
      off = 0,
      total = 0;
    for (const L of cubies)
      for (const R of L)
        for (const c of R) {
          for (const k of Object.keys(c.stickers)) {
            const s = c.stickers[k];
            flips += s.flips || 0;
            total++;
            if (s.curr !== s.orig) off++;
            if (s.flips > 0 && s.curr !== s.orig) wormholes++;
          }
        }
    return { flips, wormholes, entropy: Math.round((off / total) * 100) };
  }, [cubies]);

  // Game timer
  useEffect(() => {
    if (victory) return; // Pause timer when victory screen is showing
    const interval = setInterval(() => {
      setGameTime(Math.floor((Date.now() - gameStartTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [victory]);

  // Win condition detection
  useEffect(() => {
    // Only check for wins after the puzzle has been shuffled
    if (!hasShuffled) return;
    // Don't check if victory screen is already showing
    if (victory) return;
    // Guard: ensure cubies matches expected size (prevents race condition on size change)
    if (cubies.length !== size) return;

    const wins = detectWinConditions(cubies, size);

    // Prioritize worm victory (rarest), then ultimate, then individual wins
    if (wins.worm && !achievedWins.worm) {
      setVictory('worm');
      setAchievedWins((prev) => ({ ...prev, worm: true }));
    } else if (wins.ultimate && !achievedWins.ultimate) {
      setVictory('ultimate');
      setAchievedWins((prev) => ({ ...prev, ultimate: true, rubiks: true, sudokube: true }));
    } else if (wins.rubiks && !achievedWins.rubiks) {
      setVictory('rubiks');
      setAchievedWins((prev) => ({ ...prev, rubiks: true }));
    } else if (wins.sudokube && !achievedWins.sudokube) {
      setVictory('sudokube');
      setAchievedWins((prev) => ({ ...prev, sudokube: true }));
    }
  }, [cubies, size, hasShuffled, victory, achievedWins]);

  useEffect(() => {
    setCubies(makeCubies(size));
    setMoves(0);
    setAnimState(null);
    // Reset win tracking when size changes
    setVictory(null);
    setAchievedWins({ rubiks: false, sudokube: false, ultimate: false, worm: false });
    gameStartTime.current = Date.now();
    setGameTime(0);
    setHasShuffled(false); // Require shuffle for new size
  }, [size]);

  useEffect(() => {
    if (!chaosMode) return;
    let raf = 0,
      last = performance.now(),
      tickAcc = 0,
      burstAcc = 0;

    // Propagation speed stays constant (350ms between ticks)
    const tickPeriod = 350;
    // Burst duration scales with level: 1s, 2s, 3s, 4s
    const burstDuration = chaosLevel * 1000;
    // Cooldown between bursts (same as burst duration for balance)
    const cooldownDuration = burstDuration;
    // Base probability scales with level: 3%, 6%, 9%, 12% per flip tally
    const basePerTally = chaosLevel * 0.03;

    let inBurst = true; // Start in active burst

    const step = (state) => {
      const S = state.length;
      const unstable = [];

      for (let x = 0; x < S; x++)
        for (let y = 0; y < S; y++)
          for (let z = 0; z < S; z++) {
            const c = state[x][y][z];
            for (const dirKey of Object.keys(c.stickers)) {
              const st = c.stickers[dirKey];
              const onEdge =
                (dirKey === 'PX' && x === S - 1) ||
                (dirKey === 'NX' && x === 0) ||
                (dirKey === 'PY' && y === S - 1) ||
                (dirKey === 'NY' && y === 0) ||
                (dirKey === 'PZ' && z === S - 1) ||
                (dirKey === 'NZ' && z === 0);
              if (st.flips > 0 && st.curr !== st.orig && onEdge) unstable.push({ x, y, z, dirKey, flips: st.flips });
            }
          }

      if (!unstable.length) return state;

      // Compute manifoldMap from current state to avoid stale closure
      const currentManifoldMap = buildManifoldGridMap(state, S);

      const src = unstable[Math.floor(Math.random() * unstable.length)];
      // Probability scales with flip tally: level% per tally
      const pSelf = basePerTally * src.flips;
      const pN = basePerTally * src.flips * 0.6;

      let next = state;
      if (Math.random() < pSelf) {
        next = flipStickerPair(next, S, src.x, src.y, src.z, src.dirKey, currentManifoldMap);
      }

      // Get manifold neighbors (includes cross-face neighbors at edges)
      const neighbors = getManifoldNeighbors(src.x, src.y, src.z, src.dirKey, S);

      for (const neighbor of neighbors) {
        if (Math.random() < pN) {
          // Use the neighbor's dirKey (may be different face for cross-face propagation)
          next = flipStickerPair(next, S, neighbor.x, neighbor.y, neighbor.z, neighbor.dirKey, currentManifoldMap);

          const fromPos = getStickerWorldPos(src.x, src.y, src.z, src.dirKey, S, explosionT);
          const toPos = getStickerWorldPos(neighbor.x, neighbor.y, neighbor.z, neighbor.dirKey, S, explosionT);

          setCascades((prev) => [
            ...prev,
            {
              id: Date.now() + Math.random(),
              from: fromPos,
              to: toPos
            }
          ]);
        }
      }

      return next;
    };

    const loop = (now) => {
      const dt = now - last;
      last = now;
      burstAcc += dt;

      // Toggle between burst and cooldown phases
      if (inBurst && burstAcc >= burstDuration) {
        inBurst = false;
        burstAcc = 0;
      } else if (!inBurst && burstAcc >= cooldownDuration) {
        inBurst = true;
        burstAcc = 0;
      }

      // Only tick propagation during active burst
      if (inBurst) {
        tickAcc += dt;
        if (tickAcc >= tickPeriod) {
          setCubies((prev) => step(prev));
          tickAcc = 0;
        }
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [chaosMode, chaosLevel, explosionT]);

  // Helper: count stickers where curr !== orig (disparity)
  const countDisparity = (state) => {
    let count = 0;
    const S = state.length;
    for (let x = 0; x < S; x++)
      for (let y = 0; y < S; y++)
        for (let z = 0; z < S; z++) {
          const c = state[x][y][z];
          for (const dirKey of Object.keys(c.stickers)) {
            const st = c.stickers[dirKey];
            // Only count visible stickers (on face edges)
            const onEdge =
              (dirKey === 'PX' && x === S - 1) ||
              (dirKey === 'NX' && x === 0) ||
              (dirKey === 'PY' && y === S - 1) ||
              (dirKey === 'NY' && y === 0) ||
              (dirKey === 'PZ' && z === S - 1) ||
              (dirKey === 'NZ' && z === 0);
            if (onEdge && st.curr !== st.orig) count++;
          }
        }
    return count;
  };

  // Helper: generate a random rotation
  const generateRandomRotation = (cubeSize) => {
    const axes = ['col', 'row', 'depth'];
    const axis = axes[Math.floor(Math.random() * axes.length)];
    const dir = Math.random() < 0.5 ? 1 : -1;
    const sliceIndex = Math.floor(Math.random() * cubeSize);
    return { axis, dir, sliceIndex };
  };

  // Auto-rotate effect: disparity-based random rotations
  useEffect(() => {
    if (!autoRotateEnabled || !chaosMode) {
      setUpcomingRotation(null);
      setRotationCountdown(0);
      return;
    }

    // Initialize upcoming rotation if not set
    if (!upcomingRotation) {
      setUpcomingRotation(generateRandomRotation(size));
    }

    let raf = 0;
    let last = performance.now();

    const loop = (now) => {
      const dt = now - last;
      last = now;

      // Skip if animation is in progress
      if (animState) {
        raf = requestAnimationFrame(loop);
        return;
      }

      // Calculate interval based on disparity (use ref for current state)
      const disparity = countDisparity(cubiesRef.current);
      const maxDisparity = size * size * 6; // Total visible stickers
      const disparityRatio = Math.min(1, disparity / maxDisparity);

      // 10s at 0 disparity, 0.75s at 100% disparity - Level 4 should be intense
      const maxInterval = 10000;
      const minInterval = 750;
      const targetInterval = maxInterval - disparityRatio * (maxInterval - minInterval);

      setRotationCountdown((prev) => {
        const newCountdown = prev - dt;

        if (newCountdown <= 0) {
          // Execute the rotation
          if (upcomingRotation) {
            const { axis, dir, sliceIndex } = upcomingRotation;
            setAnimState({ axis, dir, sliceIndex, t: 0 });
            setPendingMove({ axis, dir, sliceIndex });
          }
          // Generate next rotation
          setUpcomingRotation(generateRandomRotation(size));
          return targetInterval;
        }

        return newCountdown;
      });

      raf = requestAnimationFrame(loop);
    };

    // Initialize countdown based on current disparity (use ref for current state)
    const disparity = countDisparity(cubiesRef.current);
    const maxDisparity = size * size * 6;
    const disparityRatio = Math.min(1, disparity / maxDisparity);
    const initialInterval = 10000 - disparityRatio * 9250;
    setRotationCountdown(initialInterval);

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [autoRotateEnabled, chaosMode, size, animState, upcomingRotation]);

  const handleAnimComplete = () => {
    if (pendingMove) {
      const { axis, dir, sliceIndex } = pendingMove;
      setCubies((prev) => rotateSliceCubies(prev, size, axis, sliceIndex, dir));
      setMoves((m) => m + 1);
      play('/sounds/rotate.mp3');
    }
    setAnimState(null);
    setPendingMove(null);
  };

  const onMove = (axis, dir, sel) => {
    const sliceIndex = axis === 'col' ? sel.x : axis === 'row' ? sel.y : sel.z;
    setAnimState({ axis, dir, sliceIndex, t: 0 });
    setPendingMove({ axis, dir, sliceIndex });
  };

  const onTapFlip = (pos, dirKey) => {
    // Calculate wave origins before updating state
    const currentManifoldMap = buildManifoldGridMap(cubies, size);
    const sticker = cubies[pos.x]?.[pos.y]?.[pos.z]?.stickers?.[dirKey];

    if (sticker) {
      // Get the antipodal sticker location
      const antipodalLoc = findAntipodalStickerByGrid(currentManifoldMap, sticker, size);

      // Calculate rotation based on face direction
      const getRotationForDir = (dir) => {
        switch (dir) {
          case 'PX': return [0, Math.PI / 2, 0];
          case 'NX': return [0, -Math.PI / 2, 0];
          case 'PY': return [-Math.PI / 2, 0, 0];
          case 'NY': return [Math.PI / 2, 0, 0];
          case 'PZ': return [0, 0, 0];
          case 'NZ': return [0, Math.PI, 0];
          default: return [0, 0, 0];
        }
      };

      // Build wave origins from both positions
      const origins = [];
      const antipodalColor = FACE_COLORS[ANTIPODAL_COLOR[sticker.curr]];

      // Origin 1: The clicked sticker
      origins.push({
        position: getStickerWorldPos(pos.x, pos.y, pos.z, dirKey, size, explosionT),
        rotation: getRotationForDir(dirKey),
        color: antipodalColor,
        id: Date.now()
      });

      // Origin 2: The antipodal pair
      if (antipodalLoc) {
        const antipodalSticker = cubies[antipodalLoc.x]?.[antipodalLoc.y]?.[antipodalLoc.z]?.stickers?.[antipodalLoc.dirKey];
        const pairAntipodalColor = FACE_COLORS[ANTIPODAL_COLOR[antipodalSticker?.curr || 1]];
        origins.push({
          position: getStickerWorldPos(antipodalLoc.x, antipodalLoc.y, antipodalLoc.z, antipodalLoc.dirKey, size, explosionT),
          rotation: getRotationForDir(antipodalLoc.dirKey),
          color: pairAntipodalColor,
          id: Date.now() + 1
        });
      }

      setFlipWaveOrigins(origins);
    }

    setCubies((prev) => {
      // Compute manifoldMap from current state to avoid stale closure
      const freshManifoldMap = buildManifoldGridMap(prev, size);
      return flipStickerPair(prev, size, pos.x, pos.y, pos.z, dirKey, freshManifoldMap);
    });
    setMoves((m) => m + 1);

    // Trigger black hole pulse effect
    setBlackHolePulse(Date.now());

    // Trigger first-flip tutorial
    if (!hasFlippedOnce) {
      setHasFlippedOnce(true);
      try {
        localStorage.setItem('worm3_first_flip_done', '1');
      } catch {}
      // Small delay so user sees the flip animation first
      setTimeout(() => setShowFirstFlipTutorial(true), 600);
    }
  };

  const onFlipWaveComplete = () => {
    setFlipWaveOrigins([]);
  };

  const onCascadeComplete = (id) => {
    setCascades((prev) => prev.filter((c) => c.id !== id));
  };

  const shuffle = () => {
    let state = makeCubies(size);
    for (let i = 0; i < 25; i++) {
      const ax = ['row', 'col', 'depth'][Math.floor(Math.random() * 3)];
      const slice = Math.floor(Math.random() * size);
      const dir = Math.random() > 0.5 ? 1 : -1;
      state = rotateSliceCubies(state, size, ax, slice, dir);
    }
    setCubies(state);
    setMoves(0);
    // Reset win tracking for new game
    setVictory(null);
    setAchievedWins({ rubiks: false, sudokube: false, ultimate: false, worm: false });
    gameStartTime.current = Date.now();
    setGameTime(0);
    setHasShuffled(true); // Enable win detection
  };

  const reset = () => {
    setCubies(makeCubies(size));
    setMoves(0);
    play('/sounds/rotate.mp3');
    // Reset win tracking
    setVictory(null);
    setAchievedWins({ rubiks: false, sudokube: false, ultimate: false, worm: false });
    gameStartTime.current = Date.now();
    setGameTime(0);
    setHasShuffled(false); // Disable win detection until next shuffle
  };

  // WORM mode handlers
  const handleWormModeStart = () => {
    setShowWormModeStart(false);
    setWormModeActive(true);
    // Reset the cube for a fresh worm game
    setCubies(makeCubies(size));
  };

  const handleWormModeQuit = () => {
    setWormModeActive(false);
  };

  const onWormRotate = (axis, dir, sliceIndex) => {
    setAnimState({ axis, dir, sliceIndex, t: 0 });
    setPendingMove({ axis, dir, sliceIndex });
  };

  // Victory screen handlers
  const handleVictoryContinue = () => {
    // Dismiss victory screen but keep playing
    setVictory(null);
  };

  const handleVictoryNewGame = () => {
    // Start a fresh shuffled game
    setVictory(null);
    shuffle();
  };

  // Convert cursor (face, row, col) to cube coordinates (x, y, z) and dirKey
  const cursorToCubePos = (cur) => {
    const { face, row, col } = cur;
    const maxIdx = size - 1;

    switch (face) {
      case 'PZ': // Front face (red) - z = maxIdx
        return { x: col, y: maxIdx - row, z: maxIdx, dirKey: 'PZ' };
      case 'NZ': // Back face (orange) - z = 0
        return { x: maxIdx - col, y: maxIdx - row, z: 0, dirKey: 'NZ' };
      case 'PX': // Right face (blue) - x = maxIdx
        return { x: maxIdx, y: maxIdx - row, z: maxIdx - col, dirKey: 'PX' };
      case 'NX': // Left face (green) - x = 0
        return { x: 0, y: maxIdx - row, z: col, dirKey: 'NX' };
      case 'PY': // Top face (white) - y = maxIdx
        return { x: col, y: maxIdx, z: row, dirKey: 'PY' };
      case 'NY': // Bottom face (yellow) - y = 0
        return { x: col, y: 0, z: maxIdx - row, dirKey: 'NY' };
      default:
        return { x: 1, y: 1, z: maxIdx, dirKey: 'PZ' };
    }
  };

  // Convert cube coordinates (x, y, z) + dirKey to cursor (face, row, col)
  const cubePosToCursor = (pos, dirKey) => {
    const { x, y, z } = pos;
    const maxIdx = size - 1;

    switch (dirKey) {
      case 'PZ': // Front face - z = maxIdx
        return { face: 'PZ', row: maxIdx - y, col: x };
      case 'NZ': // Back face - z = 0
        return { face: 'NZ', row: maxIdx - y, col: maxIdx - x };
      case 'PX': // Right face - x = maxIdx
        return { face: 'PX', row: maxIdx - y, col: maxIdx - z };
      case 'NX': // Left face - x = 0
        return { face: 'NX', row: maxIdx - y, col: z };
      case 'PY': // Top face - y = maxIdx
        return { face: 'PY', row: z, col: x };
      case 'NY': // Bottom face - y = 0
        return { face: 'NY', row: maxIdx - z, col: x };
      default:
        return { face: 'PZ', row: 1, col: 1 };
    }
  };

  // Handle tile selection (left click)
  const handleSelectTile = (pos, dirKey) => {
    const newCursor = cubePosToCursor(pos, dirKey);
    setCursor(newCursor);
    setShowCursor(true);
  };

  // Move cursor with face wrapping
  const moveCursor = (direction) => {
    setCursor((cur) => {
      const { face, row, col } = cur;
      const maxIdx = size - 1;

      // Define face adjacencies for wrapping
      // Format: { direction: [newFace, transformRow, transformCol] }
      const adjacencies = {
        PZ: {
          // Front
          up: ['PY', (r, c) => [maxIdx, c]],
          down: ['NY', (r, c) => [0, c]],
          left: ['NX', (r, c) => [r, maxIdx]],
          right: ['PX', (r, c) => [r, 0]]
        },
        NZ: {
          // Back
          up: ['PY', (r, c) => [0, maxIdx - c]],
          down: ['NY', (r, c) => [maxIdx, maxIdx - c]],
          left: ['PX', (r, c) => [r, maxIdx]],
          right: ['NX', (r, c) => [r, 0]]
        },
        PX: {
          // Right
          up: ['PY', (r, c) => [maxIdx - c, maxIdx]],
          down: ['NY', (r, c) => [c, maxIdx]],
          left: ['PZ', (r, c) => [r, maxIdx]],
          right: ['NZ', (r, c) => [r, 0]]
        },
        NX: {
          // Left
          up: ['PY', (r, c) => [c, 0]],
          down: ['NY', (r, c) => [maxIdx - c, 0]],
          left: ['NZ', (r, c) => [r, maxIdx]],
          right: ['PZ', (r, c) => [r, 0]]
        },
        PY: {
          // Top
          up: ['NZ', (r, c) => [0, maxIdx - c]],
          down: ['PZ', (r, c) => [0, c]],
          left: ['NX', (r, c) => [0, c]],
          right: ['PX', (r, c) => [0, maxIdx - c]]
        },
        NY: {
          // Bottom
          up: ['PZ', (r, c) => [maxIdx, c]],
          down: ['NZ', (r, c) => [maxIdx, maxIdx - c]],
          left: ['NX', (r, c) => [maxIdx, maxIdx - c]],
          right: ['PX', (r, c) => [maxIdx, c]]
        }
      };

      let newRow = row,
        newCol = col,
        newFace = face;

      switch (direction) {
        case 'up':
          if (row > 0) {
            newRow = row - 1;
          } else {
            const [nf, transform] = adjacencies[face].up;
            newFace = nf;
            [newRow, newCol] = transform(row, col);
          }
          break;
        case 'down':
          if (row < maxIdx) {
            newRow = row + 1;
          } else {
            const [nf, transform] = adjacencies[face].down;
            newFace = nf;
            [newRow, newCol] = transform(row, col);
          }
          break;
        case 'left':
          if (col > 0) {
            newCol = col - 1;
          } else {
            const [nf, transform] = adjacencies[face].left;
            newFace = nf;
            [newRow, newCol] = transform(row, col);
          }
          break;
        case 'right':
          if (col < maxIdx) {
            newCol = col + 1;
          } else {
            const [nf, transform] = adjacencies[face].right;
            newFace = nf;
            [newRow, newCol] = transform(row, col);
          }
          break;
      }

      return { face: newFace, row: newRow, col: newCol };
    });
    setShowCursor(true);
  };

  // Perform rotation based on cursor position
  // Rotations are relative to looking at the face the cursor is on
  const performCursorRotation = (rotationType) => {
    if (animState) return; // Don't allow rotation during animation

    const pos = cursorToCubePos(cursor);
    const { face } = cursor;

    // Determine axis and direction based on face and rotation type
    // W/S move the row (horizontal slice) up/down visually
    // A/D move the column (vertical slice) left/right visually
    // Q/E rotate the face itself CCW/CW

    let axis, dir;

    switch (rotationType) {
      case 'up': // W - move pieces upward on screen
        // Rotates the column slice that the cursor is on
        switch (face) {
          case 'PZ':
            axis = 'col';
            dir = -1;
            break;
          case 'NZ':
            axis = 'col';
            dir = 1;
            break;
          case 'PX':
            axis = 'depth';
            dir = 1;
            break;
          case 'NX':
            axis = 'depth';
            dir = -1;
            break;
          case 'PY':
            axis = 'depth';
            dir = -1;
            break;
          case 'NY':
            axis = 'depth';
            dir = 1;
            break;
        }
        break;

      case 'down': // S - move pieces downward on screen
        switch (face) {
          case 'PZ':
            axis = 'col';
            dir = 1;
            break;
          case 'NZ':
            axis = 'col';
            dir = -1;
            break;
          case 'PX':
            axis = 'depth';
            dir = -1;
            break;
          case 'NX':
            axis = 'depth';
            dir = 1;
            break;
          case 'PY':
            axis = 'depth';
            dir = 1;
            break;
          case 'NY':
            axis = 'depth';
            dir = -1;
            break;
        }
        break;

      case 'left': // A - move pieces leftward on screen
        switch (face) {
          case 'PZ':
            axis = 'row';
            dir = -1;
            break;
          case 'NZ':
            axis = 'row';
            dir = -1;
            break;
          case 'PX':
            axis = 'row';
            dir = -1;
            break;
          case 'NX':
            axis = 'row';
            dir = -1;
            break;
          case 'PY':
            axis = 'col';
            dir = -1;
            break;
          case 'NY':
            axis = 'col';
            dir = 1;
            break;
        }
        break;

      case 'right': // D - move pieces rightward on screen
        switch (face) {
          case 'PZ':
            axis = 'row';
            dir = 1;
            break;
          case 'NZ':
            axis = 'row';
            dir = 1;
            break;
          case 'PX':
            axis = 'row';
            dir = 1;
            break;
          case 'NX':
            axis = 'row';
            dir = 1;
            break;
          case 'PY':
            axis = 'col';
            dir = 1;
            break;
          case 'NY':
            axis = 'col';
            dir = -1;
            break;
        }
        break;

      case 'ccw': // Q - rotate face counter-clockwise (from viewer's perspective looking at cube)
        switch (face) {
          case 'PZ':
            axis = 'depth';
            dir = 1;
            break;
          case 'NZ':
            axis = 'depth';
            dir = 1;
            break; // same as PZ from front view
          case 'PX':
            axis = 'col';
            dir = 1;
            break; // flipped for side view
          case 'NX':
            axis = 'col';
            dir = -1;
            break; // flipped for side view
          case 'PY':
            axis = 'row';
            dir = -1;
            break; // flipped for top view
          case 'NY':
            axis = 'row';
            dir = 1;
            break; // flipped for bottom view
        }
        break;

      case 'cw': // E - rotate face clockwise (from viewer's perspective looking at cube)
        switch (face) {
          case 'PZ':
            axis = 'depth';
            dir = -1;
            break;
          case 'NZ':
            axis = 'depth';
            dir = -1;
            break; // same as PZ from front view
          case 'PX':
            axis = 'col';
            dir = -1;
            break; // flipped for side view
          case 'NX':
            axis = 'col';
            dir = 1;
            break; // flipped for side view
          case 'PY':
            axis = 'row';
            dir = 1;
            break; // flipped for top view
          case 'NY':
            axis = 'row';
            dir = -1;
            break; // flipped for bottom view
        }
        break;
    }

    if (axis && dir !== undefined) {
      onMove(axis, dir, pos);
    }
    setShowCursor(true);
  };

  // Flip the tile at cursor position
  const performCursorFlip = () => {
    const pos = cursorToCubePos(cursor);
    onTapFlip({ x: pos.x, y: pos.y, z: pos.z }, pos.dirKey);
    setShowCursor(true);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.key.toLowerCase();

      // Arrow keys - cursor movement
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveCursor('up');
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveCursor('down');
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        moveCursor('left');
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        moveCursor('right');
        return;
      }

      // WASDQE - rotation controls
      if (key === 'w') {
        e.preventDefault();
        performCursorRotation('up');
        return;
      }
      if (key === 's') {
        e.preventDefault();
        performCursorRotation('down');
        return;
      }
      if (key === 'a') {
        e.preventDefault();
        performCursorRotation('left');
        return;
      }
      if (key === 'd') {
        e.preventDefault();
        performCursorRotation('right');
        return;
      }
      if (key === 'q') {
        e.preventDefault();
        performCursorRotation('ccw');
        return;
      }
      if (key === 'e') {
        e.preventDefault();
        performCursorRotation('cw');
        return;
      }

      // F - flip at cursor (only if flipMode is on)
      if (key === 'f') {
        e.preventDefault();
        if (flipMode) performCursorFlip();
        return;
      }

      // Other shortcuts
      switch (key) {
        case 'h':
        case '?':
          setShowHelp((h) => !h);
          break;
        case 'g': // Changed from 'f' - toggle flip mode for mouse
          setFlipMode((f) => !f);
          break;
        case 't':
          setShowTunnels((t) => !t);
          break;
        case 'x': // Changed from 'e' - toggle exploded view
          setExploded((ex) => !ex);
          break;
        case 'v':
          setVisualMode((v) => (v === 'classic' ? 'grid' : v === 'grid' ? 'sudokube' : v === 'sudokube' ? 'wireframe' : 'classic'));
          break;
        case 'c':
          setChaosLevel((l) => (l > 0 ? 0 : 1));
          break;
        case 'escape':
          setShowHelp(false);
          setShowSettings(false);
          setShowCursor(false); // Hide cursor on escape
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cursor, animState, size, flipMode]);

  const cameraZ = { 2: 8, 3: 10, 4: 14, 5: 18 }[size] || 10;

  if (showWelcome) {
    return <WelcomeScreen onEnter={handleWelcomeComplete} />;
  }

  return (
    <div className="full-screen">
      {showTutorial && <Tutorial onClose={closeTutorial} />}

      <div className="canvas-container" onContextMenu={(e) => e.preventDefault()}>
        <Canvas camera={{ position: [0, 0, cameraZ], fov: 40 }}>
          {/* Premium lighting setup */}
          <ambientLight intensity={visualMode === 'wireframe' ? 0.2 : 0.8} />
          <directionalLight position={[5, 8, 5]} intensity={visualMode === 'wireframe' ? 0.3 : 1.2} castShadow />
          <pointLight position={[10, 10, 10]} intensity={visualMode === 'wireframe' ? 0.3 : 0.8} />
          <pointLight position={[-10, -10, -10]} intensity={visualMode === 'wireframe' ? 0.2 : 0.6} />
          {visualMode === 'wireframe' && (
            <>
              <pointLight position={[0, 0, 0]} intensity={0.5} color="#fefae0" distance={15} decay={2} />
              <pointLight position={[5, 5, 5]} intensity={0.25} color="#dda15e" />
              <pointLight position={[-5, -5, -5]} intensity={0.2} color="#bc6c25" />
            </>
          )}
          <Suspense fallback={null}>
            <BlackHoleEnvironment flipTrigger={blackHolePulse} />
            <Environment preset="city" />

            {/* WORM Mode - wraps everything when active */}
            {wormModeActive ? (
              <WormModeProvider
                cubies={cubies}
                size={size}
                animState={animState}
                onRotate={onWormRotate}
                onGameStateChange={setWormGameData}
              >
                <WormModeCanvasElements
                  size={size}
                  explosionFactor={explosionT}
                  animState={animState}
                  cubies={cubies}
                />
                <CubeAssembly
                  size={size}
                  cubies={cubies}
                  onMove={onMove}
                  onTapFlip={onTapFlip}
                  visualMode={visualMode}
                  animState={animState}
                  onAnimComplete={handleAnimComplete}
                  showTunnels={showTunnels}
                  explosionFactor={explosionT}
                  cascades={cascades}
                  onCascadeComplete={onCascadeComplete}
                  manifoldMap={manifoldMap}
                  showInvitation={false}
                  cursor={cursor}
                  showCursor={false}
                  flipMode={false}
                  onSelectTile={handleSelectTile}
                  flipWaveOrigins={flipWaveOrigins}
                  onFlipWaveComplete={onFlipWaveComplete}
                />
              </WormModeProvider>
            ) : (
              <CubeAssembly
              size={size}
              cubies={cubies}
              onMove={onMove}
              onTapFlip={onTapFlip}
              visualMode={visualMode}
              animState={animState}
              onAnimComplete={handleAnimComplete}
              showTunnels={showTunnels}
              explosionFactor={explosionT}
              cascades={cascades}
              onCascadeComplete={onCascadeComplete}
              manifoldMap={manifoldMap}
              showInvitation={!hasFlippedOnce}
              cursor={cursor}
              showCursor={showCursor}
              flipMode={flipMode}
              onSelectTile={handleSelectTile}
              flipWaveOrigins={flipWaveOrigins}
              onFlipWaveComplete={onFlipWaveComplete}
            />
            )}
          </Suspense>
        </Canvas>
      </div>

      <div className="ui-layer">
        <TopMenuBar
          moves={moves}
          metrics={metrics}
          size={size}
          visualMode={visualMode}
          flipMode={flipMode}
          chaosMode={chaosMode}
          chaosLevel={chaosLevel}
          cubies={cubies}
          onShowHelp={() => setShowHelp(true)}
          onShowSettings={() => setShowSettings(true)}
          achievedWins={achievedWins}
        />

        {/* Auto-rotate Preview */}
        {autoRotateEnabled && chaosMode && (
          <RotationPreview
            upcomingRotation={upcomingRotation}
            countdown={rotationCountdown}
            maxCountdown={10000}
            size={size}
          />
        )}

        {/* Bottom Section - Controls & Manifold Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div className="controls-compact ui-element">
            <div className="controls-row">
              <button className={`btn-compact text ${flipMode ? 'active' : ''}`} onClick={() => setFlipMode(!flipMode)}>
                FLIP
              </button>
              <button className={`btn-compact text ${chaosMode ? 'chaos' : ''}`} onClick={() => setChaosLevel((l) => (l > 0 ? 0 : 1))}>
                CHAOS
              </button>
              {chaosMode && (
                <>
                  <div className="chaos-levels">
                    {[1, 2, 3, 4].map((l) => (
                      <button key={l} className={`btn-level ${chaosLevel === l ? 'active' : ''}`} onClick={() => setChaosLevel(l)}>
                        L{l}
                      </button>
                    ))}
                  </div>
                  <button
                    className={`btn-compact text ${autoRotateEnabled ? 'active' : ''}`}
                    onClick={() => setAutoRotateEnabled(!autoRotateEnabled)}
                    title="Auto-rotate based on disparity"
                  >
                    AUTO
                  </button>
                </>
              )}
              <button className={`btn-compact text ${exploded ? 'active' : ''}`} onClick={() => setExploded(!exploded)}>
                EXPLODE
              </button>
              <button className={`btn-compact text ${showTunnels ? 'active' : ''}`} onClick={() => setShowTunnels(!showTunnels)}>
                TUNNELS
              </button>
              <button
                className="btn-compact text"
                onClick={() =>
                  setVisualMode((v) => (v === 'classic' ? 'grid' : v === 'grid' ? 'sudokube' : v === 'sudokube' ? 'wireframe' : 'classic'))
                }
              >
                {visualMode.toUpperCase()}
              </button>
              <select className="btn-compact" value={size} onChange={(e) => setSize(Number(e.target.value))} style={{ fontFamily: "'Courier New', monospace" }}>
                {[3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}×{n}
                  </option>
                ))}
              </select>
              <button className="btn-compact shuffle text" onClick={shuffle}>
                SHUFFLE
              </button>
              <button className="btn-compact reset text" onClick={reset}>
                RESET
              </button>
              <button
                className={`btn-compact text ${wormModeActive ? 'active' : ''}`}
                onClick={() => setShowWormModeStart(true)}
                style={{ color: '#00ff88', borderColor: wormModeActive ? '#00ff88' : undefined }}
              >
                WORM
              </button>
            </div>
          </div>

          {/* Manifold Selector - Vintage Educational Footer */}
          <div
            className="manifold-selector"
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '10px',
              color: '#9c6644',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              opacity: 0.6,
              pointerEvents: 'auto'
            }}
          >
            Standard Euclidean ——— <span style={{ color: '#bc6c25', fontWeight: 600 }}>Antipodal Projection</span> ——— Real Projective Plane
          </div>
        </div>
      </div>

      {showMainMenu && (
        <MainMenu
          onStart={() => {
            setShowMainMenu(false);
            shuffle();
          }}
        />
      )}
      {showSettings && <SettingsMenu onClose={() => setShowSettings(false)} settings={{}} onSettingsChange={() => {}} />}
      {showHelp && <HelpMenu onClose={() => setShowHelp(false)} />}
      {showFirstFlipTutorial && <FirstFlipTutorial onClose={() => setShowFirstFlipTutorial(false)} />}

      {/* Victory Screen - highest z-index */}
      {victory && <VictoryScreen winType={victory} moves={moves} time={gameTime} onContinue={handleVictoryContinue} onNewGame={handleVictoryNewGame} />}

      {/* WORM Mode Overlays */}
      {showWormModeStart && (
        <WormModeStartScreen
          onStart={handleWormModeStart}
          onCancel={() => setShowWormModeStart(false)}
        />
      )}
      {wormModeActive && (
        <>
          <WormModeHUD onQuit={handleWormModeQuit} gameData={wormGameData} />
          {/* Touch controls for mobile */}
          <WormTouchControls
            onRotate={onWormRotate}
            wormHead={wormGameData?.worm?.[0]}
            onCameraToggle={() => wormGameData?.setWormCameraEnabled?.(prev => !prev)}
            wormCameraEnabled={wormGameData?.wormCameraEnabled}
            gameState={wormGameData?.gameState || 'playing'}
            onPause={() => wormGameData?.setGameState?.('paused')}
            onResume={() => wormGameData?.setGameState?.('playing')}
          />
        </>
      )}
    </div>
  );
}
