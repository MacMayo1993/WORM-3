import { useState, useRef, useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from './useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { flipStickerPair, buildManifoldGridMap } from '../game/manifoldLogic.js';
import { checkRubiksSolved } from '../game/winDetection.js';
import { clearRefractory } from '../game/refractoryMap.js';
import { DEMO_STEP_IDS, DEMO_LEVEL_CONFIGS, VIEW_SHOWCASE_SEQUENCE } from '../components/screens/DemoFlowController.jsx';

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

  const demoForecastPickRef = useRef(null);
  const preDemoSettingsRef = useRef(null);
  const demoWatchTimers = useRef([]);
  const onTapFlipRef = useRef(null);
  const advanceDemoStepRef = useRef(null);
  const demoFlipPhaseRef = useRef(null);

  const clearDemoWatchTimers = useCallback(() => {
    demoWatchTimers.current.forEach(clearTimeout);
    demoWatchTimers.current = [];
  }, []);

  const applyDemoSettings = useCallback(() => {
    const store = useGameStore.getState();
    const demoManifoldStyles = {};
    for (let i = 1; i <= 6; i++) demoManifoldStyles[i] = 'topographic';
    store.setSettings({
      ...store.settings,
      colorScheme: 'pastel',
      customColors: null,
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
      // Start with the first view in the sequence
      setDemoShowcaseSubStep(0);
      VIEW_SHOWCASE_SEQUENCE[0]?.apply(store);
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
    store.startDemo();
    applyDemoSettings();
    setDemoStepIntroVisible(true);
  }, [clearDemoWatchTimers, applyDemoSettings]);

  const advanceDemoStep = useCallback((fromStep) => {
    const store = useGameStore.getState();
    if (store.demoStep !== fromStep) return;
    clearDemoWatchTimers();
    setDemoTryVisible(false);
    setDemoForecastVisible(false);
    if (store.randomMode) {
      store.setRandomMode(false);
      applyDemoSettings();
    }
    if (store.wormHealerMode) {
      store.clearDisparityGame();
      cancelDisparityRun();
    }
    if (fromStep === 'view-showcase') {
      store.setVisualMode('classic');
      store.setExploded(false);
      store.setHollowMode(false);
      store.setShowNetPanel(false);
      setDemoShowcaseSubStep(-1);
    }
    const idx = DEMO_STEP_IDS.indexOf(fromStep);
    const nextStep = DEMO_STEP_IDS[idx + 1] || 'end';
    store.setDemoStep(nextStep);
    if (nextStep !== 'end') setDemoStepIntroVisible(true);
  }, [clearDemoWatchTimers, applyDemoSettings, cancelDisparityRun]);
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
    setDemoCoachCopy(null);

    const config = DEMO_LEVEL_CONFIGS[step];
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

  const handleDemoReplay = useCallback(() => {
    clearDemoWatchTimers();
    setDemoTryVisible(false);
    useGameStore.getState().startDemo();
    applyDemoSettings();
    setDemoStepIntroVisible(true);
  }, [clearDemoWatchTimers, applyDemoSettings]);

  const handleDemoFreeplay = useCallback(() => {
    clearDemoWatchTimers();
    setDemoTryVisible(false);
    const store = useGameStore.getState();
    store.setRandomMode(false);
    if (preDemoSettingsRef.current) {
      store.setSettings(preDemoSettingsRef.current);
      preDemoSettingsRef.current = null;
    }
    store.exitDemo();
    store.setShowMainMenu(false);
    setShowFreeplayWizard(true);
  }, [clearDemoWatchTimers, setShowFreeplayWizard]);

  const handleExitDemo = useCallback(() => {
    clearDemoWatchTimers();
    setDemoTryVisible(false);
    const store = useGameStore.getState();
    store.setRandomMode(false);
    if (preDemoSettingsRef.current) {
      store.setSettings(preDemoSettingsRef.current);
      preDemoSettingsRef.current = null;
    }
    store.exitDemo();
  }, [clearDemoWatchTimers]);

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
      colorScheme: 'pastel',
      visualMode: 'classic',
      tileStyle: 'topographic',
    };
    useGameStore.getState().setRotatedCubies(makeCubies(useGameStore.getState().size));
    useGameStore.getState().resetGame();
    startDisparityGame(wizardSettings);
  }, [startDisparityGame]);

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

  // Flip-gateway two-phase detection: flip-all → unflip-all → advance.
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
      advanceDemoStep('flip-gateway');
    }
  }, [demoMode, demoStep, cubies, size, advanceDemoStep]);

  // Clean up timers on unmount.
  useEffect(() => () => clearDemoWatchTimers(), [clearDemoWatchTimers]);

  // Advance the worm step when the traversal completes (solved phase).
  const wormGamePhase = useGameStore((s) => s.wormGamePhase);
  useEffect(() => {
    if (!demoMode || demoStep !== 'worm-traversal') return;
    if (wormGamePhase !== 'solved') return;
    const timer = setTimeout(() => {
      useGameStore.getState().clearDisparityGame();
      advanceDemoStep('worm-traversal');
    }, 2000);
    return () => clearTimeout(timer);
  }, [demoMode, demoStep, wormGamePhase, advanceDemoStep]);

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
    handleDemoShowcaseNext,
    handleDemoShowcaseSkip,
  };
}
