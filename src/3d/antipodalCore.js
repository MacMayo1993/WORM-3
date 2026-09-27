// The antipodal cube at the heart of the puzzle (VoidCore.jsx): a miniature of
// the play cube, the same N×N, in which every tile shows its antipodal partner.
//
// The game glues each tile to a partner (findAntipodalStickerByGrid). On a solved
// cube the partner is the tile's point reflection through the centre; once
// slices turn, partners move independently and that stops being true. So the
// miniature is defined by the gluing itself, not by geometry: its tile beneath
// any tile T shows T's partner. A tunnel then reads exactly as it runs — it dives
// from T into the core tile that shows where it leads, crosses the centre, and
// comes out of the core tile beneath the partner, which shows where it came
// from (tunnelDockInto places those docks). On a solved cube the route is a
// straight diameter.
//
// The miniature follows the live cubie meshes, so a slice turn turns the same
// slice of the core, and a tile keeps its partner's colour through the turn.
//
// Pure helpers and shaders only; the React side lives in VoidCore.jsx.

import * as THREE from 'three';
import { TUNNEL_MINI_FACE_R, TUNNEL_CORE_TILE, tunnelCoreScale } from '../utils/tunnelPath.js';
import { ANTIPODAL_COLOR } from '../utils/constants.js';

/** Half-width of the core, where the tunnels dock. */
export const CORE_HALF = TUNNEL_MINI_FACE_R;
/** A core sticker's width as a share of its cubie; tunnels plug in at this width. */
export const CORE_STICKER = TUNNEL_CORE_TILE;
/** Sticker front face offset from its cubie centre, in cubie units. */
export const CORE_STICKER_OFFSET = 0.5 + 0.004;

export const CORE_DIRS = {
  PX: [1, 0, 0], NX: [-1, 0, 0], PY: [0, 1, 0], NY: [0, -1, 0], PZ: [0, 0, 1], NZ: [0, 0, -1]
};
const DIR_KEYS = Object.keys(CORE_DIRS);

/** Cube-assembly mesh index of a grid cell (x-major, as CubeAssembly lays them out). */
export const coreCellIndex = (x, y, z, size) => (x * size + y) * size + z;

/**
 * The surface of an N×N cube as the core draws it: one entry per cubie that
 * shows, and one per sticker, each with the mesh index that carries it.
 */
export function coreLayout(size) {
  const cells = [];
  const stickers = [];
  const last = size - 1;
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const onX = x === 0 || x === last, onY = y === 0 || y === last, onZ = z === 0 || z === last;
        if (!onX && !onY && !onZ) continue;
        const idx = coreCellIndex(x, y, z, size);
        cells.push({ idx, x, y, z });
        for (const dirKey of DIR_KEYS) {
          const [dx, dy, dz] = CORE_DIRS[dirKey];
          const out = (dx === 1 && x === last) || (dx === -1 && x === 0) ||
            (dy === 1 && y === last) || (dy === -1 && y === 0) ||
            (dz === 1 && z === last) || (dz === -1 && z === 0);
          if (out) stickers.push({ idx, cell: cells.length - 1, x, y, z, dirKey });
        }
      }
    }
  }
  return { size, cells, stickers };
}

// A sticker's pose inside a unit cubie: pushed out along its face and turned to face it.
const _z = new THREE.Vector3(0, 0, 1);
const _n = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _one = new THREE.Vector3(1, 1, 1);
export const CORE_STICKER_LOCAL = Object.fromEntries(DIR_KEYS.map((dirKey) => {
  const [x, y, z] = CORE_DIRS[dirKey];
  _n.set(x, y, z);
  _q.setFromUnitVectors(_z, _n);
  return [dirKey, new THREE.Matrix4().compose(_n.clone().multiplyScalar(CORE_STICKER_OFFSET), _q.clone(), _one)];
}));

const _centre = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _identity = new THREE.Quaternion();

/**
 * A core cubie's matrix: the play cubie's rest centre carried by its live
 * rotation (`quaternion`, cube space, identity at rest) and shrunk into the core.
 */
export function coreCubieMatrixInto(out, x, y, z, size, quaternion = null) {
  const k = (size - 1) / 2;
  const s = tunnelCoreScale(size);
  const q = quaternion || _identity;
  _centre.set(x - k, y - k, z - k).applyQuaternion(q).multiplyScalar(s);
  return out.compose(_centre, q, _scale.set(s, s, s));
}

/**
 * The colour each core tile shows: its partner's current colour. `map` is a
 * fresh buildManifoldGridMap of `cubies`; `findPartner` is findAntipodalStickerByGrid.
 * Falls back to the tile's own antipodal colour if a partner cannot be found.
 */
export function corePartnerColorId(cubies, map, size, cell, findPartner) {
  const sticker = cubies?.[cell.x]?.[cell.y]?.[cell.z]?.stickers?.[cell.dirKey];
  if (!sticker) return null;
  const loc = findPartner(map, sticker, size);
  const partner = loc ? cubies[loc.x]?.[loc.y]?.[loc.z]?.stickers?.[loc.dirKey] : null;
  return partner ? partner.curr : ANTIPODAL_COLOR[sticker.curr];
}

