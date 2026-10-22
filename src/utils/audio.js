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

// The player's haptics setting, synced by setFeelEnabled (feel.js). Every buzz in
// the game ends here, so this is the one gate: the menu, the cutscene and the cube's
// turn ticks used to call vibrate() straight and buzzed with haptics switched off.
let _hapticsAllowed = true;
export const setHapticsAllowed = allowed => { _hapticsAllowed = !!allowed; };
const isCancel = ms => ms === 0 || (Array.isArray(ms) && ms.length === 0);

/** A single haptic tap, or a [buzz, gap, buzz…] pattern. No-op where unsupported or switched off. */
export const vibrate = (ms = 18) => {
  // A cancel always goes through, so switching haptics off can stop a buzz in flight.
  if (!_hapticsAllowed && !isCancel(ms)) return;
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(ms);
    } catch (_) {}
  }
};
