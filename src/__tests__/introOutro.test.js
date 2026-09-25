import { describe, it, expect } from 'vitest';
import { introOutro, outroWordFade, GLIDE_START, GLIDE_END, OUTRO_TURNS, OUTRO_TURN_TIME, OUTRO_EXIT } from '../components/intro/introOutro.js';
import { INTRO_COPY } from '../components/intro/introCopy.js';
import { INTRO_END } from '../components/intro/introChoreography.js';
import { TITLE_END, DISSOLVE_START, DISSOLVE_END } from '../components/intro/introTiming.js';

const STEP = 1 / 120;
const LEAD_WORDS = INTRO_COPY[0].text.split(' ').length;
// Everything the ending dissolves: the cube, the chrome, the title and each word of the first clause.
const gone = t => {
  const outro = introOutro(t);
  return [outro.cube, outro.chrome, outro.title, ...Array.from({ length: LEAD_WORDS }, (_, i) => outroWordFade(t, i))];
};

// The ending: the title card lingers, everything but "flip through the cube"
// dissolves, and that phrase takes the last beat.
describe('the lingering, dissolving ending', () => {
  it('holds the whole title card for a beat before anything dissolves', () => {
    expect(DISSOLVE_START - (TITLE_END + 0.3)).toBeGreaterThanOrEqual(0.8);
    for (let t = 0; t <= DISSOLVE_START; t += STEP) {
      expect(gone(t).every(v => v === 0)).toBe(true);
      expect(introOutro(t).exit).toBe(0);
    }
  });

  it('dissolves slowly, and leaves nothing but the phrase once the glide lands', () => {
    expect(DISSOLVE_END - DISSOLVE_START).toBeGreaterThanOrEqual(1.5);
    expect(GLIDE_END).toBeLessThanOrEqual(DISSOLVE_END);
    expect(gone(GLIDE_END).every(v => v === 1)).toBe(true);
    // The first clause goes word by word, left to right.
    const mid = DISSOLVE_START + 0.6;
    for (let i = 1; i < LEAD_WORDS; i++) expect(outroWordFade(mid, i)).toBeLessThanOrEqual(outroWordFade(mid, i - 1));
  });

  it('keeps the phrase fully on screen until its own exit, which ends with the intro', () => {
    for (let t = 0; t < INTRO_END - OUTRO_EXIT; t += STEP) expect(introOutro(t).exit).toBe(0);
    expect(introOutro(INTRO_END).exit).toBe(1);
  });

  it('flips FLIP then CUBE after the phrase settles, and reads them before it leaves', () => {
    expect(OUTRO_TURNS[0]).toBeGreaterThanOrEqual(GLIDE_END);
    expect(OUTRO_TURNS[1]).toBeGreaterThan(OUTRO_TURNS[0]);
    expect(INTRO_END - OUTRO_EXIT - (OUTRO_TURNS.at(-1) + OUTRO_TURN_TIME)).toBeGreaterThanOrEqual(0.3);
    expect(introOutro(GLIDE_START).turns).toEqual([0, 0]);
    expect(introOutro(INTRO_END - OUTRO_EXIT).turns).toEqual([1, 1]);
  });

  it('moves continuously', () => {
    for (let t = STEP; t <= INTRO_END; t += STEP) {
      const [a, b] = [introOutro(t - STEP), introOutro(t)];
      for (const key of ['cube', 'chrome', 'title', 'glide', 'exit']) expect(Math.abs(b[key] - a[key]), key).toBeLessThan(0.05);
    }
  });

  it('keeps only the fades for reduced motion: no glide and no sticker turns', () => {
    for (let t = 0; t <= INTRO_END; t += 0.05) {
      const still = introOutro(t, true), full = introOutro(t);
      expect(still.glide).toBe(0);
      expect(still.turns).toEqual([0, 0]);
      for (const key of ['cube', 'chrome', 'title', 'exit']) expect(still[key]).toBe(full[key]);
    }
  });
});
