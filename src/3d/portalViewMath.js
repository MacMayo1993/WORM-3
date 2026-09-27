import { Matrix4, Vector3 } from 'three';
import { frameCorners } from 'three/examples/jsm/utils/CameraUtils.js';
import { getManifoldGridId } from '../game/gridIds.js';
import { findAntipodalStickerByGrid } from '../game/manifoldLogic.js';
import { isLiveFlippedFace } from '../game/raisedCubie.js';

export const PORTAL_RADIUS = 0.34;
export const PORTAL_OFFSET = 0.048;

// Read both endpoints from the same committed cube snapshot. The map's embedded
// sticker metadata can lag a flip, while its identity/location remains valid.
export function livePortalPairs(cubies, size, manifoldMap, cap) {
  if (cubies?.length !== size) return [];
  const pairs = [], seen = new Set();
  for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) for (let z = 0; z < size; z++) {
    for (const sticker of Object.values(cubies[x]?.[y]?.[z]?.stickers ?? {})) {
      if (!isLiveFlippedFace(sticker, cap)) continue;
      const id = getManifoldGridId(sticker, size);
      if (seen.has(id)) continue;
      const at = findAntipodalStickerByGrid(manifoldMap, sticker, size);
      const partner = at && cubies[at.x]?.[at.y]?.[at.z]?.stickers?.[at.dirKey];
      if (!isLiveFlippedFace(partner, cap)) continue;
      const other = getManifoldGridId(partner, size);
      seen.add(id); seen.add(other);
      pairs.push({ a: id, b: other, colorA: sticker.curr, colorB: partner.curr });
    }
  }
  return pairs;
}

const inverse = new Matrix4(), eye = new Vector3();
const pa = new Vector3(), pb = new Vector3(), pc = new Vector3(), normal = new Vector3();

// Looking into the source maps to looking OUT of the destination. Flipping local
// X and Z (a half-turn around local Y) preserves handedness and avoids a mirrored
// video feed. The off-axis frustum makes the destination respond to head motion.
export function framePortalCamera(camera, viewer, sourceMatrix, destinationMatrix) {
  inverse.copy(sourceMatrix).invert();
  eye.setFromMatrixPosition(viewer.matrixWorld).applyMatrix4(inverse);
  if (eye.z <= PORTAL_OFFSET + 0.015 || !Number.isFinite(eye.z)) return false;
  eye.set(-eye.x, eye.y, -eye.z);
  camera.position.copy(eye).applyMatrix4(destinationMatrix);
  pa.set(PORTAL_RADIUS, -PORTAL_RADIUS, PORTAL_OFFSET).applyMatrix4(destinationMatrix);
  pb.set(-PORTAL_RADIUS, -PORTAL_RADIUS, PORTAL_OFFSET).applyMatrix4(destinationMatrix);
  pc.set(PORTAL_RADIUS, PORTAL_RADIUS, PORTAL_OFFSET).applyMatrix4(destinationMatrix);
  const scaleZ = normal.setFromMatrixColumn(destinationMatrix, 2).length();
  camera.near = Math.max(0.01, (PORTAL_OFFSET - eye.z) * scaleZ + 0.005);
  camera.far = Math.max(camera.near + 10, viewer.far);
  frameCorners(camera, pa, pb, pc);
  camera.updateMatrixWorld(true);
  return camera.projectionMatrix.elements.every(Number.isFinite);
}
