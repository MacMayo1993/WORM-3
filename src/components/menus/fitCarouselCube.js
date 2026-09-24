import { Vector3 } from 'three';

const point = new Vector3();
const viewPoint = new Vector3();
const result = { x: 0, y: 1.2, scale: 0.8 };

// Project the DOM stage's center onto the menu cube's z=0 plane. Unlike a fixed
// portrait offset, this also works when a short screen scrolls or turns sideways.
// The 4.8-unit envelope leaves room for the cube's changing silhouette and bob.
export function fitCarouselCube(camera, viewport, stage) {
  if (!stage?.width || !stage?.height || !viewport.width || !viewport.height) return result;
  const centerX = stage.left + stage.width / 2;
  const centerY = stage.top + stage.height / 2 - 6;
  point.set(centerX / viewport.width * 2 - 1, 1 - centerY / viewport.height * 2, 0.5).unproject(camera);
  point.sub(camera.position);
  point.multiplyScalar(-camera.position.z / point.z).add(camera.position);
  viewPoint.copy(point).applyMatrix4(camera.matrixWorldInverse);
  const distance = -viewPoint.z;
  const pixelsPerUnit = camera.projectionMatrix.elements[5] * viewport.height / (2 * distance);
  const available = Math.max(80, Math.min(stage.width - 56, stage.height - 42));
  result.x = point.x;
  result.y = point.y;
  result.scale = available / (4.8 * pixelsPerUnit + available * 2 / distance);
  return result;
}
