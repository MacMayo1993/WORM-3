import { drawViewPower, getViewPowerDef } from '../healerWorm/viewPowerups.js';
import { makeGrowthOrb } from '../healerWorm/orbSpawning.js';
import { tileKey } from '../healerWorm/wormSim.js';
import { ttAt } from '../circularBuffers.js';
import { BODY_BALL_SPACING, MAGNET_RADIUS } from '../healerWorm/constants.js';
import { collectManifoldRing, getNextSurfacePosition } from '../wormLogic.js';

export const STORY_ELEMENTS = ['water', 'fire', 'grass', 'ice', 'lightning'];
export const STORY_POWER_OPENING_DELAY = 10;
export const STORY_POWER_COOLDOWN = 3;
export const STORY_POWER_LIFETIME = 20;
// Explode gets an early slot even when a magnet catch or element mastery is
// unfinished. The cursor advances on an offer, not on successful task credit.
const STORY_POWER_CYCLE = ['magnet', 'explode', 'water', 'rocket', 'fire', 'grass', 'ice', 'lightning'];
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
  const needs = new Set();
  for (const [key, type] of [['magnetOrbs', 'magnet'], ['explodes', 'explode'], ['rockets', 'rocket']]) {
    if ((p.mechanics[key] ?? 0) < (m[key] ?? 0)) needs.add(type);
  }
  if ((p.mechanics.elementPickups ?? 0) < (m.elementPickups ?? 0)) {
    for (const type of STORY_ELEMENTS.slice(0, m.elementPickups)) needs.add(type);
  }
  for (const type of STORY_ELEMENTS.slice(0, m.elements ?? 0)) if (!p.elements.has(type)) needs.add(type);
  const last = STORY_POWER_CYCLE.indexOf(p.lastPower);
  for (let offset = 1; offset <= STORY_POWER_CYCLE.length; offset++) {
    const type = STORY_POWER_CYCLE[(last + offset) % STORY_POWER_CYCLE.length];
    if (needs.has(type)) return type;
  }
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
// One marked offering at a time; missed powers return on the next fair cycle.
// A completed power is not replaced until its effect ends, so elements never
// overwrite an unfinished flight or spring jump. Quest magnet orbs replenish
// only while remote catches are still outstanding.
export function offerStoryPower(sim, p, level, size, cubies) {
  // Required lesson powers always take priority. Optional transformations wait
  // until Chapter 2 has taught the alternate views in their authored levels.
  let type = nextStoryPower(p, level);
  const canOfferView = !type && level.id >= 21 && !p.viewOffered;
  const displayedType = sim.specials[0]?.type ?? (sim.rocketActive ? 'rocket' : sim.magnetT > 0 ? 'magnet'
    : sim.viewPowerT > 0 ? sim.viewPower : sim.elementalT > 0 ? sim.elementalType : sim.explodeT > 0 || sim.expansionAmount > 0 ? 'explode' : null);
  const hint = offered => level.mechanics?.elementPickups && STORY_ELEMENTS.includes(offered)
    ? 'Steer onto the marked elemental orb to collect it' : getViewPowerDef(offered)?.description ?? HINTS[offered];
  p.powerHint = displayedType ? hint(displayedType) : null;
  if ((!type && !canOfferView) || sim.specials.length || sim.rocketActive || sim.isJumping || sim.magnetT > 0 || sim.viewPowerT > 0 || sim.elementalT > 0 || sim.explodeT > 0 || sim.expansionAmount > 0 || sim.phase !== 'crawling') return false;
  if ((p.powerDelay ?? STORY_POWER_OPENING_DELAY) > 0) return false;
  const blocked = new Set([tileKey(sim.pos)]);
  if (sim.prevTile) blocked.add(tileKey(sim.prevTile));
  // A pickup is a deliberate turn, never a surprise on the next straight steps.
  // Follow the surface across seams too, rather than checking one grid axis.
  let ahead = sim.pos, heading = sim.moveDir;
  for (let i = 0; i < 3; i++) {
    ahead = getNextSurfacePosition(ahead, heading, size);
    if (!ahead) break;
    blocked.add(tileKey(ahead)); heading = ahead.moveDir;
  }
  for (let i = 0; i < Math.min(sim.tileTrail.count, Math.ceil(sim.tailLength * BODY_BALL_SPACING)); i++) blocked.add(ttAt(sim.tileTrail, i));
  const occupied = new Set([...blocked, ...sim.powerups.map(tileKey)]);
  // A dense food route must not lock out a required power. Trade one ordinary
  // orb's slot if necessary; the normal color refill restores that food later.
  const tile = storySurfaceTile(sim, size, cubies, occupied) ?? (type ? storySurfaceTile(sim, size, cubies, blocked) : null);
  if (!tile) return false;
  if (canOfferView) { type = drawViewPower(sim.specialPicker, sim.rand); p.viewOffered = true; }
  sim.powerups = sim.powerups.filter(orb => tileKey(orb) !== tileKey(tile));
  sim.specials = [{ ...tile, type, id: `story-${level.id}-${p.powerSeq++}`, ttl: STORY_POWER_LIFETIME, maxTtl: STORY_POWER_LIFETIME }];
  p.lastPower = type;
  p.powerDelay = STORY_POWER_COOLDOWN;
  p.powerHint = hint(type);
  if (type === 'magnet') {
    // Reuse nearby food first and replace leftover support from earlier offers.
    // This caps the bonus at four instead of adding four on every missed magnet.
    sim.powerups = sim.powerups.filter(orb => !orb.storyMagnet);
    const reach = collectManifoldRing(tile.x, tile.y, tile.z, tile.dirKey, size, MAGNET_RADIUS);
    reach.delete(tileKey(tile));
    const food = new Set(sim.powerups.map(tileKey));
    const goal = Math.min(4, level.mechanics.magnetOrbs - (p.mechanics.magnetOrbs ?? 0));
    let available = [...food].filter(key => reach.has(key) && !blocked.has(key)).length;
    for (const key of reach) {
      if (available >= goal) break;
      if (blocked.has(key) || food.has(key)) continue;
      const [x, y, z, dirKey] = key.split(',');
      const nearby = { x: Number(x), y: Number(y), z: Number(z), dirKey };
      const sticker = cubies[x]?.[y]?.[z]?.stickers[dirKey];
      if (!sticker || sticker.curr !== sticker.orig) continue;
      sim.powerups.push(makeGrowthOrb(nearby, { storyMagnet: true }));
      available++;
    }
  }
  return true;
}
