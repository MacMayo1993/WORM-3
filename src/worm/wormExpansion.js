import { cubeExpansionScale } from '../game/cubeWorldGeometry.js';
import { getStickerWorldPos as stickerPosition } from '../game/coordinates.js';

const AXES = ['x', 'y', 'z'];

// Presentation bridge. The simulation owns the timer and publishes the amount.
export const wormExpansion = { amount: 0 };
export const EXPLODE_DURATION = 12;
export const EXPLODE_AMOUNT = 0.6;
export const EXPLODE_TRANSITION = 1.2;
// Closing the lattice moves the tail toward the head without player input.
// Keep three departing steps clear after the last movement, as with slice turns.
export const EXPLODE_SETTLE_GRACE_STEPS = 3;
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
  for (const axis of AXES) {
    const value = point[axis], absolute = Math.abs(value);
    point[axis] = absolute >= edge * a
      ? Math.sign(value) * (absolute + edge * (b - a)) : value * b / a;
  }
  return point;
}

// Sag toward the cube only in unsupported space between cubies. Leave room for
// the bead's radius at both lips, with a flat tangent at each end. Face-relative
// gravity keeps the same hanging bridge on all six sides of the board.
export function explosionGapSag(point, normal, size, amount) {
  if (!(amount > 0)) return 0;
  const scale = cubeExpansionScale(size, amount);
  const span = scale - 1 - 0.32;
  if (span <= 0) return 0;
  const edge = (size - 1) / 2;
  let sag = 0;
  for (const axis of AXES) {
    if (Math.abs(normal[axis]) > 1e-6) continue;
    const cell = point[axis] / scale + edge;
    if (cell <= 0 || cell >= size - 1) continue;
    const offset = (cell - Math.floor(cell)) * scale;
    const t = (offset - 0.66) / span;
    if (t > 0 && t < 1) sag = Math.max(sag, Math.sin(Math.PI * t) ** 2 * Math.min(0.28, span * 0.4));
  }
  return sag;
}

// Undo yesterday's sag before dilating, then apply today's. Repeated opening /
// closing must not accumulate a downward drift in the saved body route.
export function remapExpansionSurfacePoint(point, normal, size, from, to) {
  point.addScaledVector(normal, explosionGapSag(point, normal, size, from));
  remapExpansionPoint(point, size, from, to);
  return point.addScaledVector(normal, -explosionGapSag(point, normal, size, to));
}
