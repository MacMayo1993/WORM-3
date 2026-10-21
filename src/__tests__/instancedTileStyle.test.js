import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getTileStyleMaterial, ANTIPODAL_STYLES, sharedUniforms } from '../3d/styles/TileStyleMaterials.jsx';
import { instancedTileStyleMaterial, instanceTileStyleShaders } from '../3d/styles/instancedTileStyle.js';
import { ALL_TILE_STYLE_KEYS } from '../utils/tileStyleCatalog.js';

// Every style's identity must come from the instance in a batched draw: a
// leftover tileHome/tileFace would read an unbound uniform (zero), so every tile
// of a batch would share one seed and a slab style would show one tile per face.
describe('instanced tile styles', () => {
  it('reads every style identity from the instance and places it with instanceMatrix', () => {
    for (const style of ALL_TILE_STYLE_KEYS) {
      const source = getTileStyleMaterial(style, '#3973e8', false, null, ANTIPODAL_STYLES.has(style) ? '#38c875' : null);
      const material = instancedTileStyleMaterial(source);
      expect(material, style).not.toBe(source);
      expect(material.fragmentShader, style).not.toMatch(/\btileHome\b|\btileFace\b/);
      expect(material.fragmentShader, style).toContain('varying vec4 vTileIdentity;');
      expect(material.vertexShader, style).toContain('attribute vec4 aInstanceData;');
      expect(material.vertexShader, style).toContain('mat4 tileModel = modelMatrix * instanceMatrix;');
      // Placement and the finish's world-space varyings all go through the instance.
      expect(material.vertexShader, style).not.toMatch(/\bmodelViewMatrix\s*\*/);
      expect(material.uniforms.tileHome, style).toBeUndefined();
      expect(material.side, style).toBe(source.side);
      expect(material.extensions.derivatives, style).toBe(true);
    }
  });

  it('shares the source uniforms, so a twin animates and recolours with it', () => {
    const source = getTileStyleMaterial('eyeball', '#ff8800');
    const material = instancedTileStyleMaterial(source);
    expect(instancedTileStyleMaterial(source)).toBe(material);
    expect(material.uniforms.time).toBe(sharedUniforms.time);
    expect(material.uniforms.baseColor).toBe(source.uniforms.baseColor);
    expect(material.userData.styleFragmentShader).toBe(source.userData.styleFragmentShader);
    // Pickups and previews bind a default identity per draw; a batch must not.
    expect(material.onBeforeRender).toBe(THREE.Material.prototype.onBeforeRender);
  });

  it('releases the twin with its source', () => {
    const source = getTileStyleMaterial('marble', '#123456').clone();
    source.uniforms = { ...source.uniforms };
    const material = instancedTileStyleMaterial(source);
    let disposed = false;
    material.addEventListener('dispose', () => { disposed = true; });
    source.dispose();
    expect(disposed).toBe(true);
    expect(instancedTileStyleMaterial(source)).not.toBe(material);
  });

  it('tolerates spacing in the identity uniform declarations', () => {
    const material = new THREE.ShaderMaterial({
      vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform  vec3 tileHome ;\nuniform float   tileFace;\nvoid main() { gl_FragColor = vec4(tileHome, tileFace); }'
    });
    instanceTileStyleShaders(material, 'aId', 'vId');
    expect(material.fragmentShader).not.toMatch(/uniform|tileHome|tileFace/);
    expect(material.fragmentShader).toContain('gl_FragColor = vec4(vId.xyz, vId.w);');
    expect(material.vertexShader).toContain('projectionMatrix * tileModelView * vec4(position, 1.0)');
  });
});
