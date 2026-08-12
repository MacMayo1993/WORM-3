// src/App.jsx
/**
 * WORM³ Main Application
 *
 * Refactored to use Zustand state management and custom hooks.
 * Original 2343 lines reduced to ~700 lines with modular architecture.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import SafeEnvironment from './3d/SafeEnvironment.jsx';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';
import './App.css';

// Utils
import { resolveBiomeManifoldStyles } from './modes/CityBiomeMode.js';
import { completeLevel } from './utils/levels.js';
import { vibrate } from './utils/audio.js';
import { setFeelEnabled } from './utils/feel.js';
import { makeCubies } from './game/cubeState.js';
import { rotateSliceCubies } from './game/cubeRotation.js';
import { flipStickerPair } from './game/manifoldLogic.js';
import { getManifoldMap } from './game/manifoldMapStore.js';
import { clearRefractory } from './game/refractoryMap.js';
import { buildLevelStartState } from './levels/levelStaging.js';
import { resolveWizardTileStyles } from './utils/wizardTileStyles.js';

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
  useRandomMode,
  useDisparityGame,
  useDemoMode,
} from './hooks/index.js';

// 3D components
import IntroScene from './components/intro/IntroScene.jsx';
import NebulaEnvironment from './3d/NebulaEnvironment.jsx';
import InteractivePhotoBackground from './3d/InteractivePhotoBackground.jsx';
import { setSharedRenderer, tickPreviews, hasActivePreviews } from './3d/TilePreviewRenderer.js';
import { setWormSharedRenderer, tickWormPreviews, hasActiveWormPreviews } from './3d/WormPreviewRenderer.js';
import { setCubeSharedRenderer, tickCubePreviews, hasActiveCubePreviews } from './3d/CubePreviewRenderer.js';
import { getBackgroundUrl, MENU_BACKGROUNDS } from './utils/backgrounds.js';

// UI components
import WelcomeScreen from './components/screens/WelcomeScreen.jsx';
import Tutorial from './components/screens/Tutorial.jsx';
import MobiIntroScreen, {
  MOBI_LINES_WORM, MOBI_LINES_FREEPLAY, MOBI_LINES_RANDOM,
  MOBI_LINES_TEACH, MOBI_LINES_HOLONOMY, MOBI_LINES_COOP,
  MOBI_LINES_BIOME, MOBI_LINES_MERGE, MOBI_LINES_CHAOS,
  MOBI_LINES_DEMO_INTRO,
} from './components/screens/MobiIntroScreen.jsx';
import { UI_FONT } from './utils/uiTheme.js';
import ScreenTransition from './components/ScreenTransition.jsx';
// Static (not lazy): a Suspense fallback must be present the instant a lazy
// chunk starts loading, so the loading cube cannot itself live in a lazy chunk.
import LoadingScreen from './components/screens/LoadingScreen.jsx';
// Covers a mode transition with the loading cube while the scene's env map /
// textures decode. Reads drei's useProgress, so it must stay outside <Canvas>.
import SceneLoadingGate from './components/screens/SceneLoadingGate.jsx';
const ParityStoreScreen = React.lazy(() => import('./components/screens/ParityStoreScreen.jsx'));
const GameScene = React.lazy(() => import('./3d/GameScene.jsx'));
const UILayer = React.lazy(() => import('./components/UILayer.jsx'));
const RotatingBlackCube = React.lazy(() =>
  import('./components/menus/MainMenu.jsx').then((mod) => ({ default: mod.RotatingBlackCube }))
);
const ModeCarousel = React.lazy(() =>
  import('./components/menus/MainMenu.jsx').then((mod) => ({ default: mod.ModeCarousel }))
);
import { useTeachMode } from './teach/useTeachMode.js';
import { isMobile } from './utils/device.js';
import { preloadAppAssets } from './utils/preloadAssets.js';
import { GREEN_SHOW_START, FULL_FLIP_START, EXPLOSION_START, EXPLOSION_END, IMPLODE_START, IMPLODE_END } from './components/intro/introTiming.js';
// Lazy-loaded: not needed on initial render, deferred to reduce parse time
const PlatformerWormMode = React.lazy(() => import('./worm/PlatformerWormMode.jsx'));
const HollowVoidCube = React.lazy(() => import('./3d/HollowVoidCube.jsx'));
const DemoEndScreen = React.lazy(() => import('./components/screens/DemoEndScreen.jsx'));
const DemoForecastPicker = React.lazy(() => import('./components/screens/DemoForecastPicker.jsx'));
import {
  DemoProgressBar, DemoStepIntro, DemoCoach, DemoStepHint, DemoViewShowcase,
  DemoViewSpotlightHint, DemoFlipSpotlightHint, DemoControlTour, CONTROL_TOUR_SEQUENCE,
  DemoWormControlHint, DemoFlipProgress, DemoStepComplete, DemoStepLaunch, DemoRewardStamp
} from './components/screens/DemoFlowController.jsx';


const _clamp = (t, a = 0, b = 1) => Math.max(a, Math.min(b, t));
const _ease = t => t < 0.5 ? 4 * t ** 3 : 1 - Math.pow(-2 * t + 2, 3) / 2;
const _prog = (t, s, e) => _clamp((t - s) / (e - s));
const _chromaticVec = new Vector2(0, 0);

// The shared Canvas camera's resting FOV. Modes that reframe the camera restore
// this; CameraManager re-applies it on every screen transition.
const DEFAULT_CAMERA_FOV = 40;

/**
 * IntroBranch — 3D content rendered inside the Canvas during the welcome/intro.
 * Contains IntroScene, post-processing, and intro lights.
 * Unmounting is avoided by conditionally hiding it (never fully unmounting the Canvas).
 */
