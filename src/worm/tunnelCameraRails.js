import { makeTunnelRideFrame, tunnelCameraFrameInto } from '../utils/tunnelRide.js';
import { tunnelArmSeconds, tunnelHandoffSeconds } from './healerWorm/constants.js';
import { cubeExpansionScale } from '../game/cubeWorldGeometry.js';
// src/worm/tunnelCameraRails.js
//
// The pose of the wormhole camera as a pure function of how far along the
// traversal the worm's head is.
//
// This lives outside WormChaseCamera because two different phases need the
// *same* pose: 'entering' blends into it as the dive lands, and 'tunnel' /
// 'exiting' sit on it outright. When the two carried their own copies of the
// math the phase change was a cut — which is precisely the seam the dive exists
// to remove — so there is now one definition and both call it.
//
// Pure (no React, no r3f), so the claims that matter can actually be asserted:
// that the camera crosses the cube's surface during the dive rather than
// watching the ride from outside it, and that the dive's end pose IS the ride's
// start pose.

import * as THREE from 'three';
import { coreZoomBoundsInto, coreZoomLimit, CORE_HALF, CORE_STICKER_OFFSET } from '../3d/antipodalCore.js';
import { coreOpeningRadius, CORE_MIRROR_HALF } from '../3d/corePassage.js';
import { buildTunnelPathForTunnel, getTunnelArcPosSmoothInto } from './wormLogic.js';
import { makeTunnelPath, tunnelDockWidth, tunnelPathTToArc, tunnelPathArcToT, tunnelPathArcPointExtendedInto,
  ARM_A_END, tunnelTraversalT, tunnelCoreScale } from '../utils/tunnelPath.js';

// Offset from the centerline while riding.
//
// Lift above the worm in the open arms. cameraRideHeight eases this to zero
// through the outer mouths and the core: those cutouts follow the rider's
// centerline, and an elevated camera would pass through their solid walls.
// The worm renderer already fades body segments that get too close to the lens.
export const TUNNEL_CAM_UP = 0.62;
// The default 0.1 near plane cuts away the rim of the small core openings.
export const TUNNEL_CAM_NEAR = 0.002;

// Meet the mouth up close instead of pulling back to a whole-cube overview.
// This is an offset FROM the entry tile, not a distance from the cube center.
export const portalDist = (size) => 0.6 + size * 0.02;
export const portalUp = (size) => 1.3 + size * 0.32;

// A raised landing's shot while the worm coils on its pad: high enough to hold
// the whole coil, a little behind the landing heading, and with that heading as
// screen-up so the pitch down from the chase needs no roll.
const WINDUP_CAM_LIFT = 0.45;
const WINDUP_CAM_BACK = 0.5;
export function windupPoseInto(out, mouth, normal, heading, size) {
  out.cam.copy(mouth).addScaledVector(normal, portalDist(size) + WINDUP_CAM_LIFT).addScaledVector(heading, -WINDUP_CAM_BACK);
  out.look.copy(mouth);
  out.up.copy(heading);
  return out;
}

// Handoff at the actual core dock, shared with the simulation and effects.
export const ENTER_END_T = ARM_A_END;

const _axisDelta = new THREE.Vector3();

/**
 * Project a world-space point onto the face-normal line through a sticker's
 * physical centre. This is intentionally tile-based rather than tunnel-based:
 * render smoothing may leave a camera pose carrying lateral error from the
 * previous chase shot even when the tunnel centerline itself is correct.
 */
export function projectToTileCenterAxisInto(out, point, tileCenter, faceNormal) {
  _axisDelta.subVectors(point, tileCenter);
  return out.copy(tileCenter).addScaledVector(faceNormal, _axisDelta.dot(faceNormal));
}

/**
 * Lateral camera offset from the tunnel centerline.
 *
 * Rise above the band after entering the outer shell. The actual pose also
 * checks shell/core clearance so both circular apertures remain centered.
 */
export function cameraUpForHead(tHead) {
  // Return to the centerline before the exit mouth.
  return TUNNEL_CAM_UP
    * THREE.MathUtils.smoothstep(tHead, 0.04, 0.16)
    * (1 - THREE.MathUtils.smoothstep(tHead, 0.80, 0.95));
}

/**
 * Quintic ease for the dive: zero first and second derivatives at each end.
 * The moving rail target supplies the velocity at handoff, without the old
 * cubic acceleration spike.
 */
export const diveEase = (p) => {
  const c = p < 0 ? 0 : p > 1 ? 1 : p;
  return c * c * c * (c * (c * 6 - 15) + 10);
};

/** The share of the entry arm the dive takes to land on the follow rail (under 0.6s). */
export const DIVE_SPAN = 0.16;
export const diveProgress = (tp) => diveEase(tp / DIVE_SPAN);

/**
 * How far behind the head the camera trails.
 *
 * This used to be one constant, 1.15 + size·0.1, and that is longer than the
 * entire entry arm on a 3×3 (1.25 world units): the camera sat further back
 * than the tunnel was deep, so it did not cross the cube's surface until
 * roughly the middle of the 'tunnel' phase. The player watched the ride from
 * outside a cube whose body is hidden during those phases, which is why the
 * shot never read as being inside anything.
 *
 * Holding the trail short through the entry arm puts the camera through the
 * mouth on the dive — the entry value cannot grow much beyond this, because the
 * head is only about a unit deep when 'entering' hands over to the ride and the
 * cube's solid body is hidden at that moment. A trail longer than that depth
 * leaves the lens outside a cube that has just stopped being drawn.
 *
 * The settled deep-ride value is where the shot has room to breathe, and 1.15 was
 * not enough of it: the head sat close enough to fill the frame with its own back.
 * The growth to it is spread over tHead 0.42→0.95 so that it is always slower
 * than the head's own advance along the path — ramp it faster and the camera
 * drifts backwards out of the tunnel while the worm pulls away from it.
 */
