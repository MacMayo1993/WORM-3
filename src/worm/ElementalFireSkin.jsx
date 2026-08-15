// src/worm/ElementalFireSkin.jsx
//
// The FIRE element's cube skin: the cube is actually on fire, using the exact
// flame the bombs use.
//
// It replaces a shader "lava" surface that drew molten runoff across each sticker.
// On a flat, brightly-patterned tile that read as orange squiggles — you could not
// tell it was meant to be lava at all. Fire is legible for the same reason the
// bomb detonations are: teardrop flame sprites, white-hot at the base, flickering
// and licking upward off the surface.
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
// ember bed (so a whole cell is 24 vertices), the instance matrix carries the cell's
// live transform, and a per-instance seed drives the same jitter the CPU used to
// compute. Billboarding, flicker, sway and lift all happen in the vertex shader, so
// the burning cube costs ONE draw call and zero per-frame CPU work beyond the
// transform loop the skin already runs for every element.
//
// The jitter hash is reproduced from elementalSeeds.hashSeed verbatim, so a given
// cell burns the same way it did when the numbers were computed in JS.

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { FLAME_TEX } from './healerWorm/HealerBombs.jsx';
import { getSoftGlowTexture } from './healerWorm/elementalBadge.jsx';
import { sharedUniforms } from '../3d/styles/TileStyleMaterials.jsx';

// Flame footprint inside a 1×1 cell. Several small tongues per cell read as a
// burning surface; two big ones read as a candle sitting on the sticker.
const FLAME_W = 0.39;
const FLAME_H = 0.675;
// The quad grows UP from its anchor rather than being centred on it, and the
// anchors sit along the low edge of the cell, so the fire licks up off the tile
// instead of floating over the middle of it. (Matches the old sprite `center`.)
const FLAME_CENTER_Y = 0.06;

// Per-vertex corner offsets for one quad, and the two triangles over them.
const QUAD_CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]];
const QUAD_INDICES = [0, 1, 2, 0, 2, 3];

/**
 * Geometry for ONE cell: `flamesPerCell` tongue quads plus a wide ember bed.
 *
 * `position` carries the corner in local cell space purely so the bounding box is
 * sane; the shader rebuilds every vertex from `uv` and `aFlame` anyway. `aFlame` is
 * the tongue index, or -1 for the ember bed.
 */
function buildFlameCellGeometry(flamesPerCell) {
  const quads = flamesPerCell + 1; // + the ember bed
  const verts = quads * 4;
  const position = new Float32Array(verts * 3);
  const uv = new Float32Array(verts * 2);
  const aFlame = new Float32Array(verts);
  const index = new Uint16Array(quads * 6);

  for (let q = 0; q < quads; q++) {
    // Quad 0 is the ember bed, the rest are numbered tongues.
    const flameIndex = q === 0 ? -1 : q - 1;
    for (let c = 0; c < 4; c++) {
      const v = q * 4 + c;
      const [cx, cy] = QUAD_CORNERS[c];
      position[v * 3] = cx - 0.5;
      position[v * 3 + 1] = cy - 0.5;
      position[v * 3 + 2] = 0.12;
      uv[v * 2] = cx;
      uv[v * 2 + 1] = cy;
      aFlame[v] = flameIndex;
    }
    for (let t = 0; t < 6; t++) index[q * 6 + t] = q * 4 + QUAD_INDICES[t];
  }

  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('aFlame', new THREE.BufferAttribute(aFlame, 1));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  return geo;
}

