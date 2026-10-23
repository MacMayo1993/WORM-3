import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordFreeBests, recordStoryTime, freeBestKey, storyTimeKey } from '../progression/wormBests.js';
import { newProgress, sanitizeProgress } from '../progression/model.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { storyLevel, storyChecklist } from '../worm/story/levels.js';
import { nextStarHint } from '../worm/story/starGoals.js';
import { feel } from '../utils/feel.js';
vi.mock('../utils/feel.js', async original => ({ ...(await original()), feel: vi.fn(), resumeFeel: vi.fn() }));
vi.mock('../utils/device.js', async original => ({ ...(await original()), prefersReducedMotion: vi.fn(() => true) }));
import { StoryResult } from '../worm/story/StoryCards.jsx';
import DeathScreen from '../worm/DeathScreens.jsx';

const state = () => useGameStore.getState();

// Personal bests turn a run's end into progress: free play keeps the best orbs,
// heals, chain and time per board size; Story keeps each level's fastest clear.
describe('the records', () => {
  it('sets the bar on a first run and reports only records that were beaten', () => {
    const first = recordFreeBests({}, 5, { orbs: 12, heals: 2, chain: 3, time: 61.9 });
    expect(first.beaten).toEqual([]);
    expect(first.bests).toMatchObject({ [freeBestKey(5, 'orbs')]: 12, [freeBestKey(5, 'time')]: 61, [freeBestKey(5, 'chain')]: 3 });
    const second = recordFreeBests(first.bests, 5, { orbs: 15, heals: 1, chain: 0, time: 61 });
    expect(second.beaten).toEqual(['orbs']);
    expect(second.previous).toEqual({ orbs: 12 });
    expect(second.bests[freeBestKey(5, 'heals')]).toBe(2);
    // Another board size keeps its own records.
    expect(recordFreeBests(second.bests, 4, { orbs: 1 }).beaten).toEqual([]);
  });

  it('keeps the fastest Story clear', () => {
    const a = recordStoryTime({}, 7, 51);
    expect(a).toMatchObject({ previous: null, improved: false, bests: { [storyTimeKey(7)]: 51 } });
    const b = recordStoryTime(a.bests, 7, 42);
    expect(b).toMatchObject({ previous: 51, improved: true, bests: { [storyTimeKey(7)]: 42 } });
    const c = recordStoryTime(b.bests, 7, 60);
    expect(c).toMatchObject({ previous: 42, improved: false });
    expect(c.bests[storyTimeKey(7)]).toBe(42);
  });

  it('survives a reload', () => {
    const { bests } = recordFreeBests({}, 15, { orbs: 40, heals: 3, chain: 9, time: 300 });
    const reloaded = sanitizeProgress({ ...newProgress(), bests: { ...bests, ...recordStoryTime({}, 120, 99).bests } });
    expect(reloaded.bests).toMatchObject(bests);
    expect(reloaded.bests[storyTimeKey(120)]).toBe(99);
  });

  it('names what the next star needs', () => {
    const level = storyLevel(4);
    expect(nextStarHint(level, 1, {})).toContain(`${level.par}s or avoid tail cuts`);
    expect(nextStarHint(level, 2, { fast: true, clean: false, grown: true })).toBe('no tail cuts');
    expect(nextStarHint(level, 2, { fast: false, clean: true, grown: false })).toMatch(/^finish within .*, reach \S+ tiles$/);
    expect(nextStarHint(level, 3, {})).toBeNull();
  });
});

