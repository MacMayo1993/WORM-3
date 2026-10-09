import { makeGrowthOrb } from '../healerWorm/orbSpawning.js';
import { characterOrbCount } from '../characterAbilities.js';
import { getAllSurfaceTiles, randomUnflippedTile } from '../healerWorm/surfaceTiles.js';
import { updateMastery, storyElementCount, STORY_POWER_OPENING_DELAY } from './mastery.js';
import { stageWormPractice } from '../healerWorm/demoPractice.js';
import { flipStickerPair, buildManifoldGridMap, findAntipodalStickerByGrid } from '../../game/manifoldLogic.js';
import { ttAt } from '../circularBuffers.js';
import { BODY_BALL_SPACING } from '../healerWorm/constants.js';
import { getActiveTunnels, getStableKey, findStickerByStableKey } from '../wormLogic.js';
import { liveRotation } from '../liveRotation.js';
import { tileKey } from '../healerWorm/wormSim.js';
import { STORY_WORLDS, STORY_ORB_ROUTES } from './worlds.js';
import { BODY_JUMP_PATH, seedPracticeBody, trackPracticeBodyJump } from '../healerWorm/bodyJumpPractice.js';

const LONG_PATH = [[2,0],[1,0],[0,0],[0,1],[0,2],[0,3],[0,4],[1,4],[1,3]];
const MOUTHS = [[1,2,4,'PZ'], [4,2,1,'PX'], [1,4,2,'PY'], [3,2,4,'PZ'], [4,2,3,'PX'], [3,4,2,'PY']];
// Smallest board the authored 5×5 templates fit. Below it, trails, mouths and
// routes are generated to the face instead of shifted off its edge.
const TEMPLATE_SIZE = 5;
export const STORY_ORB_REFILL_INTERVAL = 0.75;

// Face-local (u, v) on PZ, in board coordinates. The head spawns at (c, 0)
// heading up column c (see stageWormPractice); every trail keeps that column
// clear ahead of the head except where a jump level lays its body across it.
export function storyBodyPath(size, level) {
  const offset = Math.floor(size / 2) - 2;
  if (size >= TEMPLATE_SIZE) {
    const template = level.kind === 'jump' ? BODY_JUMP_PATH : level.id === 1 ? LONG_PATH.slice(0, 6) : LONG_PATH;
    return template.map(([x, y]) => [x + offset, y]);
  }
  const c = Math.floor(size / 2);
  const path = [[c, 0]];
  for (let x = c - 1; x >= 0; x--) path.push([x, 0]);
  if (level.kind === 'jump') {
    // Lay the body across the head's column on the far row: a small face has
    // no room to spare, and a nearer crossing arrives before the first jump can.
    const row = size - 1;
    for (let y = 1; y <= row; y++) path.push([0, y]);
    for (let x = 1; x < size; x++) path.push([x, row]);
    return path;
  }
  for (let y = 1; y < size; y++) path.push([0, y]);
  for (let x = 1; x < c; x++) path.push([x, size - 1]);
  // Keep at least one row of the spawn face free for its own color's orbs.
  return path.slice(0, Math.max(2, size * size - size));
}

