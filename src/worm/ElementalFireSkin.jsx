// src/worm/ElementalFireSkin.jsx
//
// The FIRE element's cube skin: the cube is actually on fire, using the exact
// flame the bombs use.
//
// It replaces a shader "lava" surface that drew molten runoff across each sticker.
// On a flat, brightly-patterned tile that read as orange squiggles — you could not
// tell it was meant to be lava at all. Fire is legible for the same reason the
// bomb detonations are: teardrop flame sprites, white-hot at the base, flickering
// and licking off the surface.
//
// ── Which way is up ──────────────────────────────────────────────────────────
// Off the face normal, not off the screen. The tongues used to be full camera
// billboards — quad extruded along the view's own up axis — so every face's fire
// climbed up-screen no matter which way that face pointed, and the whole cube read
// as one flat decal of identical flames. Each face now burns OUTWARD along its own
// normal: +Y burns up, -Y burns down, ±X burn sideways, ±Z burn at the viewer and
// away. The tongues keep facing the camera by spinning about that normal (an
// axis-locked billboard), so they stay broadside without ever leaving their axis.
// The ember bed lies flat in the tile plane, because a crust is part of the surface
// rather than something standing off it.
//
// ── Why this is one mesh and not 900 sprites ─────────────────────────────────
// The first version mounted this component once per cover cell, and each copy owned
// FLAMES_PER_CELL <sprite> objects, an ember sprite, and its own useFrame callback.
// On a full board that is ~150 React subtrees, ~900 sprites — every one of them a
// separate draw call — and 150 per-frame callbacks doing the flicker arithmetic on
// the CPU. Fire was several times the cost of every other element and it showed on
// anything but a desktop GPU.
//
// It is now a single InstancedMesh. The geometry holds one quad per flame plus the
// ember bed and a couple of ember sparks (so a whole cell is a few dozen vertices),
// the instance matrix carries the cell's live transform, and a per-instance seed
// drives the same jitter the CPU used to compute. Billboarding, flicker, sway,
// curl, lift and the spark cycle all happen in the vertex shader, so the burning
// cube costs ONE draw call and zero per-frame CPU work beyond the transform loop
// the skin already runs for every element.
//
// The jitter hash is reproduced from elementalSeeds.hashSeed verbatim, so a given
// cell burns the same way it did when the numbers were computed in JS.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { FLAME_TEX } from './healerWorm/HealerBombs.jsx';
import { getSoftGlowTexture } from './healerWorm/elementalBadge.jsx';
import { sharedUniforms } from '../3d/styles/TileStyleMaterials.jsx';
import { sparksForBudget } from './healerWorm/elementalQuality.js';

// Flame footprint inside a 1×1 cell. Several small tongues per cell read as a
// burning surface; two big ones read as a candle sitting on the sticker.
// Wider tongues so each one covers more of its cell — a big cover cell on a mega
// board was left mostly bare between a few narrow licks.
const FLAME_W = 0.4;
// Tongue height in cell units. Density (flame count/width) carries the "on fire"
// read now, so height is kept short: tongues lick the surface and stay mostly
// under one cell, instead of throwing spikes a tile or more above the cube's top
// edge. With the length spread and gentle silhouette boost this peaks near ~0.9
// cells at the very hottest up-facing corner and sits ~0.45 across the rest.
const FLAME_H = 0.46;
// The quad grows away from its anchor rather than being centred on it, and the
// anchor sits just below the surface, so the base of every tongue is buried in the
// tile instead of floating a hair above it.
const FLAME_CENTER_Y = 0.08;

// Quad kinds. Kept as an attribute rather than three separate draws so the whole
// cube — crust, tongues and sparks — stays one instanced mesh.
const KIND_BED = 0;
const KIND_TONGUE = 1;
const KIND_SPARK = 2;

// Per-vertex corner offsets for one quad, and the two triangles over them.
const QUAD_CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]];
const QUAD_INDICES = [0, 1, 2, 0, 2, 3];

/**
 * Geometry for ONE cell: a wide ember bed, `flamesPerCell` tongue quads, and
 * `sparksPerCell` ember sparks.
 *
 * `position` carries the corner in local cell space purely so the bounding box is
 * sane; the shader rebuilds every vertex from `uv`, `aKind` and `aIndex` anyway.
 */
