// A noise dissolve for the opening's cube: it crumbles away like sand behind a
// thin glowing edge, top first, as if evaporating off the paper. The plastic
// and the stickers share one uniform, so the whole puzzle goes as one object.
// Only for instanced meshes: the field is sampled in the cube's own frame
// (instanceMatrix · position), so it turns with the cube instead of swimming.

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

/**
 * Patch a MeshStandardMaterial / MeshPhysicalMaterial to dissolve with
 * `uniform.value` (0 = whole, 1 = gone). Every patched material shares one
 * program, so the patch costs nothing while the cube is whole.
 */
export function addIntroDissolve(material, uniform) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uDissolve = uniform;
    shader.vertexShader = 'varying vec3 vDissolvePos;\n' + shader.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\n  vDissolvePos = (instanceMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = FIELD + shader.fragmentShader
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  float dissolveEdge = 0.0;
  if (uDissolve > 0.0) {
    float dissolveGap = dissolveField(vDissolvePos) - (uDissolve * 1.04 - 0.02);
    if (dissolveGap < 0.0) discard;
    dissolveEdge = 1.0 - smoothstep(0.0, 0.035, dissolveGap);
  }`)
      .replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vec3(1.0, 0.5, 0.1) * 1.4 * dissolveEdge;');
  };
  material.customProgramCacheKey = () => 'intro-dissolve';
  return material;
}
