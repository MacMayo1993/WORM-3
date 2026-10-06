// Shared GLSL for tile styles cut from a face-sized slab (Crafted, and the
// classic styles that picture a whole face: stained glass, Penrose).
//
// A tile samples its material at its home position on its home face
// (crFacePlane), so neighbouring tiles of a solved face continue one another and
// a scrambled face shows the pieces out of place. Previews have no home
// (tileFace 0) and show a whole 3×3 face's worth instead.
//
// Standalone templates, joined with + rather than interpolated, so the build's
// shader compaction still applies. Identifiers carry a cr prefix so they cannot
// collide with the sticker finish wrapped around every style.

// Which grid axis runs along each home face's sticker u and v, signed, keyed
// by face id (1 PZ, 2 NX, 3 PY, 4 NZ, 5 PX, 6 NY). Each sticker plane is turned
// by STICKER_ROT (stickerFrames.js); a test holds this table to those turns.
export const FACE_PLANE_AXES = {
  1: ['+x', '+y'],
  2: ['+z', '+y'],
  3: ['+x', '-z'],
  4: ['-x', '+y'],
  5: ['-z', '+y'],
  6: ['+x', '+z'],
};

const axisGLSL = (axis) => `${axis[0] === '-' ? '-' : ''}h.${axis[1]}`;
const FACE_PLANE_BRANCHES = Object.entries(FACE_PLANE_AXES)
  .map(([id, [u, v]], i) => `${i ? 'else ' : ''}if (tileFace < ${id}.5) p = vec2(${axisGLSL(u)}, ${axisGLSL(v)});`)
  .join('\n    ');

// Declarations and helpers: tile identity, hash/noise/fbm, antialiased lines,
// and the face-slab coordinates. A shader using it declares its own colour
// uniforms and must not redeclare vUv, tileHome, tileFace or cellK.
export const CRAFT_GLSL = `
  uniform vec3 tileHome;
  uniform float tileFace;
  uniform float cellK;
  varying vec2 vUv;

  float crHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  vec2 crHash2(vec2 p) {
    float n = crHash(p);
    return vec2(n, crHash(p + n + 17.17));
  }
  float crNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(crHash(i), crHash(i + vec2(1.0, 0.0)), f.x),
               mix(crHash(i + vec2(0.0, 1.0)), crHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float crFbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
      s += a * crNoise(p);
      p = mat2(1.6, 1.2, -1.2, 1.6) * p;
      a *= 0.5;
    }
    return s / 0.9375;
  }
  // 1 within half-width w of the curve d = 0, with a one-pixel antialiased edge.
  float crLine(float d, float w) {
    float aa = fwidth(d);
    return 1.0 - smoothstep(w - aa, w + aa, abs(d));
  }
  // The fragment's place on its home face, in cubie units with the face centre
  // at the origin. Each face maps grid axes the way its sticker plane is turned
  // (FACE_PLANE_AXES), so neighbouring tiles of a solved face continue one another.
  vec2 crFacePlane() {
    vec2 local = (vUv - 0.5) * 0.85;
    if (tileFace < 0.5) return local * 3.0;
    vec3 h = tileHome - vec3(cellK);
    vec2 p = vec2(0.0);
    ` + FACE_PLANE_BRANCHES + `
    return p + local;
  }
  // Half the face's width in the same units, so pictures scale to the face.
  float crFaceHalf() {
    return tileFace < 0.5 ? 1.5 : cellK + 0.5;
  }
  // Material coordinates: the face plane, shifted per face so the six faces are
  // cut from different parts of the stone.
  vec2 crSlab() {
    return crFacePlane() + tileFace * 7.31;
  }
`;

// Voronoi chips: x = distance to the cell border (F2 - F1), y and z = the
// cell's two random numbers.
export const CHIPS_GLSL = `
  vec3 crChips(vec2 p) {
    vec2 n = floor(p), f = fract(p);
    float d1 = 8.0, d2 = 8.0;
    vec2 id = n;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 r = g + crHash2(n + g) - f;
        float d = dot(r, r);
        if (d < d1) { d2 = d1; d1 = d; id = n + g; }
        else if (d < d2) { d2 = d; }
      }
    }
    return vec3(sqrt(d2) - sqrt(d1), crHash(id * 1.37 + 3.1), crHash(id + 9.7));
  }
`;

// Exact distance to the nearest Voronoi border (two passes), for lines of an
// even width: lead came, gold seams.
export const BORDERS_GLSL = `
  vec3 crBorder(vec2 x) {
    vec2 n = floor(x), f = fract(x);
    vec2 mg = vec2(0.0), mr = vec2(0.0);
    float md = 8.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 r = g + crHash2(n + g) - f;
        float d = dot(r, r);
        if (d < md) { md = d; mr = r; mg = g; }
      }
    }
    md = 8.0;
    for (int j = -2; j <= 2; j++) {
      for (int i = -2; i <= 2; i++) {
        vec2 g = mg + vec2(float(i), float(j));
        vec2 r = g + crHash2(n + g) - f;
        vec2 dr = r - mr;
        if (dot(dr, dr) > 0.00001) md = min(md, dot(0.5 * (mr + r), normalize(dr)));
      }
    }
    return vec3(md, n + mg);
  }
`;
