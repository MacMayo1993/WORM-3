// Free play's live progress, hung under the top dock opposite the orb chain:
// the slice turns still to come, then, once they run out, the pairs left to heal.
// The number pops whenever it moves, the switch to the final heal is called out
// with a chime, and the last pair says so. Story, the demo and combat have their
// own objectives and never show it. In the final heal it also says which way the
// nearest pair is (the guide, guideTargets.js).
import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../hooks/useGameStore.js';
import { feel } from '../utils/feel.js';
import { freePlayProgress } from './freePlayProgress.js';
import { wormBuffs } from './wormBuffs.js';
import { guideWords } from './healerWorm/guideTargets.js';

const TURN_ANGLE = { ahead: 0, right: 90, behind: 180, left: -90 };

// The guide's turn and distance under the pair count. It changes every tile, so it
// sits outside the chip's live region; the words are there for a reader to find.
function GuideHeading() {
  const [goal, setGoal] = useState(null);
  useEffect(() => {
    let key = '';
    const read = () => {
      const guide = wormBuffs.guide;
      const next = guide?.final ? `${guide.kind}|${guide.turn}|${guide.steps}` : '';
      if (next === key) return;
      key = next;
      setGoal(guide?.final ? { kind: guide.kind, turn: guide.turn, steps: guide.steps } : null);
    };
    read();
    const id = setInterval(read, 150);
    return () => clearInterval(id);
  }, []);
  const words = guideWords(goal);
  if (!words) return null;
  return (
    <span className="worm-progress-guide" data-turn={goal.turn} aria-live="off">
      <svg viewBox="0 0 16 16" aria-hidden="true" style={{ transform: `rotate(${TURN_ANGLE[goal.turn] ?? 0}deg)` }}>
        <path d="M8 2 14 9h-4v5H6V9H2Z" />
      </svg>
      <span aria-hidden="true">{words.turn} · {words.tiles}</span>
      <span className="worm-progress-guide-label">{words.label}</span>
    </span>
  );
}

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
      {progress.kind !== 'turns' && <GuideHeading />}
    </div>
  );
}
