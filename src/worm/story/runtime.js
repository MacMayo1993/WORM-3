import { makeGrowthOrb } from '../healerWorm/orbSpawning.js';
import { getAllSurfaceTiles, randomUnflippedTile } from '../healerWorm/surfaceTiles.js';
import { updateMastery, storyElementCount, STORY_POWER_OPENING_DELAY } from './mastery.js';
import { rollStoryElements, storyElementTypes } from './elementGoals.js';
import { STORY_DOUBLE_HEAL_WINDOW } from '../healerWorm/healChain.js';
import { stageWormPractice } from '../healerWorm/demoPractice.js';
import { flipStickerPair, canFlipStickerPair, buildManifoldGridMap, findAntipodalStickerByGrid } from '../../game/manifoldLogic.js';
import { ttAt, ttReset } from '../circularBuffers.js';
import { getStickerWorldPos, getManifoldGridId } from '../../game/coordinates.js';
import { BODY_BALL_SPACING } from '../healerWorm/constants.js';
import { getActiveTunnels, getStableKey, findStickerByStableKey } from '../wormLogic.js';
import { liveRotation } from '../liveRotation.js';
import { tileKey } from '../healerWorm/wormSim.js';
import { STORY_WORLDS, STORY_ORB_ROUTES } from './worlds.js';
import { BODY_JUMP_PATH, seedPracticeBody, trackPracticeBodyJump } from '../healerWorm/bodyJumpPractice.js';

const MOUTHS = [[1,2,4,'PZ'], [4,2,1,'PX'], [1,4,2,'PY'], [3,2,4,'PZ'], [4,2,3,'PX'], [3,4,2,'PY']];
// Smallest board the authored 5×5 templates fit. Below it, trails, mouths and
// routes are generated to the face instead of shifted off its edge.
const TEMPLATE_SIZE = 5;
export const STORY_ORB_REFILL_INTERVAL = 0.75;

// The head arrives on the middle tile of the spawn face (PZ), heading up, with
// its body straight down the column behind it, so it comes out of the portal
// and carries straight on. Older trail turns along row 0, so a growing tail
// still has a path. Jump lessons keep their start on row 0 with the body laid
// across the head's column: jumping it is the lesson.
// A 2×2 face has no middle: its head keeps the bottom row and steering room,
// with the body laid along that row.
export const storyStartTile = size => [Math.floor(size / 2), Math.floor((size - 1) / 2)];

// Face-local (u, v) on PZ, in board coordinates, head first.
export function storyBodyPath(size, level) {
  const c = Math.floor(size / 2);
  if (level.kind === 'jump') {
    if (size >= TEMPLATE_SIZE) return BODY_JUMP_PATH.map(([x, y]) => [x + c - 2, y]);
    // Lay the body across the head's column on the far row: a small face has
    // no room to spare, and a nearer crossing arrives before the first jump can.
    const path = [[c, 0]];
    for (let x = c - 1; x >= 0; x--) path.push([x, 0]);
    const row = size - 1;
    for (let y = 1; y <= row; y++) path.push([0, y]);
    for (let x = 1; x < size; x++) path.push([x, row]);
    return path;
  }
  const [, m] = storyStartTile(size);
  const path = [];
  for (let v = m; v >= 0; v--) path.push([c, v]);
  for (let u = c - 1; u >= 0; u--) path.push([u, 0]);
  return path;
}

// On a double-heal level the pairs that open together must be close at both
// ends: two mouths a step apart on one face have twins a step apart on the
// opposite face, so riding out of one lands beside the other. Keep the first
// mouth of each pair and bring its nearest same-face mouth up beside it; a
// mouth with no partner on its face waits until every pair is placed.
function pairNearby(mouths) {
  const out = [], single = [], rest = mouths.slice();
  while (rest.length) {
    const a = rest.shift();
    let best = -1, bestDistance = Infinity;
    rest.forEach((b, i) => {
      if (b[3] !== a[3]) return;
      const distance = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
      if (distance < bestDistance) { bestDistance = distance; best = i; }
    });
    if (best >= 0) out.push(a, rest.splice(best, 1)[0]);
    else single.push(a);
  }
  return out.concat(single);
}

