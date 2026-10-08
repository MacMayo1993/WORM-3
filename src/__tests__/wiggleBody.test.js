import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { WIGGLE_AMPLITUDE, WIGGLE_MAX_GAP, WIGGLE_RATE, WIGGLE_WAVE_NUMBER, limitWiggleGap, wiggleBodyOffset, wiggleBodySlope } from '../worm/wiggleBody.js';
import { BODY_BALL_SPACING } from '../worm/healerWorm/constants.js';

describe('Wiggle body wave', () => {
  it('keeps the head on its path and builds the wave over the first few beads', () => {
    for (const t of [0, 0.37, 1.9]) {
      expect(Math.abs(wiggleBodyOffset(0, t))).toBe(0);
      expect(Math.abs(wiggleBodySlope(0, t))).toBe(0);
    }
    let reach = 0;
    for (let i = 0; i <= 3; i++) {
      reach = Math.max(reach, ...Array.from({ length: 64 }, (_, k) => Math.abs(wiggleBodyOffset(i * BODY_BALL_SPACING, k * 0.1))));
    }
    expect(reach).toBeLessThan(WIGGLE_AMPLITUDE);   // still easing in
    expect(reach).toBeGreaterThan(0.02);            // but the neck does move
  });

  it('swings more than the Classic worm (0.08) and well past a bead radius', () => {
    let peak = 0;
    for (let d = 0; d < 4; d += 0.01) for (let t = 0; t < 2; t += 0.02) peak = Math.max(peak, Math.abs(wiggleBodyOffset(d, t)));
    expect(peak).toBeGreaterThan(0.1);
    expect(peak).toBeLessThanOrEqual(WIGGLE_AMPLITUDE + 1e-9);
  });

  it('keeps the bend gentle enough that neighbouring beads stay linked', () => {
    // A bead pair on a slope s sits sqrt(1 + s^2) apart; the body's connected-chain tests cap that.
    const steepest = WIGGLE_AMPLITUDE * WIGGLE_WAVE_NUMBER;
    expect(BODY_BALL_SPACING * Math.sqrt(1 + steepest * steepest)).toBeLessThan(WIGGLE_MAX_GAP);
  });

  it('reports the true slope of the offset, so beads can point along the wave', () => {
    for (const t of [0, 0.4, 1.7]) for (let d = 0.02; d < 3; d += 0.037) {
      const h = 1e-6;
      const numeric = (wiggleBodyOffset(d + h, t) - wiggleBodyOffset(d - h, t)) / (2 * h);
      expect(wiggleBodySlope(d, t)).toBeCloseTo(numeric, 5);
    }
  });

  it('travels down the body from the head, as a wave of undulation', () => {
    // A crest at distance d at time t is found further down the body a moment later.
    const dt = 0.05;
    const crest = (t, from) => { let best = from, top = -Infinity; for (let d = from; d < from + 0.5; d += 0.002) { const v = wiggleBodyOffset(d, t); if (v > top) { top = v; best = d; } } return best; };
    const first = crest(0, 1.0);
    const later = crest(dt, first - 0.1);
    expect(later - first).toBeCloseTo(WIGGLE_RATE / WIGGLE_WAVE_NUMBER * dt, 1);
    expect(later).toBeGreaterThan(first);
  });

  it('draws a stretched bead back toward the one ahead of it, and leaves the rest alone', () => {
    const ahead = new Vector3(0, 0, 0);
    const near = new Vector3(0.11, 0.02, 0);
    expect(limitWiggleGap(near, ahead).toArray()).toEqual([0.11, 0.02, 0]);
    const far = limitWiggleGap(new Vector3(0.3, 0.1, 0.05), ahead);
    expect(far.distanceTo(ahead)).toBeCloseTo(WIGGLE_MAX_GAP, 9);
    expect(far.clone().normalize().dot(new Vector3(0.3, 0.1, 0.05).normalize())).toBeCloseTo(1, 12);   // pulled in along the line, not sideways
  });
});
