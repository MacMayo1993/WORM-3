// A skill moment called out over the cube (skillMoments.js): a word that punches
// in above the worm and is gone in about a second. Taken out of the store as it
// shows, so a remount never replays it; a new moment replaces the one on screen.
// The key comes from this component's own count, not the store: the store value
// is cleared on every show, so a sequence carried in it restarts at 1 and a
// replacement would reuse the element on screen without restarting its animation.
import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { SKILL_CALLOUTS } from './healerWorm/skillMoments.js';

const CALLOUT_MS = 1100;

export default function SkillCallout() {
  const callout = useGameStore(s => s.wormSkillCallout);
  const [shown, setShown] = useState(null);
  const seq = useRef(0);
  useEffect(() => {
    if (!callout) return;
    seq.current += 1;
    setShown({ kind: callout.kind, seq: seq.current });
    useGameStore.setState({ wormSkillCallout: null });
  }, [callout]);
  useEffect(() => {
    if (!shown) return undefined;
    const timer = setTimeout(() => setShown(null), CALLOUT_MS);
    return () => clearTimeout(timer);
  }, [shown]);
  const label = shown && SKILL_CALLOUTS[shown.kind];
  if (!label) return null;
  return <div key={shown.seq} className="worm-skill-callout" data-kind={shown.kind} role="status" aria-live="polite">{label}</div>;
}
