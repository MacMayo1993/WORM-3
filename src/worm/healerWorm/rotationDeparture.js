import * as THREE from 'three';
import { liveRotation, liveLayerAngle } from '../liveRotation.js';
import { restReadProtectsTile } from '../wormLogic.js';

export const departureAxis = new THREE.Vector3();

export function hasLiveDeparture(sim) {
  return !!sim.rotationDeparture && liveRotation.active &&
    sim.rotationDeparture.txnId === liveRotation.txnId;
}

// A jumping rider leaving a moving slice needs two coordinate frames: its
// source still follows the slice, but the landing is on the stationary cube.
export function updateRotationDeparture(sim) {
  if (sim.rotationDeparture || !sim.isJumping || !liveRotation.active || !sim.prevTile) return;
  const prev = sim.prevTile, next = sim.pos;
  if (restReadProtectsTile(sim.restRead, prev.x, prev.y, prev.z)) return;
  if (liveLayerAngle(prev.x, prev.y, prev.z) === null ||
      liveLayerAngle(next.x, next.y, next.z) !== null) return;
  sim.rotationDeparture = { txnId: liveRotation.txnId, axis: liveRotation.axis };
}

export function setDepartureAxis() {
  const axis = liveRotation.axis;
  departureAxis.set(axis === 'col' ? 1 : 0, axis === 'row' ? 1 : 0, axis === 'depth' ? 1 : 0);
}

// World-space samples from a departure must be compared with the body in that
// same frame; old samples still on the rotating slab need its current transform.
export function departureBodySample(record, position, normal) {
  position.copy(record.pos);
  normal.copy(record.normal);
  if (record.tx < 0) return;
  const angle = liveLayerAngle(record.tx, record.ty, record.tz);
  if (angle === null) return;
  setDepartureAxis();
  position.applyAxisAngle(departureAxis, angle);
  normal.applyAxisAngle(departureAxis, angle).normalize();
}
