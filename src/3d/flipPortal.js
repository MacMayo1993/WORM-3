// src/3d/flipPortal.js
//
// The flipped tile face: a bevelled lens set into the sticker, looking down an
// antipodal tunnel. The frame is real geometry in the tile's current colour, lit
// by the cube's studio rig with a glossy coat; inside it a glass floor shows rings
// sliding down a twisting, parallax tunnel toward a core in the tile's HOME colour
// (the side of the cube it wants to get back to). Two comets in the home colour
// chase round the frame, a light sweep crosses every portal on the cube in world
// space, and the tunnel runs faster as the tile nears its flip cap; on its last
// flip the frame throbs red. A new portal pops open after the flip's crossing.
//
// It replaced a stack of nine-plus effects per flipped tile (a helix ring, crack
// disc, seam leak, neon border, up to four sticker worms, the parity breakthrough
// glows, tally marks), each its own draw, most with a frame callback, and every
// flipped tile kept its sticker's frame loop awake to feed them. On a Mega board
// or mid Chaos storm that was thousands of draws. Every portal is now ONE
// instanced draw through the tile-surface batches (TileSurfaceInstance), opaque
// and depth-written, animated entirely in the shader off the shared tile clock.
//
// Per portal: the current colour arrives as the instance colour; aInstanceData is
// (home rgb in linear light, pressure) where pressure is flips / cap, plus 2 on the
// tile's last flip; aInstanceSeed is the time the portal starts opening, which
// also seeds its phase. Pure module state: built once, never disposed.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { sharedUniforms } from './styles/TileStyleMaterials.jsx';
import { isMobile, prefersReducedMotion } from '../utils/device.js';
import { useGameStore } from '../hooks/useGameStore.js';

// ── Layout (tile units; the sticker is 0.85 across, its face at z = 0) ───────
/** Outer half-size of the frame, before its bevel; the health bar sits below it. */
export const PORTAL_OUTER = 0.37;
/** Half-size of the opening, before the bevel narrows it. */
export const PORTAL_INNER = 0.275;
/** Top of the frame's lip, above the sticker face. Overlays that must stay readable sit above it. */
export const PORTAL_TOP = 0.024;
const FLOOR_Z = 0.005;
const FRAME_DEPTH = 0.01;
const BEVEL_T = 0.006;
const BEVEL_S = 0.008;
const FLOOR_HALF = PORTAL_INNER - BEVEL_S + 0.002;

/** Seconds after the flip starts before the portal opens (the flip's crossing). */
export const PORTAL_OPEN_DELAY = 0.22;
/** Seconds the opening pop takes. */
export const PORTAL_OPEN_DURATION = 0.55;

export const PORTAL_REGION = Object.freeze({ frame: 0, floor: 1 });

