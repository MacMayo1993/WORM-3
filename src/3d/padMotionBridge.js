// Render-only pose data for effects and raised tunnel mouths; never fed to the simulation.
export const padMotion = new Map();

export function removePadMotion(key, owner) {
  if (padMotion.get(key) === owner) padMotion.delete(key);
}
