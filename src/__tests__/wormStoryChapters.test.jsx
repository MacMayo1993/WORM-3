import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WORM_STORY_LEVELS, WORM_STORY_CHAPTERS, STORY_MECHANIC_LABELS, storyChapterId, storyChapterIndex,
  isChapterFinale, storyLaunchSettings, storyLevel, storyUnlocked, storyChecklist } from '../worm/story/levels.js';
import { STORY_WORLDS, storyView, storyAppearance } from '../worm/story/worlds.js';
import { stageStory, replenishStoryOrbs, storyBodyPath, storyMouths } from '../worm/story/runtime.js';
import { nextStoryPower, updateMastery, offerStoryPower, STORY_ELEMENTS } from '../worm/story/mastery.js';
import { makeWormSim, resetWormSim, tileKey } from '../worm/healerWorm/wormSim.js';
import { getActiveTunnels } from '../worm/wormLogic.js';
import { getStoreItem } from '../utils/storeCatalog.js';
import { DEFAULT_SETTINGS } from '../utils/colorSchemes.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { newProgress } from '../progression/model.js';
import WormEntryScreen from '../components/screens/WormEntryScreen.jsx';
import { StoryResult } from '../worm/story/StoryCards.jsx';

vi.mock('../components/screens/WormModeSetupWizard.jsx', () => ({ default: () => null }));

const state = () => useGameStore.getState();
const cleared = n => ({ ...newProgress(), wormStory: { stars: Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, 1])), claimed: {} } });
const stage = (level, character = 'classic') => {
  const size = level.cubeSize ?? 5, sim = makeWormSim(size);
  resetWormSim(sim, size, { orbCount: 0, wormholeInterval: 9999 });
  return { size, sim, staged: stageStory(sim, size, level, character) };
};
const VISUAL_MODES = ['classic', 'grid', 'sudokube', 'wireframe', 'glass', 'chrome', 'neon', 'gap', 'lego'];

describe('chapter structure', () => {
  it('groups 120 consecutive levels into twelve chapters of ten', () => {
    expect(WORM_STORY_LEVELS.map(level => level.id)).toEqual(Array.from({ length: 120 }, (_, i) => i + 1));
    expect(WORM_STORY_CHAPTERS.map(chapter => chapter.levels.map(level => level.id))).toEqual(
      Array.from({ length: 12 }, (_, c) => Array.from({ length: 10 }, (_, i) => c * 10 + i + 1)));
    expect([storyChapterId(10), storyChapterId(11), storyChapterIndex(14), storyChapterIndex(40)]).toEqual([1, 2, 4, 10]);
    expect(WORM_STORY_LEVELS.filter(level => isChapterFinale(level.id)).map(level => level.id)).toEqual(Array.from({ length: 12 }, (_, i) => (i + 1) * 10));
  });

  it('unlocks a chapter only when the previous chapter is finished', () => {
    expect(storyUnlocked(cleared(9), 11)).toBe(false);
    expect(storyUnlocked(cleared(10), 11)).toBe(true);
    expect(storyUnlocked(cleared(29), 31)).toBe(false);
    expect(storyUnlocked(cleared(30), 31)).toBe(true);
    expect(storyUnlocked(cleared(39), 41)).toBe(false);
    expect(storyUnlocked(cleared(40), 41)).toBe(true);
    expect(storyUnlocked(cleared(118), 120)).toBe(false);
    expect(storyUnlocked(cleared(119), 120)).toBe(true);
  });
});