function roundedRect(half, radius) {
  const s = new THREE.Shape();
  const h = half, r = radius;
  s.moveTo(-h + r, -h);
  s.lineTo(h - r, -h);
  s.absarc(h - r, -h + r, r, -Math.PI / 2, 0, false);
  s.lineTo(h, h - r);
  s.absarc(h - r, h - r, r, 0, Math.PI / 2, false);
  s.lineTo(-h + r, h);
  s.absarc(-h + r, h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-h, -h + r);
  s.absarc(-h + r, -h + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

function tag(geometry, region) {
  geometry.deleteAttribute('uv');
  const n = geometry.attributes.position.count;
  geometry.setAttribute('aRegion', new THREE.BufferAttribute(new Float32Array(n).fill(region), 1));
  return geometry.index ? geometry.toNonIndexed() : geometry;
}

function buildPortal() {
  const curve = isMobile ? 4 : 6;
  // Frame: a rounded-square ring with a bevelled lip; its inner sides are the
  // walls of the opening.
  const ring = roundedRect(PORTAL_OUTER, 0.1);
  ring.holes.push(roundedRect(PORTAL_INNER, 0.065));
  const frame = new THREE.ExtrudeGeometry(ring, {
    depth: FRAME_DEPTH, bevelEnabled: true, bevelThickness: BEVEL_T, bevelSize: BEVEL_S, bevelSegments: 2, curveSegments: curve
  });
  // Extrusion runs -bevel .. depth + bevel; seat it just above the sticker face.
  frame.translate(0, 0, 0.002 + BEVEL_T);
  // Floor: the glass the tunnel is drawn on, tucked under the frame's walls.
  const floor = new THREE.ShapeGeometry(roundedRect(FLOOR_HALF, 0.055), curve);
  floor.translate(0, 0, FLOOR_Z);
  const geometry = mergeGeometries([tag(frame, PORTAL_REGION.frame), tag(floor, PORTAL_REGION.floor)]);
  geometry.computeBoundingSphere();
  // The opening pop overshoots by ~10%: grow the bound so culling never clips it.
  geometry.boundingSphere.radius *= 1.12;
  return geometry;
}

const glf = (v) => (Number.isInteger(v) ? `${v}.0` : `${v}`);
const LAYERS = isMobile ? 4 : 6;

const vertexHead = /* glsl */ `
attribute float aRegion;
#ifdef USE_INSTANCING
attribute float aInstanceSeed;
attribute vec4 aInstanceData;
#endif
uniform float uTime;
uniform float uMotion;
uniform vec4 uFallbackData;
varying float vRegion;
varying vec3 vObj;
varying vec3 vViewT;
varying vec3 vWorldP;
varying vec4 vData;
varying float vOpen;
varying float vPhase;
`;

// Runs after <begin_vertex>: `transformed` is the tile-space position.
const vertexBody = /* glsl */ `
vRegion = aRegion;
vObj = position;
#ifdef USE_INSTANCING
  vData = aInstanceData;
  float pStart = aInstanceSeed;
#else
  vData = uFallbackData;
  float pStart = -1e6;
#endif
vPhase = fract(pStart * 0.6180339);
float pSince = uTime - pStart;
// A start far in the future is a clock that restarted under a live portal: open.
float pOpen = (pSince < -1.0 || uMotion < 0.5) ? 1.0 : clamp(pSince / ${glf(PORTAL_OPEN_DURATION)}, 0.0, 1.0);
vOpen = pOpen;
float pU = pOpen - 1.0;
float pPop = pOpen <= 0.0 ? 0.0 : 1.0 + 2.70158 * pU * pU * pU + 1.70158 * pU * pU; // easeOutBack
transformed.xy *= max(pPop, 1e-4);
transformed.z *= clamp(pOpen * 1.6, 1e-4, 1.0);

mat4 pModel = modelMatrix;
#ifdef USE_INSTANCING
  pModel = modelMatrix * instanceMatrix;
#endif
vec4 pWorld = pModel * vec4(transformed, 1.0);
vWorldP = pWorld.xyz;
// The eye in the tile's own frame (its axes are orthogonal, maybe scaled), for
// the tunnel's parallax.
vec3 pToCam = cameraPosition - pWorld.xyz;
vec3 pX = pModel[0].xyz, pY = pModel[1].xyz, pZ = pModel[2].xyz;
vViewT = vec3(dot(pX, pToCam) / dot(pX, pX), dot(pY, pToCam) / dot(pY, pY), dot(pZ, pToCam) / dot(pZ, pZ));
`;

const fragmentHead = /* glsl */ `
uniform float uTime;
uniform float uMotion;
uniform vec3 uFallbackColor;
varying float vRegion;
varying vec3 vObj;
varying vec3 vViewT;
varying vec3 vWorldP;
varying vec4 vData;
varying float vOpen;
varying float vPhase;
float portalBox(vec2 p, float h, float r) {
  vec2 q = abs(p) - vec2(h - r);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
vec3 portalHue(vec3 c) { return c / max(1e-3, max(c.r, max(c.g, c.b))); }
`;

// Replaces <color_fragment>. vColor is the instance colour: the tile's current face.
const colorFragment = /* glsl */ `
#ifdef USE_COLOR
  vec3 pCur = vColor;
#else
  vec3 pCur = uFallbackColor;
#endif
bool pFloor = vRegion > 0.5;
// The frame is the tile's colour in plastic; the floor is dark glass over the light.
diffuseColor.rgb = pFloor ? pCur * 0.16 : pCur;
`;

const roughnessFragment = /* glsl */ `
roughnessFactor = pFloor ? 0.06 : 0.26;
`;
const metalnessFragment = /* glsl */ `
metalnessFactor = pFloor ? 0.0 : 0.12;
`;

// Replaces <emissivemap_fragment>: the tunnel, the comets, the sweep and the warning.
const emissiveFragment = /* glsl */ `
float pT = uTime * uMotion;
vec3 pHome = vData.rgb;
float pDanger = step(1.5, vData.w);
float pRatio = clamp(vData.w - 2.0 * pDanger, 0.0, 1.0);
vec3 pCurHue = portalHue(pCur);
vec3 pHomeHue = portalHue(pHome);
vec3 pV = normalize(vViewT);
vec3 pE;
if (pFloor) {
  // Rings slide down a twisting tunnel; each sits on a virtual plane below the
  // glass, so they part and shift with the eye like a real well.
  vec2 pOff = pV.xy / max(pV.z, 0.3);
  float pSpeed = 0.2 + pRatio * 0.6;
  pE = pCurHue * 0.3;
  for (int i = 0; i < ${LAYERS}; i++) {
    float t = fract((float(i) + pT * pSpeed * ${glf(LAYERS)} * 0.25) / ${glf(LAYERS)});
    float depth = 0.012 + t * t * 0.5;
    vec2 q = vObj.xy - pOff * depth;
    float a = t * 1.7 + pT * 0.3 + vPhase * 6.2831853;
    float ca = cos(a), sa = sin(a);
    q = vec2(ca * q.x - sa * q.y, sa * q.x + ca * q.y);
    float d = portalBox(q, 0.245 * (1.0 - 0.8 * t), 0.012 + 0.045 * (1.0 - t));
    float w = 0.006 + 0.008 * (1.0 - t);
    float ring = exp(-d * d / (w * w));
    float fade = smoothstep(0.0, 0.15, t) * (1.0 - smoothstep(0.7, 1.0, t));
    pE += mix(pCurHue, pHomeHue, smoothstep(0.3, 0.9, t)) * ring * fade * (1.5 - 0.7 * t);
  }
  // The far end: the home colour, with a white-hot star.
  vec2 qc = vObj.xy - pOff * 0.6;
  float r2 = dot(qc, qc);
  pE += pHomeHue * exp(-r2 / 0.004) * (1.3 + 0.3 * sin(pT * 3.0 + vPhase * 6.2831853));
  pE += pHomeHue * (1.0 - smoothstep(0.045, 0.075, sqrt(r2))) * 0.9;
  pE += vec3(exp(-r2 / 0.00025));
  pE += vec3(0.5) * (exp(-abs(qc.x) * 110.0 - abs(qc.y) * 14.0) + exp(-abs(qc.y) * 110.0 - abs(qc.x) * 14.0));
  // The walls shade the mouth: depth, and the floor's edge never reads as a cut.
  float pEdge = portalBox(vObj.xy, ${glf(FLOOR_HALF)}, 0.055);
  pE *= 0.45 + 0.55 * smoothstep(0.0, -0.07, pEdge);
} else {
  // Comets in the home colour chase round the lip, faster under pressure.
  float s = atan(vObj.y, vObj.x) / 6.2831853 + 0.5;
  float comet = 0.0;
  for (int k = 0; k < 2; k++) {
    float head = fract(pT * (0.09 + pRatio * 0.4) + float(k) * 0.5 + vPhase);
    float sd = fract(s - head + 0.5) - 0.5;
    comet += exp(-sd * sd / 0.0012) + (sd < 0.0 ? exp(sd / 0.06) * 0.4 : 0.0);
  }
  float top = smoothstep(${glf(PORTAL_TOP - 0.012)}, ${glf(PORTAL_TOP - 0.002)}, vObj.z);
  float lip = 1.0 - smoothstep(${glf(PORTAL_INNER - 0.01)}, ${glf(PORTAL_INNER + 0.03)}, max(abs(vObj.x), abs(vObj.y)));
  pE = pCurHue * 0.12;
  pE += mix(pHomeHue, vec3(1.0), clamp(comet - 0.7, 0.0, 1.0) * 0.6) * comet * top * 1.3;
  // Tunnel light spilling up the inner walls.
  pE += pCurHue * lip * (0.8 + 0.2 * sin(pT * 2.0 + vPhase * 6.2831853));
  // Last flip: the frame throbs red.
  pE = mix(pE, vec3(1.6, 0.12, 0.06) * (0.55 + 0.45 * sin(pT * 9.0)), pDanger * 0.75);
}
// One light sweep crosses every portal on the cube in world space.
float pPh = fract(dot(vWorldP, vec3(0.6, 0.72, 0.35)) * 0.16 - pT * 0.11) - 0.5;
pE += mix(pCurHue, vec3(1.0), 0.6) * exp(-pPh * pPh / 0.0006) * (pFloor ? 0.32 : 0.22);
// The pop of the opening.
pE += mix(pCurHue, vec3(1.0), 0.5) * sin(vOpen * 3.14159265) * 1.4;
totalEmissiveRadiance = pE;
`;

let geometry = null;
let material = null;

/** The one portal geometry, shared by every flipped tile. Never dispose it. */
export function getFlipPortalGeometry() {
  return geometry ??= buildPortal();
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
let motionWatched = false;
let motionQuery = null;

function portalMotion() {
  const osReduced = motionQuery ? motionQuery.matches : prefersReducedMotion();
  return useGameStore.getState().settings?.reducedMotion || osReduced ? 0 : 1;
}

/** Re-reads both reduced-motion preferences into the shared material's uniform. */
export function syncFlipPortalMotion() {
  if (material) material.userData.portalUniforms.uMotion.value = portalMotion();
}

function watchPortalMotion() {
  if (motionWatched) return;
  motionWatched = true;
  useGameStore.subscribe(state => !!state.settings?.reducedMotion, syncFlipPortalMotion);
  motionQuery = (typeof window !== 'undefined' ? window.matchMedia?.(REDUCED_MOTION_QUERY) : null) ?? null;
  motionQuery?.addEventListener?.('change', syncFlipPortalMotion);
}

/** The shared portal shader with an owned clock. Opaque, so preview faces batch too. */
export function createFlipPortalMaterial(time = sharedUniforms.time, motion = { value: 1 }) {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.26, metalness: 0.12 });
  const uniforms = {
    uTime: time,
    uMotion: motion,
    uFallbackColor: { value: new THREE.Color('#888888') },
    uFallbackData: { value: new THREE.Vector4(1, 1, 1, 0) }
  };
  material.userData.portalUniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = vertexHead + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertexBody}`);
    shader.fragmentShader = fragmentHead + shader.fragmentShader
      .replace('#include <color_fragment>', colorFragment)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${roughnessFragment}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${metalnessFragment}`)
      .replace('#include <emissivemap_fragment>', emissiveFragment);
  };
  material.customProgramCacheKey = () => `flip-portal-v1-${LAYERS}`;
  return material;
}

