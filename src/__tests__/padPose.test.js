import { describe, it, expect } from 'vitest';
import { padPose, pairPhase, advancePadSpring, PAD_PROFILES } from '../3d/padPose.js';
import { padMotion, removePadMotion } from '../3d/padMotionBridge.js';

describe('pad motion', () => {
  it('keeps WORM idle pads above the clearance floor at every wear level', () => {
    for (let wear = 0; wear <= 1; wear += 0.25) {
      for (let phase = 0; phase < 25; phase += 0.01) {
        expect(padPose({ profile: 'worm', wear, phase, worn: true }).lift).toBeGreaterThanOrEqual(0.45);
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
