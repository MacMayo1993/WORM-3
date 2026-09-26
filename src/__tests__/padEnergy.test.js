import { describe, it, expect } from 'vitest';
import {
  energyHash, padTremble, padArc, padSpark, createEnergyFrames,
  TREMBLE_NORMAL, TREMBLE_PLANE, ARCS_PER_PAD, ARC_POINTS, ARC_RATE, ARC_DUTY, MAX_ENERGY_PADS
} from '../3d/padEnergy.js';
import { PAD_BACK_WIDTH } from '../3d/padStalkGeometry.js';
import { WORM_PAD_HEIGHT } from '../game/raisedCubie.js';

const HALF = PAD_BACK_WIDTH / 2;
const SEEDS = [0, 1, 7, 123456, -98765, 0x7fffffff, 2654435761];

describe('unstable pad energy', () => {
  it('hashes deterministically into [0, 1)', () => {
    for (const seed of SEEDS) {
      for (let n = -5; n < 50; n++) {
        const h = energyHash(seed, n);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(1);
        expect(energyHash(seed, n)).toBe(h);
      }
    }
    expect(energyHash(1, 2)).not.toBe(energyHash(2, 1));
  });

  it('keeps the shudder within a few millimetres and repeats it exactly', () => {
    const a = {}, b = {};
    let moved = false;
    for (const seed of SEEDS) {
      for (let t = 0; t < 4; t += 0.013) {
        padTremble(a, t, seed);
        expect(Math.abs(a.n)).toBeLessThanOrEqual(TREMBLE_NORMAL);
        expect(Math.abs(a.u)).toBeLessThanOrEqual(TREMBLE_PLANE);
        expect(Math.abs(a.v)).toBeLessThanOrEqual(TREMBLE_PLANE);
        padTremble(b, t, seed);
        expect(b).toEqual(a);
        moved ||= Math.abs(a.n) > TREMBLE_NORMAL / 4;
      }
    }
    expect(moved).toBe(true);
    // Small next to the hover it rides on: the pad never nears the surface.
    expect(TREMBLE_NORMAL).toBeLessThan(WORM_PAD_HEIGHT / 10);
  });

  it('pins every arc to its rims and keeps it inside the gap', () => {
    const pts = new Float32Array(ARC_POINTS * 3);
    const lift = WORM_PAD_HEIGHT;
    let lit = 0, beats = 0;
    for (const seed of SEEDS) {
      for (let arc = 0; arc < ARCS_PER_PAD; arc++) {
        for (let beat = 0; beat < 200; beat++) {
          const time = (beat + 0.5) / ARC_RATE;
          beats++;
          const glow = padArc(pts, arc, time, seed, lift);
          if (glow === 0) continue;
          lit++;
          expect(glow).toBeGreaterThan(0);
          expect(glow).toBeLessThanOrEqual(1);
          for (let i = 0; i < ARC_POINTS; i++) {
            const z = pts[i * 3 + 2];
            expect(z).toBeGreaterThanOrEqual(0.004 - 1e-7);
            expect(z).toBeLessThanOrEqual(lift - 0.01 + 1e-7);
          }
          const first = [pts[0], pts[1], pts[2]];
          const last = pts.slice((ARC_POINTS - 1) * 3);
          const onSquare = (x, y, h) => Math.abs(Math.max(Math.abs(x), Math.abs(y)) - h) < 1e-5;
          if (arc === ARCS_PER_PAD - 1) {
            // The discharge leaves the tile's edge and earths just outside it.
            expect(onSquare(first[0], first[1], HALF)).toBe(true);
            expect(first[2]).toBeGreaterThan(lift * 0.34);
            expect(Math.max(Math.abs(last[0]), Math.abs(last[1]))).toBeGreaterThan(HALF * 1.24);
            expect(last[2]).toBeCloseTo(0.006, 6);
          } else {
            // Gap arcs jump from the slot's rim to the underside of the tile.
            expect(onSquare(first[0], first[1], HALF * 0.72)).toBe(true);
            expect(first[2]).toBeCloseTo(0.004, 6);
            expect(onSquare(last[0], last[1], HALF * 0.94)).toBe(true);
            expect(last[2]).toBeCloseTo(lift - 0.02, 6);
          }
        }
      }
    }
    // Strikes flicker on and off at roughly the designed duty.
    expect(Math.abs(lit / beats - ARC_DUTY)).toBeLessThan(0.05);
  });

  it('holds a strike steady through its beat, fading, then re-strikes elsewhere', () => {
    const a = new Float32Array(ARC_POINTS * 3), b = new Float32Array(ARC_POINTS * 3);
    let checked = 0, changed = 0;
    for (let beat = 0; beat < 60; beat++) {
      // Sample early and late in the same beat, whatever its seeded offset.
      const offset = energyHash(42, 0);
      const start = (beat + 1 - offset) / ARC_RATE;
      const early = padArc(a, 0, start + 0.1 / ARC_RATE, 42, 0.3);
      const late = padArc(b, 0, start + 0.9 / ARC_RATE, 42, 0.3);
      if (early === 0) { expect(late).toBe(0); continue; }
      expect(Array.from(b)).toEqual(Array.from(a));
      expect(late).toBeLessThan(early);
      checked++;
      padArc(b, 0, start + 1.1 / ARC_RATE, 42, 0.3);
      if (Array.from(b).some((v, i) => Math.abs(v - a[i]) > 1e-6)) changed++;
    }
    expect(checked).toBeGreaterThan(20);
    expect(changed).toBeGreaterThan(checked / 2);
  });

  it('draws nothing across a collapsed gap', () => {
    const pts = new Float32Array(ARC_POINTS * 3);
    for (let t = 0; t < 3; t += 0.05) expect(padArc(pts, 0, t, 9, 0.01)).toBe(0);
  });

  it('flings sparks outward and up from the rim of the gap', () => {
    const s = {};
    for (const seed of SEEDS) {
      for (let n = 0; n < 200; n++) {
        padSpark(s, n, seed, WORM_PAD_HEIGHT);
        const edge = Math.max(Math.abs(s.px), Math.abs(s.py));
        expect(edge).toBeCloseTo(HALF * 0.9, 6);
        // Outward: the velocity leaves through the side the spark starts on.
        const out = Math.abs(s.px) >= Math.abs(s.py) ? Math.sign(s.px) * s.vx : Math.sign(s.py) * s.vy;
        expect(out).toBeGreaterThan(0);
        expect(s.vz).toBeGreaterThan(0);
        expect(s.pz).toBeGreaterThan(0);
        expect(s.pz).toBeLessThan(WORM_PAD_HEIGHT);
        expect(s.life).toBeGreaterThanOrEqual(0.22);
        expect(s.life).toBeLessThanOrEqual(0.55);
        const again = padSpark({}, n, seed, WORM_PAD_HEIGHT);
        expect(again).toEqual(s);
      }
    }
  });

  it('sizes the record buffer for every pad WORM can hold', () => {
    const frames = createEnergyFrames();
    expect(frames.count).toBe(0);
    expect(frames.matrix).toHaveLength(MAX_ENERGY_PADS * 16);
    expect(frames.color).toHaveLength(MAX_ENERGY_PADS * 3);
    // Ten active pairs at most in WORM (MAX_ACTIVE_TUNNEL_PAIRS): twenty pads.
    expect(MAX_ENERGY_PADS).toBeGreaterThanOrEqual(20);
  });
});
