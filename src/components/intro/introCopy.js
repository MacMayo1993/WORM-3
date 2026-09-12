import { ramp } from './introChoreography.js';

export const INTRO_COPY = [
  { start: 0.1, end: 1.8, text: 'One day…' },
  { start: 2.0, end: 3.7, text: 'Front left,' },
  { start: 3.9, end: 6.8, text: 'and flipped right to Back.' },
];
export const WORD_INTERVAL = 0.28;
export const WORD_FADE = 0.18;
export const LINE_DISSOLVE = 0.45;
export function introCopyFrame(time) {
  const beat = INTRO_COPY.find(line => time >= line.start && time < line.end);
  if (!beat) return null;
  const dissolve = ramp(time, beat.end - LINE_DISSOLVE, beat.end);
  return { beat, dissolve, words: beat.text.split(' ').map((text, index) => {
    const start = beat.start + index * WORD_INTERVAL;
    return { text, opacity: ramp(time, start, start + WORD_FADE) * (1 - dissolve) };
  }) };
}
