import { hasElement, getFusion, fusionRecipeLabel } from '../healerWorm/elementalFusion.js';
import { drawViewPower, getViewPowerDef } from '../healerWorm/viewPowerups.js';
import { makeGrowthOrb } from '../healerWorm/orbSpawning.js';
import { tileKey } from '../healerWorm/wormSim.js';
import { ttAt } from '../circularBuffers.js';
import { BODY_BALL_SPACING, MAGNET_RADIUS, WORM_MOVEMENT_SPEED_SCALE, ELEMENTAL_DURATION } from '../healerWorm/constants.js';
import { collectManifoldRing, getNextSurfacePosition } from '../wormLogic.js';

export const STORY_ELEMENTS = ['water', 'fire', 'grass', 'ice', 'lightning'];
// Identity goals name a prefix, so unrelated pickups/mastery cannot substitute
// for a missing authored element. Keep raw sets for effects and pickup history.
export const storyElementCount = (elements, target = STORY_ELEMENTS.length) =>
  STORY_ELEMENTS.slice(0, target).filter(type => elements.has(type)).length;
const storyElementPool = level => {
  const m = level.mechanics ?? {};
  const count = Math.max(m.uniqueElements ?? 0, m.elements ?? 0, m.elementPickups ?? 0);
  return count ? STORY_ELEMENTS.slice(0, count) : STORY_ELEMENTS;
};
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
export const STORY_FUSION_GOALS = { steamFusions: getFusion('water', 'fire'), quenchFusions: getFusion('fire', 'water') };
const pendingFusions = (p, level) => Object.entries(STORY_FUSION_GOALS).filter(([key]) => (p.mechanics[key] ?? 0) < (level.mechanics?.[key] ?? 0)).map(([, recipe]) => recipe);
const add = (p, key) => { p.mechanics[key] = (p.mechanics[key] ?? 0) + 1; };

