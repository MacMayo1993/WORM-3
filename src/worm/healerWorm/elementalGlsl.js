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
