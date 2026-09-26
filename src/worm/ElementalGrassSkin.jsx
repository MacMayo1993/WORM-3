// src/worm/ElementalGrassSkin.jsx
//
// The NATURE element's cube skin: the cube becomes a living terrarium.
//
//   moss     The grout between stickers fills with moss, creeping over the sticker
//            borders in soft irregular patches. Sticker centres stay clear, so the
//            tile colours, marks and hazards read straight through.
//   grass    Blades rooted IN the seams — grass growing between paving stones —
//            clumped by a slow field into tufts and clearings, lusher along the
//            cube's edges so the silhouette is fringed. They sway in a breeze that
//            rolls across the cube, and part around the worm's body.
//   ivy      Broad leaves spilling over the cube's edges, the terrarium's
//            silhouette from the overview camera.
//   flowers  A few small blooms nodding in the grass: the last beat of the claim.
//
// The claim grows it in stages — moss first, then grass, then the flowers open —
// and the release wilts it: blades yellow and droop, flowers close, the moss fades.
//
// ── What changed, and why ────────────────────────────────────────────────────
// The previous skin stamped the same fan of blades over every sticker's FACE and
// left the grout bare, so the cube read as stickers wearing grass decals and every
// tile's colour was hidden under leaves. Growth now comes out of the seams, which
// is both where plants actually take hold on a tiled surface and where they cost
// the player nothing.
//
// ── Cost ─────────────────────────────────────────────────────────────────────
// One geometry per quality tier (natureMeadow.js), two draws for the whole cube:
// the moss bed, then every plant. Everything is placed in the vertex shader from
// the instance's seed; the CPU does only the shared transform loop.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { sharedUniforms } from '../3d/styles/TileStyleMaterials.jsx';
import { buildNatureCellGeometry, BLADE_ROWS, NATURE_BUDGET } from './healerWorm/natureMeadow.js';
import { attachCellAttributes } from './healerWorm/elementalCells.js';
import { GLSL_NOISE, GLSL_CELL_ATTRIBUTES, GLSL_CELL_FRAME, GLSL_SEAM, SEAM_HALF, glf } from './healerWorm/elementalGlsl.js';
import { GLSL_WORM, uWormHead, uWormBody } from './healerWorm/elementalUniforms.js';