const vertexShader = /* glsl */`
  uniform float uTime;
  attribute float aFlame;   // per-vertex: tongue index, or -1 for the ember bed
  attribute float aSeed;    // per-instance: the cover cell's stable identity
  varying vec2 vUv;
  varying float vKind;      // 1 = flame tongue, 0 = ember bed

  // elementalSeeds.hashSeed / hashSeed2, verbatim.
  float h1(float s, float i) { return fract(sin((s + 1.0) * 12.9898 + i * 78.233) * 43758.5453); }
  float h2(float s, float i) { return fract(sin((s + 1.0) * 39.3468 + i * 11.135) * 24634.6345); }

  void main() {
    vUv = uv;
    vKind = aFlame < 0.0 ? 0.0 : 1.0;

    #ifdef USE_INSTANCING
      mat4 cellMatrix = modelMatrix * instanceMatrix;
    #else
      mat4 cellMatrix = modelMatrix;
    #endif

    vec2 size;
    vec2 center;
    vec3 local;

    if (aFlame < 0.0) {
      // The hot bed under the tongues. Without it each cell reads as a few discrete
      // flames sitting ON a tile; with it the tile itself looks like it is burning.
      float pulse = 0.85 + 0.15 * sin(uTime * 3.1 + aSeed);
      size = vec2(0.95 * pulse, 0.62 * pulse);
      center = vec2(0.5, 0.5);
      local = vec3(0.0, -0.12, 0.06);
    } else {
      float r1 = h1(aSeed, aFlame);
      float r2 = h2(aSeed, aFlame);
      float phase = (r1 + r2) * 6.2831853;
      float rate = 7.5 + r2 * 6.5;
      float scl = 0.55 + r2 * 0.75;
      float sway = 0.04 + r2 * 0.05;
      float flick = 0.72 + 0.5 * sin(uTime * rate + phase);

      size = vec2(${FLAME_W} * scl * (0.85 + 0.25 * flick), ${FLAME_H} * scl * (0.8 + 0.45 * flick));
      center = vec2(0.5, ${FLAME_CENTER_Y});
      local = vec3(
        (r1 - 0.5) * 0.78 + sin(uTime * rate * 0.32 + phase) * sway,
        -0.42 + r2 * 0.3,
        // Lift off the surface with the flicker so the tongues look like they are
        // licking up rather than pinned flat to the sticker.
        0.12 + 0.07 * flick
      );
    }

    // Anchor in world space, then step out along the camera's own axes: a sprite
    // takes its on-screen size from world scale, so the cell's uniform scale (which
    // carries the claim/expiry ramp) has to multiply the offset, not the anchor.
    vec4 anchor = cellMatrix * vec4(local, 1.0);
    float cellScale = length(cellMatrix[0].xyz);
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec2 off = (uv - center) * size * cellScale;

    vec3 world = anchor.xyz + right * off.x + up * off.y;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  precision mediump float;
  uniform sampler2D uFlameTex;
  uniform sampler2D uGlowTex;
  uniform vec3 uFlameColor;
  uniform vec3 uEmberColor;
  varying vec2 vUv;
  varying float vKind;

  void main() {
    // Both are sampled unconditionally: a texture fetch inside divergent flow has
    // undefined derivatives, and mixing two cheap fetches is safer than branching.
    vec4 flame = texture2D(uFlameTex, vUv);
    vec4 ember = texture2D(uGlowTex, vUv);
    vec4 tex = mix(ember, flame, vKind);
    // The old sprite materials' colour tint and opacity, per kind. The flame texture
    // is white-hot at its base — sized for a bomb against a dark scene — so additive
    // over a bright sticker it is tinted warm and kept well under full opacity.
    vec3 tint = mix(uEmberColor, uFlameColor, vKind);
    float op = mix(0.34, 0.55, vKind);
    gl_FragColor = vec4(tex.rgb * tint, tex.a * op);
  }
`;

// One shared material for every flame on every cube. Module-scoped and never
// disposed by a mounting component — the transient geometry is per-mount, but this
// outlives it, exactly like the surface elements' cached material.
let _fireMat = null;
function getFlameMaterial() {
  if (!_fireMat) {
    _fireMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: sharedUniforms.time, // ticked by CubeAssembly every frame
        uFlameTex: { value: FLAME_TEX },
        uGlowTex: { value: getSoftGlowTexture() },
        uFlameColor: { value: new THREE.Color('#ff5a12') },
        uEmberColor: { value: new THREE.Color('#ff4a08') }
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
  }
  return _fireMat;
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
 * @param {object}  meshRef        ref the skin writes instance matrices through
 */
export default function ElementalFireSkin({ count, flamesPerCell = 5, meshRef }) {
  const geometry = useMemo(() => buildFlameCellGeometry(flamesPerCell), [flamesPerCell]);
  const material = getFlameMaterial();
  const seedRef = useRef(null);

  // Per-instance seed: the cover cell's index, matching the seed the per-cell
  // component was handed before. Rebuilt only when the cell count changes.
  useEffect(() => {
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) seeds[i] = i;
    const attr = new THREE.InstancedBufferAttribute(seeds, 1);
    geometry.setAttribute('aSeed', attr);
    seedRef.current = attr;
  }, [geometry, count]);

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
