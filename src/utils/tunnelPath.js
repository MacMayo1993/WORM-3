// src/utils/tunnelPath.js
//
// The one definition of a wormhole's centerline.
//
// A tunnel joins two antipodal stickers through the cube's core. The obvious
// route — surface anchor straight to the mini-cube's docking point — is wrong for
// every tile that is not the dead centre of its face: the very first millimetre of
// the path already leans sideways, so the worm dives *diagonally* under the face
// and the chase camera, trailing behind it along that same slanted tangent,
// crosses the surface through a neighbouring tile instead of through the hole it
// is supposed to be falling into. On a 5×5 corner tile the head slid more than two
// tiles sideways before it reached the core.
//
// So each mouth now opens into a THROAT: a straight run along the tile's own
// outward normal, taken before the path is allowed to bend toward the core. Inside
// the throat the tangent IS the face normal, which means:
//   • the worm sinks straight down through the middle of its hole, and
//   • the camera — which rides the same centerline — passes through the aperture
//     rather than through the tile next door.
// Only once it is a cubie deep, hidden inside the cube where nobody can tell,
// does the route turn for the core.
//
// Pure geometry (THREE vectors in, THREE vectors out) so the claims above are
// testable without a renderer: both the ribbon mesh (MobiusTunnel) and everything
// that rides it (worm head, body, camera, tube shell) sample this module, so the
// mesh and the motion cannot drift apart the way they did when each carried its
// own copy of the piecewise formula.
//
// Allocation-free by construction: every sampler runs per body segment per frame,
// so the leg table is built once into the path object and only ever read.

import * as THREE from 'three';

/** Half-width of the VoidCore mini-cube — must match MINI_S in VoidCore.jsx. */
export const TUNNEL_MINI_FACE_R = 0.25;

/**
 * Depth of the straight axial run inside each mouth, in world units (one cubie is
 * 1.0). Deep enough that the dive is unmistakably *into the hole* and that the
 * camera's trailing distance is spent on the tile's own axis; short enough to
 * leave the core crossing room to read as a crossing.
 */
export const TUNNEL_THROAT = 0.9;

/** Never spend more than this fraction of a mouth's depth on its throat. */
export const TUNNEL_THROAT_MAX_FRACTION = 0.55;

/**
 * Smallest share of an arm's parameter span given to its throat.
 *
 * Purely a pacing choice, and the reason the entry beat reads as being *sucked in*
 * rather than clipping through the surface: the throat is short in world units
 * next to the long diagonal to the core, so splitting the arm's t strictly by
 * length would flash past the aperture in a couple of frames. Holding this floor
 * keeps the worm on the tile axis for a beat and then lets it accelerate away into
 * the core.
 */
export const TUNNEL_THROAT_T_SHARE = 0.45;

// t landmarks of the traversal parameterisation, unchanged from when the path was
// three legs: the entry arm owns [0, ARM_A_END], the core crossing the span up to
// ARM_B_START, and the exit arm the rest. Phases, portal charge and the tube's
// head marker are all expressed against these.
export const ARM_A_END = 0.4;
export const ARM_B_START = 0.6;

const LEG_COUNT = 5;
const _axial = new THREE.Vector3();

/** Allocate a reusable path object. Fill it with buildTunnelPathInto. */
export const makeTunnelPath = () => {
  const path = {
    // Control points, mouth to mouth.
    vStart: new THREE.Vector3(),   // entry sticker surface
    throatA: new THREE.Vector3(),  // straight down the entry tile's normal
    midA: new THREE.Vector3(),     // entry-side dock on the mini-cube
    midB: new THREE.Vector3(),     // exit-side dock on the mini-cube
    throatB: new THREE.Vector3(),  // straight up the exit tile's normal
    vEnd: new THREE.Vector3(),     // exit sticker surface
    // Per-leg world lengths and the parameter span each leg occupies.
    legLen: [0, 0, 0, 0, 0],
    legT: [0, 0, 0, 0, 0],
    legT0: [0, 0, 0, 0, 0],
    legArc0: [0, 0, 0, 0, 0],
    // Outward unit normals of the two mouths, kept so samplers can extrapolate off
    // the ends of the path (a camera trailing the head is outside the cube before
    // the head has gone in, and again after it comes out).
    nStart: new THREE.Vector3(),
    nEnd: new THREE.Vector3(),
    armALen: 0,
    armBLen: 0,
    total: 0,
    // Endpoint tables — references to the vectors above, so samplers never allocate.
    legA: null,
    legB: null
  };
  path.legA = [path.vStart, path.throatA, path.midA, path.midB, path.throatB];
  path.legB = [path.throatA, path.midA, path.midB, path.throatB, path.vEnd];
  return path;
};

