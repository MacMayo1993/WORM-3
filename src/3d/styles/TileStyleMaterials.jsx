import { prefersReducedMotion } from '../../utils/device.js';
import { migrateTileStyle } from '../../utils/tileStyleMigration.js';
import { bindDefaultTileStyleIdentity } from '../tileStyleIdentity.js';
import { livingSurfaceShaders } from './shaders/livingSurfaceShaders.js';
import { LIVING_SURFACE_KEYS } from '../../utils/livingSurfaceCatalog.js';
// TileStyleMaterials.jsx - Shared shader materials for tile styles
// Uses GPU-based procedural textures to avoid memory overhead

import * as THREE from 'three';
import { baseVertexShader } from './shaders/shaderBase.js';
import { sharedUniforms } from './sharedTileUniforms.js';
import { withStickerFinish } from './shaders/stickerFinish.js';
import { basicShaders } from './shaders/basicShaders.js';
import { techShaders } from './shaders/techShaders.js';
import { natureShaders } from './shaders/natureShaders.js';
import { opArtShaders } from './shaders/opArtShaders.js';
import { antipodalShaders } from './shaders/antipodalShaders.js';
import { newStyleShaders } from './shaders/newStyleShaders.js';
import { livingShaders } from './shaders/livingShaders.js';
import { nonEuclideanShaders } from './shaders/nonEuclideanShaders.js';
import { impossibleShaders } from './shaders/impossibleShaders.js';
import { livingIllusionShaders } from './shaders/livingIllusionShaders.js';
import { surrealShaders } from './shaders/surrealShaders.js';
import { craftedShaders, CRAFTED_ANTIPODAL_KEYS } from './shaders/craftedShaders.js';
export { isAnimatedStyle } from './animatedStyles.js';

// The uniforms every tile style shares live in their own small module, so the
// opening (flipPortal.js) can read them without loading every style's shader.
export { sharedUniforms };

// Point the dice style at CubeAssembly's per-cell roll texture (call on cube
// (re)creation and when the size changes).
export function setDiceCellState(texture, gridN, k) {
  sharedUniforms.cellRoll.value = texture;
  sharedUniforms.cellGridN.value = gridN;
  sharedUniforms.cellK.value = k;
}

// Update time uniform (call from useFrame)
export function updateSharedTime(elapsed) {
  sharedUniforms.time.value = elapsed;
  sharedUniforms.reducedMotion.value = prefersReducedMotion() ? 1 : 0;
}

// Update spin uniforms (call from useFrame). Energy is clamped to [0,1].
export function updateSharedSpin(energy, axis, slice) {
  sharedUniforms.spin.value = energy < 0 ? 0 : energy > 1 ? 1 : energy;
  sharedUniforms.spinAxis.value = axis;
  sharedUniforms.spinSlice.value = slice;
}

// Point the gaze at a world position, or release it to the camera (call from useFrame).
export function updateSharedGaze(x, y, z, on) {
  sharedUniforms.gazeTarget.value.set(x, y, z, on ? 1 : 0);
}

// Accumulate dice roll from spin energy (call from useFrame).
export function updateDiceRoll(dt, spinEnergy) {
  sharedUniforms.diceRoll.value += dt * spinEnergy * 7.0;
}

// ─── Shared tremor state ─────────────────────────────────────────────────────
// Pre-computed ONCE per frame by CubeAssembly, then read by every StickerPlane
// and ParityBreakthrough instance.  Eliminates the identical 3×sin + pow + max
// that was previously duplicated across every wormhole sticker per frame.
// At 54 flipped stickers on a 3×3 @ 60 fps this removes ~32 k redundant trig
// calls / second before scaling to 4×4 or 5×5.
export const sharedTremorState = {
  surge: 0, // Math.pow(Math.max(0, raw), 2) — pure magnitude in [0, 1]
  mult: 1,  // 1 + surge * 4 — position scale-factor used by tremor code
};

