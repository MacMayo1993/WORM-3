// src/worm/liveRotation.js
//
// Shared mutable singleton written by CubeAssembly every frame during any
// cube rotation (both GSAP-driven animations and live finger/mouse drags).
// Read by worm-mode renderers (ParityOrbs, and eventually WormBody) so they
// can track mid-tween positions without Zustand reactivity overhead.
//
// Contract:
//   • CubeAssembly sets `active = true` and fills all fields at the START of
//     each frame while a rotation is in progress, BEFORE priority-0 useFrames run.
//   • CubeAssembly sets `active = false` on any frame where no rotation is live.
//   • Consumers treat every field as read-only.
//   • `angle` is the TOTAL signed angle (radians) to pass to applyAxisAngle
//     from the resting world position — NOT an incremental delta.
//     Range: live drag → arbitrary; GSAP animation → 0 … ±π/2.

export const liveRotation = {
  active: false,
  axis: null,       // 'col' | 'row' | 'depth'
  sliceIndex: 0,    // which slice index on that axis (0..size-1)
  angle: 0,         // total signed rotation angle in radians

  // After a rotation animation completes, the final rotation is held here for
  // a couple of extra frames while React re-renders with updated powerup grid
  // coordinates. Without this, orbs on the rotating slice snap back to their
  // pre-rotation world positions for one frame before the new positions arrive.
  completedFrames: 0,     // frames remaining to apply the completed rotation
  completedAxis: null,
  completedSliceIndex: 0,
  completedAngle: 0,
};

/**
 * Reset liveRotation to its idle state.
 * Saves the just-completed rotation into the `completed*` fields so that
 * ParityOrbs can hold the final position for a couple of frames while React
 * state catches up with the new rotated powerup coordinates.
 */
export const resetLiveRotation = () => {
  // Preserve the final rotation for the holdover mechanism
  liveRotation.completedAxis = liveRotation.axis;
  liveRotation.completedSliceIndex = liveRotation.sliceIndex;
  liveRotation.completedAngle = liveRotation.angle;
  liveRotation.completedFrames = 2;
  // Clear active state
  liveRotation.active = false;
  liveRotation.axis = null;
  liveRotation.sliceIndex = 0;
  liveRotation.angle = 0;
};
