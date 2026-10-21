// src/worm/healerWorm/elementalAdornments.js
//
// Cube-scale adornments for the shell skins: water drips off the cube, ice hangs
// icicles from it. Both live on the cube's world-DOWNWARD edges, the one place
// gravity would put them, so they never sit over a tile the worm reads or crawls on.
//
//   water   a bead runs down a side face to its lower edge, swells under the
//           rounded rim, lets go and falls away along world −Y.
//   ice     icicles hang from the same edges, growing with the claim sweep and
//           shrinking as the ice melts at release.
//
// ── Cost ─────────────────────────────────────────────────────────────────────
// No mesh of its own. The adornment quads are a second geometry group appended to
// each cover cell's shell patch, drawn with this material from the SAME
// InstancedMesh (ElementalSurface.jsx), so they take the shell's instance matrices
// and ElementalCubeSkin's one uniform write per frame. The vertex shader builds
// every quad from the cell's frame and a hash; a slot whose cell has no downward
// edge collapses to a point and costs only its four vertices. One program per
// element, one extra draw while the wash is up.
//
// The count is the device tier's adornment budget (elementalQuality.js): at most
// `adornments` quads over the four lower edges. Drips are motion, so reduced motion
// (and the floor tier) gets none.

import * as THREE from 'three';
import { sharedUniforms } from '../../3d/styles/TileStyleMaterials.jsx';
import { GLSL_NOISE, GLSL_CELL_ATTRIBUTES, GLSL_CELL_FRAME } from './elementalGlsl.js';
import { GLSL_WORM, uWormHead, uWormBody, uCubeGap } from './elementalUniforms.js';
import { WATER_HEIGHT, ICE_DEPTH, EDGE_PAD } from './elementalShell.js';

/** Which shell elements carry adornments, and which kind. */
export const ADORNMENT_MODE = { water: 0, ice: 1 };

// A cube has four world-downward edges (each side face's lower edge) and a cover
// grid puts `skinGrid` cells along each.
const DOWN_EDGES = 4;
const MAX_SLOTS_PER_CELL = 3;

/**
 * Adornment quads per cover cell for this element and device tier: as many as fit
 * the tier's budget across the cells on the four lower edges, and none for an
 * element without adornments or (for water's falling drips) without motion.
 */
export function adornmentSlots(element, quality) {
  const mode = ADORNMENT_MODE[element];
  if (mode === undefined || !quality) return 0;
  if (mode === ADORNMENT_MODE.water && quality.animate === false) return 0;
  const cells = DOWN_EDGES * Math.max(1, quality.skinGrid ?? 1);
  return Math.min(MAX_SLOTS_PER_CELL, Math.floor((quality.adornments ?? 0) / cells));
}

const QUAD_CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]];

/**
 * The shell patch with `slots` adornment quads appended as group 1. The shell
 * keeps group 0 untouched (its own vertices, uvs and index), so the shell program
 * draws exactly what it drew before. `aSlot` is the quad's place among the slots,
 * (i + 0.5) / slots, and 0 on the shell. The result is a fresh geometry, owned
 * (and disposed) by the caller.
 */
