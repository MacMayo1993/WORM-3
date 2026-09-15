import { getNextSurfacePosition, turnWorm, getStableKey } from '../wormLogic.js';
import { BODY_BALL_SPACING, BASE_TAIL_LENGTH, ORB_SEGMENT_GROWTH, HEAL_COST } from './constants.js';
import { ttAt } from '../circularBuffers.js';
import { liveRotation } from '../liveRotation.js';
import { jumpLandingTile } from './jumpLanding.js';

export const SIGNATURES = {
  classic: { name: 'Shed Skin', short: 'Shed', cooldown: 30, duration: 4, color: '#a6eb9b', hint: 'Survive one body hit by shedding tail. Costs at least one orb.' },
  book: { name: 'Bookmark', short: 'Mark', cooldown: 30, duration: 4, color: '#ffda91', hint: 'Mark this tile. Tap again within four seconds to return.' },
  prism: { name: 'Refract', short: 'Refract', cooldown: 26, duration: 1, color: '#ffd2fb', hint: 'Next three pickups: useful colors and +1 healing charge each.' },
  wiggle: { name: 'Sidewinder', short: 'Dodge', cooldown: 12, duration: 1, color: '#ffb5d7', hint: 'Dodge toward your last steering side. Clear landing required.' },
  inch: { name: 'Spring Loaded', short: 'Spring', cooldown: 24, duration: 0, color: '#c6ec86', hint: 'Long spring jump. Landing must be clear.' },
  glow: { name: 'Pulse Beacon', short: 'Beacon', cooldown: 22, duration: 5, color: '#8eefff', hint: 'Reveal nearby orbs and entrances. Reach one tile farther.' },
  mobi: { name: 'Parity Lock', short: 'Lock', cooldown: 28, duration: 6, color: '#ceacff', hint: 'Seal the nearest entrance ahead for six seconds.' },
};
export const SPRING_CHARGE = 0.24;
export const SPRING_SPAN = 2.2;
export const SPRING_HEIGHT = 1.8;
export const signatureKey = p => p ? `${p.x},${p.y},${p.z},${p.dirKey}` : '';
export const makeSignature = () => ({ character: null, cooldown: 0, charge: 0, active: 0, target: null, preview: null, reason: '', notice: '', noticeT: 0, seq: 0, charges: 0, heading: null, relocate: null, dashing: false, fxT: 0, fxTile: null });
const stickerAt = (ctx, p) => ctx.getCubies()?.[p.x]?.[p.y]?.[p.z]?.stickers?.[p.dirKey];

export function isParityLocked(sim, tile) {
  return sim.signature?.character === 'mobi' && sim.signature.active > 0
    && signatureKey(sim.signature.target) === signatureKey(tile);
}

function targetFor(sim, size, ctx, character) {
  if (character === 'inch') return jumpLandingTile(sim.pos, sim.moveDir, size, sim.interpT, 0.001, SPRING_SPAN);
  if (character === 'book' && sim.signature.active > 0) return sim.signature.target;
  if (character === 'wiggle') return getNextSurfacePosition(sim.pos, turnWorm(sim.moveDir, sim.signatureSide ?? 'right'), size);
  if (character !== 'mobi') return sim.pos;
  let tile = sim.pos, direction = sim.moveDir;
  for (let i = 0; i <= 3; i++) {
    const sticker = stickerAt(ctx, tile);
    if (sticker && sticker.curr !== sticker.orig) {
      const tunnel = ctx.resolveTunnel(tile.x, tile.y, tile.z, tile.dirKey);
      if (tunnel && !sim.voidTunnelKeys.has(tunnel.tunnelKey)) return tile;
    }
    const next = getNextSurfacePosition(tile, direction, size);
    if (!next) break;
    tile = next; direction = next.moveDir ?? direction;
  }
  return null;
}

