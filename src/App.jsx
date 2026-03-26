// src/App.jsx
/**
 * WORM³ Main Application
 *
 * Refactored to use Zustand state management and custom hooks.
 * Original 2343 lines reduced to ~700 lines with modular architecture.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
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
import { clearRefractory } from './game/refractoryMap.js';

// Hooks
import { useShallow } from 'zustand/react/shallow';
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
import GameScene from './3d/GameScene.jsx';
import IntroScene from './components/intro/IntroScene.jsx';
import { RotatingBlackCube } from './components/menus/MainMenu.jsx';
import { setSharedRenderer, tickPreviews, hasActivePreviews } from './3d/TilePreviewRenderer.js';

// UI components
import WelcomeScreen from './components/screens/WelcomeScreen.jsx';
import Tutorial from './components/screens/Tutorial.jsx';
import UILayer from './components/UILayer.jsx';
import { useTeachMode } from './teach/useTeachMode.js';
import { useAntipodalIntegrity } from './hooks/useAntipodalIntegrity.js';
import { isMobile } from './utils/device.js';
import { EXPLOSION_START, EXPLOSION_END, IMPLODE_START, IMPLODE_END } from './components/intro/introTiming.js';
// Lazy-loaded: not needed on initial render, deferred to reduce parse time
const PlatformerWormMode = React.lazy(() => import('./worm/PlatformerWormMode.jsx'));
const HealerWormMode = React.lazy(() => import('./worm/HealerWormMode.jsx'));
const WormTouchControls = React.lazy(() => import('./worm/WormTouchControls.jsx'));
const HollowVoidCube = React.lazy(() => import('./3d/HollowVoidCube.jsx'));


const _clamp = (t, a = 0, b = 1) => Math.max(a, Math.min(b, t));
const _ease = t => t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2;
const _prog = (t, s, e) => _clamp((t - s) / (e - s));
const _chromaticVec = new Vector2(0, 0);

/**
 * IntroBranch — 3D content rendered inside the Canvas during the welcome/intro.
 * Contains IntroScene, post-processing, and intro lights.
 * Unmounting is avoided by conditionally hiding it (never fully unmounting the Canvas).
 */
function IntroBranch({ time, onComplete, reducedMotion = false, performanceMode = false }) {
  const bloomIntensity = useMemo(() => {
    if (time < EXPLOSION_START) return reducedMotion ? 0.25 : 0.6;
    if (time < EXPLOSION_END) return (reducedMotion ? 0.25 : 0.6) + _ease(_prog(time, EXPLOSION_START, EXPLOSION_END)) * (reducedMotion ? 0.9 : 2.4);
    if (time < IMPLODE_START) return reducedMotion ? 1.1 : 3.0;
    if (time < IMPLODE_END) return (reducedMotion ? 1.1 : 3.0) - _ease(_prog(time, IMPLODE_START, IMPLODE_END)) * (reducedMotion ? 0.7 : 2.2);
    return reducedMotion ? 0.3 : 0.8;
  }, [time, reducedMotion]);

  const chromaticOffset = useMemo(() => {
    let mag = 0;
    if (time >= EXPLOSION_START && time < EXPLOSION_START + 0.4) {
      mag = _ease(_prog(time, EXPLOSION_START, EXPLOSION_START + 0.4)) * (reducedMotion ? 0.0015 : 0.008);
    } else if (time >= EXPLOSION_START + 0.4 && time < EXPLOSION_START + 1.8) {
      mag = _ease(1 - _prog(time, EXPLOSION_START + 0.4, EXPLOSION_START + 1.8)) * (reducedMotion ? 0.001 : 0.005);
    }
    _chromaticVec.set(mag, mag * 0.4);
    return _chromaticVec;
  }, [time, reducedMotion]);

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
      {!performanceMode && (
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
      )}
    </>
  );
}

/**
 * CameraManager — teleports the camera when transitioning intro → menu → game.
 * Must live inside the Canvas to access useThree().
 */
