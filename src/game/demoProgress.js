// demoProgress.js — pure completion checks for the guided demo's hands-on steps.
//
// Kept out of the hook so each rule can be tested against real cube state, and
// so the rules stay readable: a demo step is only "done" when the player has
// actually performed the mechanic the step teaches.

/**
 * Every sticker on the cube currently showing its twin's colour.
 *
 * Always even: a flip moves both ends of a pair, which is the whole point of
 * the mechanic.
 */
export function totalFlippedCount(cubies) {
  let flipped = 0;
  for (const plane of cubies)
    for (const column of plane)
      for (const cubie of column) {
        for (const key in cubie.stickers) {
          const st = cubie.stickers[key];
          if (st && st.curr !== st.orig) flipped++;
        }
      }
  return flipped;
}

/**
 * How many tile PAIRS are currently away from home — the unit the flip step
 * counts in, since one tap displaces one pair.
 *
 * This is deliberately position-independent. Counting the front face instead
 * (the face the step stages toward the player) breaks the moment they twist a
 * row: displaced tiles rotate out of view, fresh ones rotate in, and the target
 * moves under them. Counting pairs anywhere on the cube means the progress bar
 * and the completion check both stay true no matter how the cube is turned.
 */
export function displacedPairCount(cubies) {
  return totalFlippedCount(cubies) / 2;
}
