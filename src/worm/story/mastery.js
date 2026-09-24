import { getAllSurfaceTiles } from '../healerWorm/surfaceTiles.js';
import { tileKey } from '../healerWorm/wormSim.js';
import { ttAt } from '../circularBuffers.js';
import { BODY_BALL_SPACING } from '../healerWorm/constants.js';

export const STORY_ELEMENTS = ['water', 'fire', 'grass', 'ice', 'lightning'];
const HINTS = { rocket: 'Rocket: steer the flight and land', magnet: 'Magnet: pull orbs from neighboring tiles',
  explode: 'Explode: the cube spreads apart for 12 seconds. Keep crawling until it closes',
  water: 'Water: build momentum in a straight line', fire: 'Fire: leave a trail for 3 seconds',
  grass: 'Grass: land, then jump from your spring patch', ice: 'Ice: jump to steer, then land', lightning: 'Lightning: survive the storm for 4 seconds' };
const add = (p, key) => { p.mechanics[key] = (p.mechanics[key] ?? 0) + 1; };

// Events originate after a successful pickup/disarm/heal, never from button input.
export function recordStoryMechanic(practice, key, id) {
  if (practice && key === 'grassLaunch') { practice.grassJump = true; return; }
  if (!practice || !['ringHeals', 'magnetOrbs', 'bombs', 'elementPickups'].includes(key)) return;
  if (key === 'bombs') {
    if (id == null || practice.bombIds.has(id)) return;
    practice.bombIds.add(id);
  }
  add(practice, key);
}
export function updateMastery(sim, p, level, delta) {
  if (!level.mechanics || !sim.alive) return;
  const safe = sim.phase === 'crawling' && !sim.isJumping && !sim.rocketActive;
  if (sim.boostActiveT > 0) p.boosting = true;
  else if (p.boosting && sim.phase === 'crawling') { add(p, 'boosts'); p.boosting = false; }
  if (sim.isJumping && !sim.rocketActive && !p.flying) {
    p.doubleJump ||= sim.jumpCount >= 2;
    if (sim.elementalT > 0 && sim.elementalType === 'ice') p.iceJump = true;
  }
  if (sim.rocketActive) { p.flying = true; p.doubleJump = false; p.grassJump = false; p.iceJump = false; }
  // An explosion counts once the cube has closed again with the worm still on it.
  if (sim.explodeT > 0) p.exploding = true;
  else if (p.exploding && safe && !(sim.expansionAmount > 0)) { add(p, 'explodes'); p.exploding = false; }
  if (safe) {
    if (p.doubleJump) { add(p, 'doubleJumps'); p.doubleJump = false; }
    if (p.flying) { add(p, 'rockets'); p.flying = false; }
    if (p.grassJump) { p.elements.add('grass'); p.grassJump = false; }
    if (p.iceJump) { p.elements.add('ice'); p.iceJump = false; }
  }
  const sig = sim.signature;
  // Inch increments seq when charging; only its successful launch earns credit.
  if (sig.seq > (p.signatureSeq ?? 0) && (sig.character !== 'inch' || sig.active > 0)) {
    add(p, 'signatures'); p.signatureSeq = sig.seq;
  }
  if (p.element !== sim.elementalType || sim.elementalT <= 0) p.elementTime = 0;
  p.element = sim.elementalType;
  if (sim.elementalT > 0 && sim.elementalFocusT <= 0 && sim.phase === 'crawling') {
    p.elementTime += Math.min(Math.max(delta, 0), 0.1);
    if (p.element === 'water' && p.elementTime >= 3 && sim.waterMomentum > 0.75) p.elements.add('water');
    if (p.element === 'fire' && p.elementTime >= 3 && [...sim.elementalPatches.values()].some(patch => patch.type === 'fire')) p.elements.add('fire');
    if (p.element === 'lightning' && p.elementTime >= 4) p.elements.add('lightning');
  }
}
export function nextStoryPower(p, level) {
  const m = level.mechanics;
  if (!m) return null;
  if ((p.mechanics.rockets ?? 0) < (m.rockets ?? 0)) return 'rocket';
  if ((p.mechanics.magnetOrbs ?? 0) < (m.magnetOrbs ?? 0)) return 'magnet';
  if ((p.mechanics.explodes ?? 0) < (m.explodes ?? 0)) return 'explode';
  if (m.elementPickups) {
    const collected = p.mechanics.elementPickups ?? 0;
    return collected < m.elementPickups ? STORY_ELEMENTS[collected % STORY_ELEMENTS.length] : null;
  }
  return m.elements ? STORY_ELEMENTS.find(type => !p.elements.has(type)) ?? null : null;
}
export function storySurfaceTile(sim, size, cubies, occupied = new Set()) {
  return getAllSurfaceTiles(size).find(tile => {
    const sticker = cubies[tile.x]?.[tile.y]?.[tile.z]?.stickers[tile.dirKey];
    const distance = Math.hypot(tile.x - sim.pos.x, tile.y - sim.pos.y, tile.z - sim.pos.z);
    // A 2×2 or 3×3 face has no tile two steps from its center; take the nearest ring there.
    return tile.dirKey === sim.pos.dirKey && distance >= (size >= 4 ? 2 : 1) && distance <= 3 &&
      sticker && sticker.curr === sticker.orig && !occupied.has(tileKey(tile));
  });
}
// One marked offering at a time; expiration reoffers it near the current face.
// A completed power is not replaced until its effect ends, so elements never
// overwrite an unfinished flight or spring jump. Quest magnet orbs replenish
// only while remote catches are still outstanding.
export function offerStoryPower(sim, p, level, size, cubies) {
  const type = nextStoryPower(p, level);
  p.powerHint = type ? (level.mechanics?.elementPickups ? 'Steer onto the marked elemental orb to collect it' : HINTS[type]) : null;
  if (!type || sim.specials.length || sim.rocketActive || sim.isJumping || sim.magnetT > 0 || sim.elementalT > 0 || sim.explodeT > 0 || sim.expansionAmount > 0 || sim.phase !== 'crawling') return false;
  const occupied = new Set(sim.powerups.map(tileKey));
  for (let i = 0; i < Math.min(sim.tileTrail.count, Math.ceil(sim.tailLength * BODY_BALL_SPACING)); i++) occupied.add(ttAt(sim.tileTrail, i));
  const tile = storySurfaceTile(sim, size, cubies, occupied);
  if (!tile) return false;
  sim.specials = [{ ...tile, type, id: `story-${level.id}-${p.powerSeq++}`, ttl: 20, maxTtl: 20 }];
  if (type === 'magnet') {
    let added = 0;
    for (const nearby of getAllSurfaceTiles(size)) {
      const sticker = cubies[nearby.x][nearby.y][nearby.z].stickers[nearby.dirKey];
      const distance = Math.hypot(nearby.x-tile.x, nearby.y-tile.y, nearby.z-tile.z);
      if (nearby.dirKey !== tile.dirKey || distance < 1 || distance > 2 || sticker.curr !== sticker.orig || occupied.has(tileKey(nearby))) continue;
      sim.powerups.push({ ...nearby, type: 'apple' });
      if (++added >= 4) break;
    }
  }
  return true;
}
