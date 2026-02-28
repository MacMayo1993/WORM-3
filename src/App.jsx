// src/App.jsx
/**
 * WORM³ Main Application
 *
 * Refactored to use Zustand state management and custom hooks.
 * Original 2343 lines reduced to ~700 lines with modular architecture.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';
import './App.css';

// Utils
import { resolveBiomeManifoldStyles } from './modes/CityBiomeMode.js';
import { completeLevel } from './utils/levels.js';
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
  useKeyboardControls,
} from './hooks/index.js';

// 3D components
import { preloadBiomeAssets } from './3d/BiomeGLBCluster.jsx';
import GameScene from './3d/GameScene.jsx';
import IntroScene from './components/intro/IntroScene.jsx';

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
import Tutorial from './components/screens/Tutorial.jsx';
import FirstFlipTutorial from './components/screens/FirstFlipTutorial.jsx';
import RotationPreview from './components/overlays/RotationPreview.jsx';
import FaceRotationButtons from './components/overlays/FaceRotationButtons.jsx';
import TileRotationSelector from './components/overlays/TileRotationSelector.jsx';
import HandsOverlay from './components/overlays/HandsOverlay.jsx';
import { useTeachMode } from './teach/useTeachMode.js';
import AntipodalHUD from './components/overlays/AntipodalHUD.jsx';
import AntipodalModeHUD from './components/overlays/AntipodalModeHUD.jsx';
import EchoRotationIndicator from './components/overlays/EchoRotationIndicator.jsx';
import DisparityHUD from './components/overlays/DisparityHUD.jsx';
import { useAntipodalIntegrity } from './hooks/useAntipodalIntegrity.js';
// Lazy-loaded: not needed on initial render, deferred to reduce parse time
const PlatformerWormMode = React.lazy(() => import('./worm/PlatformerWormMode.jsx'));
const HollowVoidCube = React.lazy(() => import('./3d/HollowVoidCube.jsx'));
const VictoryScreen = React.lazy(() => import('./components/screens/VictoryScreen.jsx'));
const LevelSelectScreen = React.lazy(() => import('./components/screens/LevelSelectScreen.jsx'));
const Level10Cutscene = React.lazy(() => import('./components/screens/Level10Cutscene.jsx'));
const LevelTutorial = React.lazy(() => import('./components/screens/LevelTutorial.jsx'));
const FreeplaySetupWizard = React.lazy(() => import('./components/screens/FreeplaySetupWizard.jsx'));
const DisparitySetupWizard = React.lazy(() => import('./components/screens/DisparitySetupWizard.jsx'));
const DisparityWinnerScreen = React.lazy(() => import('./components/screens/DisparityWinnerScreen.jsx'));
const CubeNet = React.lazy(() => import('./components/CubeNet.jsx'));
const SolveMode = React.lazy(() => import('./components/SolveMode.jsx'));
const DevConsole = React.lazy(() => import('./components/menus/DevConsole.jsx'));
const TeachMode = React.lazy(() => import('./teach/TeachMode.jsx'));

// Mobile detection
const isMobile = typeof window !== 'undefined' && (
  window.innerWidth <= 768 ||
  'ontouchstart' in window ||
  navigator.maxTouchPoints > 0
);

// ─── Intro timing constants (mirror IntroScene) ──────────────────────────────
const EXPLOSION_START = 8.7;
const EXPLOSION_END   = 10.5;
const IMPLODE_START   = 12.5;
const IMPLODE_END     = 14.5;
const _clamp = (t, a = 0, b = 1) => Math.max(a, Math.min(b, t));
const _ease  = t => t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2;
const _prog  = (t, s, e) => _clamp((t - s) / (e - s));
const _chromaticVec = new Vector2(0, 0);

/**
 * IntroBranch — 3D content rendered inside the Canvas during the welcome/intro.
 * Contains IntroScene, post-processing, and intro lights.
 * Unmounting is avoided by conditionally hiding it (never fully unmounting the Canvas).
 */
