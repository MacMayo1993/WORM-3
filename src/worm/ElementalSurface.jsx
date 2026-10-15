// src/worm/ElementalSurface.jsx
//
// The shell skins: water, ice and lightning. Each wraps the cube in one continuous
// ROUNDED shell — flat over every face, a quarter-cylinder round every cube edge, a
// sphere octant at every corner — and paints its element onto it.
//
// ── Why a shell ──────────────────────────────────────────────────────────────
// These skins used to be one 1.04-wide quad per sticker, lifted off the face. The
// quads overlapped their neighbours to hide the grout, but at the cube's edges that
// overlap hung out into space, so the silhouette was fringed with loose flaps — the
// water and ice read as crumpled plastic wrap. A body of water around a cube is an
// offset surface: every point of the cube pushed out by the same depth, which rounds
// the edges over. Each cover cell now carries that surface's patch for its part of
// the face, and a cell on a cube edge also carries the wrap, out to the plane that
// bisects the two faces — exactly where the neighbouring face's wrap ends. Both
// sample the shell's depth at the same point on the edge line, so they meet without
// a crack; three corner cells meet the same way on the octant.
//
// ── The claim ────────────────────────────────────────────────────────────────
// The shell floods outward from the claimed tile as a continuous front in world
// space, not cell by cell: per-cell delays would make two faces disagree about the
// depth along their shared edge and split the wrap open.
//
// ── Cost ─────────────────────────────────────────────────────────────────────
// One geometry and one material per element; the whole shell is a single
// InstancedMesh draw. Each element's fragment program is compiled separately
// (a define, not a runtime branch), so water never pays for ice's facets.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { sharedUniforms } from '../3d/styles/TileStyleMaterials.jsx';
import { attachCellAttributes } from './healerWorm/elementalCells.js';
import { GLSL_NOISE, GLSL_CELL_ATTRIBUTES, GLSL_CELL_FRAME, SEAM_HALF, glf } from './healerWorm/elementalGlsl.js';
import { GLSL_WORM, uWormHead, uWormBody, uCubeHalf, uCubeGap } from './healerWorm/elementalUniforms.js';
import { GLSL_SIGILS, sigilIdOf } from './healerWorm/fusionSigils.js';

export const SURFACE_MODE = { water: 0, ice: 1, lightning: 2, reaction: 3, air: 4 };

// Water depth above the stickers: a base, four ripple waves and one broad swell.
// Even when every wave bottoms out together the trough stays above the tile, and
// the crest stays under the worm's back.
export const WATER_HEIGHT = { base: 0.105, ripple: 0.011, swell: 0.03 };
// Shell depth for the other two: ice is a thick carved layer, lightning a skin of
// charge lying on the tiles.
const ICE_DEPTH = 0.075;
const CHARGE_DEPTH = 0.016;

// How far the flat part of an edge cell runs past its sticker lattice before the
// wrap begins: the cell's origin sits SURFACE_OFFSET (0.52) off the cubie centre,
// so the wrap's axis — shared by both faces — is 0.02 beyond the lattice edge.
const EDGE_PAD = 0.02;
// Seam borders fold exactly onto the border, so neighbouring patches meet edge to
// edge. An overlap (tried first, to rule out hairline cracks) doubles the layer's
// alpha in a strip along every seam, which reads as a ruled line across the water.
const SEAM_OVERLAP = 0.0;
// Size of the skirt ring in the geometry's parameter space. Arbitrary: the shader
// maps skirt parameter 0..1 onto the wrap angle.
const SKIRT = 0.25;

// Tessellation per element: [interior segments, skirt segments]. Water needs the
// most, because its waves and the wrap both have to read as curved.
const RESOLUTION = { water: [14, 4], ice: [10, 3], lightning: [6, 2], reaction: [10, 3], air: [6, 2] };

const _geoCache = new Map();
/**
 * The shell patch for one cover cell: a grid over parameter space, [0,1]² for the
 * face plus a skirt ring the vertex shader either wraps over a cube edge or folds
 * flat onto a seam.
 */
function getShellGeometry(inner = 14, skirt = 4) {
  const key = `${inner}:${skirt}`;
  let geo = _geoCache.get(key);
  if (geo) return geo;
  const qs = [];
  for (let i = skirt; i >= 1; i--) qs.push((-SKIRT * i) / skirt);
  for (let i = 0; i <= inner; i++) qs.push(i / inner);
  for (let i = 1; i <= skirt; i++) qs.push(1 + (SKIRT * i) / skirt);
  const n = qs.length;
  const position = new Float32Array(n * n * 3);
  const uv = new Float32Array(n * n * 2);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const v = j * n + i;
      position[v * 3] = qs[i];
      position[v * 3 + 1] = qs[j];
      uv[v * 2] = qs[i];
      uv[v * 2 + 1] = qs[j];
    }
  }
  const index = [];
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      index.push(a, b, d, a, d, c);
    }
  }
  geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);
  _geoCache.set(key, geo);
  return geo;
}

