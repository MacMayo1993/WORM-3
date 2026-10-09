// src/3d/tombstone.js
//
// The Chaos tombstone: one geometry and one material shared by every dead tile on
// the cube, drawn through the tile-surface batches (TileSurfaceInstance), so the
// whole graveyard is ONE instanced draw however many tiles have died.
//
// It replaced three plain boxes per grave, each with its own geometry and material
// built on mount, a billboarded label group and two orbiting ghost worms (four more
// draws and two useFrames per grave). A 5×5 storm can bury a hundred and more tiles,
// so the old graveyard grew to hundreds of draws and allocations by the end of a
// round; this one costs the same at one grave as at a hundred and fifty.
//
// What a grave is, in the tile's frame (x across, y across, z out of the cube):
//   a low earth mound in front, a two-step granite plinth, and an arched headstone
//   of polished marble in the tile's own colour, leaning back on it with a bevelled
//   edge, so the colour of the tile that died reads from any side. On its face: a
//   black granite plaque with the epitaph in gold, framed by a carved rune border
//   that glows in the tile's colour. A candle burns on the plinth, and two spirit
//   worms circle the stone.
//
// Everything that moves (the rune's pulse, the candle's flicker, the spirits'
// orbit) is animated in the vertex and fragment shaders from the shared tile clock,
// so no grave needs a frame callback. Each grave's phase comes from a stable seed
// (`tombSeed` of its grid id, the batches' aInstanceSeed), never from the instance
// matrix: that moves with every self-solve slice turn, and a phase hashed from it
// made the spirits, rune and flame jump every frame of the turn. The motion stops
// under reduced motion, the in-app setting or the system's, and follows either
// changing mid-round (`uMotion`). The tile's colour arrives as the instance colour.
//
// Pure module state: built once, never disposed (one geometry, one material).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { sharedUniforms } from './styles/TileStyleMaterials.jsx';
import { prefersReducedMotion } from '../utils/device.js';
import { useGameStore } from '../hooks/useGameStore.js';

// Which part of the grave a vertex belongs to; the shader shades each its own way.
export const TOMB_REGION = Object.freeze({ stone: 0, earth: 1, plaque: 2, rune: 3, spirit: 4, flame: 5, wax: 6, marble: 7 });

// ── Layout (tile units; a tile is ~0.88 across) ──────────────────────────────
const STONE_Y = 0.1;            // the headstone stands toward the back of the tile
const STEP_TOP = 0.0925;        // top of the plinth's upper step
const SLAB_W = 0.26;            // headstone width
const SLAB_H = 0.22;            // straight part below the arch (the arch adds SLAB_W / 2)
const SLAB_T = 0.06;            // thickness, before the bevel
const BEVEL = 0.012;
/** The headstone leans back (its face tips toward the camera on a face-on view). */
export const TOMB_LEAN = -0.42;
/** Where the face of the plaque sits, in the leaning stone's own frame. */
export const TOMB_PLAQUE_FRONT = -(SLAB_T / 2 + BEVEL) - 0.007;
/** Pivot the stone leans about: the middle of its base. */
export const TOMB_STONE_PIVOT = [0, STONE_Y, STEP_TOP];
const FLAME = [-0.145, 0.045, 0.142];
const SPIRIT_R = 0.31;
const SPIRIT_Z = 0.3;

function tag(geometry, region) {
  geometry.deleteAttribute('uv');
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const n = geometry.attributes.position.count;
  geometry.setAttribute('aRegion', new THREE.BufferAttribute(new Float32Array(n).fill(region), 1));
  return geometry.index ? geometry.toNonIndexed() : geometry;
}

/** A rectangle with a semicircle on top: the headstone's outline. */
function archShape(w, h, y0 = 0) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, y0);
  s.lineTo(w / 2, y0);
  s.lineTo(w / 2, y0 + h);
  s.absarc(0, y0 + h, w / 2, 0, Math.PI, false);
  s.lineTo(-w / 2, y0);
  return s;
}

/** Shape-space (x, y) extruded along +Z, turned so y runs out of the cube and the extrusion runs along -Y. */
function standUp(geometry) {
  return geometry.rotateX(Math.PI / 2);
}