function IntroBranch({ time, onComplete }) {
  const bloomIntensity = useMemo(() => {
    if (time < EXPLOSION_START)   return 0.6;
    if (time < EXPLOSION_END)     return 0.6 + _ease(_prog(time, EXPLOSION_START, EXPLOSION_END)) * 2.4;
    if (time < IMPLODE_START)     return 3.0;
    if (time < IMPLODE_END)       return 3.0 - _ease(_prog(time, IMPLODE_START, IMPLODE_END)) * 2.2;
    return 0.8;
  }, [time]);

  const chromaticOffset = useMemo(() => {
    let mag = 0;
    if (time >= EXPLOSION_START && time < EXPLOSION_START + 0.4) {
      mag = _ease(_prog(time, EXPLOSION_START, EXPLOSION_START + 0.4)) * 0.008;
    } else if (time >= EXPLOSION_START + 0.4 && time < EXPLOSION_START + 1.8) {
      mag = _ease(1 - _prog(time, EXPLOSION_START + 0.4, EXPLOSION_START + 1.8)) * 0.005;
    }
    _chromaticVec.set(mag, mag * 0.4);
    return _chromaticVec;
  }, [time]);

  return (
    <>
      <color attach="background" args={['#05050f']} />
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 10, 10]} intensity={1.8} />
      <pointLight position={[-10, -10, -10]} intensity={1.2} />
      <IntroScene time={time} onComplete={onComplete} />
      <Suspense fallback={null}>
        <Environment preset="city" />
      </Suspense>
      <EffectComposer>
        <Bloom
          intensity={bloomIntensity}
          luminanceThreshold={0.15}
          luminanceSmoothing={0.85}
          mipmapBlur
        />
        <ChromaticAberration
          offset={chromaticOffset}
          blendFunction={BlendFunction.NORMAL}
        />
        <Vignette
          offset={0.35}
          darkness={0.75}
          blendFunction={BlendFunction.NORMAL}
        />
      </EffectComposer>
    </>
  );
}

/**
 * CameraManager — teleports the camera when transitioning intro → game.
 * Must live inside the Canvas to access useThree().
 */
