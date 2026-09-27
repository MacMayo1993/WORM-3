// Cut the material itself, including the plastic behind a sticker. No render
// targets, stencil passes, or opaque discs covering the opening.
const MAIN = /void\s+main\s*\(\s*(?:void)?\s*\)/;
const vertex = source => `varying vec3 vPortalPosition;
${source.replace(MAIN, 'void portalVertexMain()')}
void main() {
  portalVertexMain();
  vec4 portalPosition = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    portalPosition = instanceMatrix * portalPosition;
  #endif
  vPortalPosition = (modelMatrix * portalPosition).xyz;
}`;

export function withPortalCutout(material, uniforms, distanceGLSL, key, rim = false) {
  if (material.userData.portalCutout === uniforms) return material;
  const patch = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = vertex(shader.vertexShader);
    shader.fragmentShader = `varying vec3 vPortalPosition;
${distanceGLSL}
${shader.fragmentShader.replace(MAIN, 'void portalSurfaceMain()')}
void main() {
  float portalGap = portalDistance(vPortalPosition);
  if (portalGap < 0.0) discard;
  portalSurfaceMain();
  ${rim ? 'gl_FragColor.rgb += vec3(0.28, 0.55, 0.65) * (1.0 - smoothstep(0.0, 0.012, portalGap));' : ''}
}`;
  };
  if (material.isShaderMaterial) patch(material);
  else {
    const original = material.onBeforeCompile, cacheKey = material.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => { original.call(material, shader, renderer); patch(shader); };
    material.customProgramCacheKey = () => `${cacheKey}-portal-${key}`;
  }
  material.userData.portalCutout = uniforms;
  return material;
}
