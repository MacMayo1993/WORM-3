import { drawViewPower, getViewPowerDef } from '../healerWorm/viewPowerups.js';
import { getAllSurfaceTiles } from '../healerWorm/surfaceTiles.js';
import { tileKey } from '../healerWorm/wormSim.js';
import { ttAt } from '../circularBuffers.js';
import { BODY_BALL_SPACING } from '../healerWorm/constants.js';
import { getNextSurfacePosition } from '../wormLogic.js';

export const STORY_ELEMENTS = ['water', 'fire', 'grass', 'ice', 'lightning'];
export const STORY_POWER_OPENING_DELAY = 10;
export const STORY_POWER_COOLDOWN = 5;
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
  // This clock runs only through active story metrics, so ready cards, pauses
  // and rescue holds cannot consume the opening window or recovery time.
  const powerBusy = sim.specials.length > 0 || sim.rocketActive || sim.magnetT > 0 ||
    sim.viewPowerT > 0 || sim.elementalT > 0 || sim.explodeT > 0 || sim.expansionAmount > 0;
  p.powerDelay = powerBusy ? STORY_POWER_COOLDOWN
    : Math.max(0, (p.powerDelay ?? STORY_POWER_OPENING_DELAY) - Math.min(Math.max(delta, 0), 0.1));
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
  if ((p.mechanics.magnetOrbs ?? 0) < (m.magnetOrbs ?? 0)) return 'magnet';
  if (m.elementPickups) {
    const collected = p.mechanics.elementPickups ?? 0;
    if (collected < m.elementPickups) return STORY_ELEMENTS[collected % STORY_ELEMENTS.length];
  }
  const element = m.elements && STORY_ELEMENTS.slice(0, m.elements).find(type => !p.elements.has(type));
  if (element) return element;
  if ((p.mechanics.explodes ?? 0) < (m.explodes ?? 0)) return 'explode';
  if ((p.mechanics.rockets ?? 0) < (m.rockets ?? 0)) return 'rocket';
  return null;
}
export function storySurfaceTile(sim, size, cubies, occupied = new Set()) {
  const { x, y, z, dirKey } = sim.pos;
  const axes = dirKey.endsWith('X') ? ['y', 'z'] : dirKey.endsWith('Y') ? ['x', 'z'] : ['x', 'y'];
  const u = sim.pos[axes[0]], v = sim.pos[axes[1]];
  const minDistanceSq = size >= 4 ? 4 : 1;
  // Only the local radius-three patch can qualify. Preserve surface-cache order
  // so spawn positions stay identical, without scanning all 6*size² stickers.
  for (let a = Math.max(0, u - 3); a <= Math.min(size - 1, u + 3); a++) {
    for (let b = Math.max(0, v - 3); b <= Math.min(size - 1, v + 3); b++) {
      const distanceSq = (a - u) ** 2 + (b - v) ** 2;
      if (distanceSq < minDistanceSq || distanceSq > 9) continue;
      const tile = { x, y, z, dirKey, [axes[0]]: a, [axes[1]]: b };
      const sticker = cubies[tile.x]?.[tile.y]?.[tile.z]?.stickers[dirKey];
      if (sticker && sticker.curr === sticker.orig && !occupied.has(tileKey(tile))) return tile;
    }
  }
}
// One marked offering at a time; expiration reoffers it near the current face.
// A completed power is not replaced until its effect ends, so elements never
// overwrite an unfinished flight or spring jump. Quest magnet orbs replenish
// only while remote catches are still outstanding.
export function offerStoryPower(sim, p, level, size, cubies) {
  // Required lesson powers always take priority. Later levels can offer one
  // optional cube transformation after those objectives have been served.
  let type = nextStoryPower(p, level);
  const canOfferView = !type && level.id >= 9 && !p.viewOffered;
  const displayedType = sim.specials[0]?.type ?? (sim.rocketActive ? 'rocket' : sim.magnetT > 0 ? 'magnet'
    : sim.viewPowerT > 0 ? sim.viewPower : sim.elementalT > 0 ? sim.elementalType : sim.explodeT > 0 || sim.expansionAmount > 0 ? 'explode' : null);
  const hint = offered => level.mechanics?.elementPickups && STORY_ELEMENTS.includes(offered)
    ? 'Steer onto the marked elemental orb to collect it' : getViewPowerDef(offered)?.description ?? HINTS[offered];
  p.powerHint = displayedType ? hint(displayedType) : null;
  if ((!type && !canOfferView) || sim.specials.length || sim.rocketActive || sim.isJumping || sim.magnetT > 0 || sim.viewPowerT > 0 || sim.elementalT > 0 || sim.explodeT > 0 || sim.expansionAmount > 0 || sim.phase !== 'crawling') return false;
  if ((p.powerDelay ?? STORY_POWER_OPENING_DELAY) > 0) return false;
  const occupied = new Set(sim.powerups.map(tileKey));
  occupied.add(tileKey(sim.pos));
  // A pickup is a deliberate turn, never a surprise on the next straight steps.
  // Follow the surface across seams too, rather than checking one grid axis.
  let ahead = sim.pos, heading = sim.moveDir;
  for (let i = 0; i < 3; i++) {
    ahead = getNextSurfacePosition(ahead, heading, size);
    if (!ahead) break;
    occupied.add(tileKey(ahead)); heading = ahead.moveDir;
  }
  for (let i = 0; i < Math.min(sim.tileTrail.count, Math.ceil(sim.tailLength * BODY_BALL_SPACING)); i++) occupied.add(ttAt(sim.tileTrail, i));
  const tile = storySurfaceTile(sim, size, cubies, occupied);
  if (!tile) return false;
  if (canOfferView) { type = drawViewPower(sim.specialPicker, sim.rand); p.viewOffered = true; }
  sim.specials = [{ ...tile, type, id: `story-${level.id}-${p.powerSeq++}`, ttl: 20, maxTtl: 20 }];
  p.powerDelay = STORY_POWER_COOLDOWN;
  p.powerHint = hint(type);
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
