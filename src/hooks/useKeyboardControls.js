/**
 * useKeyboardControls Hook
 *
 * Handles keyboard shortcuts and input.
 */

import { useEffect, useCallback } from 'react';
import { useGameStore } from './useGameStore.js';
import { useCursor } from './useCursor.js';

/**
 * Hook for keyboard controls
 * @param {Object} options - Configuration options
 * @param {Function} options.onMove - Callback for rotation moves
 * @param {Function} options.onFlip - Callback for flip action
 */
export function useKeyboardControls({ onMove, onFlip }) {
  const animState = useGameStore((state) => state.animState);
  const flipMode = useGameStore((state) => state.flipMode);
  const currentLevelData = useGameStore((state) => state.currentLevelData);
  const showLevelTutorial = useGameStore((state) => state.showLevelTutorial);
  const setShowLevelTutorial = useGameStore((state) => state.setShowLevelTutorial);

  // UI toggles
  const toggleHelp = useGameStore((state) => state.toggleHelp);
  const setShowHelp = useGameStore((state) => state.setShowHelp);
  const setShowSettings = useGameStore((state) => state.setShowSettings);
  const toggleFlipMode = useGameStore((state) => state.toggleFlipMode);
  const toggleTunnels = useGameStore((state) => state.toggleTunnels);
  const toggleExploded = useGameStore((state) => state.toggleExploded);
  const toggleNetPanel = useGameStore((state) => state.toggleNetPanel);
  const cycleVisualMode = useGameStore((state) => state.cycleVisualMode);
  const toggleChaos = useGameStore((state) => state.toggleChaos);
  const setShowCursor = useGameStore((state) => state.setShowCursor);

  const { cursor, moveCursor, getRotationParams, cursorToCubePos } = useCursor();

  // Perform rotation based on cursor position
  const performCursorRotation = useCallback((rotationType) => {
    if (animState) return;

    const { axis, dir, pos } = getRotationParams(rotationType);
    if (axis && dir !== undefined && onMove) {
      onMove(axis, dir, pos);
    }
    setShowCursor(true);
  }, [animState, getRotationParams, onMove, setShowCursor]);

  // Flip tile at cursor position
  const performCursorFlip = useCallback(() => {
    const pos = cursorToCubePos(cursor);
    if (onFlip) {
      onFlip({ x: pos.x, y: pos.y, z: pos.z }, pos.dirKey);
    }
    setShowCursor(true);
  }, [cursor, cursorToCubePos, onFlip, setShowCursor]);

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Close tutorial with space or enter
      if (showLevelTutorial && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setShowLevelTutorial(false);
        return;
      }

      const key = e.key.toLowerCase();

      // Arrow keys - cursor movement
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveCursor('up');
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveCursor('down');
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        moveCursor('left');
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        moveCursor('right');
        return;
      }

      // WASDQE - rotation controls
      if (key === 'w') {
        e.preventDefault();
        performCursorRotation('up');
        return;
      }
      if (key === 's') {
        e.preventDefault();
        performCursorRotation('down');
        return;
      }
      if (key === 'a') {
        e.preventDefault();
        performCursorRotation('left');
        return;
      }
      if (key === 'd') {
        e.preventDefault();
        performCursorRotation('right');
        return;
      }
      if (key === 'q') {
        e.preventDefault();
        performCursorRotation('ccw');
        return;
      }
      if (key === 'e') {
        e.preventDefault();
        performCursorRotation('cw');
        return;
      }

      // F - flip at cursor
      if (key === 'f') {
        e.preventDefault();
        if (flipMode && (!currentLevelData || currentLevelData.features.flips)) {
          performCursorFlip();
        }
        return;
      }

      // Other shortcuts - respect level feature restrictions
      switch (key) {
        case 'h':
        case '?':
          toggleHelp();
          break;
        case 'g':
          if (!currentLevelData || currentLevelData.features.flips) {
            toggleFlipMode();
          }
          break;
        case 't':
          if (!currentLevelData || currentLevelData.features.tunnels) {
            toggleTunnels();
          }
          break;
        case 'x':
          if (!currentLevelData || currentLevelData.features.explode) {
            toggleExploded();
          }
          break;
        case 'n':
          if (!currentLevelData || currentLevelData.features.net) {
            toggleNetPanel();
          }
          break;
        case 'v':
          cycleVisualMode();
          break;
        case 'c':
          if (!currentLevelData || currentLevelData.features.chaos) {
            toggleChaos();
          }
          break;
        case 'escape':
          setShowHelp(false);
          setShowSettings(false);
          setShowCursor(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    cursor, animState, flipMode, showLevelTutorial, currentLevelData,
    moveCursor, performCursorRotation, performCursorFlip,
    toggleHelp, toggleFlipMode, toggleTunnels, toggleExploded,
    toggleNetPanel, cycleVisualMode, toggleChaos,
    setShowHelp, setShowSettings, setShowCursor, setShowLevelTutorial
  ]);

  return {
    performCursorRotation,
    performCursorFlip,
  };
}
