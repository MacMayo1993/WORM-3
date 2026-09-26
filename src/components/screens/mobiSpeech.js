// mobiSpeech.js — how fast Mobi "talks" a line onto the page.
//
// Characters appear left to right at a speaking pace, with the small breaths a
// voice takes: a short pause after a comma, a longer one after a full stop. The
// schedule is a pure function of the text, so the component only has to read
// "how many characters by now" off a clock.

export const CHAR_TIME = 0.026;   // seconds per character
const SPACE_TIME = 0.012;         // words run together faster than letters
const COMMA_PAUSE = 0.16;         // after , ; : and dashes
const STOP_PAUSE = 0.32;          // after . ! ? and …

/**
 * Time (seconds from the start of the line) at which each character appears.
 * `times[i]` is when character i shows; the array is non-decreasing.
 */
export function speechSchedule(text) {
  const times = new Array(text.length);
  let t = 0;
  for (let i = 0; i < text.length; i++) {
    times[i] = t;
    const c = text[i];
    const next = text[i + 1];
    t += c === ' ' ? SPACE_TIME : CHAR_TIME;
    // Pause only at the end of a clause, not inside "3.5" or "A.B".
    if (/[.!?…]/.test(c) && (next === undefined || next === ' ' || /["'”’)]/.test(next))) t += STOP_PAUSE;
    else if (/[,;:—–]/.test(c) && (next === undefined || next === ' ')) t += COMMA_PAUSE;
  }
  return times;
}

/** How many characters of the line are showing `elapsed` seconds in. */
export function charsSpoken(times, elapsed) {
  let lo = 0, hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= elapsed) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Seconds until the whole line is showing. */
export const speechDuration = times => times.length ? times[times.length - 1] + CHAR_TIME : 0;