function IntroBranch({ time, onComplete, reducedMotion = false, performanceMode = false }) {
  const bloomIntensity = useMemo(() => {
    const base = reducedMotion ? 0.25 : 0.6;

    // All-manifold grid-line flash: +33 % bloom bell-curve from GREEN_SHOW+0.4
    // through FULL_FLIP_START (the window when all face-pair seams light up).
    const GRID_FLASH_START = GREEN_SHOW_START + 0.4; // ≈ 5.2 s
    const GRID_FLASH_END   = FULL_FLIP_START;         // 6.5 s
    const gridFlash =
      time >= GRID_FLASH_START && time < GRID_FLASH_END
        ? Math.sin(_prog(time, GRID_FLASH_START, GRID_FLASH_END) * Math.PI) * (base * 0.33)
        : 0;

    if (time < EXPLOSION_START) return base + gridFlash;
    if (time < EXPLOSION_END) return base + _ease(_prog(time, EXPLOSION_START, EXPLOSION_END)) * (reducedMotion ? 0.9 : 2.4);
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
      <ambientLight intensity={1.0} />
      <pointLight position={[10, 10, 10]} intensity={2.2} />
      <pointLight position={[-10, -10, -10]} intensity={1.6} />
      <pointLight position={[-6, 2, 8]} intensity={1.4} color="#4a7ccc" />
      <pointLight position={[5, -4, -6]} intensity={0.8} color="#2a4a8a" />
      {/* Volumetric nebula backdrop shared with the main menu. */}
      <NebulaEnvironment
        variant="intro"
        speed={reducedMotion ? 0.25 : 0.7}
        density={performanceMode ? 0.65 : 1}
        structure={0.9}
        performanceMode={performanceMode}
      />
      <IntroScene time={time} onComplete={onComplete} />
      <SafeEnvironment preset="city" />
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
 * ClockContinuity — keeps the shared clock's timeline unbroken across a
 * frameloop switch. R3F's setFrameloop zeroes clock.elapsedTime in both
 * directions, and several loops (the menu cube's slice animation, worm spawn
 * timers) hold absolute timestamps taken from it — a rewind to 0 would stall
 * them until the clock caught back up. Restore the pre-pause reading on the
 * first frame after the loop restarts. The negative priority sorts this ahead
 * of every other subscriber (and, unlike a positive one, does not hand R3F's
 * rendering over to us), so nothing else ever reads the zeroed value.
 * Must live inside the Canvas.
 */
function ClockContinuity({ paused }) {
  const clock = useThree((s) => s.clock);
  const lastElapsed = useRef(0);
  const resumeAt = useRef(null);
  useFrame(() => {
    if (resumeAt.current !== null) {
      clock.elapsedTime = resumeAt.current;
      resumeAt.current = null;
    }
    lastElapsed.current = clock.elapsedTime;
  }, -1000);
  useEffect(() => {
    if (paused) resumeAt.current = lastElapsed.current;
  }, [paused]);
  return null;
}

/**
 * CameraManager — teleports the camera when transitioning intro → menu → game.
 * Must live inside the Canvas to access useThree().
 */
function CameraManager({ showWelcome, showMainMenu, cameraZ }) {
  const { camera } = useThree();
  useEffect(() => {
    if (showWelcome) return; // the intro cinematic flies the camera itself
    // Everything in the shared Canvas borrows this one camera, and modes are
    // free to reframe it: the worm chase cam widens the FOV to 70–82° and rolls
    // `up` around the cube as the worm crosses faces. Position alone is not
    // enough to undo that — a leftover FOV renders the menu and mode-select
    // cubes ~2.4× too small, and a leftover up vector rolls the whole scene.
    // Restore the full framing, then aim.
    camera.fov = DEFAULT_CAMERA_FOV;
    camera.zoom = 1;
    camera.up.set(0, 1, 0);
    camera.position.set(0, showMainMenu ? 3 : 0, showMainMenu ? 12 : cameraZ);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [showWelcome, showMainMenu, camera, cameraZ]);
  return null;
}

/**
 * MenuScene — the rotating black cube shown in the main menu.
 * Rendered inside the shared Canvas so there is never a second WebGL context.
 */
function MenuScene({ onCubeClick, background }) {
  return (
    <>
      {/* Each app launch chooses one photo panorama from MENU_BACKGROUNDS. The
          warm field-guide controls stay readable regardless of the setting.
          SafeEnvironment keeps the solid backdrop if the HDRI cannot load. */}
      <color attach="background" args={['#38513d']} />
      <ambientLight intensity={1.7} color="#e8e3c5" />
      <pointLight position={[8, 8, 10]} intensity={4.0} color="#f0d89b" />
      <pointLight position={[-9, -5, 7]} intensity={1.9} color="#78956b" />
      <pointLight position={[0, -6, -8]} intensity={1.0} color="#456556" />
      <Suspense fallback={null}>
        <InteractivePhotoBackground
          files={getBackgroundUrl(background.file)}
          // Counter-rotate the panorama against the menu cube. The faster but
          // still gentle orbit lets a player read the whole environment instead
          // of waiting on one static horizon.
          rotationSpeed={isMobile ? -0.025 : -0.055}
          intensity={isMobile ? 0.84 : 0.98}
          blurriness={0}
        />
      </Suspense>
      <Suspense fallback={null}>
        <RotatingBlackCube onCubeClick={onCubeClick} />
      </Suspense>
      {!isMobile && (
        <EffectComposer>
          <Bloom intensity={0.12} luminanceThreshold={0.86} luminanceSmoothing={0.92} mipmapBlur />
          <Vignette offset={0.46} darkness={0.23} />
        </EffectComposer>
      )}
    </>
  );
}

/**
 * TilePreviewHost — lives inside the Canvas so it can inject the main R3F
 * renderer into the thumbnail renderers (tile styles and worms), eliminating
 * the need for a second WebGL context (which causes context loss on mobile).
 */
function TilePreviewHost() {
  const { gl } = useThree();
  useEffect(() => {
    setSharedRenderer(gl);
    setWormSharedRenderer(gl);
    setCubeSharedRenderer(gl);
  }, [gl]);
  useFrame((_, delta) => {
    if (hasActivePreviews()) tickPreviews(delta);
    if (hasActiveWormPreviews()) tickWormPreviews(delta);
    if (hasActiveCubePreviews()) tickCubePreviews(delta);
  });
  return null;
}

// Error boundary to catch Three.js renderer crashes (null .visible in scene traversal)
// and attempt recovery by resetting stickerHealAnims to clear any bad state.
class CanvasErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    console.error('[WORM-3] Canvas error recovered:', error?.message);
    // Clear any in-flight heal animations that may have caused corrupted scene state.
    try { useGameStore.setState({ stickerHealAnims: {} }); } catch (_) {}
    // Brief delay then re-mount the canvas subtree.
    setTimeout(() => this.setState({ hasError: false }), 200);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default function WORM3() {
  // ========================================================================
  // STATE FROM ZUSTAND STORE
  // ========================================================================
  // UI navigation state — batched into one subscription (was 10 separate selectors)
  const {
    showWelcome, setShowWelcome,
    showMainMenu,
    showSettings,
    showTutorial, setShowTutorial,
    setShowSettings,
    showMobileTouchHint, markMobileHintShown,
    markIntroSeen, markTutorialDone,
  } = useGameStore(useShallow(s => ({
    showWelcome: s.showWelcome,
    setShowWelcome: s.setShowWelcome,
    showMainMenu: s.showMainMenu,
    showSettings: s.showSettings,
    showTutorial: s.showTutorial,
    setShowTutorial: s.setShowTutorial,
    setShowSettings: s.setShowSettings,
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
    upcomingRotation, setChaosLevel,
    setAutoRotateEnabled, onCascadeComplete
  } = useChaosMode();

  const { setShowCursor, cursorToCubePos, cubePosToCursor } = useCursor();

  // When a chapter opens with no briefing to close, the scramble cannot run
  // inline: shuffleForLevel reads currentLevelData, which is still the previous
  // chapter's during that same tick. Bumping a token defers it to an effect,
  // which fires on the next render — by then the new level data has landed.
  const [briefingSkipToken, setBriefingSkipToken] = useState(0);
  const {
    currentLevel, currentLevelData, hasNextLevel, handleLevelSelect,
    handleCutsceneComplete, handleTutorialClose: levelTutorialClose,
    handleBackToMainMenu, handleNextLevel: levelHandleNextLevel
  } = useLevelSystem({ onBriefingSkipped: () => setBriefingSkipToken((t) => t + 1) });

  const { settings, faceImages, faceTextures, handleFaceImage, setSettings } = useSettings();

  // Keep the feel layer's SFX/haptics channels in sync with the player's settings
  // for the WHOLE app, not just worm mode. Tunnel flip feedback fires from the
  // ordinary flip path, so gating it only inside HealerWormMode would let those
  // sounds play with sfx turned off everywhere else.
  useEffect(() => {
    setFeelEnabled({ sfx: settings?.sfx ?? true, haptics: settings?.haptics ?? true });
  }, [settings?.sfx, settings?.haptics]);

  const {
    handsMode, handsMoveHistory, handsTps, executeHandsMove,
    setHandsMode, setHandsMoveHistory, setHandsMoveQueue, setHandsTps
  } = useHandsMode();
  const handsMoveTimestamps = useRef([]);

  const { moveHistory, undo, canUndo } = useUndo(startAnimation);

  // Animated shuffle: resets to solved, then plays 15 quick layer rotations visually.
  // Uses a 50ms delay after reset so React commits the solved layout before animation starts.
  // Reads size from store at call time to avoid stale closure when called from MOBI postAction.
  const animatedShuffle = useCallback(() => {
    cancelShuffle(); // clear any in-flight animation from a previous game
    const currentSize = useGameStore.getState().size;
    useGameStore.getState().resetGame();
    vibrate([50, 30, 100]); // haptic: "game starting" double-bump
    const axes = ['row', 'col', 'depth'];
    const moves = Array.from({ length: 15 }, () => ({
      axis: axes[Math.floor(Math.random() * 3)],
      sliceIndex: Math.floor(Math.random() * currentSize),
      dir: Math.random() > 0.5 ? 1 : -1,
    }));
    setTimeout(() => {
      startAnimatedShuffle(moves, () => {
        useGameStore.getState().setHasShuffled(true);
      });
    }, 50);
  }, [cancelShuffle, startAnimatedShuffle]);

  // Teach Mode — step-by-step algorithm teaching
  const teachMode = useTeachMode();

  // Leaving a mode must also close Teach Mode. Every exit path (quit, victory →
  // main menu, back from a level) only flips showMainMenu, so without this the
  // teach panel — a full-screen overlay — stayed mounted on top of the menu.
  // The solver is 3×3-only, so a size change out of 3 closes it too.
  const teachActive = teachMode.active;
  const exitTeachMode = teachMode.exitTeachMode;
  useEffect(() => {
    if (teachActive && (showMainMenu || size !== 3)) exitTeachMode();
  }, [teachActive, showMainMenu, size, exitTeachMode]);

  // Parity instability — flipped tiles spontaneously re-flip and propagate
  useParityDecay();

  // Random style cycling — randomizes colors and tiles every 15s
  useRandomMode();

  // Screen shake on each style cycle
  const randomStyleTick = useGameStore(s => s.randomStyleTick);
  const [randomShaking, setRandomShaking] = useState(false);
  const prevRandomTickRef = useRef(0);
  useEffect(() => {
    if (randomStyleTick > 0 && randomStyleTick !== prevRandomTickRef.current) {
      prevRandomTickRef.current = randomStyleTick;
      setRandomShaking(true);
      const id = setTimeout(() => setRandomShaking(false), 420);
      return () => clearTimeout(id);
    }
  }, [randomStyleTick]);

  // Intro time — drives IntroBranch (3D) and WelcomeScreen DOM overlay in sync
  const [introTime, setIntroTime] = useState(0);

  // Stable for this app launch: never reroll while settings, menus, or overlays
  // mount/unmount. MENU_BACKGROUNDS contains only file-backed photo panoramas.
  const [menuBackground] = useState(() => (
    MENU_BACKGROUNDS[Math.floor(Math.random() * MENU_BACKGROUNDS.length)]
 ));

  // Co-op Crawler mode
  const [coopMode, setCoopMode] = useState(false);

  // Mode-transition cover: bump this token when a mode is revealed to arm the
  // SceneLoadingGate, which covers the scene with the loading cube while its
  // environment map / textures decode (only if a decode is actually in flight).
  const [sceneGateToken, setSceneGateToken] = useState(0);
  const [sceneGateLabel, setSceneGateLabel] = useState('Loading');
  const [sceneGateEager, setSceneGateEager] = useState(false);
  const [sceneGateHold, setSceneGateHold] = useState(650);
  const [sceneGateZ, setSceneGateZ] = useState(9996);
  // opts.eager shows the cube at once and holds for opts.holdMs (vs. the default
  // probe that only shows if a decode registers); opts.z overrides the layer.
  const armSceneGate = useCallback((label = 'Loading', opts = {}) => {
    setSceneGateLabel(label);
    setSceneGateEager(!!opts.eager);
    setSceneGateHold(opts.holdMs ?? 650);
    setSceneGateZ(opts.z ?? 9996);
    setSceneGateToken((t) => t + 1);
  }, []);
  // Open-modal flag used to stand the demo's floating pills down (see
  // demoChromeSuppressed below).
  const showHelp = useGameStore((s) => s.showHelp);

  // Antipodal PiP — second camera from opposite side of the cube. Store-backed
  // so scripted view sequences (the demo's "Far Side" beat) can open it.
  const showAntipodalPiP = useGameStore((s) => s.showAntipodalPiP);
  const toggleAntipodalPiP = useGameStore((s) => s.toggleAntipodalPiP);

  // Adaptive quality: PerformanceMonitor (rendered inside the Canvas below) adjusts
  // this DPR range and the store's perfReducedFX flag when the rolling-average frame
  // rate sustains a decline/incline, so underpowered devices fall back automatically
  // instead of only being gated by a static cube-size threshold.
  const [dpr, setDpr] = useState([1, 1.5]);
  const setPerfReducedFX = useGameStore((s) => s.setPerfReducedFX);
  // PerformanceMonitor owns the adaptive decision; Mega is a separate temporary
  // override layered on top. Keeping both sources distinct prevents an ordinary
  // Worm setup from clearing a sustained low-FPS decision when the monitor stays
  // at its current factor and has no reason to emit another callback.
  const adaptiveReducedFXRef = useRef(false);
  const megaReducedFXOverrideRef = useRef(false);
  // Resolve the render DPR from both quality signals. A 15×15 Mega shell is
  // fill-rate bound (1,350 shaded quads covering the viewport), so it must render
  // at the reduced ceiling *immediately* — not only after the PerformanceMonitor
  // notices the drop several seconds in. Layering both sources here also stops a
  // perf-incline callback from raising DPR back up while Mega is still mounted.
  const applyEffectiveDpr = useCallback(() => {
    const reduced = adaptiveReducedFXRef.current || megaReducedFXOverrideRef.current;
    setDpr(reduced ? [0.75, 1] : [1, 1.5]);
  }, []);
  const handlePerformanceDecline = useCallback(() => {
    adaptiveReducedFXRef.current = true;
    applyEffectiveDpr();
    setPerfReducedFX(true);
  }, [setPerfReducedFX, applyEffectiveDpr]);
  const handlePerformanceIncline = useCallback(() => {
    adaptiveReducedFXRef.current = false;
    applyEffectiveDpr();
    setPerfReducedFX(megaReducedFXOverrideRef.current);
  }, [setPerfReducedFX, applyEffectiveDpr]);
  const clearMegaReducedFXOverride = useCallback(() => {
    if (!megaReducedFXOverrideRef.current) return;
    megaReducedFXOverrideRef.current = false;
    applyEffectiveDpr();
    setPerfReducedFX(adaptiveReducedFXRef.current);
  }, [setPerfReducedFX, applyEffectiveDpr]);

  const { wormHealerMode, wormPhase } = useGameStore(useShallow((s) => ({
    wormHealerMode: s.wormHealerMode,
    wormPhase: s.wormPhase,
  })));

  const wormholePhaseActive = wormHealerMode && (
    wormPhase === 'entering' || wormPhase === 'tunnel' || wormPhase === 'exiting'
  );
  const showAntipodalFrame = !showWelcome && (showAntipodalPiP && !wormholePhaseActive);

  // Page visibility — the shared Canvas parks its render loop while the app is
  // backgrounded (tab switched, screen off, another app on top). The scene is
  // live every frame it is on screen, so there is no reason to keep drawing it
  // when nobody can see it; ClockContinuity keeps the timeline intact.
  const [pageHidden, setPageHidden] = useState(false);
  useEffect(() => {
    const onVisibility = () => setPageHidden(document.visibilityState === 'hidden');
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Bottom sheet state for new nav bar
  const [sheetOpen, setSheetOpen] = useState(false);
  // Handed to the demo so its control tour can put away the Views / More sheet
  // it asked the player to open.
  const closeNavSheet = useCallback(() => setSheetOpen(false), []);
  const [sheetMode, setSheetMode] = useState('more'); // 'more' or 'views'

  // Cube mode selection + setup wizards
  const [showCubeModeSelect, setShowCubeModeSelect] = useState(false);
  const [showFreeplayWizard, setShowFreeplayWizard] = useState(false);
  const [showRandomWizard, setShowRandomWizard] = useState(false);
  const [showWormModeWizard, setShowWormModeWizard] = useState(false);

  // Mobi intro — shown before any game mode goes live
  const [showMobiIntro, setShowMobiIntro] = useState(false);
  const [mobiLines, setMobiLines] = useState([]);
  const [mobiModeName, setMobiModeName] = useState('');
  const pendingMobiAction = useRef(null);

  const launchWithMobi = useCallback((lines, modeName, postAction) => {
    setMobiLines(lines);
    setMobiModeName(modeName);
    pendingMobiAction.current = postAction;
    setShowMobiIntro(true);
  }, []);

  // Merge Mode theme picker
  const [showMergeThemePicker, setShowMergeThemePicker] = useState(false);

  // Parity Store — hides main menu and freezes canvas while open
  const [showStore, setShowStore] = useState(false);
  const handleOpenStore = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    setShowStore(true);
  }, []);

  // Mode select carousel — lifted to App level to prevent WebGL bleed-through
  const [showModeSelect, setShowModeSelect] = useState(false);

  // Coming Soon screen
  const [showComingSoon, setShowComingSoon] = useState(false);

  // Möbius Cubelet visualization
  const [showMobiusCubelet, setShowMobiusCubelet] = useState(false);

  // Disparity Mode — wizard, betting, countdown, solve sequence, bet resolution.
  const {
    showDisparityWizard, setShowDisparityWizard,
    showDisparityBetting, speedThresholdSec, disparityCountdown,
    handleDisparitySetupComplete, handleBetPlaced, handleBetSkipped,
    cancelDisparityRun, startDisparityGame,
  } = useDisparityGame({
    settings, setSettings, size, changeSize, reset,
    cancelShuffle, startAnimatedShuffle,
    setChaosLevel, setVisualMode, setFlipMode, setShowTunnels,
    launchWithMobi, mobiLines: MOBI_LINES_CHAOS,
  });

  // Demo mode — all state, handlers, and effects for the guided demo flow.
  const {
    demoMode, demoStep,
    demoColdOpenVisible, handleDemoColdOpenContinue,
    demoStepIntroVisible, demoTryVisible, demoForecastVisible, demoCoachCopy,
    handleDemoCoachCopySeen, demoHintStep,
    onTapFlipRef,
    handleStartDemo, handleDemoStepContinue, advanceDemoStep,
    handleDemoReplay, handleDemoFreeplay, handleExitDemo,
    handleDemoForecastPick, handleDemoChaosSkip, handleDemoDisparityDismiss,
    demoShowcaseSubStep, handleDemoShowcaseNext, handleDemoShowcaseSkip,
    demoViewSpotlight, handleDemoViewSpotlightClick,
    demoFlipSpotlight, handleDemoFlipSpotlightSkip,
    demoTourIndex, handleDemoNavTap, handleDemoTourSkip,
    demoCelebrationStep, dismissDemoCelebration, demoLaunchStep, demoRewardStamp, demoFlipProgress,
  } = useDemoMode({
    cancelShuffle, changeSize, setRotatedCubies, reset,
    cancelDisparityRun, startDisparityGame,
    startAnimatedShuffle, animatedShuffle,
    handleOpenStore, setShowFreeplayWizard,
    armSceneGate,
    closeNavSheet, navSheetOpen: sheetOpen,
  });

  const handleCloseStore = useCallback(() => {
    setShowStore(false);
    const store = useGameStore.getState();
    if (store.demoMode && store.demoStep === 'cosmetic-reward') {
      advanceDemoStep('cosmetic-reward');
      return;
    }
    store.setShowMainMenu(true);
  }, [advanceDemoStep]);

  // The demo's floating pills stand down while a full modal owns the screen.
  const demoChromeQuiet = showStore || showSettings || showHelp;

  // Home during the demo is a real exit, not just a screen change: without this
  // the demo's overlays kept rendering over the main menu and its borrowed look
  // (neon / desert / topographic) stayed on the device.
  const handleHomeFromGame = useCallback(() => {
    if (useGameStore.getState().demoMode) handleExitDemo();
    // Mega Mode forces reduced effects up front; returning home must release
    // that override even if PerformanceMonitor is already at its max factor and
    // therefore never emits a later onIncline callback.
    if (useGameStore.getState().wormHealerMode) clearMegaReducedFXOverride();
    handleBackToMainMenu();
  }, [handleExitDemo, handleBackToMainMenu, clearMegaReducedFXOverride]);

  // Warm lazy chunks, Mobi's portrait, and environment maps while the opening
  // animation plays, so nothing pops in late on slow connections. Delayed a
  // beat so it never competes with the critical boot path.
  useEffect(() => {
    const t = setTimeout(() => preloadAppAssets(), 1500);
    return () => clearTimeout(t);
  }, []);

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

  // ========================================================================
  // HANDLERS
  // ========================================================================
  const handleWelcomeComplete = useCallback(() => {
    setShowWelcome(false);
    markIntroSeen();
    // The cinematic owns the first paint. Once the player enters/skips, hold
    // the loading cube over the menu while this launch's randomly-selected
    // panorama decodes instead of masking the opening animation with a boot cover.
    armSceneGate(`Now entering ${menuBackground.label}`, { eager: true, holdMs: 1600, z: 10000 });
    // Show main menu after intro (not tutorial).
    useGameStore.getState().setShowMainMenu(true);
  }, [setShowWelcome, markIntroSeen, armSceneGate, menuBackground]);

  // Main menu action handlers
  const handleStartCampaign = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    setShowCubeModeSelect(false);
    // Open the campaign chooser. Story used to jump straight into chapter 1, so
    // the chapter map (completion, stars, the locked ladder) was reachable only
    // from the in-game More sheet, and two shipped packs had no entry at all.
    useGameStore.getState().setShowPackSelect(true);
  }, []);

  const handleSelectPack = useCallback((packId) => {
    const st = useGameStore.getState();
    st.setActivePackId(packId);
    st.setShowPackSelect(false);
    st.setShowLevelSelect(true);
  }, []);

  // The chapter map's back button returns to the chooser, not all the way out.
  const handleBackToPackSelect = useCallback(() => {
    const st = useGameStore.getState();
    st.setShowLevelSelect(false);
    st.setShowPackSelect(true);
  }, []);

  const handleMenuPlay = handleStartCampaign;
  const handleMenuCube = handleStartCampaign;

  const handleMenuFreeplay = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    setShowCubeModeSelect(false);
    setShowFreeplayWizard(true);
  }, []);

  const handleMenuRandomMode = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    setShowCubeModeSelect(false);
    setShowRandomWizard(true);
  }, []);

  const handleRandomWizardComplete = useCallback(({ backgroundTheme, cubeSize }) => {
    setShowRandomWizard(false);
    useGameStore.getState().setRandomMode(true);

    const newSettings = { ...settings, backgroundTheme };
    setSettings(newSettings);
    useGameStore.getState().clearLevel();

    const targetSize = cubeSize || size;
    if (targetSize !== size) {
      changeSize(targetSize);
    } else {
      useGameStore.getState().setRotatedCubies(makeCubies(targetSize));
      useGameStore.getState().resetGame();
    }
    launchWithMobi(MOBI_LINES_RANDOM, 'RANDOM MODE', () => { animatedShuffle(); });
  }, [settings, setSettings, size, changeSize, animatedShuffle, launchWithMobi]);

  const handleRandomWizardCancel = useCallback(() => {
    setShowRandomWizard(false);
    useGameStore.getState().setShowMainMenu(true);
  }, []);

  const handleWizardComplete = useCallback((wizardSettings) => {
    setShowFreeplayWizard(false);
    useGameStore.getState().setRandomMode(false);
    // Build manifoldStyles — explicit per-face overrides take precedence.
    // Treat 'random' as unset: a per-face entry of 'random' is not a real style key
    // and would reach the renderer as an unknown style (renders as solid).  This can
    // happen if a stale perFaceStyles object was seeded from a 'random' global style.
    const manifoldStyles = resolveWizardTileStyles(wizardSettings);

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
      changeSize(targetSize); // resets to solved; by the time postAction fires size is updated
    } else {
      useGameStore.getState().setRotatedCubies(makeCubies(targetSize));
      useGameStore.getState().resetGame();
    }
    // Cube is solved while MOBI intro plays; scramble fires when player taps through.
    launchWithMobi(MOBI_LINES_FREEPLAY, 'FREEPLAY', () => { animatedShuffle(); });
  }, [settings, setSettings, animatedShuffle, size, changeSize, launchWithMobi]);

  const handleWizardCancel = useCallback(() => {
    setShowFreeplayWizard(false);
    useGameStore.getState().setShowMainMenu(true);
  }, []);

  const handleMenuSettings = useCallback(() => {
    setShowSettings(true);
  }, [setShowSettings]);

  const handleMenuDisparity = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    setShowCubeModeSelect(false);
    setShowDisparityWizard(true);
  }, [setShowDisparityWizard]);

  const handleCubeModeBack = useCallback(() => {
    setShowCubeModeSelect(false);
    useGameStore.getState().setShowMainMenu(true);
  }, []);

  const handleMenuCoop = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    useGameStore.getState().clearLevel();
    shuffle();
    launchWithMobi(MOBI_LINES_COOP, 'CO-OP MODE', () => {
      setCoopMode(true);
    });
  }, [shuffle, launchWithMobi]);

  const handleMenuTeach = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    useGameStore.getState().clearLevel();
    if (size !== 3) changeSize(3);
    shuffle();
    launchWithMobi(MOBI_LINES_TEACH, 'TEACH MODE', () => {
      setTimeout(() => teachMode.enterTeachMode(), 0);
    });
  }, [size, changeSize, shuffle, teachMode, launchWithMobi]);

  const handleMenuWormHealer = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    setShowWormModeWizard(true);
  }, []);

  const handleWormSetupComplete = useCallback((wizardSettings) => {
    setShowWormModeWizard(false);

    // Apply visual settings immediately so the game scene shows the user's
    // chosen background and cube behind the Mobi intro overlay.
    const manifoldStyles = resolveWizardTileStyles(wizardSettings);

    const newSettings = {
      ...settings,
      colorScheme: wizardSettings.colorScheme,
      backgroundTheme: wizardSettings.backgroundTheme,
      manifoldStyles,
      biomeMode: { enabled: false, faceAssignment: null },
    };
    if (wizardSettings.customColors) newSettings.customColors = wizardSettings.customColors;
    setSettings(newSettings);

    // Switch to game scene (showMainMenu already false), reset cube so it's
    // visible and styled before the worm gameplay starts.
    // Mega Mode is the dedicated 15×15 Worm preset. Keep the explicit mode flag
    // authoritative so future wizard changes cannot accidentally launch it on
    // the last ordinary slider value.
    const targetSize = wizardSettings.megaMode ? 15 : (wizardSettings.cubeSize || 3);
    // Establish the Mega quality tier before mounting the new cube. Waiting for
    // Mobi completion means the entire intro pays for full-size effects, and New
    // Game can re-enter the wizard with size 15 still mounted.
    megaReducedFXOverrideRef.current = !!wizardSettings.megaMode;
    applyEffectiveDpr();
    useGameStore.getState().setPerfReducedFX(
      adaptiveReducedFXRef.current || megaReducedFXOverrideRef.current
    );
    if (targetSize !== size) {
      changeSize(targetSize);
    } else {
      reset();
    }

    // Keep the same orb density as a normal large Worm board. A 15×15 face has
    // roughly 4.6× the area of a 7×7 face, so using the unscaled wizard count
    // makes Mega Mode feel almost empty.
    const megaAreaScale = wizardSettings.megaMode ? (15 * 15) / (7 * 7) : 1;
    const wormParams = {
      wormSpeed: wizardSettings.wormSpeed ?? 2.0,
      wormOrbCount: Math.round((wizardSettings.wormOrbCount ?? 5) * megaAreaScale),
      wormholeInterval: wizardSettings.wormholeInterval ?? 10,
      wormColor: wizardSettings.wormColor ?? '#33ff66',
    };
    launchWithMobi(MOBI_LINES_WORM, 'WORM MODE', () => {
      vibrate([50, 30, 100]);
      cancelDisparityRun();
      useGameStore.getState().clearLevel();
      // A 15×15 shell contains 1,178 rendered cubelets. Start it in the lighter
      // effects tier immediately instead of waiting for the frame monitor to
      // notice the drop and react several seconds into play.
      // Mega owns this forced quality override. Clear it just as explicitly for
      // ordinary Worm runs so leaving a 15×15 session cannot strand the rest of
      // the app without shadows and volume effects.
      useGameStore.getState().setPerfReducedFX(!!wizardSettings.megaMode);
      useGameStore.getState().initWormMode(
        undefined, undefined,
        wormParams.wormSpeed,
        wormParams.wormOrbCount,
        wormParams.wormholeInterval,
        wormParams.wormColor
      );
    });
  }, [settings, setSettings, reset, size, changeSize, cancelDisparityRun, launchWithMobi, applyEffectiveDpr]);

  const handleMobiIntroComplete = useCallback(() => {
    setShowMobiIntro(false);
    const action = pendingMobiAction.current;
    pendingMobiAction.current = null;
    action?.();
    // Mode scene is now revealed — arm the gate so the cube covers any env-map /
    // texture decode still in flight (it self-dismisses if nothing is loading).
    armSceneGate(mobiModeName || 'Loading');
  }, [armSceneGate, mobiModeName]);

  const handleWormWizardCancel = useCallback(() => {
    clearMegaReducedFXOverride();
    setShowWormModeWizard(false);
    useGameStore.getState().setShowMainMenu(true);
  }, [clearMegaReducedFXOverride]);

  const handleWormRetry = useCallback(() => {
    useGameStore.getState().clearLevel();
    useGameStore.getState().initWormMode();
    reset();
  }, [reset]);

  const handleWormNewGame = useCallback(() => {
    clearMegaReducedFXOverride();
    useGameStore.getState().clearDisparityGame();
    useGameStore.getState().setShowMainMenu(false);
    setShowWormModeWizard(true);
  }, [clearMegaReducedFXOverride]);

  const handleMenuComingSoon = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    setShowComingSoon(true);
  }, []);

  const handleMenuMobiusCubelet = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    setShowMobiusCubelet(true);
  }, []);

  const handleMenuHolonomy = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    useGameStore.getState().clearLevel();
    useGameStore.getState().clearDisparityGame();
    useGameStore.getState().setHolonomyMode(true);
    setSettings({ ...settings, biomeMode: { enabled: false, faceAssignment: null } });
    if (size !== 3) changeSize(3);
    reset();
    launchWithMobi(MOBI_LINES_HOLONOMY, 'HOLONOMY', () => {});
  }, [settings, setSettings, size, changeSize, reset, launchWithMobi]);

  const handleMenuBiome = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    setSettings({
      ...settings,
      biomeMode: { enabled: true, faceAssignment: null },
      manifoldStyles: resolveBiomeManifoldStyles(null),
      colorScheme: 'biome',
    });
    useGameStore.getState().clearLevel();
    useGameStore.getState().resetGame();
    useGameStore.getState().setHasShuffled(true);
    launchWithMobi(MOBI_LINES_BIOME, 'BIOME MODE', () => {});
  }, [settings, setSettings, launchWithMobi]);

  const handleMenuMerge = useCallback(() => {
    useGameStore.getState().setShowMainMenu(false);
    setShowMergeThemePicker(true);
  }, []);

  const handleMergeStart = useCallback((themeId) => {
    setShowMergeThemePicker(false);
    useGameStore.getState().setMergeTheme(themeId);
    useGameStore.getState().clearLevel();
    useGameStore.getState().resetGame();
    useGameStore.getState().setHasShuffled(true);
    shuffle();
    launchWithMobi(MOBI_LINES_MERGE, 'MERGE MODE', () => {
      useGameStore.getState().setMergeMode(true);
    });
  }, [shuffle, launchWithMobi]);

  const handleMergeCancel = useCallback(() => {
    setShowMergeThemePicker(false);
    useGameStore.getState().setShowMainMenu(true);
  }, []);

  const closeTutorial = useCallback(() => {
    setShowTutorial(false);
    markTutorialDone();
  }, [setShowTutorial, markTutorialDone]);

  const onTapFlip = useCallback((pos, dirKey) => {
    flipSticker(pos, dirKey);
  }, [flipSticker]);
  onTapFlipRef.current = onTapFlip;

  const onFlipWaveComplete = useCallback(() => {
    setFlipWaveOrigins([]);
  }, [setFlipWaveOrigins]);

  const handleSelectTile = useCallback((pos, dirKey) => {
    const newCursor = cubePosToCursor(pos, dirKey);
    useGameStore.getState().setCursor(newCursor);
    setShowCursor(true);

    // Mobile explore flow: keep direct swipe-to-rotate behavior without
    // opening the directional rotation selector popup on tap.
    if (isMobile) return;

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


  // Level-specific shuffle
  const shuffleForLevel = useCallback(() => {
    // Cancel any animated shuffle still playing from a previous game session.
    cancelShuffle();
    const levelSize = currentLevelData?.cubeSize || size;
    // Staging rules live in levels/levelStaging.js — see the note there on why a
    // level that authors its own setup is never randomised on top.
    const state = buildLevelStartState(currentLevelData, levelSize, { levelNumber: currentLevel });
    setRotatedCubies(state);
    // Save the level's chaos setting before resetGame() wipes it.
    const savedChaosLevel = currentLevelData?.chaosLevel ?? 0;
    useGameStore.getState().resetGame();
    clearRefractory();
    if (savedChaosLevel > 0) useGameStore.getState().setChaosLevel(savedChaosLevel);
    useGameStore.getState().setHasShuffled(true);
  }, [cancelShuffle, currentLevelData, currentLevel, size, setRotatedCubies]);

  // Scramble a chapter that opened without a briefing. Keyed on the token alone
  // so a later shuffleForLevel identity change cannot re-scramble mid-play.
  useEffect(() => {
    if (briefingSkipToken === 0) return;
    shuffleForLevel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefingSkipToken]);

  // Tutorial close handler
  const handleTutorialClose = useCallback(() => {
    levelTutorialClose();
    shuffleForLevel();
  }, [levelTutorialClose, shuffleForLevel]);

  // Victory handlers
  const handleVictoryContinue = useCallback(() => {
    if (currentLevel) completeLevel(currentLevel, { moves, time: gameTime });
    setVictory(null);
  }, [currentLevel, moves, gameTime, setVictory]);

  const handleVictoryNewGame = useCallback(() => {
    if (currentLevel) completeLevel(currentLevel, { moves, time: gameTime });
    setVictory(null);
    if (currentLevelData) shuffleForLevel();
    else animatedShuffle();
  }, [currentLevel, currentLevelData, moves, gameTime, setVictory, shuffleForLevel, animatedShuffle]);

  const handleNextLevel = useCallback(() => {
    if (currentLevel) completeLevel(currentLevel, { moves, time: gameTime });
    levelHandleNextLevel();
    setVictory(null);
  }, [currentLevel, moves, gameTime, levelHandleNextLevel, setVictory]);

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
    const manifoldMap = getManifoldMap(state, size, useGameStore.getState().rotationEpoch);

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
    cancelDisparityRun();
    // reset() calls resetGame() which clears chaosLevel. Re-apply the level's
    // configured chaos so the mode stays active after a keyboard/button reset.
    const savedChaosLevel = currentLevelData?.chaosLevel ?? 0;
    if (savedChaosLevel > 0) useGameStore.getState().setChaosLevel(savedChaosLevel);
  }, [reset, cancelDisparityRun, currentLevelData]);

  // Surfaces that own the screen but live in App's local state rather than the
  // store, so selectCubeInputBlocked cannot see them. Co-op is here too: the
  // crawler reads WASD/arrows itself, and App early-returns into it below —
  // which unmounts nothing, since this hook has already attached its listener.
  const keyboardDisabled = coopMode
    || showStore || showModeSelect || showCubeModeSelect || showComingSoon
    || showMobiusCubelet || showMobiIntro || showMergeThemePicker
    || showFreeplayWizard || showRandomWizard || showWormModeWizard
    || showDisparityWizard || showDisparityBetting;

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
    disabled: keyboardDisabled,
  });


  // ========================================================================
  // RENDER
  // ========================================================================
  // Size 15 is installed before the Mobi overlay opens, so this distance also
  // has to frame Mega Mode during its intro rather than falling back to the 3×3
  // camera position. Mobile needs extra room for its narrower portrait viewport.
  const cameraZ = (isMobile
    ? { 2: 10, 3: 14, 4: 20, 5: 30, 6: 42, 7: 54, 15: 116 }
    : { 2: 8, 3: 11, 4: 16, 5: 24, 6: 34, 7: 44, 15: 94 }
  )[size] || 11;
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const introPerformanceMode = isMobile || prefersReducedMotion;


  if (coopMode) {
    return (
      <>
        <Suspense fallback={<LoadingScreen label="Waking the Co-op Crawler" />}>
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
        {/* The main-return gate never mounts on the co-op path (this early return),
            and the Mobi intro finished before coopMode flipped — so PlatformerWormMode's
            own city/sunset env maps would pop in uncovered. Cover them here. The probe
            runs long because those maps only begin loading after the lazy chunk mounts. */}
        <SceneLoadingGate armToken={sceneGateToken} label="Co-op Crawler" probeMs={6000} style={{ zIndex: 9996 }} />
      </>
    );
  }

  return (
    <div className={`full-screen${settings.backgroundTheme === 'dark' ? ' bg-dark' : settings.backgroundTheme === 'midnight' ? ' bg-midnight' : ''}${randomShaking ? ' random-shake' : ''}`}>
      {/* Mode-transition cover: sits above the game HUD / FX (≤9990) but below the
          Mobi dialogue (10500), so it fills the gap after Mobi while the scene's
          background decodes. Self-dismisses when nothing is loading. */}
      <SceneLoadingGate armToken={sceneGateToken} label={sceneGateLabel} eager={sceneGateEager} minVisibleMs={sceneGateHold} style={{ zIndex: sceneGateZ }} />
      <ScreenTransition show={showTutorial && !showWelcome}>
        <Tutorial onClose={closeTutorial} onMainMenu={() => { closeTutorial(); handleBackToMainMenu(); }} />
      </ScreenTransition>
      {showModeSelect && (
        <Suspense fallback={null}>
          <ModeCarousel
            onBack={() => setShowModeSelect(false)}
            onCubeSelect={() => { setShowModeSelect(false); handleStartCampaign(); }}
            onWormSelect={() => { setShowModeSelect(false); handleMenuWormHealer(); }}
            onChaos={() => { setShowModeSelect(false); handleMenuDisparity(); }}
            onFreeplay={() => { setShowModeSelect(false); handleMenuFreeplay(); }}
            onRandom={() => { setShowModeSelect(false); handleMenuRandomMode(); }}
            onStore={() => { setShowModeSelect(false); handleOpenStore(); }}
            onComingSoon={() => { setShowModeSelect(false); handleMenuComingSoon(); }}
            // "How to Play" opens the actual How to Play reference, not Teach
            // Mode — Teach is a solver trainer and gets its own pill below.
            onHowToPlay={() => { setShowModeSelect(false); useGameStore.getState().setShowHelp(true); }}
            onLearnToSolve={() => { setShowModeSelect(false); handleMenuTeach(); }}
          />
        </Suspense>
      )}

      {/* Single persistent Canvas — never unmounts, eliminates context loss on intro→game.
          Also renders the main-menu cube scene so there is never a second WebGL context.
          Stays VISIBLE while the mode selector is open: the carousel is a transparent
          overlay and the live menu cube (rotating to the active mode's face) is its
          centerpiece. The carousel deliberately avoids CSS transforms on positioned
          elements so the old mobile-Chrome compositor bleed-through cannot recur. */}
      <CanvasErrorBoundary>
      <div className="canvas-container" onContextMenu={(e) => e.preventDefault()}>
        <Canvas
          camera={{ position: (showWelcome || showMainMenu) ? [0, 3, 12] : [0, 0, cameraZ], fov: DEFAULT_CAMERA_FOV }}
          dpr={dpr}
          gl={{ powerPreference: 'high-performance', antialias: true }}
          shadows
          frameloop={pageHidden ? 'never' : 'always'}
        >
          <PerformanceMonitor
            onDecline={handlePerformanceDecline}
            onIncline={handlePerformanceIncline}
          />
          <ClockContinuity paused={pageHidden} />
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
            // Stop the cube/worm animation when a full-screen overlay covers the menu
            showSettings ? <color attach="background" args={['#000005']} /> : (
              <MenuScene onCubeClick={handleMenuCube} background={menuBackground} />
            )
          ) : (
            <Suspense fallback={null}>
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
                teachModeActive={teachMode.active}
                layerHighlight={teachMode.layerHighlight}
                onHeal={healSticker}
                onRotate={startAnimation}
                onAnimatedShuffle={startAnimatedShuffle}
                showAntipodalPiP={showAntipodalPiP}
              />
            </Suspense>
          )}
        </Canvas>
      </div>
      </CanvasErrorBoundary>

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
            fontFamily: UI_FONT,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: 'rgba(0, 217, 255, 0.85)',
            textTransform: 'uppercase',
            pointerEvents: 'none',
          }}>
            {/* Says what the window shows, not what the maths calls it — this
                frame is most players' first meeting with the mechanic. */}
            ↕ Far Side
          </span>
        </div>
      )}

      {/* Welcome DOM overlay — transparent background, Canvas shows through */}
      {showWelcome && (
        <WelcomeScreen onEnter={handleWelcomeComplete} introTime={introTime} />
      )}

      {!showWelcome && (
        <Suspense fallback={null}>
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
            hasNextLevel={hasNextLevel}
            teachMode={teachMode}
            performCursorRotation={performCursorRotation}
            ui={{
              sheetOpen, setSheetOpen, sheetMode, setSheetMode,
              showFreeplayWizard, showRandomWizard, showWormModeWizard, showCubeModeSelect,
              showModeSelect,
              showMobiIntro, mobiLines, mobiModeName,
              showDisparityWizard, setShowDisparityWizard,
              showDisparityBetting,
              disparityCountdown,
              showAntipodalPiP, onToggleAntipodalPiP: toggleAntipodalPiP,
              showComingSoon, onCloseComingSoon: () => { setShowComingSoon(false); useGameStore.getState().setShowMainMenu(true); },
              showMobiusCubelet, onCloseMobiusCubelet: () => { setShowMobiusCubelet(false); useGameStore.getState().setShowMainMenu(true); },
              onOpenModeSelect: () => setShowModeSelect(true),
              // True only while a Mobi dialogue PANEL is presenting — the cold
              // open, the step intro, or the coach's mid-step aside. Those are
              // bottom-docked panels, so the HUD (bottom nav bar + undo button)
              // hides underneath them.
              //
              // The coach's ordinary "Next ▶" pill deliberately does NOT count:
              // it lives at the top of the screen, and the hands-on phase is
              // exactly when the player needs Reset, Flip and Views under their
              // thumb — hiding the nav there used to make the demo's own
              // mechanics unreachable while it was asking the player to try them.
              demoDialogueVisible: demoMode && (
                demoColdOpenVisible || demoStepIntroVisible || (demoTryVisible && !!demoCoachCopy)
              ),
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
              onBackToMainMenu: handleHomeFromGame,
              onLevelSelect: handleLevelSelect,
              onSelectPack: handleSelectPack,
              onBackToPackSelect: handleBackToPackSelect,
              onCutsceneComplete: handleCutsceneComplete,
              onTutorialClose: handleTutorialClose,
              onLevelTutorialClose: levelTutorialClose,
              onNextLevel: handleNextLevel,
              onPreset: handlePreset,
              onInstantChaos: handleInstantChaos,
              onSaveState: handleSaveState,
              onLoadState: handleLoadState,
              onMenuPlay: handleMenuPlay,
              onMenuLevels: handleMenuCube,
              onMenuFreeplay: handleMenuFreeplay,
              onMenuRandomMode: handleMenuRandomMode,
              onMenuCoop: handleMenuCoop,
              onMenuTeach: handleMenuTeach,
              onMenuSettings: handleMenuSettings,
              onMenuBiome: handleMenuBiome,
              onMenuDisparity: handleMenuDisparity,
              onMenuWormHealer: handleMenuWormHealer,
              onMenuHolonomy: handleMenuHolonomy,
              onMenuMerge: handleMenuMerge,
              onMenuStore: handleOpenStore,
              onMenuComingSoon: handleMenuComingSoon,
              onMenuMobiusCubelet: handleMenuMobiusCubelet,
              onDemo: handleStartDemo,
              onDemoDisparityDismiss: handleDemoDisparityDismiss,
              demoViewSpotlight,
              onDemoViewSpotlightClick: handleDemoViewSpotlightClick,
              // Which nav tile the demo is pointing at right now: the control
              // tour walks all five, the twin step lights Flip on its own.
              demoSpotlightTile: demoTourIndex >= 0
                ? CONTROL_TOUR_SEQUENCE[demoTourIndex]?.key
                : (demoFlipSpotlight ? 'flip' : (demoViewSpotlight ? 'views' : null)),
              onDemoNavTap: demoMode ? handleDemoNavTap : undefined,
              showMergeThemePicker,
              onMergeStart: handleMergeStart,
              onMergeCancel: handleMergeCancel,
              onWizardComplete: handleWizardComplete,
              onWizardCancel: handleWizardCancel,
              onRandomWizardComplete: handleRandomWizardComplete,
              onRandomWizardCancel: handleRandomWizardCancel,
              onCubeModeRubiks: handleMenuFreeplay,
              onCubeModeDisparity: handleMenuDisparity,
              onCubeModeBack: handleCubeModeBack,
              onDisparitySetupComplete: handleDisparitySetupComplete,
              onBetPlaced: handleBetPlaced,
              onBetSkipped: handleBetSkipped,
              speedThresholdSec,
              onWormSetupComplete: handleWormSetupComplete,
              onMobiIntroComplete: handleMobiIntroComplete,
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
        </Suspense>
      )}

      {/* Demo mode overlays.
          `demoChromeQuiet` is the one gate every floating demo pill respects: a
          full modal (Settings, Help, Store) owns the screen while it is open,
          and the demo opens Settings itself during the "Make It Yours" step. */}
      {demoMode && !demoColdOpenVisible && !demoChromeQuiet && <DemoProgressBar currentStep={demoStep} />}
      {demoMode && demoCelebrationStep && <DemoStepComplete step={demoCelebrationStep} onDismiss={dismissDemoCelebration} />}
      {demoMode && demoLaunchStep && !demoCelebrationStep && <DemoStepLaunch step={demoLaunchStep} />}
      {demoMode && demoRewardStamp && <DemoRewardStamp amount={demoRewardStamp.amount} correct={demoRewardStamp.correct} />}
      {/* Cold open: Mobi frames the twin concept before the first step. */}
      <ScreenTransition show={!!(demoMode && demoColdOpenVisible)} freezeOnExit>
        <MobiIntroScreen
          lines={MOBI_LINES_DEMO_INTRO}
          modeName="Demo"
          primaryLabel="▶ Let's Go"
          skipLabel="Skip Intro"
          onComplete={handleDemoColdOpenContinue}
          onSkip={handleDemoColdOpenContinue}
          topInset="var(--topbar-h)"
        />
      </ScreenTransition>
      <ScreenTransition show={!!(demoMode && demoStepIntroVisible && demoStep && demoStep !== 'end')} freezeOnExit>
        <DemoStepIntro step={demoStep} onContinue={handleDemoStepContinue} onSkip={() => advanceDemoStep(demoStep)} />
      </ScreenTransition>
      <ScreenTransition show={!!(demoMode && demoTryVisible && !demoStepIntroVisible && !demoChromeQuiet)} freezeOnExit>
        <DemoCoach
          step={demoStep}
          copy={demoCoachCopy}
          onCopySeen={handleDemoCoachCopySeen}
          onNext={demoStep === 'chaos-forecast' ? handleDemoChaosSkip : () => advanceDemoStep(demoStep)}
          onExit={handleExitDemo}
        />
      </ScreenTransition>
      {demoMode && demoForecastVisible && (
        <Suspense fallback={null}>
          <DemoForecastPicker onPick={handleDemoForecastPick} onSkip={handleDemoChaosSkip} />
        </Suspense>
      )}
      {/* Per-step gesture hint — stays up for the whole hands-on phase so the
          instruction is still there after the intro panel has gone. */}
      {demoMode && demoHintStep && demoHintStep === demoStep && !demoChromeQuiet && !demoColdOpenVisible &&
        !demoStepIntroVisible && !demoLaunchStep && !demoCelebrationStep && !demoViewSpotlight && !demoFlipSpotlight && (
        <DemoStepHint step={demoHintStep} />
      )}
      {/* Worm-step steer hint — shows during active play, before the skip pill. */}
      {demoMode && demoStep === 'worm-traversal' && !demoColdOpenVisible && !demoChromeQuiet &&
        !demoStepIntroVisible && !demoLaunchStep && !demoTryVisible && !demoCelebrationStep && (
        <DemoWormControlHint />
      )}
      {/* Flip-gateway progress — bounded front-face flip/restore counter. */}
      {demoMode && demoStep === 'flip-gateway' && demoFlipProgress && !demoColdOpenVisible && !demoChromeQuiet &&
        !demoStepIntroVisible && !demoLaunchStep && !demoCelebrationStep && (
        <DemoFlipProgress progress={demoFlipProgress} />
      )}
      <ScreenTransition show={!!(demoMode && demoStep === 'view-showcase' && demoViewSpotlight && !demoStepIntroVisible && !demoChromeQuiet)} freezeOnExit>
        <DemoViewSpotlightHint onSkip={handleDemoShowcaseSkip} />
      </ScreenTransition>
      {/* Control tour: one card per bottom-bar button, waiting on that press. */}
      <ScreenTransition show={!!(demoMode && demoTourIndex >= 0 && !demoStepIntroVisible && !demoChromeQuiet && !demoCelebrationStep)} freezeOnExit>
        <DemoControlTour index={demoTourIndex} onSkip={handleDemoTourSkip} />
      </ScreenTransition>
      {/* Twin step: asks for the Flip button press that arms tile-flipping. */}
      <ScreenTransition show={!!(demoMode && demoFlipSpotlight && !demoStepIntroVisible && !demoChromeQuiet)} freezeOnExit>
        <DemoFlipSpotlightHint onSkip={handleDemoFlipSpotlightSkip} />
      </ScreenTransition>
      <ScreenTransition show={!!(demoMode && demoStep === 'view-showcase' && demoShowcaseSubStep >= 0 && !demoStepIntroVisible)} freezeOnExit>
        <DemoViewShowcase
          subStep={demoShowcaseSubStep}
          onNext={handleDemoShowcaseNext}
          onSkip={handleDemoShowcaseSkip}
        />
      </ScreenTransition>
      {demoMode && demoStep === 'end' && (
        <Suspense fallback={null}>
          <DemoEndScreen
            onWorm={() => { handleExitDemo(); handleMenuWormHealer(); }}
            onStory={() => { handleExitDemo(); handleStartCampaign(); }}
            onFreeplay={handleDemoFreeplay}
            onChaos={() => { handleExitDemo(); handleMenuDisparity(); }}
            onRandom={() => { handleExitDemo(); handleMenuRandomMode(); }}
            onStore={() => { handleExitDemo(); handleOpenStore(); }}
            onReplay={handleDemoReplay}
            onExit={handleExitDemo}
          />
        </Suspense>
      )}

      {/* Parity Store — mounted at app root so it's above every overlay. The
          z-index lives on the fading wrapper: its will-change traps the store's
          own z-index inside a stacking context, which left the top app bar
          (.ui-layer, z-index 100) covering the store's masthead. */}
      <ScreenTransition show={showStore} style={{ position: 'relative', zIndex: 100000 }}>
        <Suspense fallback={null}>
          <ParityStoreScreen onClose={handleCloseStore} />
        </Suspense>
      </ScreenTransition>
    </div>
  );
}
