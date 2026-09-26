// src/worm/healerWorm/elementalGlsl.js
//
// GLSL shared by every elemental cube skin: noise, the cover-cell frame, and the
// sticker lattice.
//
// Each skin draws its whole cube as ONE InstancedMesh, one instance per cover cell
// (see elementalCells.js). The instance matrix carries the cell's live position and
// a roll-stable orientation at unit scale; the cell's size arrives separately as
// world-unit extents, so a shader can place geometry in world units and recover the
// sticker grid inside the cell at any board size.
//
// Plain strings, no Three.js, so skins can splice them into both stages and the
// module stays free to import anywhere.

/** Seam half-width in sticker units: stickers are 0.85 wide on a 1-unit lattice. */
export const SEAM_HALF = 0.075;

/**
 * A JS number as a GLSL float literal. `${0}` interpolates as the INT literal 0,
 * and GLSL ES refuses `float * int` — so every constant spliced into a shader goes
 * through here.
 */
export const glf = (n) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/**
 * Hashes and value noise. Value noise rather than anything fancier because it is
 * continuous in 3D — a skin wraps a cube, and a 2D field would have to pick two
 * axes and tear at every edge where the third took over.
 */
export const GLSL_NOISE = /* glsl */ `
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }
  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
  }
  vec3 hash33(vec3 p3) {
    p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xxy + p3.yxx) * p3.zyx);
  }
  float vnoise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
               mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float vnoise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z);
  }
  float fbm2(vec2 p) {
    return vnoise2(p) * 0.57 + vnoise2(p * 2.07 + 17.1) * 0.29 + vnoise2(p * 4.13 + 5.3) * 0.14;
  }
  float fbm3(vec3 p) {
    return vnoise3(p) * 0.6 + vnoise3(p * 2.03 + 11.7) * 0.4;
  }
  // Worley distances: x = nearest feature, y = second nearest. The difference is 0
  // exactly on a cell wall, which is what cracks and crystal facets are drawn from.
  vec2 worley3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;
    for (int z = -1; z <= 1; z++)
    for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec3 g = vec3(float(x), float(y), float(z));
      vec3 o = hash33(i + g);
      vec3 r = g + o - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
    return sqrt(vec2(d1, d2));
  }
`;

/**
 * The cover cell's frame, for vertex shaders. Declares the per-instance attributes
 * every skin shares and the helpers that turn a [0,1]² cell parameter into world
 * units on the face.
 *
 *   aCell    (rim, edge, corner, seed) — where the cell sits on its face
 *   aSweep   0..1 share of the claim sweep before this cell is reached
 *   aExtent  world-unit distance to the local −X, +X, −Y, +Y borders
 *   aEdge    1 where that border is a cube edge, 0 for a seam shared with a neighbour
 */
export const GLSL_CELL_ATTRIBUTES = /* glsl */ `
  attribute vec4 aCell;
  attribute float aSweep;
  attribute vec4 aExtent;
  attribute vec4 aEdge;

  vec2 cellLocal(vec2 q) {
    return vec2(mix(-aExtent.x, aExtent.y, q.x), mix(-aExtent.z, aExtent.w, q.y));
  }

  // Every cell is centred on a sticker and the lattice is one unit, so the sticker a
  // local point belongs to — and where in that sticker it is — falls out of fract.
  vec2 stickerLocal(vec2 l) { return fract(l + 0.5) - 0.5; }
`;

/**
 * Resolve the instance's world frame. Defines `cellMatrix`, `cellOrigin`, `cellN`
 * (outward face normal), `cellX` and `cellY` (in-plane axes) in the calling scope.
 * Guarded so a material still links on a plain Mesh (the shader warm-up compiles on
 * one before any instance exists).
 */
export const GLSL_CELL_FRAME = /* glsl */ `
  #ifdef USE_INSTANCING
    mat4 cellMatrix = modelMatrix * instanceMatrix;
  #else
    mat4 cellMatrix = modelMatrix;
  #endif
  vec3 cellOrigin = cellMatrix[3].xyz;
  vec3 cellX = normalize(cellMatrix[0].xyz);
  vec3 cellY = normalize(cellMatrix[1].xyz);
  vec3 cellN = normalize(cellMatrix[2].xyz);
`;

/**
 * Seam anchoring, for skins whose detail grows OUT of the grout (fire's tongues,
 * nature's grass). Requires GLSL_CELL_ATTRIBUTES and GLSL_NOISE.
 *
 *   slotId(salt)   a stable identity for this instance and geometry slot. The cell
 *                  seed can run into the hundreds of thousands, which a hash on the
 *                  GPU cannot resolve, so it is split into small parts.
 *   seamPoint(..)  a point on the sticker grid's seams inside this cell, picked by
 *                  three randoms. Seams sit half a unit off every sticker centre,
 *                  and every cell is centred on a sticker, so the candidate lines
 *                  are the half-integers inside the cell's extent. Returns the local
 *                  point (xy), whether it lies on a cube edge (z) and which way that
 *                  edge faces along the chosen axis (w, ±1).
 *   sweepStart(d)  where in the claim sweep this cell starts, compressed so even
 *                  the last cell (aSweep ≈ 0.9) finishes its ramp of width d before
 *                  the sweep does.
 */
export const GLSL_SEAM = /* glsl */ `
  vec2 slotId(float salt) {
    return vec2(mod(aCell.w, 251.0), floor(aCell.w / 251.0)) + vec2(aIndex * 7.13 + salt, aIndex * 3.71 - salt * 0.7);
  }

  vec4 seamPoint(float r1, float r2, float r3, float straddle) {
    float alongX = step(0.5, r1);           // 0: a seam running along Y (constant x)
    float eNeg = mix(aExtent.x, aExtent.z, alongX);
    float ePos = mix(aExtent.y, aExtent.w, alongX);
    float lo = ceil(-eNeg - 0.5 - 0.001);
    float hi = floor(ePos - 0.5 + 0.001);
    float m = lo + min(floor(r2 * (hi - lo + 1.0)), hi - lo);
    float line = m + 0.5;
    float onPos = step(abs(line - ePos), 0.02) * mix(aEdge.y, aEdge.w, alongX);
    float onNeg = step(abs(line + eNeg), 0.02) * mix(aEdge.x, aEdge.z, alongX);
    float aNeg = mix(aExtent.z, aExtent.x, alongX);
    float aPos = mix(aExtent.w, aExtent.y, alongX);
    float along = mix(-aNeg + 0.06, aPos - 0.06, r3);
    // Anything rooted on a cube edge sits just inside it, so it stays on the cube.
    line += straddle - (onPos - onNeg) * 0.04;
    vec2 l = alongX < 0.5 ? vec2(line, along) : vec2(along, line);
    return vec4(l, max(onPos, onNeg), onPos - onNeg);
  }

  float sweepStart(float width) { return aSweep * (1.0 - width) / 0.92; }
`;
