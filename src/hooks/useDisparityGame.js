// src/hooks/useDisparityGame.js
// The complete Disparity Mode flow, extracted from App.jsx: wizard → betting
// screen → Mobi intro → scramble → 3-2-1-GO countdown → auto-unshuffle solve
// sequence → chaos elimination → bet resolution when the winner appears.
// App.jsx passes in its cube/settings/intro helpers and threads the returned
// UI state + handlers into UILayer.

import { useState, useRef, useCallback, useEffect } from 'react';
import { useGameStore } from './useGameStore.js';
import { resolveBet, calcPayout, speedThresholdFor } from '../utils/disparityBetting.js';
import { DISPARITY_GAME_LENGTHS } from '../utils/economyConstants.js';
import { makeCubies } from '../game/cubeState.js';
import { vibrate } from '../utils/audio.js';
import { chaosSetupSettings } from '../utils/chaosSetup.js';
import { resolveWizardTileStyles } from '../utils/wizardTileStyles.js';
import { randomIgnitionTile } from '../game/chaosIgnition.js';

export function useDisparityGame({
  settings,
  setSettings,
  changeSize,
  reset,
  cancelShuffle,
  startAnimatedShuffle,
  setChaosLevel,
  setVisualMode,
  setFlipMode,
  setShowTunnels,
  launchWithMobi,
  mobiLines,
}) {
  const [showDisparityWizard, setShowDisparityWizard] = useState(false);
  const [showDisparityBetting, setShowDisparityBetting] = useState(false);
  // SPEED bet benchmark (median seconds) for the wizard settings being bet on.
  const [speedThresholdSec, setSpeedThresholdSec] = useState(null);
  const [chaosPreview, setChaosPreview] = useState(null);
  // null | 3 | 2 | 1 | 'GO!'
  const [disparityCountdown, setDisparityCountdown] = useState(null);
  // True between the scramble and the countdown while the player picks the tile
  // chaos ignites on. Read from the store, not held here: every session reset
  // (Home, reset, a mode switch) clears the store flag, so the prompt can never
  // outlive the round it belongs to.
  const ignitionPicking = useGameStore((s) => s.chaosIgnitionPicking);

  const pendingDisparityLevelRef = useRef(3);
  const pendingWizardSettingsRef = useRef(null);
  const disparityReverseMovesRef = useRef([]);
  const disparitySolveQueueRef = useRef([]);
  const disparitySolveActiveRef = useRef(false);
  const disparitySolveIntervalRef = useRef(null);
  const launchTimerRef = useRef(null);
  const launchGenerationRef = useRef(0);

  // Settle at the authoritative winner, before the visible reveal. Leaving the
  // reveal must not refund an already-known losing prediction.
  useEffect(() => {
    return useGameStore.subscribe(
      (s) => s.disparityWinner,
      (winner) => {
        if (!winner) return;
        try {
          const s = useGameStore.getState();
          // Round over — convert healed-tile parity score into wallet PP
          // (idempotent: the action zeroes the score it cashes).
          useGameStore.getState().cashOutParityScore();
          const activeBet = s.activeBet;
          if (!activeBet) return;
          // A bet may only resolve against the round it was stamped for. A stale
          // bet (its round was abandoned; this winner is from a later chaos
          // session) is refunded rather than resolved against a random outcome.
          if (activeBet.roundId !== s.disparityRoundId) {
            useGameStore.getState().refundActiveBet();
            return;
          }
          const result = resolveBet(activeBet, {
            settings: s.settings,
            disparityDeaths: s.disparityDeaths,
            disparityWinner: s.disparityWinner,
            disparityEliminatedFaces: s.disparityEliminatedFaces,
            // SPEED's fast/slow threshold is the measured median for these settings.
            chaosLevel: s.chaosLevel,
            disparityFlipCap: s.disparityFlipCap,
          });
          if (!result) return;
          const streak = s.betStreak || 0;
          if (result.push) {
            // No meaningful outcome for this bet (e.g. SPEED with too few
            // eliminations) — return the wager and leave the streak untouched.
            useGameStore.getState().setLastBetResult({
              won: false, push: true, payout: 0, net: 0, loss: 0,
              description: result.description, wager: activeBet.wager,
            });
            useGameStore.getState().refundActiveBet();
            return;
          }
          if (result.won) {
            const payout = calcPayout(activeBet.wager, activeBet.odds, streak);
            useGameStore.getState().earnCoins(payout);
            useGameStore.getState().setBetStreak(streak + 1);
            useGameStore.getState().setLastBetResult({
              won: true, payout, net: payout - activeBet.wager, loss: 0,
              description: result.description, wager: activeBet.wager,
            });
          } else {
            // Wager was already deducted at bet time — just record the result.
            useGameStore.getState().setBetStreak(0);
            useGameStore.getState().setLastBetResult({
              won: false, payout: 0, loss: activeBet.wager,
              description: result.description, wager: activeBet.wager,
            });
          }
          useGameStore.getState().clearActiveBet();
        } finally {
          useGameStore.getState().finishChaosExperience();
        }
      }
    );
  }, []);

  // Stop solve sequence as soon as the chaos worker declares a winner
  useEffect(() => {
    return useGameStore.subscribe(
      (s) => s.showDisparityWinner,
      (show) => {
        if (show) {
          disparitySolveActiveRef.current = false;
          if (disparitySolveIntervalRef.current) {
            clearTimeout(disparitySolveIntervalRef.current);
            disparitySolveIntervalRef.current = null;
          }
        }
      }
    );
  }, []);

  // Fires the pre-computed reverse moves one by one at a steady pace.
  // Called after the 3-2-1-GO countdown finishes.
  const startSolveSequence = useCallback((moves) => {
    if (!moves || !moves.length) return;
    disparitySolveQueueRef.current = [...moves];
    disparitySolveActiveRef.current = true;

    const MOVE_INTERVAL_MS = 1500; // pace between each unshuffle move

    const fireNext = () => {
      if (!disparitySolveActiveRef.current) return;

      // Stop if chaos worker already declared a winner
      if (useGameStore.getState().disparityWinner) {
        disparitySolveActiveRef.current = false;
        return;
      }

      if (disparitySolveQueueRef.current.length === 0) {
        // All reverse moves played — the cosmetic unshuffle animation is done,
        // but that's unrelated to the chaos elimination battle's progress. The
        // worker keeps running and will declare the real winner (see
        // useChaosWorker.js) once it actually narrows living stickers down to
        // a final antipodal pair. Forcing a fake winner here used to end the
        // game while the cube still showed many active tiles.
        disparitySolveActiveRef.current = false;
        return;
      }

      // Wait for the current face-rotation animation to finish before firing
      const tryFire = () => {
        if (!disparitySolveActiveRef.current) return;
        if (useGameStore.getState().animState) {
          disparitySolveIntervalRef.current = setTimeout(tryFire, 50);
          return;
        }
        const move = disparitySolveQueueRef.current.shift();
        if (!move) { disparitySolveActiveRef.current = false; return; }
        const { axis, sliceIndex, dir } = move;
        useGameStore.getState().setAnimState({ axis, sliceIndex, dir, t: 0 });
        useGameStore.getState().setPendingMove({ axis, sliceIndex, dir });
        disparitySolveIntervalRef.current = setTimeout(fireNext, MOVE_INTERVAL_MS);
      };

      tryFire();
    };

    // Brief pause before first move so "GO!" banner can be seen
    disparitySolveIntervalRef.current = setTimeout(fireNext, 400);
  }, []);

  // 3-2-1-GO countdown before chaos begins, then starts the solve sequence
  useEffect(() => {
    if (disparityCountdown === null) return;
    if (disparityCountdown === 'GO!') {
      const t = setTimeout(() => {
        setDisparityCountdown(null);
        setChaosLevel(pendingDisparityLevelRef.current);
        // Begin playing the reverse moves — cube unshuffles itself
        startSolveSequence(disparityReverseMovesRef.current);
      }, 600);
      return () => clearTimeout(t);
    }
    if (typeof disparityCountdown === 'number' && disparityCountdown > 0) {
      const t = setTimeout(() => {
        setDisparityCountdown((prev) => (prev === 1 ? 'GO!' : prev - 1));
      }, 900);
      return () => clearTimeout(t);
    }
  }, [disparityCountdown, setChaosLevel, startSolveSequence]);

  // Puts the cube the player chose on screen: palette, tile styles, scene, view,
  // tunnels, Flip, and size. Runs BEFORE Mobi's intro as well as at launch, so
  // the intro plays over the player's own cube rather than whatever the last mode
  // left behind (the intro used to show the previous size and look, and the pick
  // only arrived once the scramble began). `resetCube` rebuilds a solved cube when
  // the size is unchanged.
  const applyChaosSetup = useCallback((wizardSettings, resetCube) => {
    const manifoldStyles = resolveWizardTileStyles(wizardSettings);
    setSettings({
      ...chaosSetupSettings(settings, wizardSettings),
      backgroundTheme: wizardSettings.backgroundTheme || settings.backgroundTheme,
      manifoldStyles,
      biomeMode: { enabled: false, faceAssignment: null },
    });
    if (wizardSettings.visualMode) setVisualMode(wizardSettings.visualMode);
    setFlipMode(wizardSettings.flipMode ?? true);
    if (wizardSettings.showTunnels !== undefined) setShowTunnels(wizardSettings.showTunnels);
    setChaosLevel(0);
    // Read the live size: this runs from callbacks captured before a re-render.
    const liveSize = useGameStore.getState().size;
    const targetSize = wizardSettings.cubeSize || liveSize;
    if (targetSize !== liveSize) changeSize(targetSize);
    else resetCube();
  }, [settings, setSettings, setVisualMode, setFlipMode, setShowTunnels, setChaosLevel, changeSize]);

  const stopIgnitionPick = useCallback(() => {
    useGameStore.getState().setChaosIgnitionPicking(false);
  }, []);

  // Applies wizard settings, scrambles the cube N times, then starts the
  // 3-2-1-GO countdown before the cube unshuffles itself. With `pickIgnition`
  // the round first waits for the player to choose the tile chaos strikes first.
  const startDisparityGame = useCallback((wizardSettings, { pickIgnition = false } = {}) => {
    useGameStore.getState().clearLastBetResult();
    useGameStore.getState().clearLevel();
    useGameStore.getState().clearDisparityGame();
    // Stamp the freshly-placed bet (if any) with this round's id so the
    // resolver can tell it apart from bets orphaned by abandoned rounds.
    useGameStore.getState().beginDisparityRound();
    if (wizardSettings.flipCap != null) useGameStore.getState().setDisparityFlipCap(wizardSettings.flipCap);
    if (wizardSettings.gameLength != null) useGameStore.getState().setDisparityGameLength(wizardSettings.gameLength);
    // A pick left over from an abandoned round must never aim this one.
    useGameStore.getState().setChaosIgnition(null);
    stopIgnitionPick();

    pendingDisparityLevelRef.current = wizardSettings.disparityLevel;
    applyChaosSetup(wizardSettings, reset);

    // Generate forward scramble moves, then compute the exact reverse sequence.
    // Use getState().size so we read the freshly-set size after changeSize().
    const launchGeneration = ++launchGenerationRef.current;
    if (launchTimerRef.current) clearTimeout(launchTimerRef.current);
    launchTimerRef.current = setTimeout(() => {
      launchTimerRef.current = null;
      if (launchGeneration !== launchGenerationRef.current) return;
      const freshSize = useGameStore.getState().size;
      const numMoves = DISPARITY_GAME_LENGTHS[wizardSettings.gameLength] ?? DISPARITY_GAME_LENGTHS.medium;
      const axes = ['row', 'col', 'depth'];
      const forwardMoves = Array.from({ length: numMoves }, () => ({
        axis: axes[Math.floor(Math.random() * 3)],
        sliceIndex: Math.floor(Math.random() * freshSize),
        dir: Math.random() > 0.5 ? 1 : -1,
      }));
      // Reverse = play the moves backwards with opposite direction
      disparityReverseMovesRef.current = forwardMoves.slice().reverse().map(m => ({ ...m, dir: -m.dir }));

      cancelShuffle();
      useGameStore.getState().setRotatedCubies(makeCubies(freshSize));
      startAnimatedShuffle(forwardMoves, () => {
        if (launchGeneration !== launchGenerationRef.current) return;
        // Scramble finished — the player aims the first strike, or the
        // 3-2-1-GO countdown starts straight away.
        if (pickIgnition) {
          useGameStore.getState().setChaosIgnitionPicking(true);
        } else {
          setDisparityCountdown(3);
        }
      });
    }, 50);
  }, [applyChaosSetup, stopIgnitionPick, reset, cancelShuffle, startAnimatedShuffle]);

  // "Strike here": lock the aimed tile in and count down. Both keys act only while
  // a pick is actually open — a stale press after leaving must not launch a round.
  const confirmIgnition = useCallback(() => {
    const s = useGameStore.getState();
    if (!s.chaosIgnitionPicking || !s.chaosIgnition) return;
    stopIgnitionPick();
    setDisparityCountdown(3);
  }, [stopIgnitionPick]);

  // "Surprise me": the storm picks, and the countdown starts at once.
  const surpriseIgnition = useCallback(() => {
    const s = useGameStore.getState();
    if (!s.chaosIgnitionPicking) return;
    s.setChaosIgnition(randomIgnitionTile(s.cubies, s.size, s.disparityFlipCap));
    stopIgnitionPick();
    setDisparityCountdown(3);
  }, [stopIgnitionPick]);

  const handleDisparitySetupComplete = useCallback((wizardSettings) => {
    setShowDisparityWizard(false);
    const preview = chaosSetupSettings(settings, wizardSettings);
    pendingWizardSettingsRef.current = preview;
    setChaosPreview(preview);
    // Any bet still active here belongs to a round that never resolved
    // (the player quit mid-round) — return the wager before taking a new bet.
    useGameStore.getState().refundActiveBet();
    // SPEED benchmark for the chosen settings, shown on the betting screen.
    setSpeedThresholdSec(speedThresholdFor(wizardSettings.disparityLevel, wizardSettings.flipCap));
    // Show betting screen so the player can wager before chaos starts.
    setShowDisparityBetting(true);
  }, [settings]);

  const launchRound = useCallback(() => {
    const setup = pendingWizardSettingsRef.current;
    // Show the cube the player just built under Mobi's intro, not the last one.
    if (setup) {
      applyChaosSetup(setup, () => useGameStore.getState().setRotatedCubies(makeCubies(useGameStore.getState().size)));
    } else {
      useGameStore.getState().setRotatedCubies(makeCubies(useGameStore.getState().size));
    }
    useGameStore.getState().resetGame();
    launchWithMobi(mobiLines, 'DISPARITY MODE', () => {
      vibrate([50, 30, 100]);
      startDisparityGame(pendingWizardSettingsRef.current, { pickIgnition: true });
    });
  }, [applyChaosSetup, launchWithMobi, mobiLines, startDisparityGame]);

  const handleBetPlaced = useCallback((bet) => {
    useGameStore.getState().setActiveBet(bet);
    setShowDisparityBetting(false);
    launchRound();
  }, [launchRound]);

  const handleBetSkipped = useCallback(() => {
    useGameStore.getState().clearActiveBet();
    setShowDisparityBetting(false);
    launchRound();
  }, [launchRound]);

  const handleBetBack = useCallback(() => {
    setShowDisparityBetting(false);
    setShowDisparityWizard(true);
  }, []);

  const handleChaosReplay = useCallback(() => {
    useGameStore.getState().setChaosLevel(0);
    useGameStore.getState().clearDisparityGame();
    useGameStore.getState().clearLastBetResult();
    if (pendingWizardSettingsRef.current) {
      handleDisparitySetupComplete(pendingWizardSettingsRef.current);
    } else setShowDisparityWizard(true);
  }, [handleDisparitySetupComplete]);

  // Cancels an in-flight countdown/solve sequence. Called by App's reset
  // wrapper and by mode switches (e.g. starting Worm mode mid-countdown).
  const cancelDisparityRun = useCallback(() => {
    launchGenerationRef.current++;
    if (launchTimerRef.current) clearTimeout(launchTimerRef.current);
    launchTimerRef.current = null;
    setDisparityCountdown(null);
    stopIgnitionPick();
    useGameStore.getState().setChaosIgnition(null);
    disparitySolveActiveRef.current = false;
    if (disparitySolveIntervalRef.current) {
      clearTimeout(disparitySolveIntervalRef.current);
      disparitySolveIntervalRef.current = null;
    }
  }, [stopIgnitionPick]);

  useEffect(() => () => {
    launchGenerationRef.current++;
    clearTimeout(launchTimerRef.current);
    clearTimeout(disparitySolveIntervalRef.current);
    disparitySolveActiveRef.current = false;
    useGameStore.getState().setChaosIgnitionPicking(false);
  }, []);

  return {
    showDisparityWizard,
    setShowDisparityWizard,
    showDisparityBetting,
    speedThresholdSec,
    chaosPreview, handleBetBack, handleChaosReplay,
    disparityCountdown,
    ignitionPicking,
    confirmIgnition,
    surpriseIgnition,
    handleDisparitySetupComplete,
    handleBetPlaced,
    handleBetSkipped,
    cancelDisparityRun,
    startDisparityGame,
  };
}
