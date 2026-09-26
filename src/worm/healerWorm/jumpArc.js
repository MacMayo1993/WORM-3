// src/worm/healerWorm/jumpArc.js
//
// The one surface-jump height curve. The head (jumpLiftOf), the body lift baked
// into stepHistory, and a raised-pad launch from mid-air all read it, so the
// worm and its tail can never disagree about how high a jump is.
//
// `base` is the height the arc starts from. A grounded jump starts at 0 and is
// the plain half-sine it always was. A double jump (a second JUMP press while
// airborne) starts a fresh arc from the height the worm already has: the base
// fades out linearly as the new half-sine rises, so the worm keeps climbing from
// where it was instead of dropping to the floor and hopping again, and still
// lands exactly at t = 1.
export function arcLift(t, height, base = 0) {
  const u = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return base * (1 - u) + Math.sin(u * Math.PI) * height;
}
