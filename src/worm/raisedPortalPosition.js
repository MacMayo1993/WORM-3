import { livePlatformFormation } from './platformFormation.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { cubieHasFlippedFace, isLiveFlippedFace, wormRaisedAmount, WORM_PAD_HEIGHT } from '../game/raisedCubie.js';
import { selectEffectiveFlipCap } from '../hooks/useGameStore.js';
import { wormExpansion } from './wormExpansion.js';

// Only portal-owned visuals use this transform. Ordinary floor pickups and the
// crawl-under route still belong to the unraised lattice. Cap and pad height come
// from the same sources as the simulation, or rings would sit off the platform.
export function raisedPortalPosition(x, y, z, face, size, state) {
  const cubie = state.cubies?.[x]?.[y]?.[z];
  const cap = selectEffectiveFlipCap(state);
  const raised = state.wormHealerMode && !state.demoMode && cubie && cubieHasFlippedFace(cubie, cap);
  const lift = raised ? livePlatformFormation({ x, y, z }, size)?.lift ?? 1 : 0;
  const point = getStickerWorldPos(x, y, z, face, size, Math.max(wormExpansion.amount, wormRaisedAmount(size) * lift));
  if (raised && isLiveFlippedFace(cubie.stickers[face], cap)) {
    point[{ X: 0, Y: 1, Z: 2 }[face[1]]] += face[0] === 'P' ? WORM_PAD_HEIGHT : -WORM_PAD_HEIGHT;
  }
  return point;
}

// How far a face's portal visuals sit above its slot: a live pad's hover, else 0.
export function raisedPortalLift(x, y, z, face, state) {
  const sticker = state.cubies?.[x]?.[y]?.[z]?.stickers?.[face];
  if (!state.wormHealerMode || state.demoMode || !sticker) return 0;
  return isLiveFlippedFace(sticker, selectEffectiveFlipCap(state)) ? WORM_PAD_HEIGHT : 0;
}
