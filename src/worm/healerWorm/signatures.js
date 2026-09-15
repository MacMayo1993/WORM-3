import { getNextSurfacePosition } from '../wormLogic.js';
import { BODY_BALL_SPACING } from './constants.js';
import { ttAt } from '../circularBuffers.js';
import { liveRotation } from '../liveRotation.js';
import { jumpLandingTile } from './jumpLanding.js';

export const SIGNATURES = {
  inch: { name: 'Spring Loaded', short: 'Spring', cooldown: 24, duration: 0, color: '#c6ec86', hint: 'Long spring jump. Landing must be clear.' },
  glow: { name: 'Pulse Beacon', short: 'Beacon', cooldown: 22, duration: 5, color: '#8eefff', hint: 'Reveal nearby orbs and entrances. Reach one tile farther.' },
  mobi: { name: 'Parity Lock', short: 'Lock', cooldown: 28, duration: 6, color: '#ceacff', hint: 'Seal the nearest entrance ahead for six seconds.' },
};
export const SPRING_CHARGE = 0.24;
export const SPRING_SPAN = 2.2;
export const SPRING_HEIGHT = 1.8;
export const signatureKey = p => p ? `${p.x},${p.y},${p.z},${p.dirKey}` : '';
export const makeSignature = () => ({ character: null, cooldown: 0, charge: 0, active: 0, target: null, preview: null, reason: '', notice: '', noticeT: 0, seq: 0 });
const stickerAt = (ctx, p) => ctx.getCubies()?.[p.x]?.[p.y]?.[p.z]?.stickers?.[p.dirKey];

export function isParityLocked(sim, tile) {
  return sim.signature?.character === 'mobi' && sim.signature.active > 0
    && signatureKey(sim.signature.target) === signatureKey(tile);
}

function targetFor(sim, size, ctx, character) {
  if (character === 'inch') return jumpLandingTile(sim.pos, sim.moveDir, size, sim.interpT, 0.001, SPRING_SPAN);
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
  else if (!launching && (sig.cooldown > 0 || sig.active > 0 || sig.charge > 0)) reason = 'Recharging';
  else if (character === 'inch' && sim.isJumping) reason = 'Land first';
  const target = reason ? null : targetFor(sim, size, ctx, character);
  if (!reason && !target) reason = 'No entrance ahead';
  if (!reason && character === 'inch') {
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
  sig.character = available.character;
  sig.target = { ...available.target };
  sig.seq++;
  sig.notice = def.name; sig.noticeT = 1.8;
  if (sig.character === 'inch') sig.charge = SPRING_CHARGE;
  else { sig.active = def.duration; sig.cooldown = def.cooldown; }
  if (sig.character === 'mobi' && isParityLocked(sim, sim.pos)) {
    sim.pendingTunnelTrigger = null;
    sim.onFlippedTile = false; sim.lastFlipped = false; ctx.onFlippedTile(false);
  }
  ctx.feel(sig.character === 'inch' ? 'springCharge' : sig.character === 'glow' ? 'beacon' : 'parityLock');
  return true;
}

export function tickSignature(sim, delta, size, ctx) {
  const sig = sim.signature;
  if (sig.character !== (ctx.getCharacter?.() ?? 'classic')) {
    Object.assign(sig, makeSignature(), { character: ctx.getCharacter?.() ?? 'classic' });
  }
  if (sim.phase !== 'crawling' || !['active', 'finalHealing'].includes(ctx.getGamePhase())) return false;
  sig.noticeT = Math.max(0, sig.noticeT - delta);
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
  } else if (sig.active > 0) {
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
    active: sig.active > 0 || sig.charge > 0, seconds: Math.ceil(sig.cooldown),
    fraction: def ? 1 - sig.cooldown / def.cooldown : 0,
    notice: sig.noticeT > 0 ? sig.notice : '' };
}
