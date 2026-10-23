// A skill moment called out over the cube (skillMoments.js): a word that punches
// in above the worm and is gone in about a second. Taken out of the store as it
// shows, so a remount never replays it; a new moment replaces the one on screen.
import React, { useEffect, useState } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { SKILL_CALLOUTS } from './healerWorm/skillMoments.js';

const CALLOUT_MS = 1100;

export default function SkillCallout() {
  const callout = useGameStore(s => s.wormSkillCallout);
  const [shown, setShown] = useState(null);
  useEffect(() => {
    if (!callout) return;
    setShown(callout);
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
