import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { TILES, PAIRS, flippedColor, pairPoint } from '../components/intro/introTopology.js';
import { WORM_START, IMPLODE_START } from '../components/intro/introTiming.js';
import { INTRO_END, sampleIntro, introCameraDistance } from '../components/intro/introChoreography.js';

// These protect animation failure modes: discontinuous cuts, clipped framing,
// mistaken antipodes, and a supposedly reduced-motion path that still moves.
describe('opening cinematic choreography', () => {
  it('has no jumps at camera or animation beat boundaries', () => {
    for (const t of [0.1, 0.6, 1.0, 2.1, 2.2, 2.3, 3.2, 3.3, 6.4, 6.9, 7.2, 7.4]) {
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


describe('all-pairs reveal', () => {
  it('covers every sticker exactly once with 27 distinct antipodal pairs', () => {
    const key = (p, f) => `${p.join(',')}:${f.axis}:${f.sign}`;
    const endpoints = PAIRS.flatMap(pair => [key(pair.position, pair.face), key(pair.position.map(v => -v), { ...pair.face, sign: -1 })]);
    expect(PAIRS).toHaveLength(27);
    expect(TILES).toHaveLength(54);
    expect(new Set(endpoints).size).toBe(54);
    expect(endpoints.sort()).toEqual(TILES.map(t => key(t.position, t.face)).sort());
  });
  it('anchors every connection to opposite sticker centers throughout expansion', () => {
    for (const spacing of [1, 1.6, 2.5]) for (const pair of PAIRS) {
      const a = pairPoint(pair, 0, spacing, new Vector3());
      const b = pairPoint(pair, 1, spacing, new Vector3());
      expect(a.clone().add(b).length()).toBeLessThan(1e-12);
      expect(a.getComponent(pair.face.axis)).toBeCloseTo(spacing + 0.51);
      expect(a.toArray().every(Number.isFinite)).toBe(true);
    }
  });
  it('changes all 54 tile colors during the flip and restores them on return', () => {
    const before = sampleIntro(0.9).flip;
    const flipped = sampleIntro(2.15).flip;
    const restored = sampleIntro(8).flip;
    for (const tile of TILES) {
      expect(flippedColor(tile.faceIndex, before)).toBe(tile.face.color);
      expect(flippedColor(tile.faceIndex, flipped)).not.toBe(tile.face.color);
      expect(flippedColor(tile.faceIndex, restored)).toBe(tile.face.color);
    }
  });
  it('lets even the last worm tail arrive before the cube closes', () => {
    const lastArrival = WORM_START + (PAIRS.length - 1) * 0.012 + (1 + 9 * 0.016) * 2.2;
    expect(lastArrival).toBeLessThan(IMPLODE_START);
    expect(INTRO_END).toBeLessThanOrEqual(9);
  });
});
