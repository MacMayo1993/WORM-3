// src/worm/runBests.js
//
// What the result cards show of a run's personal bests (progression/wormBests.js,
// recorded by recordWormRunBests at the run's end): which numbers beat an earlier
// record, and one chime when a card opens over such a run.
import { useEffect } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { feel } from '../utils/feel.js';

const NONE = [];

/** The metrics ('orbs', 'heals', 'chain', 'time') the live run beat a record on. */
export function useRunBestsBeaten() {
  return useGameStore(s => (s.wormRunBests && s.wormRunBests.runId === s.wormRunId ? s.wormRunBests.beaten : NONE));
}

/** One chime as the card settles, when the run set at least one new best. */
export function useNewBestChime(beaten, delay = 450) {
  useEffect(() => {
    if (!beaten.length) return undefined;
    const timer = setTimeout(() => feel('storyStar', { combo: 2 }), delay);
    return () => clearTimeout(timer);
  }, [beaten, delay]);
}