// Events originate after a successful pickup/disarm/heal, never from button input.
export function recordStoryMechanic(practice, key, id) {
  if (practice && key === 'elementFusion') {
    const goal = Object.keys(STORY_FUSION_GOALS).find(k => STORY_FUSION_GOALS[k].id === id);
    if (goal) add(practice, goal);
    return;
  }
  if (practice && key === 'grassLaunch') { practice.grassJump = true; return; }
  if (!practice || !['ringHeals', 'magnetOrbs', 'bombs', 'elementPickups'].includes(key)) return;
  // Pickup variety is separate from elemental mastery actions. Repeated
  // pickups still count toward quantity quests, but each element counts once.
  if (key === 'elementPickups' && STORY_ELEMENTS.includes(id)) practice.collectedElements.add(id);
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
    if (hasElement(sim, 'ice')) p.iceJump = true;
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
  p.elementTimes ??= {};
  for (const type of STORY_ELEMENTS) {
    if (!hasElement(sim, type)) { p.elementTimes[type] = 0; continue; }
    if (sim.elementalFocusT > 0 || sim.phase !== 'crawling') continue;
    const time = p.elementTimes[type] = (p.elementTimes[type] ?? 0) + Math.min(Math.max(delta, 0), 0.1);
    if (type === 'water' && time >= 3 && sim.waterMomentum > 0.75) p.elements.add('water');
    if (type === 'fire' && time >= 3 && [...sim.elementalPatches.values()].some(patch => patch.type === 'fire')) p.elements.add('fire');
    if (type === 'lightning' && time >= 4) p.elements.add('lightning');
  }
}
export function nextStoryPower(p, level) {
  const m = level.mechanics;
  if (!m) return null;
  const needs = new Set();
  for (const recipe of pendingFusions(p, level)) { needs.add(recipe.base); needs.add(recipe.catalyst); }
  for (const [key, type] of [['magnetOrbs', 'magnet'], ['explodes', 'explode'], ['rockets', 'rocket']]) {
    if ((p.mechanics[key] ?? 0) < (m[key] ?? 0)) needs.add(type);
  }
  if ((p.mechanics.elementPickups ?? 0) < (m.elementPickups ?? 0)) {
    for (const type of STORY_ELEMENTS.slice(0, m.elementPickups)) needs.add(type);
  }
  for (const type of STORY_ELEMENTS.slice(0, m.uniqueElements ?? 0)) if (!p.collectedElements.has(type)) needs.add(type);
  for (const type of STORY_ELEMENTS.slice(0, m.elements ?? 0)) if (!p.elements.has(type)) needs.add(type);
  const last = STORY_POWER_CYCLE.indexOf(p.lastPower);
  for (let offset = 1; offset <= STORY_POWER_CYCLE.length; offset++) {
    const type = STORY_POWER_CYCLE[(last + offset) % STORY_POWER_CYCLE.length];
    if (needs.has(type)) return type;
  }
  return null;
}
export function storySurfaceTile(sim, size, cubies, occupied = new Set(), reachable = null) {
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
      if (sticker && sticker.curr === sticker.orig && !occupied.has(tileKey(tile)) && (!reachable || reachable.has(tileKey(tile)))) return tile;
    }
  }
}
// A partner must have a short surface route around current body/tunnel obstacles.
// Keep two steps of reaction time and cap the search at six steps. Food is safe
// to cross; a dense food route can still trade a slot for the required catalyst.
export function fusionReachableTiles(sim, size, cubies, speed) {
  const steps = Math.min(6, Math.max(0, Math.floor(sim.elementalT * speed * WORM_MOVEMENT_SPEED_SCALE) - 2));
  const body = new Set();
  for (let i = 0; i < Math.min(sim.tileTrail.count, Math.ceil(sim.tailLength * BODY_BALL_SPACING)); i++) body.add(ttAt(sim.tileTrail, i));
  const reachable = new Set([tileKey(sim.pos)]), queue = [{ tile: sim.pos, depth: 0 }];
  for (let i = 0; i < queue.length; i++) {
    const { tile, depth } = queue[i];
    if (depth >= steps) continue;
    for (const direction of ['up', 'right', 'down', 'left']) {
      const next = getNextSurfacePosition(tile, direction, size);
      if (!next) continue;
      const key = tileKey(next), sticker = cubies[next.x]?.[next.y]?.[next.z]?.stickers[next.dirKey];
      if (!sticker || sticker.curr !== sticker.orig || body.has(key) || reachable.has(key)) continue;
      reachable.add(key); queue.push({ tile: next, depth: depth + 1 });
    }
  }
  return reachable;
}

