// src/teach/layerGlow.js
// The pieces shared by every "light on the cube's tile grid" effect: the face
// basis, the quad sizing, the gold palette, the noise the shaders fray their
// edges with, and the geometry builder that merges one quad per exposed cubie
// face into a single mesh.
//
// LayerHighlight (the instructor's "turn THIS layer" hint) was the first and
// only consumer; the main menu's ambient grid glow is the second, and it needs
// exactly this geometry over the whole cube rather than one slice. The builder
// takes predicates instead of a slice index so neither caller has to know about
// the other's framing.
//
// Pure and React-free — the callers own the materials and the frame loop.

import * as THREE from 'three';

// Face basis: outward normal + two in-plane tangents (u, v) for the quad.
export const FACE_DEFS = {
  PX: { n: [1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  NX: { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  PY: { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  NY: { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  PZ: { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  NZ: { n: [0, 0, -1], u: [1, 0, 0], v: [0, 1, 0] }
};

export const FACE_OFFSET = 0.52; // just proud of the sticker so the rim reads as light on the surface
export const TILE_HALF = 0.49; // the cubie face itself
export const QUAD_HALF = 0.64; // oversized quad — the extra margin is where the glow bleeds out
export const EDGE_UV = 0.5 * (TILE_HALF / QUAD_HALF); // tile outline, in the quad's uv space

// Warm gold, deep to pale. Deliberately richer than UI_GOLD: these colours are
// additively blended over a live scene, so a pale token would wash out to white.
export const GOLD_DEEP = '#ff9c1c';
export const GOLD_CORE = '#ffe7ae';

// Cheap value-noise fbm, shared by every shader in this family.
export const NOISE_GLSL = `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
               mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 3; i++) { v += amp * vnoise(p); p *= 2.03; amp *= 0.5; }
    return v;
  }
`;

// Which cubie faces are on the outside of the cube.
export const EXPOSED = {
  PX: (x, _y, _z, size) => x === size - 1,
  NX: (x) => x === 0,
  PY: (_x, y, _z, size) => y === size - 1,
  NY: (_x, y) => y === 0,
  PZ: (_x, _y, z, size) => z === size - 1,
  NZ: (_x, _y, z) => z === 0
};

/**
 * One merged geometry of every exposed cubie face the caller asks for.
 *
 * Each face becomes a quad of half-width QUAD_HALF centred FACE_OFFSET out
 * along its normal, carrying uv (0,0)–(1,1) and a per-vertex `aPhase` the
 * fragment shader uses to stagger one face against the next.
 *
 * @param {number} size            cube edge length in cubies
 * @param {object} [opts]
 * @param {(x,y,z)=>boolean} [opts.includeCubie]  which cubies contribute (default: all)
 * @param {(ctx)=>number} [opts.phaseOf]  per-face phase in [0,1); receives
 *        { x, y, z, dirKey, fx, fy, fz } — grid coords, face key, and the
 *        face centre in cube space. Defaults to 0 for every face.
 * @returns {THREE.BufferGeometry} caller owns disposal
 */
export function buildRimGeometry(size, { includeCubie, phaseOf } = {}) {
  const k = (size - 1) / 2;
  const positions = [];
  const uvs = [];
  const phases = [];
  const indices = [];
  let vBase = 0;

  // uv corners of the quad: (0,0) (1,0) (1,1) (0,1)
  const corners = [
    [-1, -1, 0, 0],
    [1, -1, 1, 0],
    [1, 1, 1, 1],
    [-1, 1, 0, 1]
  ];

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        if (includeCubie && !includeCubie(x, y, z)) continue;
        const cx = x - k, cy = y - k, cz = z - k;

        for (const dirKey of Object.keys(FACE_DEFS)) {
          if (!EXPOSED[dirKey](x, y, z, size)) continue;

          const { n, u, v } = FACE_DEFS[dirKey];
          const fx = cx + n[0] * FACE_OFFSET;
          const fy = cy + n[1] * FACE_OFFSET;
          const fz = cz + n[2] * FACE_OFFSET;
          const phase = phaseOf ? phaseOf({ x, y, z, dirKey, fx, fy, fz }) : 0;

          for (const [su, sv, tu, tv] of corners) {
            positions.push(
              fx + (u[0] * su + v[0] * sv) * QUAD_HALF,
              fy + (u[1] * su + v[1] * sv) * QUAD_HALF,
              fz + (u[2] * su + v[2] * sv) * QUAD_HALF
            );
            uvs.push(tu, tv);
            phases.push(phase);
          }
          indices.push(vBase, vBase + 1, vBase + 2, vBase, vBase + 2, vBase + 3);
          vBase += 4;
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
  geo.setIndex(indices);
  return geo;
}
