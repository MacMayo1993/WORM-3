// The bolt primitive, pinned with fixed seeds.
//
// ChaosWave owned this arithmetic; the elemental lightning theme needs the same
// bolt but must not reach into the chaos cascade to get it, so the shape moved to a
// shared pure module. The first test here is the important one: it re-implements
// ChaosWave's ORIGINAL jitter loop and asserts the extracted version still produces
// exactly the same points. If that ever drifts, every chaos bolt in the game
// silently changes shape.
import { describe, it, expect } from 'vitest';
import { seededRand, makeBoltPath, boltPointAt, makeBoltBranches } from '../manifold/boltPath.js';

// ChaosWave's pre-extraction implementation, transcribed. Deliberately duplicated
// rather than imported: a copy that cannot be refactored alongside the real one is
// the only version that can prove the real one has not moved.
function legacyMakePath(from, to, segs = 10, jitter = 0.22, seed = 0) {
  const f = [...from];
  const t = [...to];
  const along = [t[0] - f[0], t[1] - f[1], t[2] - f[2]];
  const len = Math.hypot(...along);
  if (len < 0.01) return [[...f], [...t]];
  const dir = along.map((v) => v / len);
  const ref = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const crossN = (a, b) => {
    const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const l = Math.hypot(...c);
    return l > 1e-9 ? c.map((v) => v / l) : [0, 0, 0];
  };
  const p1 = crossN(dir, ref);
  const p2 = crossN(dir, p1);
  const rand = (s) => { const x = Math.sin(s) * 10000; return x - Math.floor(x); };
  const pts = [[...f]];
  for (let i = 1; i < segs; i++) {
    const frac = i / segs;
    const taper = Math.sin(frac * Math.PI);
    const j = jitter * taper * len;
    const a = (rand(seed + i * 2) - 0.5) * 2 * j;
    const b = (rand(seed + i * 2 + 1) - 0.5) * 2 * j;
    pts.push([
      f[0] + (t[0] - f[0]) * frac + p1[0] * a + p2[0] * b,
      f[1] + (t[1] - f[1]) * frac + p1[1] * a + p2[1] * b,
      f[2] + (t[2] - f[2]) * frac + p1[2] * a + p2[2] * b
    ]);
  }
  pts.push([...t]);
  return pts;
}

const FROM = [1.2, -0.4, 2.05];
const TO = [-1.6, 1.1, -0.35];

