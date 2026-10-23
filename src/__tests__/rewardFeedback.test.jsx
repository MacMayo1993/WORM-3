import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('../utils/feel.js', async original => ({ ...(await original()), feel: vi.fn() }));
import { feel } from '../utils/feel.js';
import ChallengeToast from '../worm/ChallengeToast.jsx';
import { LevelUpCue } from '../progression/ProgressWidgets.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { newProgress, xpForLevel } from '../progression/model.js';

// Rewards that used to land in silence: a free-play challenge (screen readers only)
// and the level-up toast now show and sound.
let root, host, before;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.useFakeTimers(); vi.mocked(feel).mockClear();
  before = useGameStore.getState();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); useGameStore.setState(before, true); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });

it('shows and chimes a challenge completed this run, never one carried in from a new run', () => {
  useGameStore.setState({ wormRunId: 3, wormRunAchievements: [] });
  act(() => root.render(<ChallengeToast />));
  act(() => useGameStore.setState({ wormRunAchievements: [{ title: 'Collect 10 orbs', reward: 40 }] }));
  const toast = host.querySelector('.worm-challenge-toast');
  expect(toast.textContent).toContain('Collect 10 orbs');
  expect(toast.textContent).toContain('+40 PP');
  expect(feel).toHaveBeenCalledWith('storyTask');
  act(() => vi.advanceTimersByTime(3000));
  expect(host.querySelector('.worm-challenge-toast')).toBeNull();
  vi.mocked(feel).mockClear();
  act(() => useGameStore.setState({ wormRunId: 4, wormRunAchievements: [{ title: 'Old', reward: 1 }, { title: 'Older', reward: 1 }] }));
  expect(host.querySelector('.worm-challenge-toast')).toBeNull();
  expect(feel).not.toHaveBeenCalled();
});

it('sounds a level-up', () => {
  useGameStore.setState({ playerProgress: newProgress(), demoMode: false, showMainMenu: false, showPlayerProgress: false, victory: null,
    showDisparityWinner: false, disparityWinner: null, chaosLevel: 0, xpRun: null, wormStoryResult: null });
  act(() => root.render(<LevelUpCue />));
  act(() => useGameStore.setState({ playerProgress: { ...newProgress(), xp: xpForLevel(2) } }));
  expect(host.querySelector('.xp-level-toast')).not.toBeNull();
  expect(feel).toHaveBeenCalledWith('storyStar', { combo: 2 });
});