// ─── Flip burst map ───────────────────────────────────────────────────────────
// Written by StickerPlane during a flip (key = sticker gridId, value = rawP
// 0→1). Read by WormholeTunnel to drive the arch-lift and opacity burst.
// Entries are deleted when the flip completes (spinT hits 0).
export const flipBurstMap = new Map();

// ─── Sticker flip motion ──────────────────────────────────────────────────────
// The live animated motion of a flipping tile, keyed by sticker gridId:
//   { p, jx, jy, squash }
//     p       flip progress 0→1
//     jx, jy  in-plane vibration offset the tile is currently displaced by
//     squash  the tile's main squish scale (1 at rest, → 0 at the crossing)
//
// Tunnel endpoints are derived from the CUBIE's transform, which knows nothing
// about the sticker's own flip animation — so the tile would shake and squash
// while the tunnel welded to it sat perfectly still. This publishes that motion
// so the ribbon and the cords can ride it. Written every frame of a flip and
// deleted when it completes; readers treat a missing entry as "at rest".
export const stickerFlipMotion = new Map();

// ─── Heal cue maps ────────────────────────────────────────────────────────────
// Live in healBurstBridge.js (no dependencies, so the worm's hook can write them);
// re-exported here for the stickers and the animation driver.
export { healBurstMap, healParticleMap } from '../healBurstBridge.js';


/**
 * Recompute tremor state from the current elapsed clock time.
 * Must be called once per frame from CubeAssembly's useFrame, before any
 * StickerPlane reads sharedTremorState.
 */
export function updateSharedTremor(elapsedTime) {
  const raw =
    Math.sin(elapsedTime * 1.5) * 0.45 +
    Math.sin(elapsedTime * 2.7) * 0.3 +
    Math.sin(elapsedTime * 0.6) * 0.25;
  const surge = Math.pow(Math.max(0, raw), 2.0);
  sharedTremorState.surge = surge;
  sharedTremorState.mult = 1 + surge * 4;
}

// All fragment shaders merged from grouped modules
const fragmentShaders = {
  ...basicShaders,
  ...techShaders,
  ...natureShaders,
  ...opArtShaders,
  ...antipodalShaders,
  ...newStyleShaders,
  ...livingShaders,
  ...nonEuclideanShaders,
  ...impossibleShaders,
  ...surrealShaders,
  ...livingIllusionShaders,
  ...livingSurfaceShaders,
  ...craftedShaders,
};

// Dev-time guard: silent key collisions from spread merges are very hard to debug.
// This throws immediately at module load so the problem is impossible to miss.
if (import.meta.env.DEV) {
  const _shaderModules = [basicShaders, techShaders, natureShaders, opArtShaders, antipodalShaders, newStyleShaders, nonEuclideanShaders, impossibleShaders, surrealShaders, livingIllusionShaders, livingSurfaceShaders, craftedShaders];
  const _seen = new Map();
  for (const mod of _shaderModules) {
    for (const key of Object.keys(mod)) {
      if (_seen.has(key)) throw new Error(`[TileStyleMaterials] Duplicate shader key "${key}" — already defined in ${_seen.get(key)}`);
      _seen.set(key, mod);
    }
  }
}

// ─── LRU material cache ───────────────────────────────────────────────────────
// Key: "${style}_${colorHex}[_${antipodalHex}]".  Antipodal styles multiply the
// key space (style × faceColor × antipodalColor), so on a 6×6/7×7 cube with
// heavy flip traffic the old 200-slot cap could overflow mid-game; each evicted
// material disposes its GPU program, forcing a visible shader-recompile hitch
// the next time that combo appears.  500 slots keeps every realistic combo
// resident.  On eviction the GPU program is disposed immediately so memory
// doesn't accumulate over long sessions.
//
// NOTE: clearMaterialCache() disposes everything at once and should be called
// before a color-scheme change re-renders (e.g. at the top of the Zustand
// setSettings action that mutates face hex values).  Calling it after the new
// materials have already been created would dispose them out from under active
// meshes.  The LRU cap handles slow drift (custom colour pickers, many style
// previews) without needing precise timing.
const MAX_MAT_CACHE = 500;
const materialCache = new Map();

