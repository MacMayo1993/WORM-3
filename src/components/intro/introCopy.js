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
export const WORD_POP = 0.34; // the spring that lands each word, overshoot included

/**
 * Words that get their own move, keyed by the word itself (punctuation and case
 * ignored), so the script can be reworded without re-indexing:
 *   box  — an outlined box draws itself around the word: outside the box;
 *   flip, cube — the word sits on a Rubik's sticker that flips to its antipodal
 *          colour, the move the cube behind them makes.
 */
export const INTRO_ACCENTS = { box: 'box', flip: 'tile', cube: 'tile' };
/** Each sticker word's [front, back] face ids, an antipodal pair: FLIP blue → green, CUBE red → orange. */
export const TILE_FACES = { flip: [5, 2], cube: [1, 4] };
const wordKey = text => text.toLowerCase().replace(/[^a-z]/g, '');
export const accentOf = text => INTRO_ACCENTS[wordKey(text)] ?? null;
export const tileFacesOf = text => TILE_FACES[wordKey(text)] ?? null;
const TILE_FLIP = 0.45;
const TILE_HOLD = 0.4; // after the line lands, before the first sticker turns
const TILE_STAGGER = 0.28; // then each later sticker, in reading order: a little flip wave

/** The whole script as one string, for the screen-reader summary of the intro. */
export const INTRO_COPY_TEXT = INTRO_COPY.map(line => line.text).join(' ');

export function introCopyFrame(time) {
  const beat = INTRO_COPY.find(line => time >= line.start && time < line.end);
  if (!beat) return null;
  const dissolve = ramp(time, beat.end - LINE_DISSOLVE, beat.end);
  const words = beat.text.split(' ');
  const landed = beat.start + (words.length - 1) * WORD_INTERVAL + WORD_POP;
  let tiles = 0;
  return { beat, dissolve, words: words.map((text, index) => {
    const start = beat.start + index * WORD_INTERVAL;
    const accent = accentOf(text);
    const turnAt = accent === 'tile' ? landed + TILE_HOLD + TILE_STAGGER * tiles++ : 0;
    return {
      text, accent, faces: tileFacesOf(text),
      opacity: ramp(time, start, start + WORD_FADE) * (1 - dissolve),
      reveal: ramp(time, start, start + WORD_POP),
      // 0→1: the box outline drawing, or the sticker's turn.
      move: accent === 'box' ? ramp(time, start + 0.12, start + 0.62)
        : accent === 'tile' ? ramp(time, turnAt, turnAt + TILE_FLIP) : 0
    };
  }) };
}