// Preview and activation share eligibility. An invalid attempt never starts a
// cooldown; the sim revalidates Spring's landing at the end of its wind-up.
export function signatureAvailability(sim, size, ctx, launching = false) {
  const character = ctx.getCharacter?.() ?? 'classic';
  const sig = sim.signature;
  let reason = '';
  if (!SIGNATURES[character]) reason = 'No signature';
  else if (!sim.alive || ctx.isPaused() || !['active', 'finalHealing'].includes(ctx.getGamePhase()) || ctx.isDemoLesson?.()) reason = 'Not available now';
  else if (sim.phase !== 'crawling' || sim.rocketActive || sim.restRead || liveRotation.active) reason = 'Wait for a clear surface';
  else if (sim.healPauseT > 0 || sim.cutFocusT > 0 || sim.elementalFocusT > 0) reason = 'Wait a moment';
  else if (!launching && !(character === 'book' && sig.active > 0) && (sig.cooldown > 0 || sig.active > 0 || sig.charge > 0)) reason = 'Recharging';
  else if (['inch', 'book', 'wiggle'].includes(character) && sim.isJumping) reason = 'Land first';
  else if (['book', 'wiggle'].includes(character) && (sim.crossingCorner || sim.pendingVoidKill || sim.pendingTunnelHeal || sim.tunnelPassages.length)) reason = 'Finish the crossing first';
  else if (character === 'classic' && sim.tailLength < BASE_TAIL_LENGTH + ORB_SEGMENT_GROWTH) reason = 'Collect an orb first';
  else if (character === 'prism' && !neededPrismColor(sim, ctx)) reason = 'No tunnels need healing';
  const target = reason ? null : targetFor(sim, size, ctx, character);
  if (!reason && !target) reason = 'No entrance ahead';
  if (!reason && character === 'wiggle' && target.dirKey !== sim.pos.dirKey) reason = 'Face edge — turn first';
  if (!reason && (character === 'inch' || character === 'wiggle' || (character === 'book' && sig.active > 0))) {
    const sticker = stickerAt(ctx, target);
    if (!sticker || sticker.curr !== sticker.orig) reason = 'Landing on a wormhole';
    const key = signatureKey(target);
    const occupied = Math.min(sim.tileTrail.count, Math.ceil(sim.tailLength * BODY_BALL_SPACING));
    for (let i = 1; !reason && i < occupied; i++) {
      if (ttAt(sim.tileTrail, i) === key) reason = 'Body blocks landing';
    }
  }
  return { character, target, reason };
}

export function activateSignature(sim, size, ctx) {
  const available = signatureAvailability(sim, size, ctx);
  const sig = sim.signature;
  if (available.reason) {
    sig.notice = available.reason; sig.noticeT = 1.8;
    return false;
  }
  const def = SIGNATURES[available.character];
  if (available.character === 'book' && sig.active > 0) {
    sig.relocate = { ...sig.target, moveDir: sig.heading, teleport: true };
    sig.active = 0; sig.notice = 'Back to your bookmark'; sig.noticeT = 1.8; sig.fxT = 0.7;
    ctx.feel('exit'); return true;
  }
  sig.character = available.character;
  sig.target = { ...available.target };
  sig.seq++; sig.fxTile = { ...sim.pos }; sig.fxT = 0.7;
  sig.notice = def.name; sig.noticeT = 1.8;
  if (sig.character === 'inch') sig.charge = SPRING_CHARGE;
  else { sig.active = def.duration; sig.cooldown = def.cooldown; }
  if (sig.character === 'book') sig.heading = sim.moveDir;
  if (sig.character === 'prism') sig.charges = 3;
  if (sig.character === 'wiggle') {
    sig.relocate = { ...sig.target, moveDir: sim.moveDir, teleport: false };
    sig.dashing = true;
  }
  if (sig.character === 'mobi' && isParityLocked(sim, sim.pos)) {
    sim.pendingTunnelTrigger = null;
    sim.onFlippedTile = false; sim.lastFlipped = false; ctx.onFlippedTile(false);
  }
  ctx.feel(({ inch: 'springCharge', glow: 'beacon', mobi: 'parityLock', classic: 'magnet', book: 'specialSpawn', prism: 'heal', wiggle: 'jump' })[sig.character]);
  return true;
}

