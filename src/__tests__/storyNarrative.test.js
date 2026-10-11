import { describe, expect, it } from 'vitest';
import { WORM_STORY_LEVELS, WORM_STORY_CHAPTERS, storyChecklist } from '../worm/story/levels.js';
import { WORM_STORY_NARRATIVE, storyNarrative, storyBriefingText, storyLaunchLines } from '../worm/story/narrative.js';
import { TUNNEL_KINDS } from '../worm/story/goalText.js';
import { STORY_POWER_OPENING_DELAY, STORY_POWER_LIFETIME, STORY_POWER_COOLDOWN, STORY_ELEMENTS } from '../worm/story/mastery.js';
import { ELEMENTAL_DURATION } from '../worm/healerWorm/constants.js';
import { requiredPowerCycles } from '../../tools/worm-level-auditor/web/audit.js';
import { requiredPowerCycle } from '../../tools/worm-level-auditor/web/generator.js';
import { MOBI_LINES_DEMO_INTRO } from '../components/screens/MobiIntroScreen.jsx';
import { WORM_CHARACTERS } from '../worm/wormCharacterData.js';

// House style: plain words for the twin geometry (docs/COPY_STYLE.md).
const JARGON = /antipodal|manifold|parity|RP²|RP2/i;

describe('Mobi’s story', () => {
  it('tells every level a story before play and reacts after it', () => {
    expect(Object.keys(WORM_STORY_NARRATIVE).map(Number)).toEqual(WORM_STORY_LEVELS.map(level => level.id));
    for (const level of WORM_STORY_LEVELS) {
      const { briefing, debrief } = storyNarrative(level.id);
      expect(briefing.length, `level ${level.id}`).toBeGreaterThanOrEqual(1);
      expect(briefing.length, `level ${level.id}`).toBeLessThanOrEqual(3);
      for (const line of [...briefing, debrief]) {
        expect(line.trim().length).toBeGreaterThan(10);
        expect(line).not.toMatch(JARGON);
      }
      // Story lines leave counts to the literal mission card.
      expect(briefing.join(' '), `level ${level.id}`).not.toMatch(/\d/);
      expect(storyBriefingText(level.id)).toBe(briefing.join(' '));
    }
  });

  it('launches each level with the story first, then the literal mission, within five cards', () => {
    for (const level of WORM_STORY_LEVELS) {
      const lines = storyLaunchLines(level);
      expect(lines.length).toBeLessThanOrEqual(5);
      expect(lines.at(-1)).toBe(level.goal);
      expect(lines.slice(0, -1)).toEqual(storyNarrative(level.id).briefing);
    }
  });

  it('establishes who Mobi is, where he is from, and what broke his ship', () => {
    const opening = storyBriefingText(1);
    for (const fact of ['Multi-Oriented Block Intelligence', 'Projective Plane', 'Flip Cube', 'W³', 'Great World Worm War']) {
      expect(opening).toContain(fact);
    }
    expect(MOBI_LINES_DEMO_INTRO.join(' ')).toContain('Multi-Oriented Block Intelligence');
    expect(MOBI_LINES_DEMO_INTRO.join(' ')).toContain('Projective Plane');
    expect(WORM_CHARACTERS.find(character => character.id === 'mobi').subtitle).toBe('Multi-Oriented Block Intelligence');
  });

  it('builds to an ending where the war is over and Mobi stays', () => {
    expect(storyNarrative(30).debrief).toContain('World Worm');
    expect(storyNarrative(120).debrief).toContain('Great World Worm War is over');
    expect(storyNarrative(120).debrief).toContain('not going anywhere without you');
  });

  it('gives every chapter its own title and blurb', () => {
    expect(new Set(WORM_STORY_CHAPTERS.map(chapter => chapter.title)).size).toBe(12);
    expect(new Set(WORM_STORY_CHAPTERS.map(chapter => chapter.blurb)).size).toBe(12);
    for (const chapter of WORM_STORY_CHAPTERS) expect(chapter.blurb).not.toMatch(JARGON);
  });
});