// Later levels offer two distinct elements together for optional fusion practice.
// Authored fusion lessons retain their ordered, timed catalyst guidance. Other
// powers wait for the current effect to end; missed powers return next cycle.
export function offerStoryPower(sim, p, level, size, cubies) {
  // Required lesson powers always take priority. Optional transformations wait
  // until Chapter 2 has taught the alternate views in their authored levels.
  const recipes = pendingFusions(p, level);
  // A catalyst is the only exception to the normal one-power-at-a-time rule.
  // It belongs to this wash and expires with it, so a missed partner cannot
  // silently become the first half of a different recipe.
  const partnerRecipe = sim.elementalT >= 3
    ? recipes.find(recipe => recipe.base === sim.elementalType) : null;
  if (sim.specials.some(orb => orb.fusionBase &&
      (!(sim.elementalT > 0) || orb.fusionBase !== sim.elementalType))) {
    sim.specials = sim.specials.filter(orb => !orb.fusionBase);
    p.powerDelay = STORY_POWER_COOLDOWN;
    // Publish the removal through the same bridge as a new offer.
    p.powerHint = 'Fusion window ended. Follow the next marked base orb to try again.';
    return true;
  }
  let type = partnerRecipe?.catalyst ?? nextStoryPower(p, level);
  const elementPool = storyElementPool(level);
  const canOfferView = !type && level.id >= 21 && !p.viewOffered;
  if (!type && !canOfferView && level.id >= 21) {
    type = elementPool[(elementPool.indexOf(p.lastPower) + 1) % elementPool.length];
  }
  const displayedType = sim.specials[0]?.type ?? (sim.rocketActive ? 'rocket' : sim.magnetT > 0 ? 'magnet'
    : sim.viewPowerT > 0 ? sim.viewPower : sim.elementalT > 0 ? sim.elementalType : sim.explodeT > 0 || sim.expansionAmount > 0 ? 'explode' : null);
  const hint = offered => {
    const recipe = partnerRecipe ?? recipes.find(r => r.base === offered);
    if (recipe) return `${fusionRecipeLabel(recipe)} · ${partnerRecipe ? 'Collect the marked partner before the timer ends.' : 'Collect the first element, then follow the marked partner.'}`;
    if (sim.specials.length > 1 && STORY_ELEMENTS.includes(offered)) return 'Two elements are available. Collect both before the first effect ends to fuse them; pickup order changes the result.';
    return (level.mechanics?.elementPickups || level.mechanics?.uniqueElements) && STORY_ELEMENTS.includes(offered)
    ? 'Steer onto the marked elemental orb to collect it' : getViewPowerDef(offered)?.description ?? HINTS[offered];
  };
  p.powerHint = displayedType ? hint(displayedType) : null;
  if ((!type && !canOfferView) || sim.specials.length || sim.rocketActive || sim.isJumping || sim.magnetT > 0 || sim.viewPowerT > 0 || (sim.elementalT > 0 && !partnerRecipe) || sim.elementalFocusT > 0 || sim.explodeT > 0 || sim.expansionAmount > 0 || sim.phase !== 'crawling') return false;
  if (!partnerRecipe && (p.powerDelay ?? STORY_POWER_OPENING_DELAY) > 0) return false;
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
  const reachable = partnerRecipe ? fusionReachableTiles(sim, size, cubies, level.speed) : null;
  const tile = storySurfaceTile(sim, size, cubies, occupied, reachable) ?? (type ? storySurfaceTile(sim, size, cubies, blocked, reachable) : null);
  if (!tile) return false;
  if (canOfferView) { type = drawViewPower(sim.specialPicker, sim.rand); p.viewOffered = true; }
  sim.powerups = sim.powerups.filter(orb => tileKey(orb) !== tileKey(tile));
  const lifetime = partnerRecipe ? sim.elementalT : STORY_POWER_LIFETIME;
  sim.specials = [{ ...tile, type, id: `story-${level.id}-${p.powerSeq++}`, ttl: lifetime, maxTtl: lifetime,
    ...(partnerRecipe ? { fusionBase: partnerRecipe.base } : {}) }];
  if (level.id >= 21 && !recipes.length && STORY_ELEMENTS.includes(type)) {
    const next = nextStoryPower({ ...p, lastPower: type }, level);
    const second = elementPool.includes(next) && next !== type ? next
      : elementPool.find(element => element !== type);
    const pairBlocked = new Set([...blocked, tileKey(tile)]);
    const pairReachable = fusionReachableTiles({ ...sim, pos: tile, elementalT: ELEMENTAL_DURATION }, size, cubies, level.speed);
    const secondTile = storySurfaceTile(sim, size, cubies, new Set([...pairBlocked, ...sim.powerups.map(tileKey)]), pairReachable)
      ?? storySurfaceTile(sim, size, cubies, pairBlocked, pairReachable);
    if (second && secondTile) {
      sim.powerups = sim.powerups.filter(orb => tileKey(orb) !== tileKey(secondTile));
      sim.specials.push({ ...secondTile, type: second, id: `story-${level.id}-${p.powerSeq++}`, ttl: lifetime, maxTtl: lifetime });
    }
  }
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
