// src/manifold/tunnelTileGuard.js
//
// Keeps tunnel geometry from poking out through the tiles it hangs off.
//
// A tunnel anchors at TUNNEL_ANCHOR_OFFSET (0.50) along its tile's face normal
// and the sticker sits at SURFACE_OFFSET (0.52), so there is 0.02 of clearance
// at the mouth. That is fine for the centreline and hopeless for anything with
// thickness: the ribbon is 0.85 wide and its guard rails stand 0.30 proud of it,
// and for a pair whose two tiles are on different axes the rails lean *out* of
// the face — roughly half of those configurations, which is why the artefact
// showed up on some flipped tiles and not others. The cube body is opaque, so
// the only part of a tunnel a player ever sees in the solid view is precisely
// the part that has broken through a tile.
//
// The rule this enforces is simply: a tunnel may be as thick as it is deep. At
// the mouth it has no depth, so it comes to a point and opens out as it dives
// in. That is both containment and a better read — the band funnels into the
// hole rather than butting a slab against the back of the sticker.

import * as THREE from 'three';

/** Allocate a reusable guard. Fill it per tunnel with setTileGuard. */
export const makeTileGuard = () => ({
  n1: new THREE.Vector3(),
  n2: new THREE.Vector3(),
  d1: 0,
  d2: 0
});

/**
 * Point the guard at one tunnel's two mouths.
 *
 * Each mouth contributes a half-space: everything belongs on the inward side of
 * the plane through the anchor with that tile's outward face normal. Both are
 * applied everywhere along the path — away from the mouths they are slack by a
 * cube's width, so they cost nothing and never distort the middle.
 *
 * @param {ReturnType<makeTileGuard>} g
 * @param {THREE.Vector3} start  anchor on tile 1 (post flip-motion)
 * @param {THREE.Vector3} norm1  tile 1 outward face normal, world space
 * @param {THREE.Vector3} end    anchor on tile 2
 * @param {THREE.Vector3} norm2  tile 2 outward face normal, world space
 */
export function setTileGuard(g, start, norm1, end, norm2) {
  g.n1.copy(norm1);
  g.n2.copy(norm2);
  g.d1 = start.dot(norm1);
  g.d2 = end.dot(norm2);
  return g;
}

/**
 * How much room a point on the centreline has before it reaches either tile.
 *
 * Because this is a distance to a plane, it bounds displacement in EVERY
 * direction: an offset of magnitude `room` can move a point at most `room`
 * along the normal, so any geometry built within this budget stays inside.
 * That covers the ribbon's cross-section, the rails standing off it, and the
 * camera-facing expansion the resting cords do in their vertex shader — none of
 * which have a fixed direction to reason about individually.
 *
 * @returns {number} clearance in world units, never negative
 */
export function tileRoom(g, x, y, z) {
  const r1 = g.d1 - (x * g.n1.x + y * g.n1.y + z * g.n1.z);
  const r2 = g.d2 - (x * g.n2.x + y * g.n2.y + z * g.n2.z);
  const r = r1 < r2 ? r1 : r2;
  return r > 0 ? r : 0;
}