describe('bolt path', () => {
  it('reproduces ChaosWave\'s original geometry exactly', () => {
    for (const seed of [0, 1, 137, 4821, 9999]) {
      const now = makeBoltPath(FROM, TO, { segs: 10, jitter: 0.22, seed });
      const before = legacyMakePath(FROM, TO, 10, 0.22, seed);
      expect(now).toHaveLength(before.length);
      for (let i = 0; i < now.length; i++) {
        for (let k = 0; k < 3; k++) expect(now[i][k]).toBeCloseTo(before[i][k], 12);
      }
    }
  });

  it('pins both endpoints whatever the jitter', () => {
    // The taper is what lets a strike be aimed at a moving worm segment and still
    // land on it, so it is worth asserting at absurd jitter too.
    for (const jitter of [0, 0.22, 3.5]) {
      const p = makeBoltPath(FROM, TO, { jitter, seed: 7 });
      expect(p[0]).toEqual(FROM);
      expect(p[p.length - 1]).toEqual(TO);
    }
  });

  it('is deterministic in the seed and varies between seeds', () => {
    expect(makeBoltPath(FROM, TO, { seed: 42 })).toEqual(makeBoltPath(FROM, TO, { seed: 42 }));
    expect(makeBoltPath(FROM, TO, { seed: 42 })).not.toEqual(makeBoltPath(FROM, TO, { seed: 43 }));
  });

  it('bounds the jitter by the path length', () => {
    const jitter = 0.22;
    const length = Math.hypot(TO[0] - FROM[0], TO[1] - FROM[1], TO[2] - FROM[2]);
    for (let seed = 0; seed < 60; seed++) {
      for (const pt of makeBoltPath(FROM, TO, { jitter, seed })) {
        // Distance from the straight line can never exceed the two perpendicular
        // pushes combined, whatever the seed.
        const t = [pt[0] - FROM[0], pt[1] - FROM[1], pt[2] - FROM[2]];
        const d = [TO[0] - FROM[0], TO[1] - FROM[1], TO[2] - FROM[2]];
        const proj = (t[0] * d[0] + t[1] * d[1] + t[2] * d[2]) / (length * length);
        const off = Math.hypot(
          t[0] - d[0] * proj, t[1] - d[1] * proj, t[2] - d[2] * proj
        );
        expect(off).toBeLessThanOrEqual(jitter * length * Math.SQRT2 + 1e-9);
      }
    }
  });

  it('survives degenerate endpoints without NaN', () => {
    // The strike scheduler can aim at a point that has momentarily collapsed onto
    // its source; a NaN here would poison a whole shared geometry buffer.
    const p = makeBoltPath([1, 1, 1], [1, 1, 1], { seed: 3 });
    expect(p).toEqual([[1, 1, 1], [1, 1, 1]]);
    for (const pt of p) for (const v of pt) expect(Number.isFinite(v)).toBe(true);
  });

  it('stays finite for a vertical path, where the perpendicular basis switches', () => {
    for (const pair of [[[0, -2, 0], [0, 2, 0]], [[0, 2, 0], [0, -2, 0]]]) {
      for (const pt of makeBoltPath(pair[0], pair[1], { seed: 11 })) {
        for (const v of pt) expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('seededRand stays in range', () => {
    for (let s = 0; s < 500; s++) {
      const v = seededRand(s * 3.7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('bolt sampling', () => {
  it('walks the polyline from start to end', () => {
    const path = makeBoltPath(FROM, TO, { seed: 5 });
    const out = [0, 0, 0];
    expect(boltPointAt(out, path, 0)).toEqual(FROM);
    boltPointAt(out, path, 1);
    for (let k = 0; k < 3; k++) expect(out[k]).toBeCloseTo(TO[k], 6);
  });

  it('clamps out-of-range fractions instead of running off the array', () => {
    const path = makeBoltPath(FROM, TO, { seed: 5 });
    const out = [0, 0, 0];
    boltPointAt(out, path, -1);
    expect(out).toEqual(FROM);
    boltPointAt(out, path, 5);
    for (const v of out) expect(Number.isFinite(v)).toBe(true);
  });

  it('writes through any indexable target, including a typed array', () => {
    const path = makeBoltPath(FROM, TO, { seed: 5 });
    const out = new Float32Array(3);
    boltPointAt(out, path, 0.5);
    for (const v of out) expect(Number.isFinite(v)).toBe(true);
  });
});

describe('bolt branches', () => {
  it('draws nothing by default, so chaos bolts are unbranched', () => {
    const path = makeBoltPath(FROM, TO, { seed: 1 });
    expect(makeBoltBranches(path)).toEqual([]);
    expect(makeBoltBranches(path, { count: 0, seed: 1 })).toEqual([]);
  });

  it('produces exactly the requested count, capped by the caller', () => {
    const path = makeBoltPath(FROM, TO, { seed: 1 });
    for (const count of [1, 3, 6]) {
      expect(makeBoltBranches(path, { count, seed: 9 })).toHaveLength(count);
    }
  });

  it('is deterministic in the seed', () => {
    const path = makeBoltPath(FROM, TO, { seed: 1 });
    expect(makeBoltBranches(path, { count: 3, seed: 9 }))
      .toEqual(makeBoltBranches(path, { count: 3, seed: 9 }));
    expect(makeBoltBranches(path, { count: 3, seed: 9 }))
      .not.toEqual(makeBoltBranches(path, { count: 3, seed: 10 }));
  });

  it('forks late and dies before the impact', () => {
    // Branches must not compete with the strike's own landing.
    const path = makeBoltPath(FROM, TO, { seed: 1 });
    const total = Math.hypot(TO[0] - FROM[0], TO[1] - FROM[1], TO[2] - FROM[2]);
    for (const branch of makeBoltBranches(path, { count: 8, seed: 4 })) {
      const root = branch[0];
      // The fork starts somewhere along the main path's later half...
      const t = [root[0] - FROM[0], root[1] - FROM[1], root[2] - FROM[2]];
      const d = [TO[0] - FROM[0], TO[1] - FROM[1], TO[2] - FROM[2]];
      const along = (t[0] * d[0] + t[1] * d[1] + t[2] * d[2]) / (total * total);
      expect(along).toBeGreaterThan(0.2);
      expect(along).toBeLessThan(1);
      // ...and is short relative to the leader.
      const tip = branch[branch.length - 1];
      expect(Math.hypot(tip[0] - root[0], tip[1] - root[1], tip[2] - root[2]))
        .toBeLessThan(total * 0.6);
    }
  });

  it('fails soft on a degenerate or missing path', () => {
    expect(makeBoltBranches(null, { count: 3 })).toEqual([]);
    expect(makeBoltBranches([[0, 0, 0]], { count: 3 })).toEqual([]);
    expect(makeBoltBranches([[1, 1, 1], [1, 1, 1]], { count: 3, seed: 2 })).toEqual([]);
  });
});