describe('the new chapters use the whole cube', () => {
  const later = WORM_STORY_LEVELS.filter(level => level.id > 10);

  it('covers every cube size from 2×2 to 10×10 plus the 15×15 mega cube', () => {
    expect([...new Set(later.map(level => level.cubeSize ?? 5))].sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 15]);
  });

  it('covers stable visual modes, the hollow frame, Biome and the far-side window', () => {
    const views = later.map(level => STORY_WORLDS[level.id].view);
    expect(new Set(views.map(view => view.visualMode ?? 'classic'))).toEqual(new Set(VISUAL_MODES));
    for (const flag of ['hollowMode', 'biome', 'farSide']) expect(views.some(view => view[flag])).toBe(true);
  });

  it('covers every objective type and every mechanic, including explode', () => {
    expect(new Set(later.map(level => level.kind))).toEqual(new Set(['orbs', 'tunnel', 'jump', 'rotation', 'collector', 'restore', 'mastery']));
    const used = new Set(later.flatMap(level => Object.keys(level.mechanics ?? {})));
    expect(used).toEqual(new Set(Object.keys(STORY_MECHANIC_LABELS)));
    expect(later.some(level => level.rotateEvery)).toBe(true);
  });

  it('reserves the longest final checklists for later chapters', () => {
    for (const chapter of WORM_STORY_CHAPTERS.slice(1)) {
      const goals = chapter.levels.map(level => storyChecklist(level).length);
      expect(goals.at(-1)).toBe(Math.max(...goals));
    }
    const finale = storyLevel(40);
    expect(finale.limit).toBe(Math.max(...WORM_STORY_LEVELS.filter(level => level.id <= 40).map(level => level.limit)));
  });
});

describe('mini cube precision stages', () => {
  const minis = WORM_STORY_LEVELS.filter(level => level.cubeSize <= 3);
  it.each(minis)('leaves steering time and recovery space in level $id', level => {
    // Later chapters increase the task difficulty, not speed regardless of size.
    expect(level.cubeSize / level.speed).toBeGreaterThanOrEqual(1);
    if (level.rotateEvery) {
      expect(level.rotateEvery).toBeGreaterThanOrEqual(7);
      expect(level.target * level.rotateEvery).toBeLessThan(level.par);
    }
    const normal = stage(level, 'glow');
    const classic = stage(level, 'classic');
    expect(classic.sim.powerups.length).toBeGreaterThan(normal.sim.powerups.length);
    for (const { size, sim, staged } of [normal, classic]) {
      const tiles = 6 * size * size;
      expect(sim.powerups.length / tiles).toBeLessThanOrEqual(0.6);
      if (level.id <= 40) expect(sim.powerups.length).toBeGreaterThan(level.orbs ?? (level.kind === 'orbs' ? level.target : 0));
      for (const face of ['PZ', 'NZ', 'PX', 'NX', 'PY', 'NY']) {
        const pickups = sim.powerups.filter(orb => orb.dirKey === face);
        expect(pickups.length).toBeGreaterThanOrEqual(2);
        for (const orb of pickups) {
          const sticker = staged.cubies[orb.x][orb.y][orb.z].stickers[face];
          expect(sticker.curr).toBe(sticker.orig);
        }
      }
      expect(sim.specials).toHaveLength(0);
      expect(getActiveTunnels(staged.cubies, size)).toHaveLength(['tunnel', 'collector', 'restore', 'mastery'].includes(level.kind) ? Math.min(2,level.target) : 0);
    }
  });
  it('retains the later pocket stage as a harder rotation challenge', () => {
    expect(storyLevel(33).speed).toBeGreaterThan(storyLevel(11).speed);
    expect(storyLevel(11).rotateEvery).toBeUndefined();
    expect(storyLevel(33).target).toBeGreaterThan(storyLevel(14).target);
  });
});

