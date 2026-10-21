// Tile-style shaders read a sticker's physical identity (tileHome, tileFace) from
// uniforms bound per draw (tileStyleIdentity.js), which costs one draw per tile.
// An instanced draw carries the identity per instance instead: these rewrite a
// copy of a style so its vertex stage applies instanceMatrix and passes a vec4
// identity attribute (home xyz, face) through to the fragment stage, which reads
// it in place of the two uniforms. The pattern drawn is the same either way.

const HOME_UNIFORM = /uniform\s+vec3\s+tileHome\s*;/g;
const FACE_UNIFORM = /uniform\s+float\s+tileFace\s*;/g;

/** Rewrite `material`'s shaders in place to read identity from `attribute` through `varying`. */
export function instanceTileStyleShaders(material, attribute, varying) {
  material.vertexShader = `attribute vec4 ${attribute};
    varying vec4 ${varying};\n${material.vertexShader
    .replace(/\bmodelViewMatrix\b/g, 'tileModelView')
    .replace(/\bmodelMatrix\b/g, 'tileModel')
    .replace(/\bnormalMatrix\b/g, 'tileNormal')
    .replace('void main() {', `void main() {
      mat4 tileModel = modelMatrix * instanceMatrix;
      mat4 tileModelView = viewMatrix * tileModel;
      mat3 tileNormal = normalMatrix * mat3(instanceMatrix);
      ${varying} = ${attribute};`)}`;
  material.fragmentShader = `varying vec4 ${varying};\n${material.fragmentShader
    .replace(HOME_UNIFORM, '')
    .replace(FACE_UNIFORM, '')
    .replace(/\btileHome\b/g, `${varying}.xyz`)
    .replace(/\btileFace\b/g, `${varying}.w`)}`;
  return material;
}

// One instanced copy per shared style material, released with it (the style cache
// disposes a source when it evicts it).
const instanced = new WeakMap();

/**
 * The instanced twin of a shared style material from getTileStyleMaterial, for the
 * tile-surface batches: identity arrives as `aInstanceData` (TileSurfaceInstance's
 * `data`), so every tile of one style and colour is a single draw. The twin shares
 * the source's uniform objects (colours, time, spin, gaze), so it animates with it.
 */
export function instancedTileStyleMaterial(source) {
  let material = instanced.get(source);
  if (material) return material;
  material = source.clone();
  const { tileHome: _home, tileFace: _face, ...uniforms } = source.uniforms;
  material.uniforms = uniforms;
  material.userData.styleFragmentShader = source.userData.styleFragmentShader;
  instanceTileStyleShaders(material, 'aInstanceData', 'vTileIdentity');
  instanced.set(source, material);
  const release = () => {
    source.removeEventListener('dispose', release);
    instanced.delete(source);
    material.dispose();
  };
  source.addEventListener('dispose', release);
  return material;
}
