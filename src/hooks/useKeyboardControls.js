/**
 * useKeyboardControls Hook
 *
 * Handles keyboard shortcuts and input.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from './useGameStore.js';
import { useCursor } from './useCursor.js';

/**
 * Hook for keyboard controls
 * @param {Object} options - Configuration options
 * @param {Function} options.onMove - Callback for rotation moves
 * @param {Function} options.onFlip - Callback for flip action
 */
export function useKeyboardControls({ onMove, onFlip }) {
  const {
    animState,
    flipMode,
    currentLevelData,
    showLevelTutorial,
    setShowLevelTutorial,
    toggleHelp,
    setShowHelp,
    setShowSettings,
    toggleFlipMode,
    toggleTunnels,
    toggleExploded,
    toggleNetPanel,
    cycleVisualMode,
    toggleChaos,
    setShowCursor,
  } = useGameStore(useShallow((state) => ({
    animState: state.animState,
    flipMode: state.flipMode,
    currentLevelData: state.currentLevelData,
    showLevelTutorial: state.showLevelTutorial,
    setShowLevelTutorial: state.setShowLevelTutorial,
    toggleHelp: state.toggleHelp,
    setShowHelp: state.setShowHelp,
    setShowSettings: state.setShowSettings,
    toggleFlipMode: state.toggleFlipMode,
    toggleTunnels: state.toggleTunnels,
    toggleExploded: state.toggleExploded,
    toggleNetPanel: state.toggleNetPanel,
    cycleVisualMode: state.cycleVisualMode,
    toggleChaos: state.toggleChaos,
    setShowCursor: state.setShowCursor,
  })));

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

  const latestRef = useRef({
    animState,
    flipMode,
    currentLevelData,
    showLevelTutorial,
    moveCursor,
    performCursorRotation,
    performCursorFlip,
    toggleHelp,
    setShowHelp,
    setShowSettings,
    toggleFlipMode,
    toggleTunnels,
    toggleExploded,
    toggleNetPanel,
    cycleVisualMode,
    toggleChaos,
    setShowCursor,
    setShowLevelTutorial,
  });

  useEffect(() => {
    latestRef.current = {
      animState,
      flipMode,
      currentLevelData,
      showLevelTutorial,
      moveCursor,
      performCursorRotation,
      performCursorFlip,
      toggleHelp,
      setShowHelp,
      setShowSettings,
      toggleFlipMode,
      toggleTunnels,
      toggleExploded,
      toggleNetPanel,
      cycleVisualMode,
      toggleChaos,
      setShowCursor,
      setShowLevelTutorial,
    };
  }, [
    animState,
    flipMode,
    currentLevelData,
    showLevelTutorial,
    moveCursor,
    performCursorRotation,
    performCursorFlip,
    toggleHelp,
    setShowHelp,
    setShowSettings,
    toggleFlipMode,
    toggleTunnels,
    toggleExploded,
    toggleNetPanel,
    cycleVisualMode,
    toggleChaos,
    setShowCursor,
    setShowLevelTutorial,
  ]);

  // Keyboard event handler (attached once, reads latest state via ref)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const {
        flipMode: latestFlipMode,
        currentLevelData: latestCurrentLevelData,
        showLevelTutorial: latestShowLevelTutorial,
        moveCursor: latestMoveCursor,
        performCursorRotation: latestPerformCursorRotation,
        performCursorFlip: latestPerformCursorFlip,
        toggleHelp: latestToggleHelp,
        setShowHelp: latestSetShowHelp,
        setShowSettings: latestSetShowSettings,
        toggleFlipMode: latestToggleFlipMode,
        toggleTunnels: latestToggleTunnels,
        toggleExploded: latestToggleExploded,
        toggleNetPanel: latestToggleNetPanel,
        cycleVisualMode: latestCycleVisualMode,
        toggleChaos: latestToggleChaos,
        setShowCursor: latestSetShowCursor,
        setShowLevelTutorial: latestSetShowLevelTutorial,
      } = latestRef.current;

      // Don't trigger if typing in editable controls
      const target = e.target;
      if (target instanceof HTMLElement && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      )) return;

      // Close tutorial with space or enter
      if (latestShowLevelTutorial && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        latestSetShowLevelTutorial(false);
        return;
      }

      const key = e.key.toLowerCase();

      // Arrow keys - cursor movement
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        latestMoveCursor('up');
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        latestMoveCursor('down');
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        latestMoveCursor('left');
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        latestMoveCursor('right');
        return;
      }

      // WASDQE - rotation controls
      if (key === 'w') {
        e.preventDefault();
        latestPerformCursorRotation('up');
        return;
      }
      if (key === 's') {
        e.preventDefault();
        latestPerformCursorRotation('down');
        return;
      }
      if (key === 'a') {
        e.preventDefault();
        latestPerformCursorRotation('left');
        return;
      }
      if (key === 'd') {
        e.preventDefault();
        latestPerformCursorRotation('right');
        return;
      }
      if (key === 'q') {
        e.preventDefault();
        latestPerformCursorRotation('ccw');
        return;
      }
      if (key === 'e') {
        e.preventDefault();
        latestPerformCursorRotation('cw');
        return;
      }

      // F - flip at cursor
      if (key === 'f') {
        e.preventDefault();
        if (latestFlipMode && (!latestCurrentLevelData || latestCurrentLevelData.features.flips)) {
          latestPerformCursorFlip();
        }
        return;
      }

      // Other shortcuts - respect level feature restrictions
      switch (key) {
        case 'h':
        case '?':
          latestToggleHelp();
          break;
        case 'g':
          if (!latestCurrentLevelData || latestCurrentLevelData.features.flips) {
            latestToggleFlipMode();
          }
          break;
        case 't':
          if (!latestCurrentLevelData || latestCurrentLevelData.features.tunnels) {
            latestToggleTunnels();
          }
          break;
        case 'x':
          if (!latestCurrentLevelData || latestCurrentLevelData.features.explode) {
            latestToggleExploded();
          }
          break;
        case 'n':
          if (!latestCurrentLevelData || latestCurrentLevelData.features.net) {
            latestToggleNetPanel();
          }
          break;
        case 'v':
          latestCycleVisualMode();
          break;
        case 'c':
          if (!latestCurrentLevelData || latestCurrentLevelData.features.chaos) {
            latestToggleChaos();
          }
          break;
        case 'escape':
          latestSetShowHelp(false);
          latestSetShowSettings(false);
          latestSetShowCursor(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    performCursorRotation,
    performCursorFlip,
  };
}
