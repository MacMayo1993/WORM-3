import { describe, it, expect } from 'vitest';
import { speechSchedule, charsSpoken, speechDuration, CHAR_TIME } from '../components/screens/mobiSpeech.js';

describe('Mobi speaks a line left to right', () => {
  it('reveals characters in order, one at a time', () => {
    const times = speechSchedule('Hi there.');
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
    expect(charsSpoken(times, -1)).toBe(0);
    expect(charsSpoken(times, 0)).toBe(1);
    expect(charsSpoken(times, speechDuration(times))).toBe(times.length);
  });
  it('breathes after commas and longer after full stops, but not inside numbers', () => {
    const times = speechSchedule('Aloha, friend. Tap 3.5 times');
    const gap = i => times[i + 1] - times[i];
    const comma = 'Aloha, friend. Tap 3.5 times'.indexOf(',');
    const stop = 'Aloha, friend. Tap 3.5 times'.indexOf('.');
    const decimal = 'Aloha, friend. Tap 3.5 times'.lastIndexOf('.');
    expect(gap(comma)).toBeGreaterThan(CHAR_TIME * 4);
    expect(gap(stop)).toBeGreaterThan(gap(comma));
    expect(gap(decimal)).toBeCloseTo(CHAR_TIME);
  });
  it('speaks a typical line in about two to three seconds', () => {
    const line = 'Every tile has a twin straight through the middle. Flip one and its twin flips too.';
    const d = speechDuration(speechSchedule(line));
    expect(d).toBeGreaterThan(1.5);
    expect(d).toBeLessThan(3.5);
    expect(speechDuration(speechSchedule(''))).toBe(0);
  });
});
