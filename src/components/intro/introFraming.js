import { Vector3 } from 'three';
export const INTRO_SCALE = 1.2;
const corner = new Vector3();
// Space for the largest copy beat above, and the Play key below. Framing the
// shifted rectangle (rather than shifting a full-screen fit) prevents clipping
// on shorter phones and desktop windows.
export function introPictureBounds(width, height) {
  const lift = 5 / height; // Five CSS pixels up, independent of viewport size.
  if (width / height > 1.25 && height <= 500) return { left: .43, right: .98, top: .10 - lift, bottom: .94 - lift };
  const title = Math.max(76, Math.min(150, width * .22)) * 1.15;
  const tagline = Math.max(17, Math.min(28, width * .046)) * 1.3 * 3;
  return { left: .03, right: .97, top: Math.min(.52, (96 + title + 12 + tagline + 16) / height) - lift,
    bottom: 1 - 118 / height - lift };
}

export function placeIntroFrame(camera, root, extent, width, height) {
  const bounds = introPictureBounds(width, height);
  const targetWidth = 2 * (bounds.right - bounds.left), targetHeight = 2 * (bounds.bottom - bounds.top);
  root.updateWorldMatrix(true, false);
  let left, right, top, bottom;
  for (let pass = 0; pass < 5; pass++) {
    camera.updateMatrixWorld();
    left = bottom = Infinity; right = top = -Infinity;
    for (const x of [-extent, extent]) for (const y of [-extent, extent]) for (const z of [-extent, extent]) {
      corner.set(x, y, z).applyMatrix4(root.matrixWorld).project(camera);
      left = Math.min(left, corner.x); right = Math.max(right, corner.x);
      bottom = Math.min(bottom, corner.y); top = Math.max(top, corner.y);
    }
    const overflow = Math.max((right - left) / targetWidth, (top - bottom) / targetHeight);
    if (overflow <= 1.001 || pass === 4) break;
    camera.position.multiplyScalar(overflow);
    camera.lookAt(0, -.55, 0);
  }
  const targetX = bounds.left + bounds.right - 1, targetY = 1 - bounds.top - bounds.bottom;
  camera.setViewOffset(width, height, ((left + right) / 2 - targetX) * width / 2,
    (targetY - (top + bottom) / 2) * height / 2, width, height);
}
