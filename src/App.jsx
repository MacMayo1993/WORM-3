// src/App.jsx
/**
 * WORM³ Main Application
 *
 * Refactored to use Zustand state management and custom hooks.
 * Original 2343 lines reduced to ~700 lines with modular architecture.
 */

import React, { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Html } from '@react-three/drei';
import './App.css';

// Utils
import { completeLevel } from './utils/levels.js';
import { keyToMove } from './game/handsInput.js';
import { makeCubies } from './game/cubeState.js';
import { rotateSliceCubies } from './game/cubeRotation.js';
import { buildManifoldGridMap, flipStickerPair } from './game/manifoldLogic.js';

// Hooks
import {
  useGameStore,
  useCubeState,
  useGameSession,
  useAnimation,
  useChaosMode,
  useCursor,
  useLevelSystem,
  useSettings,
  useHandsMode,
  useUndo,
  useParityDecay,
} from './hooks/index.js';

// 3D components
import CubeAssembly from './3d/CubeAssembly.jsx';
import BlackHoleEnvironment from './3d/BlackHoleEnvironment.jsx';
import { getLevelBackground } from './3d/LifeJourneyBackgrounds.jsx';
import { BACKGROUNDS, getBackgroundUrl } from './utils/backgrounds.js';

// Photo environment presets available from @react-three/drei (real HDR panoramas)
const PHOTO_PRESETS = new Set([
  'sunset', 'forest', 'city', 'dawn', 'night',
  'apartment', 'studio', 'park', 'warehouse', 'lobby',
]);

/**
 * InteractivePhotoBackground - Real HDR panorama that slowly drifts around you.
 * Orbit the camera (drag empty space) to look around the environment.
 * A gentle auto-rotation keeps the scene alive even when idle.
 */
function InteractivePhotoBackground({ preset, files }) {
  useFrame((state, delta) => {
    // Slow drift: ~6° per second so the panorama feels alive
    if (state.scene.backgroundRotation) {
      state.scene.backgroundRotation.y += delta * 0.1;
    }
  });

  return (
    <Environment
      preset={files ? undefined : preset}
      files={files}
      background
      backgroundBlurriness={0}
      backgroundIntensity={1.2}
    />
  );
}

// UI components
import TopMenuBar from './components/menus/TopMenuBar.jsx';
import BottomNavBar from './components/menus/BottomNavBar.jsx';
import SecondaryModesSheet from './components/menus/SecondaryModesSheet.jsx';
import FloatingHUD from './components/menus/FloatingHUD.jsx';
import TileLeaderboard from './components/menus/TileLeaderboard.jsx';
import MainMenu from './components/menus/MainMenu.jsx';
import SettingsMenu from './components/menus/SettingsMenu.jsx';
import HelpMenu from './components/menus/HelpMenu.jsx';
import MobileControls from './components/menus/MobileControls.jsx';
import WelcomeScreen from './components/screens/WelcomeScreen.jsx';
import VictoryScreen from './components/screens/VictoryScreen.jsx';
import Tutorial from './components/screens/Tutorial.jsx';
import FirstFlipTutorial from './components/screens/FirstFlipTutorial.jsx';
import LevelSelectScreen from './components/screens/LevelSelectScreen.jsx';
import Level10Cutscene from './components/screens/Level10Cutscene.jsx';
import LevelTutorial from './components/screens/LevelTutorial.jsx';
import FreeplaySetupWizard from './components/screens/FreeplaySetupWizard.jsx';
import RotationPreview from './components/overlays/RotationPreview.jsx';
import FaceRotationButtons from './components/overlays/FaceRotationButtons.jsx';
import TileRotationSelector from './components/overlays/TileRotationSelector.jsx';
import HandsOverlay from './components/overlays/HandsOverlay.jsx';
import CubeNet from './components/CubeNet.jsx';
import SolveMode from './components/SolveMode.jsx';
import DevConsole from './components/menus/DevConsole.jsx';
import TeachMode from './teach/TeachMode.jsx';
import { useTeachMode } from './teach/useTeachMode.js';
import LayerHighlight from './teach/LayerHighlight.jsx';
import AntipodalVisualization from './3d/AntipodalVisualization.jsx';
import AntipodalModeEffects from './3d/AntipodalModeEffects.jsx';
import AntipodalHUD from './components/overlays/AntipodalHUD.jsx';
import AntipodalModeHUD from './components/overlays/AntipodalModeHUD.jsx';
import EchoRotationIndicator from './components/overlays/EchoRotationIndicator.jsx';
import { useAntipodalIntegrity } from './hooks/useAntipodalIntegrity.js';
const PlatformerWormMode = React.lazy(() => import('./worm/PlatformerWormMode.jsx'));
const HollowVoidCube = React.lazy(() => import('./3d/HollowVoidCube.jsx'));

// Mobile detection
const isMobile = typeof window !== 'undefined' && (
  window.innerWidth <= 768 ||
  'ontouchstart' in window ||
  navigator.maxTouchPoints > 0
);

// Simple Error Boundary for 3D components
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("3D Component Error:", error);
    console.error("Component Stack:", errorInfo.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <group>
          <mesh>
            <boxGeometry args={[10, 10, 10]} />
            <meshBasicMaterial color="red" wireframe />
          </mesh>
          <Html position={[0, 0, -2]}>
            <div style={{ color: 'red', background: 'rgba(0,0,0,0.8)', padding: '10px' }}>
              Error Loading Background
              <br />
              {this.state.error?.message}
            </div>
          </Html>
        </group>
      );
    }
    return this.props.children;
  }
}