/** The water shell geometry — kept under its old name for callers and tests. */
export function getElementalSurfaceGeo() {
  return getShellGeometry(...RESOLUTION.water);
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  // Reaction coat height above the stickers (fusionLooks.js).
  uniform float uReactDepth;
  uniform float uCubeGap;
  // (intensity, claim, release, animate) — the shared elemental envelope.
  uniform vec4 uEnv;
  uniform vec4 uClaimOrigin;
  uniform float uCubeHalf;
  ${GLSL_CELL_ATTRIBUTES}
  ${GLSL_WORM}

  varying vec3 vWorld;
  varying vec3 vNormal;    // shell normal, world space, waves included
  varying vec3 vFaceN;     // the face's own normal
  varying vec2 vLocal;     // cell-local position on the face, world units
  varying vec2 vFaceUV;    // position projected on the face's axes — shared by every cell on it
  varying float vRim;      // 0 on the flat → 1 where this face's wrap ends
  varying float vArrive;   // the claim flood: 0 before the front, 1 behind it
  varying float vDepth;    // shell depth above the stickers here
  varying float vWave;     // water: normalised wave height, -1..1
  varying float vWake;     // water: ripple rings around the worm, -1..1
  varying float vWormD;    // distance to the worm's body, world units (large with no worm)

  #define QUARTER_PI 0.78539816

  // A continuous front travelling out from the claimed tile. It must reach the far
  // corner of the cube (≈2.45 half-extents away) by the end of the sweep.
  float floodAt(vec3 p) {
    if (uClaimOrigin.w < 0.5) return smoothstep(0.0, 1.0, uEnv.y);
    float reach = uEnv.y * (uCubeHalf * 3.2 + 1.4);
    return 1.0 - smoothstep(reach - 1.1, reach, length(p - uClaimOrigin.xyz));
  }

#if SURFACE_MODE == 0
  // Travelling waves in world space: returns (height, gradient). World space is what
  // carries a swell over a cube edge onto the next face as one body of water.
  vec4 waterWaves(vec3 p, float t) {
    vec4 acc = vec4(0.0);
    vec3 d; float k; float ph;
    d = normalize(vec3(1.0, 0.35, 0.8)); k = 0.85; ph = dot(p, d) * k - t * 0.75;
    acc += vec4(sin(ph), cos(ph) * k * d) * ${glf(WATER_HEIGHT.swell)};
    d = normalize(vec3(0.9, -0.2, 0.3)); k = 3.1; ph = dot(p, d) * k - t * 1.55;
    acc += vec4(sin(ph), cos(ph) * k * d) * ${glf(WATER_HEIGHT.ripple)};
    d = normalize(vec3(-0.35, 0.6, 0.9)); k = 3.6; ph = dot(p, d) * k - t * 1.3;
    acc += vec4(sin(ph), cos(ph) * k * d) * ${glf(WATER_HEIGHT.ripple)};
    d = normalize(vec3(0.2, 0.95, -0.55)); k = 2.5; ph = dot(p, d) * k + t * 1.05;
    acc += vec4(sin(ph), cos(ph) * k * d) * ${glf(WATER_HEIGHT.ripple)};
    d = normalize(vec3(-0.8, -0.3, 0.45)); k = 4.4; ph = dot(p, d) * k - t * 1.9;
    acc += vec4(sin(ph), cos(ph) * k * d) * ${glf(WATER_HEIGHT.ripple)};
    return acc;
  }
#endif

  void main() {
    ${GLSL_CELL_FRAME}
    float T = uTime * uEnv.w;
    vec2 q = position.xy;

    // Which skirt (if any) this vertex belongs to, and how far into it, 0..1.
    float sx = q.x > 1.0 ? 1.0 : (q.x < 0.0 ? -1.0 : 0.0);
    float sy = q.y > 1.0 ? 1.0 : (q.y < 0.0 ? -1.0 : 0.0);
    float tx = sx > 0.0 ? (q.x - 1.0) / ${glf(SKIRT)} : (sx < 0.0 ? -q.x / ${glf(SKIRT)} : 0.0);
    float ty = sy > 0.0 ? (q.y - 1.0) / ${glf(SKIRT)} : (sy < 0.0 ? -q.y / ${glf(SKIRT)} : 0.0);
    // As cubies separate, every tile rim becomes an exposed border. Round the
    // coating over that tile's rim instead of keeping a stretched face-wide shell.
    vec4 edges = mix(aEdge, vec4(1.0), smoothstep(0.0, 0.15, uCubeGap));
    float ex = sx > 0.0 ? edges.y : edges.x;
    float ey = sy > 0.0 ? edges.w : edges.z;

    // The flat patch. On an edge border it runs out to the wrap's axis.
    vec2 lo = vec2(aExtent.x + edges.x * ${glf(EDGE_PAD)}, aExtent.z + edges.z * ${glf(EDGE_PAD)});
    vec2 hi = vec2(aExtent.y + edges.y * ${glf(EDGE_PAD)}, aExtent.w + edges.w * ${glf(EDGE_PAD)});
    vec2 cq = clamp(q, 0.0, 1.0);
    vec2 base = vec2(mix(-lo.x, hi.x, cq.x), mix(-lo.y, hi.y, cq.y));
    // On a seam border the skirt folds flat onto the border (zero-area triangles).
    base.x += sx * (1.0 - ex) * tx * ${glf(SEAM_OVERLAP)};
    base.y += sy * (1.0 - ey) * ty * ${glf(SEAM_OVERLAP)};

    // The wrap: up to 45° round the edge, where the neighbouring face takes over.
    vec3 dirL = normalize(vec3(sx * tan(ex * tx * QUARTER_PI), sy * tan(ey * ty * QUARTER_PI), 1.0));
    vec3 C = cellOrigin + cellX * base.x + cellY * base.y;
    vec3 dir = normalize(cellX * dirL.x + cellY * dirL.y + cellN * dirL.z);

    float flood = floodAt(C);
    float drain = 1.0 - smoothstep(0.0, 1.0, uEnv.z);
    vec3 n = dir;
    float depth;
    vWave = 0.0;
    vWake = 0.0;

  #if SURFACE_MODE == 0
    // ── Water: waves, plus rings spreading from the worm's head ────────────
    vec4 w = waterWaves(C, T);
    vec3 toHead = C - uWormHead.xyz;
    float r = length(toHead);
    float ringPh = r * 21.0 - T * 8.0;
    float ringFall = exp(-r * 2.4) * uWormHead.w;
    float ring = sin(ringPh) * ringFall * 0.011;
    vec3 ringGrad = (cos(ringPh) * 21.0 - 2.4 * sin(ringPh)) * ringFall * 0.011 * (toHead / max(r, 1e-4));
    w += vec4(ring, ringGrad);
    depth = (${glf(WATER_HEIGHT.base)} + w.x) * flood * mix(0.25, 1.0, drain);
    // Tilt the normal by the tangential slope. Scaled with the depth, so a thin film
    // at the flood front or the drain is not rougher than open water.
    vec3 slope = w.yzw - dir * dot(w.yzw, dir);
    n = normalize(dir - slope * flood * drain);
    vWave = w.x / (${glf(WATER_HEIGHT.swell)} + 2.0 * ${glf(WATER_HEIGHT.ripple)});
    vWake = sin(ringPh) * exp(-r * 2.4) * uWormHead.w;
  #elif SURFACE_MODE == 1
    // ── Ice: a thick carved layer, stepped a little per plate ──────────────
    depth = ${glf(ICE_DEPTH)} * flood * mix(0.15, 1.0, drain);
  #elif SURFACE_MODE == 2
    // ── Lightning: charge lying on the tiles ───────────────────────────────
    depth = ${glf(CHARGE_DEPTH)} * flood;
  #elif SURFACE_MODE == 4
    depth = 0.055 * flood;
  #else
    // ── A fusion's reaction coat (fusionLooks.js) ──────────────────────────
    depth = uReactDepth * flood * mix(0.25, 1.0, drain);
  #if REACTION_PATTERN == 0 || REACTION_PATTERN == 5
    // Fog banks and storm clouds billow: the coat heaves in slow world-space swells.
    depth *= 0.7 + 0.45 * (0.5 + 0.5 * sin(dot(C, vec3(2.1, 1.3, 1.7)) + T * 1.3))
                 * (0.5 + 0.5 * sin(dot(C, vec3(-1.4, 2.6, 0.9)) - T * 0.9));
  #endif
  #endif

    depth = max(depth, 0.002);
    vec3 world = C + dir * depth;
    vWorld = world;
    vNormal = n;
    vFaceN = cellN;
    vLocal = base;
    // Recover the unexpanded lattice for seam patterns; local tile offsets and
    // ripple height stay in world units, while the cubie centres move apart.
    vFaceUV = vec2(dot(cellOrigin, cellX), dot(cellOrigin, cellY)) / (1.0 + uCubeGap) + base;
    vRim = max(ex * tx, ey * ty);
    vArrive = flood;
    vDepth = depth;
    vWormD = wormDist(C);
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uCubeHalf;
  uniform vec4 uEnv;
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform vec4 uClaimOrigin;

  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vFaceN;
  varying vec2 vLocal;
  varying vec2 vFaceUV;
  varying float vRim;
  varying float vArrive;
  varying float vDepth;
  varying float vWave;
  varying float vWake;
  varying float vWormD;

  ${GLSL_NOISE}

  // Worley cell of p: (F1, F2, id). The id is a stable random per cell, for facets.
  // The full search visits all 27 neighbouring cells. The low tier visits only the
  // 2×2×2 block on the side of the cell the point lies in — a third of the work,
  // at the price of an occasional plate wall that is slightly misplaced.
  vec3 worleyCell(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    float d1 = 8.0;
    float d2 = 8.0;
    float id = 0.0;
  #ifdef ICE_HQ
    for (int z = -1; z <= 1; z++)
    for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++) {
      vec3 g = vec3(float(x), float(y), float(z));
  #else
    vec3 lo = step(0.5, f) - 1.0;
    for (int z = 0; z <= 1; z++)
    for (int y = 0; y <= 1; y++)
    for (int x = 0; x <= 1; x++) {
      vec3 g = lo + vec3(float(x), float(y), float(z));
  #endif
      vec3 o = hash33(i + g);
      vec3 r = g + o - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; id = hash13(i + g + 0.37); } else if (d < d2) { d2 = d; }
    }
    return vec3(sqrt(d1), sqrt(d2), id);
  }

  // Piecewise-LINEAR noise: straight segments meeting at sharp corners — the
  // zigzag of a real discharge, where smooth value noise draws a lazy wave.
  float jag(float x, float seed) {
    float i = floor(x);
    float a = hash12(vec2(i, seed));
    float b = hash12(vec2(i + 1.0, seed));
    return mix(a, b, fract(x)) - 0.5;
  }

  // Ridged noise: bright where the field crosses its midpoint — thin branching lines.
  float ridge(float n, float sharp) { return pow(1.0 - abs(n * 2.0 - 1.0), sharp); }

#if SURFACE_MODE == 3
  // A recipe's own motif, drawn into its family's coat (fusionSigils.js).
  ${GLSL_SIGILS}
#endif

  // Perturb a normal by a scalar height field using its screen-space derivatives
  // (the surface-gradient method): shading detail without a single extra vertex.
  vec3 bumpNormal(vec3 n, vec3 p, float h, float strength) {
    vec3 dpdx = dFdx(p);
    vec3 dpdy = dFdy(p);
    float dhdx = dFdx(h);
    float dhdy = dFdy(h);
    vec3 r1 = cross(dpdy, n);
    vec3 r2 = cross(n, dpdx);
    float det = dot(dpdx, r1);
    vec3 grad = (r1 * dhdx + r2 * dhdy) * sign(det) / max(abs(det), 1e-7);
    return normalize(n - grad * strength);
  }

  void main() {
    float T = uTime * uEnv.w;
    vec3 v = normalize(cameraPosition - vWorld);
    vec3 n = normalize(vNormal);
    vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 keyL = normalize(vec3(0.45, 0.85, 0.35));
    float ndv = clamp(dot(n, v), 0.0, 1.0);
    // The sticker lattice under this point: 0 on a seam → 0.5 mid-sticker.
    vec2 st = fract(vLocal + 0.5) - 0.5;
    float seamD = 0.5 - max(abs(st.x), abs(st.y));
    vec3 rgb;
    float a;

  #if SURFACE_MODE == 0
    // ── Water ─────────────────────────────────────────────────────────────
    // Fine ripples for shading only, as a noise bump rather than plane waves: a
    // plane wave's crests glint in long straight lines, which read as rules drawn
    // across the water; noise glints in scattered, crawling sparkles.
    float fine = vnoise3(vWorld * 5.0 + vec3(0.0, T * 0.8, T * 0.5)) * 0.65
               + vnoise3(vWorld * 9.0 - vec3(T * 1.0, 0.0, T * 0.6)) * 0.35;
    // Smooth toward grazing: foreshortened, the same ripples alias into static, and
    // real water at a glancing angle reflects in long smooth sheets anyway.
    float grazeFade = smoothstep(0.08, 0.55, clamp(dot(n, v), 0.0, 1.0));
    vec3 wn = bumpNormal(n, vWorld, fine, 0.045 * grazeFade);
    float ndvw = clamp(dot(wn, v), 0.0, 1.0);

    float fres = pow(1.0 - ndvw, 2.2);
    // How much water the eye crosses: little head-on, lots at a glancing angle and
    // round the rims, where the shell turns away.
    float thick = clamp(fres * 1.15 + vRim * 0.55, 0.0, 1.0);
    // Head-on the water only ABSORBS: a near-black teal that dims a tile without
    // shifting its hue. Any real blue here is added to every sticker — red turns
    // purple and orange drifts toward pink, which is a readability failure, not a
    // look. The blue lives where the eye crosses more water: the grazing angles
    // and the rounded rims.
    vec3 shallow = vec3(0.0, 0.012, 0.03);
    vec3 deep = uColor * vec3(0.03, 0.22, 0.55);
    vec3 body = mix(shallow, deep, smoothstep(0.1, 0.9, thick));
    float occ = mix(0.18, 0.86, thick);

    // Caustics ON the tiles, seen through the surface: follow the refracted ray
    // down to the sticker plane, so the light web sits under the water and swims
    // as the waves bend it. Thin and cyan, so the tile keeps its own hue.
    vec3 refr = refract(-v, wn, 0.75);
    float down = max(0.25, -dot(refr, vFaceN));
    vec3 floorP = vWorld + refr * (vDepth / down);
    float c1 = vnoise3(floorP * 3.3 + vec3(0.0, T * 0.34, T * 0.19));
    float c2 = vnoise3(floorP * 4.9 - vec3(T * 0.26, 0.0, T * 0.14));
    float caustic = ridge(c1, 16.0) + 0.75 * ridge(c2, 16.0);
    caustic *= 1.0 - thick;
    vec3 causticCol = mix(uColor, vec3(0.85, 1.0, 1.0), 0.55);

    // Reflection: a soft sky keyed to the camera's up, brightest toward the horizon.
    vec3 r = reflect(-v, wn);
    float sky = smoothstep(-0.1, 0.8, dot(r, camUp));
    vec3 skyCol = mix(vec3(0.01, 0.05, 0.13), vec3(0.72, 0.92, 1.0), sky);
    // Sun: a hard sparkle on the ripple faces, and a broad sheen round the rims —
    // the highlight that makes a rounded body of water read as one object.
    vec3 h = normalize(keyL + v);
    float nh = max(dot(wn, h), 0.0);
    float glint = pow(nh, 320.0) * 2.2 * grazeFade;
    float sheen = pow(max(dot(n, h), 0.0), 14.0) * (0.08 + 0.45 * vRim);

    // Foam: patches, not lines — the crests only foam where a slow mask allows, and
    // the rings round the worm froth where they break.
    float foamN = vnoise3(vWorld * 10.0 + vec3(T * 0.5, 0.0, -T * 0.3));
    float foamMask = smoothstep(0.55, 0.8, vnoise3(vWorld * 1.6 + vec3(T * 0.12)));
    float crest = smoothstep(0.7, 0.95, vWave + (foamN - 0.5) * 0.6) * foamMask;
    float wake = smoothstep(0.5, 0.88, vWake + (foamN - 0.5) * 0.45);
    float foam = max(crest * 0.7, wake);

    // Split into what the water IS (body, foam — it occludes the tile) and what it
    // gives off (reflections, caustics, glints — pure added light).
    float surge = vArrive * (1.0 - vArrive) * 4.0;
    vec3 bodyCol = mix(body, vec3(0.93, 0.99, 1.0), foam);
    a = clamp(occ + foam * 0.55, 0.0, 1.0);
    vec3 light = skyCol * fres * 0.7 + causticCol * caustic * 0.22 + vec3(1.0) * (glint + sheen) + uAccent * surge * 0.35;
    float fade = smoothstep(0.02, 0.35, vArrive) * (1.0 - smoothstep(0.35, 1.0, uEnv.z));
    rgb = vec3(0.0);
  #define SPLIT_OUTPUT

  #elif SURFACE_MODE == 1
    // ── Ice ───────────────────────────────────────────────────────────────
    // Plates: world-space Worley cells, each tilting the surface its own way, so
    // the layer breaks into flat facets that catch the light one at a time.
    vec3 wc = worleyCell(vWorld * 2.2);
    vec3 tilt = hash33(vec3(wc.z * 97.0, wc.z * 31.0, wc.z * 7.0)) - 0.5;
    vec3 fn = normalize(n + (tilt - n * dot(tilt, n)) * 0.75);
    float plateEdge = 1.0 - smoothstep(0.0, 0.045, wc.y - wc.x);
    float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.0);

    // Cracks deep inside the layer, found by following the refracted view ray in:
    // parallax makes them sit under the surface rather than on it.
    vec3 refr = refract(-v, n, 0.77);
    vec3 inside = vWorld + refr * (vDepth * 1.8 + 0.03);
  #ifdef ICE_HQ
    vec2 deepC = worley3(inside * 1.4);
    float crackDeep = 1.0 - smoothstep(0.0, 0.045, deepC.y - deepC.x);
  #else
    float crackDeep = ridge(vnoise3(inside * 2.6), 14.0);
  #endif

    // The seams fill with glacial ice, and frost gathers on them in ragged patches —
    // a continuous white line in every seam turned the cube into a white grid.
    // Only on the flat: round the bevels the lattice coordinate is pinned to the
    // border, so a seam test there would frost the whole rim solid.
    float flatPart = 1.0 - smoothstep(0.0, 0.25, vRim);
    float fr = fbm3(vWorld * 8.0);
  #ifdef ICE_HQ
    float patchy = smoothstep(0.4, 0.66, fbm3(vWorld * 2.6 + 3.7));
  #else
    float patchy = smoothstep(0.4, 0.66, vnoise3(vWorld * 2.6 + 3.7));
  #endif
    float inSeam = (1.0 - smoothstep(${glf(SEAM_HALF)} - 0.015, ${glf(SEAM_HALF)} + 0.012, seamD)) * flatPart;
    float seamFrost = (1.0 - smoothstep(${glf(SEAM_HALF)} - 0.02, ${glf(SEAM_HALF)} + 0.03 + 0.06 * fr, seamD)) * flatPart * patchy;
    float rimFrost = vRim * smoothstep(0.5, 0.68, fr + patchy * 0.2);
    float frost = clamp(max(seamFrost, rimFrost), 0.0, 1.0);

    // Thickness: clear over the plates, glacial blue where the eye crosses more
    // ice (grazing views, the rounded bevels and the ice packed into the seams).
    float thick = clamp(fres * 1.1 + vRim * 0.7 + inSeam * 0.8, 0.0, 1.0);
    vec3 clearTint = uColor * vec3(0.3, 0.55, 0.75);
    vec3 glacial = uColor * vec3(0.05, 0.25, 0.62);
    vec3 body = mix(clearTint, glacial, thick);
    body = mix(body, glacial * 0.55, crackDeep * 0.8);
    vec3 bodyCol = mix(body, vec3(0.92, 0.98, 1.0), frost);
    // Clear ice barely hides the tile; frost, bevels and cracks do.
    a = mix(0.14, 0.72, thick) + crackDeep * 0.28 + plateEdge * 0.1;
    a = max(a, frost * 0.92);

    // Light: facet glints (every plate flares at its own angle), a cold rim, and
    // four-point star glitter twinkling on a jittered grid across each face.
    vec3 h = normalize(keyL + v);
    float spec = pow(max(dot(fn, h), 0.0), 70.0) * 1.3;
    vec2 gp = vFaceUV * 6.0;
    vec2 gi = floor(gp);
    vec2 gseed = gi + vFaceN.xy * 13.0 + vFaceN.z * 7.0;
    vec2 dd = fract(gp) - 0.5 - (hash22(gseed) - 0.5) * 0.6;
    float tw = pow(0.5 + 0.5 * sin(T * 2.6 + hash12(gseed) * 40.0), 18.0) * step(0.45, hash12(gseed + 3.1));
    float star = (exp(-abs(dd.x) * 70.0 - abs(dd.y) * 7.0) + exp(-abs(dd.y) * 70.0 - abs(dd.x) * 7.0)) * tw;
    // A cold, thin highlight where the bevel turns away — the edge of a glass block.
    float edgeLine = smoothstep(0.55, 0.95, vRim) * pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 1.5);
    vec3 light = vec3(0.88, 0.97, 1.0) * (spec + star * 1.6 + plateEdge * 0.18 * (1.0 - frost) + edgeLine * 0.6)
               + vec3(0.7, 0.9, 1.0) * fres * 0.3;

    // Frost nucleates at the flood front as a bright crystalline growth line.
    float front = vArrive * (1.0 - vArrive) * 4.0;
    light += vec3(0.8, 0.95, 1.0) * front * 0.55;
    // Melting: holes open through the layer as the wash ends.
    // A uniform branch: every fragment takes the same side, so the melt noise is
    // only paid for during the dissolve.
    float melt = 0.0;
    if (uEnv.z > 0.0) melt = step(fbm3(vWorld * 4.0) * 0.85 + 0.12, uEnv.z * 1.1);
    float fade = smoothstep(0.02, 0.3, vArrive) * (1.0 - melt) * (1.0 - smoothstep(0.6, 1.0, uEnv.z));
    rgb = vec3(0.0);
  #define SPLIT_OUTPUT

  #elif SURFACE_MODE == 2
    // ── Lightning ─────────────────────────────────────────────────────────
    // Current runs in the seams — the path of least resistance on a cube is the
    // grid of gaps between tiles. Each seam's line jitters and re-jitters, and
    // bright pulses race along it.
    // Everything that must agree on BOTH sides of a seam is taken from the face's
    // own axes, which every cell on the face shares; a cell's local frame restarts
    // at its own sticker and would break the line at every cell border.
    bool vertical = abs(st.x) > abs(st.y);
    float stA = vertical ? st.x : st.y;
    float perp = 0.5 - abs(stA);
    float along = vertical ? vFaceUV.y : vFaceUV.x;
    float seamPos = (vertical ? vFaceUV.x : vFaceUV.y) + sign(stA) * 0.5 - stA;
    float seamId = floor(seamPos * 2.0 + 0.5) + (vertical ? 0.0 : 101.0) + dot(vFaceN, vec3(211.0, 307.0, 401.0));
    float jitterT = floor(T * 9.0);
    // Signed offset of the current from the seam's centre line, in world units
    // along the face axis; each side measures its distance to the same line.
    float jseed = seamId * 3.1 + jitterT * 1.7;
    float jit = jag(along * 9.0, jseed) * 0.06 + jag(along * 23.0, jseed + 5.3) * 0.02;
    float dj = abs(perp + sign(stA) * jit);
    float core = exp(-dj * dj / 0.00005);
    float glow = exp(-dj * dj / 0.0035);
    float runner = pow(0.5 + 0.5 * sin(along * 6.0 - T * 13.0 + hash12(vec2(seamId, 3.7)) * 6.2832), 10.0);
    // Junctions where four stickers meet hold the charge and glow.
    vec2 toNode = 0.5 - abs(st);
    float node = exp(-dot(toNode, toNode) * 160.0);
    float nodeHalo = exp(-dot(toNode, toNode) * 22.0);
    // Now and then a short arc jumps straight across a sticker.
    vec2 stickerId = floor((vFaceUV - st) * 2.0 + 0.5) + vFaceN.xy * 57.0 + vFaceN.z * 131.0;
    float arcSeed = hash12(stickerId * 1.7 + floor(T * 3.0));
    float arcOn = step(0.86, arcSeed);
    float arcPath = st.y - jag(st.x * 8.0, arcSeed * 50.0) * 0.3 - jag(st.x * 21.0, arcSeed * 71.0) * 0.07;
    float arcSpan = 1.0 - smoothstep(0.35, 0.5, abs(st.x));
    float arc = arcOn * exp(-arcPath * arcPath / 0.0001) * arcSpan;
    float arcGlow = arcOn * exp(-arcPath * arcPath / 0.004) * arcSpan;
    // Rails: the cube's own edges carry the heaviest current, pulses racing round.
    float railPulse = pow(0.5 + 0.5 * sin(dot(vWorld, vec3(1.0)) * 5.0 - T * 9.0), 6.0);
    float rail = smoothstep(0.1, 0.9, vRim) * (0.55 + 0.45 * railPulse);
    float fres = pow(1.0 - ndv, 2.5);

    // White-hot where the current is, violet around it. Pure added light.
    float current = core * (0.6 + 1.0 * runner) + node * 1.1 + arc * 1.2;
    vec3 violet = uColor;
    vec3 light = uAccent * current * 1.25
               + violet * (glow * (0.45 + 0.6 * runner) + nodeHalo * 0.35 + arcGlow * 0.5 + rail * 0.9 + fres * 0.3);
    // A thin storm-dark glaze so the white cores have something to be hot against:
    // it dims the tile a little and never tints it.
    vec3 bodyCol = vec3(0.012, 0.004, 0.03);
    a = 0.14 + fres * 0.2 + rail * 0.25;
    float fade = smoothstep(0.02, 0.4, vArrive) * (1.0 - smoothstep(0.1, 0.9, uEnv.z));
    rgb = vec3(0.0);
  #define SPLIT_OUTPUT
  #elif SURFACE_MODE == 4
    // Long, curling wind ribbons. Transparent gaps keep the board legible.
    float gust = dot(vWorld, vec3(1.4, 0.7, 1.1)) - T * 2.4;
    float curl = sin(dot(vWorld, vec3(-0.8, 1.5, 0.6)) + T * 0.8);
    float ribbon = pow(0.5 + 0.5 * sin(gust * 5.0 + curl * 2.0), 24.0);
    float fres = pow(1.0 - ndv, 2.5);
    vec3 bodyCol = vec3(0.008, 0.018, 0.02);
    vec3 light = uAccent * ribbon * 0.24 + uColor * fres * 0.10;
    a = 0.02 + ribbon * 0.08 + fres * 0.04;
    float fade = smoothstep(0.02, 0.4, vArrive) * (1.0 - smoothstep(0.1, 0.9, uEnv.z));
    rgb = vec3(0.0);
  #define SPLIT_OUTPUT
  #else
    // ── A fusion's reaction (fusionLooks.js) ──────────────────────────────
    // Not either element: the pair's own reaction, in its own palette. Each pattern
    // is its own program (REACTION_PATTERN), so a recipe never pays for another's
    // noise. As with the elements, the body only dims a tile; colour arrives as
    // added light, kept off the sticker centres where readability lives.
    float fres = pow(1.0 - ndv, 2.0);
    float flatPart = 1.0 - smoothstep(0.0, 0.25, vRim);
    float seamNear = (1.0 - smoothstep(0.0, 0.14, seamD)) * flatPart;
    vec3 up = vec3(0.0, 1.0, 0.0);
    vec3 bodyCol;
    vec3 light;
    // The reaction answers the worm crawling through it: near peaks on the body,
    // wakeRing is a bright band just outside it. Reduced motion zeroes uEnv.w, and
    // with it every response.
    float near = exp(-vWormD * vWormD / 0.16) * uEnv.w;
    float wakeRing = exp(-pow((vWormD - 0.42) / 0.09, 2.0)) * uEnv.w;
  #if REACTION_PATTERN == 0
    // MIST — banks of fog boil up off the faces and roll over the rims.
    vec3 mp = vWorld * 1.5 - up * T * 0.45 + vec3(T * 0.08, 0.0, -T * 0.05);
    float m1 = fbm3(mp);
    float m2 = fbm3(vWorld * 3.4 - up * T * 0.9 + vec3(5.1));
    float dens = smoothstep(0.22, 0.74, m1 * 0.72 + m2 * 0.42);
    dens = clamp(max(dens, vRim * 0.7) + fres * 0.4, 0.0, 1.0);
    // The worm parts the fog: a clear lane round its body, the displaced mist
    // banking up bright along the edge of the wake.
    dens *= 1.0 - near * 0.85;
    dens = clamp(dens + wakeRing * 0.35, 0.0, 1.0);
    bodyCol = mix(uColor * 0.85, vec3(1.0), dens * 0.6);
    a = dens * 0.74;
    light = uAccent * pow(m2, 3.0) * 0.18 + vec3(1.0) * fres * 0.18 * dens + vec3(1.0) * wakeRing * 0.12;
  #elif REACTION_PATTERN == 1
    // CRUST — the surface cooled into plates; the reaction's heat bleeds through the cracks.
    vec3 wc = worleyCell(vWorld * 2.7);
    float crack = 1.0 - smoothstep(0.0, 0.07, wc.y - wc.x);
    float heat = 0.55 + 0.45 * sin(T * 1.6 + wc.z * 23.0);
    vec3 tilt = hash33(vec3(wc.z * 61.0, wc.z * 17.0, wc.z * 5.0)) - 0.5;
    vec3 fn = normalize(n + (tilt - n * dot(tilt, n)) * 0.5);
    vec3 hh = normalize(keyL + v);
    float gloss = pow(max(dot(fn, hh), 0.0), 60.0);
    bodyCol = uColor * (0.75 + 0.5 * wc.z);
    a = mix(0.42, 0.7, max(fres, vRim)) * (1.0 - crack * 0.6);
    // Weight on the crust: the cracks under and around the worm flare white-hot.
    float press = near + wakeRing * 0.5;
    light = uAccent * crack * heat * (1.5 + press * 2.5) + mix(uAccent, vec3(1.0), 0.6) * crack * near * 1.2
          + vec3(1.0) * gloss * 0.8 + uAccent * fres * 0.08;
  #elif REACTION_PATTERN == 2
    // FLAME — tongues lick up every face toward the sky, rooted in the seams.
    vec3 fp = vWorld * 2.6 - up * T * 1.7;
    float flick = fbm3(fp) * 0.75 + vnoise3(fp * 2.3 + 3.0) * 0.35;
    float rise = clamp(dot(n, up) * 0.5 + 0.5, 0.0, 1.0);
    // The fire leaps up round the worm, as if it were feeding it.
    float body = flick + seamNear * 0.32 + vRim * 0.28 + rise * 0.08 + (near * 0.45 + wakeRing * 0.25);
    float tongue = smoothstep(0.5, 0.82, body);
    float core = smoothstep(0.74, 0.97, body);
    bodyCol = uAccent * 0.1;
    a = 0.18 + tongue * 0.32 + fres * 0.15;
    light = uColor * tongue * 1.25 + mix(uColor, vec3(1.0), 0.7) * core * 1.4 + uAccent * seamNear * 0.25;
  #elif REACTION_PATTERN == 3
    // PLASMA — swirling cells of charged gas, threaded with white-hot filaments.
    vec3 pp = vWorld * 2.0;
    pp += vec3(sin(T * 0.7 + pp.z * 1.3), cos(T * 0.6 + pp.x * 1.1), sin(T * 0.5 + pp.y * 1.2)) * 0.35;
    float f = fbm3(pp + T * 0.22);
    float fil = ridge(vnoise3(pp * 1.7 + T * 0.55), 12.0) + ridge(vnoise3(pp * 3.2 - T * 0.4), 16.0) * 0.6;
    // The filaments are drawn to the worm: they thicken and brighten around it.
    fil *= 1.0 + near * 2.2 + wakeRing * 1.2;
    bodyCol = uAccent * 0.05;
    a = 0.16 + fres * 0.25 + fil * 0.12;
    light = mix(uAccent, uColor, f) * (0.25 + fil * 1.5) * 0.8 + vec3(1.0) * pow(clamp(fil, 0.0, 1.0), 3.0) * 0.55
          + uColor * fres * 0.35;
  #elif REACTION_PATTERN == 4
    // BLOOM — growth packs the seams and flowers open across the faces.
    vec2 g = vFaceUV * 2.6;
    vec2 gi = floor(g);
    vec2 gs = gi + vFaceN.xy * 17.0 + vFaceN.z * 31.0;
    vec2 d = fract(g) - 0.5 - (hash22(gs) - 0.5) * 0.5;
    float ang = atan(d.y, d.x) + hash12(gs) * 6.2832;
    float rr = length(d);
    float open = smoothstep(0.0, 0.6, uEnv.y) * (0.85 + 0.15 * sin(T * 1.2 + hash12(gs + 1.3) * 6.0));
    // Flowers burst wide open where the worm passes.
    open *= 1.0 + (near + wakeRing) * 0.6;
    float petal = (1.0 - smoothstep(0.24, 0.3, rr / max(0.2, 0.62 + 0.38 * cos(ang * 5.0)) / max(open, 0.05)))
                * step(0.3, hash12(gs + 7.7));
    float heart = 1.0 - smoothstep(0.04, 0.065, rr);
    float growth = smoothstep(0.35, 0.7, vnoise3(vWorld * 9.0)) * seamNear + vRim * 0.5;
    vec3 hh = normalize(keyL + v);
    float dew = pow(max(dot(n, hh), 0.0), 90.0) * step(0.7, vnoise3(vWorld * 22.0));
    bodyCol = mix(uAccent * 0.45, uColor, petal);
    bodyCol = mix(bodyCol, uAccent, heart * petal);
    a = clamp(max(growth * 0.85, petal * 0.92), 0.0, 1.0);
    light = uColor * petal * 0.12 + vec3(1.0) * dew * 1.2 + uAccent * growth * 0.08;
  #elif REACTION_PATTERN == 5
    // STORM — clouds churn over the faces, lit from inside by flashes.
    vec3 sp = vWorld * 1.25 + vec3(T * 0.28, 0.0, -T * 0.2);
    float c1 = fbm3(sp);
    float c2 = fbm3(sp * 2.4 - vec3(T * 0.35));
    float cloud = smoothstep(0.34, 0.8, c1 * 0.65 + c2 * 0.5);
    // Flashes: each beat lights the cloud from inside at a random point on the cube,
    // a soft glow that dies away (never a lit block of the grid).
    float beat = floor(T * 2.2);
    vec3 flashAt = (hash33(vec3(beat * 1.37, 4.1, 9.7)) - 0.5) * 2.2 * uCubeHalf;
    float flashOn = step(0.35, hash13(vec3(beat, 2.3, 7.1)));
    float flash = flashOn * exp(-dot(vWorld - flashAt, vWorld - flashAt) * 0.9) * (1.0 - fract(T * 2.2));
    // And the storm hunts the worm: every few beats the cloud over it lights up.
    float hunt = step(0.6, hash13(vec3(beat, 8.8, 1.9))) * (1.0 - fract(T * 2.2));
    flash = max(flash, hunt * exp(-vWormD * vWormD / 0.35) * uEnv.w);
    float streak = pow(0.5 + 0.5 * sin(dot(vWorld, vec3(0.6, 9.0, 0.4)) + T * 14.0), 18.0) * cloud;
    bodyCol = mix(uColor * 0.3, uColor * 0.75, c2);
    a = cloud * 0.66 + vRim * 0.18;
    light = uAccent * flash * (0.4 + cloud) * 1.4 + uAccent * pow(c2, 4.0) * 0.25 + uColor * streak * 0.25;
  #else
    // FLOW — currents stream across the faces and pour round the edges.
    float s = vFaceUV.x * 2.0 + vFaceUV.y * 0.7;
    float warp = vnoise3(vWorld * 3.0 + vec3(0.0, 0.0, T * 0.4)) * 5.0;
    float streak = pow(0.5 + 0.5 * sin(s * 6.0 - T * 6.5 + warp), 14.0);
    float lane = ridge(vnoise3(vec3(vFaceUV * 2.4 - vec2(T * 1.5, 0.0), dot(vFaceN, vec3(3.0, 5.0, 7.0)))), 10.0);
    bodyCol = uColor * 0.2;
    a = 0.2 + fres * 0.35 + vRim * 0.22;
    // The current sweeps round the worm like water round a stone, brightest at its sides.
    light = uAccent * (streak * 0.8 + lane * 0.9) * (1.0 + wakeRing * 1.8) + uColor * (fres * 0.45 + vRim * 0.3)
          + uAccent * near * 0.25;
  #endif
    // The recipe's sigil: the motif no other fusion wears. Added light in its own
    // colour, a little body so it reads over bright stickers, brighter round the worm.
    float sig = sigilAt(st, vFaceUV - st, seamD, vWorld, vFaceN, vWormD, T) * uSigilParams.w * (1.0 + near * 0.8);
    light += uSigilColor * sig;
    bodyCol = mix(bodyCol, uSigilColor * 0.55, clamp(sig * 0.25, 0.0, 0.35));
    a = clamp(a + sig * 0.1, 0.0, 1.0);
    // The reaction surges in along the claim front and dissolves at the end.
    float surge = vArrive * (1.0 - vArrive) * 4.0;
    light += uAccent * surge * 0.4;
    float fade = smoothstep(0.02, 0.35, vArrive) * (1.0 - smoothstep(0.2, 1.0, uEnv.z));
    rgb = vec3(0.0);
  #define SPLIT_OUTPUT
  #endif

    // Premultiplied: the element's body occludes the tile, its light adds to it.
    //
    // The body is encoded for the output BEFORE the premultiply — encoding after it
    // (what colorspace_fragment does) lifts a dim tint through the sRGB curve and
    // lands a "dark" glaze on the tile as a strong one.
    //
    // The light is added UN-encoded. With the AO composer the scene is linear and
    // this is exact. Without it (phones) the blend happens on sRGB values, where an
    // encoded 0.05 of light becomes +0.25 on the tile — eight times what the linear
    // path adds to the same bright sticker — and washed every tile toward the
    // element's hue. Adding it raw keeps the two paths within a hair on the tiles,
    // where readability lives; they differ only over black, where the phone path is
    // a little dimmer.
  #ifdef SPLIT_OUTPUT
    float af = clamp(a, 0.0, 1.0) * fade;
    gl_FragColor = vec4(linearToOutputTexel(vec4(bodyCol, 1.0)).rgb * af + light * fade, af);
  #else
    gl_FragColor = vec4(rgb * fade, clamp(a, 0.0, 1.0) * fade);
    #include <colorspace_fragment>
  #endif
  }