function CameraManager({ showWelcome, showMainMenu, cameraZ }) {
  const { camera } = useThree();
  useEffect(() => {
    if (showMainMenu) {
      camera.position.set(0, 3, 12);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    } else if (!showWelcome) {
      camera.position.set(0, 0, cameraZ);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    }
  }, [showWelcome, showMainMenu, camera, cameraZ]);
  return null;
}

/**
 * MenuScene — the rotating black cube shown in the main menu.
 * Rendered inside the shared Canvas so there is never a second WebGL context.
 */
function MenuScene() {
  return (
    <>
      <color attach="background" args={['#060916']} />
      <ambientLight intensity={0.12} />
      <pointLight position={[8, 8, 10]} intensity={0.32} color="#a8d8ff" />
      <pointLight position={[-9, -8, 7]} intensity={0.18} color="#7aa3ff" />
      <pointLight position={[0, 2, -14]} intensity={0.08} color="#8db3ff" />
      <RotatingBlackCube />
      <Suspense fallback={null}>
        <Environment preset="city" intensity={0.22} />
      </Suspense>
      {!isMobile && (
        <EffectComposer>
          <Bloom intensity={0.26} luminanceThreshold={0.24} luminanceSmoothing={0.9} mipmapBlur />
          <Vignette offset={0.38} darkness={0.82} />
        </EffectComposer>
      )}
    </>
  );
}

/**
 * TilePreviewHost — lives inside the Canvas so it can inject the main R3F
 * renderer into TilePreviewRenderer, eliminating the need for a second WebGL
 * context (which causes context loss on mobile).
 */
function TilePreviewHost() {
  const { gl } = useThree();
  useEffect(() => { setSharedRenderer(gl); }, [gl]);
  useFrame((_, delta) => { if (hasActivePreviews()) tickPreviews(delta); });
  return null;
}

