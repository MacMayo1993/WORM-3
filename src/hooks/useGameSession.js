/**
 * useGameSession Hook
 *
 * Manages game session state: moves, time, victory conditions.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useGameStore } from './useGameStore.js';
import { checkRubiksWin, allStickersFlipped } from '../game/winDetection.js';
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
    // solve. The Sudokube / Ultimate (Latin-square) screens were removed — their
    // condition lines up incidentally during normal play and broke immersion.
    //
    // Compute only what those two conditions need instead of detectWinConditions,
    // which also runs checkSudokubeSolved (six Latin-square face scans building a
    // size×size grid each) on every move just to feed the removed screens — pure
    // wasted work in this hot path. checkRubiksWin is shared by both live wins;
    // allStickersFlipped only runs once the cube is already fully solved.
    //
    // checkRubiksWin is rotation-invariant for centreless cubes (2×2, 4×4), so a
    // player who makes every face uniform in any orientation registers the solve
    // — the strict home-orientation check would reject 23 of a 2×2's 24 solved
    // states, leaving the cube visibly solved with no win.
    const rubiksSolved = checkRubiksWin(cubies, size);
    const wormWin = rubiksSolved && allStickersFlipped(cubies, size);

    if (wormWin && !achievedWins.worm) {
      setVictory(VICTORY.WORM);
      setAchievedWins((prev) => ({ ...prev, worm: true }));
    } else if (rubiksSolved && !achievedWins.rubiks) {
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
