/**
 * Global cube keyboard controls. Menus own input while open; ordinary puzzle
 * shortcuts remain available during play. Retired mode bindings live in the archive.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useGameStore } from './useGameStore.js';
import { selectCubeInputBlocked, selectTopSurface } from './uiSurfaces.js';
import { useCursor } from './useCursor.js';

/**
 * Hook for keyboard controls.
 *
 * Every callback is optional; an absent one simply leaves its key unbound.
 *
 * @param {Object}   options
 * @param {Function} options.onMove              rotation move (axis, dir, pos)
 * @param {Function} options.onFlip              flip the tile at the cursor
 * @param {Function} options.onUndo              undo the last move  (Ctrl/Cmd+Z, U)
 * @param {Function} options.onReset             reset the puzzle    (R)
 * @param {Function} options.onShuffle           shuffle             (Space)
 * @param {Function} options.onSaveState         dev: save cube state    (Ctrl+S)
 * @param {Function} options.onLoadState         dev: restore cube state (Ctrl+O)
 * @param {Function} options.onLevelJump         dev: jump to level N    (Ctrl+1‥9)
 * @param {boolean}  options.disabled            caller owns the keyboard
 */
export function useKeyboardControls({
  onMove,
  onFlip,
  onUndo,
  onReset,
  onShuffle,
  onSaveState,
  onLoadState,
  onLevelJump,
  disabled = false,
}) {
  const { cursor, moveCursor, getRotationParams, cursorToCubePos } = useCursor();

  // Perform rotation based on cursor position
  const performCursorRotation = useCallback((rotationType) => {
    if (useGameStore.getState().wormHealerMode || useGameStore.getState().animState) return;

    const { axis, dir, pos } = getRotationParams(rotationType);
    if (axis && dir !== undefined && onMove) {
      onMove(axis, dir, pos);
    }
    useGameStore.getState().setShowCursor(true);
  }, [getRotationParams, onMove]);

  // Flip tile at cursor position
  const performCursorFlip = useCallback(() => {
    const pos = cursorToCubePos(cursor);
    if (onFlip) {
      onFlip({ x: pos.x, y: pos.y, z: pos.z }, pos.dirKey);
    }
    useGameStore.getState().setShowCursor(true);
  }, [cursor, cursorToCubePos, onFlip]);

  // Props and cursor helpers change identity often; the listener must not. One
  // ref, refreshed every render, keeps the handler on current values.
  const handlersRef = useRef(null);
  handlersRef.current = {
    onUndo, onReset, onShuffle, onSaveState, onLoadState, onLevelJump,
    disabled,
    moveCursor, performCursorRotation, performCursorFlip,
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const h = handlersRef.current;
      const state = useGameStore.getState();

      // Never steal keys from a text field.
      const target = e.target;
      if (target instanceof HTMLElement && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      )) return;

      const key = e.key.toLowerCase();
      const withModifier = e.ctrlKey || e.metaKey;

      // ── Tier 1: works anywhere ────────────────────────────────────────────

      if (key === 'escape') {
        // Close the topmost surface that owns the screen. Previously this only
        // ever cleared help and settings, so the store, every wizard, mode
        // select and the panels all ignored Escape.
        const top = selectTopSurface(state);
        if (top) {
          e.preventDefault();
          top.close(state);
          return;
        }
        state.setShowCursor(false);
        return;
      }

      if (key === 'h' || key === '?') {
        state.toggleHelp();
        return;
      }

      if (key === '`' && import.meta.env.DEV) {
        e.preventDefault();
        state.toggleDevConsole();
        return;
      }

      // ── Gate: everything below touches the puzzle ─────────────────────────

      // The caller owns the keyboard while its local overlay is open.
      if (h.disabled) return;
      // WORM owns movement/jump bindings separately. Puzzle turns never run here.
      if (state.wormHealerMode) return;

      // Space/Enter dismisses the level briefing before any other binding, so
      // Space does not shuffle the cube out from under an unread tutorial.
      if (state.showLevelTutorial && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        state.setShowLevelTutorial(false);
        return;
      }

      // A menu, wizard, modal or the victory screen owns the display.
      if (selectCubeInputBlocked(state)) return;

      // ── Tier 2: dev shortcuts (modifier-guarded) ──────────────────────────

      if (withModifier) {
        if (key === 'z') { e.preventDefault(); h.onUndo?.(); return; }
        if (key === 's') { e.preventDefault(); h.onSaveState?.(); return; }
        if (key === 'o') { e.preventDefault(); h.onLoadState?.(); return; }
        if (/^[1-9]$/.test(e.key)) { e.preventDefault(); h.onLevelJump?.(Number(e.key)); return; }
        return; // leave every other browser shortcut alone
      }

      // ── Tier 3: cursor + cube controls ────────────────────────────────────

      const CURSOR_KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
      if (CURSOR_KEYS[e.key]) {
        e.preventDefault();
        h.moveCursor(CURSOR_KEYS[e.key]);
        return;
      }

      const ROTATION_KEYS = { w: 'up', s: 'down', a: 'left', d: 'right', q: 'ccw', e: 'cw' };
      if (ROTATION_KEYS[key]) {
        e.preventDefault();
        h.performCursorRotation(ROTATION_KEYS[key]);
        return;
      }

      if (key === 'f') {
        e.preventDefault();
        const level = state.currentLevelData;
        if (state.flipMode && (!level || level.features.flips)) h.performCursorFlip();
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        h.onShuffle?.();
        return;
      }

      // Level feature gates: a chapter can withhold a mechanic it has not taught.
      const allows = (feature) => {
        const level = state.currentLevelData;
        return !level || level.features[feature];
      };

      switch (key) {
        case 'u': h.onUndo?.(); break;
        case 'r': h.onReset?.(); break;
        case 'g': if (allows('flips')) state.toggleFlipMode(); break;
        case 't': if (allows('tunnels')) state.toggleTunnels(); break;
        case 'x': if (allows('explode')) state.toggleExploded(); break;
        case 'n': if (allows('net')) state.toggleNetPanel(); break;
        case 'c': if (allows('chaos')) state.toggleChaos(); break;
        case 'v': state.cycleVisualMode(); break;
        default: break;
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
