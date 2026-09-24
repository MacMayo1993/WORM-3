import { characterOrbCount } from '../characterAbilities.js';
import { randomUnflippedTile } from '../healerWorm/surfaceTiles.js';
import { updateMastery, STORY_POWER_OPENING_DELAY } from './mastery.js';
import * as THREE from 'three';
import { stageWormPractice } from '../healerWorm/demoPractice.js';
import { flipStickerPair, buildManifoldGridMap } from '../../game/manifoldLogic.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { shReset, shPush, ttReset, ttPush, ttAt } from '../circularBuffers.js';
import { BODY_BALL_SPACING, WORM_LIFT } from '../healerWorm/constants.js';
import { getActiveTunnels } from '../wormLogic.js';
import { liveRotation } from '../liveRotation.js';
import { hasJumpClearance, tileKey } from '../healerWorm/wormSim.js';
import { STORY_WORLDS, STORY_ORB_ROUTES } from './worlds.js';

const CROSSING_PATH = [[2,0],[1,0],[0,0],[0,1],[0,2],[1,2],[2,2],[3,2],[4,2],[4,3],[3,3],[2,3],[1,3],[0,3]];
const LONG_PATH = [[2,0],[1,0],[0,0],[0,1],[0,2],[0,3],[0,4],[1,4],[1,3]];
const MOUTHS = [[1,2,4,'PZ'], [4,2,1,'PX'], [1,4,2,'PY'], [3,2,4,'PZ'], [4,2,3,'PX'], [3,4,2,'PY']];
// Smallest board the authored 5×5 templates fit. Below it, trails, mouths and
// routes are generated to the face instead of shifted off its edge.
const TEMPLATE_SIZE = 5;

// Face-local (u, v) on PZ, in board coordinates. The head spawns at (c, 0)
// heading up column c (see stageWormPractice); every trail keeps that column
// clear ahead of the head except where a jump level lays its body across it.
export function storyBodyPath(size, level) {
  const offset = Math.floor(size / 2) - 2;
  if (size >= TEMPLATE_SIZE) {
    const template = level.kind === 'jump' ? CROSSING_PATH : level.id === 1 ? LONG_PATH.slice(0, 6) : LONG_PATH;
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

function seedBody(sim, size, path) {
  const normal = new THREE.Vector3(0, 0, 1);
  // Keep the authored unit-length trail aligned to the centered spawn column.
  // Only its face depth changes; stretching the path would stretch the body.
  const edge = size - 1;
  shReset(sim.stepHistory);
  ttReset(sim.tileTrail, `${path.at(-1).join(',')},${edge},PZ`);
  const point = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let i = path.length - 1; i > 0; i--) {
    a.fromArray(getStickerWorldPos(...path[i], edge, 'PZ', size, 0)).addScaledVector(normal, WORM_LIFT);
    b.fromArray(getStickerWorldPos(...path[i - 1], edge, 'PZ', size, 0)).addScaledVector(normal, WORM_LIFT);
    for (let n = 0; n < 50; n++) shPush(sim.stepHistory, point.lerpVectors(a, b, n / 50), normal, path[i][0], path[i][1], edge);
    ttPush(sim.tileTrail, `${path[i - 1][0]},${path[i - 1][1]},${edge},PZ`);
  }
  sim.tailLength = Math.floor((path.length - 1) / BODY_BALL_SPACING);
}

export function stageStory(sim, size, level, character) {
  const base = stageWormPractice(sim, size, { id: 'steer' });
  const edge = size - 1;
  const pairCount = ['tunnel', 'collector', 'restore', 'mastery'].includes(level.kind) ? level.target : 0;
  for (const [x, y, z, dir] of storyMouths(size, pairCount)) {
    base.cubies = flipStickerPair(base.cubies, size, x, y, z, dir, buildManifoldGridMap(base.cubies, size));
  }
  const body = storyBodyPath(size, level);
  const bodyKeys = new Set(body.map(([x, y]) => `${x},${y},${edge},PZ`));
  // Every level includes matching healing resources on all six faces.
  // Route-trial pairs can seal after traversal without losing their recorded credit.
  sim.powerups = [];
  const cells = STORY_ORB_ROUTES[STORY_WORLDS[level.id].route];
  const orbsPerFace = level.orbsPerFace ?? cells.length;
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
      if (sticker.curr === sticker.orig && tileKey(tile) !== tileKey(sim.pos) && !bodyKeys.has(tileKey(tile))) {
        used.add(key);
        sim.powerups.push({ ...tile, type: 'apple' });
      }
    }
  }
  seedBody(sim, size, body);
  if (level.kind === 'jump') {
    const row = size >= TEMPLATE_SIZE ? 2 : size - 1;
    base.target = { x: Math.floor(size / 2), y: row, z: edge, dirKey: 'PZ' };
  }
  if (level.kind === 'tunnel') base.target = getActiveTunnels(base.cubies, size)[0]?.entry ?? null;
  // Mini stages need empty routes as well as food. Classic still gets extra
  // orbs, but cannot fill almost every remaining tile on the pocket cube.
  const pickupBudget = size <= 3 ? Math.floor(6 * size * size * 0.6) : Infinity;
  const targetCount = Math.min(characterOrbCount(sim.powerups.length, character), pickupBudget);
  while (sim.powerups.length < targetCount) {
    const tile = randomUnflippedTile(base.cubies, size, [...sim.powerups, sim.pos, ...body.map(([x, y]) => ({ x, y, z: edge, dirKey: 'PZ' }))]);
    if (!tile) break;
    sim.powerups.push({ ...tile, type: 'apple' });
  }
  sim.specials = [];
  const practice = { ...base, elapsed: 0, powerDelay: STORY_POWER_OPENING_DELAY, powerHint: null,
    cuts: 0, wasCut: false, airborne: false, crossedThisJump: false, exploding: false,
    bodyJumps: 0, colors: new Set(), tunnels: new Set(), pendingTunnel: null, mechanics: {}, elements: new Set(), elementTime: 0, powerSeq: 0, bombIds: new Set() };
  return practice;
}