/** Gameplay owns one material; previews own their clocks and dispose their materials. */
export function getFlipPortalMaterial() {
  if (!material) {
    material = createFlipPortalMaterial();
    watchPortalMotion();
    syncFlipPortalMotion();
  }
  return material;
}

const _home = new THREE.Color();

/**
 * aInstanceData for a portal: the home colour in linear light and its pressure,
 * flips / cap, plus 2 on the tile's last flip (the shader splits them again).
 */
export function flipPortalData(homeHex, flips, flipCap) {
  _home.set(homeHex);
  const cap = flipCap > 0 ? flipCap : 0;
  const ratio = cap ? Math.min(1, Math.max(0, flips / cap)) : 0;
  const last = cap > 0 && cap - flips <= 1;
  return [_home.r, _home.g, _home.b, ratio + (last ? 2 : 0)];
}

// When each sticker's current portal started opening, by the sticker's own
// identity (not its slot: Chaos and WORM key stickers by grid slot, and a slice
// turn hands a slot a different sticker), with the flip count it opened on. A
// remount after a slice turn or a view change keeps the portal open; only a new
// flip opens it afresh. One entry per sticker that ever flipped, so it stays small.
const openings = new Map();

/** The shared clock time this sticker's portal starts opening (aInstanceSeed). */
export function flipPortalStart(identity, flips, now = sharedUniforms.time.value) {
  const held = openings.get(identity);
  if (held && held.flips === flips) return held.start;
  const start = now + PORTAL_OPEN_DELAY;
  openings.set(identity, { flips, start });
  return start;
}

