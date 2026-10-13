import { cubeExpansionScale } from '../../game/cubeWorldGeometry.js';

// Exploded tiles need independent cells. Redistribute the existing detail budget
// across them instead of multiplying the flame/plant/vertex cost by size².
export function expandedElementalQuality(quality, size, separated) {
  if (!separated) return quality;
  const density = Math.min(1, (quality.skinGrid / size) ** 2);
  return { ...quality, skinGrid: size, cellDetail: density,
    flamesPerCell: Math.max(1, Math.floor(quality.flamesPerCell * density)) };
}

export const elementalHalfExtent = (size, amount) =>
  (size - 1) * cubeExpansionScale(size, amount) / 2 + 0.5;

// Map a point ON a face to its own tile, preserving its local offset. A uniform
// scale stretches tiles and emits particles into the gaps between cubies.
export function expandedFaceCoordinate(value, size, amount) {
  const centre = Math.min(size - 1, Math.max(0, Math.floor(value + size / 2))) - (size - 1) / 2;
  return value + centre * (cubeExpansionScale(size, amount) - 1);
}
