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

/** Half-width of the antipodal core cube at the centre (VoidCore.jsx). */
export const TUNNEL_MINI_FACE_R = 0.2125;

// ── The antipodal core and its docks ─────────────────────────────────────────
// The centre holds a miniature of the cube, TUNNEL_MINI_FACE_R·2 wide at every
// board size, in which each tile shows its antipodal partner. A tunnel docks on
// the miniature's own tile directly beneath its mouth (the one showing where the
// tunnel leads), crosses through the centre (the one point the antipodal map
// fixes), and leaves by the miniature's tile beneath the far mouth (the one
// showing where it came from). Because the miniature is a scaled copy about the
// centre, "beneath" is exact: a tile's dock lies on the ray from the centre
// through the tile, and a solved cube's partners, which are true antipodes,
// give a straight diameter.

/** How much the core shrinks an N×N cube: it is always TUNNEL_MINI_FACE_R·2 wide. */
export const tunnelCoreScale = (size) => (2 * TUNNEL_MINI_FACE_R) / Math.max(1, size);

/**
 * A tile's dock: the core's sticker beneath it. `centre` is the tile's cubie
 * centre in unexploded, centred cube coordinates and `normal` its outward face
 * normal; mid-turn both may carry the slice's rotation, which the core copies.
 */
export function tunnelDockInto(out, centre, normal, size) {
  return out.copy(normal).multiplyScalar(0.5).add(centre).multiplyScalar(tunnelCoreScale(size));
}

// ── Gauge: how wide a tunnel is ──────────────────────────────────────────────
// A tunnel plugs into its core tile at exactly that tile's width, and flares
// only gently on the way out to its own tile: at most twice the core tile, and
// never past TUNNEL_MOUTH_WIDTH. Every tunnel renderer takes its width from here
// so the band, its rails and the hint cords all fit the tile they dock on.

/** A core sticker's width as a share of its (shrunk) cubie, like the play cube's. */
export const TUNNEL_CORE_TILE = 0.86;
/** The widest a tunnel gets, at its own tile — under half a play tile. */
export const TUNNEL_MOUTH_WIDTH = 0.36;
/** How far a tunnel flares from its core tile to its own tile, at most. */
export const TUNNEL_FLARE = 2;

/** Width of the core tile a tunnel docks on: the band's width where it plugs in. */
export const tunnelDockWidth = (size) => TUNNEL_CORE_TILE * tunnelCoreScale(size);

/** Width of a tunnel where it leaves its own tile. */
export const tunnelMouthWidth = (size) => Math.min(TUNNEL_MOUTH_WIDTH, TUNNEL_FLARE * tunnelDockWidth(size));

/** Width `along` an arm: 0 at the core dock, 1 at the tile mouth. */
export function tunnelGaugeAt(along, mouthWidth, dockWidth) {
  const a = along < 0 ? 0 : along > 1 ? 1 : along;
  return dockWidth + (mouthWidth - dockWidth) * a;
}

/**
 * Where arc-length `arc` sits along its arm: 0 at the core dock (and through
 * the crossing between the two docks), 1 at the arm's tile mouth.
 */
export function tunnelArmFractionAt(path, arc) {
  if (arc <= path.armALen) return path.armALen > 0 ? 1 - arc / path.armALen : 0;
  const armB0 = path.total - path.armBLen;
  if (arc >= armB0) return path.armBLen > 0 ? (arc - armB0) / path.armBLen : 0;
  return 0;
}

const DOCK_NORMALS = {
  PX: [1, 0, 0], NX: [-1, 0, 0], PY: [0, 1, 0], NY: [0, -1, 0], PZ: [0, 0, 1], NZ: [0, 0, -1]
};
const _dockCentre = new THREE.Vector3();
const _dockNormal = new THREE.Vector3();

/**
 * A tile's dock from its grid cell and sticker key, optionally carried by the
 * cubie's live rotation (the cube-space quaternion of its mesh, identity at rest).
 */
export function tunnelDockForCellInto(out, x, y, z, dirKey, size, quaternion = null) {
  const k = (size - 1) / 2;
  const n = DOCK_NORMALS[dirKey] || DOCK_NORMALS.PY;
  _dockCentre.set(x - k, y - k, z - k);
  _dockNormal.set(n[0], n[1], n[2]);
  if (quaternion) {
    _dockCentre.applyQuaternion(quaternion);
    _dockNormal.applyQuaternion(quaternion);
  }
  return tunnelDockInto(out, _dockCentre, _dockNormal, size);
}

/**
 * The same, for a cubie mesh by its CubeAssembly index (cubies are laid out
 * x-major: idx = x·N² + y·N + z) and the mesh itself for its live rotation.
 */
export function tunnelDockForMeshInto(out, meshIdx, dirKey, size, mesh = null) {
  const x = Math.floor(meshIdx / (size * size)), y = Math.floor(meshIdx / size) % size, z = meshIdx % size;
  return tunnelDockForCellInto(out, x, y, z, dirKey, size, mesh ? mesh.quaternion : null);
}

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
// three legs: the entry arm owns [0, ARM_A_END], the core crossing (dock, centre,
// dock) the span up to ARM_B_START, and the exit arm the rest. Phases, portal
// charge and the tube's head marker are all expressed against these.
export const ARM_A_END = 0.4;
export const ARM_B_START = 0.6;

