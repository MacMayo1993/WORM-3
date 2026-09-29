// Shared by the played Dancer and its picker. Keep the wave inside the body's
// footprint: a wide offset on either side of a turn folds the neck over itself.
export const WIGGLE_BODY_SCALE = [0.088, 0.082, 0.128];

export function wiggleBodyOffset(distance, time) {
  const neck = Math.min(1, Math.max(0, distance / 0.45));
  return 0.032 * neck * neck * (3 - 2 * neck) * Math.sin(distance * 4.5 - time * 3.2);
}
