/**
 * useGameSession Hook
 *
 * Manages game session state: moves, time, victory conditions.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useGameStore } from './useGameStore.js';
import { checkRubiksSolved, allStickersFlipped } from '../game/winDetection.js';
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
    // Skip during chaos/disparity mode — cubies update at 100+ Hz and traditional
    // win conditions don't apply. Re-runs once when chaosLevel drops back to 0.
    if (chaosLevel > 0) return;

    // Only two victories remain: the Worm secret win (rarest) and the classic
    // solve. The Sudokube / Ultimate (Latin-square) screens were removed — their
    // condition lines up incidentally during normal play and broke immersion.
    //
    // Compute only what those two conditions need instead of detectWinConditions,
    // which also runs checkSudokubeSolved (six Latin-square face scans building a
    // size×size grid each) on every move just to feed the removed screens — pure
    // wasted work in this hot path. checkRubiksSolved is shared by both live wins;
    // allStickersFlipped only runs once the cube is already fully solved.
    const rubiksSolved = checkRubiksSolved(cubies, size);
    const wormWin = rubiksSolved && allStickersFlipped(cubies, size);

    if (wormWin && !achievedWins.worm) {
      setVictory(VICTORY.WORM);
      setAchievedWins((prev) => ({ ...prev, worm: true }));
    } else if (rubiksSolved && !achievedWins.rubiks) {
      setVictory(VICTORY.RUBIKS);
      setAchievedWins((prev) => ({ ...prev, rubiks: true }));
    }
  }, [cubies, size, hasShuffled, victory, achievedWins, chaosLevel, setVictory, setAchievedWins]);

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