// Tunnel mouths live on the three positive faces; their twins land on the
// negative faces, so no two mouths can share a pair.
export function storyMouths(size, count, levelId = 1, { chain = false } = {}) {
  // Rotate the safe authored candidates per level; retries keep the same layout.
  const offsetIndex = Math.max(0, levelId - 1) % MOUTHS.length;
  const pick = candidates => {
    const rotated = candidates.slice(offsetIndex).concat(candidates.slice(0, offsetIndex));
    return (chain ? pairNearby(rotated) : rotated).slice(0, count);
  };
  if (size >= TEMPLATE_SIZE) {
    const edge = size - 1, offset = Math.floor(size / 2) - 2;
    // Spawn-face mouths sit on the row behind the head's start tile, either side
    // of its column: never beside the start, never on the body's column or row 0.
    const row = storyStartTile(size)[1] - 1;
    return pick(MOUTHS.map(([x, y, z, dir]) => [
      dir === 'PX' ? edge : x + offset, dir === 'PY' ? edge : dir === 'PZ' ? row : y + offset, dir === 'PZ' ? edge : z + offset, dir]));
  }
  return pick(smallBoardMouths(size, Math.max(count, MOUTHS.length)));
}

// Small boards (below the 5×5 templates). Mouths used to go on the face corners, and
// on a 3×3 or 4×4 the first three all landed on ONE corner cubie with their twins on
// the opposite one: the two pairs open together for a double heal sat on the same
// raised corner piece, so riding out of one dropped the worm beside the other's twin
// on a neighbouring face of the same piece, a corner jump that had to be planned to
// the tile. Now a mouth prefers a tile whose cubie shows one face (it rises straight
// out and can be met from four sides), then an edge piece, and only then a corner;
// no two mouths, and no mouth and another's twin, share a cubie; and the faces take
// turns so consecutive pairs sit on different faces.
function smallBoardMouths(size, count) {
  const edge = size - 1, c = Math.floor(size / 2);
  // The spawn face keeps the head's column, its first row and the body trail open.
  const body = new Set(storyBodyPath(size, { kind: 'tunnel', id: 0 }).map(([u, v]) => `${u},${v}`));
  const start = storyStartTile(size);
  const outer = t => (t === 0 || t === edge ? 1 : 0);
  const rank = ([u, v]) => outer(u) + outer(v);   // 0 face piece, 1 edge piece, 2 corner
  const centre = ([u, v]) => Math.abs(u - edge / 2) + Math.abs(v - edge / 2);
  const cells = dir => {
    const out = [];
    for (let u = 0; u < size; u++) for (let v = 0; v < size; v++) {
      if (dir === 'PZ' && (u === c || u === 0 || v === 0 || body.has(`${u},${v}`) ||
        Math.abs(u - start[0]) + Math.abs(v - start[1]) <= 1)) continue;
      out.push([u, v]);
    }
    return out.sort((a, b) => rank(a) - rank(b) || centre(a) - centre(b) || a[0] - b[0] || a[1] - b[1]);
  };
  const at = (dir, [u, v]) => (dir === 'PX' ? [edge, u, v, dir] : dir === 'PY' ? [u, edge, v, dir] : [u, v, edge, dir]);
  // Interleave the faces within each tier, so the easiest tiles of every face go first.
  const queues = { PX: cells('PX'), PY: cells('PY'), PZ: cells('PZ') };
  const candidates = [];
  for (let tier = 0; tier <= 2; tier++) {
    const tiers = Object.fromEntries(Object.entries(queues).map(([dir, list]) => [dir, list.filter(cell => rank(cell) === tier)]));
    const longest = Math.max(...Object.values(tiers).map(list => list.length));
    for (let i = 0; i < longest; i++) for (const dir of ['PX', 'PY', 'PZ']) if (tiers[dir][i]) candidates.push(at(dir, tiers[dir][i]));
  }
  const cubie = (x, y, z) => `${x},${y},${z}`;
  const mouths = [], chosen = new Set(), used = new Set();
  // First pass: every mouth and every twin on a cubie of its own. A tiny board that
  // runs out falls back to sharing cubies rather than offering fewer pairs.
  for (const strict of [true, false]) {
    for (const mouth of candidates) {
      if (mouths.length >= count) break;
      const [x, y, z, dir] = mouth;
      const key = `${x},${y},${z},${dir}`;
      const own = cubie(x, y, z), twin = cubie(edge - x, edge - y, edge - z);
      if (chosen.has(key) || (strict && (used.has(own) || used.has(twin)))) continue;
      chosen.add(key);
      used.add(own); used.add(twin);
      mouths.push(mouth);
    }
  }
  return mouths;
}