const vertexShader = /* glsl */ `
  uniform float uTime;
  // (intensity, claim, release, animate) — the shared elemental envelope.
  uniform vec4 uEnv;
  attribute float aKind;
  attribute float aIndex;
  ${GLSL_CELL_ATTRIBUTES}

  varying vec2 vUv;
  varying vec2 vLocal;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vKind;
  varying float vTone;      // per-plant colour variation
  varying float vShade;     // 0 at the root → 1 at the tip (blades)
  varying float vGrow;      // 0..1 how grown this plant is
  varying float vWilt;      // 0 alive → 1 wilted

  ${GLSL_NOISE}
  ${GLSL_SEAM}
  ${GLSL_WORM}

  void main() {
    vUv = uv;
    vKind = aKind;
    vTone = 0.0;
    vShade = 0.0;
    ${GLSL_CELL_FRAME}

    float T = uTime * uEnv.w;
    float wilt = smoothstep(0.0, 0.8, uEnv.z);
    vWilt = wilt;
    // Grow in stages behind the claim sweep: moss, then grass, then flowers.
    float mossAt = sweepStart(0.5);
    float grassAt = mossAt + 0.12;
    float bloomAt = mossAt + 0.3;
    // The camera's up, projected onto this face: blades lean toward it the way a
    // plant turns to the light, so the side faces grow like a hillside rather than
    // bristling out sideways like fur.
    vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 upT = camUp - cellN * dot(camUp, cellN);
    // A breeze rolling across the cube in world space, so neighbouring tufts sway
    // together and the wind visibly travels.
    vec3 windDir = normalize(vec3(0.8, 0.15, 0.55));
    float gust = sin(dot(cellOrigin, windDir) * 1.6 - T * 1.3);

    vec3 world;
    vec3 nrm = cellN;

    if (aKind < 0.5) {
      // ── Moss bed: flat in the tile plane, exactly covering this cell ───────
      vec2 l = cellLocal(uv);
      vLocal = l;
      world = cellOrigin + cellX * l.x + cellY * l.y + cellN * 0.01;
      vGrow = smoothstep(mossAt, mossAt + 0.5, uEnv.y) * (1.0 - smoothstep(0.4, 1.0, uEnv.z));

    } else if (aKind < 1.5) {
      // ── Grass: curved blades rooted in the seams ───────────────────────────
      vec2 id = slotId(0.0);
      float r1 = hash12(id);
      float r2 = hash12(id + 17.3);
      float r3 = hash12(id + 41.9);
      float r4 = hash12(id + 63.1);
      float r5 = hash12(id + 88.7);
      float r6 = hash12(id + 5.9);
      // Roots straddle the grout a little, so a tuft reads as growing out of it.
      vec4 sp = seamPoint(r1, r2, r3, (r4 - 0.5) * 0.14);
      vec3 root = cellOrigin + cellX * sp.x + cellY * sp.y;
      // Tufts and clearings: a slow field thins the grass in places and piles it
      // up in others. Cube edges are always lush — that is the silhouette.
      float clump = vnoise3(root * 1.8 + 7.3);
      float lush = clamp(smoothstep(0.28, 0.62, clump) + sp.z * 0.7, 0.0, 1.0);
      float grow = smoothstep(grassAt + r5 * 0.08, grassAt + r5 * 0.08 + 0.3, uEnv.y);
      // The worm parts the grass: blades beside its body flatten and lie away.
      float clear = smoothstep(0.14, 0.5, wormDist(root));
      vec3 away = wormAway(root);
      away -= cellN * dot(away, cellN);

      float h = (0.09 + 0.15 * r4) * mix(0.25, 1.0, lush) * (1.0 + 0.45 * sp.z)
              * grow * mix(0.3, 1.0, clear) * (1.0 - 0.35 * wilt);
      float w = (0.016 + 0.014 * r6) * (0.8 + 0.4 * lush);
      // Lean: a random heading, pulled toward the light, blown by the gust, pushed
      // off the worm; a wilting blade flops.
      float ang = r5 * 6.2831853;
      vec3 heading = cellX * cos(ang) + cellY * sin(ang);
      vec3 lean = heading * (0.25 + 0.4 * r3) + upT * 0.55 + windDir * gust * 0.18
                + away * (1.0 - clear) * 1.4;
      lean -= cellN * dot(lean, cellN);
      float bend = 0.55 + 0.5 * r2 + wilt * 1.2;
      // The blade's flat side faces a random way, so tufts have depth.
      float face = r6 * 6.2831853;
      vec3 across = normalize(cellX * cos(face) + cellY * sin(face));

      float t = uv.y;
      float side = uv.x * 2.0 - 1.0;
      // Flutter at the tip, on its own beat.
      float flutter = sin(T * 3.1 + r1 * 17.0) * 0.12 * t * t;
      vec3 spine = cellN * t + (lean * bend + across * flutter) * t * t;
      vec3 tangent = normalize(cellN + (lean * bend + across * flutter) * 2.0 * t);
      float taper = pow(1.0 - t, 0.75);
      world = root + spine * h + across * side * w * taper;
      // The spine folds forward: the two edges tilt back, so the blade catches
      // light like a creased leaf rather than a flat card.
      vec3 bn = normalize(cross(across, tangent));
      nrm = normalize(bn + across * side * 0.45);
      vTone = r4;
      vShade = t;
      vGrow = step(0.002, h);

    } else if (aKind < 2.5) {
      // ── Ivy: broad leaves spilling over the cube's edges ───────────────────
      vec2 id = slotId(3.0);
      float r1 = hash12(id);
      float r2 = hash12(id + 13.7);
      float r3 = hash12(id + 29.3);
      float r4 = hash12(id + 51.1);
      vec4 sp = seamPoint(r1, r2, r3, 0.0);
      // Only on a cube edge; anywhere else the leaf collapses to nothing.
      float onEdge = sp.z;
      vec3 outward = (step(0.5, r1) < 0.5 ? cellX : cellY) * sp.w;
      vec3 root = cellOrigin + cellX * sp.x + cellY * sp.y + cellN * 0.02;
      float grow = smoothstep(grassAt + 0.05, grassAt + 0.4, uEnv.y) * (1.0 - 0.3 * wilt);
      float size = (0.15 + 0.08 * r4) * onEdge * grow;
      // The leaf leans out over the edge and droops past it.
      float sway = sin(T * 1.7 + r1 * 9.0 + gust) * 0.12;
      vec3 dir = normalize(outward * 0.85 + cellN * (0.35 - 0.3 * r3) - cellN * wilt * 0.5);
      vec3 side = normalize(cross(cellN, outward));
      side = normalize(side + dir * sway);
      vec2 q = uv - vec2(0.5, 0.0);
      world = root + side * q.x * size * 0.8 + dir * q.y * size;
      nrm = normalize(cross(side, dir));
      if (dot(nrm, cameraPosition - root) < 0.0) nrm = -nrm;
      vTone = r4;
      vGrow = step(0.002, size);

    } else {
      // ── Flowers: small blooms nodding in the grass ─────────────────────────
      vec2 id = slotId(9.0);
      float r1 = hash12(id);
      float r2 = hash12(id + 19.1);
      float r3 = hash12(id + 37.7);
      float r4 = hash12(id + 71.3);
      // On a seam, so the sticker centres stay clear.
      vec4 sp = seamPoint(r1, r2, r3, 0.0);
      vec3 root = cellOrigin + cellX * sp.x + cellY * sp.y;
      float clear = smoothstep(0.14, 0.45, wormDist(root));
      float bloom = smoothstep(bloomAt + r4 * 0.1, bloomAt + r4 * 0.1 + 0.25, uEnv.y);
      // Only one cell in three or so flowers at all, so the blooms stay an accent.
      float present = step(0.55, hash12(id + 91.0));
      float size = (0.09 + 0.045 * r4) * bloom * present * mix(0.4, 1.0, clear) * (1.0 - 0.6 * wilt);
      vec3 toCam = normalize(cameraPosition - root);
      vec3 faceN = normalize(cellN * 0.55 + toCam * 0.45);
      vec3 fx = normalize(cross(abs(faceN.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0), faceN));
      vec3 fy = cross(faceN, fx);
      float nod = sin(T * 1.4 + r1 * 11.0 + gust) * 0.02;
      vec3 head = root + cellN * (0.09 + 0.06 * r2) * bloom + (upT + fx * nod) * 0.02;
      world = head + fx * (uv.x - 0.5) * size + fy * (uv.y - 0.5) * size;
      nrm = faceN;
      vTone = r4;
      vGrow = step(0.002, size);
    }

    vWorld = world;
    vNormal = nrm;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec4 uEnv;
  varying vec2 vUv;
  varying vec2 vLocal;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vKind;
  varying float vTone;
  varying float vShade;
  varying float vGrow;
  varying float vWilt;

  ${GLSL_NOISE}

  const vec3 KEY = vec3(0.45, 0.85, 0.35);

  void main() {
    vec3 v = normalize(cameraPosition - vWorld);
    vec3 col;
    float a = 1.0;

  #if NATURE_LAYER == 0
    // ── Moss: filling the grout, creeping over the sticker borders ──────────
    vec2 st = fract(vLocal + 0.5) - 0.5;
    float d = 0.5 - max(abs(st.x), abs(st.y));     // 0 on a seam → 0.5 mid-sticker
    // The moss never reaches this far onto a sticker (its reach tops out near 0.17),
    // so the middle of every tile skips the noise entirely.
    if (d > 0.2) discard;
    float creep = fbm3(vWorld * 3.1 + 1.7);
    float fuzz = vnoise3(vWorld * 26.0);
    // The moss line wanders: it fills the grout, then reaches a little way onto the
    // tile in soft lobes, never near the centre.
    // Mostly it stays in the grout; only here and there a cushion spills over.
    float reach = ${glf(SEAM_HALF)} + 0.008 + 0.075 * smoothstep(0.52, 0.8, creep) + 0.02 * (fuzz - 0.5);
    float moss = 1.0 - smoothstep(reach - 0.02, reach + 0.006, d);
    // Cushions: rounded clumps, dark in the gaps between them and lit on top.
    float clumps = fbm3(vWorld * 9.0);
    float cushion = smoothstep(0.3, 0.75, clumps) * 0.75 + fuzz * 0.25;
    vec3 deep = vec3(0.012, 0.05, 0.014);
    vec3 top = vec3(0.1, 0.3, 0.05);
    col = mix(deep, top, cushion);
    // Tiny pale sporophytes catching the light.
    col = mix(col, vec3(0.55, 0.66, 0.26), step(0.95, fuzz) * 0.7);
    // Faded and browned as the wash wilts.
    col = mix(col, vec3(0.3, 0.24, 0.1) * (0.6 + cushion), vWilt * 0.7);
    // A soft, fuzzy boundary — moss has no hard outline.
    float rim = smoothstep(reach - 0.04, reach, d);
    a = moss * vGrow * (1.0 - rim * (1.0 - fuzz) * 0.85) * 0.94;
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));

  #else
    if (vGrow < 0.5) discard;
    vec3 n = normalize(vNormal);
    if (!gl_FrontFacing) n = -n;
    float lam = clamp(dot(n, KEY), 0.0, 1.0);
    // Light through a thin leaf from behind.
    float trans = pow(clamp(dot(-v, KEY), 0.0, 1.0), 3.0) * 0.5;

    if (vKind < 1.5) {
      // ── Grass blade ─────────────────────────────────────────────────────
      // Only the very base is shaded: seen from above, a tuft shows its roots, and a
      // long dark gradient turned every grassy seam into a black line.
      vec3 root = vec3(0.03, 0.13, 0.03);
      vec3 mid = mix(vec3(0.08, 0.34, 0.07), vec3(0.14, 0.42, 0.05), vTone);
      vec3 tip = mix(vec3(0.42, 0.66, 0.12), vec3(0.62, 0.72, 0.2), vTone);
      col = mix(root, mid, smoothstep(0.0, 0.22, vShade));
      col = mix(col, tip, smoothstep(0.5, 1.0, vShade));
      // A pale midrib down the spine.
      float rib = (1.0 - smoothstep(0.0, 0.12, abs(vUv.x - 0.5))) * smoothstep(0.1, 0.5, vShade);
      col += vec3(0.05, 0.1, 0.02) * rib;
      col *= 0.45 + 0.7 * lam;
      col += tip * trans * vShade;
      // Wilting: straw at the tips first, then the whole blade.
      vec3 straw = mix(vec3(0.42, 0.32, 0.12), vec3(0.62, 0.5, 0.22), vShade);
      col = mix(col, straw * (0.5 + 0.6 * lam), clamp(vWilt * (0.6 + vShade), 0.0, 1.0));

    } else if (vKind < 2.5) {
      // ── Ivy leaf: a pointed heart with veins ──────────────────────────────
      vec2 p = vec2(vUv.x * 2.0 - 1.0, vUv.y);
      float width = sin(3.14159 * pow(p.y, 0.8)) * (0.95 - 0.3 * p.y) + 0.15 * smoothstep(0.35, 0.0, p.y);
      float inside = width - abs(p.x) * 1.05;
      if (inside < 0.0 || p.y > 0.98) discard;
      float vein = 1.0 - smoothstep(0.0, 0.05, abs(p.x));
      float side = 1.0 - smoothstep(0.0, 0.04, abs(fract(p.y * 4.0 - abs(p.x) * 2.0) - 0.5) - 0.44);
      vec3 leaf = mix(vec3(0.03, 0.2, 0.06), vec3(0.1, 0.38, 0.1), vTone);
      col = leaf * (0.45 + 0.75 * lam) + vec3(0.1, 0.18, 0.05) * max(vein, side * 0.5 * (1.0 - vein));
      // Waxy ivy sheen.
      col += vec3(0.5, 0.6, 0.45) * pow(max(dot(reflect(-KEY, n), v), 0.0), 18.0) * 0.35;
      col += leaf * trans;
      col = mix(col, vec3(0.4, 0.3, 0.12) * (0.5 + 0.5 * lam), vWilt * 0.8);
      a = smoothstep(0.0, 0.05, inside);

    } else {
      // ── Flower: five petals round a golden eye ─────────────────────────────
      vec2 p = vUv * 2.0 - 1.0;
      float r = length(p);
      float ang = atan(p.y, p.x) + vTone * 6.2831853;
      float petal = 0.62 + 0.38 * cos(ang * 5.0);
      if (r > petal * 0.95 || r > 0.98) discard;
      vec3 bloom = vTone < 0.3 ? vec3(0.98, 0.97, 0.92)
                 : vTone < 0.55 ? vec3(1.0, 0.55, 0.72)
                 : vTone < 0.8 ? vec3(1.0, 0.83, 0.2)
                 : vec3(0.78, 0.6, 1.0);
      col = bloom * (0.7 + 0.35 * smoothstep(0.2, 0.9, r / petal));
      // Petal creases and a darker throat.
      col *= 0.85 + 0.15 * cos(ang * 5.0);
      float eye = 1.0 - smoothstep(0.2, 0.28, r);
      col = mix(col, vec3(1.0, 0.72, 0.1), eye);
      col = mix(col, vec3(0.55, 0.3, 0.05), eye * smoothstep(0.1, 0.0, r) * 0.6);
      col *= 0.7 + 0.4 * lam;
      col = mix(col, vec3(0.45, 0.35, 0.2), vWilt * 0.7);
      a = smoothstep(0.0, 0.08, petal * 0.95 - r);
    }
    gl_FragColor = vec4(col, a);
  #endif

    #include <colorspace_fragment>
  }
`;

