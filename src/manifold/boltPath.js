// src/manifold/boltPath.js
//
// The shape of a lightning bolt, as pure arithmetic.
//
// ChaosWave has owned this vocabulary since chaos mode shipped — a jagged core
// whose jitter tapers to nothing at both endpoints, so the bolt always starts and
// ends exactly where it was aimed. The elemental lightning theme wants the same
// bolt, but it must NOT reach into the chaos cascade to get it: chaos bolts are
// driven by tile events and a controller that propagates damage, and faking those
// events to draw a decorative strike would couple an art effect to a gameplay
// system.
//
// So the geometry is extracted here instead, and both callers build on it.
//
// Deliberately free of Three and React, and operating on plain arrays: that makes
// the bolt shape testable with fixed seeds and no renderer, and it lets the strike
// pool write straight into a preallocated Float32Array without allocating a vector
// per point per bolt.
//
// Determinism is the whole point. Every draw comes from the caller's seed, never
// from Math.random, so a strike is reproducible, a test can pin its endpoints, and
// nothing here can perturb replay or network state.

/**
 * Deterministic pseudo-random in [0, 1). The exact form ChaosWave has always used —
 * kept bit-for-bit so extracting it cannot change a single chaos bolt.
 */
export const seededRand = (s) => {
  const x = Math.sin(s) * 10000;
  return x - Math.floor(x);
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len3 = (v) => Math.hypot(v[0], v[1], v[2]);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];
const norm = (v) => {
  const l = len3(v);
  return l > 1e-9 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 0];
};

/**
 * Two stable axes perpendicular to `along`, for pushing the jitter sideways.
 *
 * The reference axis switches when `along` is close to vertical: crossing two
 * near-parallel vectors gives a near-zero result whose normalisation is numeric
 * noise, and the bolt's jitter plane would spin at random along a vertical path.
 */
function perpBasis(along) {
  const ref = Math.abs(along[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const p1 = norm(cross(along, ref));
  const p2 = norm(cross(along, p1));
  return [p1, p2];
}

/**
 * Build a jagged polyline from `from` to `to`.
 *
 * Jitter follows a sine taper — widest at the midpoint, zero at both ends — so the
 * bolt is pinned to its endpoints however violent the middle gets. That property is
 * what lets a strike be aimed at a moving worm segment and still land on it.
 *
 * @param {number[]} from  [x, y, z]
 * @param {number[]} to    [x, y, z]
 * @param {object}  [o]
 * @param {number}  [o.segs]    line segments; the path has segs + 1 points
 * @param {number}  [o.jitter]  sideways spread, as a fraction of path length
 * @param {number}  [o.seed]
 * @returns {number[][]} points, `from` first and `to` last
 */
export function makeBoltPath(from, to, { segs = 10, jitter = 0.22, seed = 0 } = {}) {
  const along = sub(to, from);
  const length = len3(along);
  // Degenerate: a bolt with nowhere to go is a two-point line, never NaN. The
  // strike scheduler can aim at a point that has momentarily collapsed onto its
  // source, and a NaN here would poison the whole shared geometry buffer.
  if (length < 0.01) return [[...from], [...to]];

  const dir = [along[0] / length, along[1] / length, along[2] / length];
  const [p1, p2] = perpBasis(dir);

  const pts = [[...from]];
  for (let i = 1; i < segs; i++) {
    const frac = i / segs;
    const taper = Math.sin(frac * Math.PI);
    const j = jitter * taper * length;
    const a = (seededRand(seed + i * 2) - 0.5) * 2 * j;
    const b = (seededRand(seed + i * 2 + 1) - 0.5) * 2 * j;
    pts.push([
      from[0] + along[0] * frac + p1[0] * a + p2[0] * b,
      from[1] + along[1] * frac + p1[1] * a + p2[1] * b,
      from[2] + along[2] * frac + p1[2] * a + p2[2] * b
    ]);
  }
  pts.push([...to]);
  return pts;
}

/**
 * Position along a polyline at fraction `t`, written into `out` ([x, y, z]).
 * `out` may be a plain array, a Float32Array view, or anything indexable.
 */
export function boltPointAt(out, pts, t) {
  const maxSeg = pts.length - 1;
  const s = Math.min(Math.max(t, 0) * maxSeg, maxSeg - 1e-6);
  const si = Math.floor(s);
  const f = s - si;
  const a = pts[si];
  const b = pts[si + 1];
  out[0] = a[0] + (b[0] - a[0]) * f;
  out[1] = a[1] + (b[1] - a[1]) * f;
  out[2] = a[2] + (b[2] - a[2]) * f;
  return out;
}

/**
 * Forks off the main path.
 *
 * Real lightning branches late and the branches die before the leader lands, which
 * is also what keeps them cheap and readable: they add texture near the impact
 * without competing with it. Branch count is capped by the caller's quality budget
 * — this never decides on its own how many to draw.
 *
 * Chaos bolts ask for zero branches, so their look is untouched.
 *
 * @param {number[][]} path   the main path to fork from
 * @param {object}  [o]
 * @param {number}  [o.count]      how many forks (0 disables branching entirely)
 * @param {number}  [o.seed]
 * @param {number}  [o.segs]       segments per fork
 * @param {number}  [o.spread]     fork length, as a fraction of the main path
 * @param {number}  [o.minAt]      earliest fraction along the main path to fork at
 * @param {number}  [o.maxAt]      latest — kept below 1 so forks die before impact
 * @returns {number[][][]} one polyline per fork
 */
export function makeBoltBranches(path, { count = 0, seed = 0, segs = 4, spread = 0.32, minAt = 0.35, maxAt = 0.85 } = {}) {
  if (count <= 0 || !path || path.length < 2) return [];
  const from = path[0];
  const to = path[path.length - 1];
  const total = len3(sub(to, from));
  if (total < 0.01) return [];
  const dir = norm(sub(to, from));
  const [p1, p2] = perpBasis(dir);

  const out = [];
  const anchor = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    // Every draw is a function of (seed, i), so the same strike forks the same way
    // on every machine and on every replay.
    const r1 = seededRand(seed + i * 7.13 + 1);
    const r2 = seededRand(seed + i * 3.77 + 2);
    const r3 = seededRand(seed + i * 5.31 + 3);
    const at = minAt + (maxAt - minAt) * r1;
    boltPointAt(anchor, path, at);
    // Fork sideways and a little onward, so it reads as splitting off the leader
    // rather than as a stray line crossing it.
    const ang = r2 * Math.PI * 2;
    const reach = total * spread * (0.5 + 0.5 * r3);
    const tip = [
      anchor[0] + (Math.cos(ang) * p1[0] + Math.sin(ang) * p2[0]) * reach + dir[0] * reach * 0.45,
      anchor[1] + (Math.cos(ang) * p1[1] + Math.sin(ang) * p2[1]) * reach + dir[1] * reach * 0.45,
      anchor[2] + (Math.cos(ang) * p1[2] + Math.sin(ang) * p2[2]) * reach + dir[2] * reach * 0.45
    ];
    out.push(makeBoltPath([...anchor], tip, { segs, jitter: 0.3, seed: seed + i * 91 + 17 }));
  }
  return out;
}
