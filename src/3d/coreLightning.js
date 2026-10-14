// The antipodal core's seams carry lightning instead of a black plastic frame.
//
// Every seam between the miniature's pieces is a charged groove that strikes:
// at any instant a few piece-lengths of seam flash as crisp, forked zigzag bolts
// a pixel or two wide (sized in screen space, so they stay wires however close
// the core swells to the lens), a runner of charge races along the lit ones, and
// sparks jump the junctions where four pieces meet. Between strikes the grooves
// hold a faint violet line. The more of the network is alive, the brighter it burns.
//
// It is a patch on the core's own lit materials (bodies and stickers), so it adds
// no draw and no geometry. Everything is computed in the shader from the piece's
// position in the core, in cubie units, so a seam's arc agrees on both sides of
// it. The clock is advanced by VoidCore only while the game runs and motion is
// allowed; with reduced motion the arcs hold still and never flicker.

import { Color, Vector2 } from 'three';

/** How far the plastic's surface sits from a cubie centre, in cubie units. */
const SHELL = 0.48;

export function makeCoreLightningUniforms() {
  return {
    uCoreBoltTime: { value: 0 },
    uCoreBoltGain: { value: 1 },
    // x: cubie units per core unit, y: the grid's centre index (size − 1) / 2.
    uCoreCell: { value: new Vector2(1, 0) },
    uCoreShell: { value: SHELL },
    uCoreBoltColor: { value: new Color(0.36, 0.42, 1.0) },
    uCoreBoltHot: { value: new Color(0.86, 0.93, 1.0) }
  };
}

/** Fit the uniforms to a board size; `cellScale` is tunnelCoreScale(size). */
export function setCoreLightningSize(uniforms, size, cellScale) {
  const k = (size - 1) / 2;
  uniforms.uCoreCell.value.set(1 / cellScale, k);
  uniforms.uCoreShell.value = k + SHELL;
}

const vertexInject = `
#ifdef USE_INSTANCING
  vCoreLocal = (instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vCoreLocal = transformed;
#endif`;

export const coreLightningGLSL = `
uniform float uCoreBoltTime, uCoreBoltGain, uCoreShell;
uniform vec2 uCoreCell;
uniform vec3 uCoreBoltColor, uCoreBoltHot;
varying vec3 vCoreLocal;

float cbHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cbJag(float x, float seed) {
  float i = floor(x);
  return mix(cbHash(vec2(i, seed)), cbHash(vec2(i + 1.0, seed)), fract(x)) * 2.0 - 1.0;
}

// One family of seams. 'across' crosses them (cubie centres on integers, seams
// half way between), 'along' runs with them, 'px' is how much of 'across' one
// screen pixel covers. Returns (bolt, glow, groove).
//
// The bolt is drawn a pixel or two wide at any distance (screen derivatives),
// so it stays a crisp wire whether the core is a speck across the cube or has
// swollen round the lens. Each piece-length of seam strikes on its own: most
// are dark at any instant, a few flash, and a runner of charge races along
// those that are lit. The groove itself keeps a faint charged line.
vec3 coreSeam(float across, float along, float face, float px, float T) {
  float seam = floor(across) + 0.5;
  float off = across - seam;
  float piece = floor(along);
  float beat = floor(T * 7.0 + cbHash(vec2(seam, piece + face)) * 7.0);
  float strike = step(0.66, cbHash(vec2(seam * 3.7 + piece * 1.3 + face, beat)));
  float seed = seam * 7.31 + face * 13.7 + beat * 1.93;
  // A real zigzag: big kinks every fifth of a piece, fine crackle on top.
  float jit = cbJag(along * 5.0, seed) * 0.05 + cbJag(along * 23.0, seed + 4.1) * 0.012;
  float d = abs(off - jit) / max(px, 1e-5);
  // Fork: a short branch peels off the bolt and dies away from it.
  float fork = cbJag(along * 9.0, seed + 9.7) * 0.11 * fract(along * 2.5 + cbHash(vec2(seed, 2.0)));
  float df = abs(off - jit - fork) / max(px, 1e-5);
  float runner = pow(0.5 + 0.5 * sin(along * 3.1 - T * 14.0 + cbHash(vec2(seam, face)) * 6.2832), 10.0);
  float flicker = 0.75 + 0.25 * cbHash(vec2(seed, floor(T * 30.0)));
  float bolt = strike * flicker * (exp(-d * d * 0.7) + 0.55 * exp(-df * df * 1.4) * step(0.55, cbHash(vec2(seed, 5.0))));
  float glow = strike * flicker * exp(-d * d / 30.0) * 0.35 + runner * strike * exp(-d * d / 12.0) * 0.6;
  float groove = exp(-off * off / (px * px * 2.5 + 0.00002)) * 0.25;
  return vec3(bolt, glow, groove);
}

// haloOnly: a tile's surface takes only the light the arcs throw onto it.
vec3 coreLightning(float haloOnly) {
  vec3 q = vCoreLocal * uCoreCell.x + uCoreCell.y;
  vec3 c = abs(q - uCoreCell.y);
  // The cube face a point belongs to is the axis it lies furthest out along, so
  // the walls down inside a groove take the arc of the seam above them.
  float depth, face;
  vec2 p;
  if (c.x >= c.y && c.x >= c.z) { depth = uCoreShell - c.x; p = q.yz; face = q.x > uCoreCell.y ? 1.0 : 2.0; }
  else if (c.y >= c.z) { depth = uCoreShell - c.y; p = q.xz; face = q.y > uCoreCell.y ? 3.0 : 4.0; }
  else { depth = uCoreShell - c.z; p = q.xy; face = q.z > uCoreCell.y ? 5.0 : 6.0; }
  float T = uCoreBoltTime;
  vec2 px = max(fwidth(p), vec2(1e-5));
  vec3 a = coreSeam(p.x, p.y, face, px.x, T);
  vec3 b = coreSeam(p.y, p.x, face + 0.5, px.y, T);
  // Where four pieces meet a strike can jump the junction as a small spark.
  vec2 nd = (p - (floor(p) + 0.5)) / px;
  float nodeSeed = cbHash(floor(p) + face * 17.0);
  float spark = step(0.8, cbHash(floor(p) * 1.3 + face + floor(T * 5.0 + nodeSeed * 5.0)));
  float node = spark * exp(-dot(nd, nd) * 0.08);
  float sink = exp(-max(depth, 0.0) * 18.0);
  // On the tiles: only a thin rim of the strike's light along their edges.
  if (haloOnly > 0.5) {
    float rim = max(a.y, b.y) * 0.35 + node * 0.2;
    return uCoreBoltColor * rim * uCoreBoltGain;
  }
  float bolt = max(a.x, b.x) + node;
  vec3 light = uCoreBoltHot * bolt * 2.4 + uCoreBoltColor * ((a.y + b.y) * 1.6 + (a.z + b.z) * 0.5);
  return light * sink * uCoreBoltGain;
}
`;

/**
 * Patch a core material (lit, instanced) to carry the arcs as emitted light.
 * Chains any onBeforeCompile already on it; call before withPortalCutout, which
 * reads the program cache key this sets.
 */
export function withCoreLightning(material, uniforms, { haloOnly = false } = {}) {
  const original = material.onBeforeCompile;
  const baseKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    original?.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCoreLocal;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>${vertexInject}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${coreLightningGLSL}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += coreLightning(${haloOnly ? '1.0' : '0.0'});`);
  };
  material.customProgramCacheKey = () => `${baseKey}-core-lightning${haloOnly ? '-halo' : ''}`;
  material.userData.coreLightning = uniforms;
  return material;
}
