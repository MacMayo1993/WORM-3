import * as THREE from 'three';
import { coreZoomLimit, CORE_HALF } from '../3d/antipodalCore.js';
import { makeTunnelPath, tunnelDockWidth, tunnelPathPointInto, tunnelPathTToArc, tunnelPathArcPointInto } from '../utils/tunnelPath.js';
import { buildTunnelPathForTunnel } from './wormLogic.js';

export const CORE_VISIT_SECONDS = 1.5;
const path = makeTunnelPath();
const sample = new THREE.Vector3(), lens = new THREE.Vector3();

// The whole orbit fits in a sphere inside the room, even on corner/reverse
// routes. The core crossing itself is fixed while its shell grows about a dock.
export function coreFollowDistance(dock, size, zoom = coreZoomLimit(dock, size)) {
  const half = CORE_HALF * .9 * zoom;
  const clearance = half - Math.max(Math.abs(dock.x), Math.abs(dock.y), Math.abs(dock.z)) * (zoom - 1);
  return Math.max(.006, Math.min(tunnelDockWidth(size) * 1.5, clearance * .62));
}

export const coreTrailAtPoint = (point, dock, size) => coreFollowDistance(dock, size) + point.length() * .4;

export function makeCoreVisit(tunnel, size, expansion = 0, reducedMotion = false) {
  buildTunnelPathForTunnel(path, tunnel, size, expansion);
  const zoom = reducedMotion ? 1 : coreZoomLimit(path.midA, size);
  const roomCenter = path.midA.clone().multiplyScalar(1 - zoom);
  const half = CORE_HALF * .9 * zoom;
  let t = .5, clearance = -Infinity;
  // Find room for a full orbit along the ACTUAL route, rather than stopping
  // next to the anchored entry wall just because its parameter says midpoint.
  for (let i = 0; i <= 192; i++) {
    const candidate = path.legT0[3] + (.82 - path.legT0[3]) * i / 192;
    tunnelPathPointInto(sample, path, candidate);
    const gap = half - Math.max(Math.abs(sample.x - roomCenter.x), Math.abs(sample.y - roomCenter.y), Math.abs(sample.z - roomCenter.z));
    tunnelPathArcPointInto(lens, path, tunnelPathTToArc(path, candidate) - coreTrailAtPoint(sample, path.midA, size));
    if (gap > clearance && lens.distanceTo(sample) < gap - .004) { t = candidate; clearance = gap; }
  }
  const phase = t < .67 ? 'tunnel' : 'exiting';
  return {
    phase, t, progress: phase === 'tunnel' ? (t - .33) / .34 : (t - .67) / .33,
    elapsed: -1, complete: false, reducedMotion, zoom, clearance,
    center: tunnelPathPointInto(new THREE.Vector3(), path, t), roomCenter, half
  };
}

// Stop at the chosen interior point exactly; the simulation owns the 1.5-second
// clock, so pause/background tabs freeze the shot along with the worm.
export function stopForCoreVisit(sim, proposed) {
  const visit = sim.coreVisit;
  if (!visit || visit.phase !== sim.phase || visit.complete || proposed < visit.progress) return proposed;
  visit.elapsed = 0;
  return visit.progress;
}

const radial = new THREE.Vector3(), axis = new THREE.Vector3(), focus = new THREE.Vector3();
const ease = p => { const t = THREE.MathUtils.clamp(p, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
export function orbitCorePoseInto(pose, visit, headNormal = null, headShift = 0) {
  if (!visit || visit.elapsed < 0 || visit.complete || visit.reducedMotion) return pose;
  const p = THREE.MathUtils.clamp(visit.elapsed / CORE_VISIT_SECONDS, 0, 1);
  const eased = ease((p - .12) / .76);
  const pull = ease(p / .12) * (1 - ease((p - .88) / .12));
  radial.subVectors(pose.cam, pose.look);
  axis.copy(pose.up).addScaledVector(radial, -pose.up.dot(radial) / Math.max(radial.lengthSq(), 1e-12)).normalize();
  if (axis.lengthSq() < 1e-8) axis.set(0, 1, 0);
  focus.copy(pose.look);
  if (headNormal) focus.addScaledVector(headNormal, headShift * pull);
  const clearance = visit.half - Math.max(Math.abs(focus.x - visit.roomCenter.x), Math.abs(focus.y - visit.roomCenter.y), Math.abs(focus.z - visit.roomCenter.z));
  const radius = Math.min(visit.clearance * .72, .6);
  radial.setLength(Math.min(clearance - .004, THREE.MathUtils.lerp(radial.length(), radius, pull)))
    .applyAxisAngle(axis, eased * Math.PI * 2);
  pose.cam.copy(focus).add(radial);
  pose.look.copy(focus);
  pose.up.copy(axis);
  return pose;
}
