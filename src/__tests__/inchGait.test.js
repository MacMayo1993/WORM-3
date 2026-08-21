// The Inch Worm's gait. It has to read as inching: a tall localized loop that
// stays put on the ground while the body pours through it, with flat body either
// side of it — not a shimmer, not one balloon over the whole worm, and never an
// amplitude that grows with body length (which is what used to whip a long tail
// around whole tiles at a time).
//
// The monotonicity test is load-bearing, not cosmetic: the renderer's curve walk
// marches forward through the path buffer and cannot step back.
import { describe, it, expect } from 'vitest';
import {
  inchGaitInto,
  inchLoopShape,
  inchHumpCount,
  INCH_BALL_SPACING,
  INCH_GATHER,
  INCH_MAX_HUMP,
  INCH_JUMP_FRACTION,
  INCH_SKEW
} from '../worm/healerWorm/inchGait.js';
import { SURFACE_JUMP_HEIGHT } from '../worm/healerWorm/constants.js';

const gait = (i, count, phase, move = 1) => {
  const out = { dist: 0, arch: 0 };
  inchGaitInto(out, i, count, phase, move, inchLoopShape(count));
  return out;
};

const archProfile = (count, phase) => {
  const a = [];
  for (let i = 0; i < count; i++) a.push(gait(i, count, phase).arch);
  return a;
};

// A loop the player can see: a run of lifted body with a single peak in it.
const countLoops = (count, phase) => {
  const a = archProfile(count, phase);
  let loops = 0;
  for (let i = 1; i < count - 1; i++) {
    if (a[i] > 0.05 && a[i] >= a[i - 1] && a[i] > a[i + 1]) loops++;
  }
  return loops;
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
    for (const count of [4, 9, 60, 500]) {
      for (let p = 0; p < 40; p++) {
        const phase = p * 0.0973;
        let prev = -Infinity;
        for (let i = 0; i < count; i++) {
          const d = gait(i, count, phase).dist;
          expect(d).toBeGreaterThan(prev);
          prev = d;
        }
      }
    }
    // The margin comes from the gather staying under 1/π; pin it so a future
    // "make it scrunch harder" tweak fails here rather than in the renderer.
    expect(INCH_GATHER).toBeLessThan(1 / Math.PI);
  });

  it('rears three quarters of the jump, once the body can make an arch that tall', () => {
    expect(INCH_MAX_HUMP).toBeCloseTo(SURFACE_JUMP_HEIGHT * 0.75, 10);
    expect(INCH_JUMP_FRACTION).toBe(0.75);
    // A long worm gets the full rear-up...
    expect(inchLoopShape(400).height).toBeCloseTo(INCH_MAX_HUMP, 10);
    // ...a short one rears in proportion to the body it has, rather than firing a
    // lone bead a whole tile into the air with nothing to arch from.
    const small = inchLoopShape(4);
    expect(small.height).toBeGreaterThan(0);
    expect(small.height).toBeLessThan(small.bodyArc);
    // Height grows with length and never overshoots the cap.
    let prev = 0;
    for (const count of [4, 12, 40, 120, 400]) {
      const h = inchLoopShape(count).height;
      expect(h).toBeGreaterThanOrEqual(prev);
      expect(h).toBeLessThanOrEqual(INCH_MAX_HUMP + 1e-9);
      prev = h;
    }
  });

  it('keeps flat body between loops — the loop is only legible against straight worm', () => {
    // A sine along the body left every segment mid-hump at all times, which read
    // as a shimmer rather than an inch. Most of a long body should be down.
    const count = 400;
    let flat = 0;
    const a = archProfile(count, 0.37);
    for (const v of a) if (v === 0) flat++;
    expect(flat / count).toBeGreaterThan(0.3);
  });

  it('grows more loops as the body grows', () => {
    const counts = [40, 120, 400, 800];
    const loops = counts.map((c) => countLoops(c, 0.21));
    for (let k = 1; k < loops.length; k++) {
      expect(loops[k]).toBeGreaterThan(loops[k - 1]);
    }
    for (let k = 0; k < counts.length; k++) {
      expect(Math.abs(loops[k] - inchHumpCount(counts[k]))).toBeLessThanOrEqual(1);
    }
    // A fresh worm still inches — one loop passes over it at a time.
    let sawALoop = false;
    for (let p = 0; p < 60; p++) if (countLoops(8, p * 0.05) >= 1) sawALoop = true;
    expect(sawALoop).toBe(true);
  });

  it('keeps each loop planted while the body pours through it', () => {
    // The chain-fountain property: advancing the head by δ must move the crest δ
    // closer to the head, leaving it exactly where it was on the cube. That is
    // what makes the worm push off the ground instead of dragging a ripple along.
    const count = 400;
    const steps = 8;
    const delta = steps * INCH_BALL_SPACING;
    for (const i of [80, 150, 260]) {
      expect(gait(i - steps, count, delta).arch).toBeCloseTo(gait(i, count, 0).arch, 6);
    }
  });

  it('rears up gently and tips over forward', () => {
    // Asymmetry is the push: the trailing face of the loop is longer than the
    // leading one, so a bead climbs slowly and is thrown off the front.
    expect(INCH_SKEW).toBeGreaterThan(0);
    const count = 400;
    const shape = inchLoopShape(count);
    // Find a crest, then compare how far the lift reaches either side of it.
    let crest = -1;
    let best = 0;
    const a = archProfile(count, 0);
    for (let i = 1; i < count - 1; i++) {
      if (a[i] > best) { best = a[i]; crest = i; }
    }
    expect(crest).toBeGreaterThan(0);
    let behind = 0;
    let ahead = 0;
    for (let i = crest; i < count && a[i] > 0.02; i++) behind++;
    for (let i = crest; i >= 0 && a[i] > 0.02; i--) ahead++;
    expect(behind).toBeGreaterThan(ahead);
    expect(shape.halfWidth).toBeGreaterThan(0);
  });

  it('bounds the accordion no matter how long the worm gets', () => {
    // The old gait scaled compression by the segment's own arc, so the tail of a
    // 400-segment worm slid ~10 world units per cycle.
    for (const count of [4, 100, 1200]) {
      const cap = INCH_GATHER * inchLoopShape(count).spacing * 0.5;
      for (let p = 0; p < 12; p++) {
        for (let i = 0; i < count; i += Math.max(1, Math.floor(count / 40))) {
          const slip = Math.abs(gait(i, count, p * 0.31).dist - i * INCH_BALL_SPACING);
          expect(slip).toBeLessThanOrEqual(cap + 1e-9);
        }
      }
    }
  });

  it('anchors the head and the tail', () => {
    const count = 400;
    for (let p = 0; p < 16; p++) {
      const phase = p * 0.19;
      expect(gait(0, count, phase).arch).toBe(0);
      expect(gait(count - 1, count, phase).arch).toBe(0);
    }
  });

  it('never returns an arch outside 0..1', () => {
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
