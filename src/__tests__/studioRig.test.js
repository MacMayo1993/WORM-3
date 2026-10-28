import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import { aimStudioRig, setStudioRigLights, releaseStudioRig } from '../3d/studioRig.js';
import { CUBE_LIGHT_RIG } from '../3d/cubeLighting.js';
import { sharedUniforms, getTileStyleMaterial } from '../3d/styles/TileStyleMaterials.jsx';

const rig = () => [new THREE.DirectionalLight(), new THREE.DirectionalLight(), new THREE.DirectionalLight()];
const unit = p => new THREE.Vector3(...p).normalize();

describe('studio rig', () => {
  afterEach(() => releaseStudioRig());

  it('keeps the authored rig at the default pose and turns it with the camera', () => {
    const lights = rig();
    setStudioRigLights(...lights);
    aimStudioRig(new THREE.Quaternion());
    expect(lights[0].position.toArray()).toEqual(CUBE_LIGHT_RIG.key.position);
    expect(sharedUniforms.rigKey.value.distanceTo(unit(CUBE_LIGHT_RIG.key.position))).toBeLessThan(1e-9);
    // A camera under the cube looking up at its bottom face lights that face as
    // the default pose lights the front.
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, -10, 0); camera.up.set(0, 0, 1); camera.lookAt(0, 0, 0);
    aimStudioRig(camera.quaternion);
    const bottom = new THREE.Vector3(0, -1, 0), front = new THREE.Vector3(0, 0, 1);
    const authored = unit(CUBE_LIGHT_RIG.key.position);
    expect(sharedUniforms.rigKey.value.dot(bottom)).toBeCloseTo(authored.dot(front), 9);
    expect(lights[1].position.length()).toBeCloseTo(new THREE.Vector3(...CUBE_LIGHT_RIG.fill.position).length(), 9);
  });

  it('feeds styled tiles the same directions, and hands back the authored rig when released', () => {
    expect(getTileStyleMaterial('marble', '#ff0000').uniforms.rigKey).toBe(sharedUniforms.rigKey);
    setStudioRigLights(...rig());
    aimStudioRig(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
    expect(sharedUniforms.rigKey.value.lengthSq()).toBeCloseTo(1, 9);
    releaseStudioRig();
    expect(sharedUniforms.rigKey.value.lengthSq()).toBe(0);
    // With no rig registered (wireframe, glass), aiming leaves everything alone.
    aimStudioRig(new THREE.Quaternion());
    expect(sharedUniforms.rigKey.value.lengthSq()).toBe(0);
  });
});
