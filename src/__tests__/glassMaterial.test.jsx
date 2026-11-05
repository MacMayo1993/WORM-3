import { expect, it } from 'vitest';
import * as THREE from 'three';
import { createGlassMaterial, getGlassMaterial, sharedUniforms } from '../3d/styles/TileStyleMaterials.jsx';
import { bindTileStyleIdentity } from '../3d/tileStyleIdentity.js';
import { createExteriorPortals } from '../3d/exteriorPortals.js';

it('keeps glass colors privately mutable without cloning procedural textures or uploading unused identities', () => {
  const a = createGlassMaterial('#ff0000'), b = createGlassMaterial('#0000ff');
  expect(Object.keys(a.uniforms).sort()).toEqual(['baseColor', 'rigFill', 'rigKey', 'rigRim']);
  expect(a.uniforms.baseColor).not.toBe(getGlassMaterial('#ff0000').uniforms.baseColor);
  a.uniforms.baseColor.value.set('#00ff00');
  expect(b.uniforms.baseColor.value.getHexString()).toBe('0000ff');
  for (const key of ['rigKey', 'rigFill', 'rigRim']) expect(a.uniforms[key]).toBe(sharedUniforms[key]);
  expect(a.side).toBe(THREE.DoubleSide);
  expect(a.forceSinglePass).toBe(true);
  expect(a.transparent).toBe(true);
  expect(a.depthWrite).toBe(false);
  bindTileStyleIdentity({ x: 1, y: 2, z: 3 }, 1)(null, null, null, null, a);
  expect(a.uniformsNeedUpdate).toBe(false);
  const portals = createExteriorPortals(), patched = portals.materialFor(a);
  expect(patched.forceSinglePass).toBe(true);
  expect(patched.uniforms.baseColor).toBe(a.uniforms.baseColor);
  expect(patched.fragmentShader).toContain('exteriorPlaneDistance');
  a.dispose(); b.dispose(); portals.dispose();
});