function _matCacheGet(key) {
  if (!materialCache.has(key)) return undefined;
  // LRU promotion: move to tail (most-recently-used end)
  const mat = materialCache.get(key);
  materialCache.delete(key);
  materialCache.set(key, mat);
  return mat;
}

function _matCachePut(key, mat) {
  if (materialCache.has(key)) materialCache.delete(key);
  materialCache.set(key, mat);
  // Evict the least-recently-used entry when over cap
  if (materialCache.size > MAX_MAT_CACHE) {
    const lruKey = materialCache.keys().next().value;
    materialCache.get(lruKey).dispose();
    materialCache.delete(lruKey);
  }
}

// ─── Shared volume-style resources ────────────────────────────────────────────
// Volume tile styles (lava, ice, water, …) mount extra meshes per sticker.
// Their geometries are identical for every sticker and their materials vary
// only by face colour, so both are cached here at module level instead of
// being re-created per StickerPlane mount — on a 6×6/7×7 cube that avoids
// hundreds of duplicate geometries/materials and the GPU re-uploads caused by
// R3F disposing per-mount copies on unmount.  Meshes using these shared
// resources MUST set dispose={null} so R3F never disposes a shared object out
// from under other stickers.  The cache is intentionally permanent: entry
// count is bounded by styles × face colours used in a session.
const volumeResourceCache = new Map();
export function getVolumeResource(key, create) {
  let res = volumeResourceCache.get(key);
  if (res === undefined) {
    res = create();
    volumeResourceCache.set(key, res);
  }
  return res;
}

// Styles that use a second antipodalColor uniform (opposite face's color).
// A shader that reads antipodalColor without being listed here gets an unset
// uniform, i.e. BLACK, with no warning from anywhere — exported so a test can
// hold the two in sync.
export const ANTIPODAL_STYLES = new Set([
  ...LIVING_SURFACE_KEYS,
  ...CRAFTED_ANTIPODAL_KEYS,
  'liquidCheckers', 'velvetFolds', 'dreamMarble', 'paradoxWeave',
  'polkaDots', 'zigzag', 'checkerboard', 'diagStripes',
  'cornerAccent', 'innerDisc', 'crossPlus', 'borderFrame', 'thinHatch', 'dotRing',
  'opConcentric', 'opRadialSpokes', 'opTiltMosaic', 'opDiamondWave', 'opBullseyeSteps',
  'opWarpGrid', 'opChevronBands', 'opInterferencePlaid', 'opRibbonTwist', 'opPinwheel',
  'waveform', 'dnaHelix', 'orbChamber', 'liquidTank', 'dice', 'sandChamber', 'lavaLamp',
  'compass', 'turing', 'stainedGlass',
]);

/**
 * Get or create a shader material for a tile style.
 * @param {string} style - tile style key
 * @param {string} colorHex - hex color for this face
 * @param {boolean} useTexture - unused (reserved)
 * @param {object} texture - unused (reserved)
 * @param {string|null} antipodalHex - hex color of the antipodal face (for antipodal patterns).
 *   When null for an antipodal-style, a hue-shifted contrast color is derived automatically.
 */
