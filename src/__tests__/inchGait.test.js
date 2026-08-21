// The Inch Worm's gait. Two properties matter and neither held before:
//   1. humps scale with body length (one per wavelength) instead of one arch
//      stretched over the whole worm, and
//   2. every displacement is bounded, instead of growing with the segment index —
//      which is what made a long worm's tail whip whole tiles back and forth.
// The monotonicity test is load-bearing for the renderer, not cosmetic: the body's
// curve-walk marches forward through the path buffer and cannot step back.
import { describe, it, expect } from 'vitest';
import {
  inchGaitInto,
  inchHumpCount,
  INCH_BALL_SPACING,
  INCH_WAVELENGTH,
  INCH_SQUISH,
  INCH_ANCHOR_SEGMENTS
} from '../worm/healerWorm/inchGait.js';

const gait = (i, count, phase, move = 1) => {
  const out = { dist: 0, arch: 0 };
  inchGaitInto(out, i, count, phase, move);
  return out;
};

// Count arch peaks along the body — a peak is a segment whose arch beats both
// neighbours, which is what a player sees as one hump.
const countHumps = (count, phase) => {
  const arch = [];
  for (let i = 0; i < count; i++) arch.push(gait(i, count, phase).arch);
  let peaks = 0;
  for (let i = 1; i < count - 1; i++) {
    if (arch[i] > 0.02 && arch[i] >= arch[i - 1] && arch[i] > arch[i + 1]) peaks++;
  }
  return peaks;
};

describe('inch worm gait', () => {
  it('lays the body out flat at rest', () => {
    for (const count of [4, 40, 400]) {
      for (let i = 0; i < count; i += 7) {
        const g = gait(i, count, 3.7, 0);
        expect(g.dist).toBeCloseTo(i * INCH_BALL_SPACING, 10);
        expect(g.arch).toBe(0);
      }
    }
  });

  it('places segments in order, always — the curve walk cannot go backwards', () => {
    // Every phase, every length: dist must strictly increase with the segment index,
    // or the renderer's forward-only walk loses its bracket and the body tangles.
    for (const count of [4, 9, 60, 500]) {
      for (let p = 0; p < 24; p++) {
        const phase = p * 0.137;
        let prev = -Infinity;
        for (let i = 0; i < count; i++) {
          const d = gait(i, count, phase).dist;
          expect(d).toBeGreaterThan(prev);
          prev = d;
        }
      }
    }
    // The margin comes from the squish staying under 1/2π; pin that so a future
    // "make it squishier" tweak fails here rather than in the renderer.
    expect(INCH_SQUISH).toBeLessThan(1 / (2 * Math.PI));
  });

  it('keeps displacement bounded no matter how long the worm gets', () => {
    // The old gait scaled compression by the segment's own arc, so the tail of a
    // 400-segment worm slid ~10 world units per cycle. The cap is now a constant.
    const cap = INCH_WAVELENGTH * INCH_SQUISH;
    for (const count of [4, 100, 1200]) {
      for (let p = 0; p < 12; p++) {
        for (let i = 0; i < count; i += Math.max(1, Math.floor(count / 40))) {
          const slip = Math.abs(gait(i, count, p * 0.31).dist - i * INCH_BALL_SPACING);
          expect(slip).toBeLessThanOrEqual(cap + 1e-9);
        }
      }
    }
    expect(cap).toBeLessThan(INCH_BALL_SPACING);
  });

  it('grows more humps as the body grows', () => {
    // The whole point of the rework: a short worm inches with one hump, a long one
    // ripples with many, and the count rises monotonically with length.
    const counts = [4, 12, 24, 48, 96];
    const humps = counts.map((c) => countHumps(c, 0.21));
    for (let k = 1; k < humps.length; k++) {
      expect(humps[k]).toBeGreaterThan(humps[k - 1]);
    }
    expect(humps[0]).toBe(1);
    // One hump per wavelength of body, give or take the end taper.
    for (let k = 0; k < counts.length; k++) {
      expect(Math.abs(humps[k] - inchHumpCount(counts[k]))).toBeLessThanOrEqual(1);
    }
  });

  it('keeps each hump planted in world space while the body flows through it', () => {
    // A crest sits at (arc + phase) / wavelength = const, so advancing the head by
    // δ must move the crest δ closer to the head — leaving it exactly where it was
    // on the cube. That is what makes the worm push off the ground instead of
    // dragging a ripple along with it.
    const count = 200;
    const step = INCH_BALL_SPACING * 8; // one wavelength of crawl
    const arch0 = gait(100, count, 0).arch;
    const arch1 = gait(100 - 8, count, step).arch;
    expect(arch1).toBeCloseTo(arch0, 6);
  });

  it('anchors the head and the tail', () => {
    const count = 80;
    // Whatever the phase, the very ends never ride up as far as the middle can.
    for (let p = 0; p < 16; p++) {
      const phase = p * 0.19;
      expect(gait(0, count, phase).arch).toBe(0);
      expect(gait(count - 1, count, phase).arch).toBe(0);
    }
    // …and the taper is short, so the body just behind the head can still hump.
    let bestNearHead = 0;
    for (let p = 0; p < 40; p++) bestNearHead = Math.max(bestNearHead, gait(2, count, p * 0.07).arch);
    expect(bestNearHead).toBeGreaterThan(0.5);
    expect(INCH_ANCHOR_SEGMENTS).toBeLessThan(3);
  });

  it('never lifts a segment further than its own hump height allows', () => {
    for (const count of [4, 50, 600]) {
      for (let p = 0; p < 10; p++) {
        for (let i = 0; i < count; i += 3) {
          const a = gait(i, count, p * 0.41).arch;
          expect(a).toBeGreaterThanOrEqual(0);
          expect(a).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('degenerates safely on a one-ball worm', () => {
    expect(gait(0, 1, 2.5)).toEqual({ dist: 0, arch: 0 });
    expect(inchHumpCount(1)).toBe(0);
    expect(inchHumpCount(0)).toBe(0);
  });
});