function CameraManager({ showWelcome, cameraZ }) {
  const { camera } = useThree();
  useEffect(() => {
    if (!showWelcome) {
      camera.position.set(0, 0, cameraZ);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }
  }, [showWelcome, camera, cameraZ]);
  return null;
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
  const setExplosionT = useGameStore((state) => state.setExplosionT);
  const showTunnels = useGameStore((state) => state.showTunnels);
  const setShowTunnels = useGameStore((state) => state.setShowTunnels);
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

  const { setShowCursor, cursorToCubePos, cubePosToCursor } = useCursor();

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

  // Intro time — drives IntroBranch (3D) and WelcomeScreen DOM overlay in sync
  const [introTime, setIntroTime] = useState(0);

  // Co-op Crawler mode
  const [coopMode, setCoopMode] = useState(false);

  // Bottom sheet state for new nav bar
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState('more'); // 'more' or 'views'

  // Freeplay setup wizard
  const [showFreeplayWizard, setShowFreeplayWizard] = useState(false);

  // Disparity Mode wizard + first-flip gate
  const [showDisparityWizard, setShowDisparityWizard] = useState(false);
  const [disparityWaitingFirstFlip, setDisparityWaitingFirstFlip] = useState(false);
  const pendingDisparityLevelRef = useRef(3);
  // Countdown: null = not running, 3/2/1 = ticking, 'GO!' = flash before start
  const [disparityCountdown, setDisparityCountdown] = useState(null);

  // Disparity deaths map: gridId → rank (built from store, used by 3D tile labels)
  const disparityWinner = useGameStore((s) => s.disparityWinner);
  const showDisparityWinner = useGameStore((s) => s.showDisparityWinner);
  const _setShowDisparityWinner = useGameStore((s) => s.setShowDisparityWinner);

  // ========================================================================
  // INTRO TIME — drives IntroBranch 3D content + WelcomeScreen DOM overlay
  // ========================================================================
  useEffect(() => {
    if (!showWelcome) return;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      setIntroTime((now - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [showWelcome]);

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

  // 3-2-1-GO countdown before chaos begins
  useEffect(() => {
    if (disparityCountdown === null) return;
    if (disparityCountdown === 'GO!') {
      const t = setTimeout(() => {
        setDisparityCountdown(null);
        setChaosLevel(pendingDisparityLevelRef.current);
      }, 600);
      return () => clearTimeout(t);
    }
    if (typeof disparityCountdown === 'number' && disparityCountdown > 0) {
      const t = setTimeout(() => {
        setDisparityCountdown((prev) => (prev === 1 ? 'GO!' : prev - 1));
      }, 900);
      return () => clearTimeout(t);
    }
  }, [disparityCountdown, setChaosLevel]);

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
    // Biome mode: manifoldStyles are pre-computed per-face by the wizard
    if (wizardSettings.biomeMode?.enabled) {
      newSettings.biomeMode = wizardSettings.biomeMode;
      newSettings.manifoldStyles = wizardSettings.manifoldStyles;
      preloadBiomeAssets(); // kick off GLB downloads only when biome mode is actually used
    } else {
      newSettings.biomeMode = { enabled: false, faceAssignment: null };
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
    }
    setSettings(newSettings);
    useGameStore.getState().clearLevel();
    // Biome mode starts solved so the stable city cache populates correctly
    if (!wizardSettings.biomeMode?.enabled) {
      shuffle();
    } else {
      useGameStore.getState().resetGame();
      useGameStore.getState().setHasShuffled(true);
    }
  }, [settings, setSettings, shuffle]);

  const handleWizardCancel = useCallback(() => {
    setShowFreeplayWizard(false);
    useGameStore.getState().setShowMainMenu(true);
  }, []);

  const handleMenuSettings = useCallback(() => {
    setShowSettings(true);
  }, [setShowSettings]);

  const handleMenuDisparity = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    setShowDisparityWizard(true);
  }, []);

  const handleDisparitySetupComplete = useCallback(({ cubeSize, disparityLevel, flipCap, visualMode: vm, flipMode: fm, showTunnels: st }) => {
    setShowDisparityWizard(false);
    useGameStore.getState().clearLevel();
    useGameStore.getState().clearDisparityGame();
    if (flipCap != null) useGameStore.getState().setDisparityFlipCap(flipCap);
    // Keep current background/colors; only disable biome mode so the scene renders
    setSettings({ ...settings, biomeMode: { enabled: false, faceAssignment: null } });
    if (vm) setVisualMode(vm);
    setFlipMode(fm);
    if (st !== undefined) setShowTunnels(st);
    // Chaos stays OFF until the player makes the first flip
    pendingDisparityLevelRef.current = disparityLevel;
    setChaosLevel(0);
    // Start with a solved cube.  changeSize resets internally; same-size just needs reset().
    if (cubeSize !== size) {
      changeSize(cubeSize);
    } else {
      reset();
    }
    setDisparityWaitingFirstFlip(true);
  }, [size, settings, setSettings, changeSize, setVisualMode, setFlipMode, setShowTunnels, setChaosLevel, reset]);

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

  const handleMenuBiome = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    setSettings({
      ...settings,
      biomeMode: { enabled: true, faceAssignment: null },
      manifoldStyles: resolveBiomeManifoldStyles(null),
      colorScheme: 'biome',
    });
    useGameStore.getState().clearLevel();
    // Start solved so stable city cache populates before any rotation
    useGameStore.getState().resetGame();
    useGameStore.getState().setHasShuffled(true);
  }, [settings, setSettings]);

  const closeTutorial = useCallback(() => {
    setShowTutorial(false);
    markTutorialDone();
  }, [setShowTutorial, markTutorialDone]);

  // Tap flip handler — also serves as the "pick first tile" entry point for disparity mode
  const onTapFlip = useCallback((pos, dirKey) => {
    if (disparityWaitingFirstFlip) {
      flipSticker(pos, dirKey);
      setDisparityWaitingFirstFlip(false);
      setDisparityCountdown(3); // start 3-2-1-GO countdown
      return;
    }
    flipSticker(pos, dirKey);
  }, [flipSticker, disparityWaitingFirstFlip]);

  const onFlipWaveComplete = useCallback(() => {
    setFlipWaveOrigins([]);
  }, [setFlipWaveOrigins]);

  // Handle tile selection — also catches the "pick first tile" tap when flipMode is off
  const handleSelectTile = useCallback((pos, dirKey) => {
    if (disparityWaitingFirstFlip) {
      flipSticker(pos, dirKey);
      setDisparityWaitingFirstFlip(false);
      setDisparityCountdown(3); // start 3-2-1-GO countdown
      return;
    }
    const newCursor = cubePosToCursor(pos, dirKey);
    useGameStore.getState().setCursor(newCursor);
    setShowCursor(true);
    setSelectedTileForRotation({ pos, dirKey, cursor: newCursor });
  }, [disparityWaitingFirstFlip, flipSticker, setChaosLevel, cubePosToCursor, setShowCursor, setSelectedTileForRotation]);

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
  // KEYBOARD HANDLER — consolidated via useKeyboardControls hook
  // ========================================================================
  const handleToggleHandsMode = useCallback(() => {
    setHandsMode(!handsMode);
    if (!handsMode) {
      setHandsMoveHistory([]);
      setHandsMoveQueue([]);
      setHandsTps(0);
      handsMoveTimestamps.current = [];
    }
  }, [handsMode, setHandsMode, setHandsMoveHistory, setHandsMoveQueue, setHandsTps]);

  const { performCursorRotation } = useKeyboardControls({
    onMove,
    onFlip: onTapFlip,
    onUndo: undo,
    onReset: reset,
    onShuffle: () => { reset(); setTimeout(() => shuffle(), 100); },
    onSaveState: handleSaveState,
    onLoadState: handleLoadState,
    onLevelJump: handleLevelSelect,
    onExecuteHandsMove: executeHandsMove,
    onToggleHandsMode: handleToggleHandsMode,
    disabled: coopMode,
  });


  // ========================================================================
  // RENDER
  // ========================================================================
  const cameraZ = (isMobile ? { 2: 12, 3: 17, 4: 25, 5: 38 } : { 2: 10, 3: 14, 4: 20, 5: 30 })[size] || 14;

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
      {showTutorial && !showWelcome && <Tutorial onClose={closeTutorial} onMainMenu={() => { closeTutorial(); handleBackToMainMenu(); }} />}

      {/* Single persistent Canvas — never unmounts, eliminates context loss on intro→game */}
      <div className="canvas-container" onContextMenu={(e) => e.preventDefault()}>
        <Canvas
          camera={{ position: showWelcome ? [0, 3, 12] : [0, 0, cameraZ], fov: 40 }}
          dpr={[1, 1.5]}
          gl={{ powerPreference: 'high-performance', antialias: true }}
        >
          <CameraManager showWelcome={showWelcome} cameraZ={cameraZ} />
          {showWelcome ? (
            <IntroBranch time={introTime} onComplete={handleWelcomeComplete} />
          ) : (
            <GameScene
              onMove={onMove}
              onTapFlip={onTapFlip}
              onAnimComplete={handleAnimComplete}
              onCascadeComplete={onCascadeComplete}
              onSelectTile={handleSelectTile}
              onClearTileSelection={() => setSelectedTileForRotation(null)}
              onFlipWaveComplete={onFlipWaveComplete}
              onFaceRotationMode={handleFaceRotationMode}
              animState={animState}
              manifoldMap={manifoldMap}
              antipodalData={antipodalData}
              teachModeActive={teachMode.active}
              layerHighlight={teachMode.layerHighlight}
            />
          )}
        </Canvas>
      </div>

      {/* Welcome DOM overlay — transparent background, Canvas shows through */}
      {showWelcome && (
        <WelcomeScreen onEnter={handleWelcomeComplete} introTime={introTime} />
      )}

      {!showWelcome && (<>
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
          onHome={handleBackToMainMenu}
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

        {/* Disparity HUD — RIP death log + winner announcement */}
        {(chaosMode || disparityWinner) && <DisparityHUD />}

        {/* Disparity countdown — 3-2-1-GO overlay before chaos starts */}
        {disparityCountdown !== null && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 8000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div key={disparityCountdown} style={{
              fontSize: disparityCountdown === 'GO!' ? '6rem' : '9rem',
              fontWeight: 900,
              fontFamily: 'monospace',
              color: disparityCountdown === 'GO!' ? '#22c55e' : '#ef4444',
              textShadow: `0 0 40px ${disparityCountdown === 'GO!' ? '#22c55e' : '#ef4444'}`,
              animation: 'disparity-cd-pop 0.3s cubic-bezier(0.22,1,0.36,1) forwards',
              letterSpacing: '0.02em',
            }}>
              {disparityCountdown}
            </div>
            <style>{`
              @keyframes disparity-cd-pop {
                0%   { transform: scale(1.6); opacity: 0; }
                40%  { transform: scale(0.95); opacity: 1; }
                100% { transform: scale(1); opacity: 0.9; }
              }
            `}</style>
          </div>
        )}

        {/* Disparity Winner — cinematic celebration screen */}
        {showDisparityWinner && (
          <Suspense fallback={null}>
            <DisparityWinnerScreen
              onDismiss={() => {
                useGameStore.getState().clearDisparityGame();
                useGameStore.getState().setChaosLevel(0);
                setShowDisparityWizard(true);
              }}
            />
          </Suspense>
        )}

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
        maxChaosLevel={currentLevelData?.chaosLevel || 5}
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
        onToggleHands={handleToggleHandsMode}
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
          onBiome={handleMenuBiome}
          onDisparity={handleMenuDisparity}
        />
      )}
      {showLevelSelect && <Suspense fallback={null}><LevelSelectScreen onSelectLevel={handleLevelSelect} onBack={handleBackToMainMenu} /></Suspense>}
      {showSettings && <SettingsMenu onClose={() => setShowSettings(false)} settings={settings} onSettingsChange={setSettings} faceImages={faceImages} onFaceImage={handleFaceImage} />}
      {showFreeplayWizard && <Suspense fallback={null}><FreeplaySetupWizard onComplete={handleWizardComplete} onCancel={handleWizardCancel} initialSettings={settings} /></Suspense>}
      {showDisparityWizard && (
        <Suspense fallback={null}>
          <DisparitySetupWizard
            onStart={handleDisparitySetupComplete}
            onCancel={() => { setShowDisparityWizard(false); useGameStore.getState().setShowMainMenu(true); }}
          />
        </Suspense>
      )}
      {disparityWaitingFirstFlip && (
        <div style={{
          position: 'fixed', bottom: '110px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 500, pointerEvents: 'none',
          fontFamily: "-apple-system, 'Helvetica Neue', Roboto, sans-serif",
        }}>
          <div style={{
            background: 'rgba(0,0,0,0.78)', borderRadius: '14px', padding: '14px 22px',
            textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(10px)', whiteSpace: 'nowrap',
          }}>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#fff', marginBottom: '3px' }}>
              Tap any tile to begin
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
              Your chosen tile starts the disparity cascade
            </div>
          </div>
        </div>
      )}
      {showHelp && <HelpMenu onClose={() => setShowHelp(false)} />}
      {showFirstFlipTutorial && <FirstFlipTutorial onClose={() => setShowFirstFlipTutorial(false)} onMainMenu={() => { setShowFirstFlipTutorial(false); handleBackToMainMenu(); }} />}

      {solveModeActive && (
        <Suspense fallback={null}>
          <SolveMode cubies={cubies} size={size} onClose={() => { setSolveModeActive(false); setSolveHighlights([]); }}
            onHighlightChange={setSolveHighlights} focusedStep={solveFocusedStep} onFocusStep={setSolveFocusedStep} />
        </Suspense>
      )}

      {teachMode.active && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {victory && (
        <Suspense fallback={null}>
          <VictoryScreen winType={victory} moves={moves} time={gameTime}
            onContinue={handleVictoryContinue} onNewGame={handleVictoryNewGame}
            currentLevel={currentLevel} levelData={currentLevelData}
            onNextLevel={handleNextLevel} hasNextLevel={currentLevel && currentLevel < 10}
            onMainMenu={() => { setVictory(null); handleBackToMainMenu(); }} />
        </Suspense>
      )}

      {showCutscene && currentLevel === 10 && <Suspense fallback={null}><Level10Cutscene onComplete={handleCutsceneComplete} onSkip={handleCutsceneComplete} /></Suspense>}
      {showLevelTutorial && currentLevelData && <Suspense fallback={null}><LevelTutorial level={currentLevelData} onClose={handleTutorialClose} onMainMenu={() => { levelTutorialClose(); handleBackToMainMenu(); }} /></Suspense>}
      {showNetPanel && <Suspense fallback={null}><CubeNet cubies={cubies} size={size} onTapFlip={onTapFlip} flipMode={flipMode} onClose={() => setShowNetPanel(false)} faceColors={resolvedColors} faceTextures={faceTextures} /></Suspense>}

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
      {showDevConsole && <Suspense fallback={null}><DevConsole onClose={() => setShowDevConsole(false)} onPreset={handlePreset} onSaveState={handleSaveState} onLoadState={handleLoadState} hasSavedState={!!savedCubeState} size={size} onJumpToLevel={handleLevelSelect} onInstantChaos={handleInstantChaos} moveHistory={moveHistory} /></Suspense>}
      </>)}
    </div>
  );
}
