import { resolveColors } from '../utils/colorSchemes.js';
import { getAntipodalOrbColor, getOrbColor } from './wormHelpers.js';
import { getOrbMaterials } from './orbMaterials.js';
import { getTileStyleMaterial } from '../3d/styles/TileStyleMaterials.jsx';

// Same face, antipodal gem and patterned band as the actual world pickup.
// Materials belong to the world caches, never to an individual MOBI segment.
export function createMobiOrbPalette(settings) {
  const colors = resolveColors(settings);
  return Array.from({ length: 7 }, (_, face) => {
    const bandColor = face ? getOrbColor(face, colors) : '#bd92ff';
    const gemColor = face ? getAntipodalOrbColor(face, colors) : '#80e8ff';
    const style = settings?.manifoldStyles?.[face] || 'solid';
    const bandMaterial = style === 'solid'
      ? getOrbMaterials(gemColor, bandColor, false).band
      : getTileStyleMaterial(style, bandColor, false, null, gemColor);
    return { bandColor, gemColor, bandMaterial };
  });
}
