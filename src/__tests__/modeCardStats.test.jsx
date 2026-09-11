// The mode card's two derived pieces: the chips (which carry a count that used
// to be stated from memory and was wrong) and the stat row (which must never
// claim a stat the game does not actually record).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// MainMenu pulls in the whole 3D menu; none of it is needed to test two pure
// functions, and troika's font preload does not survive jsdom.
vi.mock('troika-three-text', () => ({ preloadFont: () => {} }));
vi.mock('@fontsource/bungee/files/bungee-latin-400-normal.woff', () => ({ default: '' }));

import { modeStatItems, chipsFor } from '../components/menus/MainMenu.jsx';

const MODE = (id, chips = ['A', 'B']) => ({ id, chips });
const CTX = (over = {}) => ({
  plays: {},
  story: { completed: 0, total: 0, stars: 0 },
  points: 0,
  owned: 0,
  ...over,
});

describe('chipsFor', () => {
  it('derives STORY\'s chapter count from the level data', () => {
    // The description used to say "ten chapters" while the campaign had twelve.
    // Deriving it is what makes that class of drift impossible.
    const chips = chipsFor(MODE('cube', ['Campaign', 'Guided']), CTX({ story: { completed: 3, total: 12, stars: 7 } }));
    expect(chips).toEqual(['12 chapters', 'Guided']);
  });

  it('leaves the placeholder alone when the level data is unavailable', () => {
    expect(chipsFor(MODE('cube', ['Campaign', 'Guided']), CTX())).toEqual(['Campaign', 'Guided']);
  });

  it('passes every other mode through untouched', () => {
    const mode = MODE('worm', ['2×2 – Mega', 'Arcade']);
    expect(chipsFor(mode, CTX({ story: { completed: 3, total: 12, stars: 7 } }))).toBe(mode.chips);
  });

  it('tolerates a missing context', () => {
    const mode = MODE('cube', ['Campaign', 'Guided']);
    expect(chipsFor(mode, undefined)).toBe(mode.chips);
  });
});

describe('modeStatItems', () => {
  it('says nothing about a mode that has never been played', () => {
    // The point of the empty case: nothing per-mode is recorded anywhere in the
    // game except STORY's progress and the play count this menu keeps, so an
    // unplayed mode has no honest stat to show and must not invent zeroes.
    expect(modeStatItems(MODE('worm'), CTX())).toEqual([]);
    expect(modeStatItems(MODE('chaos'), CTX())).toEqual([]);
    expect(modeStatItems(MODE('random'), CTX())).toEqual([]);
  });

  it('reports STORY from campaign progress, not from the play count', () => {
    const items = modeStatItems(MODE('cube'), CTX({
      story: { completed: 3, total: 12, stars: 7 },
      plays: { cube: { plays: 99, lastPlayed: Date.now() } },
    }));
    expect(items).toEqual([
      { label: 'Chapters', value: '3/12' },
      { label: 'Stars', value: '7★' },
    ]);
  });

  it('shows STORY chapters even at zero, and drops the star line until one is earned', () => {
    const items = modeStatItems(MODE('cube'), CTX({ story: { completed: 0, total: 12, stars: 0 } }));
    expect(items).toEqual([{ label: 'Chapters', value: '0/12' }]);
  });

  it('reports STORE from the wallet and the collection', () => {
    const items = modeStatItems(MODE('store'), CTX({ points: 12500, owned: 8 }));
    expect(items[0]).toEqual({ label: 'Balance', value: '12,500 PP' });
    expect(items[1]).toEqual({ label: 'Owned', value: '8' });
  });

  it('shows a STORE balance of zero rather than hiding it', () => {
    const items = modeStatItems(MODE('store'), CTX({ points: 0, owned: 0 }));
    expect(items).toEqual([{ label: 'Balance', value: '0 PP' }]);
  });

  it('words a single play as "Once" rather than "1×"', () => {
    const items = modeStatItems(MODE('worm'), CTX({ plays: { worm: { plays: 1, lastPlayed: Date.now() } } }));
    expect(items[0]).toEqual({ label: 'Played', value: 'Once' });
  });

  it('counts repeat plays', () => {
    const items = modeStatItems(MODE('worm'), CTX({ plays: { worm: { plays: 12, lastPlayed: Date.now() } } }));
    expect(items[0]).toEqual({ label: 'Played', value: '12×' });
  });

  it('never returns more than two items', () => {
    for (const id of ['worm', 'cube', 'store', 'chaos', 'random', 'freeplay']) {
      const items = modeStatItems(MODE(id), CTX({
        story: { completed: 3, total: 12, stars: 7 },
        points: 500, owned: 4,
        plays: { [id]: { plays: 5, lastPlayed: Date.now() } },
      }));
      expect(items.length).toBeLessThanOrEqual(2);
    }
  });
});

describe('last-played wording', () => {
  const DAY = 86400000;
  const NOW = new Date('2026-06-15T12:00:00Z').getTime();
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => { vi.useRealTimers(); });

  const lastFor = (ago) => modeStatItems(
    MODE('worm'),
    CTX({ plays: { worm: { plays: 3, lastPlayed: NOW - ago } } })
  )[1];

  it('names the recent days', () => {
    expect(lastFor(0)).toEqual({ label: 'Last', value: 'Today' });
    expect(lastFor(DAY)).toEqual({ label: 'Last', value: 'Yesterday' });
    expect(lastFor(3 * DAY)).toEqual({ label: 'Last', value: '3d ago' });
  });

  it('rolls up to weeks, then stops counting', () => {
    expect(lastFor(14 * DAY)).toEqual({ label: 'Last', value: '2w ago' });
    expect(lastFor(400 * DAY)).toEqual({ label: 'Last', value: 'A while ago' });
  });

  it('does not say "-3d ago" when the clock has moved backwards', () => {
    // A timestamp from the future is a device whose clock was corrected, not a
    // play that has not happened yet.
    expect(lastFor(-3 * DAY)).toEqual({ label: 'Last', value: 'Today' });
  });

  it('omits the line for a play with no recorded timestamp', () => {
    const items = modeStatItems(MODE('worm'), CTX({ plays: { worm: { plays: 4, lastPlayed: 0 } } }));
    expect(items).toEqual([{ label: 'Played', value: '4×' }]);
  });
});