/**
 * How deep a mouth's throat runs: capped both absolutely and as a fraction of the
 * distance from the surface anchor down to the plane of its core dock, so a tile
 * whose dock is close (small cubes, or a 2×2 where the core is right there) gets a
 * proportionally shorter throat instead of one that overshoots past the core.
 */
function throatDepth(anchor, normal, dock) {
  _axial.subVectors(anchor, dock);
  const depth = _axial.dot(normal);
  if (!(depth > 0)) return 0;
  return Math.min(TUNNEL_THROAT, depth * TUNNEL_THROAT_MAX_FRACTION);
}

/**
 * Fill `path` from the two mouths.
 *
 * @param {ReturnType<makeTunnelPath>} path
 * @param {THREE.Vector3} vStart entry sticker's surface anchor
 * @param {THREE.Vector3} n1     entry face outward unit normal (throat direction)
 * @param {THREE.Vector3} vEnd   exit sticker's surface anchor
 * @param {THREE.Vector3} n2     exit face outward unit normal (throat direction)
 * @param {THREE.Vector3} [dockN1] entry dock direction on the mini-cube, if it differs
 *   from n1. A tile that is mid-flip or riding a rotating slice has a world normal that
 *   no longer matches its colour's face, and the core dock must follow the colour (see
 *   MobiusTunnel) while the throat follows the tile the worm is actually falling through.
 * @param {THREE.Vector3} [dockN2] exit dock direction, same reasoning.
 */
export function buildTunnelPathInto(path, vStart, n1, vEnd, n2, dockN1 = n1, dockN2 = n2) {
  path.vStart.copy(vStart);
  path.vEnd.copy(vEnd);
  path.nStart.copy(n1).normalize();
  path.nEnd.copy(n2).normalize();
  path.midA.copy(dockN1).multiplyScalar(TUNNEL_MINI_FACE_R);
  path.midB.copy(dockN2).multiplyScalar(TUNNEL_MINI_FACE_R);
  path.throatA.copy(vStart).addScaledVector(n1, -throatDepth(vStart, n1, path.midA));
  path.throatB.copy(vEnd).addScaledVector(n2, -throatDepth(vEnd, n2, path.midB));

  let total = 0;
  for (let i = 0; i < LEG_COUNT; i++) {
    const len = path.legA[i].distanceTo(path.legB[i]);
    path.legLen[i] = len;
    path.legArc0[i] = total;
    total += len;
  }
  path.total = total;
  path.armALen = path.legLen[0] + path.legLen[1];
  path.armBLen = path.legLen[3] + path.legLen[4];

  // Split each arm's parameter span between its throat and its diagonal. By length
  // the throat is the short one, so the floor is what usually decides — see
  // TUNNEL_THROAT_T_SHARE.
  const shareA = path.armALen > 0
    ? Math.max(TUNNEL_THROAT_T_SHARE, path.legLen[0] / path.armALen)
    : 0;
  const shareB = path.armBLen > 0
    ? Math.max(TUNNEL_THROAT_T_SHARE, path.legLen[4] / path.armBLen)
    : 0;
  path.legT[0] = path.legLen[0] > 0 ? ARM_A_END * shareA : 0;
  path.legT[1] = ARM_A_END - path.legT[0];
  path.legT[2] = ARM_B_START - ARM_A_END;
  path.legT[4] = path.legLen[4] > 0 ? (1 - ARM_B_START) * shareB : 0;
  path.legT[3] = (1 - ARM_B_START) - path.legT[4];

  let t0 = 0;
  for (let i = 0; i < LEG_COUNT; i++) {
    path.legT0[i] = t0;
    t0 += path.legT[i];
  }
  return path;
}

/** Index of the last leg whose parameter span has started by t. */
function legIndexForT(path, t) {
  for (let i = LEG_COUNT - 1; i >= 0; i--) {
    if (path.legT[i] > 0 && t >= path.legT0[i]) return i;
  }
  for (let i = 0; i < LEG_COUNT; i++) if (path.legT[i] > 0) return i;
  return 0;
}

/** Write the world position at traversal parameter t (0 = entry mouth, 1 = exit mouth). */
export function tunnelPathPointInto(out, path, t) {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  const i = legIndexForT(path, c);
  const f = path.legT[i] > 0 ? Math.min(1, Math.max(0, (c - path.legT0[i]) / path.legT[i])) : 0;
  return out.lerpVectors(path.legA[i], path.legB[i], f);
}

