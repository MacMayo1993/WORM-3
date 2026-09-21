import { ramp } from './introChoreography.js';

/**
 * introCopy — the three lines of the opening cinematic.
 *
 * Each beat is timed against what the camera is actually looking at, because a
 * line that describes something the player cannot see yet reads as a riddle:
 *
 *   1. 0.1–2.5s  the cube resolves and takes its half-turn, every colour
 *                arriving as its opposite  → "Every face hides its opposite."
 *   2. 2.7–4.8s  the cube opens and the 27 antipodal tunnels light up
 *                                          → "A tunnel joins them."
 *   3. 5.0–7.0s  the worms crawl the tunnels, then the cube implodes into the
 *                WORM³ title              → "Something crawls through."
 *
 * Three sentences, one idea each: the topology, the tunnel, the worm. They land
 * the premise without the words "antipodal", "manifold", or "projective plane",
 * which the game teaches later and by hand.
 *
 * The timings are not free. A line must reveal word by word, then hold complete
 * and still for at least 0.75s before it starts to dissolve (introCopy.test.js
 * pins that floor), so every beat costs WORD_FADE + 0.75 + LINE_DISSOLVE on top
 * of its word steps. Lengthening a line means moving the beats after it, and
 * the last one has to be gone by TITLE_START.
 */
export const INTRO_COPY = [
  { start: 0.1, end: 2.5, text: 'Every face hides its opposite.' },
  { start: 2.7, end: 4.8, text: 'A tunnel joins them.' },
  { start: 5.0, end: 7.0, text: 'Something crawls through.' }
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