export function tickSignature(sim, delta, size, ctx) {
  const sig = sim.signature;
  if (sig.character !== (ctx.getCharacter?.() ?? 'classic')) {
    Object.assign(sig, makeSignature(), { character: ctx.getCharacter?.() ?? 'classic' });
  }
  if (sim.phase !== 'crawling' || !['active', 'finalHealing'].includes(ctx.getGamePhase())) return false;
  sig.noticeT = Math.max(0, sig.noticeT - delta);
  sig.fxT = Math.max(0, sig.fxT - delta);
  if (sig.charge > 0) {
    sig.charge = Math.max(0, sig.charge - delta);
    if (sig.charge > 0) return true;
    const available = signatureAvailability(sim, size, ctx, true);
    if (available.reason) { sig.notice = available.reason; sig.noticeT = 1.8; sig.target = null; return false; }
    sig.target = { ...available.target };
    sig.cooldown = SIGNATURES.inch.cooldown;
    sig.active = 1;
    sim.isJumping = true; sim.jumpT = 0.001; sim.jumpCount = 1;
    sim.jumpSpan = SPRING_SPAN; sim.jumpHeight = SPRING_HEIGHT;
    sim.pendingTunnelTrigger = null;
    ctx.feel('jump');
  }
  sig.cooldown = Math.max(0, sig.cooldown - delta);
  if (sig.character === 'inch') {
    if (sig.active && !sim.isJumping) { sig.active = 0; ctx.feel('rocketLand'); }
  } else if (sig.active > 0 && !['prism', 'wiggle'].includes(sig.character)) {
    sig.active = Math.max(0, sig.active - delta);
  }
  // Wait for settled coordinates before releasing an expired seal. A cube turn
  // may still be moving the locked sticker away from the head's destination.
  if (sig.character === 'mobi' && sig.active === 0 && sig.target && !liveRotation.active && !sim.restRead) {
    if (signatureKey(sig.target) === signatureKey(sim.pos)) {
      const sticker = stickerAt(ctx, sim.pos);
      if (sticker && sticker.curr !== sticker.orig) {
        sim.pendingTunnelTrigger = { ...sim.pos };
        sim.onFlippedTile = true; sim.lastFlipped = true; ctx.onFlippedTile(true);
      }
    }
    sig.target = null;
  }
  return false;
}

export function signatureReadout(sim, size, ctx) {
  const available = signatureAvailability(sim, size, ctx);
  const sig = sim.signature, def = SIGNATURES[available.character];
  sig.preview = available.target;
  sig.reason = available.reason;
  return { character: available.character, ready: !available.reason, reason: available.reason,
    returnReady: available.character === 'book' && sig.active > 0, activeSeconds: Math.ceil(sig.active), charges: sig.charges,
    active: sig.active > 0 || sig.charge > 0, seconds: Math.ceil(sig.cooldown),
    fraction: def ? 1 - sig.cooldown / def.cooldown : 0,
    notice: sig.noticeT > 0 ? sig.notice : '' };
}

// Choose the most underfunded live entrance, with deterministic tie-breaking.
// A pickup is still one pickup for XP; Refract adds one spendable body segment.
export function neededPrismColor(sim, ctx) {
  let best = null, deficit = -Infinity;
  const inventory = ctx.getOrbInventory() ?? {}, progress = ctx.getHealingProgress() ?? {};
  for (const tunnel of ctx.getActiveTunnels?.() ?? []) {
    for (const pos of [tunnel.entry, tunnel.exit]) {
      if (!pos) continue;
      const sticker = stickerAt(ctx, pos);
      if (!sticker || sticker.curr === sticker.orig) continue;
      const resolved = ctx.resolveTunnel(pos.x, pos.y, pos.z, pos.dirKey);
      if (resolved && sim.voidTunnelKeys.has(resolved.tunnelKey)) continue;
      const key = getStableKey(pos.x, pos.y, pos.z, pos.dirKey, ctx.getCubies());
      const remaining = HEAL_COST - (progress[key]?.deposited ?? 0);
      if (remaining <= 0) continue;
      const need = remaining - (inventory[sticker.curr] ?? 0);
      if (need > deficit || (need === deficit && sticker.curr < best)) { best = sticker.curr; deficit = need; }
    }
  }
  return best;
}
export function refractPickup(sim, ctx, faceId) {
  const sig = sim.signature;
  if (sig.character !== 'prism' || !sig.active || sig.charges <= 0) return { faceId, bonus: 0 };
  const needed = neededPrismColor(sim, ctx);
  if (!needed) return { faceId, bonus: 0 };
  sig.charges--; if (sig.charges === 0) sig.active = 0;
  sig.fxT = 0.7; sig.fxTile = { ...sim.pos };
  sig.notice = `Refract · ${sig.charges} pickups left`; sig.noticeT = 1.8;
  return { faceId: needed, bonus: 1 };
}