// Route cells are authored on a 5×5 footprint. Larger boards center them;
// smaller ones scale them onto the face.
const routeCell = (size, [u, v]) => {
  if (size >= TEMPLATE_SIZE) { const offset = Math.floor(size / 2) - 2; return [u + offset, v + offset]; }
  return [Math.round(u * (size - 1) / 4), Math.round(v * (size - 1) / 4)];
};

export function stageStory(sim, size, level) {
  const base = stageWormPractice(sim, size, { id: 'steer' });
  const edge = size - 1;
  const pairCount = Math.max(['tunnel', 'collector', 'restore', 'mastery'].includes(level.kind) ? level.target : 0,
    level.mechanics?.ringHeals ?? 0, level.mechanics?.selfPasses || level.mechanics?.multiHeals ? 2 : 0);
  const mouths = storyMouths(size, pairCount, level.id, { chain: !!level.mechanics?.multiHeals });
  const mouthKeys = mouths.map(([x,y,z,dir]) => getStableKey(x,y,z,dir,base.cubies));
  const pendingMouths = mouthKeys.slice(2);
  const tunnelGoals = Object.fromEntries(['selfPasses', 'multiHeals', 'ringHeals']
    .filter(key => level.mechanics?.[key]).map(key => [key, level.mechanics[key]]));
  // Reserve future mouths from food placement without opening the whole network.
  let reserved = base.cubies;
  for (const [i, [x,y,z,dir]] of mouths.entries()) {
    reserved = flipStickerPair(reserved, size, x,y,z,dir,buildManifoldGridMap(reserved,size));
    if (i < 2) base.cubies = reserved;
  }
  const body = storyBodyPath(size, level);
  const bodyKeys = new Set(body.map(([x, y]) => `${x},${y},${edge},PZ`));
  // Every level includes matching healing resources on all six faces.
  // Route-trial pairs can seal after traversal without losing their recorded credit.
  sim.powerups = [];
  const cells = STORY_ORB_ROUTES[STORY_WORLDS[level.id].route];
  const density = size <= 3 ? (size === 2 ? 2 : 4) : Math.min(10, Math.ceil(size * size * 0.3));
  const orbsPerFace = Math.min(10, Math.max(level.orbsPerFace ?? cells.length, density, level.mechanics?.ringHeals ? 6 : 0));
  for (const dirKey of ['PZ', 'NZ', 'PX', 'NX', 'PY', 'NY']) {
    // A tunnel may occupy a route tile. Fill locally with distinct safe cells
    // to retain the full matching-color supply on every face.
    const fallback = Array.from({ length: size * size }, (_, i) => [i % size, Math.floor(i / size)]);
    const used = new Set();
    for (const [a, b] of [...cells.map(cell => routeCell(size, cell)), ...fallback]) {
      if (used.size >= orbsPerFace) break;
      const key = `${a},${b}`;
      if (used.has(key)) continue;
      const [x, y, z] = dirKey === 'PZ' || dirKey === 'NZ' ? [a, b, dirKey === 'PZ' ? edge : 0]
        : dirKey === 'PX' || dirKey === 'NX' ? [dirKey === 'PX' ? edge : 0, a, b] : [a, dirKey === 'PY' ? edge : 0, b];
      const sticker = base.cubies[x][y][z].stickers[dirKey];
      const tile = { x, y, z, dirKey };
      if (reserved[x][y][z].stickers[dirKey].curr === sticker.orig && tileKey(tile) !== tileKey(sim.pos) && !bodyKeys.has(tileKey(tile))) {
        used.add(key);
        sim.powerups.push(makeGrowthOrb(tile));
      }
    }
  }
  seedPracticeBody(sim, size, body);
  // The head starts where the trail does (the middle tile, or row 0 for a jump lesson).
  sim.pos = { x: body[0][0], y: body[0][1], z: edge, dirKey: 'PZ' };
  sim.moveDir = 'up';
  sim._curWP.fromArray(getStickerWorldPos(sim.pos.x, sim.pos.y, sim.pos.z, 'PZ', size, 0));
  sim.headInterpPos.copy(sim._curWP);
  ttReset(sim.pathHistory, tileKey(sim.pos));
  sim.peakTailLength = sim.tailLength;
  if (level.kind === 'jump') {
    const row = size >= TEMPLATE_SIZE ? 2 : size - 1;
    base.target = { x: Math.floor(size / 2), y: row, z: edge, dirKey: 'PZ' };
  }
  if (level.kind === 'tunnel') base.target = getActiveTunnels(base.cubies, size)[0]?.entry ?? null;
  // Mini stages need empty routes as well as food: never fill almost every remaining
  // tile on the pocket cube.
  const pickupBudget = size <= 3 ? Math.floor(6 * size * size * 0.6) : Infinity;
  const targetCount = Math.min(sim.powerups.length, pickupBudget);
  const reservedMouths = getActiveTunnels(reserved, size).flatMap(tunnel => [tunnel.entry, tunnel.exit]);
  while (sim.powerups.length < targetCount) {
    const tile = randomUnflippedTile(base.cubies, size, [...sim.powerups, sim.pos, ...reservedMouths, ...body.map(([x, y]) => ({ x, y, z: edge, dirKey: 'PZ' }))]);
    if (!tile) break;
    sim.powerups.push(makeGrowthOrb(tile));
  }
  sim.specials = [];
  // Preserve the staged density by sticker color,
  // so a layer turn cannot strand a depleted healing color on another face.
  const orbTargets = {};
  for (const orb of sim.powerups) {
    const color = base.cubies[orb.x][orb.y][orb.z].stickers[orb.dirKey].orig;
    orbTargets[color] = (orbTargets[color] ?? 0) + 1;
  }
  // Double-heal levels let the next pair open while a heal still rides in the body,
  // so heals can chain (see replenishStoryTunnel).
  const chainHeals = !!level.mechanics?.multiHeals;
  const practice = { ...base, pendingMouths, retryMouths: mouthKeys.slice(0, 2), tunnelGoals, chainHeals, orbTargets, orbRefillDelay: STORY_ORB_REFILL_INTERVAL,
    healTarget: ['collector', 'restore', 'mastery'].includes(level.kind) ? level.target : null,
    traversalTarget: level.kind === 'tunnel' ? level.target : null,
    elapsed: 0, peakLength: Math.floor(sim.tailLength), powerDelay: STORY_POWER_OPENING_DELAY, elementSupplyDelay: STORY_POWER_OPENING_DELAY, elementSupplyCursor: 0, powerHint: null, lastPower: null, lastElementCompanion: null,
    cuts: 0, wasCut: false, airborne: false, crossedThisJump: false, exploding: false,
    bodyJumps: 0, colors: new Set(), tunnels: new Set(), pendingTunnel: null, mechanics: {}, elements: new Set(), collectedElements: new Set(), fusionIds: new Set(), elementTimes: {}, powerSeq: 0, bombIds: new Set(),
    // Dealt afresh on every attempt, so a retry or replay meets different elements
    // and the bonus lane opens on a different power.
    elementOrder: rollStoryElements(level, sim.rand ?? Math.random), bonusIndex: Math.floor((sim.rand ?? Math.random)() * 6) };
  return practice;
}

