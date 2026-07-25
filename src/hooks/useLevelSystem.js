/**
 * useLevelSystem Hook
 *
 * Manages level selection, progression, and level-specific settings.
 */

import { useCallback, useRef } from 'react';
import { useGameStore } from './useGameStore.js';
import { getLevel, getNextLevel } from '../levels/index.js';
import { makeCubies } from '../game/cubeState.js';
import { clearRefractory } from '../game/refractoryMap.js';

// ── Briefing memory ─────────────────────────────────────────────────────────
// Which chapters have already played their Mobi intro. Persisted so a returning
// player is not re-briefed on chapter 1 every session, and degrades to
// "brief every time" if storage is unavailable, which is the safe direction.
const BRIEFED_KEY = 'worm3_briefed_levels';

const readBriefed = () => {
  try {
    const raw = localStorage.getItem(BRIEFED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const hasSeenBriefing = (levelId) => readBriefed().includes(levelId);

export const markBriefingSeen = (levelId) => {
  try {
    const seen = readBriefed();
    if (seen.includes(levelId)) return;
    localStorage.setItem(BRIEFED_KEY, JSON.stringify([...seen, levelId]));
  } catch {
    /* storage unavailable (private mode / quota) — non-fatal */
  }
};

/**
 * Hook for level system management
 */
export function useLevelSystem({ onBriefingSkipped } = {}) {
  // Called when a chapter opens with no briefing to close. The briefing's close
  // handler is what scrambles the cube, so skipping it must still scramble —
  // otherwise a replayed chapter would open already solved.
  const skipRef = useRef(onBriefingSkipped);
  skipRef.current = onBriefingSkipped;

  const currentLevel = useGameStore((state) => state.currentLevel);
  const currentLevelData = useGameStore((state) => state.currentLevelData);
  const setCurrentLevel = useGameStore((state) => state.setCurrentLevel);
  const setCurrentLevelData = useGameStore((state) => state.setCurrentLevelData);
  const completedLevels = useGameStore((state) => state.completedLevels);
  const completeCurrentLevel = useGameStore((state) => state.completeCurrentLevel);
  const clearLevel = useGameStore((state) => state.clearLevel);

  // UI state
  const setShowMainMenu = useGameStore((state) => state.setShowMainMenu);
  const setShowLevelSelect = useGameStore((state) => state.setShowLevelSelect);
  const setShowCutscene = useGameStore((state) => state.setShowCutscene);
  const setShowLevelTutorial = useGameStore((state) => state.setShowLevelTutorial);

  // Game state to apply level settings
  const setSize = useGameStore((state) => state.setSize);
  const setChaosLevel = useGameStore((state) => state.setChaosLevel);
  const setVisualMode = useGameStore((state) => state.setVisualMode);
  const setFlipMode = useGameStore((state) => state.setFlipMode);
  const setShowTunnels = useGameStore((state) => state.setShowTunnels);

  // Show level select screen
  const handleShowLevelSelect = useCallback(() => {
    setShowMainMenu(false);
    setShowLevelSelect(true);
  }, [setShowMainMenu, setShowLevelSelect]);

  // Handle level selection
  const handleLevelSelect = useCallback((levelId) => {
    const levelData = getLevel(levelId);
    setCurrentLevel(levelId);
    setCurrentLevelData(levelData);
    setShowLevelSelect(false);

    // Prevent win-detection firing on the freshly-solved cube that setSize creates
    // while the tutorial/cutscene is shown. The real shuffle happens on close.
    useGameStore.getState().setHasShuffled(false);

    // Apply level settings
    if (levelData) {
      setSize(levelData.cubeSize);
      setChaosLevel(levelData.chaosLevel);

      // Set visual mode based on level mode
      if (levelData.mode === 'sudokube') {
        setVisualMode('sudokube');
      } else if (levelData.mode === 'ultimate') {
        setVisualMode('grid');
      } else {
        setVisualMode('classic');
      }

      // Enable/disable features based on level
      setFlipMode(levelData.features.flips);
      setShowTunnels(levelData.features.tunnels);
    }

    // Briefings are a first-visit beat, not a toll booth. Replaying a chapter —
    // which is exactly what a player does on a hard one — should drop straight
    // into the cube; the objective and hint stay available in the story HUD.
    const seen = hasSeenBriefing(levelId);

    // A campaign level can opt into an opening cutscene. This is data-driven so
    // changing a pack's length or finale ID cannot make its cutscene unreachable.
    if (levelData?.hasCutscene && !seen) {
      setShowCutscene(true);
    } else if (!seen) {
      setShowLevelTutorial(true);
    } else {
      skipRef.current?.();
    }
    markBriefingSeen(levelId);
  }, [
    setCurrentLevel, setCurrentLevelData, setShowLevelSelect,
    setSize, setChaosLevel, setVisualMode, setFlipMode, setShowTunnels,
    setShowCutscene, setShowLevelTutorial
  ]);

  // Handle cutscene completion
  const handleCutsceneComplete = useCallback(() => {
    setShowCutscene(false);
    setShowLevelTutorial(true);
  }, [setShowCutscene, setShowLevelTutorial]);

  // Handle tutorial close (start level)
  const handleTutorialClose = useCallback(() => {
    setShowLevelTutorial(false);
  }, [setShowLevelTutorial]);

  // Handle back to main menu
  const handleBackToMainMenu = useCallback(() => {
    setShowLevelSelect(false);
    // The campaign chooser sits in front of the map, so leaving for the menu has
    // to close it too or it would still be up behind the main menu.
    useGameStore.getState().setShowPackSelect(false);
    setShowMainMenu(true);
    // Fully reset cube and all game state so the next session starts clean.
    const { size: currentSize } = useGameStore.getState();
    useGameStore.getState().setRotatedCubies(makeCubies(currentSize));
    useGameStore.getState().resetGame();
    useGameStore.getState().clearHistory();
    useGameStore.getState().setChaosLevel(0);
    useGameStore.getState().clearDisparityGame();
    clearRefractory();
  }, [setShowLevelSelect, setShowMainMenu]);

  // Handle next level
  const handleNextLevel = useCallback(() => {
    completeCurrentLevel();

    const nextLevelData = getNextLevel(currentLevel);
    if (nextLevelData) {
      handleLevelSelect(nextLevelData.id);
    }
  }, [currentLevel, completeCurrentLevel, handleLevelSelect]);

  // Exit to freeplay mode
  const exitToFreeplay = useCallback(() => {
    clearLevel();
  }, [clearLevel]);

  // Check if a feature is available at current level
  const isFeatureAvailable = useCallback((feature) => {
    if (!currentLevelData) return true; // Freeplay mode
    return currentLevelData.features[feature] ?? true;
  }, [currentLevelData]);

  // Check if level is completed
  const isLevelCompleted = useCallback((levelId) => {
    return completedLevels.includes(levelId);
  }, [completedLevels]);

  // Check if there's a next level
  const hasNextLevel = Boolean(currentLevel && (getNextLevel(currentLevel)));

  return {
    // State
    currentLevel,
    currentLevelData,
    completedLevels,
    hasNextLevel,

    // Actions
    handleShowLevelSelect,
    handleLevelSelect,
    handleCutsceneComplete,
    handleTutorialClose,
    handleBackToMainMenu,
    handleNextLevel,
    exitToFreeplay,
    completeCurrentLevel,

    // Utilities
    isFeatureAvailable,
    isLevelCompleted,
  };
}
