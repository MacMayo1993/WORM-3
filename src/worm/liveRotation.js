// src/worm/liveRotation.js
//
// COMPATIBILITY ADAPTER over `liveRotations` (plural), the multi-plane bridge
// that actually carries the in-flight rotation.
//
// Rotations used to be strictly one slice at a time, and a dozen consumers read
// that assumption straight off this object: `if (liveRotation.active) rotate my
// tile by liveRotation.angle`. Mega Worm turns up to three parallel planes at
// once, which makes "the axis and slice being rotated" ambiguous.
//
// Rather than let those consumers read a wave and silently pick plane 0 — which
// would glue a worm segment to a plane that isn't the one under it — this
// adapter reports `active` ONLY when the live wave holds exactly one plane. For
// a two- or three-plane wave every legacy reader sees `active: false` and falls
// back to grid-math rest positions: a stiffer-looking ride for one turn, never a
// wrong one. Consumers are migrated to `liveRotations` one at a time, and this
// file goes away when the last one has.
//
// Contract for readers (unchanged from before):
//   • `angle` is the TOTAL signed angle (radians) from the resting world
//     position, not an incremental delta.
//   • Every field is read-only.

import { liveRotations, resetLiveRotations } from './liveRotations.js';

export const liveRotation = {
  get active() {
    // Single-plane waves only — see the file header.
    return liveRotations.active && liveRotations.count === 1;
  },
  get axis() {
    return this.active ? liveRotations.axis : null;
  },
  get sliceIndex() {
    return this.active ? liveRotations.planes[0].sliceIndex : 0;
  },
  get angle() {
    return this.active ? liveRotations.planes[0].angle : 0;
  },

  // Tests drive the sim without a renderer, so they need to force the bridge
  // idle. Assigning `false` clears the underlying wave; assigning `true` is
  // meaningless without plane data and is ignored.
  set active(v) {
    if (!v) {
      liveRotations.active = false;
      liveRotations.count = 0;
      liveRotations.axis = null;
      liveRotations.bySlice.fill(-1);
    }
  },
};

/**
 * Reset to idle, holding the just-completed rotation for a couple of frames.
 * Delegates to the multi-plane bridge, which owns the holdover.
 */
export const resetLiveRotation = resetLiveRotations;