// Restore at most one orb of each missing color per pulse, throughout the run.
// No fallback onto occupied tiles: a crowded face retries on the next pulse.
export function replenishStoryOrbs(sim, practice, state, size, delta) {
  if (!sim.alive || state.wormPaused || sim.phase !== 'crawling' || sim.tunnelPassages.length ||
      sim.healPauseT > 0 || sim.cutFocusT > 0 || sim.jumpRescueHeld || sim.elementalFocusT > 0 ||
      state.animState || liveRotation.active) return false;
  practice.orbRefillDelay -= Math.min(Math.max(delta, 0), 0.1);
  if (practice.orbRefillDelay > 0) return false;
  practice.orbRefillDelay = STORY_ORB_REFILL_INTERVAL;

  const { cubies } = state;
  const counts = {};
  const occupied = new Set([...sim.powerups, ...sim.specials].map(tileKey));
  occupied.add(tileKey(sim.pos));
  if (sim.prevTile) occupied.add(tileKey(sim.prevTile));
  for (let i = 0; i < Math.min(sim.tileTrail.count, Math.ceil(sim.tailLength * BODY_BALL_SPACING)); i++) occupied.add(ttAt(sim.tileTrail, i));
  for (const orb of sim.powerups) {
    const color = cubies[orb.x][orb.y][orb.z].stickers[orb.dirKey].orig;
    counts[color] = (counts[color] ?? 0) + 1;
  }
  // Reserve both ends of future tunnels at their current, rotated locations.
  if (practice.pendingMouths.length) {
    const map = buildManifoldGridMap(cubies, size);
    for (const key of practice.pendingMouths) {
      const mouth = findStickerByStableKey(cubies, size, key, map);
      if (!mouth) continue;
      occupied.add(tileKey(mouth));
      const twin = findAntipodalStickerByGrid(map, cubies[mouth.x][mouth.y][mouth.z].stickers[mouth.dirKey], size);
      if (twin) occupied.add(tileKey(twin));
    }
  }
  const candidates = {};
  for (const tile of getAllSurfaceTiles(size)) {
    const sticker = cubies[tile.x][tile.y][tile.z].stickers[tile.dirKey];
    if (sticker.curr !== sticker.orig || occupied.has(tileKey(tile)) ||
        (counts[sticker.orig] ?? 0) >= practice.orbTargets[sticker.orig]) continue;
    (candidates[sticker.orig] ??= []).push(tile);
  }
  let added = false;
  for (const tiles of Object.values(candidates)) {
    const tile = tiles[Math.floor(sim.rand() * tiles.length)];
    sim.powerups.push(makeGrowthOrb(tile));
    added = true;
  }
  return added;
}

