import { expect, it } from 'vitest';
import { PerspectiveCamera, Vector3, Euler, Quaternion, Matrix4 } from 'three';
import { fitCarouselCube, carouselTurnScale } from '../components/menus/fitCarouselCube.js';

// Project actual cube corners through the menu camera, including intermediate
// turns. Layout tests must check the mesh, not just the transparent DOM window.
it.each([
  { width: 320, height: 568, stage: { left: 16, top: 100, width: 288, height: 230 } },
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

// Portrait phones are fitted to the poses the carousel really shows: a face
// parked toward the player (with its breathing wobble) and the slerp between
// any two faces. Parked, the cube sits inside the stage. Mid-turn it eases back
// (carouselTurnScale) so its wider silhouette stays on screen and covers the
// heading or footer by no more than 40px.
const FACES = [[0, 0, 0], [0, Math.PI, 0], [0, -Math.PI / 2, 0], [0, Math.PI / 2, 0], [Math.PI / 2, 0, 0], [-Math.PI / 2, 0, 0]]
  .map(e => new Quaternion().setFromEuler(new Euler(...e)));
it.each([
  { width: 390, height: 763, stage: { left: 0, top: 99, width: 390, height: 412 } },
  { width: 390, height: 844, stage: { left: 16, top: 111, width: 358, height: 477 } },
  { width: 430, height: 932, stage: { left: 0, top: 104, width: 430, height: 520 } },
])('fits every presented face and face-to-face turn on a $width × $height phone', ({ width, height, stage }) => {
  const camera = new PerspectiveCamera(40, width / height, 0.1, 1000);
  camera.position.set(0, 3, 12); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const fit = fitCarouselCube(camera, { width, height }, stage);
  const view = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(camera.position, new Vector3(fit.x, fit.y, 0), camera.up));
  const wobble = new Quaternion().setFromEuler(new Euler(0.18, 0.3, 0));
  const pose = q => new Quaternion().multiplyQuaternions(wobble, q).premultiply(view);
  const extent = (q, size = 1) => {
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const x of [-1.56, 1.56]) for (const y of [-1.56, 1.56]) for (const z of [-1.56, 1.56]) {
      const c = new Vector3(x, y, z).applyQuaternion(q).multiplyScalar(fit.scale * 1.022 * size).add(new Vector3(fit.x, fit.y, 0)).project(camera);
      const px = (c.x + 1) * width / 2, py = (1 - c.y) * height / 2;
      left = Math.min(left, px); right = Math.max(right, px); top = Math.min(top, py); bottom = Math.max(bottom, py);
    }
    return { left, right, top, bottom };
  };
  for (const face of FACES) {
    const parked = extent(pose(face));
    expect(parked.left).toBeGreaterThan(stage.left); expect(parked.right).toBeLessThan(stage.left + stage.width);
    expect(parked.top).toBeGreaterThan(stage.top); expect(parked.bottom).toBeLessThan(stage.top + stage.height);
    // Bigger than the tumble fit left it: at least 70% of the screen width.
    expect(parked.right - parked.left).toBeGreaterThan(width * 0.7);
    for (const other of FACES) for (let t = 0.125; t < 1; t += 0.125) {
      const q = pose(face).slerp(pose(other), t);
      const turn = extent(q, carouselTurnScale(q.angleTo(pose(other)), fit.turnPullback));
      expect(turn.left).toBeGreaterThan(0); expect(turn.right).toBeLessThan(width);
      expect(turn.top).toBeGreaterThan(stage.top - 40); expect(turn.bottom).toBeLessThan(stage.top + stage.height + 40);
    }
  }
});
