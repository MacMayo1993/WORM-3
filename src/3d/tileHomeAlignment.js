// Transient presentation only: WeakMap entries never enter saves, workers or
// undo history. Keying by the actual sticker lets a remount resume its settling
// animation without borrowing the occupant that previously used this grid slot.
export const HOME_ALIGNMENT_MS = 220;
let events = new WeakMap();

export function clearHomeAlignments() {
  events = new WeakMap();
}

export function recordHomeAlignments(result) {
  clearHomeAlignments();
  for (const { x, y, z, face, turns } of result.orientationResets) {
    const offset = (turns === 3 ? -1 : turns) * Math.PI / 2;
    events.set(result.cubies[x][y][z].stickers[face], { offset, angle: offset, start: null });
  }
  return result;
}

// Rendering only reads the last displayed angle. A large React commit must not
// consume the settle interval before the replacement scene has drawn even once.
export function tileDisplayAngle(sticker, settleImmediately = false) {
  const target = (sticker?.uvTurns ?? 0) * Math.PI / 2;
  if (settleImmediately && sticker) events.delete(sticker);
  return target + (sticker ? events.get(sticker)?.angle ?? 0 : 0);
}

// Advance from the shared render clock, starting on this sticker's first tick.
// Every tile in a commit keeps its transported pose for the first drawn frame,
// even if rendering/layout took longer than the entire animation duration.
export function advanceTileDisplayAngle(sticker, now, settleImmediately = false) {
  const event = sticker && events.get(sticker);
  if (event && !settleImmediately) {
    event.start ??= now;
    const t = Math.min(1, Math.max(0, (now - event.start) / HOME_ALIGNMENT_MS));
    if (t >= 1) events.delete(sticker);
    else event.angle = event.offset * (1 - t) ** 3;
  }
  return tileDisplayAngle(sticker, settleImmediately);
}

export const hasHomeAlignment = sticker => !!sticker && events.has(sticker);
