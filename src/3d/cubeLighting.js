// One light rig for the Rubik's cube wherever it is played or shown: the main
// menu's studio light — a strong warm key from above and in front, a cool fill
// from the left, and a cool rim from behind that picks out the silhouette and
// the stickers' bevels. The play scene uses it for every look built from the
// menu cube's parts; wireframe and glass keep their own tuned rigs.
// Pure data, no Three imports, so tests and both scenes can read it.

export const CUBE_LIGHT_RIG = {
  ambient: 0.75,
  key: { position: [4, 6, 8], intensity: 2.1, color: '#fff8f0' },
  fill: { position: [-5, 1, 4], intensity: 0.75, color: '#d6e6ff' },
  rim: { position: [2, 4, -6], intensity: 1.3, color: '#e6edff' }
};

// Looks that light themselves differently (dim LED wireframe, see-through glass).
const OWN_RIG_MODES = new Set(['wireframe', 'glass']);

/** Whether a play-cube view style takes the shared menu rig. */
export const usesCubeLightRig = (visualMode) => !OWN_RIG_MODES.has(visualMode);

/**
 * Whether the play scene needs its own reflection map. Photo panoramas supply
 * one from their image; the procedural space scenes (black hole, nebula, moon)
 * supply none, and without it the stickers' clearcoat has nothing to catch.
 */
export const needsCubeReflections = ({ storyEnvFile = null, inLevel = false, backgroundFile = null, photoPreset = false }) => {
  if (inLevel) return !storyEnvFile;
  return !backgroundFile && !photoPreset;
};