function buildStone() {
  const lean = new THREE.Matrix4()
    .makeTranslation(0, STONE_Y, STEP_TOP)
    .multiply(new THREE.Matrix4().makeRotationX(TOMB_LEAN));
  const parts = [];

  // Headstone: bevelled arch slab, centred on its own thickness.
  const slab = new THREE.ExtrudeGeometry(archShape(SLAB_W, SLAB_H), {
    depth: SLAB_T, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: 0.01, bevelSegments: 2, curveSegments: 10
  });
  slab.translate(0, 0, -SLAB_T / 2);
  parts.push(tag(standUp(slab).applyMatrix4(lean), TOMB_REGION.marble));

  // Rune border: an arch band proud of the face, open into the plaque below.
  const ring = archShape(0.23, 0.2, 0.012);
  ring.holes.push(archShape(0.2, 0.2, 0.026));
  const rune = new THREE.ExtrudeGeometry(ring, { depth: 0.005, bevelEnabled: false, curveSegments: 12 });
  rune.translate(0, 0, SLAB_T / 2 + BEVEL);
  parts.push(tag(standUp(rune).applyMatrix4(lean), TOMB_REGION.rune));

  // Plaque: a black granite panel, where the epitaph is engraved in gold.
  const plaque = new RoundedBoxGeometry(0.17, 0.008, 0.16, 1, 0.003);
  plaque.translate(0, TOMB_PLAQUE_FRONT + 0.004, 0.16);
  parts.push(tag(plaque.applyMatrix4(lean), TOMB_REGION.plaque));
  return parts;
}