/** Convert traversal parameter t to world arc-length along the path. */
export function tunnelPathTToArc(path, t) {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  const i = legIndexForT(path, c);
  const f = path.legT[i] > 0 ? Math.min(1, Math.max(0, (c - path.legT0[i]) / path.legT[i])) : 0;
  return path.legArc0[i] + path.legLen[i] * f;
}

/** Write the world position at a given world arc-length (clamped to the path). */
export function tunnelPathArcPointInto(out, path, arc) {
  const a = arc < 0 ? 0 : arc > path.total ? path.total : arc;
  for (let i = LEG_COUNT - 1; i >= 0; i--) {
    if (path.legLen[i] <= 0) continue;
    if (a >= path.legArc0[i] || i === 0) {
      const f = Math.min(1, Math.max(0, (a - path.legArc0[i]) / path.legLen[i]));
      return out.lerpVectors(path.legA[i], path.legB[i], f);
    }
  }
  return out.copy(path.vEnd);
}

/**
 * Like tunnelPathArcPointInto, but arc-lengths outside [0, total] continue in a
 * straight line out of the mouth they left by, along that tile's normal.
 *
 * This is what lets a camera trail the worm's head by a fixed distance *along the
 * route* instead of along the instantaneous tangent. Trailing along the tangent is
 * how the lens ended up crossing the face through a neighbouring tile: the moment
 * the head is past the throat the tangent leans, and a camera a whole unit back on
 * that leaning line is a whole unit off the tile's axis. Following the route means
 * the camera is wherever the head was — through the hole, dead centre.
 */
export function tunnelPathArcPointExtendedInto(out, path, arc) {
  if (arc < 0) return out.copy(path.vStart).addScaledVector(path.nStart, -arc);
  if (arc > path.total) return out.copy(path.vEnd).addScaledVector(path.nEnd, arc - path.total);
  return tunnelPathArcPointInto(out, path, arc);
}

// ── Ribbon parameterisation ──────────────────────────────────────────────────
// The rendered band splits its own u at the core gap: u ∈ [0, 0.5] sweeps the
// entry arm, u ∈ [0.5, 1] the exit arm, with the mini-cube's interior skipped.
// Sampling by arc-length within each arm keeps the tessellation even across the
// throat/diagonal bend instead of bunching vertices at the corner.

/** Leg index for ribbon parameter u, or -1 when the path is degenerate. */
function ribbonLegForU(path, u) {
  if (u <= 0.5) {
    const arc = (u / 0.5) * path.armALen;
    if (path.legLen[1] <= 0) return 0;
    if (path.legLen[0] <= 0) return 1;
    return arc <= path.legLen[0] ? 0 : 1;
  }
  const arc = ((u - 0.5) / 0.5) * path.armBLen;
  if (path.legLen[4] <= 0) return 3;
  if (path.legLen[3] <= 0) return 4;
  return arc <= path.legLen[3] ? 3 : 4;
}

/**
 * Fraction along `leg` that ribbon parameter u sits at. Arc is measured from the
 * start of the arm the leg belongs to (vStart for arm A, midB for arm B).
 */
function ribbonFracForU(path, u, leg) {
  const len = path.legLen[leg];
  if (len <= 0) return 0;
  const arc = leg <= 1
    ? (Math.min(0.5, Math.max(0, u)) / 0.5) * path.armALen
    : ((Math.min(1, Math.max(0.5, u)) - 0.5) / 0.5) * path.armBLen;
  const armArc0 = leg === 1 ? path.legLen[0] : leg === 4 ? path.legLen[3] : 0;
  return Math.min(1, Math.max(0, (arc - armArc0) / len));
}

/** Write the ribbon's centre position at u ∈ [0,1] (arm A: u<0.5, arm B: u>0.5). */
export function tunnelPathRibbonInto(out, path, u) {
  const c = u < 0 ? 0 : u > 1 ? 1 : u;
  const leg = ribbonLegForU(path, c);
  return out.lerpVectors(path.legA[leg], path.legB[leg], ribbonFracForU(path, c, leg));
}

/** Write the unit tangent of the ribbon at u ∈ [0,1]. */
export function tunnelPathRibbonTangentInto(out, path, u) {
  const leg = ribbonLegForU(path, u < 0 ? 0 : u > 1 ? 1 : u);
  out.subVectors(path.legB[leg], path.legA[leg]);
  if (out.lengthSq() < 1e-12) out.set(0, 1, 0);
  return out.normalize();
}
