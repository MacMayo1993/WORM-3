import { describe, it, expect } from 'vitest';
import {
  blinkCountForFlips,
  blinkFlipRate,
  blinkPhase,
  blinkBounce,
  BLINK_MAX,
  BLINK_BASE_DUR,
  BLINK_EXTRA_DUR,
  BLINK_BOUNCE_MAX,
  BLINK_BOUNCE_PER_FLIP
} from '../3d/parityBlink.js';

describe('blinkCountForFlips', () => {
  it('blinks once per flip the tile is carrying', () => {
    expect(blinkCountForFlips(1, true)).toBe(1);
    expect(blinkCountForFlips(2, true)).toBe(2);
    expect(blinkCountForFlips(3, true)).toBe(3);
  });

  it('never blinks fewer times as flips grow', () => {
    let prev = 0;
    for (let flips = 1; flips <= 12; flips++) {
      const n = blinkCountForFlips(flips, true);
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
  });

  it('caps the burst so a damaged tile cannot stall the board', () => {
    expect(blinkCountForFlips(99, true)).toBe(BLINK_MAX);
  });

  it('leaves non-parity flips at the single original beat', () => {
    expect(blinkCountForFlips(5, false)).toBe(1);
  });

  it('never returns zero blinks for a degenerate flip count', () => {
    expect(blinkCountForFlips(0, true)).toBe(1);
  });
});

describe('blinkFlipRate', () => {
  it('keeps a single blink at the original 0.5 s flip', () => {
    expect(blinkFlipRate(1)).toBeCloseTo(1 / BLINK_BASE_DUR);
  });

  it('stretches the timer so extra blinks fit, each quicker than the first', () => {
    const dur = (n) => 1 / blinkFlipRate(n);
    expect(dur(3)).toBeCloseTo(BLINK_BASE_DUR + 2 * BLINK_EXTRA_DUR);
    // Three blinks take less than three full-length flips.
    expect(dur(3)).toBeLessThan(3 * BLINK_BASE_DUR);
  });
});

describe('blinkPhase', () => {
  it('is a pass-through for a single-blink flip', () => {
    for (const rawP of [0, 0.25, 0.5, 0.9, 1]) {
      const { blinkIdx, p } = blinkPhase(rawP, 1);
      expect(blinkIdx).toBe(0);
      expect(p).toBeCloseTo(rawP);
    }
  });

  it('replays a full 0→1 squish once per blink', () => {
    expect(blinkPhase(0.1, 3)).toMatchObject({ blinkIdx: 0 });
    expect(blinkPhase(0.1, 3).p).toBeCloseTo(0.3);
    expect(blinkPhase(0.5, 3)).toMatchObject({ blinkIdx: 1 });
    expect(blinkPhase(0.5, 3).p).toBeCloseTo(0.5);
    expect(blinkPhase(0.9, 3)).toMatchObject({ blinkIdx: 2 });
    expect(blinkPhase(0.9, 3).p).toBeCloseTo(0.7);
  });

  it('crosses the seam once per blink over the whole flip', () => {
    const blinks = 4;
    let crossings = 0;
    let prev = 0;
    for (let i = 1; i <= 400; i++) {
      const { p } = blinkPhase(i / 400, blinks);
      if (prev < 0.5 && p >= 0.5) crossings++;
      prev = p;
    }
    expect(crossings).toBe(blinks);
  });

  it('ends the last blink fully open rather than wrapping past it', () => {
    const { blinkIdx, p } = blinkPhase(1, 5);
    expect(blinkIdx).toBe(4);
    expect(p).toBeCloseTo(1);
  });
});

describe('blinkBounce', () => {
  it('starts and ends flush with the cube face', () => {
    expect(blinkBounce(0, 3)).toBeCloseTo(0);
    expect(blinkBounce(1, 3)).toBeCloseTo(0);
  });

  it('peaks with the lids shut', () => {
    const mid = blinkBounce(0.5, 3);
    expect(mid).toBeGreaterThan(blinkBounce(0.25, 3));
    expect(mid).toBeGreaterThan(blinkBounce(0.75, 3));
  });

  it('reaches further out of the cube for every extra flip', () => {
    for (let flips = 1; flips < 5; flips++) {
      expect(blinkBounce(0.5, flips + 1)).toBeGreaterThan(blinkBounce(0.5, flips));
    }
    expect(blinkBounce(0.5, 1)).toBeCloseTo(BLINK_BOUNCE_PER_FLIP);
  });

  it('stays a small nudge — never launches the tile off the cube', () => {
    expect(blinkBounce(0.5, 99)).toBeLessThanOrEqual(BLINK_BOUNCE_MAX);
  });

  it('eases off over the blinks of one burst', () => {
    expect(blinkBounce(0.5, 5, 1)).toBeLessThan(blinkBounce(0.5, 5, 0));
    expect(blinkBounce(0.5, 5, 4)).toBeGreaterThan(0);
  });
});
