import { it, expect } from 'vitest';
import { INTRO_COPY, introCopyFrame, WORD_INTERVAL, WORD_FADE, LINE_DISSOLVE } from '../components/intro/introCopy.js';
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
