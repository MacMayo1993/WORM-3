import { characterOrbCount } from '../characterAbilities.js';
import { randomUnflippedTile } from '../healerWorm/surfaceTiles.js';
import { updateMastery, offerStoryPower } from './mastery.js';
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

function seedBody(sim, size, path) {
  const normal = new THREE.Vector3(0, 0, 1);
  // Keep the authored unit-length trail aligned to the centered spawn column.
  // Only its face depth changes; stretching the path would stretch the body.
  const edge = size - 1, offset = Math.floor(size / 2) - 2;
  path = path.map(([x, y]) => [x + offset, y]);
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
  const edge = size - 1, offset = Math.floor(size / 2) - 2;
  const pairCount = ['tunnel', 'collector', 'restore', 'mastery'].includes(level.kind) ? level.target : 0;
  for (const [x, y, z, dir] of MOUTHS.slice(0, pairCount)) {
    // The template mouths are on positive faces of a 5x5. Keep their lateral
    // spacing while anchoring them to the actual exterior of the story board.
    base.cubies = flipStickerPair(base.cubies, size,
      dir === 'PX' ? edge : x + offset, dir === 'PY' ? edge : y + offset,
      dir === 'PZ' ? edge : z + offset, dir, buildManifoldGridMap(base.cubies, size));
  }
  // Every level includes matching healing resources on all six faces.
  // Route-trial pairs can seal after traversal without losing their recorded credit.
  sim.powerups = [];
  const cells = STORY_ORB_ROUTES[STORY_WORLDS[level.id].route];
  for (const dirKey of ['PZ', 'NZ', 'PX', 'NX', 'PY', 'NY']) {
    // A tunnel may occupy a route tile. Fill locally with distinct safe cells
    // to retain the full matching-color supply on every face.
    const fallback = Array.from({ length: 25 }, (_, i) => [i % 5, Math.floor(i / 5)]);
    const used = new Set();
    for (const [u, v] of [...cells, ...fallback]) {
      if (used.size >= cells.length) break;
      const key = `${u},${v}`;
      if (used.has(key)) continue;
      const a = u + offset, b = v + offset;
      const [x, y, z] = dirKey === 'PZ' || dirKey === 'NZ' ? [a, b, dirKey === 'PZ' ? edge : 0]
        : dirKey === 'PX' || dirKey === 'NX' ? [dirKey === 'PX' ? edge : 0, a, b] : [a, dirKey === 'PY' ? edge : 0, b];
      const sticker = base.cubies[x][y][z].stickers[dirKey];
      if (sticker.curr === sticker.orig && tileKey({ x, y, z, dirKey }) !== tileKey(sim.pos)) {
        used.add(key);
        sim.powerups.push({ x, y, z, dirKey, type: 'apple' });
      }
    }
  }
  if (level.kind === 'jump') {
    seedBody(sim, size, CROSSING_PATH);
    base.target = { x: 2 + offset, y: 2, z: edge, dirKey: 'PZ' };
  } else seedBody(sim, size, level.id === 1 ? LONG_PATH.slice(0, 6) : LONG_PATH);
  if (level.kind === 'tunnel') base.target = getActiveTunnels(base.cubies, size)[0]?.entry ?? null;
  const targetCount = characterOrbCount(sim.powerups.length, character);
  while (sim.powerups.length < targetCount) {
    const tile = randomUnflippedTile(base.cubies, size, [...sim.powerups, sim.pos]);
    if (!tile) break;
    sim.powerups.push({ ...tile, type: 'apple' });
  }
  sim.specials = [];
  const practice = { ...base, elapsed: 0, cuts: 0, wasCut: false, airborne: false, crossedThisJump: false,
    bodyJumps: 0, colors: new Set(), tunnels: new Set(), pendingTunnel: null, mechanics: {}, elements: new Set(), elementTime: 0, powerSeq: 0, bombIds: new Set() };
  offerStoryPower(sim, practice, level, size, base.cubies);
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
