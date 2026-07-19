import { useState, useRef, useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from './useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { flipStickerPair, buildManifoldGridMap } from '../game/manifoldLogic.js';
import { checkRubiksSolved } from '../game/winDetection.js';
import { clearRefractory } from '../game/refractoryMap.js';
import { DEFAULT_SETTINGS } from '../utils/colorSchemes.js';
import { DEMO_STEP_IDS, DEMO_LEVEL_CONFIGS, VIEW_SHOWCASE_SEQUENCE } from '../components/screens/DemoFlowController.jsx';

// The demo temporarily overwrites the player's persisted settings (pastel,
// desert, topographic tiles). This key holds the pre-demo snapshot so an
// unclean exit (refresh / tab close mid-demo) can be healed on next launch —
// otherwise the shader-heavy demo look sticks to the device forever.
const PRE_DEMO_SETTINGS_KEY = 'worm3_predemo_settings';

const allSurfaceStickersWrongParity = (cubies, size) => {
  for (let x = 0; x < size; x++)
    for (let y = 0; y < size; y++)
      for (let z = 0; z < size; z++) {
        if (x > 0 && x < size - 1 && y > 0 && y < size - 1 && z > 0 && z < size - 1) continue;
        for (const st of Object.values(cubies[x][y][z].stickers)) {
          if (st.curr === st.orig) return false;
        }
      }
  return true;
};

export function useDemoMode({
  cancelShuffle,
  changeSize,
  setRotatedCubies,
  reset,
  cancelDisparityRun,
  startDisparityGame,
  startAnimatedShuffle,
  animatedShuffle,
  handleOpenStore,
  setShowFreeplayWizard,
}) {
  const { demoMode, demoStep } = useGameStore(useShallow((s) => ({
    demoMode: s.demoMode,
    demoStep: s.demoStep,
  })));

  const cubies = useGameStore((s) => s.cubies);
  const size = useGameStore((s) => s.size);
  const victory = useGameStore((s) => s.victory);

  const [demoStepIntroVisible, setDemoStepIntroVisible] = useState(false);
  const [demoForecastVisible, setDemoForecastVisible] = useState(false);
  const [demoTryVisible, setDemoTryVisible] = useState(false);
  const [demoCoachCopy, setDemoCoachCopy] = useState(null);
  const [demoShowcaseSubStep, setDemoShowcaseSubStep] = useState(-1);
  const [demoViewSpotlight, setDemoViewSpotlight] = useState(false);
  const [demoCelebrationStep, setDemoCelebrationStep] = useState(null);
  const [demoLaunchStep, setDemoLaunchStep] = useState(null);

  const demoForecastPickRef = useRef(null);
  const preDemoSettingsRef = useRef(null);
  const demoWatchTimers = useRef([]);
  const onTapFlipRef = useRef(null);
  const advanceDemoStepRef = useRef(null);
  const demoFlipPhaseRef = useRef(null);
  const celebrationTimerRef = useRef(null);
  const babySolveArmedRef = useRef(false);
  const preDemoWormCharacterRef = useRef(null);
  const preDemoWormSkinRef = useRef(null);

  const clearDemoWatchTimers = useCallback(() => {
    demoWatchTimers.current.forEach(clearTimeout);
    demoWatchTimers.current = [];
  }, []);

  const clearCelebrationTimer = useCallback(() => {
    if (celebrationTimerRef.current) {
      clearTimeout(celebrationTimerRef.current);
      celebrationTimerRef.current = null;
    }
  }, []);

  // Fire the STEP COMPLETE burst, then auto-advance once it has played out.
  const celebrateStep = useCallback((step) => {
    if (useGameStore.getState().demoStep !== step) return;
    if (celebrationTimerRef.current) return;
    clearDemoWatchTimers();
    setDemoTryVisible(false);
    setDemoCoachCopy(null);
    setDemoCelebrationStep(step);
    celebrationTimerRef.current = setTimeout(() => {
      celebrationTimerRef.current = null;
      setDemoCelebrationStep(null);
      advanceDemoStepRef.current?.(step);
    }, 1600);
  }, [clearDemoWatchTimers]);

  const restoreWormCharacter = useCallback(() => {
    if (preDemoWormCharacterRef.current != null) {
      useGameStore.getState().setWormCharacter(preDemoWormCharacterRef.current);
      preDemoWormCharacterRef.current = null;
    }
    if (preDemoWormSkinRef.current != null) {
      useGameStore.getState().setWormSkin(preDemoWormSkinRef.current);
      preDemoWormSkinRef.current = null;
    }
  }, []);

  const applyDemoSettings = useCallback(() => {
    const store = useGameStore.getState();
    const demoManifoldStyles = {};
    for (let i = 1; i <= 6; i++) demoManifoldStyles[i] = 'topographic';
    store.setSettings({
      ...store.settings,
      colorScheme: 'neon',
      customColors: null,
      backgroundTheme: 'desert',
      manifoldStyles: demoManifoldStyles,
    });
  }, []);

  const applyDemoStepConfig = useCallback((stepId) => {
    const config = DEMO_LEVEL_CONFIGS[stepId];
    if (!config) return;
    cancelShuffle();
    const store = useGameStore.getState();
    store.clearLevel();
    store.setRandomMode(false);
    applyDemoSettings();

    if (config.type === 'worm') {
      const targetSize = config.cubeSize || 3;
      if (targetSize !== store.size) changeSize(targetSize);
      else reset();
      // The worm demo swaps in a Shanghai skybox, layered on top of the
      // background applyDemoSettings() applied above. Read the settings fresh
      // (the `store` snapshot predates that call) so we extend the demo
      // settings rather than clobber them. Tiles keep the demo-wide topographic
      // style. Every other step re-runs applyDemoSettings() on entry, so this
      // override never leaks past the worm step.
      if (config.backgroundTheme) {
        const fresh = useGameStore.getState();
        fresh.setSettings({ ...fresh.settings, backgroundTheme: config.backgroundTheme });
      }
      // Showcase a specific worm character + skin; the player's own picks
      // (persisted to localStorage) are restored when the step ends or the
      // demo exits.
      if (config.wormCharacter) {
        if (preDemoWormCharacterRef.current == null) preDemoWormCharacterRef.current = store.wormCharacter;
        store.setWormCharacter(config.wormCharacter);
      }
      if (config.wormSkin) {
        if (preDemoWormSkinRef.current == null) preDemoWormSkinRef.current = store.wormSkin;
        store.setWormSkin(config.wormSkin);
      }
      store.setFlipMode(true);
      store.setShowTunnels(true);
      store.setVisualMode('classic');
      cancelDisparityRun();
      store.initWormMode(
        undefined, undefined,
        config.wormSpeed, config.wormOrbCount,
        config.wormholeInterval, config.wormColor,
      );
      return;
    }

    if (config.type === 'chaos') {
      store.clearDisparityGame();
      cancelDisparityRun();
      setDemoForecastVisible(true);
      return;
    }

    if (config.type === 'random') {
      const targetSize = config.cubeSize || 3;
      if (targetSize !== store.size) changeSize(targetSize);
      else {
        store.setRotatedCubies(makeCubies(targetSize));
        store.resetGame();
      }
      store.setFlipMode(false);
      store.setShowTunnels(false);
      store.setRandomMode(true);
      animatedShuffle();
      return;
    }

    if (config.type === 'showcase') {
      const targetSize = config.cubeSize || 3;
      if (targetSize !== store.size) changeSize(targetSize);
      else {
        store.setRotatedCubies(makeCubies(targetSize));
        store.resetGame();
      }
      store.setFlipMode(false);
      store.setShowTunnels(false);
      store.setVisualMode('classic');
      store.setExploded(false);
      store.setHollowMode(false);
      store.setShowNetPanel(false);
      store.setHasShuffled(true);
      // Spotlight the Views button first — the user's tap starts the sequence.
      setDemoShowcaseSubStep(-1);
      setDemoViewSpotlight(true);
      return;
    }

    if (config.cubeSize !== store.size) {
      changeSize(config.cubeSize);
    }
    store.setFlipMode(config.features.flips);
    store.setShowTunnels(config.features.tunnels);
    store.setVisualMode('classic');
    store.setChaosLevel(config.chaosLevel);

    let state = makeCubies(config.cubeSize);
    if (config.scrambleSequence) {
      for (const { axis, sliceIndex, dir } of config.scrambleSequence) {
        state = rotateSliceCubies(state, config.cubeSize, axis, sliceIndex, dir);
      }
    }
    if (config.flipSequence) {
      const flipMap = buildManifoldGridMap(state, config.cubeSize);
      for (const { x, y, z, dirKey } of config.flipSequence) {
        state = flipStickerPair(state, config.cubeSize, x, y, z, dirKey, flipMap);
      }
    }
    setRotatedCubies(state);
    store.resetGame();
    clearRefractory();
    store.setHasShuffled(true);
  }, [cancelShuffle, changeSize, setRotatedCubies, reset, cancelDisparityRun, applyDemoSettings, animatedShuffle]);

  const handleStartDemo = useCallback(() => {
    clearDemoWatchTimers();
    setDemoTryVisible(false);
    const store = useGameStore.getState();
    preDemoSettingsRef.current = { ...store.settings };
    try { localStorage.setItem(PRE_DEMO_SETTINGS_KEY, JSON.stringify(store.settings)); } catch { /* private mode */ }
    store.startDemo();
    applyDemoSettings();
    // Pre-stage the first step's cube so Mobi's intro blurs the right scene
    // (otherwise the menu's 3×3 lingers behind the dialogue until Start).
    applyDemoStepConfig('baby-cube');
    setDemoStepIntroVisible(true);
  }, [clearDemoWatchTimers, applyDemoSettings, applyDemoStepConfig]);

  const advanceDemoStep = useCallback((fromStep) => {
    const store = useGameStore.getState();
    if (store.demoStep !== fromStep) return;
    clearDemoWatchTimers();
    setDemoTryVisible(false);
    setDemoForecastVisible(false);
    setDemoLaunchStep(null);
    if (store.randomMode) {
      store.setRandomMode(false);
      applyDemoSettings();
    }
    if (store.wormHealerMode) {
      store.clearDisparityGame();
      cancelDisparityRun();
    }
    if (fromStep === 'worm-traversal') restoreWormCharacter();
    if (fromStep === 'view-showcase') {
      store.setVisualMode('classic');
      store.setExploded(false);
      store.setHollowMode(false);
      store.setShowNetPanel(false);
      setDemoShowcaseSubStep(-1);
      setDemoViewSpotlight(false);
    }
    const idx = DEMO_STEP_IDS.indexOf(fromStep);
    const nextStep = DEMO_STEP_IDS[idx + 1] || 'end';
    store.setDemoStep(nextStep);
    // Pre-stage plain cube steps so the intro dialogue blurs the upcoming
    // scene. Other types (worm/chaos/showcase/random) start on Continue —
    // pre-staging them would kick off gameplay or overlays behind the blur.
    if (DEMO_LEVEL_CONFIGS[nextStep]?.type === 'cube') applyDemoStepConfig(nextStep);
    if (nextStep !== 'end') setDemoStepIntroVisible(true);
  }, [clearDemoWatchTimers, applyDemoSettings, cancelDisparityRun, restoreWormCharacter, applyDemoStepConfig]);
  advanceDemoStepRef.current = advanceDemoStep;

  const handleDemoStepContinue = useCallback(() => {
    setDemoStepIntroVisible(false);
    setDemoTryVisible(false);
    clearDemoWatchTimers();
    const step = useGameStore.getState().demoStep;

    if (step === 'cosmetic-reward') {
      handleOpenStore();
      return;
    }

    applyDemoStepConfig(step);

    demoFlipPhaseRef.current = step === 'flip-gateway' ? 'flip-all' : null;
    babySolveArmedRef.current = false;
    setDemoCoachCopy(null);

    const config = DEMO_LEVEL_CONFIGS[step];

    // Launch punch: title stamp + flash over the freshly staged scene, with a
    // camera orbit kick on the cube-centric steps.
    setDemoLaunchStep(step);
    demoWatchTimers.current.push(setTimeout(() => setDemoLaunchStep(null), 2750));
    if (config && config.type !== 'worm' && config.type !== 'chaos') {
      useGameStore.getState().triggerCameraOrbit?.('cw');
    }
    if (config && config.type === 'cube') {
      const watch = config.watch;
      if (watch?.type === 'rotate') {
        demoWatchTimers.current.push(setTimeout(() => {
          startAnimatedShuffle(watch.moves, () => {});
        }, 700));
      } else if (watch?.type === 'flip') {
        demoWatchTimers.current.push(setTimeout(() => {
          const t = watch.tile;
          onTapFlipRef.current?.({ x: t.x, y: t.y, z: t.z }, t.dirKey);
        }, 1000));
      }
      const coachDelay = watch ? 2800 : 800;
      demoWatchTimers.current.push(setTimeout(() => setDemoTryVisible(true), coachDelay));
    }

    if (config && config.type === 'worm') {
      demoWatchTimers.current.push(setTimeout(() => setDemoTryVisible(true), 10000));
    }

    if (config && config.type === 'chaos') {
      demoWatchTimers.current.push(setTimeout(() => setDemoTryVisible(true), 5000));
    }

    if (config && config.type === 'random') {
      demoWatchTimers.current.push(setTimeout(() => setDemoTryVisible(true), 12000));
    }
  }, [applyDemoStepConfig, handleOpenStore, clearDemoWatchTimers, startAnimatedShuffle]);

  const cleanupAllDemoState = useCallback((store) => {
    clearDemoWatchTimers();
    clearCelebrationTimer();
    restoreWormCharacter();
    setDemoCelebrationStep(null);
    setDemoLaunchStep(null);
    setDemoTryVisible(false);
    setDemoStepIntroVisible(false);
    setDemoForecastVisible(false);
    setDemoCoachCopy(null);
    setDemoShowcaseSubStep(-1);
    setDemoViewSpotlight(false);
    demoFlipPhaseRef.current = null;
    store.setRandomMode(false);
    store.setVisualMode('classic');
    store.setExploded(false);
    store.setHollowMode(false);
    store.setShowNetPanel(false);
    store.setFlipMode(false);
    store.setShowTunnels(false);
    store.setShowDisparityWinner(false);
    if (store.wormHealerMode) {
      store.clearDisparityGame();
      cancelDisparityRun();
    }
    if (store.disparityRunning) {
      store.clearDisparityGame();
      cancelDisparityRun();
    }
  }, [clearDemoWatchTimers, clearCelebrationTimer, cancelDisparityRun, restoreWormCharacter]);

  const handleDemoReplay = useCallback(() => {
    const store = useGameStore.getState();
    cleanupAllDemoState(store);
    store.startDemo();
    applyDemoSettings();
    applyDemoStepConfig('baby-cube');
    setDemoStepIntroVisible(true);
  }, [cleanupAllDemoState, applyDemoSettings, applyDemoStepConfig]);

  const handleDemoFreeplay = useCallback(() => {
    const store = useGameStore.getState();
    cleanupAllDemoState(store);
    if (preDemoSettingsRef.current) {
      store.setSettings(preDemoSettingsRef.current);
      preDemoSettingsRef.current = null;
    }
    try { localStorage.removeItem(PRE_DEMO_SETTINGS_KEY); } catch { /* private mode */ }
    store.exitDemo();
    store.setShowMainMenu(false);
    setShowFreeplayWizard(true);
  }, [cleanupAllDemoState, setShowFreeplayWizard]);

  const handleExitDemo = useCallback(() => {
    const store = useGameStore.getState();
    cleanupAllDemoState(store);
    if (preDemoSettingsRef.current) {
      store.setSettings(preDemoSettingsRef.current);
      preDemoSettingsRef.current = null;
    }
    try { localStorage.removeItem(PRE_DEMO_SETTINGS_KEY); } catch { /* private mode */ }
    store.exitDemo();
  }, [cleanupAllDemoState]);

  // Heal an unclean demo exit from a previous session: if the pre-demo
  // snapshot is still on disk at launch, the demo's temporary settings were
  // persisted without ever being restored — put the player's settings back.
  useEffect(() => {
    if (useGameStore.getState().demoMode) return;
    try {
      const raw = localStorage.getItem(PRE_DEMO_SETTINGS_KEY);
      if (raw) {
        useGameStore.getState().setSettings(JSON.parse(raw));
        localStorage.removeItem(PRE_DEMO_SETTINGS_KEY);
        return;
      }
      // Devices tainted before the snapshot existed: if the persisted settings
      // are exactly the demo signature, the demo left them behind — reset the
      // demo-controlled fields to their defaults.
      const s = useGameStore.getState().settings;
      const allTopographic = s.manifoldStyles && [1, 2, 3, 4, 5, 6].every((i) => s.manifoldStyles[i] === 'topographic');
      if (s.colorScheme === 'pastel' && s.backgroundTheme === 'desert' && !s.customColors && allTopographic) {
        useGameStore.getState().setSettings({
          ...s,
          colorScheme: DEFAULT_SETTINGS.colorScheme,
          backgroundTheme: DEFAULT_SETTINGS.backgroundTheme,
          manifoldStyles: { ...DEFAULT_SETTINGS.manifoldStyles },
        });
      }
    } catch { /* corrupt snapshot — leave current settings */ }
  }, []);

  const handleDemoForecastPick = useCallback((pair) => {
    setDemoForecastVisible(false);
    demoForecastPickRef.current = pair;
    const config = DEMO_LEVEL_CONFIGS['chaos-forecast'];
    const wizardSettings = {
      cubeSize: config.cubeSize,
      disparityLevel: config.disparityLevel,
      flipCap: config.flipCap,
      gameLength: config.gameLength,
      flipMode: true,
      showTunnels: true,
      colorScheme: 'neon',
      visualMode: 'classic',
      tileStyle: 'topographic',
    };
    useGameStore.getState().setRotatedCubies(makeCubies(useGameStore.getState().size));
    useGameStore.getState().resetGame();
    startDisparityGame(wizardSettings);
  }, [startDisparityGame]);

  // The spotlighted Views button was tapped — start the view sequence.
  const handleDemoViewSpotlightClick = useCallback(() => {
    if (!demoViewSpotlight) return;
    setDemoViewSpotlight(false);
    const store = useGameStore.getState();
    setDemoShowcaseSubStep(0);
    VIEW_SHOWCASE_SEQUENCE[0]?.apply(store);
  }, [demoViewSpotlight]);

  const handleDemoShowcaseNext = useCallback(() => {
    const store = useGameStore.getState();
    const cur = demoShowcaseSubStep;
    VIEW_SHOWCASE_SEQUENCE[cur]?.cleanup(store);
    const next = cur + 1;
    if (next < VIEW_SHOWCASE_SEQUENCE.length) {
      setDemoShowcaseSubStep(next);
      VIEW_SHOWCASE_SEQUENCE[next].apply(store);
    } else {
      store.setVisualMode('classic');
      store.setExploded(false);
      store.setHollowMode(false);
      store.setShowNetPanel(false);
      setDemoShowcaseSubStep(-1);
      advanceDemoStep('view-showcase');
    }
  }, [demoShowcaseSubStep, advanceDemoStep]);

  const handleDemoShowcaseSkip = useCallback(() => {
    const store = useGameStore.getState();
    setDemoViewSpotlight(false);
    VIEW_SHOWCASE_SEQUENCE[demoShowcaseSubStep]?.cleanup(store);
    store.setVisualMode('classic');
    store.setExploded(false);
    store.setHollowMode(false);
    store.setShowNetPanel(false);
    setDemoShowcaseSubStep(-1);
    advanceDemoStep('view-showcase');
  }, [demoShowcaseSubStep, advanceDemoStep]);

  const handleDemoChaosSkip = useCallback(() => {
    setDemoForecastVisible(false);
    demoForecastPickRef.current = null;
    const store = useGameStore.getState();
    store.setShowDisparityWinner(false);
    store.clearDisparityGame();
    store.setChaosLevel(0);
    cancelDisparityRun();
    store.earnCoins(50);
    advanceDemoStepRef.current?.('chaos-forecast');
  }, [cancelDisparityRun]);

  const handleDemoDisparityDismiss = useCallback(() => {
    if (!demoMode || demoStep !== 'chaos-forecast') return;
    const store = useGameStore.getState();
    const pick = demoForecastPickRef.current;
    const winner = store.disparityWinner;
    const winnerFaceIds = winner?.pair?.map((gid) => {
      const m = gid.match(/^M(\d+)-/);
      return m ? parseInt(m[1], 10) : 0;
    }) || [];
    const correct = pick && pick.faceIds.some((f) => winnerFaceIds.includes(f));
    const reward = correct ? 200 : 50;
    store.earnCoins(reward);
    store.clearDisparityGame();
    store.setChaosLevel(0);
    demoForecastPickRef.current = null;
    advanceDemoStep('chaos-forecast');
  }, [demoMode, demoStep, advanceDemoStep]);

  // ── Effects ──────────────────────────────────────────────────────────────

  // Suppress victory screen during demo — advancement is explicit.
  useEffect(() => {
    if (!demoMode || !victory) return;
    useGameStore.getState().setVictory(null);
  }, [demoMode, victory]);

  // Suppress the first-flip tutorial during demo — the demo narrates flips
  // itself, and this full-screen overlay lingers beneath the demo shell.
  const showFirstFlipTutorial = useGameStore((s) => s.showFirstFlipTutorial);
  useEffect(() => {
    if (!demoMode || !showFirstFlipTutorial) return;
    useGameStore.getState().setShowFirstFlipTutorial(false);
  }, [demoMode, showFirstFlipTutorial]);

  // Baby-cube solve detection: arm once the watch scramble breaks the solve,
  // then celebrate the moment the user restores it.
  useEffect(() => {
    if (!demoMode || demoStep !== 'baby-cube') return;
    if (!checkRubiksSolved(cubies, size)) {
      babySolveArmedRef.current = true;
      return;
    }
    if (babySolveArmedRef.current) {
      babySolveArmedRef.current = false;
      celebrateStep('baby-cube');
    }
  }, [demoMode, demoStep, cubies, size, celebrateStep]);

  // Flip-gateway two-phase detection: flip-all → unflip-all → celebrate.
  useEffect(() => {
    if (!demoMode || demoStep !== 'flip-gateway') return;
    const phase = demoFlipPhaseRef.current;
    if (!phase) return;
    if (phase === 'flip-all' && allSurfaceStickersWrongParity(cubies, size)) {
      demoFlipPhaseRef.current = 'unflip-all';
      setDemoCoachCopy('Now flip them all back to normal parity.');
    } else if (phase === 'unflip-all' && checkRubiksSolved(cubies, size)) {
      demoFlipPhaseRef.current = null;
      setDemoCoachCopy(null);
      celebrateStep('flip-gateway');
    }
  }, [demoMode, demoStep, cubies, size, celebrateStep]);

  // Clean up timers on unmount.
  useEffect(() => () => {
    clearDemoWatchTimers();
    clearCelebrationTimer();
  }, [clearDemoWatchTimers, clearCelebrationTimer]);

  // Celebrate the worm step when the traversal completes (solved phase).
  const wormGamePhase = useGameStore((s) => s.wormGamePhase);
  useEffect(() => {
    if (!demoMode || demoStep !== 'worm-traversal') return;
    if (wormGamePhase !== 'solved') return;
    const timer = setTimeout(() => {
      useGameStore.getState().clearDisparityGame();
      celebrateStep('worm-traversal');
    }, 800);
    return () => clearTimeout(timer);
  }, [demoMode, demoStep, wormGamePhase, celebrateStep]);

  // Show the skip coach as soon as the first wormhole tunnel is traversed.
  const wormTunnelCount = useGameStore((s) => s.wormTunnelCount);
  useEffect(() => {
    if (!demoMode || demoStep !== 'worm-traversal') return;
    if (wormTunnelCount < 1) return;
    setDemoTryVisible(true);
  }, [demoMode, demoStep, wormTunnelCount]);

  // On death during the worm demo step, suppress the death screen and advance.
  const wormAlive = useGameStore((s) => s.wormAlive);
  useEffect(() => {
    if (!demoMode || demoStep !== 'worm-traversal') return;
    if (wormAlive !== false) return;
    useGameStore.getState().setShowWormDeathMenu(false);
    const timer = setTimeout(() => {
      useGameStore.getState().clearDisparityGame();
      advanceDemoStep('worm-traversal');
    }, 1200);
    return () => clearTimeout(timer);
  }, [demoMode, demoStep, wormAlive, advanceDemoStep]);

  // Safety net: advance when disparity winner screen is dismissed.
  useEffect(() => {
    if (!demoMode) return;
    return useGameStore.subscribe(
      (s) => s.showDisparityWinner,
      (show, prev) => {
        if (prev && !show) {
          const s = useGameStore.getState();
          if (s.demoMode && s.demoStep === 'chaos-forecast') {
            s.clearDisparityGame();
            s.setChaosLevel(0);
            advanceDemoStepRef.current?.('chaos-forecast');
          }
        }
      }
    );
  }, [demoMode]);

  return {
    demoMode,
    demoStep,
    demoStepIntroVisible,
    demoTryVisible,
    demoForecastVisible,
    demoCoachCopy,
    onTapFlipRef,
    handleStartDemo,
    handleDemoStepContinue,
    advanceDemoStep,
    handleDemoReplay,
    handleDemoFreeplay,
    handleExitDemo,
    handleDemoForecastPick,
    handleDemoChaosSkip,
    handleDemoDisparityDismiss,
    demoShowcaseSubStep,
    demoCelebrationStep,
    demoLaunchStep,
    demoViewSpotlight,
    handleDemoViewSpotlightClick,
    handleDemoShowcaseNext,
    handleDemoShowcaseSkip,
  };
}
