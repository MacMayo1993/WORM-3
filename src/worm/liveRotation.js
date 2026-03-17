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
};
