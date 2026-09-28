import * as THREE from 'three';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { shReset, shPush, ttReset, ttPush, ttAt } from '../circularBuffers.js';
import { BASE_TAIL_LENGTH, WORM_LIFT } from './constants.js';
import { hasJumpClearance, tileKey } from './wormSim.js';
import { bodyCoverageCount } from './bodyCoverage.js';

// Head first; the trail folds across its route two tiles ahead.
export const BODY_JUMP_PATH = [[2,0],[1,0],[0,0],[0,1],[0,2],[1,2],[2,2],[3,2],[4,2],[4,3],[3,3],[2,3],[1,3],[0,3]];

export function seedPracticeBody(sim, size, path) {
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
  sim.tailLength = BASE_TAIL_LENGTH;
}


// Shared by Story and the demo: an empty hop, rocket flight or collision does
// not earn credit. Count once, after a real body clearance and safe landing.
export function trackPracticeBodyJump(sim, practice, size) {
  if (sim.isJumping) {
    practice.airborne = true;
    if (!practice.crossedThisJump && !sim.rocketActive && sim.interpT >= 0.5) {
      const key = tileKey(sim.pos);
      const covered = bodyCoverageCount(sim.tailLength, sim.tileTrail.count, size, sim.expansionAmount);
      for (let i = 3; i < covered; i++) {
        if (ttAt(sim.tileTrail, i) === key) {
          practice.crossedThisJump = hasJumpClearance(sim); break;
        }
      }
    }
  } else if (practice.airborne) {
    if (practice.crossedThisJump && sim.alive && sim.phase === 'crawling') practice.bodyJumps++;
    practice.airborne = false;
    practice.crossedThisJump = false;
  }
}