export function backForHead(tHead, size) {
  const deep = THREE.MathUtils.smoothstep(tHead, 0.42, 0.95);
  return THREE.MathUtils.lerp(0.62 + size * 0.1, 1.45 + size * 0.1, deep);
}

const _fwd = new THREE.Vector3();
const _camPath = makeTunnelPath();
const _coreBounds = new THREE.Box3();
const _headPoint = new THREE.Vector3();

// Leave room for the worm's twist and the mirrors. Keep the increased trail
// on the same curve so pulling back cannot cut across either core aperture.
// Growing the trail by at most 40% of distance travelled prevents a backward
// camera move while the worm regains its full width on the outward arm.
// A minimum whose slope never jumps: where one trailing rule hands over to the
// other the lens changes pace over a stretch instead of in one frame (a hard
// min jolted it by half again on corner-tile routes).
const TRAIL_BLEND = 0.4;
function smoothMin(a, b) {
  const h = Math.max(TRAIL_BLEND - Math.abs(a - b), 0) / TRAIL_BLEND;
  return Math.min(a, b) - h * h * TRAIL_BLEND * 0.25;
}

export function cameraArcForHead(path, tHead, size) {
  const headArc = tunnelPathTToArc(path, tHead);
  tunnelPathArcPointExtendedInto(_headPoint, path, headArc);
  const close = Math.max(.9, tunnelDockWidth(size) * 6) + _headPoint.length() * .4;
  const follow = 1 - THREE.MathUtils.smoothstep(path.armALen - headArc, .12, .9);
  const back = backForHead(tHead, size);
  const trail = THREE.MathUtils.lerp(back, smoothMin(back, close), follow);
  // Keep a readable head silhouette at the mouth. The former 0.18 start put
  // the lens inside the head's silhouette and erased the tail with proximity
  // culling. The exterior already follows the actual lens, so it can safely
  // remain outside for the first stretch of the dive.
  return headArc - Math.max(0, smoothMin(trail, 0.62 + headArc * 0.35));
}

// ── Through the core ─────────────────────────────────────────────────────────
// The lens used to drop onto the worm's own centreline for the whole core
// crossing, because both core walls are solid apart from the bore round the
// route. On that line it sat inside the body it trails, so the cull that keeps
// beads out of the lens hid most of the tail, and the band (which then had to
// be cut away in the mirror room, or it filled the lens) vanished with it.
//
// Now the lens keeps a raised chase shot the whole way. It comes down only to
// pass through each wall, and then only as far as the wall's opening needs: it
// crosses at CORE_BORE_LIFT of the opening's radius above the route, and while
// the head is on the far side of a wall it holds the line of sight to the head
// inside that opening. Inside the mirror room it rises again, toward the room's
// interior (corner routes graze a side wall) and never closer to a mirror than
// CORE_ROOM_MARGIN. Same-face returns keep their own out-of-plane shot.

/** Share of the opening's radius the lens may sit off the route at a core wall. */
export const CORE_BORE_LIFT = 0.7;
/** How high the lens rides inside the mirror room, as a share of the room's half-width (and at most TUNNEL_CAM_UP). */
export const CORE_ROOM_LIFT = 0.55;
/** Nearest the lens comes to a mirror wall (its sight corridor opens anything
 *  closer), unless the route itself runs nearer and the lens is no nearer than it. */
export const CORE_ROOM_MARGIN = 0.1;
// How fast the lens climbs away from a wall, per unit of distance from it,
// reached over WALL_EASE so the climb never jolts the lens's pace.
const WALL_CLIMB = 1.1;
const WALL_EASE = 0.35;
const climb = x => WALL_CLIMB * (x <= 0 ? 0 : x < WALL_EASE ? x * x / (2 * WALL_EASE) : x - WALL_EASE / 2);
// Blend width of the smooth minimum between the lift limits.
const LIFT_BLEND = 0.12;
const smin = (a, b, k = LIFT_BLEND) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};

const _room = {
  zoom: 1, center: new THREE.Vector3(), half: 0, shell: 0, bore: 0, boreLift: 0, active: false,
  // Where the route passes through the entry and exit mirrors, and the exit wall's outward normal.
  entryPoint: new THREE.Vector3(), exitPoint: new THREE.Vector3(), exitNormal: new THREE.Vector3(),
  exitCrossing: new THREE.Vector3(),
};
const _roomRel = new THREE.Vector3();
const _roomProbe = new THREE.Vector3();

const boxAxisMax = v => Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));

/**
 * The mirror room at `zoom`: VoidCore grows the core about the entry dock, so
 * the room is centred at dock·(1 − zoom) with half-width CORE_MIRROR_HALF·zoom,
 * inside a shell CORE_HALF·zoom (plus the stickers) across. The route enters
 * through the wall at the dock and leaves through whichever wall it crosses on
 * the way out, found by bisection from the cube's centre, which every zoom keeps
 * inside the room.
 */
