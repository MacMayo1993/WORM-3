// src/worm/liveRotation.js
//
// Shared mutable singleton written by CubeAssembly every frame during any
// cube rotation (both GSAP-driven animations and live finger/mouse drags).
// Read by worm-mode renderers and by the sim so they can track mid-tween
// positions without Zustand reactivity overhead.
//
// ── Why this exposes every layer ──────────────────────────────────────────────
// A cube move can turn more than one plane at once, and the worm hazard turns two
// non-adjacent planes in OPPOSITE directions. This bridge used to publish a single
// `sliceIndex` and a single signed `angle` — the anchor plane, chosen as the one
// the worm's head happened to sit on. Everything downstream then treated "is this
// tile rotating?" as "is it on the anchor plane?", so a worm, a body sample or an
// orb on the second plane was invisible to crossing detection and to the renderers:
// it stayed still through the tween and teleported at commit.
//
// `sliceIndices` / `angles` are the whole truth — one entry per turning plane, each
// with its own signed angle. The anchor fields remain for consumers that legitimately
// want one representative plane (the chase camera's ride, the spin-energy readout),
// but they are no longer a membership test. Use `liveLayerAngle()` for that.
//
// Contract:
//   • CubeAssembly calls setLiveRotation() at the START of each frame while a
//     rotation is in progress, BEFORE priority-0 useFrames run.
//   • CubeAssembly calls resetLiveRotation() (or sets active = false) on any frame
//     where no rotation is live.
//   • Consumers treat every field as read-only.
//   • Angles are TOTAL signed angles (radians) to pass to applyAxisAngle from the
//     resting world position — NOT incremental deltas.
//     Range: live drag → arbitrary; GSAP animation → 0 … ±π/2 per turn.
//
// ── The transaction id ───────────────────────────────────────────────────────
// `txnId` names one rotation from start to commit. Crossing protection in the sim
// is armed against a txnId, so two consecutive rotations of the SAME axis and the
// SAME layer are distinguishable: without it, protection armed for the first turn
// (and left behind by a cancel, or by a commit that never arrived) silently applies
// to the second, and the worm's destination is preserved against a rotation it was
// never crossing into.

export const liveRotation = {
  active: false,
  axis: null,       // 'col' | 'row' | 'depth'

  // Every turning plane, and each plane's own signed angle (parallel arrays).
  // Mutated in place — this is read every frame by the body renderer.
  sliceIndices: [],
  angles: [],

  // Identifies this rotation from first frame to commit. Bumped whenever a new
  // rotation starts (see setLiveRotation).
  txnId: 0,

  // Anchor plane — one representative layer, for consumers that want a single
  // slice/angle. NOT a membership test: use liveLayerAngle().
  sliceIndex: 0,
  angle: 0,

  // After a rotation animation completes, the final rotation is held here for
  // a couple of extra frames while React re-renders with updated powerup grid
  // coordinates. Without this, orbs on the rotating slice snap back to their
  // pre-rotation world positions for one frame before the new positions arrive.
  completedFrames: 0,     // frames remaining to apply the completed rotation
  completedAxis: null,
  completedSliceIndex: 0,
  completedAngle: 0,
  // The txnId of the rotation that just finished. The commit path (which is driven
  // by the store's rotationEpoch, not by this bridge) matches crossing protection
  // against it, so protection armed under an earlier, cancelled rotation cannot be
  // consumed by a later one.
  completedTxnId: 0,
};

/** True when the layer list this frame differs from the one currently published. */
function layersChanged(axis, sliceIndices) {
  if (liveRotation.axis !== axis) return true;
  const cur = liveRotation.sliceIndices;
  if (cur.length !== sliceIndices.length) return true;
  for (let i = 0; i < cur.length; i++) if (cur[i] !== sliceIndices[i]) return true;
  return false;
}