export function storyMetrics(sim, practice, level, state, activeTunnels, delta) {
  practice.elapsed += Math.min(Math.max(delta, 0), 0.1);
  const cutting = sim.cutFocusT > 0;
  if (cutting && !practice.wasCut) practice.cuts++;
  practice.wasCut = cutting;
  if (level.kind === 'jump') {
    if (sim.isJumping) {
      practice.airborne = true;
      // Count a clearance once per airborne episode, only at real body contact
      // height. Double jumps and several frames over one tile cannot add points.
      if (!practice.crossedThisJump && !sim.rocketActive && sim.interpT >= 0.5) {
        const key = tileKey(sim.pos);
        for (let i = 3; i < Math.min(sim.tileTrail.count, Math.ceil(sim.tailLength * BODY_BALL_SPACING)); i++) {
          if (ttAt(sim.tileTrail, i) === key) {
            practice.crossedThisJump = hasJumpClearance(sim); break;
          }
        }
      }
    } else if (practice.airborne) {
      if (practice.crossedThisJump && sim.alive && sim.phase === 'crawling') practice.bodyJumps++;
      practice.airborne = false; practice.crossedThisJump = false;
    }
  }
  updateMastery(sim, practice, level, delta);
  return {
    ...practice.mechanics, elements: practice.elements.size, powerHint: practice.powerHint, kills: sim.combat?.kills ?? 0,
    alive: sim.alive, elapsed: practice.elapsed, cuts: practice.cuts,
    orbs: state.wormSessionOrbs, colors: practice.colors.size, healed: sim.healed, uniqueTunnels: practice.tunnels.size,
    tailClear: sim.phase === 'crawling' && sim.tunnelPassages.length === 0 && sim.healPauseT <= 0,
    nextTarget: level.kind === 'tunnel' ? activeTunnels.find(record => !practice.tunnels.has(record.tunnel.pairId))?.tunnel.entry ?? null : null,
    bodyJumps: practice.bodyJumps, landed: !sim.isJumping && sim.phase === 'crawling',
    rotations: state.rotationEpoch - practice.rotationEpoch,
    rotationSettled: !state.animState && !liveRotation.active, remaining: activeTunnels.length,
  };
}
