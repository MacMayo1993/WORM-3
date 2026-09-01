// src/utils/audio.js
// Haptic feedback utility.
//
// This used to also hold an <Audio> pool driving play('/sounds/*.mp3') against
// files that never shipped — a dead path gated off behind a constant. Sound is
// now owned entirely by utils/feel.js, which synthesises every effect from
// oscillators and needs no assets, so the pool, its preloader, and the layered
// vibrateFlip pattern (which lived here and bypassed the player's haptics
// setting) have all moved or gone. feel() is the one dispatch for both halves
// of game feedback; import from there, not from here.
//
// vibrate() stays because a handful of pure-UI call sites want a bare tap with
// no sound attached to it (menu presses, the cutscene, the nav bar).

/** A single haptic tap, or a [buzz, gap, buzz…] pattern. No-op where unsupported. */
export const vibrate = (ms = 18) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(ms);
    } catch (_) {}
  }
};
