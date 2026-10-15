// Deterministic geometry audit; this measures framing, not GPU performance.
import * as THREE from 'three';
import { makeTunnelPath, tunnelTraversalT, tunnelPathTToArc, tunnelRiderDockWidth } from '../../src/utils/tunnelPath.js';
import { buildTunnelPathForTunnel } from '../../src/worm/wormLogic.js';
import { makeTunnelCamPose, tunnelCamPoseInto, makeCrossingCloseUp, crossingCloseUpInto, crossingFov } from '../../src/worm/tunnelCameraRails.js';
import { frameRide } from '../../src/worm/rideFraming.js';
import { makeTunnelRideFrame, tunnelRideFrameInto, tunnelRideWidthAt } from '../../src/utils/tunnelRide.js';
import { tunnelBodyScale } from '../../src/worm/healerWorm/tunnelBodyFit.js';

export function auditRide(size, route, aspect = 0.45, fps = 60) {
  const path = buildTunnelPathForTunnel(makeTunnelPath(), route, size);
  const cam = new THREE.PerspectiveCamera(100, aspect, .002, 100);
  const pose = makeTunnelCamPose(), close = makeCrossingCloseUp(), body = makeTunnelRideFrame();
  const prev = new THREE.Vector3(), forward = new THREE.Vector3(), point = new THREE.Vector3();
  const prevQ = new THREE.Quaternion();
  let maxRotation = 0;
  let maxTurn = 0, minCoreHeight = Infinity, worstFrame = 0, minDistance = Infinity;
  let initialized = false, peak = null;
  for (const [phase, seconds] of [['entering', 3.6], ['tunnel', 2], ['exiting', 3.6]]) {
    for (let i = 1; i <= Math.round(seconds * fps); i++) {
      const progress = i / Math.round(seconds * fps), t = tunnelTraversalT(phase, progress);
      tunnelCamPoseInto(pose, route, t, size);
      crossingCloseUpInto(close, route, t, size, 4);
      const targetFov = THREE.MathUtils.lerp(100, crossingFov(close, aspect, 100), close.weight);
      cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, 1 - Math.exp(-6 / fps));
      cam.updateProjectionMatrix();
      pose.look.lerp(close.subject, close.weight);
      tunnelRideFrameInto(body, path, tunnelPathTToArc(path, t));
      frameRide(cam, pose, body.center, initialized ? 1 - Math.exp(-10 / fps) : 1, close.weight);
      cam.updateMatrixWorld(true);
      cam.getWorldDirection(forward);
      const turn = initialized ? THREE.MathUtils.radToDeg(forward.angleTo(prev)) : 0;
      if (turn > maxTurn) { maxTurn = turn; peak = [phase, progress]; }
      if (initialized) maxRotation = Math.max(maxRotation, THREE.MathUtils.radToDeg(prevQ.angleTo(cam.quaternion)));
      prevQ.copy(cam.quaternion); prev.copy(forward); initialized = true;
      point.copy(body.center).project(cam);
      worstFrame = Math.max(worstFrame, Math.abs(point.x), Math.abs(point.y), point.z > 1 ? Infinity : 0);
      minDistance = Math.min(minDistance, cam.position.distanceTo(body.center));
      if (phase === 'tunnel' && progress >= .25 && progress <= .75) {
        const profile = {rideWeight: 1, rideWidth: tunnelRideWidthAt(path, tunnelPathTToArc(path,t), tunnelRiderDockWidth(size)), rideClearance: body.center.distanceTo(body.floor)};
        const radius = .12 * tunnelBodyScale(profile, .12);
        const depth = -body.center.clone().applyMatrix4(cam.matrixWorldInverse).z;
        minCoreHeight = Math.min(minCoreHeight, radius / (depth * Math.tan(THREE.MathUtils.degToRad(cam.fov)/2)));
      }
    }
  }
  return {maxTurn, maxRotation, minCoreHeight, worstFrame, minDistance, peak};
}

if (process.argv[1]?.endsWith('ride-framing.mjs')) {
  for (const size of [3, 5, 15]) {
    const n = size-1, m = Math.floor(size/2);
    for (const [name, exit] of [
      ['straight',{x:0,y:0,z:m,dirKey:'NY'}],
      ['bent',{x:n,y:0,z:0,dirKey:'PX'}],
      ['same-face',{x:n,y:n,z:m,dirKey:'PY'}],
      ['adjacent',{x:1,y:n,z:m,dirKey:'PY'}],
    ]) {
      const route={entry:{x:0,y:n,z:m,dirKey:'PY'}, exit, padHeight:.2};
      console.log(JSON.stringify({size,name,...auditRide(size,route)}));
    }
  }
}
