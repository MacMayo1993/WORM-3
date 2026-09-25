import { ramp } from './introChoreography.js';

/** Two trailer beats: the setup, then the invitation through the cube.
 * Keep the complete-line hold and title handoff enforced by introCopy.test.js.
 */
export const INTRO_COPY = [
  { start: 0.1, end: 3.35, text: "Don't just think outside the box," },
  { start: 3.55, end: 7.0, text: 'flip through the cube' }
];

export const WORD_INTERVAL = 0.22; // gap between word reveals — must exceed WORD_FADE
export const WORD_FADE = 0.16;
export const LINE_DISSOLVE = 0.36;

/** The whole script as one string, for the screen-reader summary of the intro. */
export const INTRO_COPY_TEXT = INTRO_COPY.map(line => line.text).join(' ');

export function introCopyFrame(time) {
  const beat = INTRO_COPY.find(line => time >= line.start && time < line.end);
  if (!beat) return null;
  const dissolve = ramp(time, beat.end - LINE_DISSOLVE, beat.end);
  return { beat, dissolve, words: beat.text.split(' ').map((text, index) => {
    const start = beat.start + index * WORD_INTERVAL;
    return { text, opacity: ramp(time, start, start + WORD_FADE) * (1 - dissolve) };
  }) };
}
