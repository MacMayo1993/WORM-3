import * as THREE from 'three';
import { expect, it } from 'vitest';
import { makeCoreVisit, orbitCorePoseInto, CORE_VISIT_SECONDS } from '../worm/coreVisit.js';
import { tunnelCamPoseInto, tunnelExitPoseInto, makeTunnelCamPose } from '../worm/tunnelCameraRails.js';
import { coreOpeningRadius } from '../3d/corePassage.js';
import { tunnelDockWidth } from '../utils/tunnelPath.js';
import { WORM_PAD_HEIGHT, wormRaisedAmount } from '../game/raisedCubie.js';

const normal = key => new THREE.Vector3(...({ PX:[1,0,0], NX:[-1,0,0], PY:[0,1,0], NY:[0,-1,0], PZ:[0,0,1], NZ:[0,0,-1] }[key]));
function routes(size) {
  const m = Math.floor(size / 2), n = size - 1;
  const tile = (key, corner) => ({ x: key === 'PX' ? n : key === 'NX' ? 0 : corner ? n : m,
    y: key === 'PY' ? n : key === 'NY' ? 0 : corner ? n : m,
    z: key === 'PZ' ? n : key === 'NZ' ? 0 : corner ? n : m, dirKey:key });
  const all = [];
  for (const a of ['PX','NX','PY','NY','PZ','NZ']) for (const b of ['PX','NY','NZ']) {
    if (a === b) continue;
    for (const corner of [false,true]) all.push({ entry:tile(a,corner),exit:tile(b,corner),padHeight:WORM_PAD_HEIGHT,padExpansion:wormRaisedAmount(size) });
  }
  return all;
}
function poseAt(out, tunnel, visit, size) {
  return visit.phase === 'exiting' ? tunnelExitPoseInto(out,tunnel,visit.progress,size) : tunnelCamPoseInto(out,tunnel,visit.t,size);
}

it('limits the opening diameter to one displayed tile at every size and zoom', () => {
  for (let size = 2; size <= 15; size++) for (const zoom of [1,2,4,6]) {
    expect(coreOpeningRadius(size,zoom)*2).toBeLessThan(tunnelDockWidth(size)*zoom);
    expect(coreOpeningRadius(size,zoom)*2).toBeGreaterThan(tunnelDockWidth(size)*zoom*.85);
  }
});

it('finds room on the actual route for a closed 360-degree orbit on every face and board size', () => {
  const pose = makeTunnelCamPose(), start = new THREE.Vector3(), prev = new THREE.Vector3(), direction = new THREE.Vector3();
  for (const size of [2,3,6,15]) for (const tunnel of routes(size)) {
    const visit = makeCoreVisit(tunnel,size);
    expect(visit.clearance).toBeGreaterThan(0);
    let sweep = 0;
    for (let i = 0; i <= 120; i++) {
      poseAt(pose,tunnel,visit,size);
      if (!i) start.copy(pose.cam);
      visit.elapsed = CORE_VISIT_SECONDS * i / 120;
      orbitCorePoseInto(pose,visit,normal(tunnel.exit.dirKey),Math.min(.09,tunnelDockWidth(size)*.5));
      const p = pose.cam.clone().sub(visit.roomCenter);
      expect(Math.max(Math.abs(p.x),Math.abs(p.y),Math.abs(p.z)), `size ${size}, ${tunnel.entry.dirKey} to ${tunnel.exit.dirKey}`).toBeLessThan(visit.half - .002);
      direction.subVectors(pose.cam,pose.look).normalize();
      if (i) sweep += direction.angleTo(prev);
      prev.copy(direction);
    }
    expect(pose.cam.distanceTo(start)).toBeLessThan(1e-8);
    expect(sweep).toBeCloseTo(2*Math.PI,5);
    // Looking at the held head is meaningful, never a zero look vector.
    expect(pose.look.distanceTo(visit.center)).toBeLessThan(1e-8);
  }
});

it('keeps the static interior beat for reduced motion', () => {
  const tunnel=routes(3)[0], visit=makeCoreVisit(tunnel,3,0,true), pose=makeTunnelCamPose();
  poseAt(pose,tunnel,visit,3);const start=pose.cam.clone();
  for (const elapsed of [0,.5,1,1.5]) {visit.elapsed=elapsed;orbitCorePoseInto(pose,visit,normal(tunnel.entry.dirKey),.01);expect(pose.cam.equals(start)).toBe(true);}
});