function buildGrave() {
  const parts = [...buildStone()];

  // Earth mound in front of the stone.
  const mound = new THREE.SphereGeometry(0.3, 14, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  mound.rotateX(Math.PI / 2).scale(1.05, 0.78, 0.15).translate(0, -0.07, 0.004);
  parts.push(tag(mound, TOMB_REGION.earth));

  // Two-step plinth.
  parts.push(tag(new RoundedBoxGeometry(0.36, 0.17, 0.05, 2, 0.012).translate(0, STONE_Y, 0.035), TOMB_REGION.stone));
  parts.push(tag(new RoundedBoxGeometry(0.3, 0.125, 0.035, 2, 0.01).translate(0, STONE_Y, 0.075), TOMB_REGION.stone));

  // Candle on the plinth's front corner, and its flame.
  const candle = new THREE.CylinderGeometry(0.017, 0.019, 0.05, 8).rotateX(Math.PI / 2)
    .translate(FLAME[0], FLAME[1], FLAME[2] - 0.042);
  parts.push(tag(candle, TOMB_REGION.wax));
  const flame = new THREE.SphereGeometry(0.013, 6, 4).scale(1, 1, 1.9).translate(FLAME[0], FLAME[1], FLAME[2]);
  parts.push(tag(flame, TOMB_REGION.flame));

  // Two spirit worms on the orbit circle; the shader turns them round the stone.
  for (let w = 0; w < 2; w++) {
    // Beads overlap along the arc so each spirit reads as a worm, head first.
    const radii = [0.027, 0.024, 0.021, 0.018, 0.014];
    radii.forEach((r, k) => {
      const a = w * Math.PI - k * 0.13;
      const bead = new THREE.SphereGeometry(r, 7, 5)
        .translate(Math.cos(a) * SPIRIT_R, STONE_Y + Math.sin(a) * SPIRIT_R, SPIRIT_Z);
      parts.push(tag(bead, TOMB_REGION.spirit));
    });
  }
  const geometry = mergeGeometries(parts);
  geometry.computeBoundingSphere();
  // The spirits move: grow the bound so frustum culling never clips their orbit.
  geometry.boundingSphere.radius += 0.06;
  return geometry;
}

const vertexHead = /* glsl */ `
attribute float aRegion;
#ifdef USE_INSTANCING
attribute float aInstanceSeed;
#endif
uniform float uTime;
uniform float uMotion;
varying float vRegion;
varying float vPhase;
varying vec3 vObj;
`;

// Runs after <begin_vertex>: `transformed` is the object-space position.
const vertexBody = /* glsl */ `
vRegion = aRegion;
vObj = position;
#ifdef USE_INSTANCING
  vPhase = aInstanceSeed * 6.2831853;
#else
  vPhase = 0.0;
#endif
float tt = uTime * uMotion;
if (abs(aRegion - ${TOMB_REGION.spirit}.0) < 0.5) {
  // Spirits circle the stone, rising and dipping as they go.
  vec2 c = vec2(0.0, ${STONE_Y.toFixed(3)});
  vec2 d = transformed.xy - c;
  float a = tt * 0.85 + vPhase;
  float ca = cos(a), sa = sin(a);
  transformed.xy = c + vec2(ca * d.x - sa * d.y, sa * d.x + ca * d.y);
  float along = atan(d.y, d.x);
  transformed.z += 0.035 * sin(tt * 2.6 + along * 3.0 + vPhase);
}
if (abs(aRegion - ${TOMB_REGION.flame}.0) < 0.5) {
  // The flame flickers about its own centre.
  vec3 f = vec3(${FLAME.map(v => v.toFixed(3)).join(', ')});
  float flick = 1.0 + 0.22 * sin(tt * 17.0 + vPhase) * sin(tt * 7.3 + vPhase * 2.0) * uMotion;
  transformed = f + (transformed - f) * vec3(1.0, 1.0, flick);
}
`;

const fragmentHead = /* glsl */ `
uniform float uTime;
uniform float uMotion;
uniform vec3 uFallbackColor;
varying float vRegion;
varying float vPhase;
varying vec3 vObj;
float tombHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float tombNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(mix(tombHash(i), tombHash(i + vec3(1,0,0)), f.x), mix(tombHash(i + vec3(0,1,0)), tombHash(i + vec3(1,1,0)), f.x), f.y);
  float b = mix(mix(tombHash(i + vec3(0,0,1)), tombHash(i + vec3(1,0,1)), f.x), mix(tombHash(i + vec3(0,1,1)), tombHash(i + vec3(1,1,1)), f.x), f.y);
  return mix(a, b, f.z);
}
bool tombIs(float r) { return abs(vRegion - r) < 0.5; }
`;

// Replaces <color_fragment>: each region's albedo. vColor is the instance colour —
// the colour the tile was born with.
const colorFragment = /* glsl */ `
// The fragment stage only gets USE_COLOR (three defines USE_INSTANCING_COLOR for
// the vertex stage alone); with an instance colour it carries that colour.
#ifdef USE_COLOR
  vec3 tileCol = vColor;
#else
  vec3 tileCol = uFallbackColor;
#endif
// The colour at full brightness: dark faces (blue, green, red) are dim in linear
// light, and the plaque and rune have to read as that colour, not as grey stone.
vec3 tileHue = tileCol / max(1e-3, max(tileCol.r, max(tileCol.g, tileCol.b)));
float grain = tombNoise(vObj * 46.0) * 0.6 + tombNoise(vObj * 130.0) * 0.4;
if (tombIs(${TOMB_REGION.marble}.0)) {
  // Marble in the tile's colour, with pale veins running through it.
  float vein = smoothstep(0.08, 0.0, abs(tombNoise(vObj * 9.0 + vec3(0.0, 0.0, vObj.x * 6.0)) - 0.5));
  vec3 marble = mix(tileCol, tileHue, 0.45) * (0.82 + 0.18 * grain);
  diffuseColor.rgb = mix(marble, vec3(0.92, 0.9, 0.86), vein * 0.55);
} else if (tombIs(${TOMB_REGION.stone}.0)) {
  vec3 granite = mix(vec3(0.2, 0.2, 0.22), vec3(0.4, 0.4, 0.43), grain);
  // Weathered and mossy toward the ground.
  float low = 1.0 - smoothstep(0.0, 0.16, vObj.z);
  granite = mix(granite, vec3(0.2, 0.3, 0.16), low * 0.45 * smoothstep(0.4, 0.8, grain));
  diffuseColor.rgb = granite;
} else if (tombIs(${TOMB_REGION.earth}.0)) {
  diffuseColor.rgb = mix(vec3(0.12, 0.08, 0.05), vec3(0.24, 0.17, 0.1), grain);
} else if (tombIs(${TOMB_REGION.plaque}.0)) {
  diffuseColor.rgb = vec3(0.035, 0.035, 0.04) + vec3(0.05) * step(0.93, tombHash(floor(vObj * 260.0)));
} else if (tombIs(${TOMB_REGION.rune}.0)) {
  diffuseColor.rgb = tileHue * 0.35;
} else if (tombIs(${TOMB_REGION.spirit}.0)) {
  diffuseColor.rgb = vec3(0.06, 0.08, 0.1);
} else if (tombIs(${TOMB_REGION.flame}.0)) {
  diffuseColor.rgb = vec3(1.0, 0.62, 0.2);
} else {
  diffuseColor.rgb = vec3(0.9, 0.86, 0.76);
}
`;

const roughnessFragment = /* glsl */ `
if (tombIs(${TOMB_REGION.plaque}.0)) roughnessFactor = 0.22;
else if (tombIs(${TOMB_REGION.marble}.0)) roughnessFactor = 0.38;
else if (tombIs(${TOMB_REGION.earth}.0)) roughnessFactor = 1.0;
`;
const metalnessFragment = /* glsl */ `
if (tombIs(${TOMB_REGION.plaque}.0)) metalnessFactor = 0.1;
`;

// Replaces <emissivemap_fragment>: the rune pulses in the tile's colour, the plaque
// keeps a faint glow so the epitaph reads in a dark scene, the flame and spirits light.
const emissiveFragment = /* glsl */ `
float tt = uTime * uMotion;
if (tombIs(${TOMB_REGION.rune}.0)) {
  totalEmissiveRadiance = tileHue * (1.3 + 0.6 * sin(tt * 2.1 + vPhase));
} else if (tombIs(${TOMB_REGION.marble}.0)) {
  // A floor of its own light, so the colour survives a dark scene.
  totalEmissiveRadiance = tileHue * 0.1;
} else if (tombIs(${TOMB_REGION.flame}.0)) {
  totalEmissiveRadiance = vec3(1.9, 0.95, 0.3) * (0.85 + 0.15 * sin(tt * 23.0 + vPhase));
} else if (tombIs(${TOMB_REGION.spirit}.0)) {
  totalEmissiveRadiance = vec3(0.55, 0.85, 1.0) * (0.95 + 0.25 * sin(tt * 3.4 + vPhase));
}
`;

let geometry = null;
let material = null;

/** The one grave geometry, shared by every tombstone. Never dispose it. */
export function getTombstoneGeometry() {
  return geometry ??= buildGrave();
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
let motionWatched = false;
let motionQuery = null;

/** 1 while graves may move, 0 under reduced motion (the in-app setting or the system's). */
function tombMotion() {
  // Read the query the change listener sits on: when the system preference flips,
  // another MediaQueryList (device.js's cached one) can still report the old value.
  const osReduced = motionQuery ? motionQuery.matches : prefersReducedMotion();
  return useGameStore.getState().settings?.reducedMotion || osReduced ? 0 : 1;
}

/** Re-reads both reduced-motion preferences into the shared material's uniform. */
export function syncTombstoneMotion() {
  if (material) material.userData.tombUniforms.uMotion.value = tombMotion();
}

// The material and its uniform are singletons, so a value read once at creation
// would stick for the session: follow the setting and the system preference instead.
function watchTombMotion() {
  if (motionWatched) return;
  motionWatched = true;
  useGameStore.subscribe(state => !!state.settings?.reducedMotion, syncTombstoneMotion);
  motionQuery = (typeof window !== 'undefined' ? window.matchMedia?.(REDUCED_MOTION_QUERY) : null) ?? null;
  motionQuery?.addEventListener?.('change', syncTombstoneMotion);
}

/** The one grave material, shared by every tombstone. Opaque, so it batches. */
export function getTombstoneMaterial() {
  if (material) return material;
  material = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0.04 });
  const uniforms = {
    uTime: sharedUniforms.time,
    uMotion: { value: 1 },
    uFallbackColor: { value: new THREE.Color('#777777') }
  };
  material.userData.tombUniforms = uniforms;
  watchTombMotion();
  syncTombstoneMotion();
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = vertexHead + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertexBody}`);
    shader.fragmentShader = fragmentHead + shader.fragmentShader
      .replace('#include <color_fragment>', colorFragment)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${roughnessFragment}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${metalnessFragment}`)
      .replace('#include <emissivemap_fragment>', emissiveFragment);
  };
  material.customProgramCacheKey = () => 'chaos-tombstone-v5';
  return material;
}

/** The epitaph is gold leaf on the black granite plaque, whatever the tile's colour. */
export const EPITAPH_INK = '#f2d27a';

/** A grave's animation phase in 0..1, stable for its grid id (fed to aInstanceSeed). */
export function tombSeed(gridId = '') {
  let h = 2166136261;
  for (let i = gridId.length - 1; i >= 0; i--) h = Math.imul(h ^ gridId.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/** A grave's own slight turn on its tile, from its grid id, so a row of them is not a parade. */
export function tombYaw(gridId = '') {
  let h = 2166136261;
  for (let i = 0; i < gridId.length; i++) h = Math.imul(h ^ gridId.charCodeAt(i), 16777619);
  return (((h >>> 0) % 1000) / 1000 - 0.5) * 0.5;
}

/**
 * The rise as the stone comes up out of the ground once the tile's implosion ends.
 * Returns [xy, z] scale for t in 0..1: it shoots up past full height and settles.
 */
export function tombRiseScale(t) {
  const u = Math.min(1, Math.max(0, t));
  const c1 = 1.70158, c3 = c1 + 1;
  const back = 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2; // easeOutBack
  const out = 1 - (1 - u) ** 3;
  return [0.55 + 0.45 * out, Math.max(0.001, back)];
}