export function getTileStyleMaterial(style, colorHex, useTexture = false, texture = null, antipodalHex = null) {
  // Texture path — cached by texture.uuid so repeated calls don't allocate a new
  // GPU program each time.  MeshStandardMaterial is evicted and disposed by the
  // same LRU logic as the shader materials below.
  if (useTexture && texture) {
    const texKey = `texture_${texture.uuid}`;
    const cachedTex = _matCacheGet(texKey);
    if (cachedTex) return cachedTex;
    const texMat = new THREE.MeshStandardMaterial({
      map: texture,
      color: '#ffffff',
      metalness: 0.1,
      roughness: 0.8,
    });
    _matCachePut(texKey, texMat);
    return texMat;
  }

  // Validate inputs
  const safeStyle = migrateTileStyle(style) || 'solid';
  const safeColorHex = colorHex || '#888888';

  // For antipodal styles the cache key must encode which antiColor is baked into
  // the material.  Use the explicit hex when provided, or '_derived' for the
  // deterministic hue-shifted fallback — so a null-antipodal preview and an
  // explicit-antipodal in-play material never accidentally alias the same key.
  const antipodalSuffix = ANTIPODAL_STYLES.has(safeStyle)
    ? (antipodalHex ? `_${antipodalHex}` : '_derived')
    : '';
  const cacheKey = `${safeStyle}_${safeColorHex}${antipodalSuffix}`;
  const cached = _matCacheGet(cacheKey);
  if (cached) return cached;

  const styleShader = fragmentShaders[safeStyle] || fragmentShaders.solid;

  let color;
  try {
    color = new THREE.Color(safeColorHex);
  } catch (_e) {
    console.warn('Invalid color:', safeColorHex, '- using fallback');
    color = new THREE.Color('#888888');
  }

  const isGlass = safeStyle === 'glass';

  // Glass is not identity-seeded or animated. Its private per-tile clones used
  // to copy every procedural style's uniforms, including a DataTexture, then
  // request another uniform upload from each tile-identity callback. Keep only
  // what the glass/finish shaders read, with no per-tile texture allocation.
  const uniforms = isGlass ? {
    baseColor: { value: color },
    rigKey: sharedUniforms.rigKey,
    rigFill: sharedUniforms.rigFill,
    rigRim: sharedUniforms.rigRim,
  } : {
    tileHome: { value: new THREE.Vector3() },
    tileFace: { value: 0 },
    baseColor: { value: color },
    time: sharedUniforms.time,
    reducedMotion: sharedUniforms.reducedMotion,
    spin: sharedUniforms.spin,
    spinAxis: sharedUniforms.spinAxis,
    spinSlice: sharedUniforms.spinSlice,
    diceRoll: sharedUniforms.diceRoll,
    gazeTarget: sharedUniforms.gazeTarget,
    cellRoll: sharedUniforms.cellRoll,
    cellGridN: sharedUniforms.cellGridN,
    cellK: sharedUniforms.cellK,
    rigKey: sharedUniforms.rigKey,
    rigFill: sharedUniforms.rigFill,
    rigRim: sharedUniforms.rigRim,
  };

  // Antipodal patterns need a second color uniform.  Use the provided antipodal
  // hex when available; otherwise derive a hue-shifted contrast (e.g. previews).
  if (ANTIPODAL_STYLES.has(safeStyle)) {
    let antiColor;
    if (antipodalHex) {
      try { antiColor = new THREE.Color(antipodalHex); } catch (_e) { antiColor = color.clone().offsetHSL(0.5, 0, 0); }
    } else {
      antiColor = color.clone().offsetHSL(0.5, 0.1, 0);
    }
    uniforms.antipodalColor = { value: antiColor };
  }

  const material = new THREE.ShaderMaterial({
    uniforms,
    // Every style draws on the flat sticker. Depth (the eye in its socket, the
    // chambers) is ray-traced in the fragment shader, so any surface can wear it.
    vertexShader: baseVertexShader,
    // Every style, glass included, wears the menu cube's sticker finish (stickerFinish.js).
    fragmentShader: withStickerFinish(styleShader),
    side: isGlass ? THREE.DoubleSide : THREE.FrontSide,
    transparent: isGlass,
    // A glass sticker is only 0.016 units thick. Two separate transparent
    // back/front passes doubled submissions and program selection per tile,
    // without adding useful depth. Keep both sides and the independently sorted
    // antipodal back, but submit the thin sticker once (including on WebGL1).
    forceSinglePass: isGlass,
    depthWrite: !isGlass,
    blending: THREE.NormalBlending,
    // orbChamber ray-traces its sphere using screen-space derivatives (dFdx/dFdy)
    // to build a UV-aligned tangent frame; enabling this extension keeps that
    // shader compiling on WebGL1 too. It's inert for shaders that don't use them.
    extensions: { derivatives: true },
  });

  material.onBeforeRender = bindDefaultTileStyleIdentity;

  // The bare style, for surfaces that bring their own vertex shader (tunnel bands).
  material.userData.styleFragmentShader = styleShader;

  _matCachePut(cacheKey, material);
  return material;
}

