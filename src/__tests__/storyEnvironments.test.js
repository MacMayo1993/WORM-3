// Story chapters used to render hand-built low-poly scenes, and GameScene only
// mounted a lighting environment for levels with NO background set — so every
// chapter got no image-based lighting at all, and the story cube was lit worse
// than every other mode. Chapters now play against the same shipped panoramas.
//
// These tests keep the casting table honest: every chapter accounted for, every
// file one that actually ships, and no chapter silently falling back to nothing.

import { describe, it, expect } from 'vitest';
import { STORY_ENVIRONMENTS, BACKGROUNDS } from '../utils/backgrounds.js';
import { STORY_LEVELS } from '../levels/index.js';

const shippedFiles = new Set(BACKGROUNDS.map((b) => b.file).filter(Boolean));

describe('story chapter environments', () => {
  it('casts every story chapter', () => {
    for (const level of STORY_LEVELS) {
      expect(
        Object.prototype.hasOwnProperty.call(STORY_ENVIRONMENTS, level.background),
        `chapter ${level.id} (${level.name}) has background "${level.background}" with no entry`
      ).toBe(true);
    }
  });

  it('only references environment files that ship', () => {
    for (const [chapter, file] of Object.entries(STORY_ENVIRONMENTS)) {
      if (file === null) continue; // keeps a bespoke procedural scene
      expect(shippedFiles.has(file), `${chapter} → ${file} is not in BACKGROUNDS`).toBe(true);
    }
  });

  it('reserves the procedural scenes for the two cosmic chapters', () => {
    const procedural = Object.entries(STORY_ENVIRONMENTS)
      .filter(([, file]) => file === null)
      .map(([chapter]) => chapter)
      .sort();
    expect(procedural).toEqual(['blackhole', 'moon']);
  });

  it('gives each of the eight grounded chapters a distinct environment', () => {
    const files = Object.values(STORY_ENVIRONMENTS).filter(Boolean);
    expect(new Set(files).size).toBe(files.length);
  });
});
