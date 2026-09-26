import { livePlatformFormation } from './platformFormation.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { cubieHasFlippedFace, isLiveFlippedFace, WORM_RAISED_AMOUNT } from '../game/raisedCubie.js';
import { wormExpansion } from './wormExpansion.js';

// Only portal-owned visuals use this transform. Ordinary floor pickups and the
// crawl-under route still belong to the unraised lattice.
export function raisedPortalPosition(x, y, z, face, size, state) {
  const cubie = state.cubies?.[x]?.[y]?.[z];
  const raised = state.wormHealerMode && !state.demoMode && cubie && cubieHasFlippedFace(cubie, 6);
  const lift = raised ? livePlatformFormation({ x, y, z }, size)?.lift ?? 1 : 0;
  const point = getStickerWorldPos(x, y, z, face, size, raised ? Math.max(wormExpansion.amount, WORM_RAISED_AMOUNT * lift) : wormExpansion.amount);
  if (raised && isLiveFlippedFace(cubie.stickers[face], 6)) {
    point[{ X: 0, Y: 1, Z: 2 }[face[1]]] += face[0] === 'P' ? 0.5 : -0.5;
  }
  return point;
}
