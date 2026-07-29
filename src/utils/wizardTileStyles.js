import { ALL_TILE_STYLE_KEYS } from './tileStyleCatalog.js';

/** Resolve a wizard's global/per-face selection into the six played styles. */
export function resolveWizardTileStyles(wizardSettings, random = Math.random) {
  const manifoldStyles = {};

  for (let faceId = 1; faceId <= 6; faceId++) {
    const perFace = wizardSettings.perFaceStyles?.[faceId];
    if (perFace && perFace !== 'random') {
      manifoldStyles[faceId] = perFace;
    } else if (wizardSettings.tileStyle === 'random' || perFace === 'random') {
      const index = Math.floor(random() * ALL_TILE_STYLE_KEYS.length);
      manifoldStyles[faceId] = ALL_TILE_STYLE_KEYS[index];
    } else {
      manifoldStyles[faceId] = wizardSettings.tileStyle || 'solid';
    }
  }

  return manifoldStyles;
}