function coreRoomInto(room, path, size, zoom) {
  room.zoom = zoom;
  room.center.copy(path.midA).multiplyScalar(1 - zoom);
  room.half = CORE_MIRROR_HALF * zoom;
  room.shell = (CORE_HALF + tunnelCoreScale(size) * (CORE_STICKER_OFFSET - 0.5)) * zoom;
  room.bore = coreOpeningRadius(size, zoom);
  // A same-face return leaves through the wall it entered by, and has its own shot.
  room.active = path.nStart.dot(path.nEnd) <= 0.95;
  if (!room.active) return room;
  // The route meets the entry wall square on at its dock.
  room.entryPoint.copy(path.midA).addScaledVector(path.nStart, room.half - _roomRel.subVectors(path.midA, room.center).dot(path.nStart));
  let lo = path.legArc0[3], hi = path.total;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    cameraArcPointInto(_roomProbe, path, mid);
    if (boxAxisMax(_roomRel.subVectors(_roomProbe, room.center)) < room.half) lo = mid;
    else hi = mid;
  }
  cameraArcPointInto(room.exitPoint, path, hi);
  // An oblique crossing slices the opening wider than the lens's offset from
  // the route, by 1 / cos of its angle to the wall: offset that much less.
  cameraArcPointInto(_roomProbe, path, lo);
  const crossing = room.exitCrossing.subVectors(_roomProbe, room.exitPoint).normalize();
  _roomRel.subVectors(room.exitPoint, room.center);
  const ax = Math.abs(_roomRel.x), ay = Math.abs(_roomRel.y), az = Math.abs(_roomRel.z);
  room.exitNormal.set(0, 0, 0);
  if (ax >= ay && ax >= az) room.exitNormal.x = Math.sign(_roomRel.x);
  else if (ay >= az) room.exitNormal.y = Math.sign(_roomRel.y);
  else room.exitNormal.z = Math.sign(_roomRel.z);
  const cos = Math.abs(crossing.dot(room.exitNormal));
  room.boreLift = CORE_BORE_LIFT * room.bore * (cos > 1e-3 ? Math.min(1, cos) : 1);
  return room;
}

/** Signed distance from `point` to the cube of half-width `half` about the room's centre. */
function roomBoxDistance(point, half) {
  _roomRel.subVectors(point, _room.center);
  const qx = Math.abs(_roomRel.x) - half, qy = Math.abs(_roomRel.y) - half, qz = Math.abs(_roomRel.z) - half;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0);
}
/** How far inside the mirror of the wall with outward `normal` a room point lies. */
const wallDepth = (point, normal) => _room.half - _roomRel.subVectors(point, _room.center).dot(normal);
/** How far a room point is from either opening the route passes through. */
const openingDistance = point => Math.min(point.distanceTo(_room.entryPoint), point.distanceTo(_room.exitPoint));

/**
 * The most the lens may sit off the route point `point` for the core's walls:
 * CORE_BORE_LIFT of the opening while the point is in a wall, climbing with
 * distance from the core outside it and from the crossed walls inside the room,
 * and, while the head is on the other side of a wall, no more than keeps the
 * line of sight to it inside that wall's opening.
 */
function coreLiftLimit(point, head) {
  const bore = _room.boreLift;
  const out = roomBoxDistance(point, _room.shell), inRoom = -roomBoxDistance(point, _room.half);
  const headOut = roomBoxDistance(head, _room.shell), headIn = -roomBoxDistance(head, _room.half);
  if (out > 0) {
    let limit = bore + climb(out);
    // Approaching the entry wall with the head already through it.
    const far = headIn > 0 ? wallDepth(head, _camPath.nStart) : 0;
    if (far > 1e-4) limit = smin(limit, bore * (out + far) / far);
    return limit;
  }
  if (inRoom > 0) {
    // Away from the openings the mirrors themselves bound the lens (roomLiftInto).
    let limit = bore + climb(openingDistance(point));
    // Leaving through the exit wall behind a head that is already out.
    if (headOut > 1e-4) limit = smin(limit, bore * (Math.max(0, wallDepth(point, _room.exitNormal)) + headOut) / headOut);
    return limit;
  }
  return bore;
}

// Below this zoom the core is still its own small self (reduced motion keeps it
// there): no room to ride in, so the lens keeps to the carved centreline.
const ROOM_ZOOM_FROM = 1.15;
const ROOM_ZOOM_FULL = 1.6;

function cameraRideHeight(point, arc, tHead, size) {
  const mouthClearance = THREE.MathUtils.smoothstep(Math.min(arc, _camPath.total - arc), 0.1, 0.55);
  const insideShell = THREE.MathUtils.smoothstep(size / 2 + .03 - Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)), .1, .6);
  const chase = cameraUpForHead(tHead) * mouthClearance * insideShell;
  // Follow the exact carved centerline through BOTH core holes, easing out of
  // the elevated view before any position the zoomed core can occupy (its
  // complete zoom envelope, so the shot holds still while the zoom moves).
  // Same-face returns keep this: their offset shot supplies the clearance.
  const centreline = chase * THREE.MathUtils.smoothstep(_coreBounds.distanceToPoint(point), 0.2, 1);
  const grown = _room.active ? THREE.MathUtils.smoothstep(_room.zoom, ROOM_ZOOM_FROM, ROOM_ZOOM_FULL) : 0;
  if (grown <= 0) return centreline;
  // In the room the ride is still going: the head nearing its exit mouth only
  // lowers the lens once the lens itself has left the room.
  const roomShare = THREE.MathUtils.smoothstep(-roomBoxDistance(point, _room.half), 0, 0.2);
  const rideUp = THREE.MathUtils.lerp(cameraUpForHead(tHead), TUNNEL_CAM_UP * THREE.MathUtils.smoothstep(tHead, 0.04, 0.16), roomShare);
  let limit = coreLiftLimit(point, _headPoint);
  // In the room, no higher than its share of the half-width.
  if (roomBoxDistance(point, _room.shell) < 0) limit = smin(limit, Math.max(_room.boreLift, CORE_ROOM_LIFT * _room.half));
  const raised = Math.max(0, smin(rideUp * mouthClearance * insideShell, limit));
  return THREE.MathUtils.lerp(centreline, raised, grown);
}

