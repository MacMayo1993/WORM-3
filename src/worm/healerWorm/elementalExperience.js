// Shared reveal and release pacing. Lightning retains its dedicated staging.
export const ELEMENTAL_EXPERIENCE = {
  fire: { sweep: 2.4, fadeOut: 1.8, body: '#ffae52', sound: 'elementFire' },
  water: { sweep: 2.8, fadeOut: 1.6, body: '#8ae7ff', sound: 'elementWater' },
  ice: { sweep: 3.0, fadeOut: 2.0, body: '#d5f5ff', sound: 'elementIce' },
  grass: { sweep: 2.6, fadeOut: 1.8, body: '#adf29a', sound: 'elementNature' },
};

export function elementalBodyWave(element, time, index, count) {
  const along = index / Math.max(1, count - 1);
  if (element === 'water') return (0.5 + 0.5 * Math.sin(along * 12 - time * 2.4)) ** 4;
  if (element === 'fire') return (0.5 + 0.5 * Math.sin(along * 22 - time * 3.5)) ** 6;
  if (element === 'grass') return (0.5 + 0.5 * Math.sin(along * 10 - time * 1.2)) ** 2;
  if (element === 'ice') return 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(along * 18 + time * 0.7)) ** 10;
  return 0;
}
