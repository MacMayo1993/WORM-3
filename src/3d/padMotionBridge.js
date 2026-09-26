// Render-only pose data; never fed back into cube state or tunnel geometry.
export const padMotion = new Map();

export function removePadMotion(key, owner) {
  if (padMotion.get(key) === owner) padMotion.delete(key);
}