const _clearRel = new THREE.Vector3();
const _clearAxis = new THREE.Vector3();
const _clearRoute = new THREE.Vector3();
/** Whether the route bored through the wall at `point` (outward `normal`) passes near enough to it. */
function throughOpening(point, normal, opening, along, wallNormal) {
  if (normal.dot(wallNormal) < 0.5) return false;
  const across = along.dot(normal);
  if (Math.abs(across) < 1e-4) return false;
  _clearRoute.copy(opening).addScaledVector(along, _clearRel.subVectors(point, opening).dot(normal) / across);
  return point.distanceTo(_clearRoute) < 0.85 * _room.bore;
}
const ENTRY_ALONG = new THREE.Vector3();
/**
 * Whether a lens at `point` is clear of the core's plastic: outside the core,
 * inside the mirror room (CORE_ROOM_MARGIN from its mirrors, or no nearer to
 * them than the route point `from` it rises off: routes skim the ceiling), or
 * in a wall only where the route's opening passes through it. The shell's
 * cutout slices each wall in the plane of its own axis, so this one does too.
 */
function lensClearOfCore(point, from) {
  _clearRel.subVectors(point, _room.center);
  const ax = Math.abs(_clearRel.x), ay = Math.abs(_clearRel.y), az = Math.abs(_clearRel.z);
  const extent = Math.max(ax, ay, az);
  if (extent >= _room.shell + 0.01 || extent <= _room.half - CORE_ROOM_MARGIN) return true;
  if (extent < _room.half && extent <= boxAxisMax(_roomRel.subVectors(from, _room.center)) + 1e-3) return true;
  _clearAxis.set(0, 0, 0);
  if (ax >= ay && ax >= az) _clearAxis.x = Math.sign(_clearRel.x);
  else if (ay >= az) _clearAxis.y = Math.sign(_clearRel.y);
  else _clearAxis.z = Math.sign(_clearRel.z);
  ENTRY_ALONG.copy(_camPath.nStart).negate();
  return throughOpening(point, _clearAxis, _room.entryPoint, ENTRY_ALONG, _camPath.nStart)
    || throughOpening(point, _clearAxis, _room.exitPoint, _room.exitCrossing, _room.exitNormal);
}

const _roomPull = new THREE.Vector3();
const _roomUp = new THREE.Vector3();
const _lensProbe = new THREE.Vector3();
const LENS_SEARCH_STEP = 0.03;
/**
 * Inside the room the lift leans toward its interior: a corner tile's route
 * runs a few hundredths from a side wall, and straight "up" from it can point
 * into that wall. It never leans below the band, which would hide the worm.
 * Turns `dir` (the band's up) into a unit direction and returns the most lift
 * along it for which the lens, and everything between it and the route, stays
 * clear of the core's plastic (Infinity for a route away from the core).
 */
function roomLiftInto(dir, point, tangent, reach = TUNNEL_CAM_UP) {
  if (!_room.active) return Infinity;
  const depth = _room.half - boxAxisMax(_roomRel.subVectors(point, _room.center));
  if (depth > 0) {
    _roomUp.copy(dir).normalize();
    // Gentle only near the openings, where the lens is still low; a route that
    // skims a mirror the whole way across still leans away from it.
    const inside = THREE.MathUtils.smoothstep(openingDistance(point), 0, 0.3);
    _roomPull.subVectors(_room.center, point);
    _roomPull.addScaledVector(tangent, -_roomPull.dot(tangent)).multiplyScalar(1.2 * inside / Math.max(_room.half, 1e-6));
    dir.copy(_roomUp).add(_roomPull);
    const length = dir.length(), along = dir.dot(_roomUp);
    if (along < 0.35 * length) dir.addScaledVector(_roomUp, 0.35 * length - along);
    dir.normalize();
  }
  if (roomBoxDistance(point, _room.shell) > reach + 0.02) return Infinity;
  // March out from the route; the first blocked step, refined, is the limit.
  let clear = 0;
  for (let lift = LENS_SEARCH_STEP; lift <= reach + 1e-6; lift += LENS_SEARCH_STEP) {
    if (lensClearOfCore(_lensProbe.copy(point).addScaledVector(dir, lift), point)) { clear = lift; continue; }
    let lo = clear, hi = lift;
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      if (lensClearOfCore(_lensProbe.copy(point).addScaledVector(dir, mid), point)) lo = mid; else hi = mid;
    }
    return lo;
  }
  return Infinity;
}