/** A healed tile can open again with the same flip count on its next infection. */
export function forgetFlipPortalOpening(identity) {
  openings.delete(identity);
}

/** Forgets every portal's opening (tests, and a fresh cube). */
export function resetFlipPortalOpenings() {
  openings.clear();
}

/**
 * Compiles the instanced portal program ahead of the first flip, the variant the
 * tile-surface batch draws (instance colour, seed and data attributes), lit by
 * `targetScene`'s lights and environment as the live one is.
 */
export function warmFlipPortal(renderer, camera, targetScene = null) {
  if (typeof renderer?.compile !== 'function') return;
  const view = new THREE.BufferGeometry();
  const source = getFlipPortalGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) view.setAttribute(name, attribute);
  view.setAttribute('aInstanceSeed', new THREE.InstancedBufferAttribute(new Float32Array(1), 1));
  view.setAttribute('aInstanceData', new THREE.InstancedBufferAttribute(new Float32Array(4), 4));
  const mesh = new THREE.InstancedMesh(view, getFlipPortalMaterial(), 1);
  mesh.setColorAt(0, _home.set('#ffffff'));
  const scene = new THREE.Scene();
  scene.add(mesh);
  try { renderer.compile(scene, camera, targetScene ?? scene); } finally {
    scene.clear();
    for (const name of Object.keys(view.attributes)) if (name !== 'aInstanceSeed' && name !== 'aInstanceData') view.deleteAttribute(name);
    view.dispose();
    mesh.dispose?.();
  }
}
