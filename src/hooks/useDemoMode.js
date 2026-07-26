import { useState, useRef, useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from './useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { flipStickerPair, buildManifoldGridMap, findAntipodalStickerByGrid } from '../game/manifoldLogic.js';
import { checkRubiksSolved } from '../game/winDetection.js';
import { clearRefractory } from '../game/refractoryMap.js';
import { displacedPairCount, totalFlippedCount } from '../game/demoProgress.js';
import { DEFAULT_SETTINGS } from '../utils/colorSchemes.js';
import {
  applyDemoOverrides, looksLikeDemoSettings, mergeDemoSettings, demoLookChanged, DEMO_CONTROLLED_KEYS,
} from '../utils/demoSettings.js';
import { DEMO_STEP_IDS, DEMO_LEVEL_CONFIGS, VIEW_SHOWCASE_SEQUENCE } from '../components/screens/DemoFlowController.jsx';

// The demo temporarily overwrites the player's persisted settings (neon,
// desert, topographic tiles — see utils/demoSettings.js). This key holds the
// pre-demo snapshot so an unclean exit (refresh / tab close mid-demo) can be
// healed on next launch — otherwise the shader-heavy demo look sticks to the
// device forever.
const PRE_DEMO_SETTINGS_KEY = 'worm3_predemo_settings';

// How long the twin step waits for the player to press Flip themselves before
// arming it for them. The demo asks for the tap because knowing where Flip Mode
// lives is the point — but it must never be able to stall, so the fallback runs
// the step either way.
const FLIP_SPOTLIGHT_FALLBACK_MS = 12000;

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
  armSceneGate,
}) {
  const { demoMode, demoStep } = useGameStore(useShallow((s) => ({
    demoMode: s.demoMode,
    demoStep: s.demoStep,
  })));

  const cubies = useGameStore((s) => s.cubies);
  const size = useGameStore((s) => s.size);
  const victory = useGameStore((s) => s.victory);

  const [demoColdOpenVisible, setDemoColdOpenVisible] = useState(false);
  const [demoStepIntroVisible, setDemoStepIntroVisible] = useState(false);
  const [demoForecastVisible, setDemoForecastVisible] = useState(false);
  const [demoTryVisible, setDemoTryVisible] = useState(false);
  const [demoCoachCopy, setDemoCoachCopy] = useState(null);
  const [demoShowcaseSubStep, setDemoShowcaseSubStep] = useState(-1);
  const [demoViewSpotlight, setDemoViewSpotlight] = useState(false);
  const [demoCelebrationStep, setDemoCelebrationStep] = useState(null);
  const [demoLaunchStep, setDemoLaunchStep] = useState(null);
  const [demoRewardStamp, setDemoRewardStamp] = useState(null);
  const [demoFlipProgress, setDemoFlipProgress] = useState(null);
  const [demoFlipSpotlight, setDemoFlipSpotlight] = useState(false);
  const [demoHintStep, setDemoHintStep] = useState(null);

  const demoForecastPickRef = useRef(null);
  const demoRewardPendingRef = useRef(false);
  const preDemoSettingsRef = useRef(null);
  // The look the demo last applied. Restore compares against this to tell
  // "player never touched it" from "player changed it in the Settings step".
  const demoAppliedSettingsRef = useRef(null);
  // Set once the player has been through the Settings step. From then on the
  // demo stops re-applying its own look on every step entry — their picks ride
  // along through worm, chaos and random, and out the far end of the demo.
  const playerCustomizedRef = useRef(false);
  // Settings as they stood when the Settings step opened, so the step can tell
  // "player picked something" from "player skipped".
  const settingsStepEntryRef = useRef(null);
  const demoWatchTimers = useRef([]);
  const onTapFlipRef = useRef(null);
  const advanceDemoStepRef = useRef(null);
  const demoFlipPhaseRef = useRef(null);
  const babySolveArmedRef = useRef(false);
  const twinFlipBaselineRef = useRef(null);
  const twinWatchFiredRef = useRef(false);
  const preDemoWormCharacterRef = useRef(null);
  const preDemoWormSkinRef = useRef(null);

  const clearDemoWatchTimers = useCallback(() => {
    demoWatchTimers.current.forEach(clearTimeout);
    demoWatchTimers.current = [];
  }, []);

  // Fire the STEP COMPLETE burst and hold it on screen. It no longer
  // auto-advances — the stamp stays over a blurred scene until the player taps
  // it or presses Next Step (see dismissDemoCelebration), so the win registers.
  const celebrateStep = useCallback((step) => {
    if (useGameStore.getState().demoStep !== step) return;
    clearDemoWatchTimers();
    setDemoTryVisible(false);
    setDemoCoachCopy(null);
    // `cur || step` keeps an already-showing celebration intact so repeat
    // detections (e.g. a cubies re-render) can't restart the fly-in.
    setDemoCelebrationStep((cur) => cur || step);
  }, [clearDemoWatchTimers]);

  // Player tapped the held STEP COMPLETE stamp (or its Next Step button):
  // clear the celebration and advance to the next step.
  const dismissDemoCelebration = useCallback(() => {
    setDemoCelebrationStep((cur) => {
      if (cur) advanceDemoStepRef.current?.(cur);
      return null;
    });
  }, []);

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

  // Stage the demo's look. No-op once the player has set their own in the
  // Settings step — from that point the demo is a guest in their theme.
  const applyDemoSettings = useCallback(() => {
    if (playerCustomizedRef.current) return;
    const store = useGameStore.getState();
    const next = applyDemoOverrides(store.settings);
    store.setSettings(next);
    demoAppliedSettingsRef.current = next;
  }, []);

  // Put the staged look back after a step that rewrote it. Random mode is the
  // one that does: it re-rolls the colour scheme and tile styles every few
  // seconds while it runs, so leaving that step (or bailing out mid-cycle) has
  // to restore either the player's own theme or the demo's, otherwise a random
  // roll would follow them out of the demo.
  const playerLookRef = useRef(null);
  const restoreStagedLook = useCallback(() => {
    if (!playerCustomizedRef.current) { applyDemoSettings(); return; }
    if (!playerLookRef.current) return;
    const store = useGameStore.getState();
    const restored = { ...store.settings };
    for (const key of DEMO_CONTROLLED_KEYS) restored[key] = playerLookRef.current[key];
    store.setSettings(restored);
  }, [applyDemoSettings]);

  // Hand the player's settings back on the way out: demo-controlled fields the
  // player never touched roll back to the pre-demo snapshot, anything they
  // changed themselves stays changed.
  const restorePlayerSettings = useCallback(() => {
    const store = useGameStore.getState();
    if (preDemoSettingsRef.current) {
      store.setSettings(mergeDemoSettings(
        preDemoSettingsRef.current,
        store.settings,
        demoAppliedSettingsRef.current,
      ));
      preDemoSettingsRef.current = null;
    }
    demoAppliedSettingsRef.current = null;
    playerCustomizedRef.current = false;
    try { localStorage.removeItem(PRE_DEMO_SETTINGS_KEY); } catch { /* private mode */ }
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
      //
      // Skipped once the player has picked their own look — their background
      // outranks the demo's set dressing — and recorded in the applied-settings
      // ref either way, so the restore still recognises it as the demo's doing.
      if (config.backgroundTheme && !playerCustomizedRef.current) {
        const fresh = useGameStore.getState();
        const withSkybox = { ...fresh.settings, backgroundTheme: config.backgroundTheme };
        fresh.setSettings(withSkybox);
        demoAppliedSettingsRef.current = withSkybox;
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

    // Settings step: a plain solved cube behind the real Settings menu. The
    // menu itself is opened by handleDemoStepContinue once the launch stamp has
    // cleared, and closing it is what completes the step.
    if (config.type === 'settings') {
      settingsStepEntryRef.current = { ...useGameStore.getState().settings };
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
      store.setShowAntipodalPiP(false);
      store.setHasShuffled(true);
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
      store.setShowAntipodalPiP(false);
      store.setHasShuffled(true);
      // Spotlight the Views button first — the user's tap starts the sequence.
      setDemoShowcaseSubStep(-1);
      setDemoViewSpotlight(true);
      return;
    }

    if (config.cubeSize !== store.size) {
      changeSize(config.cubeSize);
    }
    // Steps that teach the Flip button start with it OFF and ask the player to
    // press it (see handleDemoStepContinue's spotlight); every other step gets
    // whatever its feature set declares.
    store.setFlipMode(config.gateOnFlipToggle ? false : config.features.flips);
    store.setShowTunnels(config.features.tunnels);
    store.setVisualMode('classic');
    store.setShowAntipodalPiP(false);
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

  // Light the rings + tether between a tile and its twin, hold, then perform the
  // flip so the player sees WHICH two tiles are about to move before either of
  // them moves. The engine does this once per device on a player's first-ever
  // flip; the demo drives it explicitly so the beat plays on every run, for
  // returning players too.
  const playTwinWatchFlip = useCallback((tile) => {
    const store = useGameStore.getState();
    const { cubies: cs, size: sz } = store;
    const sticker = cs[tile.x]?.[tile.y]?.[tile.z]?.stickers?.[tile.dirKey];
    if (!sticker) return;
    const map = buildManifoldGridMap(cs, sz);
    const anti = findAntipodalStickerByGrid(map, sticker, sz);
    const fire = () => {
      useGameStore.getState().setFirstFlipHighlightPair(null);
      // Arms the completion watcher rather than snapshotting a baseline here:
      // the engine can hold this flip back another 800ms of its own (its
      // first-flip pair highlight), so the watcher takes the first board change
      // it sees as the demo's flip and only counts changes after that as the
      // player's.
      twinWatchFiredRef.current = true;
      onTapFlipRef.current?.({ x: tile.x, y: tile.y, z: tile.z }, tile.dirKey);
    };
    if (!anti) { fire(); return; }
    const antiSticker = cs[anti.x]?.[anti.y]?.[anti.z]?.stickers?.[anti.dirKey];
    store.setFirstFlipHighlightPair({
      source: { x: tile.x, y: tile.y, z: tile.z, dir: tile.dirKey, faceId: sticker.curr },
      antipodal: { x: anti.x, y: anti.y, z: anti.z, dir: anti.dirKey, faceId: antiSticker?.curr },
    });
    demoWatchTimers.current.push(setTimeout(fire, 1100));
  }, []);

  // The hands-on half of a cube step: play the WATCH beat, then put up the hint
  // pill and the coach's Next pill. Split out of handleDemoStepContinue because
  // the twin step defers this until the player has pressed Flip themselves.
  const beginCubeTryPhase = useCallback((step) => {
    const config = DEMO_LEVEL_CONFIGS[step];
    if (!config) return;
    const watch = config.watch;
    if (watch?.type === 'rotate') {
      demoWatchTimers.current.push(setTimeout(() => {
        startAnimatedShuffle(watch.moves, () => {});
      }, 700));
    } else if (watch?.type === 'flip') {
      demoWatchTimers.current.push(setTimeout(() => playTwinWatchFlip(watch.tile), 900));
    }
    setDemoHintStep(step);
    const coachDelay = watch ? 2800 : 800;
    demoWatchTimers.current.push(setTimeout(() => setDemoTryVisible(true), coachDelay));
  }, [startAnimatedShuffle, playTwinWatchFlip]);

  // Escape hatches for the Flip prompt: the hint's "Do It For Me" button and the
  // fallback timer. Both just turn flip mode on — the effect watching flipMode
  // is the single place that starts the watch beat, so the step plays out
  // identically however flipping got armed. Re-asserting the spotlight keeps
  // that effect's gate open in the odd case where it was already cleared.
  const armFlipAndContinue = useCallback(() => {
    if (!useGameStore.getState().demoMode) return;
    setDemoFlipSpotlight(true);
    useGameStore.getState().setFlipMode(true);
  }, []);

  const handleDemoFlipSpotlightSkip = useCallback(() => {
    armFlipAndContinue();
  }, [armFlipAndContinue]);

  const handleStartDemo = useCallback(() => {
    clearDemoWatchTimers();
    setDemoTryVisible(false);
    const store = useGameStore.getState();
    playerCustomizedRef.current = false;
    preDemoSettingsRef.current = { ...store.settings };
    try { localStorage.setItem(PRE_DEMO_SETTINGS_KEY, JSON.stringify(store.settings)); } catch { /* private mode */ }
    store.startDemo();
    applyDemoSettings();
    // Pre-stage the first step's cube so Mobi's cold-open blurs the right scene
    // (otherwise the menu's 3×3 lingers behind the dialogue until Start).
    applyDemoStepConfig('baby-cube');
    // Cover the demo's opening scene the same way mode entries do, so the desert
    // environment map doesn't pop in behind Mobi's cold open (self-dismisses if
    // it's already warm — warmDemoAssets() often pre-fetches it).
    armSceneGate?.('Demo');
    // Cold open first: Mobi frames the "every tile has a twin" idea before the
    // player touches anything, then hands off to the baby-cube step intro.
    setDemoColdOpenVisible(true);
  }, [clearDemoWatchTimers, applyDemoSettings, applyDemoStepConfig, armSceneGate]);

  // Cold open dismissed → drop into the first step's intro.
  const handleDemoColdOpenContinue = useCallback(() => {
    setDemoColdOpenVisible(false);
    setDemoStepIntroVisible(true);
  }, []);

  const advanceDemoStep = useCallback((fromStep) => {
    const store = useGameStore.getState();
    if (store.demoStep !== fromStep) return;
    clearDemoWatchTimers();
    setDemoTryVisible(false);
    setDemoFlipProgress(null);
    setDemoForecastVisible(false);
    setDemoLaunchStep(null);
    setDemoFlipSpotlight(false);
    setDemoHintStep(null);
    setDemoCoachCopy(null);
    twinFlipBaselineRef.current = null;
    twinWatchFiredRef.current = false;
    store.setFirstFlipHighlightPair(null);
    if (store.randomMode) {
      store.setRandomMode(false);
      restoreStagedLook();
    }
    if (store.wormHealerMode) {
      store.clearDisparityGame();
      cancelDisparityRun();
    }
    if (fromStep === 'worm-traversal') restoreWormCharacter();
    if (fromStep === 'make-it-yours') {
      store.setShowSettings(false);
      // Only a player who actually changed something owns the look from here on.
      // Skipping the step leaves the demo staging its own theme as before —
      // treating a skip as a choice would freeze the demo into whatever was on
      // screen at the time.
      const now = useGameStore.getState().settings;
      if (demoLookChanged(settingsStepEntryRef.current, now)) {
        playerCustomizedRef.current = true;
        playerLookRef.current = { ...now };
      }
      settingsStepEntryRef.current = null;
    }
    if (fromStep === 'view-showcase') {
      store.setVisualMode('classic');
      store.setExploded(false);
      store.setHollowMode(false);
      store.setShowNetPanel(false);
      store.setShowAntipodalPiP(false);
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
  }, [clearDemoWatchTimers, restoreStagedLook, cancelDisparityRun, restoreWormCharacter, applyDemoStepConfig]);
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

    // The WORM step swaps in the Shanghai skybox and jumps the cube to 6×6 —
    // the heaviest transition in the demo. Hold the loading cube over it for a
    // guaranteed 2.5s — eager, so it shows even though the rebuild isn't a clean
    // asset load — above the demo chrome so the player never watches it pop in.
    if (step === 'worm-traversal') {
      armSceneGate?.('Worm Mode', { eager: true, holdMs: 2500, z: 10600 });
    }

    applyDemoStepConfig(step);

    demoFlipPhaseRef.current = step === 'flip-gateway' ? 'flip-all' : null;
    babySolveArmedRef.current = false;
    twinFlipBaselineRef.current = null;
    twinWatchFiredRef.current = false;
    setDemoCoachCopy(null);
    setDemoFlipSpotlight(false);
    setDemoHintStep(null);

    const config = DEMO_LEVEL_CONFIGS[step];

    // Launch punch: title stamp + flash over the freshly staged scene, with a
    // camera orbit kick on the cube-centric steps.
    setDemoLaunchStep(step);
    demoWatchTimers.current.push(setTimeout(() => setDemoLaunchStep(null), 2750));
    if (config && config.type !== 'worm' && config.type !== 'chaos') {
      useGameStore.getState().triggerCameraOrbit?.('cw');
    }
    if (config && config.type === 'cube') {
      if (config.gateOnFlipToggle) {
        // Hand the step over to the player: spotlight Flip on the nav bar once
        // the launch stamp has cleared, and keep a fallback so an unanswered
        // prompt can never stall the demo.
        demoWatchTimers.current.push(setTimeout(() => setDemoFlipSpotlight(true), 1500));
        demoWatchTimers.current.push(setTimeout(() => {
          if (useGameStore.getState().demoStep === step && !useGameStore.getState().flipMode) {
            armFlipAndContinue();
          }
        }, FLIP_SPOTLIGHT_FALLBACK_MS));
      } else {
        beginCubeTryPhase(step);
      }
    }

    // Settings step: let the launch stamp read, then open the real menu.
    if (config && config.type === 'settings') {
      setDemoHintStep(step);
      demoWatchTimers.current.push(setTimeout(() => {
        if (useGameStore.getState().demoStep === step) useGameStore.getState().setShowSettings(true);
      }, 1600));
    }

    if (config && config.type === 'worm') {
      demoWatchTimers.current.push(setTimeout(() => setDemoTryVisible(true), 10000));
    }

    if (config && config.type === 'chaos') {
      setDemoHintStep(step);
      demoWatchTimers.current.push(setTimeout(() => setDemoTryVisible(true), 5000));
    }

    if (config && config.type === 'random') {
      setDemoHintStep(step);
      demoWatchTimers.current.push(setTimeout(() => setDemoTryVisible(true), 12000));
    }
  }, [applyDemoStepConfig, handleOpenStore, clearDemoWatchTimers, armSceneGate, armFlipAndContinue, beginCubeTryPhase]);

  const cleanupAllDemoState = useCallback((store) => {
    clearDemoWatchTimers();
    restoreWormCharacter();
    // Bailing out mid-Random means the live settings are a random roll; put the
    // staged look back before anyone compares settings to decide what to keep.
    if (store.randomMode) restoreStagedLook();
    demoRewardPendingRef.current = false;
    setDemoRewardStamp(null);
    setDemoFlipProgress(null);
    setDemoCelebrationStep(null);
    setDemoLaunchStep(null);
    setDemoTryVisible(false);
    setDemoColdOpenVisible(false);
    setDemoStepIntroVisible(false);
    setDemoForecastVisible(false);
    setDemoCoachCopy(null);
    setDemoShowcaseSubStep(-1);
    setDemoViewSpotlight(false);
    setDemoFlipSpotlight(false);
    setDemoHintStep(null);
    demoFlipPhaseRef.current = null;
    twinFlipBaselineRef.current = null;
    twinWatchFiredRef.current = false;
    store.setRandomMode(false);
    store.setVisualMode('classic');
    store.setExploded(false);
    store.setHollowMode(false);
    store.setShowNetPanel(false);
    store.setShowAntipodalPiP(false);
    store.setFlipMode(false);
    store.setShowTunnels(false);
    store.setFirstFlipHighlightPair(null);
    store.setShowSettings(false);
    store.setShowDisparityWinner(false);
    if (store.wormHealerMode) {
      store.clearDisparityGame();
      cancelDisparityRun();
    }
    if (store.disparityRunning) {
      store.clearDisparityGame();
      cancelDisparityRun();
    }
  }, [clearDemoWatchTimers, cancelDisparityRun, restoreWormCharacter, restoreStagedLook]);

  const handleDemoReplay = useCallback(() => {
    const store = useGameStore.getState();
    cleanupAllDemoState(store);
    store.startDemo();
    applyDemoSettings();
    applyDemoStepConfig('baby-cube');
    setDemoColdOpenVisible(true);
  }, [cleanupAllDemoState, applyDemoSettings, applyDemoStepConfig]);

  const handleDemoFreeplay = useCallback(() => {
    const store = useGameStore.getState();
    cleanupAllDemoState(store);
    restorePlayerSettings();
    store.exitDemo();
    store.setShowMainMenu(false);
    setShowFreeplayWizard(true);
  }, [cleanupAllDemoState, restorePlayerSettings, setShowFreeplayWizard]);

  // Single exit door for the demo: the coach's Exit, the end screen, and the
  // top bar's Home button all come through here, so there is no way out that
  // leaves demoMode on or the demo's borrowed look on the device.
  const handleExitDemo = useCallback(() => {
    const store = useGameStore.getState();
    if (!store.demoMode) return;
    cleanupAllDemoState(store);
    restorePlayerSettings();
    store.exitDemo();
  }, [cleanupAllDemoState, restorePlayerSettings]);

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
      // still carry the demo's signature look, the demo left them behind —
      // reset the demo-controlled fields to their defaults. The signature test
      // lives beside the apply path (utils/demoSettings.js) precisely so this
      // check can't drift out of date the way it silently did before.
      const s = useGameStore.getState().settings;
      if (looksLikeDemoSettings(s)) {
        useGameStore.getState().setSettings({
          ...s,
          colorScheme: DEFAULT_SETTINGS.colorScheme,
          customColors: DEFAULT_SETTINGS.customColors,
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
      visualMode: 'classic',
      // The chaos launcher rebuilds the whole look from these fields (an absent
      // tileStyle means solid, not "leave it alone"), so once the player has
      // picked their own theme in the Settings step, feed their live values back
      // in instead of the demo's.
      ...(playerCustomizedRef.current
        ? {
          colorScheme: useGameStore.getState().settings.colorScheme,
          perFaceStyles: useGameStore.getState().settings.manifoldStyles,
        }
        : { colorScheme: 'neon', tileStyle: 'topographic' }),
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

  // Award the Parity Points, flash the reward stamp (same launch-stamp text
  // treatment as a new step), then advance once it clears. The pending ref
  // blocks the showDisparityWinner safety-net below from advancing early and
  // stealing the stamp — this is the single path that closes the chaos step.
  const finishChaosWithReward = useCallback((reward, correct) => {
    // The stamp holds for 2.6s before the step advances, so the step guard no
    // longer stops a second trigger (e.g. a double-click on the winner's
    // Continue) from re-granting PP. The pending ref is the idempotency lock.
    if (demoRewardPendingRef.current) return;
    const store = useGameStore.getState();
    demoRewardPendingRef.current = true;
    setDemoForecastVisible(false);
    setDemoRewardStamp({ amount: reward, correct });
    store.earnCoins(reward);
    store.setShowDisparityWinner(false);
    store.clearDisparityGame();
    store.setChaosLevel(0);
    cancelDisparityRun();
    demoForecastPickRef.current = null;
    demoWatchTimers.current.push(setTimeout(() => {
      setDemoRewardStamp(null);
      demoRewardPendingRef.current = false;
      advanceDemoStepRef.current?.('chaos-forecast');
    }, 2600));
  }, [cancelDisparityRun]);

  const handleDemoChaosSkip = useCallback(() => {
    finishChaosWithReward(50, false);
  }, [finishChaosWithReward]);

  // Mobi's mid-step aside was acknowledged — drop back to the compact coach
  // pill. Held here rather than inside DemoCoach so the app knows the blocking
  // dialogue is gone and can restore the bottom nav.
  const handleDemoCoachCopySeen = useCallback(() => setDemoCoachCopy(null), []);

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
    finishChaosWithReward(correct ? 200 : 50, correct);
  }, [demoMode, demoStep, finishChaosWithReward]);

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

  // The spotlighted Flip button was pressed (on the nav bar, via the mobile
  // controls, or by keyboard) — that tap is the step's first hurdle, so the
  // watch beat starts the moment flip mode comes on, whichever control did it.
  const flipMode = useGameStore((s) => s.flipMode);
  useEffect(() => {
    if (!demoMode || !demoFlipSpotlight || !flipMode) return;
    setDemoFlipSpotlight(false);
    beginCubeTryPhase(useGameStore.getState().demoStep);
  }, [demoMode, demoFlipSpotlight, flipMode, beginCubeTryPhase]);

  // Twin step: watching the demo's flip is not the lesson — doing one is. The
  // first board change after the watch flip is fired is the demo's own flip and
  // becomes the baseline; the next change is the player's, and closes the step.
  useEffect(() => {
    if (!demoMode || demoStep !== 'twin-paradox') return;
    if (!twinWatchFiredRef.current) return;
    const away = totalFlippedCount(cubies);
    if (twinFlipBaselineRef.current == null) {
      if (away > 0) twinFlipBaselineRef.current = away;
      return;
    }
    if (away !== twinFlipBaselineRef.current) {
      twinFlipBaselineRef.current = null;
      twinWatchFiredRef.current = false;
      celebrateStep('twin-paradox');
    }
  }, [demoMode, demoStep, cubies, celebrateStep]);

  // Flip-gateway runs as send-a-face-across → bring-it-all-home, with a live
  // count so the tap loop reads as a short task with a finish line.
  //
  // Both the count and the finishing condition are measured in displaced PAIRS
  // anywhere on the cube, not tiles on the front face. A player who twists a row
  // mid-step rotates flipped tiles out of view and fresh ones in; a front-face
  // count would move the goalposts under them, and a "cube solved" finish would
  // demand they undo the twist as well. Pairs-away-from-home is exactly the
  // thing this step teaches, and it is true from any angle.
  useEffect(() => {
    if (!demoMode || demoStep !== 'flip-gateway') return;
    const phase = demoFlipPhaseRef.current;
    if (!phase) { setDemoFlipProgress(null); return; }
    const total = size * size;
    const away = displacedPairCount(cubies);
    if (phase === 'flip-all') {
      setDemoFlipProgress({ phase, done: Math.min(away, total), total });
      if (away >= total) {
        demoFlipPhaseRef.current = 'unflip-all';
        setDemoCoachCopy('Those tiles are all living on their twins\' side now. Tap them again to bring them home.');
      }
    } else if (phase === 'unflip-all') {
      setDemoFlipProgress({ phase, done: Math.max(0, total - away), total });
      if (away === 0) {
        demoFlipPhaseRef.current = null;
        setDemoCoachCopy(null);
        setDemoFlipProgress(null);
        celebrateStep('flip-gateway');
      }
    }
  }, [demoMode, demoStep, cubies, size, celebrateStep]);

  // Settings step: the player closing the Settings menu is what completes it.
  // Armed only while the step is live, so the menu they open later (from the top
  // bar, during any other step) doesn't advance anything.
  const showSettings = useGameStore((s) => s.showSettings);
  const settingsWereOpenRef = useRef(false);
  useEffect(() => {
    if (!demoMode || demoStep !== 'make-it-yours') {
      settingsWereOpenRef.current = false;
      return;
    }
    if (showSettings) { settingsWereOpenRef.current = true; return; }
    if (settingsWereOpenRef.current) {
      settingsWereOpenRef.current = false;
      celebrateStep('make-it-yours');
    }
  }, [demoMode, demoStep, showSettings, celebrateStep]);

  // Clean up timers on unmount.
  useEffect(() => () => {
    clearDemoWatchTimers();
  }, [clearDemoWatchTimers]);

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
          // The normal payout path (finishChaosWithReward) holds a reward
          // stamp before advancing; don't race past it here.
          if (demoRewardPendingRef.current) return;
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
    demoColdOpenVisible,
    handleDemoColdOpenContinue,
    demoStepIntroVisible,
    demoTryVisible,
    demoForecastVisible,
    demoCoachCopy,
    handleDemoCoachCopySeen,
    demoHintStep,
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
    dismissDemoCelebration,
    demoLaunchStep,
    demoRewardStamp,
    demoFlipProgress,
    demoViewSpotlight,
    handleDemoViewSpotlightClick,
    demoFlipSpotlight,
    handleDemoFlipSpotlightSkip,
    handleDemoShowcaseNext,
    handleDemoShowcaseSkip,
  };
}
