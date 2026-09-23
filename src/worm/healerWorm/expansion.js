import { shAt } from '../circularBuffers.js';
import { liveRotation } from '../liveRotation.js';
import { EXPLODE_AMOUNT, EXPLODE_TRANSITION, remapExpansionPoint } from '../wormExpansion.js';

export function tickExpansion(sim, size, delta, ctx) {
  if (!(sim.explodeT > 0 || sim.expansionAmount > 0)) return;
  // Keep a tunnel's complete head-and-tail route fixed until everyone is out.
  // Opening/closing also waits for a slice turn or jump to finish.
  if (sim.phase !== 'crawling' || sim.tunnelPassages.length || liveRotation.active || sim.isJumping || sim.signature?.sweep) return;
  const before = sim.expansionAmount;
  if (sim.explodeT > 0) {
    sim.explodeT = Math.max(0, sim.explodeT - delta);
    if (sim.explodeT === 0) ctx.onExplodeState?.(false);
  }
  const target = sim.explodeT > 0 ? EXPLODE_AMOUNT : 0;
  const distance = EXPLODE_AMOUNT * delta / EXPLODE_TRANSITION;
  const next = before < target ? Math.min(target, before + distance) : Math.max(target, before - distance);
  if (next === before) return;
  for (const point of [sim.prevWorldPos, sim.curWorldPos, sim.headInterpPos]) {
    if (point) remapExpansionPoint(point, size, before, next);
  }
  for (let i = 0; i < sim.stepHistory.count; i++) remapExpansionPoint(shAt(sim.stepHistory, i).pos, size, before, next);
  sim.expansionAmount = next;
  ctx.onExpansionAmount?.(next);
}
