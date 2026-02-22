/**
 * useGameSession Hook
 *
 * Manages game session state: moves, time, victory conditions.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useGameStore } from './useGameStore.js';
import { detectWinConditions } from '../game/winDetection.js';

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

    const wins = detectWinConditions(cubies, size);

    // Prioritize worm victory (rarest), then ultimate, then individual wins
    if (wins.worm && !achievedWins.worm) {
      setVictory('worm');
      setAchievedWins((prev) => ({ ...prev, worm: true }));
    } else if (wins.ultimate && !achievedWins.ultimate) {
      setVictory('ultimate');
      setAchievedWins((prev) => ({ ...prev, ultimate: true, rubiks: true, sudokube: true }));
    } else if (wins.rubiks && !achievedWins.rubiks) {
      setVictory('rubiks');
      setAchievedWins((prev) => ({ ...prev, rubiks: true }));
    } else if (wins.sudokube && !achievedWins.sudokube) {
      setVictory('sudokube');
      setAchievedWins((prev) => ({ ...prev, sudokube: true }));
    }
  }, [cubies, size, hasShuffled, victory, achievedWins, setVictory, setAchievedWins]);

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