function buildFlameCellGeometry(flamesPerCell, sparksPerCell) {
  const quads = 1 + flamesPerCell + sparksPerCell;
  const verts = quads * 4;
  const position = new Float32Array(verts * 3);
  const uv = new Float32Array(verts * 2);
  const aKind = new Float32Array(verts);
  const aIndex = new Float32Array(verts);
  const index = new Uint16Array(quads * 6);

  for (let q = 0; q < quads; q++) {
    // Quad 0 is the ember bed, then the tongues, then the sparks.
    let kind = KIND_BED;
    let slot = 0;
    if (q > 0 && q <= flamesPerCell) {
      kind = KIND_TONGUE;
      slot = q - 1;
    } else if (q > flamesPerCell) {
      kind = KIND_SPARK;
      slot = q - flamesPerCell - 1;
    }
    for (let c = 0; c < 4; c++) {
      const v = q * 4 + c;
      const [cx, cy] = QUAD_CORNERS[c];
      position[v * 3] = cx - 0.5;
      position[v * 3 + 1] = cy - 0.5;
      position[v * 3 + 2] = 0.12;
      uv[v * 2] = cx;
      uv[v * 2 + 1] = cy;
      aKind[v] = kind;
      aIndex[v] = slot;
    }
    for (let t = 0; t < 6; t++) index[q * 6 + t] = q * 4 + QUAD_INDICES[t];
  }

  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('aKind', new THREE.BufferAttribute(aKind, 1));
  geo.setAttribute('aIndex', new THREE.BufferAttribute(aIndex, 1));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  return geo;
}

