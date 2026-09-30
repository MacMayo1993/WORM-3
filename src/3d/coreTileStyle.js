// Reuse the outer cube's actual tile shaders, batched by partner appearance.
// Core-owned materials keep the tile cache untouched and share its animation clock.
import * as THREE from 'three';
import { getTileStyleMaterial } from './styles/TileStyleMaterials.jsx';

export function createCoreTileStyle(style, color, antipodalColor, scale) {
  const source = getTileStyleMaterial(style, color, false, null, antipodalColor);
  const vertex = source.vertexShader
    .replace(/\bmodelViewMatrix\b/g, 'coreModelView')
    .replace(/\bmodelMatrix\b/g, 'coreModel')
    .replace(/\bnormalMatrix\b/g, 'coreNormal')
    .replace('void main() {', `void main() {
      mat4 coreModel = modelMatrix * instanceMatrix;
      mat4 coreModelView = viewMatrix * coreModel;
      mat3 coreNormal = normalMatrix * mat3(instanceMatrix);
      vCoreColor = instanceColor;
      vCoreIdentity = aTileIdentity;`)
    // Reactive tile styles read the outer tile's grid position, not the tiny
    // core coordinates (otherwise every tile looks like the middle slice).
    .replace('vTileCenter = coreModel[3].xyz;', 'vTileCenter = instanceMatrix[3].xyz / uCoreScale;');
  const fragment = source.fragmentShader
    .replace(/\bbaseColor\b/g, 'vCoreColor')
    .replace('uniform vec3 vCoreColor;', 'varying vec3 vCoreColor;')
    .replace(/uniform vec3 tileHome;/g, '')
    .replace(/uniform float tileFace;/g, '')
    .replace(/\btileHome\b/g, 'vCoreIdentity.xyz')
    .replace(/\btileFace\b/g, 'vCoreIdentity.w');
  const material = new THREE.ShaderMaterial({
    name: `antipodal-core-${style}`,
    uniforms: { ...source.uniforms, tileHome: { value: new THREE.Vector3() }, tileFace: { value: 0 }, uCoreScale: { value: scale } },
    vertexShader: `attribute vec4 aTileIdentity; varying vec4 vCoreIdentity; varying vec3 vCoreColor; uniform float uCoreScale;\n${vertex}`,
    fragmentShader: `varying vec4 vCoreIdentity;\n${fragment}`,
    side: source.side, transparent: source.transparent, depthWrite: source.depthWrite,
    extensions: { ...source.extensions }
  });
  return material;
}
