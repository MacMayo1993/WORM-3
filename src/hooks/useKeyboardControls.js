/**
 * useKeyboardControls Hook
 *
 * The app's single global keyboard handler.
 *
 * Two things used to be wrong here and both were invisible from the call site:
 *
 *  1. The hook destructured only `onMove` and `onFlip` while App passed eleven
 *     props. Undo, reset, shuffle, save/load, level jump and both hands-mode
 *     callbacks were silently dropped — every shortcut the help menu documents
 *     (Space, R, P, Esc, the hands-mode letters) did nothing. So was `disabled`,
 *     which App sets during co-op so WASD drives the crawler instead of turning
 *     the cube; both handlers ran at once.
 *
 *  2. The listener guarded only three cases (worm paused, editable target, level
 *     tutorial), so cube keys stayed live under every menu, wizard and modal —
 *     a player pressing keys in the main menu was scrambling their next game,
 *     and the unconditional arrow-key preventDefault stole scrolling from the
 *     settings panel and the store.
 *
 * Input is now split into two tiers: a small set of shortcuts that work anywhere
 * (help, escape, dev console) and everything that touches the puzzle, which is
 * gated on `selectCubeInputBlocked` plus the caller's own `disabled` flag.
 *
 * State is read through `useGameStore.getState()` inside the handler rather than
 * mirrored into a ref on every render — the listener still attaches exactly once
 * and always sees current state, without ~60 lines of hand-maintained syncing.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useGameStore } from './useGameStore.js';
import { selectCubeInputBlocked, selectTopSurface } from './uiSurfaces.js';
import { useCursor } from './useCursor.js';
import { keyToMove } from '../game/handsInput.js';

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
 * @param {Function} options.onExecuteHandsMove  named speedcuber move while in Hands Mode
 * @param {Function} options.onToggleHandsMode   toggle Hands Mode   (P)
 * @param {boolean}  options.disabled            caller owns the keyboard (e.g. co-op crawler)
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
  onExecuteHandsMove,
  onToggleHandsMode,
  disabled = false,
}) {
  const { cursor, moveCursor, getRotationParams, cursorToCubePos } = useCursor();

  // Perform rotation based on cursor position
  const performCursorRotation = useCallback((rotationType) => {
    if (useGameStore.getState().animState) return;

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
    onExecuteHandsMove, onToggleHandsMode, disabled,
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
        if (state.handsMode) { state.toggleHandsMode(); return; }
        state.setShowCursor(false);
        return;
      }

      if (key === 'h' || key === '?') {
        // 'h' is also a Hands Mode move (F); Hands Mode wins while it is active.
        if (!state.handsMode) { state.toggleHelp(); return; }
      }

      if (key === '`' && import.meta.env.DEV) {
        e.preventDefault();
        state.toggleDevConsole();
        return;
      }

      // ── Gate: everything below touches the puzzle ─────────────────────────

      // The caller owns the keyboard (co-op crawler reads WASD/arrows itself).
      if (h.disabled) return;
      // Worm mode is paused — the cube is frozen behind the pause overlay.
      if (state.wormHealerMode && (state.wormPaused ?? false)) return;

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

      // ── Tier 3: Hands Mode owns the letter keys while active ──────────────

      if (state.handsMode) {
        const move = keyToMove(e);
        if (move) {
          e.preventDefault();
          h.onExecuteHandsMove?.(move);
          return;
        }
      }

      // ── Tier 4: cursor + cube controls ────────────────────────────────────

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
        case 'p': h.onToggleHandsMode?.(); break;
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