export default function WORM3() {
  // ========================================================================
  // STATE FROM ZUSTAND STORE
  // ========================================================================
  const showWelcome = useGameStore((state) => state.showWelcome);
  const setShowWelcome = useGameStore((state) => state.setShowWelcome);
  const showTutorial = useGameStore((state) => state.showTutorial);
  const setShowTutorial = useGameStore((state) => state.setShowTutorial);
  const showFirstFlipTutorial = useGameStore((state) => state.showFirstFlipTutorial);
  const setShowFirstFlipTutorial = useGameStore((state) => state.setShowFirstFlipTutorial);
  const showHelp = useGameStore((state) => state.showHelp);
  const setShowHelp = useGameStore((state) => state.setShowHelp);
  const showSettings = useGameStore((state) => state.showSettings);
  const setShowSettings = useGameStore((state) => state.setShowSettings);
  const showMainMenu = useGameStore((state) => state.showMainMenu);
  const showLevelSelect = useGameStore((state) => state.showLevelSelect);
  const setShowLevelSelect = useGameStore((state) => state.setShowLevelSelect);
  const showCutscene = useGameStore((state) => state.showCutscene);
  const showLevelTutorial = useGameStore((state) => state.showLevelTutorial);
  const showNetPanel = useGameStore((state) => state.showNetPanel);
  const setShowNetPanel = useGameStore((state) => state.setShowNetPanel);
  const showLeaderboard = useGameStore((state) => state.showLeaderboard);
  const toggleLeaderboard = useGameStore((state) => state.toggleLeaderboard);
  const showMobileTouchHint = useGameStore((state) => state.showMobileTouchHint);
  const markMobileHintShown = useGameStore((state) => state.markMobileHintShown);
  const markIntroSeen = useGameStore((state) => state.markIntroSeen);
  const markTutorialDone = useGameStore((state) => state.markTutorialDone);

  const flipMode = useGameStore((state) => state.flipMode);
  const setFlipMode = useGameStore((state) => state.setFlipMode);
  const visualMode = useGameStore((state) => state.visualMode);
  const setVisualMode = useGameStore((state) => state.setVisualMode);
  const exploded = useGameStore((state) => state.exploded);
  const setExploded = useGameStore((state) => state.setExploded);
  const explosionT = useGameStore((state) => state.explosionT);
  const setExplosionT = useGameStore((state) => state.setExplosionT);
  const showTunnels = useGameStore((state) => state.showTunnels);
  const setShowTunnels = useGameStore((state) => state.setShowTunnels);
  const blackHolePulse = useGameStore((state) => state.blackHolePulse);
  const flipWaveOrigins = useGameStore((state) => state.flipWaveOrigins);
  const setFlipWaveOrigins = useGameStore((state) => state.setFlipWaveOrigins);

  const faceRotationTarget = useGameStore((state) => state.faceRotationTarget);
  const setFaceRotationTarget = useGameStore((state) => state.setFaceRotationTarget);
  const selectedTileForRotation = useGameStore((state) => state.selectedTileForRotation);
  const setSelectedTileForRotation = useGameStore((state) => state.setSelectedTileForRotation);

  const showDevConsole = useGameStore((state) => state.showDevConsole);
  const setShowDevConsole = useGameStore((state) => state.setShowDevConsole);
  const savedCubeState = useGameStore((state) => state.savedCubeState);
  const setSavedCubeState = useGameStore((state) => state.setSavedCubeState);

  const solveModeActive = useGameStore((state) => state.solveModeActive);
  const setSolveModeActive = useGameStore((state) => state.setSolveModeActive);
  const solveFocusedStep = useGameStore((state) => state.solveFocusedStep);
  const setSolveFocusedStep = useGameStore((state) => state.setSolveFocusedStep);
  const solveHighlights = useGameStore((state) => state.solveHighlights);
  const setSolveHighlights = useGameStore((state) => state.setSolveHighlights);

  // ========================================================================
  // CUSTOM HOOKS
  // ========================================================================
  const {
    size, cubies, manifoldMap, metrics, resolvedColors,
    setCubies, setRotatedCubies, changeSize, shuffle, reset, flipSticker
  } = useCubeState();

  const { moves, gameTime, victory, achievedWins: _achievedWins, setVictory } = useGameSession();

  const {
    animState, startAnimation, handleAnimComplete, onMove
  } = useAnimation();

  const {
    chaosLevel, chaosMode, autoRotateEnabled, cascades,
    upcomingRotation, rotationCountdown, setChaosLevel,
    setAutoRotateEnabled, onCascadeComplete
  } = useChaosMode();

  const { cursor, showCursor, setShowCursor, moveCursor, cursorToCubePos, cubePosToCursor, getRotationParams } = useCursor();

  const {
    currentLevel, currentLevelData, handleLevelSelect,
    handleCutsceneComplete, handleTutorialClose: levelTutorialClose,
    handleBackToMainMenu, handleNextLevel: levelHandleNextLevel
  } = useLevelSystem();

  const { settings, faceImages, faceTextures, handleFaceImage, setSettings } = useSettings();

  const {
    handsMode, handsMoveHistory, handsTps, executeHandsMove,
    setHandsMode, setHandsMoveHistory, setHandsMoveQueue, setHandsTps
  } = useHandsMode();
  const handsMoveTimestamps = useRef([]);

  const { moveHistory, undo, canUndo } = useUndo();

  // Teach Mode — step-by-step algorithm teaching
  const teachMode = useTeachMode();

  // Parity instability — flipped tiles spontaneously re-flip and propagate
  useParityDecay();

  // Antipodal integrity — real-time I(T) metric from the paper
  const antipodalIntegrityMode = useGameStore((state) => state.antipodalIntegrityMode);
  const setAntipodalIntegrityMode = useGameStore((state) => state.setAntipodalIntegrityMode);
  const antipodalData = useAntipodalIntegrity();
  const hollowMode = useGameStore((state) => state.hollowMode);
  const toggleHollowMode = useGameStore((state) => state.toggleHollowMode);

  // Co-op Crawler mode
  const [coopMode, setCoopMode] = useState(false);

  // Bottom sheet state for new nav bar
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState('more'); // 'more' or 'views'

  // Freeplay setup wizard
  const [showFreeplayWizard, setShowFreeplayWizard] = useState(false);

  // ========================================================================
  // EXPLOSION ANIMATION
  // ========================================================================
  const explosionTRef = useRef(0);
  useEffect(() => {
    if (exploded && explosionTRef.current >= 1) return;
    if (!exploded && explosionTRef.current <= 0) return;

    let raf;
    const animate = () => {
      setExplosionT((t) => {
        let next = t;
        if (exploded && t < 1) next = Math.min(1, t + 0.05);
        else if (!exploded && t > 0) next = Math.max(0, t - 0.05);
        explosionTRef.current = next;
        return next;
      });
      const curr = explosionTRef.current;
      if ((exploded && curr < 1) || (!exploded && curr > 0)) {
        raf = requestAnimationFrame(animate);
      }
    };
    raf = requestAnimationFrame(animate);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [exploded, setExplosionT]);

  // Dismiss mobile touch hint after delay
  useEffect(() => {
    if (!showMobileTouchHint) return;
    const timer = setTimeout(() => markMobileHintShown(), 4500);
    return () => clearTimeout(timer);
  }, [showMobileTouchHint, markMobileHintShown]);

  // ========================================================================
  // HANDLERS
  // ========================================================================
  const handleWelcomeComplete = useCallback(() => {
    setShowWelcome(false);
    markIntroSeen();
    // Show main menu after intro (not tutorial)
    useGameStore.getState().setShowMainMenu(true);
  }, [setShowWelcome, markIntroSeen]);

  // Main menu action handlers
  const handleMenuPlay = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    handleLevelSelect(1); // Start at level 1
  }, [handleLevelSelect]);

  const handleMenuLevels = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    setShowLevelSelect(true);
  }, [setShowLevelSelect]);

  const handleMenuFreeplay = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    setShowFreeplayWizard(true);
  }, []);

  const handleWizardComplete = useCallback((wizardSettings) => {
    setShowFreeplayWizard(false);
    // Apply wizard settings
    const newSettings = {
      ...settings,
      colorScheme: wizardSettings.colorScheme,
      backgroundTheme: wizardSettings.backgroundTheme,
    };
    // Apply custom colors if provided
    if (wizardSettings.customColors) {
      newSettings.customColors = wizardSettings.customColors;
    }
    // Apply tile style to all faces
    if (wizardSettings.tileStyle) {
      const manifoldStyles = {};
      if (wizardSettings.tileStyle === 'random') {
        // Pick random style for each face
        const allStyles = ['solid', 'glossy', 'matte', 'metallic', 'carbonFiber', 'hexGrid', 'comic', 'cafeWall', 'hermanGrid', 'opticSpin', 'ouchi', 'grass', 'ice', 'sand', 'water', 'wood', 'circuit', 'holographic', 'pulse', 'lava', 'galaxy', 'neural'];
        [1, 2, 3, 4, 5, 6].forEach(id => {
          manifoldStyles[id] = allStyles[Math.floor(Math.random() * allStyles.length)];
        });
      } else {
        [1, 2, 3, 4, 5, 6].forEach(id => { manifoldStyles[id] = wizardSettings.tileStyle; });
      }
      newSettings.manifoldStyles = manifoldStyles;
    }
    setSettings(newSettings);
    // Clear level and shuffle
    useGameStore.getState().clearLevel();
    shuffle();
  }, [settings, setSettings, shuffle]);

  const handleWizardCancel = useCallback(() => {
    setShowFreeplayWizard(false);
    useGameStore.getState().setShowMainMenu(true);
  }, []);

  const handleMenuSettings = useCallback(() => {
    setShowSettings(true);
  }, [setShowSettings]);

  const handleMenuCoop = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    useGameStore.getState().clearLevel();
    shuffle();
    setCoopMode(true);
  }, [shuffle]);

  const handleMenuTeach = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    useGameStore.getState().clearLevel();
    if (size !== 3) changeSize(3);
    shuffle();
    // Enter teach mode on next tick so cubies are ready
    setTimeout(() => teachMode.enterTeachMode(), 0);
  }, [size, changeSize, shuffle, teachMode]);

  const handleMenuHelp = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    setShowTutorial(true);
  }, [setShowTutorial]);

  const closeTutorial = useCallback(() => {
    setShowTutorial(false);
    markTutorialDone();
  }, [setShowTutorial, markTutorialDone]);

  // Tap flip handler
  const onTapFlip = useCallback((pos, dirKey) => {
    flipSticker(pos, dirKey);
  }, [flipSticker]);

  const onFlipWaveComplete = useCallback(() => {
    setFlipWaveOrigins([]);
  }, [setFlipWaveOrigins]);

  // Handle tile selection
  const handleSelectTile = useCallback((pos, dirKey) => {
    const newCursor = cubePosToCursor(pos, dirKey);
    useGameStore.getState().setCursor(newCursor);
    setShowCursor(true);
    setSelectedTileForRotation({ pos, dirKey, cursor: newCursor });
  }, [cubePosToCursor, setShowCursor, setSelectedTileForRotation]);

  // Face rotation handlers
  const handleFaceRotationMode = useCallback((target) => {
    setFaceRotationTarget(target);
  }, [setFaceRotationTarget]);

  const handleFaceRotate = useCallback((direction) => {
    if (!faceRotationTarget) return;
    const { pos, dirKey } = faceRotationTarget;
    const dir = direction === 'cw' ? -1 : 1;

    let axis, sliceIndex;
    switch (dirKey) {
      case 'PZ': case 'NZ': axis = 'depth'; sliceIndex = pos.z; break;
      case 'PX': case 'NX': axis = 'col'; sliceIndex = pos.x; break;
      case 'PY': case 'NY': axis = 'row'; sliceIndex = pos.y; break;
      default: return;
    }

    let adjustedDir = dir;
    if (dirKey === 'NZ' || dirKey === 'NX' || dirKey === 'NY') {
      adjustedDir = -dir;
    }

    startAnimation(axis, adjustedDir, sliceIndex);
    setFaceRotationTarget(null);
  }, [faceRotationTarget, startAnimation, setFaceRotationTarget]);

  // Tile rotation handlers
  const handleTileRotation = useCallback((direction) => {
    if (!selectedTileForRotation) return;
    const { cursor: cur } = selectedTileForRotation;
    const { face } = cur;
    const pos = cursorToCubePos(cur);

    const directionMap = {
      up: { PZ: ['col', -1], NZ: ['col', 1], PX: ['depth', 1], NX: ['depth', -1], PY: ['depth', -1], NY: ['depth', 1] },
      down: { PZ: ['col', 1], NZ: ['col', -1], PX: ['depth', -1], NX: ['depth', 1], PY: ['depth', 1], NY: ['depth', -1] },
      left: { PZ: ['row', -1], NZ: ['row', -1], PX: ['row', -1], NX: ['row', -1], PY: ['col', -1], NY: ['col', 1] },
      right: { PZ: ['row', 1], NZ: ['row', 1], PX: ['row', 1], NX: ['row', 1], PY: ['col', 1], NY: ['col', -1] },
    };

    const [axis, dir] = directionMap[direction]?.[face] || [];
    if (axis && dir !== undefined) {
      onMove(axis, dir, pos);
    }
    setSelectedTileForRotation(null);
  }, [selectedTileForRotation, cursorToCubePos, onMove, setSelectedTileForRotation]);

  const handleTileFaceRotation = useCallback((direction) => {
    if (!selectedTileForRotation) return;
    const { cursor: cur } = selectedTileForRotation;
    const { face } = cur;
    const pos = cursorToCubePos(cur);
    const dir = direction === 'cw' ? -1 : 1;

    let axis;
    switch (face) {
      case 'PZ': case 'NZ': axis = 'depth'; break;
      case 'PX': case 'NX': axis = 'col'; break;
      case 'PY': case 'NY': axis = 'row'; break;
    }

    let adjustedDir = dir;
    if (face === 'NZ' || face === 'NX' || face === 'NY') {
      adjustedDir = -dir;
    }

    if (axis) {
      const sliceIndex = axis === 'col' ? pos.x : axis === 'row' ? pos.y : pos.z;
      startAnimation(axis, adjustedDir, sliceIndex);
    }
    setSelectedTileForRotation(null);
  }, [selectedTileForRotation, cursorToCubePos, startAnimation, setSelectedTileForRotation]);

  // Cursor-based rotation
  const performCursorRotation = useCallback((rotationType) => {
    if (animState) return;
    const { axis, dir, pos } = getRotationParams(rotationType);
    if (axis && dir !== undefined) {
      onMove(axis, dir, pos);
    }
    setShowCursor(true);
  }, [animState, getRotationParams, onMove, setShowCursor]);

  const performCursorFlip = useCallback(() => {
    const pos = cursorToCubePos(cursor);
    onTapFlip({ x: pos.x, y: pos.y, z: pos.z }, pos.dirKey);
    setShowCursor(true);
  }, [cursor, cursorToCubePos, onTapFlip, setShowCursor]);

  // Level-specific shuffle
  const shuffleForLevel = useCallback(() => {
    const levelSize = currentLevelData?.cubeSize || size;
    let state = makeCubies(levelSize);
    const shuffleCount = currentLevelData ? Math.min(25, 10 + currentLevel * 2) : 25;
    for (let i = 0; i < shuffleCount; i++) {
      const ax = ['row', 'col', 'depth'][Math.floor(Math.random() * 3)];
      const slice = Math.floor(Math.random() * levelSize);
      const dir = Math.random() > 0.5 ? 1 : -1;
      state = rotateSliceCubies(state, levelSize, ax, slice, dir);
    }
    setRotatedCubies(state);
    useGameStore.getState().resetGame();
    useGameStore.getState().setHasShuffled(true);
  }, [currentLevelData, currentLevel, size, setRotatedCubies]);

  // Tutorial close handler
  const handleTutorialClose = useCallback(() => {
    levelTutorialClose();
    shuffleForLevel();
  }, [levelTutorialClose, shuffleForLevel]);

  // Victory handlers
  const handleVictoryContinue = useCallback(() => {
    if (currentLevel) completeLevel(currentLevel);
    setVictory(null);
  }, [currentLevel, setVictory]);

  const handleVictoryNewGame = useCallback(() => {
    if (currentLevel) completeLevel(currentLevel);
    setVictory(null);
    if (currentLevelData) shuffleForLevel();
    else shuffle();
  }, [currentLevel, currentLevelData, setVictory, shuffleForLevel, shuffle]);

  const handleNextLevel = useCallback(() => {
    if (currentLevel) completeLevel(currentLevel);
    levelHandleNextLevel();
    setVictory(null);
  }, [currentLevel, levelHandleNextLevel, setVictory]);

  // Dev console handlers
  const handlePreset = useCallback((presetId) => {
    let state = makeCubies(size);
    let moveCount = 0;

    const applyRandomMoves = (count) => {
      for (let i = 0; i < count; i++) {
        const ax = ['row', 'col', 'depth'][Math.floor(Math.random() * 3)];
        const slice = Math.floor(Math.random() * size);
        const dir = Math.random() > 0.5 ? 1 : -1;
        state = rotateSliceCubies(state, size, ax, slice, dir);
      }
      return count;
    };

    switch (presetId) {
      case 'solved': break;
      case 'near-solved': moveCount = applyRandomMoves(3); break;
      case 'scrambled-10': moveCount = applyRandomMoves(10); break;
      case 'scrambled-25': moveCount = applyRandomMoves(25); break;
      case 'scrambled-50': moveCount = applyRandomMoves(50); break;
      default: break;
    }

    setRotatedCubies(state);
    useGameStore.getState().setMoves(moveCount);
    useGameStore.getState().clearHistory();
    useGameStore.getState().setHasShuffled(true);
  }, [size, setRotatedCubies]);

  const handleInstantChaos = useCallback((targetDisparity) => {
    const totalStickers = size * size * 6;
    const targetFlips = Math.floor((totalStickers * targetDisparity) / 100);
    let state = cubies;
    let flippedCount = 0;

    while (flippedCount < targetFlips) {
      const x = Math.floor(Math.random() * size);
      const y = Math.floor(Math.random() * size);
      const z = Math.floor(Math.random() * size);
      const dirs = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];
      const dirKey = dirs[Math.floor(Math.random() * dirs.length)];
      const onEdge =
        (dirKey === 'PX' && x === size - 1) || (dirKey === 'NX' && x === 0) ||
        (dirKey === 'PY' && y === size - 1) || (dirKey === 'NY' && y === 0) ||
        (dirKey === 'PZ' && z === size - 1) || (dirKey === 'NZ' && z === 0);

      if (onEdge) {
        const freshManifoldMap = buildManifoldGridMap(state, size);
        state = flipStickerPair(state, size, x, y, z, dirKey, freshManifoldMap);
        flippedCount++;
      }
    }
    setCubies(state);
    useGameStore.getState().setHasShuffled(true);
  }, [cubies, size, setCubies]);

  const handleSaveState = useCallback(() => {
    setSavedCubeState({
      cubies: JSON.parse(JSON.stringify(cubies)),
      moves,
      size,
      timestamp: Date.now()
    });
    alert('State saved! Use Ctrl+L to load it back.');
  }, [cubies, moves, size, setSavedCubeState]);

  const handleLoadState = useCallback(() => {
    if (!savedCubeState) return;
    if (savedCubeState.size !== size) {
      alert(`Saved state is for ${savedCubeState.size}×${savedCubeState.size} cube.`);
      return;
    }
    setRotatedCubies(savedCubeState.cubies);
    useGameStore.getState().setMoves(savedCubeState.moves);
    useGameStore.getState().clearHistory();
  }, [savedCubeState, size, setRotatedCubies]);

  // ========================================================================
  // KEYBOARD HANDLER
  // ========================================================================
  useEffect(() => {
    if (coopMode) return; // Co-op mode handles its own input

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (showLevelTutorial && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        handleTutorialClose();
        return;
      }

      const key = e.key.toLowerCase();

      // Hands mode keyboard handler
      if (handsMode) {
        if (!['escape', 'h', '?', '`', 'r', 'z', 'v', 'x', 't', 'c', 'p', 'b'].includes(key) && !e.ctrlKey && !e.metaKey) {
          const moveName = keyToMove(e);
          if (moveName) {
            e.preventDefault();
            executeHandsMove(moveName);
            return;
          }
        }
      }

      // Arrow keys
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        moveCursor(e.key.replace('Arrow', '').toLowerCase());
        return;
      }

      // WASDQE rotation
      if ('wasdqe'.includes(key)) {
        e.preventDefault();
        const rotMap = { w: 'up', s: 'down', a: 'left', d: 'right', q: 'ccw', e: 'cw' };
        performCursorRotation(rotMap[key]);
        return;
      }

      // F - flip
      if (key === 'f') {
        e.preventDefault();
        if (flipMode && (!currentLevelData || currentLevelData.features.flips)) {
          performCursorFlip();
        }
        return;
      }

      // Z - undo
      if (key === 'z' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Backtick - dev console
      if (e.key === '`') {
        e.preventDefault();
        setShowDevConsole(!showDevConsole);
        return;
      }

      // R - reset
      if (key === 'r') {
        e.preventDefault();
        if (e.shiftKey) {
          reset();
          setTimeout(() => shuffle(), 100);
        } else {
          reset();
        }
        return;
      }

      // Ctrl+S - save
      if (key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSaveState();
        return;
      }

      // Ctrl+L - load
      if (key === 'l' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleLoadState();
        return;
      }

      // Shift+number - jump to level
      if (e.shiftKey && /[0-9]/.test(key)) {
        e.preventDefault();
        const level = key === '0' ? 10 : parseInt(key);
        handleLevelSelect(level);
        return;
      }

      // Other shortcuts
      switch (key) {
        case 'h': case '?': setShowHelp(h => !h); break;
        case 'g': if (!currentLevelData || currentLevelData.features.flips) setFlipMode(f => !f); break;
        case 't': if (!currentLevelData || currentLevelData.features.tunnels) setShowTunnels(t => !t); break;
        case 'x': if (!currentLevelData || currentLevelData.features.explode) setExploded(ex => !ex); break;
        case 'n': if (!currentLevelData || currentLevelData.features.net) setShowNetPanel(p => !p); break;
        case 'v': setVisualMode(v => {
          const modes = ['classic', 'grid', 'sudokube', 'wireframe', 'glass'];
          return modes[(modes.indexOf(v) + 1) % modes.length];
        }); break;
        case 'c': if (!currentLevelData || currentLevelData.features.chaos) setChaosLevel(l => l > 0 ? 0 : 1); break;
        case 'i': setAntipodalIntegrityMode(!antipodalIntegrityMode); break;
        case 'm': toggleHollowMode(); break;
        case 'p':
          setHandsMode(!handsMode);
          if (!handsMode) {
            setHandsMoveHistory([]);
            setHandsMoveQueue([]);
            setHandsTps(0);
            handsMoveTimestamps.current = [];
          }
          break;
        case 'escape':
          setShowHelp(false);
          setShowSettings(false);
          setShowCursor(false);
          if (handsMode) setHandsMode(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    coopMode, cursor, animState, flipMode, showLevelTutorial, currentLevelData, handsMode,
    moveCursor, performCursorRotation, performCursorFlip, undo, executeHandsMove,
    handleSaveState, handleLoadState, handleLevelSelect, handleTutorialClose,
    reset, shuffle, showDevConsole, setShowDevConsole, setShowHelp, setFlipMode,
    setShowTunnels, setExploded, setShowNetPanel, setVisualMode, setChaosLevel,
    setHandsMode, setHandsMoveHistory, setHandsMoveQueue, setHandsTps, setShowCursor, setShowSettings,
    antipodalIntegrityMode, setAntipodalIntegrityMode, toggleHollowMode
  ]);

  // ========================================================================
  // RENDER
  // ========================================================================
  const cameraZ = { 2: 10, 3: 14, 4: 20, 5: 26 }[size] || 14;

  if (showWelcome) {
    return <WelcomeScreen onEnter={handleWelcomeComplete} />;
  }

  if (coopMode) {
    return (
      <Suspense fallback={<div style={{ background: '#000', width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa', fontFamily: "'Courier New', monospace" }}>Loading Co-op Crawler...</div>}>
        <PlatformerWormMode
          cubies={cubies}
          size={size}
          faceColors={resolvedColors}
          onQuit={() => {
            setCoopMode(false);
            useGameStore.getState().setShowMainMenu(true);
          }}
        />
      </Suspense>
    );
  }

  return (
    <div className={`full-screen${settings.backgroundTheme === 'dark' ? ' bg-dark' : settings.backgroundTheme === 'midnight' ? ' bg-midnight' : ''}`}>
      {showTutorial && <Tutorial onClose={closeTutorial} />}

      <div className="canvas-container" onContextMenu={(e) => e.preventDefault()}>
        <Canvas camera={{ position: [0, 0, cameraZ], fov: 40 }} dpr={[1, 1.5]} gl={{ powerPreference: 'high-performance', antialias: true }}>
          <ambientLight intensity={visualMode === 'wireframe' ? 0.2 : visualMode === 'glass' ? 0.5 : 0.8} />
          <directionalLight position={[5, 8, 5]} intensity={visualMode === 'wireframe' ? 0.3 : visualMode === 'glass' ? 1.6 : 1.2} castShadow shadow-mapSize={[1024, 1024]} />
          <pointLight position={[10, 10, 10]} intensity={visualMode === 'wireframe' ? 0.3 : visualMode === 'glass' ? 1.0 : 0.8} />
          <pointLight position={[-10, -10, -10]} intensity={visualMode === 'wireframe' ? 0.2 : visualMode === 'glass' ? 0.5 : 0.6} />
          {visualMode === 'wireframe' && (
            <>
              <pointLight position={[0, 0, 0]} intensity={0.5} color="#fefae0" distance={15} decay={2} />
              <pointLight position={[5, 5, 5]} intensity={0.25} color="#dda15e" />
              <pointLight position={[-5, -5, -5]} intensity={0.2} color="#bc6c25" />
            </>
          )}
          {visualMode === 'glass' && (
            <>
              <pointLight position={[-8, 6, 8]} intensity={0.6} color="#ffffff" />
              <pointLight position={[8, -4, -6]} intensity={0.3} color="#e0e8ff" />
            </>
          )}
          <Suspense fallback={null}>
            {/* Level backgrounds */}
            {currentLevelData?.background === 'blackhole' && <BlackHoleEnvironment flipTrigger={blackHolePulse} />}
            {currentLevelData?.background && currentLevelData.background !== 'blackhole' && getLevelBackground(currentLevelData.background, blackHolePulse)}
            {/* Free play: Black Hole (animated favorite) */}
            {!currentLevelData && settings.backgroundTheme === 'blackhole' && <BlackHoleEnvironment flipTrigger={blackHolePulse} />}
            {/* Free play: interactive photo panoramas - orbit to look around, auto-drifts when idle */}
            {!currentLevelData && (
              (() => {
                const bgConfig = BACKGROUNDS.find(b => b.id === settings.backgroundTheme);
                // IF we have a custom file in backgrounds.js, use it
                if (bgConfig && bgConfig.file) {
                  return (
                    <ErrorBoundary>
                      <InteractivePhotoBackground files={getBackgroundUrl(bgConfig.file)} />
                    </ErrorBoundary>
                  );
                }
                // ELSE if it's a known preset for @react-three/drei
                if (PHOTO_PRESETS.has(settings.backgroundTheme)) {
                  return (
                    <ErrorBoundary>
                      <InteractivePhotoBackground preset={settings.backgroundTheme} />
                    </ErrorBoundary>
                  );
                }
                // Fallback for Black Hole or others
                if (settings.backgroundTheme === 'blackhole' || !bgConfig) {
                  return <BlackHoleEnvironment flipTrigger={blackHolePulse} />;
                }
                return null;
              })()
            )}
            {/* Free play: fallback for unknown/legacy themes is handled above */}
            {/* Default environment for lighting/reflections when in a level with no custom background */}
            {currentLevelData && !currentLevelData.background && (
              <Environment preset="city" />
            )}

            {/* CubeAssembly — hollowMode is handled per-cubie inside Cubie.jsx */}
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
              showInvitation={!useGameStore.getState().hasFlippedOnce}
              cursor={cursor}
              showCursor={showCursor}
              flipMode={flipMode}
              onSelectTile={handleSelectTile}
              onClearTileSelection={() => setSelectedTileForRotation(null)}
              flipWaveOrigins={flipWaveOrigins}
              onFlipWaveComplete={onFlipWaveComplete}
              faceColors={resolvedColors}
              faceTextures={faceTextures}
              manifoldStyles={settings.manifoldStyles}
              solveHighlights={solveModeActive ? solveHighlights : teachMode.active ? solveHighlights : []}
              onFaceRotationMode={handleFaceRotationMode}
              handsMode={handsMode}
            />
            {teachMode.active && teachMode.layerHighlight && (
              <LayerHighlight
                axis={teachMode.layerHighlight.axis}
                sliceIndex={teachMode.layerHighlight.sliceIndex}
                dir={teachMode.layerHighlight.dir}
                size={size}
              />
            )}
            {antipodalIntegrityMode && (
              <AntipodalVisualization
                antipodalData={antipodalData}
                size={size}
                explosionFactor={explosionT}
              />
            )}
            <AntipodalModeEffects />
          </Suspense>


        </Canvas>
      </div>

      <div className="ui-layer">
        <TopMenuBar
          metrics={metrics}
          size={size}
          visualMode={visualMode}
          flipMode={flipMode}
          chaosMode={chaosMode}
          chaosLevel={chaosLevel}
          cubies={cubies}
          faceColors={resolvedColors}
          cascadeCount={cascades.length}
          onShowSettings={() => setShowSettings(true)}
          currentLevelData={currentLevelData}
        />

        {/* Undo Indicator - desktop only (mobile uses MobileControls) */}
        {moveHistory.length > 0 && !isMobile && (
          <div
            style={{
              position: 'fixed', bottom: '20px', left: '20px',
              background: 'rgba(0, 217, 255, 0.15)', border: '2px solid rgba(0, 217, 255, 0.4)',
              borderRadius: '8px', padding: '8px 16px', color: '#00d9ff',
              fontFamily: "'Courier New', monospace", fontSize: '14px', fontWeight: 'bold',
              zIndex: 100, backdropFilter: 'blur(10px)', cursor: 'pointer',
            }}
            onClick={undo}
            title="Click or press Z to undo"
          >
            Z: Undo ({moveHistory.length})
          </div>
        )}

        {/* Auto-rotate Preview */}
        {autoRotateEnabled && chaosMode && (
          <RotationPreview upcomingRotation={upcomingRotation} countdown={rotationCountdown} maxCountdown={10000} size={size} />
        )}

        {/* Floating HUD — auto-fade parity/chaos notifications */}
        <FloatingHUD metrics={metrics} chaosLevel={chaosLevel} chaosMode={chaosMode} />

        {/* Tile Leaderboard — live flip stats in chaos mode, toggled via Views sheet */}
        <TileLeaderboard cubies={cubies} size={size} chaosMode={chaosMode} visible={showLeaderboard} onClose={toggleLeaderboard} />

        {/* Bottom Navigation Bar */}
        <BottomNavBar
          onReset={reset}
          onShuffle={currentLevelData ? shuffleForLevel : shuffle}
          solveModeActive={solveModeActive}
          teachModeActive={teachMode.active}
          onToggleSolve={() => { setSolveModeActive(!solveModeActive); if (!solveModeActive) setSolveFocusedStep(null); else setSolveHighlights([]); }}
          onToggleTeach={() => { if (teachMode.active) teachMode.exitTeachMode(); else if (size === 3) teachMode.enterTeachMode(); }}
          hasActiveView={exploded || showTunnels || showNetPanel || hollowMode || showLeaderboard}
          onToggleViews={() => { setSheetMode('views'); setSheetOpen(!sheetOpen || sheetMode !== 'views'); }}
          onToggleMore={() => { setSheetMode('more'); setSheetOpen(!sheetOpen || sheetMode !== 'more'); }}
          moreOpen={sheetOpen && sheetMode === 'more'}
          viewsOpen={sheetOpen && sheetMode === 'views'}
        />
      </div>

      {/* Secondary Modes Bottom Sheet */}
      <SecondaryModesSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        mode={sheetMode}
        flipMode={flipMode}
        onToggleFlip={() => { if (!currentLevelData || currentLevelData.features.flips) setFlipMode(!flipMode); }}
        flipLocked={!!(currentLevelData && !currentLevelData.features.flips)}
        chaosMode={chaosMode}
        chaosLevel={chaosLevel}
        onToggleChaos={() => { if (!currentLevelData || currentLevelData.features.chaos) setChaosLevel(l => l > 0 ? 0 : 1); }}
        onSetChaosLevel={(l) => setChaosLevel(l)}
        chaosLocked={!!(currentLevelData && !currentLevelData.features.chaos)}
        maxChaosLevel={currentLevelData?.chaosLevel || 4}
        autoRotateEnabled={autoRotateEnabled}
        onToggleAutoRotate={() => setAutoRotateEnabled(!autoRotateEnabled)}
        showTunnels={showTunnels}
        onToggleTunnels={() => { if (!currentLevelData || currentLevelData.features.tunnels) setShowTunnels(!showTunnels); }}
        tunnelsLocked={!!(currentLevelData && !currentLevelData.features.tunnels)}
        exploded={exploded}
        onToggleExplode={() => { if (!currentLevelData || currentLevelData.features.explode) setExploded(!exploded); }}
        explodeLocked={!!(currentLevelData && !currentLevelData.features.explode)}
        showNetPanel={showNetPanel}
        onToggleNet={() => { if (!currentLevelData || currentLevelData.features.net) setShowNetPanel(!showNetPanel); }}
        netLocked={!!(currentLevelData && !currentLevelData.features.net)}
        hollowMode={hollowMode}
        onToggleHollow={toggleHollowMode}
        visualMode={visualMode}
        onCycleVisualMode={(m) => setVisualMode(m)}
        size={size}
        onChangeSize={(n) => { if (!currentLevelData) changeSize(n); }}
        sizeLocked={!!currentLevelData}
        handsMode={handsMode}
        onToggleHands={() => { setHandsMode(!handsMode); if (!handsMode) { setHandsMoveHistory([]); setHandsMoveQueue([]); setHandsTps(0); handsMoveTimestamps.current = []; } }}
        antipodalIntegrityMode={antipodalIntegrityMode}
        onToggleIntegrity={() => setAntipodalIntegrityMode(!antipodalIntegrityMode)}
        showLeaderboard={showLeaderboard}
        onToggleLeaderboard={toggleLeaderboard}
        currentLevelData={currentLevelData}
        onShowLevels={() => { setShowLevelSelect(true); setSheetOpen(false); }}
        onFreeplay={() => { useGameStore.getState().clearLevel(); setSheetOpen(false); }}
      />

      {/* Level Badge */}
      {currentLevelData && !showMainMenu && !showLevelSelect && !victory && (
        <div className="level-badge">
          <span className="level-badge-number">{currentLevel}</span>
          <span className="level-badge-name">{currentLevelData.name}</span>
        </div>
      )}

      {showMainMenu && (
        <MainMenu
          onPlay={handleMenuPlay}
          onLevels={handleMenuLevels}
          onFreeplay={handleMenuFreeplay}
          onCoop={handleMenuCoop}
          onTeach={handleMenuTeach}
          onSettings={handleMenuSettings}
          onHelp={handleMenuHelp}
        />
      )}
      {showLevelSelect && <LevelSelectScreen onSelectLevel={handleLevelSelect} onBack={handleBackToMainMenu} />}
      {showSettings && <SettingsMenu onClose={() => setShowSettings(false)} settings={settings} onSettingsChange={setSettings} faceImages={faceImages} onFaceImage={handleFaceImage} />}
      {showFreeplayWizard && <FreeplaySetupWizard onComplete={handleWizardComplete} onCancel={handleWizardCancel} initialSettings={settings} />}
      {showHelp && <HelpMenu onClose={() => setShowHelp(false)} />}
      {showFirstFlipTutorial && <FirstFlipTutorial onClose={() => setShowFirstFlipTutorial(false)} />}

      {solveModeActive && (
        <SolveMode cubies={cubies} size={size} onClose={() => { setSolveModeActive(false); setSolveHighlights([]); }}
          onHighlightChange={setSolveHighlights} focusedStep={solveFocusedStep} onFocusStep={setSolveFocusedStep} />
      )}

      {teachMode.active && (
        <TeachMode
          analysis={teachMode.analysis}
          stages={teachMode.stages}
          methodName={teachMode.methodName}
          subMode={teachMode.subMode}
          onSwitchSubMode={teachMode.switchSubMode}
          selectedAlgo={teachMode.selectedAlgo}
          algoMoves={teachMode.algoMoves}
          currentStep={teachMode.currentStep}
          isPlaying={teachMode.isPlaying}
          canExecute={teachMode.canExecute}
          isAlgoComplete={teachMode.isAlgoComplete}
          whyOpen={teachMode.whyOpen}
          onToggleWhy={() => teachMode.setWhyOpen((v) => !v)}
          quizOptions={teachMode.quizOptions}
          quizAnswered={teachMode.quizAnswered}
          quizHintShown={teachMode.quizHintShown}
          onSelectAlgorithm={teachMode.selectAlgorithm}
          onExecuteStep={teachMode.executeStep}
          onToggleAutoPlay={teachMode.toggleAutoPlay}
          onResetAlgorithm={teachMode.resetAlgorithm}
          onAnswerQuiz={teachMode.answerQuiz}
          onRetryQuiz={teachMode.retryQuiz}
          onClose={teachMode.exitTeachMode}
        />
      )}

      {victory && (
        <VictoryScreen winType={victory} moves={moves} time={gameTime}
          onContinue={handleVictoryContinue} onNewGame={handleVictoryNewGame}
          currentLevel={currentLevel} levelData={currentLevelData}
          onNextLevel={handleNextLevel} hasNextLevel={currentLevel && currentLevel < 10} />
      )}

      {showCutscene && currentLevel === 10 && <Level10Cutscene onComplete={handleCutsceneComplete} onSkip={handleCutsceneComplete} />}
      {showLevelTutorial && currentLevelData && <LevelTutorial level={currentLevelData} onClose={handleTutorialClose} />}
      {showNetPanel && <CubeNet cubies={cubies} size={size} onTapFlip={onTapFlip} flipMode={flipMode} onClose={() => setShowNetPanel(false)} faceColors={resolvedColors} faceTextures={faceTextures} />}

      {isMobile && !showWelcome && !showTutorial && (
        <MobileControls onShowSettings={() => setShowSettings(true)} onShowHelp={() => setShowHelp(true)}
          flipMode={flipMode} onToggleFlip={() => setFlipMode(!flipMode)} exploded={exploded}
          onToggleExplode={() => setExploded(!exploded)} showTunnels={showTunnels}
          onToggleTunnels={() => setShowTunnels(!showTunnels)} onShuffle={shuffle} onReset={reset}
          showNetPanel={showNetPanel} onToggleNet={() => setShowNetPanel(!showNetPanel)}
          onRotateCW={() => performCursorRotation('cw')} onRotateCCW={() => performCursorRotation('ccw')}
          onUndo={undo} canUndo={canUndo} undoCount={moveHistory.length}
          teachModeActive={teachMode.active}
          onToggleTeachMode={() => { if (teachMode.active) teachMode.exitTeachMode(); else teachMode.enterTeachMode(); }}
          cubeSize={size} />
      )}

      {showMobileTouchHint && !showWelcome && !showTutorial && !showMainMenu && (
        <div className="mobile-touch-hint">Swipe to rotate • Tap tile for options</div>
      )}

      {faceRotationTarget && <FaceRotationButtons onRotateCW={() => handleFaceRotate('cw')} onRotateCCW={() => handleFaceRotate('ccw')} onCancel={() => setFaceRotationTarget(null)} />}
      {selectedTileForRotation && !flipMode && <TileRotationSelector onRotate={handleTileRotation} onRotateFaceCW={() => handleTileFaceRotation('cw')} onRotateFaceCCW={() => handleTileFaceRotation('ccw')} onCancel={() => setSelectedTileForRotation(null)} />}
      {handsMode && <HandsOverlay recentMoves={handsMoveHistory} lastMove={handsMoveHistory.length > 0 ? handsMoveHistory[handsMoveHistory.length - 1] : null} tps={handsTps} />}
      {antipodalIntegrityMode && (
        <AntipodalHUD
          integrity={antipodalData.integrity}
          preserved={antipodalData.preserved}
          total={antipodalData.total}
          regime={antipodalData.regime}
          kStar={antipodalData.kStar}
          onClose={() => setAntipodalIntegrityMode(false)}
        />
      )}
      <AntipodalModeHUD />
      <EchoRotationIndicator />
      {showDevConsole && <DevConsole onClose={() => setShowDevConsole(false)} onPreset={handlePreset} onSaveState={handleSaveState} onLoadState={handleLoadState} hasSavedState={!!savedCubeState} size={size} onJumpToLevel={handleLevelSelect} onInstantChaos={handleInstantChaos} moveHistory={moveHistory} />}
    </div>
  );
}