// Tunnel mouths live on the three positive faces; their twins land on the
// negative faces, so no two mouths can share a pair.
export function storyMouths(size, count) {
  if (size >= TEMPLATE_SIZE) {
    const edge = size - 1, offset = Math.floor(size / 2) - 2;
    // Spawn-face mouths keep their rows: the head starts on row 0 at every size,
    // so shifting them up with the board would land one under the body trail.
    return MOUTHS.slice(0, count).map(([x, y, z, dir]) => [
      dir === 'PX' ? edge : x + offset, dir === 'PY' ? edge : dir === 'PZ' ? y : y + offset, dir === 'PZ' ? edge : z + offset, dir]);
  }
  const edge = size - 1, c = Math.floor(size / 2);
  const corners = [[edge, edge], [0, edge], [edge, 0], [0, 0]];
  const local = { PX: corners, PY: corners,
    // The spawn face keeps the head's column and the body's row/column open.
    PZ: corners.filter(([u, v]) => u !== c && u !== 0 && v !== 0) };
  const mouths = [];
  for (let slot = 0; mouths.length < count && slot < corners.length; slot++) {
    for (const dir of ['PX', 'PY', 'PZ']) {
      const cell = local[dir][slot];
      if (!cell || mouths.length >= count) continue;
      const [u, v] = cell;
      mouths.push(dir === 'PX' ? [edge, u, v, dir] : dir === 'PY' ? [u, edge, v, dir] : [u, v, edge, dir]);
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

export function stageStory(sim, size, level, character) {
  const base = stageWormPractice(sim, size, { id: 'steer' });
  const edge = size - 1;
  const pairCount = ['tunnel', 'collector', 'restore', 'mastery'].includes(level.kind) ? level.target : 0;
  const mouths = storyMouths(size, pairCount);
  const pendingMouths = mouths.slice(2).map(([x,y,z,dir]) => getStableKey(x,y,z,dir,base.cubies));
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
  sim.peakTailLength = sim.tailLength;
  if (level.kind === 'jump') {
    const row = size >= TEMPLATE_SIZE ? 2 : size - 1;
    base.target = { x: Math.floor(size / 2), y: row, z: edge, dirKey: 'PZ' };
  }
  if (level.kind === 'tunnel') base.target = getActiveTunnels(base.cubies, size)[0]?.entry ?? null;
  // Mini stages need empty routes as well as food. Classic still gets extra
  // orbs, but cannot fill almost every remaining tile on the pocket cube.
  const pickupBudget = size <= 3 ? Math.floor(6 * size * size * 0.6) : Infinity;
  const targetCount = Math.min(characterOrbCount(sim.powerups.length, character), pickupBudget);
  const reservedMouths = getActiveTunnels(reserved, size).flatMap(tunnel => [tunnel.entry, tunnel.exit]);
  while (sim.powerups.length < targetCount) {
    const tile = randomUnflippedTile(base.cubies, size, [...sim.powerups, sim.pos, ...reservedMouths, ...body.map(([x, y]) => ({ x, y, z: edge, dirKey: 'PZ' }))]);
    if (!tile) break;
    sim.powerups.push(makeGrowthOrb(tile));
  }
  sim.specials = [];
  // Preserve the staged density (including Classic's bonus) by sticker color,
  // so a layer turn cannot strand a depleted healing color on another face.
  const orbTargets = {};
  for (const orb of sim.powerups) {
    const color = base.cubies[orb.x][orb.y][orb.z].stickers[orb.dirKey].orig;
    orbTargets[color] = (orbTargets[color] ?? 0) + 1;
  }
  const practice = { ...base, pendingMouths, orbTargets, orbRefillDelay: STORY_ORB_REFILL_INTERVAL,
    elapsed: 0, peakLength: Math.floor(sim.tailLength), powerDelay: STORY_POWER_OPENING_DELAY, powerHint: null, lastPower: null,
    cuts: 0, wasCut: false, airborne: false, crossedThisJump: false, exploding: false,
    bodyJumps: 0, colors: new Set(), tunnels: new Set(), pendingTunnel: null, mechanics: {}, elements: new Set(), collectedElements: new Set(), elementTimes: {}, powerSeq: 0, bombIds: new Set() };
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

export function storyMetrics(sim, practice, level, state, activeTunnels, delta) {
  practice.elapsed += Math.min(Math.max(delta, 0), 0.1);
  const cutting = sim.cutFocusT > 0;
  if (cutting && !practice.wasCut) practice.cuts++;
  practice.wasCut = cutting;
  practice.peakLength = Math.max(practice.peakLength ?? 0, Math.floor(sim.tailLength), Math.floor(sim.peakTailLength ?? 0));
  if (level.kind === 'jump') trackPracticeBodyJump(sim, practice, state.size);
  updateMastery(sim, practice, level, delta);
  return {
    ...practice.mechanics,
    elements: storyElementCount(practice.elements, level.mechanics?.elements),
    uniqueElements: storyElementCount(practice.collectedElements, level.mechanics?.uniqueElements),
    powerHint: practice.powerHint, kills: sim.combat?.kills ?? 0,
    alive: sim.alive, elapsed: practice.elapsed, cuts: practice.cuts, peakLength: practice.peakLength,
    orbs: state.wormSessionOrbs, colors: practice.colors.size, healed: sim.healed, uniqueTunnels: practice.tunnels.size,
    onSurface: sim.phase === 'crawling', healSettled: sim.healPauseT <= 0,
    tailClear: sim.phase === 'crawling' && sim.tunnelPassages.length === 0 && sim.healPauseT <= 0,
    nextTarget: level.kind === 'tunnel' ? activeTunnels.find(record => !practice.tunnels.has(record.tunnel.pairId))?.tunnel.entry ?? null : null,
    bodyJumps: practice.bodyJumps, landed: !sim.isJumping && sim.phase === 'crawling',
    rotations: state.rotationEpoch - practice.rotationEpoch,
    rotationSettled: !state.animState && !liveRotation.active, remaining: activeTunnels.length + (practice.pendingMouths?.length ?? 0),
  };
}

// Introduce one replacement only after the previous tail clears. Stable sticker
// identities follow cube rotations; never open a mouth under the body or a pickup.
export function replenishStoryTunnel(sim, practice, state, size, activeCount = getActiveTunnels(state.cubies,size).length) {
  if (!practice.pendingMouths?.length || sim.phase !== 'crawling' || sim.tunnelPassages.length ||
      sim.healPauseT > 0 || state.animState || liveRotation.active || activeCount >= 2) return null;
  const map = buildManifoldGridMap(state.cubies, size);
  const occupied = new Set([...sim.powerups, ...sim.specials].map(tileKey));
  occupied.add(tileKey(sim.pos));
  if (sim.prevTile) occupied.add(tileKey(sim.prevTile));
  for (let i=0; i<Math.min(sim.tileTrail.count, Math.ceil(sim.tailLength * BODY_BALL_SPACING)); i++) occupied.add(ttAt(sim.tileTrail,i));
  for (let i=0; i<practice.pendingMouths.length; i++) {
    const pos = findStickerByStableKey(state.cubies,size,practice.pendingMouths[i],map);
    if (!pos || occupied.has(tileKey(pos))) continue;
    const cubies = flipStickerPair(state.cubies,size,pos.x,pos.y,pos.z,pos.dirKey,map);
    const pair = getActiveTunnels(cubies,size).find(t => tileKey(t.entry) === tileKey(pos) || tileKey(t.exit) === tileKey(pos));
    if (!pair || occupied.has(tileKey(pair.entry)) || occupied.has(tileKey(pair.exit))) continue;
    practice.pendingMouths.splice(i,1);
    return cubies;
  }
  return null;
}