// ── The approach zoom ────────────────────────────────────────────────────────
// Riding a WORM tunnel, the core swells as the lens closes on it, anchored on
// the tile the worm is diving into so that tile never leaves the route: the face
// grows round it and the cube deepens behind it, until the antipodal cube looks
// like the one the rider just dived into. It stays inside the outer cube's
// hollow, and relaxes once the rider is through.

/** Never grow past this, however much room a big cube leaves. */
export const CORE_ZOOM_MAX = 6;
/** Keep the grown core this far inside the outer cube's inner walls. */
export const CORE_ZOOM_MARGIN = 0.12;

/**
 * The largest growth about `dock` (a point on the core's surface) that keeps
 * the core inside the hollow of a `size` cube.
 */
export function coreZoomLimit(dock, size) {
  const h = size / 2 - CORE_ZOOM_MARGIN, r = CORE_HALF;
  let g = CORE_ZOOM_MAX;
  for (const d of [dock.x, dock.y, dock.z]) {
    if (r + d > 1e-9) g = Math.min(g, (h + d) / (r + d)); // the face at −r stays above −h
    if (r - d > 1e-9) g = Math.min(g, (h - d) / (r - d)); // the face at +r stays below +h
  }
  return Math.max(1, g);
}

/** How far above the entry face the lens is when the core starts to grow. */
export const coreZoomReach = (size) => 0.9 * (size / 2 - CORE_HALF) + 0.2;

/**
 * Growth for a lens `height` above the entry face (≤ 0 once through it), up to
 * `limit`; `release` (0→1) returns it to 1 as the ride leaves the core.
 */
export function coreZoomAt(height, limit, size, release = 0) {
  const approach = height <= 0.15 ? 1 : 1 - THREE.MathUtils.smoothstep(height, 0.15, coreZoomReach(size));
  return 1 + (limit - 1) * approach * (1 - Math.min(1, Math.max(0, release)));
}

// ── Network state ────────────────────────────────────────────────────────────

/**
 * How lit-up the core is from how much of the network is alive: 0 on a fresh
 * cube, rising quickly with the first few flipped stickers, never quite 1.
 */
export const networkCharge = (flippedStickers) => 1 - Math.exp(-Math.max(0, flippedStickers) / 10);

/** Stickers that have been flipped at least once. */
export function countFlippedStickers(cubies) {
  let count = 0;
  for (const layer of cubies || [])
    for (const row of layer)
      for (const cubie of row)
        for (const key in cubie.stickers) if ((cubie.stickers[key].flips || 0) > 0) count++;
  return count;
}

/**
 * How much of the cube's inside a viewer can see, 0–1. Only then does the core
 * light its surroundings: with the cube closed, a light at the centre would leak
 * onto the groove walls between pieces and tint the classic look.
 */
export function interiorExposure({ explosionT = 0, visualMode = 'classic', hollowMode = false } = {}) {
  const view = hollowMode || visualMode === 'glass' ? 1 : visualMode === 'gap' ? 0.6 : 0;
  return Math.min(1, Math.max(explosionT, view));
}

// ── Materials ────────────────────────────────────────────────────────────────

/**
 * Glossy core stickers that also glow a little in their own colour, so the
 * miniature stays readable deep inside the cube where the studio rig barely
 * reaches. `glow` is a shared uniform ({ value }).
 */
export function createCoreStickerMaterial(glow, performanceMode = false) {
  const Lit = performanceMode ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial;
  const material = new Lit({
    roughness: 0.26, metalness: 0, ...(performanceMode ? {} : { clearcoat: 1, clearcoatRoughness: 0.14 })
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCoreGlow = glow;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uCoreGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * uCoreGlow;');
  };
  material.customProgramCacheKey = () => 'antipodal-core-sticker';
  return material;
}

export function createCoreBodyMaterial(performanceMode = false) {
  const Lit = performanceMode ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial;
  return new Lit({ color: '#141416', roughness: 0.34, metalness: 0, ...(performanceMode ? {} : { clearcoat: 0.4, clearcoatRoughness: 0.35 }) });
}

const HALO_VERTEX = /* glsl */ `
  uniform float uSize;
  varying vec2 vLocal;
  void main() {
    vLocal = uv * 2.0 - 1.0;
    // Billboard: always faces the camera, centred on the core.
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += position.xy * uSize;
    gl_Position = projectionMatrix * mv;
  }
`;

const HALO_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vLocal;
  void main() {
    float r2 = dot(vLocal, vLocal);
    float g = (exp(-r2 * 7.0) * 0.8 + exp(-r2 * 28.0) * 0.6) * (1.0 - smoothstep(0.6, 1.0, r2));
    gl_FragColor = vec4(uColor * g * uIntensity, 1.0);
    #include <colorspace_fragment>
  }
`;

/** A soft corona round the core, depth-tested at its centre so the cube silhouettes against it. */
export function createCoreHaloMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uSize: { value: 0.9 }, uColor: { value: new THREE.Color('#ffe7c2') }, uIntensity: { value: 0 } },
    vertexShader: HALO_VERTEX,
    fragmentShader: HALO_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}