describe.each(WORM_STORY_LEVELS.filter(level => level.id > 10))('level $id: $title', level => {
  it('stages a board the objective can be completed on', () => {
    const { size, sim, staged } = stage(level);
    const tunnels = getActiveTunnels(staged.cubies, size);
    const pairs = ['tunnel', 'collector', 'restore', 'mastery'].includes(level.kind) ? level.target : 0;
    expect(tunnels).toHaveLength(Math.min(2,pairs));
    expect(tunnels.length + staged.pendingMouths.length).toBe(pairs);
    // Authored opening inventories are unchanged; new routes may rely on real refills.
    if (level.id <= 40) expect(sim.powerups.length).toBeGreaterThanOrEqual(Math.max(level.orbs ?? 0, level.kind === 'orbs' ? level.target : 0));
    const colors = new Set(sim.powerups.map(orb => staged.cubies[orb.x][orb.y][orb.z].stickers[orb.dirKey].curr));
    expect(colors.size).toBe(6);
    const body = new Set(storyBodyPath(size, level).map(([x, y]) => `${x},${y},${size - 1},PZ`));
    // The route itself stays off the body; a staged magnet may add catch orbs beside its own tile.
    const route = stage({ ...level, mechanics: undefined }).sim.powerups;
    for (const orb of route) expect(body.has(tileKey(orb))).toBe(false);
    for (const orb of sim.powerups) {
      for (const axis of ['x', 'y', 'z']) expect(orb[axis]).toBeGreaterThanOrEqual(0), expect(orb[axis]).toBeLessThan(size);
    }
    for (const [x, y] of storyBodyPath(size, level)) expect(x >= 0 && x < size && y >= 0 && y < size).toBe(true);
  });

  it('restores all six colors after depletion, even when the target exceeds opening inventory', () => {
    const { size, sim, staged } = stage(level);
    sim.powerups = []; sim.specials = []; staged.orbRefillDelay = 0;
    expect(replenishStoryOrbs(sim, staged, { cubies: staged.cubies }, size, 0.1)).toBe(true);
    expect(new Set(sim.powerups.map(orb => staged.cubies[orb.x][orb.y][orb.z].stickers[orb.dirKey].orig)).size).toBe(6);
  });

  it('keeps tunnel mouths clear of the head and its body', () => {
    const size = level.cubeSize ?? 5;
    const body = new Set(storyBodyPath(size, level).map(([x, y]) => `${x},${y},${size - 1},PZ`));
    const mouths = storyMouths(size, 6).map(([x, y, z, dirKey]) => tileKey({ x, y, z, dirKey }));
    expect(new Set(mouths).size).toBe(mouths.length);
    if (level.kind !== 'jump') for (const key of mouths) expect(body.has(key)).toBe(false);
  });

  it('only asks for fights, bombs and surrounds on boards with room for them', () => {
    const size = level.cubeSize ?? 5, m = level.mechanics ?? {};
    if (m.kills || m.bombs || m.ringHeals) expect(size).toBeGreaterThanOrEqual(5);
    if (m.magnetOrbs) expect(size).toBeGreaterThanOrEqual(4);
    if (level.kind === 'jump') {
      expect(size).toBeGreaterThanOrEqual(4);
      const { staged } = stage(level);
      expect(storyBodyPath(size, level).some(([x, y]) => x === staged.target.x && y === staged.target.y)).toBe(true);
    }
  });

  it('keeps the opening clear and offers a required power after the delay when there is room', () => {
    const { size, sim, staged } = stage(level);
    expect(sim.specials).toHaveLength(0);
    if (!nextStoryPower(staged, level)) return;
    staged.powerDelay = 0; // Opening clock is exercised in storyPowerPacing.test.js.
    if (!sim.specials.length) {
      // Offers retry every tick; eating the orbs around the head frees a tile.
      sim.powerups = sim.powerups.filter(orb => orb.dirKey !== sim.pos.dirKey);
      offerStoryPower(sim, staged, level, size, staged.cubies);
    }
    // From level 21 an elemental offer may come with a distinct elemental partner.
    const paired = level.id >= 21 && STORY_ELEMENTS.includes(sim.specials[0]?.type);
    expect(sim.specials.length).toBeGreaterThanOrEqual(1);
    expect(sim.specials.length).toBeLessThanOrEqual(paired ? 2 : 1);
    if (sim.specials.length === 2) expect(STORY_ELEMENTS).toContain(sim.specials[1].type);
    expect(new Set(sim.specials.map(orb => orb.type)).size).toBe(sim.specials.length);
  });

  it('states every numeric target in its goal text and pays in real store items', () => {
    const numbers = [level.target, level.orbs, level.rotations, ...Object.values(level.mechanics ?? {})].filter(n => n > 1);
    for (const n of numbers) expect(level.goal).toMatch(n === 2 ? /\b2\b|twice/ : new RegExp(`\\b${n}\\b`));
    for (const id of level.reward ?? []) expect(getStoreItem(id)).toBeTruthy();
    expect(level.par).toBeLessThan(level.limit);
  });
});