const _cameraLift = new THREE.Vector3();
const _returnSide = new THREE.Vector3();
function returnCameraOffsetInto(out, path, tHead, camArc, point, size) {
  out.set(0, 0, 0);
  if (path.nStart.dot(path.nEnd) <= 0.95) return out;
  out.subVectors(path.midB, path.midA).cross(path.nStart).normalize();
  const shoulder = THREE.MathUtils.smoothstep(tHead, 0.18, 0.38)
    * (1 - THREE.MathUtils.smoothstep(tHead, 0.72, 0.94));
  const mouth = THREE.MathUtils.smoothstep(Math.min(camArc, path.total - camArc), 0.1, 0.8);
  let room = 0.9;
  const half = size / 2 - 0.12;
  for (const axis of ['x', 'y', 'z']) {
    if (Math.abs(out[axis]) > 1e-8) room = Math.min(room, Math.max(0, (half - Math.sign(out[axis]) * point[axis]) / Math.abs(out[axis])));
  }
  return out.multiplyScalar(room * shoulder * mouth);
}
function cameraLiftInto(out, up, tHead) {
  // During entry, raising the view must not push it back toward the mouth as
  // the transported frame bends. Release that constraint beyond the entry arm.
  return out.copy(up).addScaledVector(_camPath.nStart,
    -up.dot(_camPath.nStart) * (1 - THREE.MathUtils.smoothstep(tHead, ARM_A_END, ARM_A_END + .08)));
}

/**
 * The lens's offset from the route point `point` (at `arc`): writes its
 * direction into `dir`, from the band's `up` and the route's `tangent`, and
 * returns how far along it the lens sits. Shared by the ride and the dive so the
 * dive lands exactly on the rail.
 */
function rideLiftInto(dir, point, arc, tHead, size, up, tangent) {
  cameraLiftInto(dir, up, tHead);
  const height = cameraRideHeight(point, arc, tHead, size);
  if (height <= 0) return 0;
  return Math.max(0, smin(height, roomLiftInto(dir, point, tangent)));
}

// How far apart the two samples used to differentiate the route are, in world
// units. Small enough to read as the local direction of travel, large enough not
// to be swamped by float noise at the throat/diagonal corner.
const TANGENT_EPS = 0.05;

// How far ahead of the LENS the aim point sits, in world units along the route.
// The head is backForHead() ahead of the lens (0.8–1.2 across the supported cube
// sizes), so this lands just past it — the worm stays in frame with the route it
// is about to take opening up beyond it.
const LOOK_AHEAD_ARC = 1.6;

// How much of the aim direction comes from the local direction of travel versus
// from where the route runs LOOK_AHEAD_ARC further on. Keeping the tangent in the
// majority bounds how far the shot can swing at the core's right-angle bend.
const LEAD_TANGENT_MIX = 0.62;

function cameraArcPointInto(out, path, arc) {
  return arc < 0 || arc > path.total
    ? tunnelPathArcPointExtendedInto(out, path, arc)
    : getTunnelArcPosSmoothInto(out, path, arc);
}

const _lead = new THREE.Vector3();
const _rideFrame = makeTunnelRideFrame();
const _mouthSide = new THREE.Vector3();
const _mouthFrame = makeTunnelRideFrame();

// Sit beside the string of beads when the track narrows into an outer mouth.
// The old axial lens had to hide them to avoid filming from inside the worm.
// Stay within the .325 bore, and release this shoulder before the core shot.
function mouthShoulderInto(out, point, arc) {
  const weight = 1 - THREE.MathUtils.smoothstep(Math.min(arc, _camPath.total - arc), 0.15, 1.0);
  tunnelCameraFrameInto(_mouthFrame, _camPath, arc);
  out.copy(_mouthFrame.right).multiplyScalar(0.28 * weight);
  if (_room.active && !lensClearOfCore(_lensProbe.copy(point).add(out), point)) out.set(0, 0, 0);
  return out;
}

/**
 * Write the on-rails camera pose at `tHead` into `out`.
 *
 * The lens rides the route itself: it sits a fixed distance BEHIND the head
 * measured along the centerline — through the throat, round the bend, out the far
 * mouth — rather than a fixed distance back along the head's current tangent. The
 * distinction is the whole ballgame at the aperture. A tangent-trailing camera
 * leaves the tile's axis the instant the path bends and crosses the cube's surface
 * through whichever tile happens to be over there; a route-trailing one goes where
 * the head went, which is down the middle of the hole.
 *
 * @param {{cam: THREE.Vector3, look: THREE.Vector3, up: THREE.Vector3, tangent: THREE.Vector3}} out
 * @param {Object} tunnel  active tunnel descriptor (entry/exit tiles)
 * @param {number} tHead   0→1 position of the worm's head along the traversal
 * @param {number} size    cube size
 * @param {number} [zoom]  the core's live zoom (VoidCore's tunnelState.coreZoom);
 *                         the ride's full zoom when omitted
 * @returns {typeof out}
 */
