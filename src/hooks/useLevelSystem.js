/**
 * useLevelSystem Hook
 *
 * Manages level selection, progression, and level-specific settings.
 */

import { useCallback } from 'react';
import { useGameStore } from './useGameStore.js';
import { getLevel, getNextLevel } from '../levels/index.js';

/**
 * Hook for level system management
 */
export function useLevelSystem() {
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

    // Level 10 has epic cutscene
    if (levelId === 10 && levelData?.hasCutscene) {
      setShowCutscene(true);
    } else {
      setShowLevelTutorial(true);
    }
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
    setShowMainMenu(true);
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
  const hasNextLevel = currentLevel && currentLevel < 10;

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
