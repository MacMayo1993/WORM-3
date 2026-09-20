import { BASE_TAIL_LENGTH, BODY_BALL_SPACING, ORB_SEGMENT_GROWTH, MAX_TAIL } from '../healerWorm/constants.js';
export const bodyLength = count => Math.max(0, Math.floor(count) - 1) * BODY_BALL_SPACING;
export const ordinaryOrbLength = ORB_SEGMENT_GROWTH * BODY_BALL_SPACING;
export const segmentCountForOrbs = count => BASE_TAIL_LENGTH + ORB_SEGMENT_GROWTH * count;
export const HOLD_LENGTH = .18;
export const LENGTH_MARGIN = .045;
// Growth forecasts are supplied by the caller's character/pickup rules, and may
// change per pickup (e.g. a final Prism charge). Admission itself uses actual length.
export function missingPickupsForGrowth(required, count, growthAtPickup) {
  if (!Number.isFinite(required) || !Number.isInteger(count) || count < BASE_TAIL_LENGTH || count > MAX_TAIL) throw new Error('Invalid pickup forecast');
  let segments = count, pickups = 0;
  while (bodyLength(segments) + 1e-9 < required) {
    if (segments === MAX_TAIL) return Infinity;
    const growth = growthAtPickup(pickups);
    if (!Number.isInteger(growth) || growth <= 0) throw new Error('Invalid pickup growth');
    segments = Math.min(MAX_TAIL, segments + growth); pickups++;
  }
  return pickups;
}
export const missingOrdinaryOrbs = (required, count) => missingPickupsForGrowth(required, count, () => ORB_SEGMENT_GROWTH);
// Partition a single material interval, never count empty geometry as worm body.
export function bridgeMaterialLedger(length, headDistance, bridgeLength) {
  const tail = headDistance - length;
  const departure = Math.max(0, Math.min(headDistance, 0) - tail);
  const free = Math.max(0, Math.min(headDistance, bridgeLength) - Math.max(tail, 0));
  const landing = Math.max(0, headDistance - Math.max(tail, bridgeLength));
  return { departure, free, landing, total: departure + free + landing, tail };
}