export function tunnelCamPoseInto(out, tunnel, tHead, size, zoom = null) {
  buildTunnelPathForTunnel(_camPath, tunnel, size);
  coreZoomBoundsInto(_coreBounds, _camPath.midA, size);
  coreRoomInto(_room, _camPath, size, zoom ?? coreZoomLimit(_camPath.midA, size));
  const camArc = cameraArcForHead(_camPath, tHead, size);
  out.lensT = tunnelPathArcToT(_camPath, camArc);

  cameraArcPointInto(out.cam, _camPath, camArc);

  // Direction of travel AT THE CAMERA, not at the head: it is what the camera's
  // own up-vector and look-ahead are built from, and while the head is already
  // round the bend the camera is still coming down the throat.
  cameraArcPointInto(_fwd, _camPath, camArc + TANGENT_EPS);
  out.tangent.subVectors(_fwd, out.cam);
  if (out.tangent.lengthSq() < 1e-12) out.tangent.copy(_camPath.nStart).negate();
  out.tangent.normalize();

  // Keep the gentle banking while the lens goes through the core openings.
  tunnelCameraFrameInto(_rideFrame, _camPath, camArc);
  out.up.copy(_rideFrame.normal);
  if (camArc >= 0 && camArc <= _camPath.total) out.tangent.copy(_rideFrame.tangent);

  // Aim: mostly straight down the direction of travel, leaned toward where the
  // route goes next. Aiming *only* at the route point ahead swings the shot into a
  // corner well before reaching it (the core bend can be a right angle); aiming
  // only along the tangent stares at the wall beside that corner. The blend leans
  // in the way a headlight does, and on a straight run the two agree exactly, so
  // nothing is disturbed on the tunnels that do not bend.
  //
  // Establish the forward lead before adding the elevated riding view below.
  tunnelPathArcPointExtendedInto(_lead, _camPath, camArc + LOOK_AHEAD_ARC);
  _lead.sub(out.cam);
  if (_lead.lengthSq() < 1e-12) _lead.copy(out.tangent);
  else _lead.normalize();
  out.look.copy(out.tangent).multiplyScalar(LEAD_TANGENT_MIX)
    .addScaledVector(_lead, 1 - LEAD_TANGENT_MIX)
    .normalize()
    .multiplyScalar(LOOK_AHEAD_ARC);

  // Clear the worm's back once inside, then look slightly down at the track.
  // A parallel raised aim left the core and worm at the bottom of a phone view.
  // Through the core the lift leans toward the mirror room's interior and stays
  // clear of its walls (see "Through the core" above).
  const rideHeight = rideLiftInto(_cameraLift, out.cam, camArc, tHead, size, out.up, out.tangent);
  out.lift = rideHeight;
  out.cam.addScaledVector(_cameraLift, rideHeight);
  out.look.add(out.cam).addScaledVector(_cameraLift, -rideHeight * 0.75);
  // From the raised lens keep looking down the track (rideFraming holds the
  // head in frame). Lock to the head while the lens is low in a core opening.
  const followHead = (1 - THREE.MathUtils.smoothstep(_coreBounds.distanceToPoint(_headPoint), 0, .5))
    * (1 - THREE.MathUtils.smoothstep(rideHeight, 0, .15));
  out.look.lerp(_headPoint, followHead);
  // A same-face return passes the incoming rail at almost zero distance. Move
  // the lens out of that plane before the head turns back; a rotation cap alone
  // cannot keep a head that crosses the lens in view. Both mouths stay axial.
  if (_camPath.nStart.dot(_camPath.nEnd) > 0.95) {
    out.cam.add(returnCameraOffsetInto(_returnSide, _camPath, tHead, camArc, out.cam, size));
    out.lift = Math.max(out.lift, _returnSide.length());
    out.look.copy(_headPoint);
    // A return has no stable tangent-defined horizon at the U-turn. Use the
    // mouths' separation as its screen-up reference; it stays transverse to
    // this offset shot and avoids a second whip from banking at the reversal.
    out.up.subVectors(_camPath.midB, _camPath.midA).normalize();
  }
  mouthShoulderInto(_mouthSide, out.cam, camArc);
  out.cam.add(_mouthSide);
  out.lift = Math.max(out.lift, _mouthSide.length());
  return out;
}

/** Allocate a reusable pose object for tunnelCamPoseInto. */
export const makeTunnelCamPose = () => ({
  cam: new THREE.Vector3(),
  look: new THREE.Vector3(),
  up: new THREE.Vector3(),
  tangent: new THREE.Vector3(),
  // Where the LENS is along the route, in the head's traversal t (0 at the
  // entry mouth, 0.5 at the centre). The lens trails the head by most of a
  // cubie, so beats the player should see happen when the lens gets there.
  lensT: 0,
  // How far the lens sits off the route (the band clears less round a raised lens).
  lift: 0
});

const _poseMatrix = new THREE.Matrix4();
const _poseA = new THREE.Quaternion();
const _poseB = new THREE.Quaternion();
const _poseDir = new THREE.Vector3();
const _poseUp = new THREE.Vector3();
function poseQuaternionInto(out, pose) {
  _poseDir.subVectors(pose.look, pose.cam).normalize();
  _poseUp.copy(pose.up).addScaledVector(_poseDir, -pose.up.dot(_poseDir));
  if (_poseUp.lengthSq() < 1e-8) {
    _poseUp.set(Math.abs(_poseDir.y) > 0.9 ? 1 : 0, Math.abs(_poseDir.y) > 0.9 ? 0 : 1, 0);
    _poseUp.addScaledVector(_poseDir, -_poseUp.dot(_poseDir));
  }
  return out.setFromRotationMatrix(_poseMatrix.lookAt(pose.cam, pose.look, _poseUp.normalize()));
}

/** Blend full rotations; opposing look/up vectors never pass through zero. */
export function blendTunnelPosesInto(out, from, to, t) {
  poseQuaternionInto(_poseA, from);
  poseQuaternionInto(_poseB, to);
  _poseA.slerp(_poseB, t);
  out.cam.lerpVectors(from.cam, to.cam, t);
  out.up.set(0, 1, 0).applyQuaternion(_poseA);
  out.look.set(0, 0, -THREE.MathUtils.lerp(from.cam.distanceTo(from.look), to.cam.distanceTo(to.look), t))
    .applyQuaternion(_poseA).add(out.cam);
  return out;
}

const _entryRide = makeTunnelCamPose();
const _entryStart = makeTunnelCamPose();
const _entryRideUp = new THREE.Vector3();
const _entryLateral = new THREE.Vector3();
const _entryTangent = new THREE.Vector3();
const _rollAxis = new THREE.Vector3();
const _rollA = new THREE.Vector3();
const _rollB = new THREE.Vector3();
const _rollC = new THREE.Vector3();

