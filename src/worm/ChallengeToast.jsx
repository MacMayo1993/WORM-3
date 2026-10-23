// A free-play challenge completed mid-run (wormRunAchievements grew): its title and
// what it paid, with a chime. It used to be announced to screen readers only, so a
// sighted player learned of it from the next challenge quietly replacing it.
import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../hooks/useGameStore.js';
import { feel } from '../utils/feel.js';

const TOAST_MS = 2600;

export default function ChallengeToast() {
  const { runId, earned } = useGameStore(useShallow(s => ({ runId: s.wormRunId, earned: s.wormRunAchievements })));
  const previous = useRef({ runId, count: earned?.length ?? 0 });
  const [shown, setShown] = useState(null);
  useEffect(() => {
    const count = earned?.length ?? 0, old = previous.current;
    previous.current = { runId, count };
    if (old.runId !== runId || count <= old.count) return undefined;
    setShown(earned[count - 1]);
    feel('storyTask');
    return undefined;
  }, [runId, earned]);
  useEffect(() => {
    if (!shown) return undefined;
    const timer = setTimeout(() => setShown(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [shown]);
  if (!shown) return null;
  return (
    <div className="worm-challenge-toast" role="status">
      <span aria-hidden="true">✓</span>
      <div><small>Challenge complete</small><strong>{shown.title}</strong></div>
      <b>+{shown.reward} PP</b>
    </div>
  );
}
