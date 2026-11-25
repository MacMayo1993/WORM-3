import { describe, it, expect } from 'vitest';
import { INTRO_BEATS, beatsCrossed, introStartTime, INTRO_RETURN_START } from '../components/intro/introBeats.js';
import { INTRO_FINISH, IMPLODE_START, IMPLODE_END } from '../components/intro/introTiming.js';
import { sampleIntro } from '../components/intro/introChoreography.js';

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

describe('a returning player', () => {
  it('starts with the burst cube about to snap shut, then gets the title and the dive', () => {
    expect(introStartTime(false)).toBe(0);
    expect(introStartTime(true, true)).toBe(0);
    expect(introStartTime(true)).toBe(INTRO_RETURN_START);
    expect(INTRO_RETURN_START).toBeLessThan(IMPLODE_START);
    expect(sampleIntro(INTRO_RETURN_START).open).toBe(1);
    expect(sampleIntro(IMPLODE_END).open).toBe(0);
    // Half the opening or less.
    expect(INTRO_FINISH - INTRO_RETURN_START).toBeLessThan(INTRO_FINISH * 0.55);
  });
});