/**
 * Signed turn about `to`'s view axis that carries its screen-up onto `from`'s.
 * Opposite ups have no preferred side, so that case always turns the same way
 * and the sign cannot flicker from frame to frame.
 */
function rollBetween(from, to) {
  _rollAxis.subVectors(to.look, to.cam).normalize();
  _rollA.copy(from.up).addScaledVector(_rollAxis, -from.up.dot(_rollAxis));
  _rollB.copy(to.up).addScaledVector(_rollAxis, -to.up.dot(_rollAxis));
  if (_rollA.lengthSq() < 1e-8 || _rollB.lengthSq() < 1e-8) return 0;
  _rollA.normalize(); _rollB.normalize();
  const angle = Math.atan2(_rollAxis.dot(_rollC.crossVectors(_rollB, _rollA)), _rollB.dot(_rollA));
  return Math.abs(angle) > Math.PI - 1e-3 ? Math.PI : angle;
}

// The band's screen-up can differ from the approach's by up to a half turn.
// The dive keeps the approach's up and the lens rolls onto the band over the
// rest of the entry arm, inside the tunnel, instead of spinning at the mouth.
const ENTRY_ROLL_START = 0.12;

/** Dive along route distance, so corner-tile tunnels use their own opening too. */
export function tunnelEntryPoseInto(out, tunnel, progress, size, from, zoom = null) {
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  const tHead = tunnelTraversalT('entering', p);
  tunnelCamPoseInto(_entryStart, tunnel, tunnelTraversalT('entering', 0), size, zoom);
  const settle = rollBetween(from, _entryStart);
  tunnelCamPoseInto(_entryRide, tunnel, tHead, size, zoom);
  // Position lift follows the transported rail, independently of shot banking.
  _entryRideUp.copy(_rideFrame.normal);
  const remaining = settle * (1 - THREE.MathUtils.smoothstep(p, ENTRY_ROLL_START, 1));
  if (remaining) _entryRide.up.applyAxisAngle(_rollAxis.subVectors(_entryRide.look, _entryRide.cam).normalize(), remaining);
  const blend = diveProgress(p);
  blendTunnelPosesInto(out, from, _entryRide, blend);
  _entryLateral.subVectors(from.cam, _camPath.vStart);
  const height = _entryLateral.dot(_camPath.nStart);
  _entryLateral.addScaledVector(_camPath.nStart, -height);
  const arc = THREE.MathUtils.lerp(-height,
    cameraArcForHead(_camPath, tHead, size), blend);
  out.lensT = tunnelPathArcToT(_camPath, arc);
  _poseDir.subVectors(out.look, out.cam);
  cameraArcPointInto(out.cam, _camPath, arc);
  // Centre on the mouth over the whole descent, so an offset approach (the
  // raised pad's shot sits behind the heading) never slides in at the last moment.
  out.cam.addScaledVector(_entryLateral, diveEase(-arc / Math.max(0.1, height)));
  cameraArcPointInto(_entryTangent, _camPath, arc + TANGENT_EPS).sub(out.cam);
  if (_entryTangent.lengthSq() < 1e-12) _entryTangent.copy(_camPath.nStart).negate();
  out.lift = rideLiftInto(_cameraLift, out.cam, arc, tHead, size, _entryRideUp, _entryTangent.normalize()) * blend;
  out.cam.addScaledVector(_cameraLift, out.lift);
  out.cam.addScaledVector(returnCameraOffsetInto(_returnSide, _camPath, tHead, arc, out.cam, size), blend);
  out.lift = Math.max(out.lift, _returnSide.length() * blend);
  mouthShoulderInto(_mouthSide, out.cam, arc);
  out.cam.addScaledVector(_mouthSide, blend);
  out.lift = Math.max(out.lift, _mouthSide.length() * blend);
  out.look.copy(out.cam).add(_poseDir);
  return out;
}

/** The underlying exit-arm rail; emergence builds continuously on this pose. */
export function tunnelExitPoseInto(out, tunnel, progress, size, zoom = null) {
  return tunnelCamPoseInto(out, tunnel, tunnelTraversalT('exiting', THREE.MathUtils.clamp(progress, 0, 1)), size, zoom);
}

// Start the surface reveal while the head is still on the exit arm. The same
// clock runs through windout, so neither position nor orientation cuts at the
// phase boundary. Thread the actual curved bore before fanning out above the
// pad; a straight lerp to the chase cuts diagonally through the solid cubie.
export const EXIT_REVEAL_START = 0.35;
const _emergeRide = makeTunnelCamPose();
const _emergeAxis = new THREE.Vector3();
const _emergeOffset = new THREE.Vector3();
const _emergeSide = new THREE.Vector3();
const _emergeSurface = new THREE.Vector3();
const _emergeFrame = makeTunnelRideFrame();

