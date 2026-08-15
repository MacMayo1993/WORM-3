// src/worm/healerWorm/elementalSeeds.js
//
// Deterministic per-cell randomness and cube-scale masks for the elemental skins.
//
// Every element needs the same two things and both were being improvised per file:
//
//   • a stable random number for a cover cell, so a given cell always burns / grows
//     / cracks the same way. `Math.random()` cannot do this — the skin re-renders on
//     every element swap and the cube would reshuffle. ElementalFireSkin already
//     hashed its cell index by hand; this is that trick, named and shared, and it
//     is reproduced verbatim in GLSL by the flame field so CPU and GPU agree.
//
//   • a sense of WHERE a cell sits on the cube. The art direction hangs almost
//     everything on this: water pools along rims, fire flares at corners, frost
//     nucleates at edges, charge rails trace the silhouette. A cell that only knows
//     its own transform cannot tell a face centre from a corner.
//
// Pure, dependency-free, and seeded only from stable identity (face key + grid
// coordinates), so nothing here depends on frame order, `Math.random`, or replay
// state.

/**
 * The classic fract(sin(x) * K) hash, in the exact form ElementalFireSkin used and
 * the flame shader still uses. Kept bit-for-bit so a cell's flames do not jump when
 * the field moves between CPU and GPU.
 *
 * @returns {number} in [0, 1)
 */
export function hashSeed(seed, index, mulA = 12.9898, mulB = 78.233, scale = 43758.5453) {
  const h = Math.sin((seed + 1) * mulA + index * mulB) * scale;
  return h - Math.floor(h);
}

/** A second, decorrelated draw for the same (seed, index) pair. */
export const hashSeed2 = (seed, index) => hashSeed(seed, index, 39.3468, 11.135, 24634.6345);

/**
 * Stable scalar identity for a cover cell. Face key folds in so the same (j, k)
 * on two different faces does not produce twinned detail across the cube.
 */
export function cellSeed(faceKey, j, k, gridN) {
  // Face keys are the six fixed direction strings; summing char codes is enough to
  // separate them and keeps this dependency-free.
  let f = 0;
  for (let i = 0; i < faceKey.length; i++) f = (f * 31 + faceKey.charCodeAt(i)) % 9973;
  return f * gridN * gridN + j * gridN + k;
}

/**
 * Where a cover cell sits within its face, as masks the renderers can weight by.
 *
 * @param {number} j  grid row
 * @param {number} k  grid column
 * @param {number} gridN
 * @returns {{edge:number, corner:number, rim:number, centre:number}}
 *   edge   1 on the outer ring of the face (a cube edge), 0 inside
 *   corner 1 only on the four cells that meet another two faces
 *   rim    0 at the face centre → 1 at the border, smooth, for gradients
 *   centre 1 - rim, the quiet zone that must stay readable for tile marks
 */
export function cellEdgeMask(j, k, gridN) {
  if (gridN <= 1) return { edge: 1, corner: 1, rim: 1, centre: 0 };
  const last = gridN - 1;
  const onJ = j === 0 || j === last;
  const onK = k === 0 || k === last;
  const mid = last / 2;
  // Chebyshev distance from the centre, normalised — square rings, which is what
  // the grid actually is, rather than a radial falloff that would cut the corners.
  const rim = Math.max(Math.abs(j - mid), Math.abs(k - mid)) / mid;
  return {
    edge: onJ || onK ? 1 : 0,
    corner: onJ && onK ? 1 : 0,
    rim,
    centre: 1 - rim
  };
}

/**
 * Per-cell delay for the claim sweep, in units of the sweep's own duration.
 *
 * The element travels outward from the tile the orb was taken on rather than
 * appearing everywhere at once. Cells are ordered by grid distance from the claim
 * origin, normalised so the furthest cell arrives exactly at the end of the sweep.
 *
 * @param {{faceKey:string, j:number, k:number}} cell
 * @param {{faceKey:string, j:number, k:number}|null} origin  null → no sweep, all 0
 * @param {number} gridN
 * @returns {number} 0..1
 */
export function cellSweepDelay(cell, origin, gridN) {
  if (!origin || gridN <= 1) return 0;
  const sameFace = cell.faceKey === origin.faceKey;
  const dj = Math.abs(cell.j - origin.j);
  const dk = Math.abs(cell.k - origin.k);
  // Within the claimed face, distance is the in-plane hop count. Other faces start
  // from the shared edge, which is at worst gridN away, so they follow rather than
  // racing the origin face — one extra grid width of lead-in reads as the element
  // pouring over the cube edge.
  const d = sameFace ? Math.max(dj, dk) : gridN + Math.min(dj, dk);
  const maxD = 2 * gridN;
  return Math.min(1, d / maxD);
}