describe('explode mechanic', () => {
  it('counts one explosion only after the cube closes with the worm crawling on it', () => {
    const level = storyLevel(18), { sim, staged } = stage(level);
    expect(nextStoryPower(staged, level)).toBe('explode');
    expect(sim.specials).toHaveLength(0);
    sim.explodeT = 5; sim.expansionAmount = 0.35;
    updateMastery(sim, staged, level, 0.1);
    sim.explodeT = 0; updateMastery(sim, staged, level, 0.1);
    expect(staged.mechanics.explodes ?? 0).toBe(0); // still closing
    sim.expansionAmount = 0; updateMastery(sim, staged, level, 0.1); updateMastery(sim, staged, level, 0.1);
    expect(staged.mechanics.explodes).toBe(1);
    staged.mechanics.explodes = 2;
    expect(nextStoryPower(staged, level)).toBeNull();
  });
});

describe('level views', () => {
  beforeEach(() => {
    state().clearDisparityGame();
    useGameStore.setState({ settings: { ...DEFAULT_SETTINGS, colorScheme: 'sunset' }, demoMode: false,
      visualMode: 'neon', hollowMode: false, randomMode: false, showAntipodalPiP: false, playerProgress: cleared(40) });
  });
  const init = id => state().initWormMode(undefined, undefined, null, null, null, null, false, false, id);

  it.each([[12, { visualMode: 'grid' }], [14, { visualMode: 'glass' }], [16, { visualMode: 'classic' }],
    [21, { hollowMode: true }], [22, { visualMode: 'wireframe' }], [26, { randomMode: false }],
    [38, { visualMode: 'sudokube', showAntipodalPiP: true }], [1, { visualMode: 'classic', hollowMode: false }]])(
    'level %i applies its view and restores the player’s own on exit', (id, expected) => {
      init(id);
      expect(state()).toMatchObject(expected);
      state().clearDisparityGame();
      expect(state()).toMatchObject({ visualMode: 'neon', hollowMode: false, randomMode: false, showAntipodalPiP: false, wormStoryViewBase: null });
    });

  it('keeps the player’s view base across retries and level-to-level moves', () => {
    init(22); init(23); init(23);
    expect(state().visualMode).toBe('lego');
    state().setWormHealerMode(false);
    expect(state().visualMode).toBe('neon');
  });

  it('dresses the Biome level in its palette and a single water style without its city renderer', () => {
    init(24);
    expect(state().settings).toMatchObject({ colorScheme: 'biome', biomeMode: { enabled: false, faceAssignment: null } });
    expect(Object.values(state().settings.manifoldStyles)).toEqual(Array(6).fill('water'));
    expect(storyAppearance(24).colorScheme).toBe('biome');
    state().clearDisparityGame();
    expect(state().settings.colorScheme).toBe('sunset');
    expect(state().settings.biomeMode?.enabled).not.toBe(true);
  });

  it('describes a plain world as the classic, solid cube', () => {
    expect(storyView(31)).toEqual({ visualMode: 'classic', hollowMode: false, randomMode: false, showAntipodalPiP: false });
  });

  it('launches the 15×15 level in Mega’s effects tier and every other level without it', () => {
    expect(storyLaunchSettings(storyLevel(39))).toMatchObject({ cubeSize: 15, megaMode: true, storyLevel: 39 });
    expect(storyLaunchSettings(storyLevel(11))).toMatchObject({ cubeSize: 2, megaMode: false });
  });
});