describe('the campaign gets harder', () => {
  const chapterOf = level => Math.ceil(level.id / 10);
  const mean = list => list.reduce((sum, n) => sum + n, 0) / list.length;
  const goals = levels => mean(levels.map(level => storyChecklist(level).length));
  const levelsIn = (from, to) => WORM_STORY_LEVELS.filter(level => chapterOf(level) >= from && chapterOf(level) <= to);

  it('asks for more tasks in each third of the story', () => {
    expect(goals(levelsIn(5, 8))).toBeGreaterThan(goals(levelsIn(1, 4)));
    expect(goals(levelsIn(9, 12))).toBeGreaterThan(goals(levelsIn(5, 8)));
    expect(storyChecklist(WORM_STORY_LEVELS.at(-1)).length).toBe(Math.max(...WORM_STORY_LEVELS.map(level => storyChecklist(level).length)));
  });

  it('crawls faster on full-size decks from chapter to chapter after the opening', () => {
    const speed = chapter => mean(WORM_STORY_LEVELS.filter(level => chapterOf(level) === chapter && level.cubeSize >= 5).map(level => level.speed));
    for (let chapter = 8; chapter <= 12; chapter++) expect(speed(chapter)).toBeGreaterThanOrEqual(speed(chapter - 1));
    expect(speed(12)).toBeGreaterThan(speed(4));
  });

  it('grows huge worms on big and small decks, with longer bodies later', () => {
    const longest = (from, to) => Math.max(...levelsIn(from, to).map(level => level.mechanics?.bodyLength ?? 0));
    expect(longest(9, 12)).toBeGreaterThan(longest(5, 8));
    expect(longest(5, 8)).toBeGreaterThan(longest(1, 4) - 1);
    for (let chapter = 5; chapter <= 12; chapter++) {
      expect(levelsIn(chapter, chapter).filter(level => level.mechanics?.bodyLength).length).toBeGreaterThanOrEqual(5);
    }
    // A pocket deck and a mega deck both ask for a worm that fills a real share of the board.
    const share = level => level.mechanics.bodyLength * 0.09 / (6 * level.cubeSize ** 2);
    expect(WORM_STORY_LEVELS.some(level => level.cubeSize <= 3 && level.mechanics?.bodyLength && share(level) >= 0.25)).toBe(true);
    expect(WORM_STORY_LEVELS.some(level => level.cubeSize >= 10 && (level.mechanics?.bodyLength ?? 0) >= 200)).toBe(true);
  });

  it('teaches passes and double heals, then asks for them in every later chapter', () => {
    const first = key => WORM_STORY_LEVELS.find(level => level.mechanics?.[key]);
    expect(first('selfPasses').id).toBe(43);
    expect(first('multiHeals').id).toBe(54);
    expect(first('multiHeals').kind).toBe('tunnel'); // first double heals are free rides
    for (let chapter = 7; chapter <= 12; chapter++) {
      const levels = levelsIn(chapter, chapter);
      expect(levels.some(level => level.mechanics?.selfPasses)).toBe(true);
      expect(levels.some(level => level.mechanics?.multiHeals)).toBe(true);
    }
  });
});

describe('every level can be supplied', () => {
  it.each(WORM_STORY_LEVELS)('level $id fits its board, its tunnels and its clock', level => {
    const m = level.mechanics ?? {};
    // Passes, double heals and surrounds need staged tunnels; surrounds and
    // abilities would hold a tunnel trial's free heals.
    if (m.selfPasses || m.multiHeals || m.ringHeals) expect(TUNNEL_KINDS).toContain(level.kind);
    if (m.ringHeals || m.signatures) expect(level.kind).not.toBe('tunnel');
    if (m.ringHeals) expect(m.ringHeals).toBeLessThanOrEqual(level.target);
    if (TUNNEL_KINDS.includes(level.kind)) expect(level.target).toBeLessThanOrEqual(level.cubeSize <= 3 ? 4 : 6);
    // Paired element offers start at level 21.
    if (m.fusions || m.uniqueFusions || m.steamFusions || m.quenchFusions) expect(level.id).toBeGreaterThanOrEqual(21);
    const pool = Math.max(m.uniqueElements ?? 0, m.elements ?? 0, m.elementPickups ?? 0) || STORY_ELEMENTS.length;
    if (m.uniqueFusions) expect(m.uniqueFusions).toBeLessThanOrEqual(pool * (pool - 1));
    if (level.kind === 'jump') expect(m.bodyJumps).toBeUndefined();
    // A stated orb count covers the growth task.
    if (m.bodyLength) {
      expect(m.bodyLength).toBeLessThanOrEqual(10 + 3 * (level.orbs ?? (level.kind === 'orbs' ? level.target : Infinity)));
      expect(level.goal).toContain(`grow to ${m.bodyLength} segments`);
    }
    // The auditor's conservative power-offer model (two missed cycles) fits the clock.
    const powers = requiredPowerCycle(level).length;
    const budget = powers ? STORY_POWER_OPENING_DELAY + 2 * powers * (STORY_POWER_LIFETIME + STORY_POWER_COOLDOWN)
      + requiredPowerCycles(level) * powers * (ELEMENTAL_DURATION + 4 + STORY_POWER_COOLDOWN) : 0;
    expect(budget).toBeLessThan(level.limit);
    expect(level.par).toBeLessThan(level.limit);
  });
});