export function adornedShellGeometry(shell, slots) {
  const shellVerts = shell.attributes.position.count;
  const shellIndex = shell.index.array;
  const verts = shellVerts + slots * 4;
  const position = new Float32Array(verts * 3);
  const uv = new Float32Array(verts * 2);
  const aSlot = new Float32Array(verts);
  position.set(shell.attributes.position.array);
  uv.set(shell.attributes.uv.array);
  const index = Array.from(shellIndex);
  for (let q = 0; q < slots; q++) {
    const base = shellVerts + q * 4;
    for (let c = 0; c < 4; c++) {
      const [cx, cy] = QUAD_CORNERS[c];
      // Positions only keep the bounds sane: the shader rebuilds every vertex.
      position[(base + c) * 3] = cx;
      position[(base + c) * 3 + 1] = cy;
      uv[(base + c) * 2] = cx;
      uv[(base + c) * 2 + 1] = cy;
      aSlot[base + c] = (q + 0.5) / slots;
    }
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('aSlot', new THREE.BufferAttribute(aSlot, 1));
  geo.setIndex(index);
  geo.addGroup(0, shellIndex.length, 0);
  geo.addGroup(shellIndex.length, slots * 6, 1);
  return geo;
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  // (intensity, claim, release, animate) — the shared elemental envelope.
  uniform vec4 uEnv;
  // (shell depth above the stickers, how far the wrap's axis sits past the lattice)
  uniform vec2 uShell;
  uniform float uCubeGap;
  attribute float aSlot;
  ${GLSL_CELL_ATTRIBUTES}

  varying vec2 vQuad;    // water: -1..1 across and along the bead; ice: across, root→tip
  varying vec2 vShape;   // half width, half length (water) / root width, length (ice)
  varying float vAlpha;

  ${GLSL_NOISE}
  ${GLSL_WORM}

  void main() {
    ${GLSL_CELL_FRAME}
    float T = uTime * uEnv.w;
    vec2 id = vec2(mod(aCell.w, 251.0), floor(aCell.w / 251.0)) + vec2(aSlot * 71.3 + 3.0, aSlot * 37.1 - 1.9);

    // The border of this cell that faces most nearly world-down, if it is a cube
    // edge. World-down from each border is minus its outward axis's y.
    vec4 score = vec4(cellX.y, -cellX.y, cellY.y, -cellY.y) * aEdge;
    vec3 o = -cellX; vec3 along = cellY;
    float e = aExtent.x; float eOpp = aExtent.y; float lo = aExtent.z; float hi = aExtent.w;
    float downness = score.x;
    if (score.y > downness) { o = cellX; e = aExtent.y; eOpp = aExtent.x; downness = score.y; }
    if (score.z > downness) { o = -cellY; along = cellX; e = aExtent.z; eOpp = aExtent.w; lo = aExtent.x; hi = aExtent.y; downness = score.z; }
    if (score.w > downness) { o = cellY; along = cellX; e = aExtent.w; eOpp = aExtent.z; lo = aExtent.x; hi = aExtent.y; downness = score.w; }
    // A lower edge of a side face points straight down (1); a turning slice rolls
    // it away smoothly, and a separated cube (every rim exposed) drops them all.
    float onEdge = smoothstep(0.45, 0.85, downness) * (1.0 - smoothstep(0.02, 0.1, uCubeGap));
    float depth = uShell.x;
    float start = aSweep * 0.7 / 0.92;
    float arrive = smoothstep(start, start + 0.3, uEnv.y);
    vec3 down = vec3(0.0, -1.0, 0.0);

    vec3 P;
    vec3 axisV;
    float wid;
    float len;
    float alpha;

  #if ADORN_MODE == 0
    // ── Water: run down the face, swell under the rim, let go, fall ──────────
    float r1 = hash12(id);
    float r2 = hash12(id + 13.7);
    float r3 = hash12(id + 29.3);
    float life = 2.4 + r2 * 1.6;
    float cyc = (T + r1 * 13.0) / life;
    float age = fract(cyc);
    float cycle = floor(cyc);
    // A fresh spot along the edge each cycle, and not every cycle drips.
    float on = step(0.35, hash12(id + cycle * 5.3 + 0.7));
    float t = mix(-lo + 0.1, hi - 0.1, hash12(id + cycle * 3.1 + 2.2));
    vec3 axisPoint = cellOrigin + o * (e + uShell.y) + along * t;
    vec3 edgeTop = axisPoint + cellN * depth;              // where the flat meets the rim
    vec3 hang = axisPoint + (cellN * 0.17 + o * 0.98) * depth; // under the rounded rim
    float runLen = min(0.3 + 0.45 * r3, max(0.0, e + eOpp - 0.12));
    if (age < 0.42) {
      float s = age / 0.42;
      s *= s;                                              // it gathers speed down the face
      P = edgeTop - o * runLen * (1.0 - s);
      axisV = o;
      wid = 0.022;
      len = 0.06 + 0.03 * s;
    } else if (age < 0.62) {
      float s = smoothstep(0.42, 0.62, age);
      P = mix(edgeTop, hang, s);
      axisV = down;
      wid = mix(0.026, 0.048, s);
      len = wid * 1.15;
    } else {
      float tf = (age - 0.62) * life;                     // seconds since it let go
      P = hang + down * (2.75 * tf * tf);                 // ½·g·t², g = 5.5 like the sparks
      axisV = down;
      wid = 0.042;
      len = 0.048 + min(0.12, tf * 0.15);                 // stretched by its speed
    }
    // The release tail stops new beads first; the worm's body keeps them off it.
    float tail = 1.0 - smoothstep(0.0, 0.35, uEnv.z);
    float clear = smoothstep(0.25, 0.7, wormDist(axisPoint));
    alpha = on * onEdge * arrive * tail * uEnv.w * clear
          * smoothstep(0.0, 0.04, age) * (1.0 - smoothstep(0.85, 1.0, age));
    vec3 toCam = normalize(cameraPosition - P);
    vec3 across = cross(axisV, toCam);
    float al = length(across);
    across = al > 1e-4 ? across / al : along;
    vQuad = (uv - 0.5) * 2.0;
    vShape = vec2(wid, len);
    vec3 world = P + across * vQuad.x * wid + axisV * vQuad.y * len;

  #else
    // ── Ice: icicles hanging off the rim, spaced along the edge ──────────────
    float r1 = hash12(id);
    float r2 = hash12(id + 13.7);
    float r3 = hash12(id + 29.3);
    float r4 = hash12(id + 41.9);
    float t = mix(-lo + 0.08, hi - 0.08, clamp(aSlot + (r1 - 0.5) * 0.3, 0.04, 0.96));
    vec3 axisPoint = cellOrigin + o * (e + uShell.y) + along * t;
    vec3 root = axisPoint + normalize(cellN * 0.55 + o) * depth * 0.9;
    // They grow as the frost reaches this cell and shrink as the ice melts; next to
    // the worm they stay stubs.
    float grow = arrive * (1.0 - smoothstep(0.0, 0.85, uEnv.z));
    float clear = smoothstep(0.25, 0.7, wormDist(axisPoint));
    len = (0.1 + 0.3 * r2 * r2 + 0.06 * r3) * grow * mix(0.25, 1.0, clear) * onEdge * step(0.15, r4);
    wid = (0.03 + 0.03 * r3) * (0.6 + 0.4 * grow);
    axisV = normalize(down + o * (r1 - 0.35) * 0.18);
    vec3 toCam = normalize(cameraPosition - root);
    vec3 side = cross(axisV, toCam);
    float sl = length(side);
    side = sl > 1e-4 ? side / sl : along;
    // Looking straight up or down an icicle it has no silhouette: fade it out.
    alpha = smoothstep(0.15, 0.45, sl) * step(0.004, len);
    vQuad = vec2((uv.x - 0.5) * 2.0, uv.y);
    vShape = vec2(wid, len);
    vec3 world = root + side * (uv.x - 0.5) * 2.0 * wid * (1.0 - uv.y) + axisV * uv.y * len;
  #endif

    vAlpha = alpha;
    // An unused slot collapses to a point: no area, no fragments.
    if (alpha < 0.001) world = cellOrigin;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uAccent;
  varying vec2 vQuad;
  varying vec2 vShape;
  varying float vAlpha;

  void main() {
    if (vAlpha < 0.002) discard;
  #if ADORN_MODE == 0
    // A bead of water: a capsule, dark at the rim where it bends the light away,
    // clear in the middle, one hard glint.
    vec2 p = vQuad * vShape;
    float seg = max(vShape.y - vShape.x, 0.0);
    float d = length(vec2(p.x, max(abs(p.y) - seg, 0.0))) / vShape.x;
    float inside = 1.0 - smoothstep(0.82, 1.0, d);
    if (inside <= 0.0) discard;
    vec3 body = mix(uColor * 0.5, vec3(0.86, 0.97, 1.0), 0.3 * (1.0 - d));
    body = mix(body, uColor * 0.22, smoothstep(0.55, 0.95, d));
    vec2 g = vQuad - vec2(-0.3, 0.35);
    float glint = exp(-dot(g, g) * 18.0);
    float a = inside * mix(0.55, 0.92, smoothstep(0.4, 1.0, d)) * vAlpha;
    vec3 light = (vec3(1.0) * glint * 0.9 + uAccent * 0.08) * inside * vAlpha;
  #else
    // An icicle: frosted white along its edges, clear blue down the middle, a cold
    // streak of light down one side and a bright point at the tip.
    float x = vQuad.x;
    float y = vQuad.y;
    float rim = smoothstep(0.45, 1.0, abs(x));
    vec3 clearIce = uColor * vec3(0.35, 0.62, 0.9);
    vec3 body = mix(clearIce, vec3(0.92, 0.98, 1.0), rim * 0.85 + (1.0 - y) * 0.15);
    float a = mix(0.5, 0.95, rim) * (1.0 - smoothstep(0.88, 1.0, abs(x))) * vAlpha;
    float streak = exp(-(x + 0.3) * (x + 0.3) * 22.0);
    vec3 light = (vec3(0.85, 0.97, 1.0) * streak * 0.55 + vec3(1.0) * exp(-(1.0 - y) * 16.0) * 0.5) * vAlpha;
  #endif
    // Premultiplied, like the shell: the body is encoded for the output before it
    // is weighted, and the light is added raw (see ElementalSurface.jsx).
    gl_FragColor = vec4(linearToOutputTexel(vec4(body, 1.0)).rgb * a + light, a);
  }
`;

// Where each shell's rim is (elementalShell.js), so its drips and icicles hang
// from the shell itself rather than from the stickers under it.
const SHELL_DEPTH = { water: WATER_HEIGHT.base, ice: ICE_DEPTH };

const _matCache = new Map();
/**
 * The drips (water) or icicles (ice) material for a shell element, or null for an
 * element without adornments. Cached per element and colours; never disposed by a
 * mounting component.
 */
export function getElementalAdornmentMaterial(element, colorHex, accentHex) {
  const mode = ADORNMENT_MODE[element];
  if (mode === undefined) return null;
  const depth = SHELL_DEPTH[element], edgePad = EDGE_PAD;
  const key = `${element}_${colorHex}_${accentHex}`;
  let mat = _matCache.get(key);
  if (!mat) {
    mat = new THREE.ShaderMaterial({
      defines: { ADORN_MODE: mode },
      uniforms: {
        uTime: sharedUniforms.time,
        uEnv: { value: new THREE.Vector4(1, 1, 0, 1) },
        uShell: { value: new THREE.Vector2(depth, edgePad) },
        uColor: { value: new THREE.Color(colorHex) },
        uAccent: { value: new THREE.Color(accentHex) },
        uWormHead,
        uWormBody,
        uCubeGap
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      toneMapped: false,
      // Camera-facing quads: either winding is a front. One pass, not two.
      side: THREE.DoubleSide,
      forceSinglePass: true
    });
    mat.userData.elementalInstanced = true;
    _matCache.set(key, mat);
  }
  return mat;
}