const vertexShader = /* glsl */`
  uniform float uTime;
  // 0 freezes every animated term (reduced motion) — the fire still burns, it just
  // holds one frame of it.
  uniform float uAnim;
  // (intensity, claim, release, unused) — the shared elemental envelope.
  uniform vec4 uEnv;
  attribute float aKind;    // per-vertex: 0 ember bed, 1 tongue, 2 spark
  attribute float aIndex;   // per-vertex: which tongue/spark within the cell
  attribute float aSeed;    // per-instance: the cover cell's stable identity
  attribute vec4 aCell;     // per-instance: (rim, edge, corner, seed) on the cube
  attribute float aSweep;   // per-instance: share of the claim sweep before arrival
  varying vec2 vUv;
  varying float vKind;
  varying float vHeat;      // 0..1 how hot this quad is burning right now
  varying float vSeed;      // per-quad, for de-correlating the fragment turbulence
  varying float vAlpha;     // claim/expiry gate, and the spark's own life curve

  // elementalSeeds.hashSeed / hashSeed2, verbatim.
  float h1(float s, float i) { return fract(sin((s + 1.0) * 12.9898 + i * 78.233) * 43758.5453); }
  float h2(float s, float i) { return fract(sin((s + 1.0) * 39.3468 + i * 11.135) * 24634.6345); }

  void main() {
    vUv = uv;
    vKind = aKind;
    vSeed = aSeed * 0.37 + aIndex * 3.17;

    float T = uTime * uAnim;

    #ifdef USE_INSTANCING
      mat4 cellMatrix = modelMatrix * instanceMatrix;
    #else
      mat4 cellMatrix = modelMatrix;
    #endif

    // The cell's own frame: +Z is the face normal (the direction this patch of cube
    // faces), X and Y span the tile. Every offset below is expressed in this frame,
    // which is what makes each face burn along its own outward axis.
    vec3 cellWorld = cellMatrix[3].xyz;
    vec3 nrm  = normalize((cellMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
    vec3 tanX = normalize((cellMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
    vec3 tanY = normalize((cellMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    // A sprite takes its on-screen size from world scale, so the cell's uniform
    // scale (which carries the claim/expiry ramp) has to multiply every offset.
    float cellScale = length(cellMatrix[0].xyz);

    // ── Gust bands ───────────────────────────────────────────────────────────
    // A slow plane wave through world space, so neighbouring cells rise and fall
    // TOGETHER and the fire moves across the cube in bands. Every cell flickering
    // on its own timer is what made the first version read as a grid of identical
    // campfires rather than as one burning object.
    float gust = 0.5 + 0.5 * sin(dot(cellWorld, vec3(0.62, 0.31, 0.47)) * 1.15 - T * 1.35);

    // Fire shows most where the surface ends. Tongues run taller on the cells that
    // sit on a cube edge, taller again at the corners, and taller still on faces
    // pointing skyward — which gives the burning cube a silhouette instead of an
    // even fur of flame. Real fire also climbs, so an up-facing normal throws
    // furthest even though every face still burns along its own axis.
    float upFacing = max(0.0, dot(nrm, vec3(0.0, 1.0, 0.0)));
    // Silhouette boost, kept small: edges and corners burn only a touch taller so
    // the cube keeps a flame outline without the top/up-facing row spiking above
    // everything else — those tall spikes over the top edge were this term. (Was
    // 0.32/0.24/0.30, then 0.18/0.14/0.18.)
    float tall = 1.0 + 0.10 * aCell.y + 0.08 * aCell.z + 0.10 * upFacing;

    // The claim sweep: each cell catches only when the sweep reaches it. The tail
    // (uEnv.z) stops the accents first, before the skin itself dissolves.
    float arrive = smoothstep(aSweep, aSweep + 0.30, uEnv.y);
    float tail = 1.0 - smoothstep(0.0, 0.45, uEnv.z);

    vec3 world;

    if (aKind < 0.5) {
      // ── Ember bed: flat on the tile ────────────────────────────────────────
      // Laid out in the tile plane rather than billboarded, so the crust belongs to
      // the surface. Without it each cell reads as a few discrete flames sitting ON
      // a tile; with it the tile itself looks like it is burning.
      float pulse = 0.88 + 0.12 * sin(T * 2.6 + aSeed * 1.7);
      vec2 size = vec2(0.99, 0.99) * pulse * arrive;
      vec2 off = (uv - 0.5) * size * cellScale;
      vec3 anchor = (cellMatrix * vec4(0.0, 0.0, 0.03, 1.0)).xyz;
      world = anchor + tanX * off.x + tanY * off.y;
      vHeat = 0.35 + 0.40 * gust;
      // A face turned toward the camera loses its tongues (see below) and has only
      // the crust left to carry it, so the crust burns hotter exactly there. Across
      // the whole cube the two hand off: silhouette faces throw flame, the face you
      // are looking straight at glows.
      float head = abs(dot(nrm, normalize(cameraPosition - cellWorld)));
      vAlpha = arrive * (0.70 + 0.75 * head * head);

    } else if (aKind < 1.5) {
      // ── Tongues: axis-locked billboards climbing the face normal ───────────
      float r1 = h1(aSeed, aIndex);
      float r2 = h2(aSeed, aIndex);
      float r3 = h1(aSeed * 1.7 + 3.0, aIndex * 2.3 + 1.0);
      float phase = (r1 + r2) * 6.2831853;
      float rate = 6.5 + r2 * 7.0;
      // Length spread: a few taller leaders over a bed of short stubs layers the
      // fire. Spread tightened so the tallest leaders stay close to the pack rather
      // than shooting off the top edge as lone spikes.
      float scl = 0.44 + r2 * 0.48;
      // Two beats, not one: a fast lick over a slower breath, so no two tongues
      // ever quite repeat and none of them pulses like a metronome.
      float flick = 0.70 + 0.42 * sin(T * rate + phase) + 0.18 * sin(T * rate * 1.93 + phase * 1.7);
      // The gust rides ON the per-tongue flicker rather than replacing it: the
      // tongue keeps its own life, the band decides how far it gets to throw.
      float band = (0.70 + 0.52 * gust) * tall * arrive;
      vHeat = clamp(0.28 + 0.55 * gust + 0.32 * (aCell.y * 0.5 + upFacing * 0.5), 0.0, 1.0);

      vec2 size = vec2(${FLAME_W} * scl * (0.85 + 0.25 * flick),
                       ${FLAME_H} * scl * (0.78 + 0.48 * flick) * band);

      // Root the tongue somewhere inside the tile, in the tile's own plane.
      vec3 anchor = (cellMatrix * vec4((r1 - 0.5) * 0.62, (r3 - 0.5) * 0.62, 0.02, 1.0)).xyz;

      // Splay: each tongue leaves along its own axis, tilted a little off the face
      // normal. Still outward — the axis never falls below the surface — but the
      // fan stops looking like a starburst of parallel petals.
      vec3 axis = normalize(nrm + (tanX * (r1 - 0.5) + tanY * (r3 - 0.5)) * 0.42);

      // Spin the quad about that axis to face the camera. Broadside from any angle,
      // but never tipped off the axis — which is the whole difference between fire
      // that climbs off the face and fire that climbs off the screen.
      vec3 toCam = normalize(cameraPosition - anchor);
      vec3 side = cross(axis, toCam);
      float sideLen = length(side);
      side = sideLen > 1e-4 ? side / sideLen : tanX;
      // sideLen is the sine of the angle between the flame axis and the view. Near
      // zero the camera is looking straight down the axis, where an axis-locked
      // quad degenerates into a blob pointed at the lens — so the tongue fades out
      // before it can get there rather than smearing across the tile.
      float facing = smoothstep(0.16, 0.52, sideLen);

      vec2 off = (uv - vec2(0.5, ${FLAME_CENTER_Y})) * size * cellScale;
      // Taper: full width at the root, pinched toward the tip, so the silhouette is
      // a flame rather than a rectangle wearing a flame texture. Gentle, and eased —
      // a hard linear pinch turned every tongue into a dart.
      off.x *= 1.0 - 0.34 * smoothstep(0.15, 1.0, uv.y);
      // Curl: the tip leans and drifts while the root stays planted.
      float lean = (sin(T * rate * 0.45 + phase) * 0.55 + (r1 - 0.5) * 0.7) * 0.34;
      float curl = lean * uv.y * uv.y * scl * cellScale;

      world = anchor + side * (off.x + curl) + axis * off.y;
      vAlpha = arrive * facing;

    } else {
      // ── Sparks: embers thrown off the face, along the face's own normal ────
      float r1 = h1(aSeed + 7.0, aIndex);
      float r2 = h2(aSeed + 7.0, aIndex);
      float life = 1.15 + r2 * 0.95;
      float age = fract((T + r1 * 7.0) / life);
      float rise = age * (0.72 + r2 * 0.62) * tall;
      float sz = (0.10 + r1 * 0.07) * (1.0 - 0.45 * age);

      vec3 anchor = (cellMatrix * vec4((r1 - 0.5) * 0.7, (r2 - 0.5) * 0.7, 0.05, 1.0)).xyz;
      // Wander as it climbs — an ember caught in the draught, not a tracer round.
      vec3 drift = tanX * sin(T * 1.7 + r1 * 9.0) * 0.11 * age
                 + tanY * cos(T * 1.4 + r2 * 9.0) * 0.11 * age;
      vec3 base = anchor + (drift + nrm * rise) * cellScale;

      // Sparks are round, so they take a full camera billboard.
      vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
      vec3 up    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
      vec2 off = (uv - 0.5) * sz * cellScale;
      world = base + right * off.x + up * off.y;

      vHeat = 1.0 - age;
      // Fade in and out over the ember's own life so none of them pop.
      vAlpha = arrive * tail * uAnim * sin(age * 3.14159265) * (0.55 + 0.45 * gust);
    }

    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  // No precision qualifier here on purpose: three's default prologue gives both
  // stages the same one, and pinning the fragment to mediump made uTime's
  // precision disagree between the two — which fails program validation outright.
  uniform sampler2D uFlameTex;
  uniform sampler2D uGlowTex;
  uniform vec3 uFlameColor;
  uniform vec3 uEmberColor;
  uniform vec3 uCrustColor;
  uniform vec3 uCoreColor;
  uniform vec3 uMidColor;   // bright yellow cel band between orange body and core
  uniform float uTime;
  uniform float uAnim;
  varying vec2 vUv;
  varying float vKind;
  varying float vHeat;
  varying float vSeed;
  varying float vAlpha;

  // Cheap value noise. The teardrop sprite alone gives every tongue the identical
  // smooth outline; eroding it with a scrolling turbulence field is what turns a
  // row of decals into fire with structure inside it.
  float hashN(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hashN(i);
    float b = hashN(i + vec2(1.0, 0.0));
    float c = hashN(i + vec2(0.0, 1.0));
    float d = hashN(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float turbulence(vec2 p) {
    #ifdef FIRE_HQ
      return vnoise(p) * 0.66 + vnoise(p * 2.3 + 11.0) * 0.34;
    #else
      return vnoise(p);
    #endif
  }

  void main() {
    float T = uTime * uAnim;

    // Turbulence, scrolling down the quad so the pattern appears to rise through the
    // flame. Coarser than a realistic fire on purpose: bigger, slower cells so the
    // silhouette breaks into a few bold cartoon lobes rather than a fine photoreal
    // boil. A wide slow field leans the whole tongue under a chunkier detail field.
    float n = turbulence(vec2(vUv.x * 1.7 + vSeed, vUv.y * 2.7 - T * 1.85 + vSeed)) * 0.62
            + turbulence(vec2(vUv.x * 0.9 - vSeed, vUv.y * 1.2 - T * 0.70)) * 0.38;

    // The flame sprite is a hard-edged fill, so eroding its alpha does nothing —
    // the alpha steps 0 → 1 within a pixel and every tongue keeps the same smooth
    // teardrop outline. Displacing the LOOKUP is what makes the silhouette move:
    // the edge wanders with the turbulence, more the higher up the tongue it is.
    vec2 warp = vec2((n - 0.5) * 0.30 * smoothstep(0.05, 1.0, vUv.y), 0.0);

    // Every fetch is unconditional: a fetch inside divergent flow has undefined
    // derivatives, and three cheap fetches beat branching around them.
    vec4 flameTex = texture2D(uFlameTex, vUv + warp);
    vec4 flameFlat = texture2D(uFlameTex, vUv);
    vec4 glowTex = texture2D(uGlowTex, vUv);

    vec3 col;
    float a;

    if (vKind < 0.5) {
      // ── The ember bed: crust, not campfire ─────────────────────────────────
      // Near-black red where the surface is banked over, opening to hot orange in
      // the gaps between tiles and along a few noise fissures — so the cube reads
      // as something burning from within rather than as a glow decal per sticker.
      // Keeping the centre dark is also what leaves the tile's own colour and
      // markings legible.
      // Chebyshev distance to the cell border, broken up by the noise so the seam
      // light is an uneven crack rather than a neat square outline drawn round every
      // sticker. The ramp is wide and pushed outward, so the heat is concentrated in
      // the last of the tile and falls off gently toward the middle.
      float rim = max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)) * 2.0;
      float gap = smoothstep(0.30, 1.02, rim + (n - 0.5) * 0.42);
      float fissure = smoothstep(0.52, 0.90, n) * smoothstep(0.15, 0.75, rim);
      col = mix(uCrustColor, uEmberColor, clamp(gap * (0.45 + 0.55 * vHeat) + fissure * 0.5 * vHeat, 0.0, 1.0));
      col = mix(col, uCoreColor, fissure * gap * 0.30 * vHeat);
      // Shaped by the gaps and the fissures, NOT by a radial glow sprite: the glow
      // is brightest at the middle of the cell and zero at its border, which is the
      // exact inverse of where a crust should be hot, and it cancelled the seam
      // light entirely — the bed may as well not have been drawn.
      a = (0.07 + 0.26 * gap + 0.24 * fissure * (0.4 + 0.6 * vHeat)) * vAlpha;

    } else if (vKind < 1.5) {
      // ── The tongues: cel-shaded cartoon flame, layered in flat colour bands ──
      // The silhouette (mask) and the colour (heat) are computed separately: the
      // mask is a ragged flame outline, and inside it the colour steps through hard
      // onion-layers — deep red rim, orange body, bright yellow, white-hot core —
      // the way a hand-drawn flame is painted, instead of one smooth gradient.
      float mask = flameTex.a;
      // Ragged, lobed tip — the chunky noise makes it end in a couple of rounded
      // cartoon fingers that detach and re-form rather than one smooth teardrop.
      mask *= 1.0 - smoothstep(0.40, 1.0, vUv.y + (n - 0.5) * 0.85);
      // Feather the sides so the taper never leaves a hard vertical cut.
      mask *= smoothstep(0.0, 0.12, 1.0 - abs(vUv.x - 0.5) * 2.0);

      // Heat field: hottest at the base and along the tongue's spine, cooling as it
      // climbs and spreads. The chunky noise shoves the bands around so the layers
      // wobble like real cartoon flame rather than sitting in neat stripes.
      float spine = 1.0 - abs(vUv.x - 0.5) * 2.0;
      float heat = (1.0 - vUv.y) * 0.82 + spine * 0.30 + (n - 0.5) * 0.70;
      heat = clamp(heat * (0.72 + 0.5 * vHeat), 0.0, 1.0);

      // Posterize into four flat cel bands with crisp edges (step, not mix).
      float band = floor(heat * 4.0);
      col = uEmberColor;                          // 0: red rim / outer tip
      col = mix(col, uFlameColor, step(0.5, band)); // 1: orange body
      col = mix(col, uMidColor,   step(1.5, band)); // 2: bright yellow
      col = mix(col, uCoreColor,  step(2.5, band)); // 3: white-hot core

      // Bright edge highlight — a cartoon flame's ink outline, done as a light rim
      // because the blend is additive (it can brighten a silhouette, not darken it).
      float edge = smoothstep(0.02, 0.16, mask) * (1.0 - smoothstep(0.16, 0.40, mask));
      col += uMidColor * edge * 0.55;
      col *= 0.88 + 0.30 * vHeat;

      // The blend is additive, so a cooling tip has to lose light, not gain black.
      a = mask * (0.52 + 0.32 * vHeat) * (1.0 - 0.38 * smoothstep(0.58, 1.0, vUv.y)) * vAlpha;

    } else {
      // ── The sparks: gold at birth, cooling to ember red ────────────────────
      col = mix(uEmberColor, uCoreColor, vHeat * vHeat);
      a = glowTex.a * vAlpha * 0.9;
    }

    gl_FragColor = vec4(col, a);
  }
`;

