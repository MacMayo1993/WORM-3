import { BASE_TAIL_LENGTH, ORB_SEGMENT_GROWTH } from './healerWorm/constants.js';

// A forward-only cursor keeps the body pass linear even at MAX_TAIL. Entries are
// pickups, not fixed trios: bonuses, deposits and recovered cuts can change size.
export function resetCarriedOrbCursor(cursor) {
  cursor.index = -1;
  cursor.start = BASE_TAIL_LENGTH;
  cursor.end = BASE_TAIL_LENGTH;
  cursor.accent = false;
  cursor.block = false;
  return cursor;
}

export function advanceCarriedOrbCursor(cursor, segment, colors, segments) {
  while (segment >= cursor.end && cursor.index < colors.length) {
    cursor.index++;
    cursor.start = cursor.end;
    cursor.end += Math.max(1, segments?.[cursor.index] ?? ORB_SEGMENT_GROWTH);
  }
  const carried = segment >= BASE_TAIL_LENGTH && cursor.index < colors.length;
  const offset = segment - cursor.start;
  const groupOffset = offset % ORB_SEGMENT_GROWTH;
  const groupLength = Math.min(ORB_SEGMENT_GROWTH, cursor.end - segment + groupOffset);
  cursor.accent = carried && groupOffset === Math.min(1, groupLength - 1);
  cursor.block = carried && (groupOffset === ORB_SEGMENT_GROWTH - 1 || segment === cursor.end - 1);
  return carried;
}

// Infrequent snapshots (severed pieces) can sample the same mapping directly.
export function carriedOrbAccentColor(segment, colors, segments, fallback) {
  const cursor = resetCarriedOrbCursor({});
  advanceCarriedOrbCursor(cursor, segment, colors ?? [], segments);
  return cursor.accent ? colors[cursor.index] : fallback;
}