// Queued mouths supply repair/chain goals; they are not holes in the cube yet.
// Once that work is earned, do not require extra repairs just because an unused
// mouth is waiting under food or the body. Traversal levels still need their
// distinct pairs, and already-open pairs still count until actually healed.
function storyTunnelSupplyComplete(sim, practice) {
  return (practice.healTarget != null || practice.traversalTarget != null || Object.keys(practice.tunnelGoals ?? {}).length > 0) &&
    (practice.healTarget == null || sim.healed >= practice.healTarget) &&
    (practice.traversalTarget == null || practice.tunnels.size >= practice.traversalTarget) &&
    Object.entries(practice.tunnelGoals ?? {}).every(([key, target]) => (practice.mechanics[key] ?? 0) >= target);
}

export function storyMetrics(sim, practice, level, state, activeTunnels, delta) {
  practice.elapsed += Math.min(Math.max(delta, 0), 0.1);
  const cutting = sim.cutFocusT > 0;
  if (cutting && !practice.wasCut) practice.cuts++;
  practice.wasCut = cutting;
  practice.peakLength = Math.max(practice.peakLength ?? 0, Math.floor(sim.tailLength), Math.floor(sim.peakTailLength ?? 0));
  if (level.kind === 'jump' || level.mechanics?.bodyJumps) trackPracticeBodyJump(sim, practice, state.size);
  updateMastery(sim, practice, level, delta);
  const needsDoubleHeal = (practice.mechanics.multiHeals ?? 0) < (level.mechanics?.multiHeals ?? 0);
  const chainHint = needsDoubleHeal ? sim.healChain?.remaining > 0
    ? `Double heal: seal another pair within ${Math.ceil(sim.healChain.remaining)}s of surface time. Tunnel travel pauses the clock.`
    : `Double heal: heal two different pairs within ${STORY_DOUBLE_HEAL_WINDOW}s of surface time.` : null;
  return {
    ...practice.mechanics,
    elements: storyElementCount(practice.elements, level.mechanics?.elements, storyElementTypes(level, practice.elementOrder)),
    uniqueElements: storyElementCount(practice.collectedElements, level.mechanics?.uniqueElements, storyElementTypes(level, practice.elementOrder)),
    elementOrder: practice.elementOrder,
    uniqueFusions: practice.fusionIds?.size ?? 0,
    powerHint: [chainHint, practice.powerHint].filter(Boolean).join(' · ') || null, kills: sim.combat?.kills ?? 0,
    alive: sim.alive, elapsed: practice.elapsed, cuts: practice.cuts, peakLength: practice.peakLength,
    // The size goal is the longest body reached this run; deposits shrink the
    // worm afterwards without taking the credit back.
    bodyLength: practice.peakLength, currentLength: Math.floor(sim.tailLength),
    orbs: state.wormSessionOrbs, colors: practice.colors.size, healed: sim.healed, uniqueTunnels: practice.tunnels.size,
    onSurface: sim.phase === 'crawling', healSettled: sim.healPauseT <= 0,
    tailClear: sim.phase === 'crawling' && sim.tunnelPassages.length === 0 && sim.healPauseT <= 0,
    nextTarget: level.kind === 'tunnel' ? (activeTunnels.find(record => !practice.tunnels.has(record.tunnel.pairId)) ??
      (Object.entries(practice.tunnelGoals ?? {}).some(([key, target]) => (practice.mechanics[key] ?? 0) < target) ? activeTunnels[0] : null))?.tunnel.entry ?? null : null,
    bodyJumps: practice.bodyJumps, landed: !sim.isJumping && sim.phase === 'crawling',
    rotations: state.rotationEpoch - practice.rotationEpoch,
    rotationSettled: !state.animState && !liveRotation.active,
    remaining: activeTunnels.length + (storyTunnelSupplyComplete(sim, practice) ? 0 : (practice.pendingMouths?.length ?? 0)),
  };
}