// ── Bore profile ─────────────────────────────────────────────────────────────
// The radius of the shaft swept around this centerline (TunnelTube). It lives
// here, next to the path itself, because it is in a fixed relationship with two
// other numbers: the camera's offset from the axis (tunnelCameraRails —
// TUNNEL_CAM_UP) must stay inside it for the whole ride, and the ribbon's width
// (MobiusTunnel) has to fit within it too. When these lived in three files the
// bore was quietly sized around a camera offset that had since changed.
//
// Kept deliberately snug: anything wider fills the frame and swallows both the
// ribbon and the cube around it.
export const BORE_MOUTH = 0.29;  // where the tunnel meets its tile (sticker is ~0.88 wide)
export const BORE_THROAT = 0.67; // at the core crossing — the wall fades out across it
export const BORE_CORE = 0.85;   // widest point, over the middle of each arm

/**
 * Bore radius at traversal parameter t.
 *
 * The bore pinches at both tiles AND at the core, bulging over the middle of each
 * arm instead: where the two arms meet at a sharp corner, putting the widest point
 * on the corner makes it read as two mismatched barrels butted together rather
 * than one shaft.
 */
export function tunnelBoreRadiusAt(t) {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  const base = BORE_MOUTH + (BORE_THROAT - BORE_MOUTH) * Math.sin(Math.PI * c);
  const arm = Math.abs(Math.sin(2 * Math.PI * c));
  return base + (BORE_CORE - BORE_THROAT) * arm;
}

// vStart → throatA → midA → core → midB → throatB → vEnd
const LEG_COUNT = 6;
const _axial = new THREE.Vector3();
const _dockSide = new THREE.Vector3();

/** Allocate a reusable path object. Fill it with buildTunnelPathInto. */
export const makeTunnelPath = () => {
  const path = {
    // Control points, mouth to mouth.
    vStart: new THREE.Vector3(),   // entry sticker surface
    throatA: new THREE.Vector3(),  // straight down the entry tile's normal
    midA: new THREE.Vector3(),     // entry-side dock on the antipodal core
    core: new THREE.Vector3(),     // the centre: every crossing passes through it
    midB: new THREE.Vector3(),     // exit-side dock on the antipodal core
    throatB: new THREE.Vector3(),  // straight up the exit tile's normal
    vEnd: new THREE.Vector3(),     // exit sticker surface
    // Per-leg world lengths and the parameter span each leg occupies.
    legLen: [0, 0, 0, 0, 0, 0],
    legT: [0, 0, 0, 0, 0, 0],
    legT0: [0, 0, 0, 0, 0, 0],
    legArc0: [0, 0, 0, 0, 0, 0],
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
  path.legA = [path.vStart, path.throatA, path.midA, path.core, path.midB, path.throatB];
  path.legB = [path.throatA, path.midA, path.core, path.midB, path.throatB, path.vEnd];
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
 * @param {THREE.Vector3} [dockA] entry dock point on the antipodal core (tunnelDockInto).
 *   Omitted, the tunnel docks on the centre of the core face along n1.
 * @param {THREE.Vector3} [dockB] exit dock point, same.
 */
export function buildTunnelPathInto(path, vStart, n1, vEnd, n2, dockA = null, dockB = null) {
  path.vStart.copy(vStart);
  path.vEnd.copy(vEnd);
  path.nStart.copy(n1).normalize();
  path.nEnd.copy(n2).normalize();
  path.core.set(0, 0, 0);
  if (dockA) path.midA.copy(dockA); else path.midA.copy(n1).multiplyScalar(TUNNEL_MINI_FACE_R);
  if (dockB) path.midB.copy(dockB); else path.midB.copy(n2).multiplyScalar(TUNNEL_MINI_FACE_R);
  // Slice turns can put both mouths on the same physical face. Sharing its
  // centre dock collapses the entire core leg (20% of traversal time) to a
  // point. Separate the docks along the mouths' in-face separation instead.
  // Swapping entry/exit reverses this vector, preserving the same physical path.
  if (path.midA.distanceToSquared(path.midB) < 1e-10) {
    _dockSide.subVectors(vEnd, vStart).projectOnPlane(path.nStart);
    if (_dockSide.lengthSq() > 1e-10) {
      _dockSide.normalize().multiplyScalar(TUNNEL_MINI_FACE_R);
      path.midA.sub(_dockSide);
      path.midB.add(_dockSide);
    }
  }
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
  path.armBLen = path.legLen[4] + path.legLen[5];

  // Split each arm's parameter span between its throat and its diagonal. By length
  // the throat is the short one, so the floor is what usually decides — see
  // TUNNEL_THROAT_T_SHARE.
  const shareA = path.armALen > 0
    ? Math.max(TUNNEL_THROAT_T_SHARE, path.legLen[0] / path.armALen)
    : 0;
  const shareB = path.armBLen > 0
    ? Math.max(TUNNEL_THROAT_T_SHARE, path.legLen[5] / path.armBLen)
    : 0;
  path.legT[0] = path.legLen[0] > 0 ? ARM_A_END * shareA : 0;
  path.legT[1] = ARM_A_END - path.legT[0];
  // The crossing's span is shared between its two halves by length, so the
  // head crosses the core at an even pace whichever docks it joins.
  const crossLen = path.legLen[2] + path.legLen[3];
  const crossShare = crossLen > 0 ? path.legLen[2] / crossLen : 0.5;
  path.legT[2] = (ARM_B_START - ARM_A_END) * crossShare;
  path.legT[3] = (ARM_B_START - ARM_A_END) - path.legT[2];
  path.legT[5] = path.legLen[5] > 0 ? (1 - ARM_B_START) * shareB : 0;
  path.legT[4] = (1 - ARM_B_START) - path.legT[5];

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
  if (path.legLen[5] <= 0) return 4;
  if (path.legLen[4] <= 0) return 5;
  return arc <= path.legLen[4] ? 4 : 5;
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
  const armArc0 = leg === 1 ? path.legLen[0] : leg === 5 ? path.legLen[4] : 0;
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
