import { describe, it, expect } from 'vitest';
import { INTRO_BEATS, beatsCrossed } from '../components/intro/introBeats.js';
import { INTRO_FINISH } from '../components/intro/introTiming.js';
import { INTRO_COPY, introCopyFrame } from '../components/intro/introCopy.js';

describe('the opening beats', () => {
  it('plays every beat exactly once over a run at any frame rate', () => {
    for (const step of [1 / 30, 1 / 60, 1 / 144, 0.1]) {
      const heard = [];
      let last = 0;
      for (let t = step; t <= INTRO_FINISH + step; t += step) { heard.push(...beatsCrossed(last, t)); last = t; }
      expect(heard).toEqual(INTRO_BEATS.map(beat => beat.event));
    }
  });

  it('stays quiet for a replayed frame or a jump back, and drops the dive for reduced motion', () => {
    expect(beatsCrossed(3, 3)).toEqual([]);
    expect(beatsCrossed(9, 2)).toEqual([]);
    expect(beatsCrossed(0, INTRO_FINISH, true)).not.toContain('dive');
  });

  it('keeps beats apart so no two sounds land on top of each other', () => {
    const times = INTRO_BEATS.map(beat => beat.at).sort((a, b) => a - b);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThan(0.2);
  });
});

describe('every launch', () => {
  // A returning player once started at the snap-shut and lost the tagline; the
  // whole opening plays every time, its two lines word by word.
  it('plays both tagline lines, each one landing word by word', () => {
    for (const line of INTRO_COPY) {
      const words = line.text.split(' ');
      const early = introCopyFrame(line.start + 0.05);
      expect(early.beat).toBe(line);
      expect(early.words[0].opacity).toBeGreaterThan(0);
      expect(early.words[words.length - 1].opacity).toBe(0);
      const landed = introCopyFrame(line.end - 0.5);
      for (const word of landed.words) expect(word.opacity).toBeGreaterThan(0.5);
    }
  });
});