describe('chapter UI', () => {
  let host, root;
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); state().clearDisparityGame(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
  const click = label => act(() => [...host.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent).includes(label)).click());

  it('locks later chapters, opens the next one at its first level, and launches its board', () => {
    useGameStore.setState({ playerProgress: cleared(10), ownedItems: [], parityPoints: 0 });
    const complete = vi.fn(), unlockTwelve = () => useGameStore.setState({ playerProgress: cleared(11) });
    act(() => root.render(<WormEntryScreen onComplete={complete} onCancel={() => {}} initialPage="story" />));
    const tabs = [...host.querySelectorAll('.worm-chapter-tabs button')];
    expect(tabs.map(tab => tab.disabled)).toEqual([false, false, ...Array(10).fill(true)]);
    // Resumes on the first unplayed level, which is the start of chapter two.
    expect(host.querySelector('.worm-level-grid [aria-pressed="true"]').getAttribute('aria-label')).toContain('Pocket Crawl');
    expect([...host.querySelectorAll('.worm-level-grid button')]).toHaveLength(10);
    expect(host.querySelector('.worm-level-board').textContent).toBe('2×2 cube');
    click('Chapter 1'); expect(host.querySelector('.worm-level-grid [aria-pressed="true"]').getAttribute('aria-label')).toContain('First Crawl');
    click('Chapter 2');
    expect(host.querySelector('[aria-label^="Level 12"]').disabled).toBe(true);
    act(unlockTwelve); click('Grid Lines');
    expect(host.querySelector('.worm-level-board').textContent).toBe('3×3 cube · Grid view');
    click('Play level');
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ storyLevel: 12, cubeSize: 3, megaMode: false }));
  });

  it.each([[40, 41, 5], [119, 120, 12]])('resumes a %i-level save and launches generated level %i in chapter %i', (completed, id, chapter) => {
    useGameStore.setState({ playerProgress: cleared(completed), ownedItems: [], parityPoints: 0 });
    const complete = vi.fn();
    act(() => root.render(<WormEntryScreen onComplete={complete} onCancel={() => {}} initialPage="story" />));
    expect(host.querySelector('.worm-chapter-tabs [aria-pressed="true"]').getAttribute('aria-label')).toContain(`Chapter ${chapter}:`);
    expect(host.querySelector('.worm-level-grid [aria-pressed="true"]').getAttribute('aria-label')).toContain(`Level ${id}:`);
    click('Play level');
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ storyLevel: id, cubeSize: storyLevel(id).cubeSize,
      perFaceStyles: STORY_WORLDS[id].styles, ...storyAppearance(id) }));
  });

  it.each([[14, 'Level complete', 'Next level'], [20, 'Chapter complete', 'Start chapter 3'], [40, 'Chapter complete', 'Start chapter 5'], [110, 'Chapter complete', 'Start chapter 12'], [120, 'Story complete', 'Levels']])(
    'titles the level %i result and offers the right next step', (id, heading, primary) => {
      const next = vi.fn(), levels = vi.fn();
      useGameStore.setState({ wormStoryResult: { levelId: id, stars: 2, seconds: 100, xp: 50, points: 30 } });
      act(() => root.render(<StoryResult onNext={next} onRetry={() => {}} onLevels={levels} />));
      expect(host.querySelector('h2').textContent).toBe(heading);
      expect(host.textContent).toContain(`Chapter ${storyChapterId(id)} · Level ${storyChapterIndex(id)} / 10`);
      const button = host.querySelector('.worm-story-primary');
      expect(button.textContent).toContain(primary);
      act(() => button.click());
      expect((id === 120 ? levels : next)).toHaveBeenCalledOnce();
    });
});
