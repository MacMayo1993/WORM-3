import { Vector3 } from 'three';
export const INTRO_SCALE = 1.2;
const corner = new Vector3();
// Preserve the larger cube while keeping its outer corners on narrow phones.
// Only adjust a shot when the requested scale would crop it.
export function fitIntroFrame(camera, root, extent) {
  root.updateWorldMatrix(true, false);
  for (let pass = 0; pass < 3; pass++) {
    camera.updateMatrixWorld();
    let overflow = 1;
    for (const x of [-extent, extent]) for (const y of [-extent, extent]) for (const z of [-extent, extent]) {
      corner.set(x, y, z).applyMatrix4(root.matrixWorld).project(camera);
      overflow = Math.max(overflow, Math.abs(corner.x) / 0.97, Math.abs(corner.y) / 0.97);
    }
    if (overflow <= 1) break;
    camera.position.multiplyScalar(overflow);
    camera.lookAt(0, -0.55, 0);
  }
  camera.updateMatrixWorld();
}
