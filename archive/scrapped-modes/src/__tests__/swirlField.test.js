import { describe, it, expect } from 'vitest';
import {
  swirlArrowPositions,
  SWIRL_ARROW_LEN,
  FACE_KEYS,
  chartToWorld
} from '../holonomy/holonomyMath.js';

const COUNT = 12;
const alloc = () => new Float32Array(COUNT * 2 * 3);

const arrow = (arr, i) => ({
  base: [arr[i * 6], arr[i * 6 + 1], arr[i * 6 + 2]],
  tip: [arr[i * 6 + 3], arr[i * 6 + 4], arr[i * 6 + 5]]
});

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('swirlArrowPositions', () => {
  it('fills the whole buffer with finite numbers for every face', () => {
    for (const faceKey of FACE_KEYS) {
      const arr = swirlArrowPositions(faceKey, 0.4, COUNT, alloc());
      expect(arr).toHaveLength(COUNT * 6);
      for (const n of arr) expect(Number.isFinite(n)).toBe(true);
    }
  });

  it('anchors every base on the face at the 0.54 lift', () => {
    const arr = swirlArrowPositions('PZ', 0.4, COUNT, alloc());
    const step = 1 / (COUNT + 1);
    for (let i = 0; i < COUNT; i++) {
      const ub = -0.5 + step * (i + 1);
      const vb = -0.5 + step * Math.floor(COUNT / 2);
      expect(arrow(arr, i).base).toEqual(chartToWorld('PZ', ub, vb, 0, 0.54).map((n) => Math.fround(n)));
    }
  });

  it('gives every arrow the same fixed length', () => {
    const arr = swirlArrowPositions('PX', 0.7, COUNT, alloc());
    for (let i = 0; i < COUNT; i++) {
      const { base, tip } = arrow(arr, i);
      // The tip is offset along the face's unit axes, so the arrow keeps its
      // literal length — it is not scaled by chartToWorld's chart scale.
      expect(dist(base, tip)).toBeCloseTo(SWIRL_ARROW_LEN, 5);
    }
  });

  it('moves the tips but never the bases when twist changes', () => {
    const low = swirlArrowPositions('PZ', 0.1, COUNT, alloc());
    const high = swirlArrowPositions('PZ', 0.9, COUNT, alloc());
    let tipsMoved = 0;
    for (let i = 0; i < COUNT; i++) {
      expect(arrow(high, i).base).toEqual(arrow(low, i).base);
      if (dist(arrow(low, i).tip, arrow(high, i).tip) > 1e-4) tipsMoved += 1;
    }
    expect(tipsMoved).toBeGreaterThan(0);
  });

  it('clamps twist away from zero so the field never collapses', () => {
    const zero = swirlArrowPositions('PZ', 0, COUNT, alloc());
    const clamped = swirlArrowPositions('PZ', 0.05, COUNT, alloc());
    expect(Array.from(zero)).toEqual(Array.from(clamped));
    // and a negative twist lands on the same clamp rather than mirroring
    expect(Array.from(swirlArrowPositions('PZ', -3, COUNT, alloc()))).toEqual(Array.from(clamped));
  });

  it('is a pure write into the caller-owned buffer — same input, same output', () => {
    const a = swirlArrowPositions('NY', 0.33, COUNT, alloc());
    const b = swirlArrowPositions('NY', 0.33, COUNT, alloc());
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('returns the buffer it was handed, so callers can chain', () => {
    const buf = alloc();
    expect(swirlArrowPositions('PZ', 0.4, COUNT, buf)).toBe(buf);
  });

  it('leaves the buffer untouched for an unknown face rather than writing NaN', () => {
    const buf = alloc();
    swirlArrowPositions('NOPE', 0.4, COUNT, buf);
    expect(Array.from(buf).every((n) => n === 0)).toBe(true);
  });
});
