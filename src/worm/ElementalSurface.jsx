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
// One shared geometry and one shared material per element back every tile, and the
// skin draws all of them as a single InstancedMesh — the whole sheathed cube is ONE
// draw call rather than the ~150 it used to cost. This covers the two flat-surface
// elements, water and ice. Grass keeps its dedicated blade mesh, and fire is drawn
// with the bombs' flame sprites (ElementalFireSkin) — it used to have a "lava"
// branch here that painted molten runoff across each sticker and read as orange
// squiggles.
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

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { sharedUniforms } from '../3d/styles/TileStyleMaterials.jsx';

// Lightning rides the same instanced quad, geometry and attribute set as water and
// ice — it is a third branch of this shader rather than a fourth renderer, so the
// charged cube costs exactly what a wet one does: one draw call.
export const SURFACE_MODE = { water: 0, ice: 1, lightning: 2 };

const _geoCache = { geo: null };
export function getElementalSurfaceGeo() {
  if (!_geoCache.geo) {
    // Slightly oversized so neighbouring tiles overlap (kills the grout), with
    // enough subdivisions for the water ripple and the ice plate relief to read
    // as displaced surfaces rather than as flat painted quads.
    _geoCache.geo = new THREE.PlaneGeometry(1.04, 1.04, 18, 18);
    // Lift off the sticker, baked in. The skin used to carry this as a child mesh
    // offset inside each cell group; the cells are instances of ONE mesh now, so
    // there is no child transform left to hold it. Baking it into the geometry
    // keeps it inside the instance matrix's scale, exactly as the child offset was
    // inside the group's, so the lift still shrinks with the claim/expiry ramp.
    _geoCache.geo.translate(0, 0, 0.03);
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
  // (intensity, claim, release, unused) — the shared elemental envelope, written
  // once per frame by ElementalCubeSkin. See elementalLifecycle.js.
  uniform vec4 uEnv;
  // Per cover cell: (rim, edge, corner, seed). Where the cell sits on the cube —
  // rim 0 at a face centre → 1 at its border, edge/corner flags for the cells that
  // meet another face. This is what lets one flat quad know it is part of a cube.
  attribute vec4 aCell;
  // Per cover cell: 0..1 share of the claim sweep before this cell is reached.
  attribute float aSweep;

  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vView;
  varying float vWave;
  varying float vSwell;
  varying vec3 vCellMask;   // (rim, edge, corner)
  varying float vArrive;
  varying vec3 vFaceNormal;

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

  // The broad swell, deliberately NOT part of wfield: a single low-frequency plane
  // wave travelling through world space. Because it is a function of world position
  // it carries across a cube edge onto the next face on its own, which is what makes
  // the six faces read as one body of water rather than six aquarium panes.
  float swellField(vec3 p, float t) {
    vec3 dir = normalize(vec3(1.0, 0.35, 0.8));
    return sin(dot(p, dir) * 0.85 - t * 0.75);
  }

  void main() {
    vUv = uv;
    vCellMask = aCell.xyz;
    // Every cover cell is an INSTANCE of this one quad, so the cell's own
    // position/orientation/scale arrives as instanceMatrix rather than as a parent
    // group's modelMatrix. World position — which every pattern below is a function
    // of, and which is what keeps the field continuous across cells — must be
    // composed through it. Guarded so the material still works on a plain mesh.
    #ifdef USE_INSTANCING
      mat4 cellMatrix = modelMatrix * instanceMatrix;
    #else
      mat4 cellMatrix = modelMatrix;
    #endif

    vec4 wp = cellMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    float w = wfield(wp.xyz, uTime);
    vWave = w;
    vSwell = swellField(wp.xyz, uTime);
    // Local +Z is the outward face normal for every cell; in world space it is the
    // instance matrix's Z column, which is how the surface knows which way is up on
    // a cube whose faces all point somewhere different.
    vFaceNormal = normalize((cellMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);

    // The claim sweep. Each cell holds off until the sweep reaches it, so the
    // element travels outward from the tile the orb was taken on rather than
    // appearing on all six faces at once. Once the sweep has passed, uEnv.y pins to
    // 1 and this is a constant 1 for the rest of the wash.
    vArrive = smoothstep(aSweep, aSweep + 0.35, uEnv.y);

    vec3 pos = position;
    // Local +Z is the outward face normal for every cell, so displacement along
    // it lifts the surface off the sticker on all six faces.
    if (uMode == 0) {
      // Ripple plus the broad swell, both gated by the sweep so a cell rises into
      // the water rather than snapping to full displacement the moment it arrives.
      pos.z += (w * 0.035 + vSwell * 0.05) * vArrive;
    } else if (uMode == 2) {
      // Lightning is a charge crawling ON the surface, not a body sitting on it —
      // it stays flat. Any displacement here would lift the veins off the tile and
      // break the "the cube itself is conducting" read.
    } else {
      // Each crystal plate sits at its own height, so the frozen surface is
      // genuinely faceted instead of a flat quad with facets painted on. The
      // steps land between vertices and read as chipped, which is what ice does.
      pos.z += (hash13(iceCell(wp.xyz)) - 0.5) * 0.075;
    }
    // viewMatrix * cellMatrix, not modelViewMatrix: the latter folds in only the
    // parent group, and under instancing that would leave every cell shaded as if
    // it sat at the cube's centre facing +Z.
    vec4 mv = viewMatrix * cellMatrix * vec4(pos, 1.0);
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
  uniform vec4 uEnv;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying vec3 vView;
  varying float vWave;
  varying float vSwell;
  varying vec3 vCellMask;
  varying float vArrive;
  varying vec3 vFaceNormal;

  ${NOISE}
  ${ICE_CELLS}

  void main() {
    vec3 vd = normalize(vView);
    float t = uTime;
    vec3 lightDir = normalize(vec3(0.4, 0.8, 0.5));

    // Distance from this cell's own centre, 0 → 1 at its border. Everything the
    // player has to read — the sticker colour, heal state, bomb fuses, markings —
    // sits in the middle of a tile, so the element is thinned there and its
    // strongest cues are pushed out to the gaps between tiles.
    float cellRim = clamp(max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)) * 2.0, 0.0, 1.0);
    float readable = mix(0.66, 1.0, smoothstep(0.10, 0.92, cellRim));

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
      // sheet with highlights on it. The broad swell is folded in at low frequency,
      // which is what gives the cube whole-body motion instead of a uniform chop.
      float h = clamp((vWave * 0.25 + vSwell * 0.55) * 0.5 + 0.5, 0.0, 1.0);
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
      float crest = smoothstep(0.30, 1.0, vWave * 0.25 + vSwell * 0.45);
      float foam = smoothstep(0.35, 0.85, crest * (0.45 + 0.9 * vnoise(vWorld * 10.0 + t * 0.5)));

      // ── The waterline ────────────────────────────────────────────────────
      // A meniscus riding the cube's silhouette. Surface tension piles water up
      // where a body of it meets an edge, and without this the cube read as six
      // wet squares that happened to be adjacent — there was nothing telling the
      // eye it was ONE volume with an outside. It is strongest in the tile gaps of
      // the cells that actually sit on a cube edge, and builds further at corners
      // where two edges meet.
      // The band rises toward the tile gap and then falls away again BEFORE the
      // quad's outer limit. Cover quads are cut slightly oversized so neighbours
      // overlap and the grout disappears, which means their last sliver hangs past
      // the cube's silhouette into empty space — running the waterline all the way
      // out to cellRim 1.0 painted bright foam on that overhang and fringed the
      // cube with ragged white flaps.
      float gapBand = smoothstep(0.45, 0.80, cellRim) * (1.0 - smoothstep(0.88, 1.0, cellRim));
      float meniscus = vCellMask.y * gapBand * (0.55 + 0.45 * vCellMask.z);
      // Broken up so the waterline crawls rather than sitting as a painted stripe.
      meniscus *= 0.55 + 0.75 * vnoise(vWorld * 7.0 + vec3(0.0, t * 0.6, t * 0.35));
      float rimFoam = meniscus * (0.5 + 0.5 * crest);

      // Restrained: a waterline is a bright EDGE on a blue body. Pushed harder it
      // stops reading as water piling up and starts reading as frost.
      col = mix(col, vec3(1.0), clamp(foam * 0.8 + rimFoam * 0.32, 0.0, 1.0));

      float spec = pow(max(dot(reflect(-lightDir, n), vd), 0.0), 60.0);
      col += vec3(1.0) * spec * 1.1;
      col = mix(col, uAccent, fres * 0.4);
      // Deep body, cyan caustics, white foam: the accent is pushed hardest exactly
      // where the water is thickest, along the rims.
      col += uAccent * meniscus * 0.30;

      alpha = 0.5 + fres * 0.32 + caustic * 0.18 + foam * 0.35;
      // Thin over tile centres so gameplay marks stay legible, and thicken along
      // the gaps and the silhouette where the element should read strongest.
      alpha *= readable;
      alpha += meniscus * 0.16;
    } else if (uMode == 2) {
      // ── Lightning ────────────────────────────────────────────────────────
      // Charge veins that crawl through the SEAMS. Branching current follows the
      // path of least resistance, and on a cube that path is the grid of gaps
      // between tiles — running the veins across tile faces instead made the cube
      // look shrink-wrapped in a crackle texture with nothing to do with its shape.
      //
      // Ridged noise gives the branching filaments (the same trick water's caustics
      // use); weighting it by the gap band is what pins them to the seams.
      float n1 = vnoise(vWorld * 5.2 + vec3(0.0, t * 0.9, t * 0.4));
      float n2 = vnoise(vWorld * 9.5 - vec3(t * 0.7, 0.0, t * 0.5));
      float vein = clamp(pow(1.0 - abs(n1 * 2.0 - 1.0), 9.0) + 0.7 * pow(1.0 - abs(n2 * 2.0 - 1.0), 11.0), 0.0, 1.5);
      float gapBand = smoothstep(0.30, 0.95, cellRim);
      vein *= 0.25 + 1.05 * gapBand;

      // Cells discharge in short, non-simultaneous groups. The stagger comes from
      // the cell's own seed, so neighbouring cells are never in phase and the cube
      // crackles instead of strobing as one object.
      float phase = fract(vCellMask.x * 0.37 + hash13(floor(vWorld * 1.7)) * 3.1);
      float pulse = pow(0.5 + 0.5 * sin(t * 4.2 + phase * 6.2831853), 8.0);

      // Charge rails: current gathers along the cube's own edges, brightest at the
      // corners where three faces meet. This is the cube-scale read — from the
      // overview camera the silhouette is traced in light.
      float rail = vCellMask.y * smoothstep(0.55, 0.94, cellRim) * (0.6 + 0.4 * vCellMask.z);
      rail *= 0.45 + 0.55 * pow(0.5 + 0.5 * sin(t * 2.3 - vWorld.y * 1.4), 3.0);

      // A dark conductive sheen, so the white-hot cores have contrast to be hot
      // against. Nearly black at the tile centre, which also leaves the sticker
      // and its markings readable straight through the charge.
      float sheen = pow(clamp(dot(normalize(vFaceNormal), normalize(vView)), 0.0, 1.0), 1.5);
      col = mix(uColor * 0.10, uColor * 0.42, sheen * 0.7 + 0.3 * vCellMask.x);
      col += uColor * vein * (0.35 + 0.75 * pulse);
      col += uAccent * vein * pulse * 1.15;          // white-hot cores, only mid-burst
      col += uAccent * rail * 0.55;
      float fres = pow(1.0 - clamp(sheen, 0.0, 1.0), 2.0);
      col = mix(col, uAccent, fres * 0.16);

      alpha = 0.30 + vein * 0.34 + pulse * vein * 0.28 + rail * 0.30 + fres * 0.14;
      alpha *= readable;
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

    // The cell has not been reached by the claim sweep yet, or the wash is
    // dissolving. Both are the same statement about how much element is here.
    alpha *= vArrive;
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
        uAccent: { value: new THREE.Color(accentHex) },
        // Written once per frame by the skin's transform loop, never per instance.
        uEnv: { value: new THREE.Vector4(1, 1, 0, 0) }
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

/**
 * The water/ice skin for every cover cell at once — one InstancedMesh, one draw
 * call for the whole sheathed cube.
 *
 * The geometry is built per mount rather than shared from a module cache, because
 * it carries this wash's per-cell attributes (where each cell sits on the cube, and
 * its share of the claim sweep). The material stays cached: it holds no per-wash
 * state beyond uniforms the skin writes each frame.
 *
 * ElementalCubeSkin's single frame loop owns the instance matrices and `uEnv`;
 * nothing here runs per frame.
 */
export function ElementalSurfaceSkin({ element, color, accent, count, cellData, meshRef }) {
  const material = useMemo(() => getElementalSurfaceMaterial(element, color, accent), [element, color, accent]);

  const geometry = useMemo(() => {
    const geo = getElementalSurfaceGeo().clone();
    geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cellData.cell, 4));
    // Marked dynamic: the sweep is rewritten once when a claim origin arrives,
    // which can be a frame or two after the mesh mounts.
    const sweep = new THREE.InstancedBufferAttribute(cellData.sweep, 1);
    sweep.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aSweep', sweep);
    return geo;
  }, [cellData]);

  // Ours to dispose — the clone is per mount. The cached source geometry and the
  // cached material outlive it and must not be touched.
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      frustumCulled={false}
      raycast={() => null}
    />
  );
}
