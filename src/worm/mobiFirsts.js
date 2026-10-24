// src/worm/mobiFirsts.js
//
// Mobi speaks up the first time a player meets each of WORM's moving parts, once
// per save (the `first:mobi:<id>` milestone, set by the store's sayMobiFirst), in
// the HUD's MobiLineNotice. House style (COPY_STYLE.md): short sentences, twins
// "straight through the middle", no topology words. Each line says only what the
// game does.
//
// The first rumble has its own line and gate in the Rumbler (RUMBLE_FIRST_LINE).
//
// There is deliberately no "mirrored arrival" line: a ride keeps the worm's
// heading in its exit face's own frame (DIR_FORWARD, every face's right × up is
// its outward normal), so the worm comes out with the same handedness it went in
// with, while the twin map itself (x to -x) would mirror it. A line saying the
// worm comes out mirrored would describe something the game does not do.
export const MOBI_FIRSTS = {
  // The first pair of flip pads seen in play: a flip moves both twins at once.
  pad: 'A tile flipped, and its twin flipped with it. Jump on the pad to ride through!',
  // The first ride finished: the tunnel runs through the Core to the twin.
  ride: "Straight through the middle and out at its twin. In my world they're the same place!",
};
