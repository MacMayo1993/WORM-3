// src/worm/healerWorm/tunnelTiming.js
//
// How a tunnel ride spends its seconds inside the cube.
//
// A ride used to take the same 4 s down the entry arm, 2 s across the core and
// 4 s up the exit arm on every route. The distances behind those budgets vary a
// lot: on a 3×3 each arm is barely a unit and a third, so the worm dawdled down
// it and then whipped across the swollen core; on a 15×15 the arms are seven to
// thirteen units and the worm shot down them and then crawled through a core
// that, even swollen six times, is two units across; and a corner entry bound
// for a centre exit gave its four-unit arm the same time as the two-unit one.
//
// So the ride keeps its total (the handoffs plus 2 × arm + crossing, exactly what
// it always was, so a run lasts as long as before) and splits that budget by the
// distance the player sees: each arm's length, and the crossing at the size the
// core is swollen to while it is crossed (coreZoomLimit). Clamps keep every leg
// a beat of its own, so the crossing never flashes past and an arm never drags.
//
// Pure: the sim works it out once when a ride starts and carries it on the
// active tunnel (`armSeconds`, `exitArmSeconds`, `crossingSeconds`), where the
// sim, the camera and anything else reading tunnelArmSeconds pick it up.

import { makeTunnelPath } from '../../utils/tunnelPath.js';
import { buildTunnelPathForTunnel } from '../wormLogic.js';
import { coreZoomLimit } from '../../3d/antipodalCore.js';

/** The crossing never takes less or more than this, whatever the route. */
export const CROSSING_SECONDS_MIN = 1.6;
export const CROSSING_SECONDS_MAX = 2.4;
/** Neither arm takes less than this share of the two arms' time. */
export const ARM_SHARE_MIN = 0.4;

const _path = makeTunnelPath();

// Whole tenths of a second, as the fixed budgets were: a phase then ends on a
// frame boundary at 30, 60 and 120 Hz, so no ride holds a fractional frame at a
// dock or a mouth (the sim starts each phase from zero).
const TICK = 10;
const tick = seconds => Math.round(seconds * TICK) / TICK;
// The crossing in fifths, so the arms' share of a budget in even tenths stays
// even and a symmetric route's two arms come out exactly equal.
const tick2 = seconds => Math.round(seconds * TICK / 2) * 2 / TICK;

/**
 * Seconds for the entry arm, the crossing and the exit arm of this ride.
 * `armDefault` and `crossingDefault` are the fixed budgets the ride would
 * otherwise take; their total (2 × arm + crossing) is preserved exactly.
 */
export function tunnelRideTiming(tunnel, size, expansion, armDefault, crossingDefault) {
  const budget = 2 * armDefault + crossingDefault;
  const fallback = { armSeconds: armDefault, exitArmSeconds: armDefault, crossingSeconds: crossingDefault };
  if (!tunnel?.entry || !tunnel?.exit || !(budget > 0)) return fallback;
  buildTunnelPathForTunnel(_path, tunnel, size, expansion);
  const armA = _path.armALen, armB = _path.armBLen;
  const core = (_path.legLen[2] + _path.legLen[3]) * coreZoomLimit(_path.midA, size);
  const seen = armA + armB + core;
  if (!(seen > 0) || !Number.isFinite(seen)) return fallback;
  const crossing = tick2(Math.min(CROSSING_SECONDS_MAX, Math.max(CROSSING_SECONDS_MIN, budget * core / seen)));
  const arms = budget - crossing;
  const share = armA + armB > 0 ? Math.min(1 - ARM_SHARE_MIN, Math.max(ARM_SHARE_MIN, armA / (armA + armB))) : 0.5;
  const entry = tick(arms * share);
  return { armSeconds: entry, exitArmSeconds: tick(arms - entry), crossingSeconds: crossing };
}
