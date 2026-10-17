import { FACE_COLORS, RUBIKS_FACE_COLORS } from '../utils/constants.js';
import { resolveColors } from '../utils/colorSchemes.js';

// Render-only appearance shared by exterior stickers, tunnel walls and the core.
// Callers pass a view power only in WORM; saved settings remain untouched.
export function resolveCubeViewAppearance(settings, viewPower = null) {
  const classic = viewPower === 'view-classic';
  return {
    colors: classic ? RUBIKS_FACE_COLORS : resolveColors(settings, settings?.biomeMode?.faceAssignment) || FACE_COLORS,
    manifoldStyles: classic ? null : settings?.manifoldStyles
  };
}
