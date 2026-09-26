import { getStickerWorldPos } from '../game/coordinates.js';
import { cubieHasFlippedFace, isLiveFlippedFace, raisedWormExpansion } from '../game/raisedCubie.js';
import { selectEffectiveFlipCap } from '../hooks/useGameStore.js';
import { WORM_PAD_HEIGHT } from './healerWorm/raisedPlatforms.js';
import { wormExpansion } from './wormExpansion.js';

// Only portal-owned visuals use this transform. Ordinary floor pickups and the
// crawl-under route still belong to the unraised lattice. Cap and pad height come
// from the same sources as the simulation, or rings would sit off the platform.
export function raisedPortalPosition(x, y, z, face, size, state) {
  const cubie = state.cubies?.[x]?.[y]?.[z];
  const cap = selectEffectiveFlipCap(state);
  const raised = state.wormHealerMode && !state.demoMode && cubie && cubieHasFlippedFace(cubie, cap);
  const point = getStickerWorldPos(x, y, z, face, size, raised ? raisedWormExpansion(wormExpansion.amount) : wormExpansion.amount);
  if (raised && isLiveFlippedFace(cubie.stickers[face], cap)) {
    point[{ X: 0, Y: 1, Z: 2 }[face[1]]] += face[0] === 'P' ? WORM_PAD_HEIGHT : -WORM_PAD_HEIGHT;
  }
  return point;
}
