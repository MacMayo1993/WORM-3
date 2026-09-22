import { describe, it, expect } from 'vitest';
import { chaosFlipPose, CHAOS_FLIP_DURATION } from '../3d/chaosFlipPose.js';

describe('Chaos flip surface', () => {
  it('stays inside the tile footprint and never sinks into the chassis', () => {
    for (let i = 0; i <= 1000; i++) {
      const pose = chaosFlipPose(i / 1000);
      expect(pose.mainScale).toBeGreaterThan(0);
      expect(pose.mainScale).toBeLessThanOrEqual(1);
      expect(pose.crossScale).toBeLessThanOrEqual(1);
      expect(pose.bounce).toBeGreaterThanOrEqual(0);
      expect(pose.bounce).toBeLessThanOrEqual(0.045);
    }
  });

  it('conceals the color swap even at the largest allowed animation step', () => {
    const maxStep = 0.035 / CHAOS_FLIP_DURATION;
    // Any step that crosses 0.5 lands in the closed part of the motion.
    for (let p = 0.5; p <= 0.5 + maxStep; p += 0.001) {
      expect(chaosFlipPose(p).mainScale).toBe(0.001);
      expect(chaosFlipPose(p).flipSquish).toBe(0);
    }
  });

  it('starts and finishes at full size without a final-frame jump', () => {
    for (const p of [0, 1]) {
      expect(chaosFlipPose(p).mainScale).toBeCloseTo(1);
      expect(chaosFlipPose(p).crossScale).toBe(1);
      expect(chaosFlipPose(p).bounce).toBeCloseTo(0);
    }
    expect(chaosFlipPose(0.999).mainScale).toBeGreaterThan(0.999);
  });
});
