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

export function useDisparityGame({
  settings,
  setSettings,
  size,
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
  // null | 3 | 2 | 1 | 'GO!'
  const [disparityCountdown, setDisparityCountdown] = useState(null);

  const pendingDisparityLevelRef = useRef(3);
  const pendingWizardSettingsRef = useRef(null);
  const disparityReverseMovesRef = useRef([]);
  const disparitySolveQueueRef = useRef([]);
  const disparitySolveActiveRef = useRef(false);
  const disparitySolveIntervalRef = useRef(null);

  // Resolve active bet when the winner screen appears
  useEffect(() => {
    return useGameStore.subscribe(
      (s) => s.showDisparityWinner,
      (show) => {
        if (!show) return;
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

  // Applies wizard settings, scrambles the cube N times, then starts the
  // 3-2-1-GO countdown before the cube unshuffles itself.
  const startDisparityGame = useCallback((wizardSettings) => {
    useGameStore.getState().clearLevel();
    useGameStore.getState().clearDisparityGame();
    // Stamp the freshly-placed bet (if any) with this round's id so the
    // resolver can tell it apart from bets orphaned by abandoned rounds.
    useGameStore.getState().beginDisparityRound();
    if (wizardSettings.flipCap != null) useGameStore.getState().setDisparityFlipCap(wizardSettings.flipCap);
    if (wizardSettings.gameLength != null) useGameStore.getState().setDisparityGameLength(wizardSettings.gameLength);

    const _allStyles = ['solid', 'glossy', 'matte', 'metallic', 'carbonFiber', 'hexGrid', 'comic', 'cafeWall', 'hermanGrid', 'opticSpin', 'ouchi', 'scintillatingGrid', 'zoellner', 'kanizsa', 'grass', 'ice', 'sand', 'water', 'wood', 'circuit', 'holographic', 'pulse', 'lava', 'galaxy', 'neural'];
    const manifoldStyles = {};
    [1, 2, 3, 4, 5, 6].forEach((id) => {
      const perFace = wizardSettings.perFaceStyles?.[id];
      if (perFace && perFace !== 'random') {
        manifoldStyles[id] = perFace;
      } else if (wizardSettings.tileStyle === 'random' || perFace === 'random') {
        manifoldStyles[id] = _allStyles[Math.floor(Math.random() * _allStyles.length)];
      } else {
        manifoldStyles[id] = wizardSettings.tileStyle || 'solid';
      }
    });

    const newSettings = {
      ...settings,
      colorScheme: wizardSettings.colorScheme || settings.colorScheme,
      backgroundTheme: wizardSettings.backgroundTheme || settings.backgroundTheme,
      manifoldStyles,
      biomeMode: { enabled: false, faceAssignment: null },
    };
    if (wizardSettings.customColors) newSettings.customColors = wizardSettings.customColors;
    setSettings(newSettings);

    if (wizardSettings.visualMode) setVisualMode(wizardSettings.visualMode);
    setFlipMode(wizardSettings.flipMode ?? true);
    if (wizardSettings.showTunnels !== undefined) setShowTunnels(wizardSettings.showTunnels);

    pendingDisparityLevelRef.current = wizardSettings.disparityLevel;
    setChaosLevel(0);

    const targetSize = wizardSettings.cubeSize || size;
    if (targetSize !== size) {
      changeSize(targetSize);
    } else {
      reset();
    }

    // Generate forward scramble moves, then compute the exact reverse sequence.
    // Use getState().size so we read the freshly-set size after changeSize().
    setTimeout(() => {
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
        // Scramble finished — start 3-2-1-GO countdown
        setDisparityCountdown(3);
      });
    }, 50);
  }, [size, settings, setSettings, changeSize, setVisualMode, setFlipMode, setShowTunnels, setChaosLevel, reset, cancelShuffle, startAnimatedShuffle]);

  const handleDisparitySetupComplete = useCallback((wizardSettings) => {
    setShowDisparityWizard(false);
    pendingWizardSettingsRef.current = wizardSettings;
    // Any bet still active here belongs to a round that never resolved
    // (the player quit mid-round) — return the wager before taking a new bet.
    useGameStore.getState().refundActiveBet();
    // SPEED benchmark for the chosen settings, shown on the betting screen.
    setSpeedThresholdSec(speedThresholdFor(wizardSettings.disparityLevel, wizardSettings.flipCap));
    // Show betting screen so the player can wager before chaos starts.
    setShowDisparityBetting(true);
  }, []);

  const launchRound = useCallback(() => {
    useGameStore.getState().setRotatedCubies(makeCubies(size));
    useGameStore.getState().resetGame();
    launchWithMobi(mobiLines, 'DISPARITY MODE', () => {
      vibrate([50, 30, 100]);
      startDisparityGame(pendingWizardSettingsRef.current);
    });
  }, [size, launchWithMobi, mobiLines, startDisparityGame]);

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

  // Cancels an in-flight countdown/solve sequence. Called by App's reset
  // wrapper and by mode switches (e.g. starting Worm mode mid-countdown).
  const cancelDisparityRun = useCallback(() => {
    setDisparityCountdown(null);
    disparitySolveActiveRef.current = false;
    if (disparitySolveIntervalRef.current) {
      clearTimeout(disparitySolveIntervalRef.current);
      disparitySolveIntervalRef.current = null;
    }
  }, []);

  return {
    showDisparityWizard,
    setShowDisparityWizard,
    showDisparityBetting,
    speedThresholdSec,
    disparityCountdown,
    handleDisparitySetupComplete,
    handleBetPlaced,
    handleBetSkipped,
    cancelDisparityRun,
  };
}
