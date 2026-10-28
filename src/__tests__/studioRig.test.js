import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import { aimStudioRig, setStudioRigLights, releaseStudioRig, createStudioRigPass } from '../3d/studioRig.js';
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

// The far-side window's pass (createStudioRigPass) on a renderer that treats
// shadows as three r159 does: the lit pass samples the map the light holds when
// the render starts, shadows are drawn only when autoUpdate or needsUpdate is set
// (and the request is cleared), and the shadow matrix is read when drawing.
describe('the far-side pass shadows', () => {
  const MAIN = new THREE.Quaternion();
  const FAR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  const matrixFor = quaternion => {
    const light = new THREE.DirectionalLight();
    light.position.set(...CUBE_LIGHT_RIG.key.position).applyQuaternion(quaternion);
    light.updateMatrixWorld(); light.target.updateMatrixWorld();
    light.shadow.updateMatrices(light);
    return light.shadow.matrix.clone();
  };
  const near = (a, b) => a.elements.every((v, i) => Math.abs(v - b.elements[i]) < 1e-9);
  const setup = () => {
    const lights = rig();
    lights[0].castShadow = true;
    setStudioRigLights(...lights);
    const renderer = { shadowMap: { autoUpdate: false, needsUpdate: false } };
    const draw = () => {
      const key = lights[0], shadow = key.shadow, sampled = shadow.map;
      if (renderer.shadowMap.autoUpdate || renderer.shadowMap.needsUpdate) {
        shadow.map ??= new THREE.WebGLRenderTarget(4, 4);
        key.updateMatrixWorld(); key.target.updateMatrixWorld();
        shadow.updateMatrices(key);
        shadow.map.drawnWith = shadow.matrix.clone();
        renderer.shadowMap.needsUpdate = false;
      }
      return { map: sampled, matrix: shadow.matrix.clone() };
    };
    // One frame of ShadowCadence's reduced-FX cadence, then the window's pass.
    const frame = (pass, refresh) => {
      renderer.shadowMap.needsUpdate = refresh;
      const redraws = renderer.shadowMap.autoUpdate || renderer.shadowMap.needsUpdate;
      aimStudioRig(MAIN);
      const main = draw();
      pass.begin(renderer, FAR, redraws);
      const far = draw();
      pass.end(MAIN);
      return { main, far };
    };
    aimStudioRig(MAIN);
    renderer.shadowMap.needsUpdate = true;
    draw(); // the main pass has drawn shadows before the window opens
    return { lights, renderer, frame };
  };

  it('shadows the window from its own side on every frame and leaves the main pass its own map', () => {
    const { lights, frame } = setup();
    const pass = createStudioRigPass(), mainMap = lights[0].shadow.map;
    // A refresh frame, then three frames in which nothing redraws shadows.
    for (const refresh of [true, false, false, false, true, false]) {
      const { main, far } = frame(pass, refresh);
      expect(main.map).toBe(mainMap);
      expect(near(main.map.drawnWith, main.matrix)).toBe(true);
      expect(near(main.matrix, matrixFor(MAIN))).toBe(true);
      expect(far.map).not.toBe(mainMap);
      expect(near(far.map.drawnWith, far.matrix)).toBe(true);
      expect(near(far.matrix, matrixFor(FAR))).toBe(true);
      expect(lights[0].shadow.map).toBe(mainMap);
      expect(near(lights[0].shadow.matrix, matrixFor(MAIN))).toBe(true);
    }
    pass.dispose();
  });

  it('redraws its own map on its first frame and after a frame it was not drawn, and only then off the cadence', () => {
    const { frame } = setup();
    const pass = createStudioRigPass();
    const first = frame(pass, false).far.map;
    expect(first.drawnWith).toBeDefined();
    const drawn = first.drawnWith;
    frame(pass, false);
    expect(first.drawnWith).toBe(drawn);
    pass.idle();
    frame(pass, false);
    expect(first.drawnWith).not.toBe(drawn);
    pass.dispose();
  });

  it('keeps the main map out of the window pass when shadows redraw every frame too', () => {
    const { lights, renderer, frame } = setup();
    renderer.shadowMap.autoUpdate = true;
    const pass = createStudioRigPass(), mainMap = lights[0].shadow.map;
    const { main } = frame(pass, false);
    expect(near(mainMap.drawnWith, matrixFor(MAIN))).toBe(true);
    expect(near(main.matrix, matrixFor(MAIN))).toBe(true);
    const own = frame(pass, false).far.map, dispose = vi.spyOn(own, 'dispose');
    pass.dispose();
    expect(dispose).toHaveBeenCalled();
  });
});
