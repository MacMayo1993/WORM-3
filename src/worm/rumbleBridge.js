// The cells the Rumbler is lifting this frame (healerWorm/rumbler.js): tile key →
// lift in world units, at most MAX_RUMBLE_TILES of them. <Rumbler/> rewrites it
// once a frame, ahead of the sticker ticks, and wakes each lifted sticker;
// StickerPlane adds the lift to its front alongside the worm's press. Render-only,
// like tilePressBridge: nothing here reaches the simulation.
export const rumbleLifts = new Map();

export function getRumbleLift(key) {
  return rumbleLifts.size === 0 ? 0 : rumbleLifts.get(key) ?? 0;
}

/** Drop every lift: a run, size or scene change starts flat. */
export function resetRumble() {
  rumbleLifts.clear();
}
