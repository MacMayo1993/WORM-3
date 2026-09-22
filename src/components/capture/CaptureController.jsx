import { useEffect } from 'react';
import { useGameStore } from '../../hooks/useGameStore.js';
import { callWormTurn } from '../../worm/wormTurnBridge.js';
import './capture.css';

// Global listeners also cover the standalone cubelet viewer. They do not
// capture ordinary single-finger gestures or keyboard gameplay controls.
export default function CaptureController() {
  const active = useGameStore(s => s.captureMode);
  useEffect(() => {
    document.documentElement.classList.toggle('capture-active', active);
    if (active) document.activeElement?.blur?.();
    return () => document.documentElement.classList.remove('capture-active');
  }, [active]);

  useEffect(() => {
    let timer = null;
    let gesture = null;
    let swallow = false;
    const cancelTimer = () => { clearTimeout(timer); timer = null; };
    const stop = e => { if (e.cancelable) e.preventDefault(); e.stopImmediatePropagation(); };
    const start = e => {
      if (!useGameStore.getState().captureMode && !swallow) return;
      if (e.touches.length < 2) return;
      // Let movement controls see the second finger and cancel pending input.
      // Moves/releases below are swallowed until both fingers have lifted.
      if (e.cancelable) e.preventDefault();
      cancelTimer();
      swallow = true;
      gesture = e.touches.length === 2
        ? Array.from(e.touches, t => ({ id: t.identifier, x: t.clientX, y: t.clientY })) : null;
      if (!gesture) return;
      timer = setTimeout(() => {
        gesture = null;
        useGameStore.getState().setCaptureMode(false);
      }, 1000);
    };
    const move = e => {
      if (!swallow) return;
      stop(e);
      if (!gesture) return;
      if (Array.from(e.touches).some(t => {
        const origin = gesture.find(p => p.id === t.identifier);
        return !origin || Math.hypot(t.clientX - origin.x, t.clientY - origin.y) > 16;
      })) { cancelTimer(); gesture = null; }
    };
    const end = e => {
      if (!swallow) return;
      stop(e);
      cancelTimer();
      const state = useGameStore.getState();
      if (gesture && e.type !== 'touchcancel' && state.captureMode && state.wormHealerMode) callWormTurn('signature');
      gesture = null;
      if (e.touches.length === 0) swallow = false;
    };
    const key = e => {
      if (!useGameStore.getState().captureMode) return;
      if (e.key === 'Escape') {
        stop(e); cancelTimer(); gesture = null;
        useGameStore.getState().setCaptureMode(false);
      } else if (['h', '?', '`', 'n', 'tab'].includes(e.key.toLowerCase())) {
        // Do not open an invisible modal or focus a hidden HUD control.
        stop(e);
      }
    };
    const blur = () => { cancelTimer(); gesture = null; swallow = false; };
    window.addEventListener('keydown', key, true);
    window.addEventListener('touchstart', start, { capture: true, passive: false });
    window.addEventListener('touchmove', move, { capture: true, passive: false });
    window.addEventListener('touchend', end, { capture: true, passive: false });
    window.addEventListener('touchcancel', end, { capture: true, passive: false });
    window.addEventListener('blur', blur);
    return () => {
      blur();
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('touchstart', start, true);
      window.removeEventListener('touchmove', move, true);
      window.removeEventListener('touchend', end, true);
      window.removeEventListener('touchcancel', end, true);
      window.removeEventListener('blur', blur);
    };
  }, []);
  return null;
}