describe('recording a run', () => {
  let before;
  beforeEach(() => { before = state(); useGameStore.setState({ playerProgress: newProgress(), demoMode: false }); });
  afterEach(() => useGameStore.setState(before, true));
  const freePlay = patch => useGameStore.setState({ wormHealerMode: true, wormStoryLevel: null, wormCombatMode: false, wormRunId: 7, size: 5,
    wormSessionOrbs: 10, wormHealedCount: 1, wormRunBestCombo: 2, wormTimeAlive: 30, wormRunBests: null, ...patch });

  it('records free play once per run and flags what beat a record', () => {
    freePlay();
    state().recordWormRunBests(7);
    expect(state().wormRunBests).toEqual({ runId: 7, beaten: [], previous: {} });
    freePlay({ wormRunId: 8, wormSessionOrbs: 14, wormTimeAlive: 20 });
    state().recordWormRunBests(8);
    expect(state().wormRunBests).toEqual({ runId: 8, beaten: ['orbs'], previous: { orbs: 10 } });
    // Once per run: a second call changes nothing.
    useGameStore.setState({ wormSessionOrbs: 99 });
    state().recordWormRunBests(8);
    expect(state().playerProgress.bests[freeBestKey(5, 'orbs')]).toBe(14);
  });

  it.each([['Story', { wormStoryLevel: 3 }], ['combat', { wormCombatMode: true }], ['the demo', { demoMode: true }], ['a stale run', { wormRunId: 9 }]])(
    'never writes free play records from %s', (_label, patch) => {
      freePlay(patch);
      state().recordWormRunBests(7);
      expect(state().playerProgress.bests).toEqual({});
    });

  it('gives a Story clear its previous stars, best time and level-up', () => {
    const won = { alive: true, elapsed: 10, cuts: 0, peakLength: 100, landed: true,
      ...Object.fromEntries(storyChecklist(storyLevel(1)).map(goal => [goal.key, goal.target])) };
    const play = metrics => {
      state().clearDisparityGame();
      state().initWormMode(undefined, undefined, 3.5, 1, 30, null, true, true, 1);
      useGameStore.setState({ wormStoryReady: true, wormGamePhase: 'active' });
      state().startWormStory();
      useGameStore.setState({ wormGamePhase: 'active', wormCountdownStep: null, wormPaused: false });
      state().completeWormStory(state().wormRunId, metrics);
      return state().wormStoryResult;
    };
    const first = play({ ...won, elapsed: 30, cuts: 1 });
    expect(first).toMatchObject({ first: true, previousStars: 0, previousTime: null, newBestTime: false });
    const again = play({ ...won, elapsed: 12 });
    expect(again).toMatchObject({ first: false, previousStars: first.stars, previousTime: 30, newBestTime: true, seconds: 12 });
    expect(again.stars).toBeGreaterThan(first.stars);
    // Enough XP for a level: the card carries it, and the toast stays hidden under it.
    useGameStore.setState({ playerProgress: { ...newProgress(), xp: 95 } });
    expect(play(won).levelUp).toMatchObject({ level: 2, points: 25 });
  });
});

describe('the cards', () => {
  let root, host, before;
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.mocked(feel).mockClear(); vi.useFakeTimers();
    before = state();
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount()); host.remove(); vi.useRealTimers();
    useGameStore.setState(before, true); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('stamps the death card\'s beaten numbers and chimes once', () => {
    useGameStore.setState({ wormRunId: 4, wormRunBests: { runId: 4, beaten: ['orbs', 'time'], previous: { orbs: 3, time: 20 } }, wormRunBestCombo: 0 });
    act(() => root.render(<DeathScreen deathDetails={{ reason: 'self' }} wormTimeAlive={40} wormHealedCount={1} wormTunnelCount={2}
      wormSessionOrbs={9} formatTime={s => `${s}s`} onRetry={() => {}} onNewGame={() => {}} />));
    const stamped = [...host.querySelectorAll('.worm-death-stat')].filter(el => el.querySelector('.worm-new-best')).map(el => el.textContent);
    expect(stamped).toHaveLength(2);
    expect(stamped[0]).toContain('Orbs');
    expect(stamped[1]).toContain('Time');
    act(() => vi.advanceTimersByTime(1000));
    expect(vi.mocked(feel).mock.calls.filter(([e]) => e === 'storyStar')).toHaveLength(1);
    // A stale record (another run) stamps nothing.
    act(() => useGameStore.setState({ wormRunId: 5 }));
    expect(host.querySelector('.worm-new-best')).toBeNull();
  });

  it('shows what a Story clear changed, reveals unlocks, and says what the next star needs', () => {
    useGameStore.setState({ wormGamePhase: 'solved', wormStoryLevel: 4, wormRunId: 3, wormRunBestCombo: 0,
      wormStoryResult: { levelId: 4, stars: 2, first: false, previousStars: 1, seconds: 42, previousTime: 51, newBestTime: true,
        starGoals: { fast: true, clean: false, grown: true }, levelUp: { level: 6, points: 25 }, unlockedModes: ['chaos'] } });
    act(() => root.render(<StoryResult onNext={() => {}} onRetry={() => {}} onLevels={() => {}} />));
    const records = host.querySelector('.story-completion-records').textContent;
    expect(records).toContain('★ → ★★');
    expect(records).toContain('42s · new best (was 51s)');
    expect(records).toContain('Level 6 · +25 PP');
    expect(host.querySelector('.story-completion-next-star').textContent).toContain('no tail cuts');
    // The unlock is out in the open, not inside a closed fold.
    const unlock = host.querySelector('.story-completion-unlocks');
    expect(unlock.textContent).toContain('New mode unlocked');
    expect(unlock.closest('details')).toBeNull();
  });
});
