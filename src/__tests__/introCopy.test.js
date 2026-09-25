import { describe, it, expect } from 'vitest';
import { INTRO_COPY, INTRO_COPY_TEXT, introCopyFrame, WORD_INTERVAL, WORD_FADE, LINE_DISSOLVE, INTRO_ACCENTS } from '../components/intro/introCopy.js';
import { TITLE_START } from '../components/intro/introTiming.js';

it('reveals words in order and holds each complete line for a readable beat', () => {
  for (const line of INTRO_COPY) {
    const words = line.text.split(' ');
    for (let i = 0; i < words.length; i++) {
      const frame = introCopyFrame(line.start + i * WORD_INTERVAL + WORD_FADE);
      expect(frame.words[i].opacity).toBeCloseTo(1);
      if (i + 1 < words.length) expect(frame.words[i + 1].opacity).toBe(0);
    }
    const complete = line.start + (words.length - 1) * WORD_INTERVAL + WORD_FADE;
    expect(line.end - LINE_DISSOLVE - complete).toBeGreaterThanOrEqual(0.75);
  }
});
it('clears every line before the next and before the title', () => {
  for (const line of INTRO_COPY) {
    expect(introCopyFrame(line.end)).toBeNull();
    expect(introCopyFrame(line.end - 0.01).words.every(w => w.opacity < 0.05)).toBe(true);
  }
  expect(introCopyFrame(TITLE_START)).toBeNull();
});

// The script is two clauses timed against the opening choreography.
// It is rewritten by hand, so these pin the properties a rewrite can silently
// break: a line that runs past the title reveal, two beats overlapping into an
// unreadable double exposure, or a word interval short enough that the reveal
// stops reading as one word at a time.
describe('the opening script', () => {
  it('plays as separated beats in chronological order', () => {
    expect(INTRO_COPY.length).toBeGreaterThan(0);
    for (const [index, line] of INTRO_COPY.entries()) {
      expect(line.end, `line ${index} must run forwards`).toBeGreaterThan(line.start);
      expect(line.text.trim(), `line ${index} must not be blank`).not.toBe('');
      if (index === 0) continue;
      // A gap, not just an ordering: the previous line has to be off the screen
      // before the next one starts fading in, or they overlap mid-dissolve.
      expect(line.start, `line ${index} must start after line ${index - 1} ends`)
        .toBeGreaterThan(INTRO_COPY[index - 1].end);
    }
  });

  it('is finished before the title takes the screen', () => {
    expect(INTRO_COPY[0].start).toBeGreaterThanOrEqual(0);
    expect(INTRO_COPY.at(-1).end).toBeLessThanOrEqual(TITLE_START);
  });

  // If a word's fade outlasts the gap to the next word, two words brighten at
  // once and the line arrives as a block instead of word by word — which is the
  // whole point of the reveal.
  it('finishes each word before the next one begins', () => {
    expect(WORD_FADE).toBeLessThan(WORD_INTERVAL);
  });

  it('preserves the requested trailer line across its two beats', () => {
    expect(INTRO_COPY_TEXT).toBe("Don't just think outside the box, flip through the cube");
  });

  it('summarises the whole script for screen readers', () => {
    for (const line of INTRO_COPY) expect(INTRO_COPY_TEXT).toContain(line.text);
  });
});

// Three words carry their own move (a box drawn round "box", a somersault on
// "flip", a sticker flip under "cube"). Each must be found in the script and
// finish before its line starts to dissolve, or the move is cut off mid-air.
describe('accent words', () => {
  it('finds every accent in the script and completes its move while the line is fully on screen', () => {
    const found = new Set();
    for (const line of INTRO_COPY) {
      const settled = introCopyFrame(line.end - LINE_DISSOLVE - 0.001);
      for (const word of settled.words) {
        expect(word.reveal).toBe(1);
        if (!word.accent) { expect(word.move).toBe(0); continue; }
        found.add(word.accent);
        expect(word.move, `${word.text} still moving as the line dissolves`).toBe(1);
      }
      const opening = introCopyFrame(line.start);
      expect(opening.words.every(w => w.move === 0 && w.reveal === 0)).toBe(true);
    }
    expect([...found].sort()).toEqual(Object.values(INTRO_ACCENTS).sort());
  });
});