// Shared materials, one per detail level. Module-scoped and never disposed by a
// mounting component — the transient geometry is per-mount, but these outlive it,
// exactly like the surface elements' cached material.
// Exported so the elemental warm-up can pre-compile both detail levels during the
// frozen scramble phase rather than at the moment a FIRE orb is claimed.
const _fireMats = new Map();
export function getFlameMaterial(highDetail) {
  const key = highDetail ? 'hq' : 'lq';
  let mat = _fireMats.get(key);
  if (!mat) {
    mat = new THREE.ShaderMaterial({
      defines: highDetail ? { FIRE_HQ: '' } : {},
      uniforms: {
        uTime: sharedUniforms.time, // ticked by CubeAssembly every frame
        uAnim: { value: 1 },
        uFlameTex: { value: FLAME_TEX },
        uGlowTex: { value: getSoftGlowTexture() },
        // Punchy, saturated cartoon palette: the cel bands read as distinct flat
        // colours, so each one is pushed toward its purest hue.
        uFlameColor: { value: new THREE.Color('#ff6a12') }, // orange body
        uEmberColor: { value: new THREE.Color('#f23205') }, // deep red rim / tip
        uMidColor: { value: new THREE.Color('#ffcf29') },   // bright yellow band
        // Near-black red crust → orange body → bright yellow → white-hot core.
        uCrustColor: { value: new THREE.Color('#2e0703') },
        uCoreColor: { value: new THREE.Color('#fff3c8') },
        uEnv: { value: new THREE.Vector4(1, 1, 0, 0) }
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    _fireMats.set(key, mat);
  }
  return mat;
}

/**
 * The burning skin for every cover cell at once.
 *
 * The caller owns the instance matrices: ElementalCubeSkin's single frame loop
 * writes each cell's live transform straight into `instanceMatrix`, the same loop
 * that drives every other element. Nothing here runs per frame on the CPU.
 *
 * @param {number}  count          number of cover cells
 * @param {number}  flamesPerCell  from the quality budget
 * @param {boolean} animate        false under reduced motion: the fire holds still
 * @param {boolean} highDetail     second turbulence octave (desktop tiers)
 * @param {object}  cellData       per-cell masks and sweep shares from the skin
 * @param {object}  meshRef        ref the skin writes instance matrices through
 */
export default function ElementalFireSkin({
  count,
  flamesPerCell = 5,
  animate = true,
  highDetail = true,
  cellData,
  meshRef
}) {
  const sparksPerCell = sparksForBudget(flamesPerCell, animate);

  const geometry = useMemo(() => {
    const geo = buildFlameCellGeometry(flamesPerCell, sparksPerCell);
    // Per-instance seed: the cover cell's index, matching the seed the per-cell
    // component was handed before, so a given cell burns the way it always has.
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) seeds[i] = i;
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cellData.cell, 4));
    // Dynamic: the sweep is rewritten once when a claim origin arrives, which can
    // be a frame or two after the mesh mounts.
    const sweep = new THREE.InstancedBufferAttribute(cellData.sweep, 1);
    sweep.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aSweep', sweep);
    return geo;
  }, [flamesPerCell, sparksPerCell, count, cellData]);

  const material = getFlameMaterial(highDetail);

  useEffect(() => {
    material.uniforms.uAnim.value = animate ? 1 : 0;
  }, [material, animate]);

  // The geometry is built per mount (its vertex count depends on the quality tier),
  // so it is ours to dispose. The material and both textures are shared and stay.
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