// Shared materials, one pair for the whole app. Module-scoped and never disposed by
// a mounting component — the geometry is per mount, these outlive it. Both layers
// share their uniform objects, so the skin's one write per frame reaches both.
let _materials = null;
export function getNatureMaterials() {
  if (_materials) return _materials;
  const shared = {
    uTime: sharedUniforms.time, // ticked by CubeAssembly every frame
    uEnv: { value: new THREE.Vector4(0, 0, 0, 1) },
    uWormHead,
    uWormBody
  };
  const make = (layer, extra) => {
    const m = new THREE.ShaderMaterial({
      defines: { NATURE_LAYER: layer, BLADE_ROWS },
      uniforms: shared,
      vertexShader,
      fragmentShader,
      toneMapped: false,
      ...extra
    });
    m.userData.elementalInstanced = true;
    return m;
  };
  _materials = [
    // Moss: alpha-blended over the tiles, depth-tested so the plants cover it.
    make(0, { transparent: true, depthWrite: false }),
    // Plants: opaque cut-outs, double-sided (a blade has two faces), writing depth
    // so tufts and leaves sort themselves. Alpha-to-coverage smooths the leaf and
    // petal outlines under MSAA.
    make(1, { side: THREE.DoubleSide, alphaToCoverage: true })
  ];
  return _materials;
}

/**
 * The terrarium skin for every cover cell at once.
 *
 * The caller owns the instance matrices and the shared uniforms: ElementalCubeSkin's
 * single frame loop writes each cell's live transform straight into
 * `instanceMatrix`, the same loop that drives every other element.
 */
export default function ElementalGrassSkin({ count, cellData, quality, meshRef }) {
  const budget = NATURE_BUDGET[quality?.tier] ?? NATURE_BUDGET.low;
  const geometry = useMemo(
    () => attachCellAttributes(buildNatureCellGeometry(budget.blades, budget.leaves, budget.flowers), cellData),
    [budget, cellData]
  );
  // The geometry is built per mount (its size depends on the quality tier), so it
  // is ours to dispose. The materials are shared and stay.
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <instancedMesh ref={meshRef} args={[geometry, getNatureMaterials(), count]} frustumCulled={false} raycast={() => null} />
  );
}