`;

const _matCache = new Map();
/**
 * One material per element. The colour and accent come from the element's
 * definition; each element keeps its own envelope and claim origin, while the
 * worm uniforms are shared across layers.
 */
export function getElementalSurfaceMaterial(element, colorHex, accentHex, highDetail = true) {
  const mode = SURFACE_MODE[element] ?? 0;
  // Only ice has a detail variant; water and lightning share one program per tier.
  const hq = highDetail && mode === SURFACE_MODE.ice;
  const key = `${element}_${colorHex}_${accentHex}_${hq ? 'hq' : 'lq'}`;
  let mat = _matCache.get(key);
  if (!mat) {
    mat = new THREE.ShaderMaterial({
      defines: { SURFACE_MODE: mode, ...(hq ? { ICE_HQ: '' } : {}) },
      uniforms: {
        uTime: sharedUniforms.time, // ticked by CubeAssembly every frame
        uEnv: { value: new THREE.Vector4(1, 1, 0, 1) },
        uColor: { value: new THREE.Color(colorHex) },
        uAccent: { value: new THREE.Color(accentHex) },
        uWormHead,
        uWormBody,
        // A fused layer keeps its own original sweep as the second arrives.
        uClaimOrigin: { value: new THREE.Vector4() },
        uCubeHalf, uCubeGap
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      toneMapped: false,
      // Water shades with screen-space derivatives. Core in WebGL2; three r159 can
      // still fall back to WebGL1, where they are an extension.
      extensions: { derivatives: true }
    });
    mat.userData.elementalInstanced = true;
    _matCache.set(key, mat);
  }
  return mat;
}

const _reactionCache = new Map();
/**
 * A fusion's reaction coat: the shell in mode `reaction`, one program per pattern,
 * one material per recipe (its palette and height). See fusionLooks.js.
 */
export function getReactionSurfaceMaterial(recipeId, look, pattern) {
  let mat = _reactionCache.get(recipeId);
  if (!mat) {
    mat = new THREE.ShaderMaterial({
      defines: { SURFACE_MODE: SURFACE_MODE.reaction, REACTION_PATTERN: pattern },
      uniforms: {
        uTime: sharedUniforms.time,
        uEnv: { value: new THREE.Vector4(1, 1, 0, 1) },
        uColor: { value: new THREE.Color(look.color) },
        uAccent: { value: new THREE.Color(look.accent) },
        uReactDepth: { value: look.depth },
        uSigil: { value: sigilIdOf(look.sigil) },
        uSigilColor: { value: new THREE.Color(look.sigilColor ?? look.accent) },
        uSigilParams: { value: new THREE.Vector4(...(look.sigilParams ?? [1, 1, 0.6, 0.5])) },
        uWormHead,
        uWormBody,
        uClaimOrigin: { value: new THREE.Vector4() },
        uCubeHalf, uCubeGap
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      toneMapped: false,
      extensions: { derivatives: true }
    });
    mat.userData.elementalInstanced = true;
    _reactionCache.set(recipeId, mat);
  }
  return mat;
}

/** The reaction coat over every cover cell: the same shell, the recipe's material. */
export function ReactionSurfaceSkin({ recipe, look, pattern, count, cellData, meshRef, quality }) {
  const material = useMemo(() => getReactionSurfaceMaterial(recipe, look, pattern), [recipe, look, pattern]);
  const detail = quality?.cellDetail ?? 1;
  const geometry = useMemo(
    () => attachCellAttributes(getShellGeometry(Math.max(2, Math.round(10 * Math.sqrt(detail))), detail < 1 ? 1 : 3).clone(), cellData),
    [cellData, detail]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <instancedMesh ref={meshRef} args={[geometry, material, count]} frustumCulled={false} raycast={() => null} />;
}

/**
 * The shell skin for every cover cell at once — one InstancedMesh, one draw call.
 *
 * The geometry is cloned per mount because it carries this wash's per-cell
 * attributes; the material stays cached. ElementalCubeSkin's single frame loop owns
 * the instance matrices and the envelope; nothing here runs per frame.
 */
export function ElementalSurfaceSkin({ element, color, accent, count, cellData, quality, meshRef }) {
  const highDetail = quality?.accents !== false;
  const material = useMemo(
    () => getElementalSurfaceMaterial(element, color, accent, highDetail),
    [element, color, accent, highDetail]
  );

  const detail = quality?.cellDetail ?? 1;
  const geometry = useMemo(() => {
    const [inner, skirt] = RESOLUTION[element] ?? RESOLUTION.water;
    return attachCellAttributes(getShellGeometry(Math.max(2, Math.round(inner * Math.sqrt(detail))), detail < 1 ? 1 : skirt).clone(), cellData);
  }, [element, cellData, detail]);

  // Ours to dispose — the clone is per mount. The cached source geometry and the
  // cached material outlive it and must not be touched.
  useEffect(() => () => geometry.dispose(), [geometry]);

  return <instancedMesh ref={meshRef} args={[geometry, material, count]} frustumCulled={false} raycast={() => null} />;
}
