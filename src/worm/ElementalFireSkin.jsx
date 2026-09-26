// src/worm/ElementalFireSkin.jsx
//
// The FIRE element's cube skin: the cube is a banked furnace.
//
// Three layers, one InstancedMesh (one draw per layer for the whole cube):
//
//   bed      The grout between stickers becomes a crust of lava cracks — dark,
//            molten along the seams, white-hot where four stickers meet — and the
//            sticker borders scorch. Sticker centres are left alone, so colours,
//            marks and hazards read straight through. This is what the fire looks
//            like head-on, where standing flames have no silhouette to show.
//   tongues  Cel-banded flames rooted IN the seams: a crimson ink edge, red and
//            orange bodies, a yellow band and a pale core, each outline eroded by
//            rising turbulence so the tips split and lick. Crown flames on the cube
//            edges run taller and lean out over the silhouette, so the burning cube
//            has an outline from any angle.
//   light    Additive halos around the flames and embers that streak off the
//            seams — the glow that bleeds into the space around the cube.
//
// ── What changed, and why ────────────────────────────────────────────────────
// The previous skin scattered teardrop SPRITES across every sticker and blended
// them additively. Additive fire over a white or yellow sticker saturates to white,
// and a teardrop seen down its own axis is a round blob, so from the overview
// camera the cube read as confetti — "blobs of orange and red". The tongues are now
// procedural shapes cut out with alpha-to-coverage and written to depth: opaque
// colour bands read the same over any sticker colour, overlapping flames occlude
// each other correctly, and a flame seen end-on fades out while the bed carries
// that view instead.
//
// ── Which way is up ──────────────────────────────────────────────────────────
// Off the face normal. The chase camera's horizon is the worm's face, so for the
// player the face normal IS up; each face burns outward along its own axis. The
// tongues stay broadside by spinning about that axis (an axis-locked billboard).
//
// ── Cost ─────────────────────────────────────────────────────────────────────
// One geometry per quality tier holds a cell's bed, tongues, halos and embers;
// every position, flicker and life cycle is rebuilt in the vertex shader from the
// instance's seed, so the burning cube costs three draw calls and no per-frame CPU
// work beyond the transform loop every skin already shares.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { sharedUniforms } from '../3d/styles/TileStyleMaterials.jsx';
import { sparksForBudget } from './healerWorm/elementalQuality.js';
import { attachCellAttributes } from './healerWorm/elementalCells.js';
import { GLSL_NOISE, GLSL_CELL_ATTRIBUTES, GLSL_CELL_FRAME, GLSL_SEAM, SEAM_HALF, glf } from './healerWorm/elementalGlsl.js';
import { GLSL_WORM, uWormHead, uWormBody } from './healerWorm/elementalUniforms.js';

// Quad kinds, in index-buffer order: the three layers are three geometry groups.
const KIND_BED = 0;
const KIND_TONGUE = 1;
const KIND_GLOW = 2;
const KIND_SPARK = 3;

// Per-vertex corner offsets for one quad, and the two triangles over them.
const QUAD_CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]];
const QUAD_INDICES = [0, 1, 2, 0, 2, 3];

/**
 * One cell's worth of fire: a bed, `tongues` flames, `glows` halos and `sparks`
 * embers. Grouped by layer so a material array can draw each with its own blend.
 *
 * `position` carries the quad's corner purely so the bounds are sane; the shader
 * rebuilds every vertex from `uv`, `aKind` and `aIndex`.
 */
