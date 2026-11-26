import { useEffect } from 'react';
import { useGameStore, selectEffectiveFlipCap } from './useGameStore.js';
import { advanceFlipRun, flipSession } from '../game/flipRelapse.js';
import { selectCubeInputBlocked } from './uiSurfaces.js';
import { liveRotation } from '../worm/liveRotation.js';
import { feel } from '../utils/feel.js';

export function useParityDecay(paused = false) {
  const active = useGameStore(s => flipSession(s) && s.hasShuffled && !s.flipSessionMenu && !selectCubeInputBlocked(s));
  useEffect(() => {
    if (!active || paused) return;
    let last = performance.now();
    const rebase = () => { last = performance.now(); };
    const timer = setInterval(() => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      const state = useGameStore.getState();
      if (document.hidden || state.flipSessionMenu || selectCubeInputBlocked(state) || !state.hasShuffled || !flipSession(state)) return;
      const moving = state.animState || state.pendingMove || state.firstFlipHighlightPair || liveRotation.active;
      const updated = moving ? {} : advanceFlipRun(state, delta, selectEffectiveFlipCap(state));
      if (state.currentLevelData?.scoring === 'flips') {
        updated.flipActiveMs = state.flipActiveMs + delta;
        updated.gameTime = Math.floor(updated.flipActiveMs / 1000);
      }
      useGameStore.setState(updated);
      if (updated.cubies) feel('relapse');
    }, 200);
    document.addEventListener('visibilitychange', rebase);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', rebase); };
  }, [active, paused]);
}
