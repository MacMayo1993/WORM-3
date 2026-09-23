import { cubeExpansionScale } from '../game/cubeWorldGeometry.js';
import { getStickerWorldPos as stickerPosition } from '../game/coordinates.js';

// Presentation bridge. The simulation owns the timer and publishes the amount.
export const wormExpansion = { amount: 0 };
export const EXPLODE_DURATION = 12;
export const EXPLODE_AMOUNT = 0.35;
export const EXPLODE_TRANSITION = 1.2;
export const getWormStickerWorldPos = (x, y, z, face, size) =>
  stickerPosition(x, y, z, face, size, wormExpansion.amount);

// Dilate the lattice, keeping outward surface offsets (including jump height)
// unchanged. Unlike scaling the entire worm, this keeps bead sizes and lift fixed.
export function remapExpansionPoint(point, size, from, to) {
  const a = cubeExpansionScale(size, from), b = cubeExpansionScale(size, to);
  const edge = (size - 1) / 2;
  for (const axis of ['x', 'y', 'z']) {
    const value = point[axis], absolute = Math.abs(value);
    point[axis] = absolute >= edge * a
      ? Math.sign(value) * (absolute + edge * (b - a)) : value * b / a;
  }
  return point;
}
