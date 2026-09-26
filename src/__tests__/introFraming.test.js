import { it, expect } from 'vitest';
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { INTRO_SCALE, introPictureBounds, placeIntroFrame } from '../components/intro/introFraming.js';
import { sampleIntro, introCameraDistance } from '../components/intro/introChoreography.js';

it('keeps the lowered cube inside its copy- and button-free rectangle', () => {
  for (const [width, height] of [[320, 568], [390, 664], [412, 804], [768, 1024], [1280, 800], [844, 390]]) {
    for (const time of [1, 2.8, 4.4, 7.2, 8.5]) {
      const pose = sampleIntro(time), spacing = 1 + 1.5 * pose.open, extent = spacing + .56;
      const camera = new PerspectiveCamera(40, width / height, .1, 1000), root = new Group();
      root.scale.setScalar(INTRO_SCALE); root.rotation.set(.12 + .1 * pose.open, pose.turn, 0); root.position.y = .25;
      const distance = introCameraDistance(pose.distance, camera.aspect, camera.fov);
      camera.position.set(Math.sin(pose.orbit) * distance, distance * .32, Math.cos(pose.orbit) * distance);
      camera.lookAt(0, -.55, 0);
      placeIntroFrame(camera, root, extent, width, height);
      const bounds = introPictureBounds(width, height);
      for (const x of [-extent, extent]) for (const y of [-extent, extent]) for (const z of [-extent, extent]) {
        const point = new Vector3(x, y, z).applyMatrix4(root.matrixWorld).project(camera);
        const px = (point.x + 1) / 2, py = (1 - point.y) / 2;
        expect(px).toBeGreaterThanOrEqual(bounds.left - .001);
        expect(px).toBeLessThanOrEqual(bounds.right + .001);
        expect(py).toBeGreaterThanOrEqual(bounds.top - .001);
        expect(py).toBeLessThanOrEqual(bounds.bottom + .001);
      }
    }
  }
});