/**
 * Publish the frame's rotation state.
 *
 * @param {string} axis - 'col' | 'row' | 'depth'
 * @param {number[]} sliceIndices - every turning plane on that axis
 * @param {number[]} angles - each plane's signed angle, parallel to sliceIndices
 * @param {number} anchorSlice - the representative plane for the anchor fields
 * @param {number} anchorAngle - that plane's signed angle
 */
export function setLiveRotation(axis, sliceIndices, angles, anchorSlice, anchorAngle) {
  // A new transaction starts when a rotation begins, or when the set of turning
  // planes changes under an already-live rotation (a cancel/restart in one frame).
  if (!liveRotation.active || layersChanged(axis, sliceIndices)) {
    liveRotation.txnId++;
  }
  liveRotation.active = true;
  liveRotation.axis = axis;
  // Copy in place rather than assigning the caller's arrays: consumers read these
  // every frame and the caller's list is often a scratch/ref it reuses.
  const si = liveRotation.sliceIndices;
  const an = liveRotation.angles;
  si.length = sliceIndices.length;
  an.length = sliceIndices.length;
  for (let i = 0; i < sliceIndices.length; i++) {
    si[i] = sliceIndices[i];
    an[i] = angles[i];
  }
  liveRotation.sliceIndex = anchorSlice;
  liveRotation.angle = anchorAngle;
}

/** The signed angle for one turning plane, or null when that plane is not turning. */
export function liveLayerAngleAt(sliceIndex) {
  if (!liveRotation.active) return null;
  const si = liveRotation.sliceIndices;
  for (let i = 0; i < si.length; i++) {
    if (si[i] === sliceIndex) return liveRotation.angles[i];
  }
  return null;
}

/**
 * The signed angle a grid cell is currently being turned by, or null when it is
 * not on any turning plane. This is the membership test every consumer should use
 * — a cell on the second plane of a two-plane turn is just as much "in rotation"
 * as one on the anchor.
 */
export function liveLayerAngle(x, y, z) {
  if (!liveRotation.active) return null;
  const axis = liveRotation.axis;
  const coord = axis === 'col' ? x : axis === 'row' ? y : axis === 'depth' ? z : null;
  if (coord === null) return null;
  return liveLayerAngleAt(coord);
}

/** Whether a grid cell sits on any currently turning plane. */
export function isTileInLiveRotation(x, y, z) {
  return liveLayerAngle(x, y, z) !== null;
}

/** Snapshot of the live layers, for callers that need the whole set (crossing tests). */
export function liveRotationLayers() {
  return liveRotation.active ? liveRotation.sliceIndices : null;
}

/**
 * Reset liveRotation to its idle state.
 * Saves the just-completed rotation into the `completed*` fields so that
 * ParityOrbs can hold the final position for a couple of frames while React
 * state catches up with the new rotated powerup coordinates, and records the
 * finished transaction id so the commit can match protection armed under it.
 */
export const resetLiveRotation = () => {
  // Preserve the final rotation for the holdover mechanism
  liveRotation.completedAxis = liveRotation.axis;
  liveRotation.completedSliceIndex = liveRotation.sliceIndex;
  liveRotation.completedAngle = liveRotation.angle;
  liveRotation.completedTxnId = liveRotation.txnId;
  liveRotation.completedFrames = 2;
  // Clear active state
  liveRotation.active = false;
  liveRotation.axis = null;
  liveRotation.sliceIndices.length = 0;
  liveRotation.angles.length = 0;
  liveRotation.sliceIndex = 0;
  liveRotation.angle = 0;
};

/** Gate frame writers against the synchronous store, never a stale React turn. */
export function syncRotationFrame(authoritativeAnim, initializedAnim) {
  if (!authoritativeAnim) {
    liveRotation.active = false;
    return false;
  }
  if (authoritativeAnim !== initializedAnim) {
    const layers = authoritativeAnim.sliceIndices?.length ? authoritativeAnim.sliceIndices : [authoritativeAnim.sliceIndex];
    setLiveRotation(authoritativeAnim.axis, layers, layers.map(() => 0), authoritativeAnim.sliceIndex, 0);
    return false;
  }
  return true;
}
