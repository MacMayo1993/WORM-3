// src/worm/ElementalSurface.jsx
//
// A continuous element surface for the elemental-orb cube skin. The reused
// per-sticker Living-style volumes read as discrete tiles — a 0.78-wide box per
// sticker with grout gaps between them and an identical wave pattern on every
// one, so a "water" cube looked like a grid of static blue squares. This is a
// purpose-built replacement that fixes both problems:
//
//   • Full coverage. The quad is slightly larger than a cell (1.04) so adjacent
//     tiles overlap and the grout disappears — the element covers the whole face.
//   • Seamless motion. Every wave/caustic/facet is a function of WORLD position
//     (a varying fed from modelMatrix), so the pattern is one continuous field
//     across tile boundaries and around the cube instead of repeating per tile.
//     `uTime` is sharedUniforms.time, which CubeAssembly already ticks every
//     frame, so it flows on its own.
//
// One shared geometry and one shared material per element back every tile (the
// skin renders up to ~150 meshes but they all reference these), so the whole
// layer is a handful of GPU objects. This covers the two flat-surface elements,
// water and ice. Grass keeps its dedicated blade mesh, and fire is drawn with the
// bombs' flame sprites (ElementalFireSkin) — it used to have a "lava" branch here
// that painted molten runoff across each sticker and read as orange squiggles.
//
// ── Why the patterns are noise fields and not sines ──────────────────────────
// The first version built both elements out of products of sines, and both were
// broken in the same way. A product of sines spends almost all of its domain near
// zero, so ice's "facets" (sin·sin·sin) evaluated to a flat constant and never
// drew a single facet, while water's caustics (pow(max(0, sin·sin), 2)) were
// almost entirely black. Worse, ice's "cracks" were a function of (x + z) ALONE,
// and a 1-D function can only produce parallel stripes — the frozen cube was a
// flat blue wash with diagonal streaks lying across it.
//
// Both now build on a real 3D value-noise field, which has structure everywhere:
// water's caustics are ridged noise (thin bright web lines, the actual shape
// light makes through a wavy surface) and ice is a domain-warped cell field with
// per-plate normals, so it has genuine crystal facets that catch the light.

import * as THREE from 'three';
import { sharedUniforms } from '../3d/styles/TileStyleMaterials.jsx';

export const SURFACE_MODE = { water: 0, ice: 1 };

const _geoCache = { geo: null };
export function getElementalSurfaceGeo() {
  if (!_geoCache.geo) {
    // Slightly oversized so neighbouring tiles overlap (kills the grout), with
    // enough subdivisions for the water ripple and the ice plate relief to read
    // as displaced surfaces rather than as flat painted quads.
    _geoCache.geo = new THREE.PlaneGeometry(1.04, 1.04, 18, 18);
  }
  return _geoCache.geo;
}

// Shared by both stages. Value noise rather than anything fancier because it is
// continuous in 3D — the layer wraps a cube, so a 2D field would have to pick two
// axes and would tear at every edge where the third took over.
const NOISE = /* glsl */`
  float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }
  vec3 hash33(vec3 p3) {
    p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xxy + p3.yxx) * p3.zyx);
  }
  float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash13(i + vec3(0.0, 0.0, 0.0)), hash13(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z);
  }
`;

// Ice's crystal plates, needed in BOTH stages: the fragment stage shades each
// plate, the vertex stage steps it up or down so the relief is real geometry and
// catches the scene's light at its edges.
//
// A plain floor() grid would give obvious cubes, so the lookup point is
// domain-warped by a low-frequency noise first — the cell walls buckle into
// irregular polygons that read as a frozen surface rather than as graph paper.
const ICE_CELLS = /* glsl */`
  vec3 iceCell(vec3 p) {
    float w1 = vnoise(p * 1.6);
    float w2 = vnoise(p * 1.6 + 11.3);
    // ~0.5 world units per plate, i.e. a couple of plates across a sticker. Finer
    // than this and the facets stop reading as broken crystal and start reading as
    // scratches on a pane.
    return floor(p * 1.9 + vec3(w1, w2, w1 * w2 + 0.3) * 1.7);
  }
`;