// Introduce one replacement only after the previous tail clears. Stable sticker
// identities follow cube rotations; never open a mouth under the body or a pickup.
//
// A double-heal level is the exception: there the next pair opens as soon as a pair
// has sealed, even while another heal is still riding in the body. With the old rule
// two pairs had to be spent on every double heal (the next pair could not open until
// the second tail had cleared), so a level could never earn more than one per two
// pairs, several late levels asked for more than that, and the rest allowed no
// mistakes. Chained, P pairs allow up to P - 1 double heals, and storyNarrative's
// supply test keeps every level at least one short of that.
export function storyTunnelPassagesBlock(sim, practice) {
  if (!sim.tunnelPassages.length) return false;
  return !(practice.chainHeals && sim.tunnelPassages.every(passage => passage?.heal));
}

export function replenishStoryTunnel(sim, practice, state, size, activeCount = getActiveTunnels(state.cubies,size).length) {
  // A tunnel worn out by its third ride is a pair of pits now (tunnelPits.js), not an
  // open pair to ride: it must not hold one of the two slots, or two of them would
  // stop the level supplying tunnels at all. Its mouths stay flipped, so openPair
  // below never reopens them; a surround mends them.
  const open = Math.max(0, activeCount - sim.voidTunnelKeys.size);
  if (storyTunnelSupplyComplete(sim, practice)) {
    if (practice.pendingMouths?.length) practice.pendingMouths.length = 0;
    return null;
  }
  if (!sim.alive || state.wormPaused || sim.phase !== 'crawling' || storyTunnelPassagesBlock(sim, practice) ||
      sim.healPauseT > 0 || sim.cutFocusT > 0 || sim.jumpRescueHeld || sim.elementalFocusT > 0 ||
      state.animState || liveRotation.active || open >= 2) return null;
  // A missed chain must not consume the last chance to finish. Reuse the first
  // two stable pairs only after the authored network AND every tail route clear.
  // Pending mouths reserve both endpoints from future food refills; placement
  // below still waits for existing pickups and the body to leave safely.
  if (!practice.pendingMouths?.length && open === 0 && !sim.tunnelPassages.length &&
      Object.entries(practice.tunnelGoals ?? {}).some(([key, target]) => (practice.mechanics[key] ?? 0) < target)) {
    practice.pendingMouths = [...(practice.retryMouths ?? [])];
  }
  // Every unfinished tunnel qualifier needs renewable attempts. Crossing goals
  // additionally need new identities: reopening an already-crossed pair cannot
  // advance them, even when a surround used up the original unvisited network.
  const needsTraversal = practice.traversalTarget != null && practice.tunnels.size < practice.traversalTarget;
  const needsSupply = (practice.healTarget != null && sim.healed < practice.healTarget) || needsTraversal ||
    Object.entries(practice.tunnelGoals ?? {}).some(([key, target]) => (practice.mechanics[key] ?? 0) < target);
  if (!practice.pendingMouths?.length && !needsSupply) return null;
  if (!practice.pendingMouths?.length && open === 0 && sim.tunnelPassages.length) return null;
  const map = buildManifoldGridMap(state.cubies, size);
  const occupied = new Set([...sim.powerups, ...sim.specials].map(tileKey));
  occupied.add(tileKey(sim.pos));
  if (sim.prevTile) occupied.add(tileKey(sim.prevTile));
  for (let i=0; i<Math.min(sim.tileTrail.count, Math.ceil(sim.tailLength * BODY_BALL_SPACING)); i++) occupied.add(ttAt(sim.tileTrail,i));
  const openPair = pos => {
    if (!pos || occupied.has(tileKey(pos))) return null;
    const sticker = state.cubies[pos.x][pos.y][pos.z].stickers[pos.dirKey];
    const twin = findAntipodalStickerByGrid(map, sticker, size);
    if (sticker.curr !== sticker.orig || !twin || twin.sticker.curr !== twin.sticker.orig ||
        occupied.has(tileKey(twin))) return null;
    const pairId = [getManifoldGridId(sticker, size), getManifoldGridId(twin.sticker, size)].sort().join('|');
    if (needsTraversal && practice.tunnels.has(pairId)) return null;
    const key = [tileKey(pos), tileKey(twin)].sort().join('|');
    // Never reuse a collapsing route, or one still retained by a healing tail.
    if (sim.voidTunnelKeys.has(key) || sim.ringHealedTunnelKeys.has(key) ||
        sim.tunnelPassages.some(p => p.tunnelKey === key || p.heal?.tunnelKey === key)) return null;
    if (!canFlipStickerPair(state.cubies, size, pos.x, pos.y, pos.z, pos.dirKey, map)) return null;
    return flipStickerPair(state.cubies,size,pos.x,pos.y,pos.z,pos.dirKey,map);
  };
  for (let i=0; i<(practice.pendingMouths?.length ?? 0); i++) {
    const pos = findStickerByStableKey(state.cubies,size,practice.pendingMouths[i],map);
    const cubies = openPair(pos);
    if (!cubies) continue;
    practice.pendingMouths.splice(i,1);
    return cubies;
  }
  if (needsSupply) {
    // A queued mouth can be covered by food or a long body indefinitely. Use a
    // safe pair elsewhere, consuming that queue slot so it adds no hidden debt.
    const retry = (practice.retryMouths ?? []).map(key => findStickerByStableKey(state.cubies, size, key, map));
    for (const pos of [...retry, ...getAllSurfaceTiles(size)]) {
      const cubies = openPair(pos);
      if (!cubies) continue;
      practice.pendingMouths?.shift();
      return cubies;
    }
  }
  return null;
}
