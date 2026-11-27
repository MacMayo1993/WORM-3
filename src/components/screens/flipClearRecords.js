// src/components/screens/flipClearRecords.js
// The Flip Cube clear card's records row and next-star line: what this clear
// changed against the saved best, in a few short chips, then what the next star
// asks for. Pure, so the card and its tests read the same words.

const flipsWord = n => `${n} ${n === 1 ? 'flip' : 'flips'}`;

/**
 * Chips for a clear. `previous` is the level's saved stats from before this run
 * (null on a first clear): { stars, bestFlips, bestFlipTime }.
 */
export function flipClearRecords({ previous, stars, flips, newBest, relapses }) {
  const chips = [];
  const before = previous?.stars ?? 0;
  if (!before) chips.push({ id: 'first', tone: 'gold', label: 'First clear' });
  else if (stars > before) chips.push({ id: 'stars', tone: 'gold', label: `${'★'.repeat(before)} → ${'★'.repeat(stars)}` });
  if (before && newBest && previous?.bestFlips != null) {
    chips.push({ id: 'best', tone: 'green', label: flips < previous.bestFlips ? `New best · was ${flipsWord(previous.bestFlips)}` : 'New best time' });
  } else if (before && previous?.bestFlips != null) {
    chips.push({ id: 'best', tone: 'plain', label: `Best ${flipsWord(previous.bestFlips)}` });
  }
  if (relapses > 0) chips.push({ id: 'relapses', tone: 'plain', label: `Survived ${relapses} ${relapses === 1 ? 'relapse' : 'relapses'}` });
  return chips;
}

/** The line under the chips: the next star's flip count, or how far under target. */
export function nextStarLine(next, target, flips) {
  if (!next) {
    if (flips < target) return `Beat the target by ${flipsWord(target - flips)}.`;
    return target === 0 ? 'No flips at all. Perfect.' : 'Three stars. Now beat your time.';
  }
  const stars = '★'.repeat(next.stars);
  return next.flips === 0 ? `${stars}: solve it with no flips at all.` : `${stars}: solve it in ${flipsWord(next.flips)} or fewer.`;
}
