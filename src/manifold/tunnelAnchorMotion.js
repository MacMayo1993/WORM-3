// src/manifold/tunnelAnchorMotion.js
//
// Lets a tunnel endpoint ride the flip animation of the tile it is welded to.
//
// Tunnel anchors are derived from the CUBIE's transform (getWorldPosition on the
// cubie group). A flipping sticker animates inside that cubie — it vibrates in
// its own plane and squashes through the crossing — and none of that reaches the
// cubie, so the tile would shake while the tunnel attached to it stayed rigid.
//
// StickerPlane publishes the live motion to stickerFlipMotion; this applies it.

import * as THREE from 'three';
import { stickerFlipMotion } from '../3d/styles/TileStyleMaterials.jsx';

const _p1 = new THREE.Vector3();
const _p2 = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _alt = new THREE.Vector3(1, 0, 0);

/**
 * Displace `anchor` by the current flip vibration of the sticker `gridId`.
 *
 * The tile's jitter is expressed in its own 2D plane. Rather than plumbing the
 * sticker's world quaternion through, this builds any orthonormal pair spanning
 * the face plane from the world normal: the shake axes may be rotated relative
 * to the tile's own, but the motion is a vibration, so the difference is not
 * observable — and it is guaranteed to stay in the plane of the face. The blink
 * bounce is the one component that leaves that plane, and it is applied along the
 * world normal directly.
 *
 * @returns {number} flip progress 0→1 for this end, 0 when the tile is at rest.
 */
export function applyTileFlipMotion(anchor, worldNormal, gridId) {
  if (!gridId) return 0;
  const m = stickerFlipMotion.get(gridId);
  if (!m) return 0;

  _p1.copy(Math.abs(_up.dot(worldNormal)) > 0.9 ? _alt : _up);
  _p1.crossVectors(worldNormal, _p1);
  if (_p1.lengthSq() < 1e-8) return m.p ?? 0;
  _p1.normalize();
  _p2.crossVectors(worldNormal, _p1).normalize();

  anchor.addScaledVector(_p1, m.jx ?? 0).addScaledVector(_p2, m.jy ?? 0);
  // Parity blinks also shove the tile straight out of the cube along its normal —
  // follow that too, or the tunnel would stay pinned to the face the tile left.
  if (m.bounce) anchor.addScaledVector(worldNormal, m.bounce);
  return m.p ?? 0;
}

/**
 * End-weighted width multiplier so a tunnel swells at whichever end is mid-flip
 * and stays its normal thickness at the other. `t` is 0 at end 1, 1 at end 2.
 */
export function flipWidthPulse(t, p1, p2, amount = 0.55) {
  const a1 = p1 > 0 ? Math.sin(Math.PI * p1) * amount : 0;
  const a2 = p2 > 0 ? Math.sin(Math.PI * p2) * amount : 0;
  const w1 = (1 - t) * (1 - t);
  const w2 = t * t;
  return 1 + a1 * w1 + a2 * w2;
}
