import { BOOK_PAUSE_SECONDS, GLOW_TRAIL_SECONDS, MOBI_REENTRY_SECONDS } from '../characterAbilities.js';
import { makeWiggleSweep, WIGGLE_DURATION } from './wiggleSweep.js';
import { getStableKey } from '../wormLogic.js';
import { BODY_BALL_SPACING } from './constants.js';
import { ttAt } from '../circularBuffers.js';
import { liveRotation } from '../liveRotation.js';
import { jumpLandingTile } from './jumpLanding.js';
import { makeGlowTrail } from './glowTrail.js';

export const SIGNATURES = {
  classic: { name: 'Orb Abundance', short: 'Abundance', passive: true, cooldown: 0, duration: 0, color: '#a6eb9b', hint: '50% more orbs on the cube.' },
  book: { name: 'Time Out', short: 'Pause', cooldown: 30, duration: BOOK_PAUSE_SECONDS, color: '#ffda91', hint: 'Pause layer turns for 5 seconds. Earn 25% more XP.' },
  prism: { name: 'Spectrum', short: 'Spectrum', passive: true, cooldown: 0, duration: 0, color: '#ffd2fb', hint: 'Every orb color can heal every wormhole tunnel.' },
  wiggle: { name: 'Tail Wipers', short: 'Wiggle', cooldown: 12, duration: WIGGLE_DURATION, color: '#ffb5d7', hint: 'Sweep your tail three tiles left and right twice, collecting orbs. Steering locks until finished.' },
  inch: { name: 'Spring Loaded', short: 'Spring', cooldown: 24, duration: 0, color: '#c6ec86', hint: 'Long spring jump. Landing must be clear.' },
  glow: { name: 'Light Trail', short: 'Trail', cooldown: 22, duration: GLOW_TRAIL_SECONDS, color: '#8eefff', hint: 'Paint behind your tail for 8 seconds. The trail stays for 12 more seconds. Enemies glow brighter.' },
  mobi: { name: 'Create Wormhole', short: 'Tunnel', cooldown: 0, duration: 0, color: '#ceacff', hint: 'Open a tunnel beneath you without spending orbs. No re-entry for 10 seconds. Heal it before creating another.' },
};
export const SPRING_CHARGE = 0.24;
export const SPRING_SPAN = 2.2;
export const SPRING_HEIGHT = 1.8;
export const signatureKey = p => p ? `${p.x},${p.y},${p.z},${p.dirKey}` : '';
export const makeSignature = () => ({ character: null, cooldown: 0, charge: 0, active: 0, target: null, preview: null, reason: '', notice: '', noticeT: 0, seq: 0, charges: 0, heading: null, sweep: null, mobiTunnel: null, mobiOpening: false, glowTrail: null, fxT: 0, fxTile: null });
const stickerAt = (ctx, p) => ctx.getCubies()?.[p.x]?.[p.y]?.[p.z]?.stickers?.[p.dirKey];

// The restriction follows sticker identity when either mouth rotates to another face.
export function isParityLocked(sim, tile, ctx) {
  const owned = sim.signature?.mobiTunnel;
  return !!owned && owned.reentryT > 0 && !sim.signature.mobiOpening
    && owned.stableKeys.includes(getStableKey(tile.x, tile.y, tile.z, tile.dirKey, ctx.getCubies()));
}

export function releaseMobiTunnel(sim, tunnel) {
  if (sim.signature.mobiTunnel?.pairId === tunnel.pairId) sim.signature.mobiTunnel = null;
}

function targetFor(sim, size, ctx, character) {
  if (character === 'inch') return jumpLandingTile(sim.pos, sim.moveDir, size, sim.interpT, 0.001, SPRING_SPAN);
  return sim.pos;
}