/**
 * Get a glass material for the glass visual mode.
 * This is a convenience wrapper that always returns a transparent glass shader.
 */
export function getGlassMaterial(colorHex) {
  return getTileStyleMaterial('glass', colorHex);
}

/** A tile's own mutable tint, while the camera-relative finish stays shared. */
export function createGlassMaterial(colorHex) {
  const material = getGlassMaterial(colorHex).clone();
  for (const key of ['rigKey', 'rigFill', 'rigRim']) material.uniforms[key] = sharedUniforms[key];
  return material;
}

/**
 * Clear material cache (call on settings change)
 */
export function clearMaterialCache() {
  materialCache.forEach(mat => mat.dispose());
  materialCache.clear();
}

// ─── Shader warm-up ──────────────────────────────────────────────────────────
// The first time a ShaderMaterial is rendered the browser blocks ~200 ms to
// compile the GLSL.  Pre-compiling before the user interacts eliminates that
// stall.  renderer.compile() triggers the GPU pipeline without producing any
// visible output.

const DEFAULT_WARMUP_STYLES = ['solid', 'glossy', 'matte', 'metallic', 'circuit', 'holographic'];

/**
 * Pre-compile the 6 most-used tile styles for every face colour.
 * Call once on mount inside the Canvas context (CubeAssembly useEffect).
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Camera}        camera
 * @param {string[]}            colorHexArray - one hex per cube face (length 6,
 *   ordered by face id so colorHexArray[(i+3)%6] is face i's antipodal partner)
 * @param {string[]}            extraStyles - additional styles to warm (e.g. the
 *   per-face styles currently equipped), so first flips never hit a cold cache
 */
export function warmUpDefaultStyles(renderer, camera, colorHexArray, extraStyles = []) {
  const scene = new THREE.Scene();
  const geo = new THREE.PlaneGeometry(0.1, 0.1);
  const styles = new Set([...DEFAULT_WARMUP_STYLES, ...extraStyles]);
  for (const style of styles) {
    for (let i = 0; i < colorHexArray.length; i++) {
      scene.add(new THREE.Mesh(geo, getTileStyleMaterial(style, colorHexArray[i])));
      // Antipodal styles bake the partner color into the material — warm the
      // exact in-play variant too, or the first flip pays the creation cost.
      if (ANTIPODAL_STYLES.has(style) && colorHexArray.length === 6) {
        const antipodalHex = colorHexArray[(i + 3) % 6];
        scene.add(new THREE.Mesh(geo, getTileStyleMaterial(style, colorHexArray[i], false, null, antipodalHex)));
      }
    }
  }
  renderer.compile(scene, camera);
  scene.clear(); // remove dummy meshes; materials stay cached
  geo.dispose();
}

/**
 * Pre-compile ALL tile styles for every face colour.
 * Call lazily on the first time the Tiles settings panel is opened so that
 * subsequent style selections incur zero compile stalls.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Camera}        camera
 * @param {string[]}            colorHexArray
 */
export function warmUpAllStyles(renderer, camera, colorHexArray) {
  const scene = new THREE.Scene();
  const geo = new THREE.PlaneGeometry(0.1, 0.1);
  for (const style of Object.keys(fragmentShaders)) {
    for (const colorHex of colorHexArray) {
      scene.add(new THREE.Mesh(geo, getTileStyleMaterial(style, colorHex)));
    }
  }
  renderer.compile(scene, camera);
  scene.clear();
  geo.dispose();
}
