import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { INTRO_END, sampleIntro, passagePoint, introCameraDistance } from '../components/intro/introChoreography.js';

// These protect animation failure modes: discontinuous cuts, clipped framing,
// mistaken antipodes, and a supposedly reduced-motion path that still moves.
describe('opening cinematic choreography', () => {
  it('uses exact antipodal endpoints at every explosion extent', () => {
    for (const extent of [1.51, 2, 3.01]) {
      const a = passagePoint(0, extent, new Vector3());
      const b = passagePoint(1, extent, new Vector3());
      expect(a.add(b).length()).toBeLessThan(1e-12);
    }
  });
  it('keeps the worm clear of the remaining cubies during its passage', () => {
    for (let i = 0; i <= 100; i++) {
      const t = 11 + 1.3 * i / 100;
      const pose = sampleIntro(t);
      const spacing = 1 + 1.5 * pose.open;
      const p = passagePoint(pose.worm, spacing + 0.51, new Vector3());
      for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
        if (!x && !y) continue; // Core and the open center pair.
        const dx = Math.max(0, Math.abs(p.x - x * spacing) - 0.55);
        const dy = Math.max(0, Math.abs(p.y - y * spacing) - 0.55);
        const dz = Math.max(0, Math.abs(p.z - z * spacing) - 0.55);
        expect(Math.hypot(dx, dy, dz)).toBeGreaterThan(0.15);
      }
    }
  });
  it('has no jumps at camera or animation beat boundaries', () => {
    for (const t of [0.6, 2.8, 3.2, 6.2, 6.5, 8.2, 8.7, 10.5, 12.5, 14.5]) {
      const before = sampleIntro(t - 0.00001);
      const after = sampleIntro(t + 0.00001);
      for (const key of ['open', 'reveal', 'turn', 'orbit', 'distance', 'flip', 'passage', 'title']) {
        expect(Math.abs(before[key] - after[key]), `${key} at ${t}`).toBeLessThan(0.001);
      }
    }
    expect(sampleIntro(INTRO_END).open).toBe(0);
    expect(sampleIntro(INTRO_END).title).toBe(1);
  });
  it('fits the same sphere in the narrower portrait field of view', () => {
    for (const aspect of [320 / 900, 390 / 844, 1, 844 / 390]) {
      const d = introCameraDistance(15, aspect);
      const halfFov = Math.min(20 * Math.PI / 180, Math.atan(Math.tan(20 * Math.PI / 180) * aspect));
      expect(d * Math.sin(halfFov)).toBeGreaterThanOrEqual(15 * Math.sin(20 * Math.PI / 180) - 1e-12);
    }
  });
  it('holds the camera and geometry still for reduced motion', () => {
    const first = sampleIntro(0, true);
    for (let t = 0; t <= INTRO_END; t += 0.25) {
      const pose = sampleIntro(t, true);
      for (const key of ['open', 'turn', 'orbit', 'distance', 'flip', 'reveal', 'passage', 'title']) expect(pose[key]).toBe(first[key]);
      expect(pose.wormVisible).toBe(false);
    }
  });
});
