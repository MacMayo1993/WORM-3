// Chaos needs a readable seam between two solid faces. Keep the tile shut
// around the color swap, and keep its silhouette inside its own grid square.
export const CHAOS_FLIP_DURATION = 0.55;

export function chaosFlipPose(progress) {
  const p = Math.max(0, Math.min(1, progress));
  const t = p < 0.42 ? 1 - p / 0.42 : p > 0.58 ? (p - 0.58) / 0.42 : 0;
  const openness = t * t * (3 - 2 * t);
  return {
    flipSquish: openness,
    mainScale: Math.max(0.001, openness),
    crossScale: 1 - 0.035 * (1 - openness),
    bounce: Math.sin(Math.PI * p) * 0.045,
  };
}
