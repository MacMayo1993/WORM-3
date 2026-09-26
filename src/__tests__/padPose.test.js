import { describe, it, expect } from 'vitest';
import { padPose, pairPhase, advancePadSpring, advancePieceSpring, PAD_PROFILES, WORN_EASE } from '../3d/padPose.js';
import { padMotion, removePadMotion } from '../3d/padMotionBridge.js';
import { WORM_PAD_HEIGHT } from '../game/raisedCubie.js';
import { WORM_LIFT } from '../worm/healerWorm/constants.js';
import { BOOK_HEAD_RADIUS } from '../worm/wormBookFX.js';

describe('pad motion', () => {
  it("hovers WORM pads low but still clear of the worm's head at every wear level", () => {
    // A tenth of a tile of headroom over the head for the crawl underneath.
    expect(WORM_PAD_HEIGHT).toBeGreaterThanOrEqual(WORM_LIFT + BOOK_HEAD_RADIUS + 0.1);
    expect(WORM_PAD_HEIGHT).toBeLessThanOrEqual(0.35);
    expect(PAD_PROFILES.worm.height).toBe(WORM_PAD_HEIGHT);
    for (let wear = 0; wear <= 1; wear += 0.25) {
      for (let phase = 0; phase < 25; phase += 0.01) {
        expect(padPose({ profile: 'worm', wear, phase, worn: true }).lift).toBeGreaterThanOrEqual(WORM_PAD_HEIGHT);
      }
    }
  });
  it('makes reduced motion static for all profiles and wear levels', () => {
    for (const profile of Object.keys(PAD_PROFILES)) {
      for (const phase of [0, 0.3, 0.75, 12.2]) {
        const pose = padPose({ profile, wear: 1, worn: true, phase, reducedMotion: true });
        expect(pose.lift).toBe(PAD_PROFILES[profile].height);
        expect(pose.impact).toBe(0);
      }
    }
  });
  it('shares deterministic phases and grows amplitude/frequency with wear', () => {
    expect(pairPhase('M1-001|M4-001')).toBe(pairPhase('M1-001|M4-001'));
    const fresh = padPose({ phase: 0.5, wear: 0 });
    const worn = padPose({ phase: 0.5, wear: 1 });
    expect(worn.lift).toBeGreaterThan(fresh.lift);
    expect(worn.frequency).toBeGreaterThan(fresh.frequency);
    expect(padPose({ phase: 0.5, subtle: true }).lift - 0.3).toBeCloseTo((fresh.lift - 0.3) / 2);
  });
  it('settles safely after a hitch and returns home without a residual offset', () => {
    const spring = { lift: 0, velocity: 0 };
    advancePadSpring(spring, 0.3, 10);
    expect(spring.lift).toBeGreaterThan(0);
    expect(spring.lift).toBeLessThan(0.5);
    for (let i = 0; i < 240; i++) advancePadSpring(spring, 0, 1 / 60);
    expect(spring).toEqual({ lift: 0, velocity: 0 });
  });
  it('does not remove a replacement scene pose during stale cleanup', () => {
    const old = {}, replacement = {};
    padMotion.set('pair', replacement);
    removePadMotion('pair', old);
    expect(padMotion.get('pair')).toBe(replacement);
    removePadMotion('pair', replacement);
    expect(padMotion.has('pair')).toBe(false);
  });
});

describe('worn pads', () => {
  const apexes = (worn, seed = 7, hops = 24) => Array.from({ length: hops }, (_, hop) => {
    let top = 0;
    for (let step = 0; step <= 200; step++) top = Math.max(top, padPose({ phase: hop + step / 200, wear: 0.9, worn, seed }).lift);
    return top;
  });
  it('reproduces the steady pose exactly at zero worn weight', () => {
    for (const phase of [0.1, 0.5, 3.3, 17.8]) {
      const steady = padPose({ phase, wear: 0.5 });
      const eased = padPose({ phase, wear: 0.5, worn: 0, seed: 12345 });
      expect(eased.lift).toBe(steady.lift);
      expect(eased.cycle).toBe(steady.cycle);
    }
  });
  it('stays between the hover height and the steady apex on every profile', () => {
    for (const [profile, p] of Object.entries(PAD_PROFILES)) {
      for (let phase = 0; phase < 40; phase += 0.013) {
        const { lift } = padPose({ profile, phase, wear: 1, worn: true, seed: 99 });
        expect(lift).toBeGreaterThanOrEqual(p.height);
        expect(lift).toBeLessThanOrEqual(p.height + p.amplitude + p.wearAmplitude + 1e-12);
      }
    }
  });
  it('makes hops uneven where a steady pad repeats exactly', () => {
    const steady = apexes(false);
    expect(Math.max(...steady) - Math.min(...steady)).toBeLessThan(1e-9);
    const worn = apexes(true);
    const amplitude = PAD_PROFILES.cube.amplitude + PAD_PROFILES.cube.wearAmplitude * 0.9;
    expect(Math.max(...worn) - Math.min(...worn)).toBeGreaterThan(0.2 * amplitude);
    expect(new Set(worn.map(v => v.toFixed(4))).size).toBeGreaterThan(5);
  });
  it('gives twins one pose and different pairs different hops', () => {
    expect(padPose({ phase: 5.3, wear: 0.9, worn: true, seed: 11 })).toEqual(padPose({ phase: 5.3, wear: 0.9, worn: true, seed: 11 }));
    const a = apexes(true, 1), b = apexes(true, 2);
    expect(a.some((top, hop) => Math.abs(top - b[hop]) > 0.01)).toBe(true);
  });
  it('never runs the beat backwards, even while easing across the threshold', () => {
    // Menu pads have the slowest base rate, the tightest case for the drift.
    let phase = 0.37, worn = 0, previous = -Infinity;
    const pose = {}, dt = 1 / 60;
    for (let frame = 0; frame < 60 * 20; frame++) {
      const target = frame < 600 ? 1 : 0;
      worn += Math.max(-dt * WORN_EASE, Math.min(dt * WORN_EASE, target - worn));
      padPose({ profile: 'menu', phase, wear: 0, worn, seed: 3 }, pose);
      expect(pose.beat).toBeGreaterThan(previous);
      previous = pose.beat;
      phase += dt * pose.frequency;
    }
  });
});

describe('whole-piece spring', () => {
  const peakAt = (advance, fps) => {
    const spring = { lift: 0, velocity: 0 };
    let peak = 0;
    for (let frame = 0; frame < fps * 2; frame++) peak = Math.max(peak, advance(spring, 1, 1 / fps).lift);
    return peak;
  };
  it('bounces a piece out past Explode by about a fifth, the same at any frame rate', () => {
    const peaks = [30, 60, 144].map(fps => peakAt(advancePieceSpring, fps));
    for (const peak of peaks) {
      expect(peak).toBeGreaterThan(1.15);
      expect(peak).toBeLessThan(1.3);
    }
    expect(Math.max(...peaks) - Math.min(...peaks)).toBeLessThan(0.01);
    // Pads keep the stiffer press spring.
    expect(peakAt(advancePadSpring, 60)).toBeLessThan(1.07);
  });
  it('brings a returning piece to rest exactly', () => {
    const spring = { lift: 1, velocity: 0 };
    for (let frame = 0; frame < 60 * 3; frame++) advancePieceSpring(spring, 0, 1 / 60);
    expect(spring).toEqual({ lift: 0, velocity: 0 });
  });
});

