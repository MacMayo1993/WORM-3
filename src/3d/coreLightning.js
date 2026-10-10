// The antipodal core's seams carry lightning instead of a black plastic frame.
//
// Every seam between the miniature's pieces is a live arc: a white-hot core that
// re-jitters several times a second, a violet glow round it, pulses racing along
// it, and star flares where four pieces meet. The current sinks down into the
// grooves and bleeds a soft halo onto the edges of the tiles, so the core reads as
// a charged cage. The more of the network is alive, the brighter it burns.
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
// half way between), 'along' runs with them. Returns (core, glow, halo).
vec3 coreSeam(float across, float along, float face, float T) {
  float seam = floor(across) + 0.5;
  float off = across - seam;
  float seed = seam * 7.31 + face * 13.7 + floor(T * 9.0) * 1.93;
  float jit = cbJag(along * 6.0, seed) * 0.035 + cbJag(along * 17.0, seed + 4.1) * 0.012;
  float d = off - jit;
  // Each piece-length of seam surges on its own beat; none ever goes fully dark.
  float surge = 0.55 + 0.45 * cbHash(vec2(seam * 3.7 + floor(along) * 1.3 + face, floor(T * 6.0)));
  float runner = pow(0.5 + 0.5 * sin(along * 3.1 - T * 11.0 + cbHash(vec2(seam, face)) * 6.2832), 8.0);
  return vec3(exp(-d * d / 0.00007) * surge * (0.7 + 0.9 * runner),
              exp(-d * d / 0.0012) * surge * (0.6 + 0.6 * runner),
              exp(-off * off / 0.007) * (0.5 + 0.5 * surge));
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
  vec3 a = coreSeam(p.x, p.y, face, T);
  vec3 b = coreSeam(p.y, p.x, face + 0.5, T);
  // Junctions where four pieces meet hold the charge, flaring as small stars.
  vec2 nd = p - (floor(p) + 0.5);
  // A few junctions at a time burst into a bigger star, like the arcs in the storm.
  float nodeSeed = cbHash(floor(p) + face * 17.0);
  float twinkle = 0.6 + 0.4 * sin(T * 7.0 + nodeSeed * 6.2832);
  float burst = step(0.82, cbHash(floor(p) * 1.3 + face + floor(T * 2.0 + nodeSeed)));
  float reach = mix(1.0, 0.45, burst);
  float star = (exp(-abs(nd.x) * 70.0 - abs(nd.y) * 6.0 * reach) + exp(-abs(nd.y) * 70.0 - abs(nd.x) * 6.0 * reach))
             * twinkle * (1.0 + burst * 1.5);
  float node = exp(-dot(nd, nd) * 300.0);
  float sink = exp(-max(depth, 0.0) * 18.0);
  float halo = max(a.z, b.z);
  vec3 light = haloOnly > 0.5
    ? uCoreBoltColor * halo * 0.25 + uCoreBoltHot * star * 0.35
    : uCoreBoltHot * (max(a.x, b.x) + node * (1.2 + burst) + star * 0.35) * 3.0 + uCoreBoltColor * ((a.y + b.y + star * 0.8) * 1.5 + halo * 0.35);
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
