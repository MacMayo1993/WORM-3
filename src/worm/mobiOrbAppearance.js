import * as THREE from 'three';
import { BASE_TAIL_LENGTH, ORB_SEGMENT_GROWTH } from './healerWorm/constants.js';
import { resolveColors } from '../utils/colorSchemes.js';
import { getAntipodalOrbColor, getOrbColor } from './wormHelpers.js';
import { getOrbMaterials } from './orbMaterials.js';
import { getTileStyleMaterial } from '../3d/styles/TileStyleMaterials.jsx';

// Same face, antipodal gem and patterned band as the actual world pickup.
// Materials belong to the world caches, never to an individual MOBI segment.
export function createMobiOrbPalette(settings) {
  const colors = resolveColors(settings);
  return Array.from({ length: 7 }, (_, face) => {
    const bandColor = getOrbColor(face || 1, colors);
    const gemColor = getAntipodalOrbColor(face || 1, colors);
    const style = settings?.manifoldStyles?.[face] || 'solid';
    const bandMaterial = style === 'solid'
      ? getOrbMaterials(gemColor, bandColor, false).band
      : getTileStyleMaterial(style, bandColor, false, null, gemColor);
    return { bandColor, gemColor, bandMaterial, gasGem: new THREE.Color(gemColor), gasBand: new THREE.Color(bandColor) };
  });
}

// Read surviving history on every draw: cuts and healing must remove those cores.
export function mobiCarriedFace(segment, pickupCount, faceIds) {
  const index = Math.floor((segment - BASE_TAIL_LENGTH) / ORB_SEGMENT_GROWTH);
  const face = faceIds[index];
  return index >= 0 && index < pickupCount && Number.isInteger(face) && face >= 1 && face <= 6 ? face : 0;
}
