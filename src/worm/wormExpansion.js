import { cubeExpansionScale } from '../game/cubeWorldGeometry.js';
import { getStickerWorldPos as stickerPosition } from '../game/coordinates.js';

// Presentation bridge. The simulation owns the timer and publishes the amount.
export const wormExpansion = { amount: 0 };
export const EXPLODE_DURATION = 12;
export const EXPLODE_AMOUNT = 0.35;
export const EXPLODE_TRANSITION = 1.2;
export const currentExplosion = state => state.wormHealerMode ? wormExpansion.amount : (state.explosionT ?? 0);

// React only needs transition boundaries and the interior-guide threshold.
// Every moving object reads amount directly between those notifications.
export function publishWormExpansion(amount) {
  const before = wormExpansion.amount;
  wormExpansion.amount = amount;
  return before !== amount && (before === 0 || before === EXPLODE_AMOUNT ||
    amount === 0 || amount === EXPLODE_AMOUNT || (before > 0.15) !== (amount > 0.15));
}

export function rescaleExpandedCubies(refs, size, before, amount) {
  if (before === amount) return;
  const ratio = cubeExpansionScale(size, amount) / cubeExpansionScale(size, before);
  // Scale centres, never geometry. Multiplication preserves a live slice's
  // rotation and keeps its sticker offsets and the worm's lift unchanged.
  for (const piece of refs) if (piece) piece.position.multiplyScalar(ratio);
}
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
