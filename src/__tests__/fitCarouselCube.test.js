import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3, Euler, Quaternion, Matrix4 } from 'three';
import { fitCarouselCube } from '../components/menus/fitCarouselCube.js';

// Project actual cube corners through the menu camera, including intermediate
// turns. Layout tests must check the mesh, not just the transparent DOM window.
it.each([
  { width: 320, height: 568, stage: { left: 16, top: 100, width: 288, height: 230 } },
  { width: 390, height: 844, stage: { left: 16, top: 111, width: 358, height: 477 } },
  { width: 844, height: 390, stage: { left: 16, top: 105, width: 438, height: 242 } },
  { width: 1440, height: 900, stage: { left: 406, top: 130, width: 628, height: 510 } },
])('keeps the rotating mesh inside a $width × $height stage', ({ width, height, stage }) => {
  const camera = new PerspectiveCamera(40, width / height, 0.1, 1000);
  camera.position.set(0, 3, 12); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  for (const scroll of [0, 90]) {
    const bounds = { ...stage, top: stage.top - scroll };
    const fit = fitCarouselCube(camera, { width, height }, bounds);
    const view = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(camera.position, new Vector3(fit.x, fit.y, 0), camera.up));
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
      for (const x of [-1.56, 1.56]) for (const y of [-1.56, 1.56]) for (const z of [-1.56, 1.56]) {
        const corner = new Vector3(x, y, z).applyEuler(new Euler(0.18 + angle, 0.3 + angle, 0)).applyQuaternion(view)
          .multiplyScalar(fit.scale * 1.022).add(new Vector3(fit.x, fit.y, 0)).project(camera);
        const px = (corner.x + 1) * width / 2, py = (1 - corner.y) * height / 2;
        expect(px).toBeGreaterThan(bounds.left); expect(px).toBeLessThan(bounds.left + bounds.width);
        expect(py).toBeGreaterThan(bounds.top); expect(py).toBeLessThan(bounds.top + bounds.height);
      }
    }
  }
});
