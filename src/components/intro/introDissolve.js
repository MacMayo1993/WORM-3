// A noise dissolve for the opening's cube: it crumbles away like sand behind a
// thin glowing edge, top first, as if evaporating off the paper. The plastic
// and the stickers share one uniform, so the whole puzzle goes as one object.
//
// The same crumble is reused for defeated WORM enemies (combat/enemyDissolve.js),
// so the field, grain and edge live here once. What differs is only the frame the
// field is sampled in:
//   • the intro's instanced cube samples instanceMatrix · position, so the field
//     turns with the cube instead of swimming;
//   • an enemy's many small meshes sample one shared frame matrix (uDissolveFrame ·
//     modelMatrix · position), mapped onto this same cube-sized field, so the whole
//     creature crumbles as one object at the same grain.

const FIELD = /* glsl */ `
uniform float uDissolve;
varying vec3 vDissolvePos;
float dissolveHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float dissolveNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(dissolveHash(i), dissolveHash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(dissolveHash(i + vec3(0.0, 1.0, 0.0)), dissolveHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(dissolveHash(i + vec3(0.0, 0.0, 1.0)), dissolveHash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(dissolveHash(i + vec3(0.0, 1.0, 1.0)), dissolveHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
// 0 at the top of the cube, 1 at its base, broken up by a fine two-octave grain.
float dissolveField(vec3 p) {
  float grain = 0.6 * dissolveNoise(p * 9.0) + 0.4 * dissolveNoise(p * 23.0 + 5.3);
  return mix(grain, clamp((1.7 - p.y) / 3.4, 0.0, 1.0), 0.55);
}
`;

const DISCARD = `#include <clipping_planes_fragment>
  float dissolveEdge = 0.0;
  if (uDissolve > 0.0) {
    float dissolveGap = dissolveField(vDissolvePos) - (uDissolve * 1.04 - 0.02);
    if (dissolveGap < 0.0) discard;
    dissolveEdge = 1.0 - smoothstep(0.0, 0.035, dissolveGap);
  }`;

const EDGE = 'vec3(1.0, 0.5, 0.1) * 1.4 * dissolveEdge';

function patch(material, uniforms, positionExpression, cacheKey) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    const frame = uniforms.uDissolveFrame ? 'uniform mat4 uDissolveFrame;\n' : '';
    shader.vertexShader = frame + 'varying vec3 vDissolvePos;\n' + shader.vertexShader.replace('#include <project_vertex>',
      `#include <project_vertex>\n  vDissolvePos = ${positionExpression};`);
    let fragment = FIELD + shader.fragmentShader.replace('#include <clipping_planes_fragment>', DISCARD);
    // Lit materials glow through their emissive term, exactly as the intro does.
    // Unlit ones (outlines, accents) have no emissive stage, so the same edge is
    // added to the final colour instead.
    fragment = fragment.includes('#include <emissivemap_fragment>')
      ? fragment.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n  totalEmissiveRadiance += ${EDGE};`)
      : fragment.replace('#include <dithering_fragment>', `gl_FragColor.rgb += ${EDGE};\n  #include <dithering_fragment>`);
    shader.fragmentShader = fragment;
  };
  material.customProgramCacheKey = () => cacheKey;
  material.needsUpdate = true;
  return material;
}

/**
 * Patch a MeshStandardMaterial / MeshPhysicalMaterial to dissolve with
 * `uniform.value` (0 = whole, 1 = gone). Every patched material shares one
 * program, so the patch costs nothing while the cube is whole.
 */
export function addIntroDissolve(material, uniform) {
  return patch(material, { uDissolve: uniform }, '(instanceMatrix * vec4(transformed, 1.0)).xyz', 'intro-dissolve');
}

/**
 * The same dissolve for plain (non-instanced) meshes that should go as one
 * object: `uniforms.uDissolve` is the 0→1 front and `uniforms.uDissolveFrame`
 * maps world space onto the intro's cube-sized field. Works on lit and unlit
 * built-in materials. All patched materials share one program per material type.
 */
export function addFrameDissolve(material, uniforms) {
  return patch(material, uniforms, '(uDissolveFrame * modelMatrix * vec4(transformed, 1.0)).xyz', 'frame-dissolve');
}