export function buildFireCellGeometry(tongues, glows, sparks) {
  const layout = [
    [KIND_BED, 1],
    [KIND_TONGUE, tongues],
    [KIND_GLOW, glows],
    [KIND_SPARK, sparks]
  ];
  const quads = layout.reduce((n, [, c]) => n + c, 0);
  const position = new Float32Array(quads * 12);
  const uv = new Float32Array(quads * 8);
  const aKind = new Float32Array(quads * 4);
  const aIndex = new Float32Array(quads * 4);
  const index = new Uint16Array(quads * 6);
  let q = 0;
  for (const [kind, n] of layout) {
    for (let slot = 0; slot < n; slot++, q++) {
      for (let c = 0; c < 4; c++) {
        const v = q * 4 + c;
        const [cx, cy] = QUAD_CORNERS[c];
        position[v * 3] = cx - 0.5;
        position[v * 3 + 1] = cy - 0.5;
        position[v * 3 + 2] = 0;
        uv[v * 2] = cx;
        uv[v * 2 + 1] = cy;
        aKind[v] = kind;
        aIndex[v] = slot;
      }
      for (let t = 0; t < 6; t++) index[q * 6 + t] = q * 4 + QUAD_INDICES[t];
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('aKind', new THREE.BufferAttribute(aKind, 1));
  geo.setAttribute('aIndex', new THREE.BufferAttribute(aIndex, 1));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  // Layer 0: bed. Layer 1: tongues. Layer 2: halos and embers (both additive).
  geo.addGroup(0, 6, 0);
  geo.addGroup(6, tongues * 6, 1);
  geo.addGroup(6 + tongues * 6, (glows + sparks) * 6, 2);
  return geo;
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  // (intensity, claim, release, animate) — the shared elemental envelope.
  uniform vec4 uEnv;
  attribute float aKind;
  attribute float aIndex;
  ${GLSL_CELL_ATTRIBUTES}

  varying vec2 vUv;
  varying vec2 vLocal;     // bed: cell-local position, world units
  varying vec3 vWorld;
  varying float vHeat;     // how hot this quad burns right now, 0..1+
  varying float vSeed;
  varying float vAlpha;    // arrival / expiry / facing gate
  varying float vLife;     // embers: 0 at birth → 1 at death

  ${GLSL_NOISE}
  ${GLSL_WORM}

  ${GLSL_SEAM}

  void main() {
    vUv = uv;
    vLife = 0.0;
    ${GLSL_CELL_FRAME}

    float T = uTime * uEnv.w;
    // The claim sweep: each cell catches only when the sweep reaches it, flares as
    // it ignites, then settles. The release tail stops embers first. The start is
    // compressed so the far faces finish igniting before the sweep does — offset by
    // the raw share, the last cells were still at a third of their height when the
    // sweep ended, and stayed there for the whole wash.
    float ignStart = sweepStart(0.28);
    float arrive = smoothstep(ignStart, ignStart + 0.28, uEnv.y);
    float ignite = clamp(arrive * (1.0 - arrive) * 4.0, 0.0, 1.0);
    float burn = arrive * (1.0 - smoothstep(0.05, 0.9, uEnv.z));
    float tail = 1.0 - smoothstep(0.0, 0.4, uEnv.z);

    // Gust bands: a slow plane wave through world space, so neighbouring flames
    // rise and fall TOGETHER and the fire moves across the cube in bands.
    float gust = 0.5 + 0.5 * sin(dot(cellOrigin, vec3(0.62, 0.31, 0.47)) * 1.3 - T * 1.45);
    float upFacing = max(0.0, cellN.y);
    // Buoyancy, in VIEW space. Fire rises toward the top of the screen: in the chase
    // view the camera's up IS the worm's face normal, so the face underfoot burns
    // straight up and the faces past the horizon rise like a wall; from the overview
    // the side faces burn upward like a real burning box instead of bristling
    // sideways. Added to the normal (never replacing it), so a face whose normal
    // points down-screen keeps its flames outside the cube.
    vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);

    vec3 world;
    vHeat = 1.0;
    vSeed = 0.0;
    vAlpha = 1.0;

    if (aKind < 0.5) {
      // ── Bed: flat in the tile plane, covering exactly this cell ────────────
      vec2 l = cellLocal(uv);
      vLocal = l;
      world = cellOrigin + cellX * l.x + cellY * l.y + cellN * 0.012;
      vHeat = 0.55 + 0.45 * gust + 0.5 * ignite;
      vAlpha = arrive * (1.0 - smoothstep(0.35, 1.0, uEnv.z));

    } else if (aKind < 1.5) {
      // ── Tongues: axis-locked billboards rooted in the seams ────────────────
      vec2 id = slotId(0.0);
      float r1 = hash12(id);
      float r2 = hash12(id + 17.3);
      float r3 = hash12(id + 41.9);
      float r4 = hash12(id + 63.1);
      float r5 = hash12(id + 88.7);
      vec4 sp = seamPoint(r1, r2, r3, (r5 - 0.5) * 0.06);
      float crown = sp.z;
      vec3 outward = (step(0.5, r1) < 0.5 ? cellX : cellY) * sp.w;
      vec3 anchor = cellOrigin + cellX * sp.x + cellY * sp.y - cellN * 0.02;

      // The worm parts the fire: flames beside its body lie down and lean away, so
      // the crawler — and whatever it is about to hit — stays in plain sight.
      float wd = wormDist(anchor);
      float clear = smoothstep(0.16, 0.62, wd);

      float flick = 0.84 + 0.16 * sin(T * (6.5 + 5.0 * r1) + r2 * 6.2832);
      // Hot spots drifting along the seams: flames bunch into ridges with quieter
      // stretches between, instead of standing evenly spaced like bristles.
      float hot = vnoise3(anchor * 1.9 + vec3(0.0, T * 0.35, -T * 0.2));
      float height = (0.21 + 0.14 * r4) * (0.6 + 0.6 * hot) * (0.82 + 0.36 * gust) * flick
                   * (1.0 + 0.55 * crown) * (1.0 + 0.2 * upFacing)
                   * (1.0 + 0.6 * ignite) * mix(0.2, 1.0, clear) * burn;
      float width = (0.19 + 0.09 * r5) * (0.85 + 0.3 * hot) * (1.0 + 0.2 * crown) * (0.9 + 0.2 * flick);

      // Each tongue leaves along its own axis, a little off the normal; crowns
      // lean out over the edge they stand on, and flames by the worm lean off it.
      vec3 away = wormAway(anchor);
      away -= cellN * dot(away, cellN);
      vec3 axis = normalize(cellN + camUp * 0.7 + outward * crown * 0.35 + (cellX * (r4 - 0.5) + cellY * (r5 - 0.5)) * 0.3
                            + away * (1.0 - clear) * 0.9);
      vec3 toCam = normalize(cameraPosition - anchor);
      vec3 side = cross(axis, toCam);
      float sideLen = length(side);
      side = sideLen > 1e-4 ? side / sideLen : cellX;
      // sideLen is the sine of the angle between the flame axis and the view. Down
      // the axis the flame has no silhouette, so it fades before it can collapse
      // into a blob; the bed carries that view.
      float facing = smoothstep(0.28, 0.62, sideLen);

      // The tip leans and drifts while the root stays planted.
      float lean = (sin(T * 2.3 + r1 * 6.2832) * 0.6 + (r2 - 0.5) * 0.8) * 0.28 * height;
      vec2 off = vec2((uv.x - 0.5) * width, uv.y * height);
      world = anchor + side * (off.x + lean * uv.y * uv.y) + axis * off.y;

      vSeed = r1 * 17.0 + r2 * 5.0;
      vHeat = clamp(0.8 + 0.22 * gust + 0.2 * crown + 0.3 * ignite, 0.0, 1.35);
      vAlpha = facing * step(0.004, height);

    } else if (aKind < 2.5) {
      // ── Halos: soft light around the flames, strongest on the crowns ───────
      vec2 id = slotId(5.0);
      float r1 = hash12(id);
      float r2 = hash12(id + 23.1);
      float r3 = hash12(id + 51.7);
      // The first halo prefers a cube edge when the cell has one.
      float hasEdge = max(max(aEdge.x, aEdge.y), max(aEdge.z, aEdge.w));
      vec4 sp = seamPoint(r1, r2, r3, 0.0);
      vec3 anchor = cellOrigin + cellX * sp.x + cellY * sp.y + cellN * (0.16 + 0.1 * sp.z);
      vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
      vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
      float size = (0.46 + 0.3 * sp.z + 0.1 * hasEdge) * (0.85 + 0.3 * gust);
      vec2 off = (uv - 0.5) * size;
      world = anchor + right * off.x + up * off.y;
      vHeat = 0.6 + 0.4 * gust;
      vAlpha = burn * (0.25 + 0.75 * sp.z);

    } else {
      // ── Embers: streaks thrown off the seams, curling as they climb ────────
      vec2 id = slotId(9.0);
      float r1 = hash12(id);
      float r2 = hash12(id + 13.7);
      float r3 = hash12(id + 29.3);
      float life = 1.2 + r2 * 1.1;
      float age = fract((T + r1 * 11.0) / life);
      // A fresh launch point each cycle, so embers do not trace one fixed path.
      float cycle = floor((T + r1 * 11.0) / life);
      vec4 sp = seamPoint(hash12(id + cycle * 3.1), hash12(id + cycle * 7.7), r3, 0.0);
      vec3 anchor = cellOrigin + cellX * sp.x + cellY * sp.y;
      float rise = age * (0.55 + 0.5 * r2) * (1.0 + 0.6 * sp.z);
      vec3 swirl = cellX * sin(T * 2.1 + r1 * 9.0) * 0.12 * age + cellY * cos(T * 1.7 + r2 * 9.0) * 0.12 * age;
      vec3 climb = normalize(cellN + camUp * 0.9);
      vec3 pos = anchor + cellN * 0.05 + climb * rise + swirl;
      // Velocity-aligned streak: the ember's recent path, not a round dot.
      vec3 vel = normalize(climb * (0.55 + 0.5 * r2) + cellX * cos(T * 2.1 + r1 * 9.0) * 0.25 + cellY * -sin(T * 1.7 + r2 * 9.0) * 0.2);
      vec3 toCam = normalize(cameraPosition - pos);
      vec3 across = cross(vel, toCam);
      float al = length(across);
      across = al > 1e-4 ? across / al : cellX;
      float len = 0.07 + 0.05 * r3;
      float thick = 0.022 * (1.0 - 0.5 * age);
      world = pos + across * (uv.x - 0.5) * thick + vel * (uv.y - 0.5) * len;
      vLife = age;
      vHeat = 1.0 - age;
      vAlpha = burn * tail * uEnv.w * sin(age * 3.14159265);
    }

    vWorld = world;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec4 uEnv;
  uniform vec3 uInk;      // crimson outline band
  uniform vec3 uRed;
  uniform vec3 uOrange;
  uniform vec3 uYellow;
  uniform vec3 uCore;
  uniform vec3 uCrust;    // banked-over grout
  uniform vec3 uEmber;    // cooling lava

  varying vec2 vUv;
  varying vec2 vLocal;
  varying vec3 vWorld;
  varying float vHeat;
  varying float vSeed;
  varying float vAlpha;
  varying float vLife;

  ${GLSL_NOISE}

  // Lava ramp: crust → ember → orange → yellow → core as heat climbs.
  vec3 lava(float h) {
    vec3 c = mix(uCrust, uEmber, smoothstep(0.0, 0.3, h));
    c = mix(c, uOrange, smoothstep(0.25, 0.6, h));
    c = mix(c, uYellow, smoothstep(0.55, 0.85, h));
    return mix(c, uCore, smoothstep(0.85, 1.05, h));
  }

  void main() {
    float T = uTime * uEnv.w;
    vec3 col;
    float a;

  #if FIRE_LAYER == 0
    // ── Bed: lava cracks in the grout, a burning front on the sticker borders ─
    vec2 st = fract(vLocal + 0.5) - 0.5;
    float d = 0.5 - max(abs(st.x), abs(st.y));       // 0 on a seam → 0.5 mid-sticker
    // Molten flow crawling along the cracks, continuous across cells and faces.
    float flow = fbm3(vWorld * 2.4 + vec3(0.0, -T * 0.5, T * 0.28));
    float grain = vnoise3(vWorld * 9.0 + vec3(T * 0.2, 0.0, 0.0));
    // The crack is the grout plus a ragged bite out of each sticker's border, as if
    // the edges had already burned away.
    float bite = 0.018 + 0.03 * flow + 0.012 * grain;
    float seam = 1.0 - smoothstep(${glf(SEAM_HALF)} + bite - 0.03, ${glf(SEAM_HALF)} + bite, d);
    // Where four stickers meet the crust is thinnest and burns white.
    float node = 1.0 - smoothstep(0.0, 0.2, length(0.5 - abs(st)));
    float pulse = 0.8 + 0.3 * sin(T * 2.2 + flow * 7.0);
    float core = 1.0 - smoothstep(0.0, ${glf(SEAM_HALF)} * 0.7, d);   // the vein's centre line
    float heat = (seam * (0.35 + 0.55 * flow) + core * 0.35 + node * 0.5) * pulse * vHeat;
    heat *= 1.0 - uEnv.z * 0.8;                       // cools as the wash ends
    col = lava(heat);

    // Char and its burning front: a sooty band inside every sticker border, edged
    // with a thin glowing line where it meets the unburnt tile — paper catching.
    // It stops well short of the centre so colours and marks stay clean.
    float ragged = fbm3(vWorld * 7.5 + vec3(T * 0.05));
    float front = ${glf(SEAM_HALF)} + 0.045 + 0.05 * flow + 0.05 * ragged;
    float charBand = (1.0 - seam) * (1.0 - smoothstep(front - 0.012, front, d));
    float burnLine = (1.0 - seam) * smoothstep(front - 0.02, front - 0.006, d) * (1.0 - smoothstep(front - 0.004, front + 0.006, d));
    col = mix(col, uCrust * (1.0 + 0.8 * grain), charBand);
    col = mix(col, mix(uOrange, uYellow, flow), burnLine);
    // Ember specks smouldering in the char.
    float speck = step(0.93, grain) * charBand * (0.6 + 0.4 * sin(T * 5.0 + flow * 20.0));
    col = mix(col, uYellow, speck);
    // The fire's light spilling onto the unburnt tile beyond the front.
    float spill = (1.0 - seam) * (1.0 - charBand) * (1.0 - smoothstep(front, front + 0.2, d)) * (0.5 + 0.5 * flow);
    col = mix(col, uOrange, spill * 0.9);
    a = seam * 0.95 + charBand * 0.78 + burnLine * 0.9 + spill * 0.2;
    a *= vAlpha;
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));

  #elif FIRE_LAYER == 1
    // ── Tongue: cel-banded flame cut out of rising turbulence ───────────────
    vec2 p = vec2(vUv.x * 2.0 - 1.0, vUv.y);
    // A sideways lick that grows toward the tip.
    float lick = vnoise2(vec2(vUv.y * 2.6 - T * 3.2, vSeed));
    p.x += (lick - 0.5) * 0.7 * p.y;
    // Teardrop profile: a round bulb low down, swept up into a curling tip.
    float prof = pow(clamp(1.0 - p.y, 0.0, 1.0), 0.55) * smoothstep(-0.12, 0.26, p.y) * 1.08;
    float body = 1.0 - abs(p.x) / max(prof, 0.001);
    // Turbulence rising through the flame erodes the outline: tips split, licks
    // detach and re-form.
    // Low frequency on purpose: a few big rounded lobes, not a fringe of jaggies.
    vec2 np = vec2(vUv.x * 1.6 + vSeed, vUv.y * 1.9 - T * 2.4);
  #ifdef FIRE_HQ
    float n = vnoise2(np) * 0.78 + vnoise2(np * 2.3 + 7.1) * 0.22;
  #else
    float n = vnoise2(np);
  #endif
    float heat = (body * (1.05 - 0.35 * p.y) + (n - 0.5) * (0.25 + 0.95 * p.y) - p.y * 0.3) * vHeat;
    if (heat < 0.07 || vAlpha < 0.01) discard;
    // Four flat bands with crisp edges, plus the dark ink edge outside them.
    col = uInk;
    col = mix(col, uRed, step(0.15, heat));
    col = mix(col, uOrange, step(0.3, heat));
    col = mix(col, uYellow, step(0.5, heat));
    col = mix(col, uCore, step(0.74, heat));
    // Alpha-to-coverage turns the fade into a clean dither at the silhouette.
    a = vAlpha * smoothstep(0.07, 0.11, heat);
    gl_FragColor = vec4(col, a);

  #else
    // ── Halos and embers: additive light ────────────────────────────────────
    if (vLife > 0.0) {
      // Ember streak: bright head, trailing tail, gold at birth cooling to red.
      float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
      float along = smoothstep(0.0, 0.7, vUv.y) * (1.0 - smoothstep(0.85, 1.0, vUv.y));
      col = mix(uEmber, mix(uYellow, uCore, 0.4), vHeat * vHeat);
      a = across * across * along * vAlpha * 1.4;
    } else {
      vec2 q = vUv - 0.5;
      float r2 = dot(q, q) * 4.0;
      float fall = exp(-r2 * 3.4) - 0.035;
      col = mix(uRed, uOrange, 0.55 + 0.3 * vHeat);
      a = max(fall, 0.0) * 0.22 * vAlpha;
    }
    gl_FragColor = vec4(col * a, a);
  #endif

    #include <colorspace_fragment>
  }
`;

// Shared materials, one set per detail tier. Module-scoped and never disposed by a
// mounting component — the geometry is per mount, these outlive it. The three
// layers share their uniform objects, so the skin's one write per frame reaches all.
const _fireMats = new Map();
export function getFireMaterials(highDetail) {
  const key = highDetail ? 'hq' : 'lq';
  let mats = _fireMats.get(key);
  if (mats) return mats;
  const color = (hex) => ({ value: new THREE.Color(hex) });
  const shared = {
    uTime: sharedUniforms.time, // ticked by CubeAssembly every frame
    uEnv: { value: new THREE.Vector4(1, 1, 0, 1) },
    uWormHead,
    uWormBody,
    // Crimson ink → red → orange → yellow → pale gold: saturated, flat bands.
    uInk: color('#8a1307'),
    uRed: color('#d8260c'),
    uOrange: color('#ff6d12'),
    uYellow: color('#ffc12e'),
    uCore: color('#fff3c4'),
    uCrust: color('#1a0503'),
    uEmber: color('#8c1605')
  };
  const make = (layer, extra) => {
    const m = new THREE.ShaderMaterial({
      defines: { FIRE_LAYER: layer, ...(highDetail ? { FIRE_HQ: '' } : {}) },
      uniforms: shared,
      vertexShader,
      fragmentShader,
      toneMapped: false,
      ...extra
    });
    m.userData.elementalInstanced = true;
    return m;
  };
  mats = [
    // Bed: alpha-blended so the scorch can darken, depth-tested so flames cover it.
    make(0, { transparent: true, depthWrite: false }),
    // Tongues: opaque cut-outs. Alpha-to-coverage smooths the silhouette under MSAA
    // and they write depth, so overlapping flames sort themselves.
    make(1, { transparent: false, alphaToCoverage: true, side: THREE.DoubleSide }),
    // Halos and embers: pure light.
    make(2, { transparent: true, depthWrite: false, blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation })
  ];
  _fireMats.set(key, mats);
  return mats;
}

/**
 * The burning skin for every cover cell at once.
 *
 * The caller owns the instance matrices and the shared uniforms: ElementalCubeSkin's
 * single frame loop writes each cell's live transform straight into
 * `instanceMatrix`, the same loop that drives every other element.
 *
 * @param {number} count     number of cover cells
 * @param {object} cellData  per-cell masks, extents, edges and sweep shares
 * @param {object} quality   the resolved elemental quality budget
 * @param {object} meshRef   ref the skin writes instance matrices through
 */
export default function ElementalFireSkin({ count, cellData, quality, meshRef }) {
  const tongues = quality?.flamesPerCell ?? 6;
  const animate = quality?.animate !== false;
  const sparks = sparksForBudget(tongues, animate);
  const glows = quality?.accents ? 2 : 1;
  const highDetail = !!quality?.accents;

  const geometry = useMemo(
    () => attachCellAttributes(buildFireCellGeometry(tongues, glows, sparks), cellData),
    [tongues, glows, sparks, cellData]
  );
  const materials = getFireMaterials(highDetail);

  // The geometry is built per mount (its layout depends on the quality tier), so
  // it is ours to dispose. The materials are shared and stay.
  useEffect(() => () => geometry.dispose(), [geometry]);

  return <instancedMesh ref={meshRef} args={[geometry, materials, count]} frustumCulled={false} raycast={() => null} />;
}
