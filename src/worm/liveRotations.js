// src/worm/liveRotations.js
//
// Shared mutable singleton describing the rotation wave currently in flight —
// up to three parallel planes, each with its own angle. Written by CubeAssembly
// every frame during any cube rotation (GSAP animations and live finger drags
// alike). Read by worm-mode renderers and the worm sim so they can track
// mid-tween positions without paying a Zustand render per frame.
//
// Supersedes the single-plane `liveRotation`, which remains as a compatibility
// adapter over this object.
//
// Contract:
//   • CubeAssembly sets `active = true` and fills every field at the START of
//     each frame while a wave is in progress, BEFORE priority-0 useFrames run
//     (it writes at priority −1).
//   • CubeAssembly sets `active = false` on any frame with no live wave.
//   • Consumers treat every field as read-only.
//   • `angle` on a plane is the TOTAL signed angle (radians) to pass to
//     applyAxisAngle from the resting world position — NOT an incremental delta.
//     Range: live drag → arbitrary; GSAP animation → 0 … ±(π/2 × numTurns).
//   • Every plane in a wave shares `axis`, and no two share a `sliceIndex`, so a
//     cell belongs to at most one plane. `planeAngleFor` relies on that.
//
// Everything here is pre-allocated and mutated in place. A bridge read on every
// frame by the body renderer, the trail, the orbs and the head must not be the
// thing generating garbage.

import { MEGA_SIZE } from '../game/sliceIndex.js';
import { MAX_WAVE_PLANES } from '../game/rotationWave.js';

const makePlane = () => ({ sliceIndex: -1, angle: 0, dir: 0, numTurns: 1 });

export const liveRotations = {
  active: false,
  waveId: 0,
  axis: null,            // 'col' | 'row' | 'depth' — shared by every plane
  count: 0,              // planes in flight, 0..3
  planes: [makePlane(), makePlane(), makePlane()],

  // After a wave's animation completes, the final state is held here for a couple
  // of extra frames while React re-renders with updated grid coordinates. Without
  // it, anything positioned from React state (orbs, powerups) snaps back to its
  // pre-rotation world position for one frame before the new coordinates arrive.
  // The window matters more the bigger the cube: at 15 the re-render is slower.
  completedFrames: 0,
  completedAxis: null,
  completedCount: 0,
  completedPlanes: [makePlane(), makePlane(), makePlane()],

  // sliceIndex → plane slot, or -1. Sized for the largest cube any mode builds so
  // it never needs reallocating. Int8 is ample for a 0..2 slot index.
  bySlice: new Int8Array(MEGA_SIZE).fill(-1),
};

/**
 * Begin (or update) a wave. Clears any previous plane mapping first, so a wave
 * that claims fewer planes than its predecessor cannot leave a stale entry
 * behind — the bug that shape would produce is a body segment riding a plane
 * that stopped turning, which reads as the worm tearing itself apart.
 */
export function setLiveWave(waveId, axis, rotations) {
  liveRotations.bySlice.fill(-1);
  liveRotations.active = true;
  liveRotations.waveId = waveId;
  liveRotations.axis = axis;
  const n = Math.min(rotations.length, MAX_WAVE_PLANES);
  liveRotations.count = n;
  for (let i = 0; i < n; i++) {
    const src = rotations[i];
    const p = liveRotations.planes[i];
    p.sliceIndex = src.sliceIndex;
    p.dir = src.dir;
    p.numTurns = src.numTurns ?? 1;
    p.angle = 0;
    if (src.sliceIndex >= 0 && src.sliceIndex < MEGA_SIZE) {
      liveRotations.bySlice[src.sliceIndex] = i;
    }
  }
}

/** Update one plane's total swept angle for this frame. */
export function setPlaneAngle(slot, angle) {
  if (slot < 0 || slot >= liveRotations.count) return;
  liveRotations.planes[slot].angle = angle;
}

/**
 * The slot owning a slice index, or -1.
 *
 * O(1) — this is the lookup the per-cell hot paths (step-history bake, body
 * ride, collision classification) should use rather than scanning the planes.
 */
export function planeSlotForSlice(sliceIndex) {
  if (sliceIndex < 0 || sliceIndex >= MEGA_SIZE) return -1;
  return liveRotations.bySlice[sliceIndex];
}

/** The slot owning a grid cell during the live wave, or -1. */
export function planeSlotForCell(x, y, z) {
  if (!liveRotations.active) return -1;
  const axis = liveRotations.axis;
  const coord = axis === 'col' ? x : axis === 'row' ? y : axis === 'depth' ? z : -1;
  if (coord < 0) return -1;
  return planeSlotForSlice(coord);
}

/**
 * The slice index of the plane owning a cell during the live wave, or null.
 *
 * Distinct from `planeSlotForCell`, which answers "which of the wave's up-to-three
 * planes". Callers that speak in slice indices — notably the rest-read descriptor,
 * which predates waves — need the index itself.
 */
export function planeSliceForCell(x, y, z) {
  const slot = planeSlotForCell(x, y, z);
  return slot < 0 ? null : liveRotations.planes[slot].sliceIndex;
}

/**
 * Total signed angle to apply to a cell right now, or 0 if it isn't riding.
 * Returns a plain number so callers can branch on `!== 0` without allocating.
 */
export function planeAngleFor(x, y, z) {
  const slot = planeSlotForCell(x, y, z);
  return slot < 0 ? 0 : liveRotations.planes[slot].angle;
}

/**
 * Reset to idle, preserving the just-completed wave in the `completed*` fields
 * so holdover consumers can keep applying it while React catches up.
 */
export function resetLiveRotations() {
  liveRotations.completedAxis = liveRotations.axis;
  liveRotations.completedCount = liveRotations.count;
  for (let i = 0; i < liveRotations.count; i++) {
    const src = liveRotations.planes[i];
    const dst = liveRotations.completedPlanes[i];
    dst.sliceIndex = src.sliceIndex;
    dst.angle = src.angle;
    dst.dir = src.dir;
    dst.numTurns = src.numTurns;
  }
  liveRotations.completedFrames = 2;

  liveRotations.active = false;
  liveRotations.axis = null;
  liveRotations.count = 0;
  liveRotations.waveId = 0;
  liveRotations.bySlice.fill(-1);
  for (const p of liveRotations.planes) {
    p.sliceIndex = -1;
    p.angle = 0;
    p.dir = 0;
    p.numTurns = 1;
  }
}

/**
 * Total signed angle for a cell from the just-completed wave, or 0.
 *
 * Callers decrement `completedFrames` themselves once per frame; this only reads.
 */
export function completedAngleFor(x, y, z) {
  if (liveRotations.completedFrames <= 0) return 0;
  const axis = liveRotations.completedAxis;
  const coord = axis === 'col' ? x : axis === 'row' ? y : axis === 'depth' ? z : -1;
  if (coord < 0) return 0;
  for (let i = 0; i < liveRotations.completedCount; i++) {
    if (liveRotations.completedPlanes[i].sliceIndex === coord) {
      return liveRotations.completedPlanes[i].angle;
    }
  }
  return 0;
}

/** Clear the holdover immediately. Used on teardown and between tests. */
export function clearLiveRotationHoldover() {
  liveRotations.completedFrames = 0;
  liveRotations.completedAxis = null;
  liveRotations.completedCount = 0;
}