export function tunnelEmergencePoseInto(out, tunnel, phase, progress, size, surface, zoom = null) {
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  const exitP = phase === 'windout' ? 1 : p;
  tunnelExitPoseInto(_emergeRide, tunnel, exitP, size, zoom);
  const arm = tunnelArmSeconds(tunnel), handoff = tunnelHandoffSeconds(tunnel);
  const elapsed = phase === 'windout' ? (1 - EXIT_REVEAL_START) * arm + p * handoff
    : (p - EXIT_REVEAL_START) * arm;
  const blend = diveEase(elapsed / ((1 - EXIT_REVEAL_START) * arm + handoff));
  blendTunnelPosesInto(out, _emergeRide, surface, blend);
  const rideArc = cameraArcForHead(_camPath, tunnelTraversalT('exiting', exitP), size);
  cameraArcPointInto(_emergeAxis, _camPath, rideArc);
  _emergeOffset.subVectors(_emergeRide.cam, _emergeAxis);
  _emergeSurface.subVectors(surface.cam, _camPath.vEnd);
  const height = Math.max(0.15, _emergeSurface.dot(_camPath.nEnd));
  _emergeSurface.addScaledVector(_camPath.nEnd, -height);
  // A shoulder inside the 0.325-radius bore lets the worm stay in view as the
  // lens passes beside it. Only expand to the full chase once clear of the lip.
  const arc = THREE.MathUtils.lerp(rideArc, _camPath.total + height, blend);
  const outside = THREE.MathUtils.smoothstep(arc - _camPath.total, 0.08, height);
  tunnelCameraFrameInto(_emergeFrame, _camPath, arc);
  cameraArcPointInto(_emergeAxis, _camPath, arc);
  // Give the overtaking move room inside the cube, then tuck into the bore.
  // A fixed mouth-sized shoulder for the entire arm passed too close to the
  // head and produced a rapid pan even without the old camera cut.
  const innerHalf = (size - 1) / 2 * cubeExpansionScale(size, tunnel.padExpansion ?? 0) + 0.4;
  let shoulder = 0.7;
  for (const axis of ['x', 'y', 'z']) {
    const direction = _emergeFrame.right[axis];
    if (Math.abs(direction) > 1e-6) shoulder = Math.min(shoulder,
      (innerHalf - Math.sign(direction) * _emergeAxis[axis]) / Math.abs(direction));
  }
  const toMouth = _camPath.total - arc;
  shoulder = THREE.MathUtils.lerp(0.28, Math.max(0.28, shoulder), THREE.MathUtils.smoothstep(toMouth, 0.4, 1.2));
  _emergeSide.copy(_emergeFrame.right).multiplyScalar(shoulder).lerp(_emergeSurface, outside);
  _emergeOffset.lerp(_emergeSide, THREE.MathUtils.smoothstep(blend, 0, 0.18));
  cameraArcPointInto(out.cam, _camPath, arc).add(_emergeOffset);
  out.lensT = tunnelPathArcToT(_camPath, Math.min(arc, _camPath.total));
  out.lift = _emergeOffset.length();
  return out;
}

// ── Crossing close-up ────────────────────────────────────────────────────────
// Frame the crossing head while the lens trails the entry dock: aim at it, and
// narrow the lens until the entry opening fills CROSSING_FILL of the frame's
// narrower half (corePassage opens a bounded line of sight to the head, so the
// shot can follow the worm through bends). Release before the lens reaches the
// dock to rejoin the broad tunnel view.
//
// It used to narrow further, to a 30-degree telephoto holding the thin in-core
// head at 8% of the frame height. That suited the old lens on the worm's own
// centreline peering down the hole, but from the raised lens (see "Through the
// core") it magnified the band and the body under the lens into slabs and read
// as a camera jammed up against the tail. The worm is in view without it.
// The opening's radius as a share of the frame's narrower half-extent.
export const CROSSING_FILL = 0.75;
// Never narrower than this (a telephoto magnifies every wobble of the rail).
export const CROSSING_FOV_MIN = 30;
// Start closing in as the head comes within this much route of the entry dock.
const CLOSE_UP_LEAD = 0.3;
// Back to the wide ride lens by the time the lens is this far short of the dock.
const CLOSE_UP_RELEASE = 0.35;
const _closePose = makeTunnelCamPose();

export const makeCrossingCloseUp = () => ({ weight: 0, center: new THREE.Vector3(), subject: new THREE.Vector3(), radius: 0, distance: 1 });

/**
 * The crossing close-up for the head at `tHead`: `weight` 0–1, and the entry
 * opening the lens frames (its `center`, the entry dock, which the core's zoom
 * never moves; its `radius` at the live `zoom`; and its `distance` from the lens).
 */
export function crossingCloseUpInto(out, tunnel, tHead, size, zoom = 1) {
  buildTunnelPathForTunnel(_camPath, tunnel, size);
  const dock = _camPath.armALen;
  const headArc = tunnelPathTToArc(_camPath, tHead);
  const camArc = cameraArcForHead(_camPath, tHead, size);
  out.weight = THREE.MathUtils.smoothstep(headArc - dock, -CLOSE_UP_LEAD, 0)
    * (1 - THREE.MathUtils.smoothstep(camArc - dock, -CLOSE_UP_RELEASE, 0));
  out.center.copy(_camPath.midA);
  out.radius = coreOpeningRadius(size, zoom);
  tunnelPathArcPointExtendedInto(out.subject, _camPath, headArc);
  tunnelCamPoseInto(_closePose, tunnel, tHead, size, zoom);
  out.distance = _closePose.cam.distanceTo(out.center);
  return out;
}

/**
 * The vertical FOV (degrees) that shows the close-up's opening at CROSSING_FILL
 * of the frame's narrower half-extent, for a viewport `aspect` (width / height),
 * within [CROSSING_FOV_MIN, `widest`].
 */
export function crossingFov(closeUp, aspect, widest) {
  const tanNarrow = closeUp.radius / (CROSSING_FILL * Math.max(closeUp.distance, 1e-3));
  const fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanNarrow / Math.min(1, aspect)));
  return THREE.MathUtils.clamp(fov, CROSSING_FOV_MIN, widest);
}