const vertexShader = /* glsl */`
  uniform float uTime;
  uniform int uMode;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vView;
  varying float vWave;

  ${NOISE}
  ${ICE_CELLS}

  // Continuous world-space wave field — shared by every tile, so the surface is
  // one body rather than a grid of identical squares.
  float wfield(vec3 p, float t) {
    return sin(p.x * 3.0 + t * 1.6)
         + sin(p.z * 3.4 - t * 1.3)
         + sin((p.x + p.z) * 2.2 + t * 0.9)
         + sin(p.y * 3.1 + t * 1.1);
  }

  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    float w = wfield(wp.xyz, uTime);
    vWave = w;

    vec3 pos = position;
    // Local +Z is the outward face normal for every cell, so displacement along
    // it lifts the surface off the sticker on all six faces.
    if (uMode == 0) {
      pos.z += w * 0.035;                              // water swell
    } else {
      // Each crystal plate sits at its own height, so the frozen surface is
      // genuinely faceted instead of a flat quad with facets painted on. The
      // steps land between vertices and read as chipped, which is what ice does.
      pos.z += (hash13(iceCell(wp.xyz)) - 0.5) * 0.075;
    }
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform int uMode;
  uniform vec3 uColor;
  uniform vec3 uAccent;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vView;
  varying float vWave;

  ${NOISE}
  ${ICE_CELLS}

  void main() {
    vec3 vd = normalize(vView);
    float t = uTime;
    vec3 lightDir = normalize(vec3(0.4, 0.8, 0.5));

    vec3 col;
    float alpha;

    if (uMode == 0) {
      // ── Water ────────────────────────────────────────────────────────────
      // Surface normal from the wave gradient (screen-space derivatives).
      float dx = dFdx(vWave);
      float dy = dFdy(vWave);
      vec3 n = normalize(vec3(-dx * 6.0, -dy * 6.0, 1.0));
      float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.2);

      // Depth tint: troughs hold the deep colour, crests lift toward the accent,
      // so the swell reads as a body of water with volume rather than as a flat
      // sheet with highlights on it.
      float h = clamp(vWave * 0.25 * 0.5 + 0.5, 0.0, 1.0);
      col = mix(uColor * 0.30, mix(uColor, uAccent, 0.35), h);

      // Caustics. Ridged noise (1 - |2n-1|, raised to a high power) leaves thin
      // bright filaments where the field crosses its midpoint — the branching web
      // light actually makes through a wavy surface. Two layers drift against
      // each other so the web crawls and re-forms instead of sliding rigidly.
      float n1 = vnoise(vWorld * 3.4 + vec3(0.0, t * 0.30, t * 0.17));
      float n2 = vnoise(vWorld * 4.7 + vec3(-t * 0.24, t * 0.11, 0.0));
      float caustic = clamp(
        pow(1.0 - abs(n1 * 2.0 - 1.0), 7.0) + 0.85 * pow(1.0 - abs(n2 * 2.0 - 1.0), 7.0),
        0.0, 1.4);
      col += uAccent * caustic * 0.95;

      // Foam, but only on the crests and broken up by noise, so it collects along
      // the tops of the swell the way real foam does instead of frosting evenly.
      float crest = smoothstep(0.35, 1.0, vWave * 0.25);
      float foam = smoothstep(0.35, 0.85, crest * (0.45 + 0.9 * vnoise(vWorld * 10.0 + t * 0.5)));
      col = mix(col, vec3(1.0), foam * 0.8);

      float spec = pow(max(dot(reflect(-lightDir, n), vd), 0.0), 60.0);
      col += vec3(1.0) * spec * 1.1;
      col = mix(col, uAccent, fres * 0.4);
      alpha = 0.5 + fres * 0.32 + caustic * 0.18 + foam * 0.35;
    } else {
      // ── Ice ──────────────────────────────────────────────────────────────
      // Every fragment belongs to a crystal plate; the plate's id drives both its
      // tilt and its tint, so adjacent plates catch the light differently and the
      // surface breaks up into facets.
      vec3 cid = iceCell(vWorld);
      float id = hash13(cid);
      vec3 rnd = hash33(cid);
      // Generous tilt range: the facets only read if neighbouring plates catch the
      // light differently enough to separate from each other.
      vec3 n = normalize(vec3((rnd.xy - 0.5) * 1.6, 1.0));
      float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.2);
      float lam = clamp(dot(n, lightDir), 0.0, 1.0);

      // Crack lines along the plate walls. The cell INDEX is piecewise constant, so
      // its screen-space derivative is zero inside a plate and large exactly where
      // one plate meets the next — walls at a consistent width whatever the
      // surface's orientation, with no separate crack pattern needed.
      //
      // Deriving this from the cell index and not from a hash OF the index matters:
      // neighbouring plates always differ by at least 1 in some component, but
      // their hashes are random and land close together often enough that a
      // hash-based edge test dropped whole stretches of wall and drew the cracks
      // as dotted lines.
      float crack = smoothstep(0.03, 0.45, fwidth(cid.x) + fwidth(cid.y) + fwidth(cid.z));

      // Fine frost grain over the plates, and a sparse twinkle that re-rolls a few
      // times a second so the surface glitters as the camera moves across it.
      float frost = vnoise(vWorld * 14.0) * 0.5 + vnoise(vWorld * 28.0) * 0.5;
      float twinkle = pow(vnoise(vWorld * 26.0 + floor(t * 6.0) * 7.3), 16.0) * 4.0;
      // Per-plate glint. Broad enough that a facet flares as the camera swings past
      // it, which is what sells the surface as hard and polished rather than matte.
      float spec = pow(max(dot(reflect(-lightDir, n), vd), 0.0), 24.0);

      // Kept blue and kept contrasty between plates. Washing the lit end all the
      // way to white (and frosting the whole surface toward white on top of it)
      // turned the frozen cube into a grey film with no ice colour left in it.
      //
      // The shadow end is deepened unevenly across the channels rather than by a
      // flat multiply: uColor is a pale sky blue, and scaling it uniformly just
      // gives pale grey. Pulling red down hardest keeps the dark end reading as
      // cold and lets the plates have real tonal range instead of all sitting in
      // the same narrow pastel band.
      col = mix(uColor * vec3(0.30, 0.42, 0.62), mix(uColor, vec3(1.0), 0.5),
                0.18 + 0.55 * lam + 0.30 * id);
      col = mix(col, vec3(1.0), frost * 0.12);
      col += vec3(1.0) * crack * 0.55;
      col += vec3(0.85, 0.95, 1.0) * spec * 0.9;
      col += vec3(0.90, 0.97, 1.0) * twinkle;
      col = mix(col, uAccent, fres * 0.30);
      // Ice is a solid, not a film. At the surface layer's usual ~0.6 the lit tile
      // underneath (a healed tile glows green) came through hard enough to turn the
      // whole frozen cube green; this is opaque enough to actually freeze the face
      // while the tile's colour and markings still read through it.
      alpha = 0.80 + fres * 0.14 + crack * 0.12;
    }

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), clamp(alpha, 0.0, 1.0));
  }
`;


const _matCache = new Map();
export function getElementalSurfaceMaterial(element, colorHex, accentHex) {
  const key = `${element}_${colorHex}_${accentHex}`;
  let mat = _matCache.get(key);
  if (!mat) {
    mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: sharedUniforms.time,                 // ticked by CubeAssembly every frame
        uMode: { value: SURFACE_MODE[element] ?? 0 },
        uColor: { value: new THREE.Color(colorHex) },
        uAccent: { value: new THREE.Color(accentHex) }
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      extensions: { derivatives: true }
    });
    _matCache.set(key, mat);
  }
  return mat;
}
