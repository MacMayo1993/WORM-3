import { isParityLocked } from './signatures.js';
import { getNextSurfacePosition, getStableKey } from '../wormLogic.js';
import { liveRotation } from '../liveRotation.js';
import { BASE_TAIL_LENGTH, HEAL_COST, ORB_SEGMENT_GROWTH } from './constants.js';

// Inventory and deposits are segments; the UI reports actual pickups required.
export function healingNeed({ deposited = 0, inventory = {}, faceId, tailLength, isPrism = false }) {
  const saved = Math.max(0, Math.min(HEAL_COST, deposited));
  const remaining = HEAL_COST - saved;
  const reserve = isPrism ? Object.values(inventory).reduce((a, b) => a + Math.max(0, b || 0), 0) : Math.max(0, inventory[faceId] || 0);
  const payable = Math.min(remaining, reserve, Math.max(0, tailLength - BASE_TAIL_LENGTH));
  const missing = Math.max(0, remaining - payable);
  return { saved, remaining, payable, missing, pickupsNeeded: Math.ceil(missing / ORB_SEGMENT_GROWTH),
    ready: missing === 0, savedFraction: saved / HEAL_COST, payableFraction: payable / HEAL_COST };
}
export function tunnelAt(sim, ctx, pos, distance = 0) {
  const cubies = ctx.getCubies();
  const sticker = cubies?.[pos.x]?.[pos.y]?.[pos.z]?.stickers?.[pos.dirKey];
  if (!sticker || sticker.curr === sticker.orig) return null;
  const resolved = ctx.resolveTunnel(pos.x, pos.y, pos.z, pos.dirKey);
  if (!resolved) return null;
  const key = getStableKey(pos.x, pos.y, pos.z, pos.dirKey, cubies);
  const deposited = ctx.getHealingProgress()?.[key]?.deposited ?? 0;
  const isPrism = ctx.isPrismCharacter();
  return { key, pos: { ...pos }, distance, faceId: sticker.curr, color: ctx.getOrbColor(sticker.curr), isPrism,
    locked: isParityLocked(sim, pos, ctx), lockSeconds: Math.ceil(sim.signature.mobiTunnel?.reentryT ?? 0),
    voided: sim.voidTunnelKeys.has(resolved.tunnelKey), uses: sim.tunnelUseCounts.get(resolved.tunnelKey) ?? 0,
    ...healingNeed({ deposited, inventory: ctx.getOrbInventory(), faceId: sticker.curr, tailLength: sim.tailLength, isPrism }) };
}
export function tunnelReadout(sim, size, ctx) {
  if (!sim.alive || !['active', 'finalHealing'].includes(ctx.getGamePhase()) || liveRotation.active || sim.restRead) return null;
  if (sim.phase !== 'crawling') {
    const need = sim.activeTunnel && tunnelAt(sim, ctx, sim.activeTunnel.entry);
    return need ? { ...need, inTransit: true } : null;
  }
  let pos = sim.pos, direction = sim.moveDir;
  for (let distance = 0; distance <= 3; distance++) {
    const need = tunnelAt(sim, ctx, pos, distance);
    if (need) return { ...need, aroundCorner: pos.dirKey !== sim.pos.dirKey, inTransit: false };
    const next = getNextSurfacePosition(pos, direction, size);
    if (!next) break;
    pos = next; direction = next.moveDir ?? direction;
  }
  return null;
}