// Preview and activation share eligibility. An invalid attempt never starts a
// cooldown; the sim revalidates Spring's landing at the end of its wind-up.
export function signatureAvailability(sim, size, ctx, launching = false) {
  const character = ctx.getCharacter?.() ?? 'classic';
  const sig = sim.signature;
  let reason = '';
  if (!SIGNATURES[character]) reason = 'No ability';
  else if (SIGNATURES[character].passive) reason = 'Always active';
  else if (!sim.alive) reason = 'Run ended';
  else if (ctx.isPaused()) reason = 'Paused';
  else if (!['active', 'finalHealing'].includes(ctx.getGamePhase())) reason = 'Start playing first';
  else if (ctx.isDemoLesson?.() && !ctx.allowDemoSignature?.()) reason = 'Finish this lesson first';
  else if (sim.phase !== 'crawling' || sim.rocketActive || sim.restRead || liveRotation.active) reason = 'Wait for a clear surface';
  else if (sim.healPauseT > 0 || sim.cutFocusT > 0 || sim.elementalFocusT > 0) reason = 'Wait a moment';
  else if (!launching && (sig.cooldown > 0 || sig.active > 0 || sig.charge > 0)) reason = 'Recharging';
  else if (['inch', 'wiggle', 'mobi'].includes(character) && sim.isJumping) reason = 'Land first';
  else if (['wiggle', 'mobi'].includes(character) && (sim.crossingCorner || sim.pendingVoidKill || sim.pendingTunnelHeal || sim.tunnelPassages.length)) reason = 'Finish the crossing first';
  else if (character === 'mobi' && sig.mobiTunnel) reason = 'Heal your tunnel first';
  else if (character === 'mobi' && !ctx.canCreateMobiTunnel?.(sim.pos)) reason = 'Find an unflipped tile';
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
  let created = null;
  if (available.character === 'mobi') {
    created = ctx.createMobiTunnel?.(available.target);
    if (!created) { sig.notice = 'Cannot open a tunnel here'; sig.noticeT = 1.8; return false; }
  }
  sig.character = available.character;
  sig.target = { ...available.target };
  sig.seq++; sig.fxTile = { ...sim.pos }; sig.fxT = 0.7;
  sig.notice = def.name; sig.noticeT = 1.8;
  if (sig.character === 'inch') sig.charge = SPRING_CHARGE;
  else { sig.active = def.duration; sig.cooldown = def.cooldown; }
  if (sig.character === 'glow') sig.glowTrail = makeGlowTrail();
  if (created) {
    sig.mobiTunnel = { pairId: created.tunnel.pairId, stableKeys: created.stableKeys, reentryT: MOBI_REENTRY_SECONDS };
    sig.mobiOpening = true;
  }
  if (sig.character === 'wiggle') {
    sig.sweep = makeWiggleSweep(sim, size);
    sig.heading = sim.moveDir;
    sim.pendingTurns.length = 0;
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
  if (sig.mobiTunnel) sig.mobiTunnel.reentryT = Math.max(0, sig.mobiTunnel.reentryT - delta);
  if (sig.character === 'inch') {
    if (sig.active && !sim.isJumping) { sig.active = 0; ctx.feel('rocketLand'); }
  } else if (sig.active > 0 && !['prism', 'wiggle'].includes(sig.character)) {
    sig.active = Math.max(0, sig.active - delta);
  }
  return false;
}

export function signatureReadout(sim, size, ctx) {
  const available = signatureAvailability(sim, size, ctx);
  const sig = sim.signature, def = SIGNATURES[available.character];
  sig.preview = available.target;
  sig.reason = available.reason;
  return { character: available.character, ready: !available.reason, reason: available.reason,
    returnReady: false, activeSeconds: Math.ceil(sig.active), charges: sig.charges,
    active: sig.active > 0 || sig.charge > 0, seconds: Math.ceil(sig.cooldown),
    fraction: def?.cooldown ? 1 - sig.cooldown / def.cooldown : 1,
    notice: sig.noticeT > 0 ? sig.notice : sig.mobiTunnel ? `Heal your wormhole${sig.mobiTunnel.reentryT > 0 ? ` · re-entry in ${Math.ceil(sig.mobiTunnel.reentryT)}s` : ''}` : '' };
}

// Prism's wildcard is a permanent deposit rule, not a pickup conversion.
export function refractPickup(_sim, _ctx, faceId) { return { faceId, bonus: 0 }; }
