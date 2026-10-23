// Free play's live progress, hung under the top dock opposite the orb chain:
// the slice turns still to come, then, once they run out, the pairs left to heal.
// The number pops whenever it moves, the switch to the final heal is called out
// with a chime, and the last pair says so. Story, the demo and combat have their
// own objectives and never show it.
import React, { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../hooks/useGameStore.js';
import { feel } from '../utils/feel.js';
import { freePlayProgress } from './freePlayProgress.js';

export default function FreePlayProgress() {
  const s = useGameStore(useShallow(st => ({
    phase: st.wormGamePhase, turnsLeft: st.wormTurnsLeft, openPairs: st.wormOpenPairs ?? 0,
    shown: st.wormHealerMode && st.wormAlive && !st.wormStoryLevel && !st.demoMode && !st.wormCombatMode,
  })));
  const progress = s.shown ? freePlayProgress(s) : null;
  const kind = progress?.kind ?? null, value = progress?.value ?? null;
  const ref = useRef(null);
  const last = useRef({ kind: null, value: null });
  useEffect(() => {
    const el = ref.current, prev = last.current;
    last.current = { kind, value };
    if (!el || !kind || (prev.kind === kind && prev.value === value)) return;
    // The final heal and the last pair are announced; every other change just pops.
    if (prev.kind && prev.kind !== kind && kind !== 'turns') feel('storyTask');
    el.classList.remove('is-popping');
    void el.offsetWidth;
    el.classList.add('is-popping');
  }, [kind, value]);
  if (!progress) return null;
  return (
    <div ref={ref} className="worm-progress-chip" data-kind={progress.kind} role="status" aria-live="polite">
      <small>{progress.label}</small>
      <strong>{progress.value}</strong>
    </div>
  );
}
