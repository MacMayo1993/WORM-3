import { Object3D } from 'three';

// three.js recomposes every object's matrices each frame, hidden or not: the
// scene's forced update reaches every descendant whatever matrixWorldAutoUpdate
// says. Effects that wait hidden on every tile until they fire (the worm's
// footprint, the heal seal and its sparks) were thousands of objects a frame on
// a 15×15. Marked here, an object skips that work while it is hidden. Showing it
// is enough to bring it back: the renderer's update runs before the draw, so it
// is current in the frame it appears. Anything that needs a hidden object's
// world position still gets it from updateWorldMatrix / getWorldPosition.
function updateWhileShown(force) {
  if (this.visible) Object3D.prototype.updateMatrixWorld.call(this, force);
}

export function skipMatrixWhileHidden(object) {
  if (object) object.updateMatrixWorld = updateWhileShown;
  return object;
}