export default function WORM3() {
  // ========================================================================
  // STATE FROM ZUSTAND STORE
  // ========================================================================
  // UI navigation state — batched into one subscription (was 10 separate selectors)
  const {
    showWelcome, setShowWelcome,
    showMainMenu,
    showTutorial, setShowTutorial,
    setShowSettings, setShowLevelSelect,
    showMobileTouchHint, markMobileHintShown,
    markIntroSeen, markTutorialDone,
  } = useGameStore(useShallow(s => ({
    showWelcome: s.showWelcome,
    setShowWelcome: s.setShowWelcome,
    showMainMenu: s.showMainMenu,
    showTutorial: s.showTutorial,
    setShowTutorial: s.setShowTutorial,
    setShowSettings: s.setShowSettings,
    setShowLevelSelect: s.setShowLevelSelect,
    showMobileTouchHint: s.showMobileTouchHint,
    markMobileHintShown: s.markMobileHintShown,
    markIntroSeen: s.markIntroSeen,
    markTutorialDone: s.markTutorialDone,
  })));

  // Visual/display state — batched into one subscription (was 6 separate selectors)
  const {
    setFlipMode, setVisualMode,
    exploded, setExplosionT,
    setShowTunnels, setFlipWaveOrigins,
  } = useGameStore(useShallow(s => ({
    setFlipMode: s.setFlipMode,
    setVisualMode: s.setVisualMode,
    exploded: s.exploded,
    setExplosionT: s.setExplosionT,
    setShowTunnels: s.setShowTunnels,
    setFlipWaveOrigins: s.setFlipWaveOrigins,
  })));

  // Face rotation + saved cube state — batched into one subscription (was 6 separate selectors)
  const {
    faceRotationTarget, setFaceRotationTarget,
    selectedTileForRotation, setSelectedTileForRotation,
    savedCubeState, setSavedCubeState,
  } = useGameStore(useShallow(s => ({
    faceRotationTarget: s.faceRotationTarget,
    setFaceRotationTarget: s.setFaceRotationTarget,
    selectedTileForRotation: s.selectedTileForRotation,
    setSelectedTileForRotation: s.setSelectedTileForRotation,
    savedCubeState: s.savedCubeState,
    setSavedCubeState: s.setSavedCubeState,
  })));

  // ========================================================================
  // CUSTOM HOOKS
  // ========================================================================
  const {
    size, cubies, manifoldMap, metrics, resolvedColors,
    setCubies, setRotatedCubies, changeSize, shuffle, reset, flipSticker, healSticker
  } = useCubeState();

  const { moves, gameTime, victory, achievedWins: _achievedWins, setVictory } = useGameSession();

  const {
    animState, startAnimation, handleAnimComplete, onMove, startAnimatedShuffle, cancelShuffle
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

  const { moveHistory, undo, canUndo } = useUndo(startAnimation);

  // Animated shuffle: resets to solved, then plays 15 quick layer rotations visually.
  // Uses a 50ms delay after reset so React commits the solved layout before animation starts.
  const animatedShuffle = useCallback(() => {
    useGameStore.getState().setRotatedCubies(makeCubies(size));
    useGameStore.getState().resetGame();
    const axes = ['row', 'col', 'depth'];
    const moves = Array.from({ length: 15 }, () => ({
      axis: axes[Math.floor(Math.random() * 3)],
      sliceIndex: Math.floor(Math.random() * size),
      dir: Math.random() > 0.5 ? 1 : -1,
    }));
    setTimeout(() => {
      startAnimatedShuffle(moves, () => {
        useGameStore.getState().setHasShuffled(true);
      });
    }, 50);
  }, [size, startAnimatedShuffle]);

  // Teach Mode — step-by-step algorithm teaching
  const teachMode = useTeachMode();

  // Parity instability — flipped tiles spontaneously re-flip and propagate
  useParityDecay();

  // Antipodal integrity — real-time I(T) metric from the paper
  const antipodalData = useAntipodalIntegrity();

  // Intro time — drives IntroBranch (3D) and WelcomeScreen DOM overlay in sync
  const [introTime, setIntroTime] = useState(0);

  // Co-op Crawler mode
  const [coopMode, setCoopMode] = useState(false);

  // Antipodal PiP — second camera from opposite side of the cube
  const [showAntipodalPiP, setShowAntipodalPiP] = useState(false);

  const { wormHealerMode, wormPhase } = useGameStore(useShallow((s) => ({
    wormHealerMode: s.wormHealerMode,
    wormPhase: s.wormPhase,
  })));
  const wormholePhaseActive = wormHealerMode && (
    wormPhase === 'entering' || wormPhase === 'tunnel' || wormPhase === 'exiting'
  );
  const showAntipodalFrame = !showWelcome && ((showAntipodalPiP || wormHealerMode) && !wormholePhaseActive);

  // Bottom sheet state for new nav bar
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState('more'); // 'more' or 'views'

  // Freeplay setup wizard
  const [showFreeplayWizard, setShowFreeplayWizard] = useState(false);
  const [showWormModeWizard, setShowWormModeWizard] = useState(false);

  // Merge Mode theme picker
  const [showMergeThemePicker, setShowMergeThemePicker] = useState(false);

  // Disparity Mode wizard + first-flip gate
  const [showDisparityWizard, setShowDisparityWizard] = useState(false);
  const [disparityWaitingFirstFlip, setDisparityWaitingFirstFlip] = useState(false);
  const pendingDisparityLevelRef = useRef(3);
  // Countdown: null = not running, 3/2/1 = ticking, 'GO!' = flash before start
  const [disparityCountdown, setDisparityCountdown] = useState(null);

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
    const allStyles = ['solid', 'glossy', 'matte', 'metallic', 'carbonFiber', 'hexGrid', 'comic', 'cafeWall', 'hermanGrid', 'opticSpin', 'ouchi', 'scintillatingGrid', 'zoellner', 'kanizsa', 'grass', 'ice', 'sand', 'water', 'wood', 'circuit', 'holographic', 'pulse', 'lava', 'galaxy', 'neural'];

    // Build manifoldStyles — explicit per-face overrides take precedence.
    // Treat 'random' as unset: a per-face entry of 'random' is not a real style key
    // and would reach the renderer as an unknown style (renders as solid).  This can
    // happen if a stale perFaceStyles object was seeded from a 'random' global style.
    const manifoldStyles = {};
    [1, 2, 3, 4, 5, 6].forEach(id => {
      const perFace = wizardSettings.perFaceStyles?.[id];
      if (perFace && perFace !== 'random') {
        manifoldStyles[id] = perFace;
      } else if (wizardSettings.tileStyle === 'random' || perFace === 'random') {
        manifoldStyles[id] = allStyles[Math.floor(Math.random() * allStyles.length)];
      } else {
        manifoldStyles[id] = wizardSettings.tileStyle || 'solid';
      }
    });

    const newSettings = {
      ...settings,
      colorScheme: wizardSettings.colorScheme,
      backgroundTheme: wizardSettings.backgroundTheme,
      manifoldStyles,
      biomeMode: { enabled: false, faceAssignment: null },
    };
    if (wizardSettings.customColors) {
      newSettings.customColors = wizardSettings.customColors;
    }

    setSettings(newSettings);
    useGameStore.getState().clearLevel();

    const targetSize = wizardSettings.cubeSize || size;
    if (targetSize !== size) {
      // changeSize resets the cube to solved; we then manually shuffle with the new size
      // because the `shuffle` callback closes over the old size and would mis-scramble.
      changeSize(targetSize);
      let state = makeCubies(targetSize);
      for (let i = 0; i < 25; i++) {
        const ax = ['row', 'col', 'depth'][Math.floor(Math.random() * 3)];
        const slice = Math.floor(Math.random() * targetSize);
        const dir = Math.random() > 0.5 ? 1 : -1;
        state = rotateSliceCubies(state, targetSize, ax, slice, dir);
      }
      setRotatedCubies(state);
      useGameStore.getState().setHasShuffled(true);
    } else {
      animatedShuffle();
    }
  }, [settings, setSettings, animatedShuffle, size, changeSize, setRotatedCubies]);

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

  const handleDisparitySetupComplete = useCallback(({ cubeSize, disparityLevel, flipCap, visualMode: vm, flipMode: fm, showTunnels: st, colorScheme: cs }) => {
    setShowDisparityWizard(false);
    useGameStore.getState().clearLevel();
    useGameStore.getState().clearDisparityGame();
    if (flipCap != null) useGameStore.getState().setDisparityFlipCap(flipCap);
    const newSettings = { ...settings, biomeMode: { enabled: false, faceAssignment: null } };
    if (cs) newSettings.colorScheme = cs;
    setSettings(newSettings);
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

  const handleMenuWormHealer = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    setShowWormModeWizard(true);
  }, []);

  const handleWormSetupComplete = useCallback((wizardSettings) => {
    setShowWormModeWizard(false);

    // Build styling payload
    const allStyles = ['solid', 'glossy', 'matte', 'metallic', 'carbonFiber', 'hexGrid', 'comic', 'cafeWall', 'hermanGrid', 'opticSpin', 'ouchi', 'scintillatingGrid', 'zoellner', 'kanizsa', 'grass', 'ice', 'sand', 'water', 'wood', 'circuit', 'holographic', 'pulse', 'lava', 'galaxy', 'neural'];
    const manifoldStyles = {};
    [1, 2, 3, 4, 5, 6].forEach(id => {
      const perFace = wizardSettings.perFaceStyles?.[id];
      if (perFace && perFace !== 'random') {
        manifoldStyles[id] = perFace;
      } else if (wizardSettings.tileStyle === 'random' || perFace === 'random') {
        manifoldStyles[id] = allStyles[Math.floor(Math.random() * allStyles.length)];
      } else {
        manifoldStyles[id] = wizardSettings.tileStyle || 'solid';
      }
    });

    const newSettings = {
      ...settings,
      colorScheme: wizardSettings.colorScheme,
      backgroundTheme: wizardSettings.backgroundTheme,
      manifoldStyles,
      biomeMode: { enabled: false, faceAssignment: null },
    };
    if (wizardSettings.customColors) newSettings.customColors = wizardSettings.customColors;
    setSettings(newSettings);

    // Atomic init — clears disparity fields AND sets wormHealerMode:true in a single
    // Zustand set() so nothing can clobber it between calls.
    useGameStore.getState().clearLevel();
    useGameStore.getState().setWormSpeed(wizardSettings.wormSpeed ?? 1.0);
    useGameStore.getState().setWormOrbCount(wizardSettings.wormOrbCount ?? 5);
    useGameStore.getState().setWormholeInterval(wizardSettings.wormholeInterval ?? 10);
    useGameStore.getState().setWormColor(wizardSettings.wormColor ?? '#33ff66');
    useGameStore.getState().initWormMode();

    // Resize / reset cube AFTER worm mode is established
    const targetSize = wizardSettings.cubeSize || 3;
    if (targetSize !== size) {
      changeSize(targetSize);
    } else {
      reset();
    }
  }, [settings, setSettings, reset, size, changeSize]);

  const handleWormWizardCancel = useCallback(() => {
    setShowWormModeWizard(false);
    useGameStore.getState().setShowMainMenu(true);
  }, []);

  const handleWormRetry = useCallback(() => {
    useGameStore.getState().clearLevel();
    useGameStore.getState().initWormMode();
    reset();
  }, [reset]);

  const handleWormNewGame = useCallback(() => {
    useGameStore.getState().clearDisparityGame();
    useGameStore.getState().setShowMainMenu(false);
    setShowWormModeWizard(true);
  }, []);

  const handleMenuHolonomy = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    useGameStore.getState().clearLevel();
    useGameStore.getState().clearDisparityGame();
    useGameStore.getState().setHolonomyMode(true);
    setSettings({ ...settings, biomeMode: { enabled: false, faceAssignment: null } });
    if (size !== 3) changeSize(3);
    reset();
  }, [settings, setSettings, size, changeSize, reset]);

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

  const handleMenuMerge = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    setShowMergeThemePicker(true);
  }, []);

  const handleMergeStart = useCallback((themeId) => {
    setShowMergeThemePicker(false);
    useGameStore.getState().setMergeTheme(themeId);
    useGameStore.getState().setMergeMode(true);
    useGameStore.getState().clearLevel();
    useGameStore.getState().resetGame();
    useGameStore.getState().setHasShuffled(true);
    shuffle();
  }, [shuffle]);

  const handleMergeCancel = useCallback(() => {
    setShowMergeThemePicker(false);
    useGameStore.getState().setShowMainMenu(true);
  }, []);

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

    // Mobile explore flow: keep direct swipe-to-rotate behavior without
    // opening the directional rotation selector popup on tap.
    if (isMobile) return;

    setSelectedTileForRotation({ pos, dirKey, cursor: newCursor });
  }, [disparityWaitingFirstFlip, flipSticker, cubePosToCursor, setShowCursor, setSelectedTileForRotation]);

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
    // Cancel any animated shuffle still playing from a previous game session.
    cancelShuffle();
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
    // Save the level's chaos setting before resetGame() wipes it.
    const savedChaosLevel = currentLevelData?.chaosLevel ?? 0;
    useGameStore.getState().resetGame();
    clearRefractory();
    if (savedChaosLevel > 0) useGameStore.getState().setChaosLevel(savedChaosLevel);
    useGameStore.getState().setHasShuffled(true);
  }, [cancelShuffle, currentLevelData, currentLevel, size, setRotatedCubies]);

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
    else animatedShuffle();
  }, [currentLevel, currentLevelData, setVictory, shuffleForLevel, animatedShuffle]);

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
    if (targetFlips <= 0) return;

    // Precompute every valid edge sticker position once.
    // The old approach probed random (x,y,z,dir) tuples and retried on misses,
    // which was O(rejects * targetFlips) iterations with no upper bound.
    const candidates = [];
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          const checks = [
            ['PX', x === size - 1], ['NX', x === 0],
            ['PY', y === size - 1], ['NY', y === 0],
            ['PZ', z === size - 1], ['NZ', z === 0],
          ];
          for (const [dirKey, isEdge] of checks) {
            if (isEdge) candidates.push({ x, y, z, dirKey });
          }
        }
      }
    }

    // Fisher-Yates shuffle — unbiased no-replacement sampling
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = candidates[i]; candidates[i] = candidates[j]; candidates[j] = tmp;
    }

    // Build the manifold map once before the loop.
    // The map is keyed by origPos/origDir, which never mutate during sticker flips
    // (only `curr` and `flips` change).  Rebuilding it per flip was O(size³) wasted
    // work — on a 5×5 at 80 % disparity that was 120 full O(N³) scans.
    let state = cubies;
    const manifoldMap = buildManifoldGridMap(state, size);

    const count = Math.min(targetFlips, candidates.length);
    for (let i = 0; i < count; i++) {
      const { x, y, z, dirKey } = candidates[i];
      state = flipStickerPair(state, size, x, y, z, dirKey, manifoldMap);
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

  // Wraps reset() to also cancel any in-flight disparity countdown and clear the
  // first-flip gate.  Without this, resetting mid-countdown lets the timeout fire
  // after ~3 s and silently restart chaos on the freshly-solved cube.
  const handleReset = useCallback(() => {
    reset();
    setDisparityCountdown(null);
    setDisparityWaitingFirstFlip(false);
    // reset() calls resetGame() which clears chaosLevel. Re-apply the level's
    // configured chaos so the mode stays active after a keyboard/button reset.
    const savedChaosLevel = currentLevelData?.chaosLevel ?? 0;
    if (savedChaosLevel > 0) useGameStore.getState().setChaosLevel(savedChaosLevel);
  }, [reset, currentLevelData]);

  const { performCursorRotation } = useKeyboardControls({
    onMove,
    onFlip: onTapFlip,
    onUndo: undo,
    onReset: handleReset,
    onShuffle: animatedShuffle,
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
  const cameraZ = (isMobile ? { 2: 12, 3: 17, 4: 25, 5: 38, 6: 52, 7: 68 } : { 2: 10, 3: 14, 4: 20, 5: 30, 6: 42, 7: 55 })[size] || 14;
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const introPerformanceMode = isMobile || prefersReducedMotion;


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

      {/* Single persistent Canvas — never unmounts, eliminates context loss on intro→game.
          Also renders the main-menu cube scene so there is never a second WebGL context. */}
      <div className="canvas-container" onContextMenu={(e) => e.preventDefault()}>
        <Canvas
          camera={{ position: (showWelcome || showMainMenu) ? [0, 3, 12] : [0, 0, cameraZ], fov: 40 }}
          dpr={[1, 1.5]}
          gl={{ powerPreference: 'high-performance', antialias: true }}
        >
          <CameraManager showWelcome={showWelcome} showMainMenu={showMainMenu} cameraZ={cameraZ} />
          <TilePreviewHost />
          {showWelcome ? (
            <IntroBranch
              time={introTime}
              onComplete={handleWelcomeComplete}
              reducedMotion={prefersReducedMotion}
              performanceMode={introPerformanceMode}
            />
          ) : showMainMenu ? (
            <MenuScene />
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
              onHeal={healSticker}
              onRotate={startAnimation}
              showAntipodalPiP={showAntipodalPiP}
            />
          )}
        </Canvas>
      </div>

      {/* Antipodal PiP frame overlay — border + label drawn over the canvas scissor region */}
      {showAntipodalFrame && (
        <div
          style={{
            position: 'fixed',
            top: `${(isMobile ? (window.matchMedia('(max-height: 500px) and (orientation: landscape)').matches ? 36 : 44) : 56) + 8}px`,
            left: '8px',
            width: '240px',
            height: '180px',
            border: '2px solid rgba(0, 217, 255, 0.7)',
            borderRadius: '6px',
            pointerEvents: 'none',
            zIndex: 50,
            boxShadow: '0 0 12px rgba(0, 217, 255, 0.35), inset 0 0 8px rgba(0, 0, 0, 0.4)',
          }}
        >
          <span style={{
            position: 'absolute',
            top: '4px',
            left: '6px',
            fontSize: '9px',
            fontFamily: "'Courier New', monospace",
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: 'rgba(0, 217, 255, 0.85)',
            textTransform: 'uppercase',
            pointerEvents: 'none',
          }}>
            ↕ Antipodal
          </span>
        </div>
      )}

      {/* Welcome DOM overlay — transparent background, Canvas shows through */}
      {showWelcome && (
        <WelcomeScreen onEnter={handleWelcomeComplete} introTime={introTime} />
      )}

      {!showWelcome && (
        <UILayer
          metrics={metrics}
          resolvedColors={resolvedColors}
          faceTextures={faceTextures}
          faceImages={faceImages}
          settings={settings}
          chaosMode={chaosMode}
          chaosLevel={chaosLevel}
          cascades={cascades}
          autoRotateEnabled={autoRotateEnabled}
          upcomingRotation={upcomingRotation}
          rotationCountdown={rotationCountdown}
          moveHistory={moveHistory}
          undo={undo}
          canUndo={canUndo}
          handsMode={handsMode}
          handsMoveHistory={handsMoveHistory}
          handsTps={handsTps}
          victory={victory}
          moves={moves}
          gameTime={gameTime}
          currentLevel={currentLevel}
          currentLevelData={currentLevelData}
          antipodalData={antipodalData}
          teachMode={teachMode}
          performCursorRotation={performCursorRotation}
          ui={{
            sheetOpen, setSheetOpen, sheetMode, setSheetMode,
            showFreeplayWizard, showWormModeWizard,
            showDisparityWizard, setShowDisparityWizard,
            disparityWaitingFirstFlip, disparityCountdown,
            showAntipodalPiP, onToggleAntipodalPiP: () => setShowAntipodalPiP(v => !v),
          }}
          handlers={{
            onReset: handleReset,
            onShuffle: animatedShuffle,
            onShuffleForLevel: shuffleForLevel,
            onChangeSize: changeSize,
            onSetChaosLevel: setChaosLevel,
            onSetAutoRotate: setAutoRotateEnabled,
            onSetSettings: setSettings,
            onFaceImage: handleFaceImage,
            onSetVictory: setVictory,
            onTapFlip,
            onBackToMainMenu: handleBackToMainMenu,
            onLevelSelect: handleLevelSelect,
            onCutsceneComplete: handleCutsceneComplete,
            onTutorialClose: handleTutorialClose,
            onLevelTutorialClose: levelTutorialClose,
            onNextLevel: handleNextLevel,
            onPreset: handlePreset,
            onInstantChaos: handleInstantChaos,
            onSaveState: handleSaveState,
            onLoadState: handleLoadState,
            onMenuPlay: handleMenuPlay,
            onMenuLevels: handleMenuLevels,
            onMenuFreeplay: handleMenuFreeplay,
            onMenuCoop: handleMenuCoop,
            onMenuTeach: handleMenuTeach,
            onMenuSettings: handleMenuSettings,
            onMenuBiome: handleMenuBiome,
            onMenuDisparity: handleMenuDisparity,
            onMenuWormHealer: handleMenuWormHealer,
            onMenuHolonomy: handleMenuHolonomy,
            onMenuMerge: handleMenuMerge,
            showMergeThemePicker,
            onMergeStart: handleMergeStart,
            onMergeCancel: handleMergeCancel,
            onWizardComplete: handleWizardComplete,
            onWizardCancel: handleWizardCancel,
            onDisparitySetupComplete: handleDisparitySetupComplete,
            onWormSetupComplete: handleWormSetupComplete,
            onWormWizardCancel: handleWormWizardCancel,
            onWormRetry: handleWormRetry,
            onWormNewGame: handleWormNewGame,
            onToggleHandsMode: handleToggleHandsMode,
            onFaceRotate: handleFaceRotate,
            onTileRotation: handleTileRotation,
            onTileFaceRotation: handleTileFaceRotation,
            onVictoryContinue: handleVictoryContinue,
            onVictoryNewGame: handleVictoryNewGame,
          }}
        />
      )}
    </div>
  );
}
