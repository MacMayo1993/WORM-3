/**
 * useGameSession Hook
 *
 * Manages game session state: moves, time, victory conditions.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useGameStore } from './useGameStore.js';
import { checkRubiksWin, checkRubiksSolvedEitherPolarity, allStickersFlipped } from '../game/winDetection.js';
import { WIN_CONDITIONS } from '../levels/schema.js';
import { feel } from '../utils/feel.js';
import { VICTORY } from '../utils/constants.js';

/**
 * Hook for game session management
 */
export function useGameSession() {
  const size = useGameStore((state) => state.size);
  const cubies = useGameStore((state) => state.cubies);
  const moves = useGameStore((state) => state.moves);
  const gameTime = useGameStore((state) => state.gameTime);
  const gameStartTime = useGameStore((state) => state.gameStartTime);
  const hasShuffled = useGameStore((state) => state.hasShuffled);
  const victory = useGameStore((state) => state.victory);
  const achievedWins = useGameStore((state) => state.achievedWins);
  const chaosLevel = useGameStore((state) => state.chaosLevel);
  const currentLevelData = useGameStore((state) => state.currentLevelData);
  const demoMode = useGameStore((state) => state.demoMode);

  const setGameTime = useGameStore((state) => state.setGameTime);
  const setVictory = useGameStore((state) => state.setVictory);
  const setAchievedWins = useGameStore((state) => state.setAchievedWins);

  const gameStartTimeRef = useRef(gameStartTime);
  gameStartTimeRef.current = gameStartTime;

  // Game timer effect
  useEffect(() => {
    if (victory) return; // Pause timer when victory screen is showing
    const interval = setInterval(() => {
      setGameTime(Math.floor((Date.now() - gameStartTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [victory, setGameTime]);

  // Win condition detection
  useEffect(() => {
    // Only check for wins after the puzzle has been shuffled
    if (!hasShuffled) return;
    // Don't check if victory screen is already showing
    if (victory) return;
    // Guard: ensure cubies matches expected size
    if (cubies.length !== size) return;
    // Skip only during STANDALONE Disparity mode — cubies update at 100+ Hz there
    // and the classic win doesn't apply. Story levels always keep win detection
    // (they no longer use chaos), so a story level never lands in this early-out.
    if (chaosLevel > 0 && !currentLevelData) return;
    // Skip during the demo: its steps deliberately stage solved cubes (the
    // baby-cube step starts solved, before its watch scramble runs) with
    // hasShuffled already true, so firing the victory screen here would flash it
    // for a frame before the demo's own suppression clears it. Advancement in
    // the demo is explicit, never via this screen.
    if (demoMode) return;

    // Only two victories remain: the Worm secret win (rarest) and the classic
    // solve. The Sudokube / Ultimate screens were removed — their condition lines
    // up incidentally during normal play and broke immersion.
    //
    // Compute only what those two conditions need instead of detectWinConditions,
    // which also runs checkSudokubeSolved (six face scans building a size×size
    // grid each) on every move just to feed the removed screens — pure
    // wasted work in this hot path. checkRubiksWin is shared by both live wins;
    // allStickersFlipped only runs once the cube is already fully solved.
    //
    // checkRubiksWin is rotation-invariant for centreless cubes (2×2, 4×4), so a
    // player who makes every face uniform in any orientation registers the solve
    // — the strict home-orientation check would reject 23 of a 2×2's 24 solved
    // states, leaving the cube visibly solved with no win.
    // A level may declare that either polarity of the solved fibre counts, in
    // which case the all-dirty board (every sticker showing its antipode) is a
    // win too. That is the `P − n11` branch of C_dir made reachable: a puzzle
    // whose par is the cheaper polarity is unwinnable at par without it, because
    // the strict check only ever accepts the all-clean target.
    const acceptAntipodal = currentLevelData?.winCondition === WIN_CONDITIONS.ANTIPODAL;
    const rubiksSolved = acceptAntipodal ? checkRubiksSolvedEitherPolarity(cubies, size) : checkRubiksWin(cubies, size);

    // The Worm secret win is a Classic-mode surprise: solve the cube having sent
    // every sticker through the manifold at least once. On an antipodal level the
    // all-dirty route satisfies it *by construction* — reaching that polarity
    // means flipping every β-pair — so it would hijack the level's own victory
    // every time the player took the cheaper target. Levels that opened the
    // antipodal door do not also hand out the secret behind it.
    const wormWin = !acceptAntipodal && rubiksSolved && allStickersFlipped(cubies, size);

    // Solving the cube — the thing the whole mode is for — made no sound at all;
    // the victory screen simply appeared. Fires once per win because the
    // achievedWins guard already makes this branch once-per-session.
    if (wormWin && !achievedWins.worm) {
      feel('cubeSolved');
      setVictory(VICTORY.WORM);
      setAchievedWins((prev) => ({ ...prev, worm: true }));
    } else if (rubiksSolved && !achievedWins.rubiks) {
      feel('cubeSolved');
      setVictory(VICTORY.RUBIKS);
      setAchievedWins((prev) => ({ ...prev, rubiks: true }));
    }
  }, [cubies, size, hasShuffled, victory, achievedWins, chaosLevel, currentLevelData, demoMode, setVictory, setAchievedWins]);

  // Format time for display
  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    // State
    moves,
    gameTime,
    formattedTime: formatTime(gameTime),
    victory,
    achievedWins,
    hasShuffled,

    // Actions
    setVictory,
    setAchievedWins,
  };
}
