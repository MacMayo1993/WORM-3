import { tunnelTailReach } from './tunnelTrail.js';
import { shAt } from '../circularBuffers.js';
import { liveRotation } from '../liveRotation.js';
import { EXPLODE_AMOUNT, EXPLODE_TRANSITION, EXPLODE_SETTLE_GRACE_STEPS, remapExpansionPoint, remapExpansionSurfacePoint } from '../wormExpansion.js';

function canAdvanceExpansion(sim) {
  // Keep a tunnel's complete head-and-tail route fixed until everyone is out.
  // Opening/closing also waits for a slice turn or jump to finish.
  if (sim.phase !== 'crawling' || sim.tunnelPassages.length || liveRotation.active || sim.isJumping || sim.signature?.sweep) return false;
  // A captured pad route already uses the fully exploded lattice. Do not
  // dilate it a second time while any visible part of the worm still occupies it.
  if (sim.onRaisedPlatform || sim.raisedDeparture || (sim.raisedRouteDistance != null &&
      sim.stepHistory.distance - sim.raisedRouteDistance < tunnelTailReach(sim.tailLength))) return false;
  return true;
}

// Rescue runs before the expansion tick; include a timer expiring THIS frame.
export const expansionWillMove = (sim, delta) => canAdvanceExpansion(sim) &&
  sim.expansionAmount !== (sim.explodeT > Math.max(0, delta) ? EXPLODE_AMOUNT : 0);

export function tickExpansion(sim, size, delta, ctx) {
  if (!(sim.explodeT > 0 || sim.expansionAmount > 0) || !canAdvanceExpansion(sim)) return;
  const before = sim.expansionAmount;
  if (sim.explodeT > 0) {
    sim.explodeT = Math.max(0, sim.explodeT - delta);
    if (sim.explodeT === 0) ctx.onExplodeState?.(false);
  }
  const target = sim.explodeT > 0 ? EXPLODE_AMOUNT : 0;
  const distance = EXPLODE_AMOUNT * delta / EXPLODE_TRANSITION;
  const next = before < target ? Math.min(target, before + distance) : Math.max(target, before - distance);
  if (next === before) return;
  for (const point of [sim.prevWorldPos, sim.curWorldPos]) {
    if (point) remapExpansionPoint(point, size, before, next);
  }
  remapExpansionSurfacePoint(sim.headInterpPos, sim.currentNormal, size, before, next);
  for (let i = 0; i < sim.stepHistory.count; i++) {
    const sample = shAt(sim.stepHistory, i);
    if (sample.transit) remapExpansionPoint(sample.pos, size, before, next);
    else remapExpansionSurfacePoint(sample.pos, sample.normal, size, before, next);
  }
  sim.selfCollisionGraceSteps = Math.max(sim.selfCollisionGraceSteps, EXPLODE_SETTLE_GRACE_STEPS);
  sim.pendingSelfCollision = null;
  sim.expansionAmount = next;
  ctx.onExpansionAmount?.(next);
}
