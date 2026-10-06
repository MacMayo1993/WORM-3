// Transient presentation only: WeakMap entries never enter saves, workers or
// undo history. Keying by the actual sticker lets a remount resume its settling
// animation without borrowing the occupant that previously used this grid slot.
export const HOME_ALIGNMENT_MS = 220;
let events = new WeakMap();

export function clearHomeAlignments() {
  events = new WeakMap();
}

export function recordHomeAlignments(result, now = performance.now()) {
  clearHomeAlignments();
  for (const { x, y, z, face, turns } of result.orientationResets) {
    const offset = (turns === 3 ? -1 : turns) * Math.PI / 2;
    events.set(result.cubies[x][y][z].stickers[face], { offset, start: now });
  }
  return result;
}

export function tileDisplayAngle(sticker, now = performance.now(), settleImmediately = false) {
  const target = (sticker?.uvTurns ?? 0) * Math.PI / 2;
  const event = sticker && events.get(sticker);
  if (!event) return target;
  const t = Math.min(1, Math.max(0, (now - event.start) / HOME_ALIGNMENT_MS));
  if (settleImmediately || t >= 1) {
    events.delete(sticker);
    return target;
  }
  return target + event.offset * (1 - t) ** 3;
}

export const hasHomeAlignment = sticker => !!sticker && events.has(sticker);
