import * as THREE from 'three';
import { DIR_FORWARD, FACE_NORMALS, windoutHeadS } from './constants.js';
import { getTunnelWorldPosSmoothInto, getWindWorldPosInto } from '../wormLogic.js';
import { tunnelTraversalT } from '../../utils/tunnelPath.js';
import { bodyPathHeadInto } from './sliceBodyPath.js';
import { rocketOrbitT, rocketFrameInto } from './rocketOrbit.js';

const ahead = new THREE.Vector3(), behind = new THREE.Vector3(), anchor = new THREE.Vector3();
const flightTurn = new THREE.Quaternion();

// Shared by the face and directional head geometry. Copy into caller-owned
// vectors: neither renderer may rotate the simulation's current normal.
export function headFrameInto(forward, normal, worm, size) {
  const phase = worm.phase.current;
  const tunnel = worm.activeTunnel.current;
  const inTransit = (phase === 'windup' || phase === 'entering' || phase === 'tunnel' || phase === 'exiting' || phase === 'windout') && tunnel;
  normal.copy(worm.currentNormal.current);
  if (phase === 'falling' && worm.cautionFall?.current) {
    forward.copy(worm.cautionFall.current.forward);
  } else if (inTransit) {
    if (phase === 'windout' || phase === 'windup') {
      const exiting = phase === 'windout', side = exiting ? 'exit' : 'entry';
      const tp = THREE.MathUtils.clamp(worm.tunnelProgress.current, 0, 1);
      const step = exiting ? -0.03 : 0.03;
      const at = THREE.MathUtils.clamp((exiting ? windoutHeadS(tp) : tp) + step, 0, 1);
      getWindWorldPosInto(ahead, tunnel, side, at, size);
      getWindWorldPosInto(behind, tunnel, side, THREE.MathUtils.clamp(at - step, 0, 1), size);
      forward.subVectors(ahead, behind);
      if (forward.lengthSq() < 1e-12) forward.copy(normal).multiplyScalar(exiting ? 1 : -1);
    } else {
      const t = tunnelTraversalT(phase, worm.tunnelProgress.current);
      getTunnelWorldPosSmoothInto(ahead, tunnel, Math.min(t + 0.02, 1), size);
      forward.subVectors(ahead, worm.headInterpPos.current);
      if (forward.lengthSq() < 0.0001) forward.set(0, 0, 1);
    }
    forward.normalize();
  } else if (worm.padFlight?.current) {
    const flight = worm.padFlight.current;
    forward.copy(flight.heading).applyQuaternion(flightTurn.setFromUnitVectors(flight.endNormal, normal));
  } else {
    const { dirKey } = worm.pos.current;
    normal.copy(FACE_NORMALS[dirKey] ?? FACE_NORMALS.PZ);
    forward.fromArray(DIR_FORWARD[dirKey]?.[worm.moveDir.current] ?? [0, 1, 0]);
  }
  if (!inTransit && worm.rocketActive.current) {
    bodyPathHeadInto(anchor, worm);
    normal.copy(worm.currentNormal.current);
    rocketFrameInto(forward, normal, anchor, size,
      rocketOrbitT(true, worm.rocketT.current, worm.rocketFlight?.current));
  }
  if (!inTransit && worm.arrival?.active) {
    normal.copy(worm.arrival.headNormal);
    forward.copy(worm.arrival.headForward);
  }
}
