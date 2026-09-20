import { characterOrbCount } from '../characterAbilities.js';
import { randomUnflippedTile } from '../healerWorm/surfaceTiles.js';
import * as THREE from 'three';
import { stageWormPractice } from '../healerWorm/demoPractice.js';
import { flipStickerPair, buildManifoldGridMap } from '../../game/manifoldLogic.js';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { shReset, shPush, ttReset, ttPush, ttAt } from '../circularBuffers.js';
import { BODY_BALL_SPACING, WORM_LIFT } from '../healerWorm/constants.js';
import { tileKey } from '../healerWorm/wormSim.js';

export function stageStory(sim, size, level, character) {
  const base = stageWormPractice(sim, size, { id: level.kind === 'tunnel' ? 'tunnel' : 'steer' });
  const c = Math.floor(size / 2);
  const orb = (x, y, z = size - 1, dirKey = 'PZ') => ({ x, y, z, dirKey, type: 'apple' });
  if (level.kind === 'orbs') sim.powerups = [1, 2, 3, 4].map(y => orb(c, y));
  if (level.kind === 'collector') {
    // Ordinary front-face pickups match the flipped entrance on the opposite
    // face. Keep both mouths away from the initial straight pickup lane.
    base.target = { x: 1, y: 2, z: 0, dirKey: 'NZ' };
    base.cubies = flipStickerPair(base.cubies, size, 1, 2, 0, 'NZ', buildManifoldGridMap(base.cubies, size));
    sim.powerups = [1, 2].map(y => orb(c, y));
  }
  if (level.kind === 'restore') {
    const mouths = [[1, 2, 4, 'PZ'], [4, 2, 1, 'PX'], [1, 4, 2, 'PY']];
    for (const [x, y, z, dir] of mouths) base.cubies = flipStickerPair(base.cubies, size, x, y, z, dir, buildManifoldGridMap(base.cubies, size));
    sim.powerups = [];
    for (const dirKey of ['PZ', 'NZ', 'PX', 'NX', 'PY', 'NY']) {
      for (const a of [1, 3]) {
        for (const b of [1, 3]) {
          const [x, y, z] = dirKey === 'PZ' || dirKey === 'NZ' ? [a, b, dirKey === 'PZ' ? 4 : 0]
            : dirKey === 'PX' || dirKey === 'NX' ? [dirKey === 'PX' ? 4 : 0, a, b] : [a, dirKey === 'PY' ? 4 : 0, b];
          const sticker = base.cubies[x][y][z].stickers[dirKey];
          if (sticker.curr === sticker.orig) sim.powerups.push(orb(x, y, z, dirKey));
        }
      }
    }
  }
  if (level.kind === 'jump') {
    const path = [[2,0],[1,0],[0,0],[0,1],[0,2],[1,2],[2,2],[3,2],[4,2],[4,3],[3,3],[2,3],[1,3],[0,3]];
    const normal = new THREE.Vector3(0, 0, 1);
    shReset(sim.stepHistory);
    ttReset(sim.tileTrail, '0,3,4,PZ');
    const point = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
    for (let i = path.length - 1; i > 0; i--) {
      a.fromArray(getStickerWorldPos(...path[i], 4, 'PZ', size, 0)).addScaledVector(normal, WORM_LIFT);
      b.fromArray(getStickerWorldPos(...path[i - 1], 4, 'PZ', size, 0)).addScaledVector(normal, WORM_LIFT);
      for (let n = 0; n < 50; n++) shPush(sim.stepHistory, point.lerpVectors(a, b, n / 50), normal, path[i][0], path[i][1], 4);
      ttPush(sim.tileTrail, `${path[i - 1][0]},${path[i - 1][1]},4,PZ`);
    }
    sim.tailLength = Math.floor(13 / BODY_BALL_SPACING);
    base.target = { x: 2, y: 2, z: 4, dirKey: 'PZ' };
  }
  const targetCount = characterOrbCount(sim.powerups.length, character);
  while (sim.powerups.length < targetCount) {
    const tile = randomUnflippedTile(base.cubies, size, [...sim.powerups, sim.pos]);
    if (!tile) break;
    sim.powerups.push({ ...tile, type: 'apple' });
  }
  sim.specials = [];
  return { ...base, elapsed: 0, cuts: 0, wasCut: false, crossedBody: false };
}

export function storyMetrics(sim, practice, level, state, activeTunnels, delta) {
  practice.elapsed += Math.min(Math.max(delta, 0), 0.1);
  const cutting = sim.cutFocusT > 0;
  if (cutting && !practice.wasCut) practice.cuts++;
  practice.wasCut = cutting;
  if (level.kind === 'jump' && sim.isJumping && sim.interpT >= 0.5 && tileKey(sim.pos) === tileKey(practice.target)) {
    for (let i = 3; i < Math.min(sim.tileTrail.count, Math.ceil(sim.tailLength * BODY_BALL_SPACING)); i++) {
      if (ttAt(sim.tileTrail, i) === tileKey(practice.target)) practice.crossedBody = true;
    }
  }
  return {
    alive: sim.alive, elapsed: practice.elapsed, cuts: practice.cuts,
    orbs: state.wormSessionOrbs, healed: sim.healed, tunnels: state.wormTunnelCount,
    tailClear: sim.phase === 'crawling' && sim.tunnelPassages.length === 0 && sim.healPauseT <= 0,
    crossedBody: practice.crossedBody, landed: !sim.isJumping && sim.phase === 'crawling',
    rotations: state.rotationEpoch - practice.rotationEpoch,
    rotationSettled: !state.animState, remaining: activeTunnels.length,
  };
}
