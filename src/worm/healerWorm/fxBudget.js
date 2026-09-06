// src/worm/healerWorm/fxBudget.js
//
// One place that decides what a cube of a given size is allowed to spend on
// effects.
//
// Worm mode is roughly twenty rendering subsystems with their own frame loops —
// body, trail, orbs, portals, bombs, elemental washes, the rotation hazard — and
// every one of them was individually reasonable while each decided on its own
// what "big cube" meant, if it considered it at all. On a 3×3 that is fine. On
// Mega they all turn up at once and the frame has 16.67ms for the lot: a
// baseline of 12ms plus one subsystem's 5ms is a dropped frame, and no single
// system looks like the culprit when you profile it alone.
//
// So the tiers live here rather than as a threshold buried in each renderer.
// When Mega needs to give something up, this is the file that says what.

/** The largest board the game offers, and the one every budget below is about. */
export const MEGA_SIZE = 15;

// Anything past the ordinary size ladder (2–7) is on the big-board budget. There
// is nothing between 7 and 15 today; the threshold is written as a range rather
// than as `=== 15` so a future 9×9 or 11×11 lands on the cheap side by default
// rather than by being remembered.
const BIG_FROM = 8;

// The ordinary board. Everything on, at the counts the effects were authored for.
const FULL = {
  tier: 'full',
  // The turn hazard: rim, streamers, haze, flares and motes.
  warning: 'full',
  // Route daubs painted per frame, and how often the stroke is rebuilt.
  trailDaubCap: 4000,
  trailGlowCap: 200,
  trailHz: 60,
  // The full gem — shell, core, halos, Möbius band, orbital rings — or one
  // emissive gem in its place.
  orbDetail: 'full'
};

// The big board. Each cut below is one the player can see; they are here because
// on 15×15 the alternative is a frame rate they can feel.
const BIG = {
  tier: 'big',
  // Rim only, and a rim with the noise compiled out. 225 tiles per threatened
  // plane, up to two planes, additively blended for the whole ten-second cycle:
  // the spectacle is what costs, the rim is what the player reads.
  warning: 'lite',
  // A Mega run retains thousands of route tiles, and the stroke is rebuilt from
  // scratch every frame — thousands of live cubie lookups, interpolations, cross
  // products and quaternions, then two instanced buffers uploaded. Capping the
  // daubs bounds the work; the oldest tail of a very long route stops being
  // painted, which is the visible cost.
  trailDaubCap: 1400,
  trailGlowCap: 140,
  // The trail is paint on a surface: at 30Hz it is indistinguishable from 60
  // while the cube is still. It goes back to every frame while a slice is
  // actually turning, where a 33ms lag would show as the paint sliding off the
  // tiles it belongs to.
  trailHz: 30,
  // Mega scales its orb population by area — 225/49 ≈ 4.6× — so the default 16
  // becomes ~73 pickups on screen, each of which is ten-odd separately rendered
  // pieces at full detail. This reverses "Show full-detail parity orbs on 15×15
  // mega mode" (93ecdd9) deliberately: it is one word here to put back.
  orbDetail: 'reduced'
};

/** What this board is allowed to spend. */
export function fxBudget(size) {
  return size >= BIG_FROM ? BIG : FULL;
}

/** True when the board is on the reduced budget. */
export function isBigBoard(size) {
  return size >= BIG_FROM;
}
