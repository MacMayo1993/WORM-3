import { livePlatformFormation } from './platformFormation.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { cubiePitFaces, isLiveFlippedFace, isPitFace, wormPieceRaised, wormRaisedAmount, WORM_PAD_HEIGHT } from '../game/raisedCubie.js';
import { selectEffectiveFlipCap } from '../hooks/useGameStore.js';
import { wormExpansion } from './wormExpansion.js';

// Only portal-owned visuals use this transform. Ordinary floor pickups and the
// crawl-under route still belong to the unraised lattice. Cap and pad height come
// from the same sources as the simulation, or rings would sit off the platform.
// A collapsed tunnel's pit (tunnelPits.js) sits in its slot, on the floor.
export function raisedPortalPosition(x, y, z, face, size, state) {
  const cubie = state.cubies?.[x]?.[y]?.[z];
  const cap = selectEffectiveFlipCap(state);
  const raised = state.wormHealerMode && cubie && wormPieceRaised(cubie, cap, cubiePitFaces(cubie, cap, size, state.wormPitGrids));
  const lift = raised ? livePlatformFormation({ x, y, z }, size)?.lift ?? 1 : 0;
  const point = getStickerWorldPos(x, y, z, face, size, Math.max(wormExpansion.amount, wormRaisedAmount(size) * lift));
  if (raised && isLiveFlippedFace(cubie.stickers[face], cap) && !isPitFace(cubie.stickers[face], size, state.wormPitGrids)) {
    point[{ X: 0, Y: 1, Z: 2 }[face[1]]] += face[0] === 'P' ? WORM_PAD_HEIGHT : -WORM_PAD_HEIGHT;
  }
  return point;
}

// How far a face's portal visuals sit above its slot: a live pad's hover, else 0.
export function raisedPortalLift(x, y, z, face, state) {
  const sticker = state.cubies?.[x]?.[y]?.[z]?.stickers?.[face];
  if (!state.wormHealerMode || !sticker || isPitFace(sticker, state.size, state.wormPitGrids)) return 0;
  return isLiveFlippedFace(sticker, selectEffectiveFlipCap(state)) ? WORM_PAD_HEIGHT : 0;
}
