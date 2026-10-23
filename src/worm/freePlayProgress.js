// src/worm/freePlayProgress.js — what FreePlayProgress says (pure, tested).

/** What the chip says, from the run's phase and counts; null when it has nothing to say. */
export function freePlayProgress({ phase, turnsLeft, openPairs }) {
  if (phase === 'finalHealing') {
    if (openPairs <= 0) return null;
    return openPairs === 1 ? { kind: 'last', label: 'Last pair', value: 'Heal it!' }
      : { kind: 'final', label: 'Final heal', value: `${openPairs} pairs` };
  }
  if (phase === 'active' && Number.isFinite(turnsLeft)) {
    return { kind: 'turns', label: turnsLeft === 1 ? 'Last turn' : 'Turns left', value: String(turnsLeft) };
  }
  return null;
}
