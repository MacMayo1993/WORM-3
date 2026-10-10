import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { StoryResult } from '../worm/story/StoryCards.jsx';
import WormCrawlerHUD from '../worm/WormCrawlerHUD.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { feel } from '../utils/feel.js';
import { prefersReducedMotion } from '../utils/device.js';
vi.mock('../utils/feel.js', () => ({ feel: vi.fn(), resumeFeel: vi.fn() }));
vi.mock('../utils/device.js', async original => ({ ...(await original()), prefersReducedMotion: vi.fn(() => false) }));
let root, host;
beforeEach(() => {
  vi.useFakeTimers(); vi.mocked(feel).mockClear(); vi.mocked(prefersReducedMotion).mockReturnValue(false);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useGameStore.setState({ wormGamePhase: 'solved', wormStoryLevel: 1, wormRunId: 91,
    wormStoryResult: { levelId: 1, stars: 3 }, wormPaused: true, demoMode: false, wormCombatMode: false });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); vi.useRealTimers(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
const advance = ms => act(() => vi.advanceTimersByTime(ms));
it.each([1,2,3])('awards only %i earned stars before enabling navigation, and accepts one transition', stars => {
  useGameStore.setState({ wormStoryResult: { levelId: 1, stars } });
  const next = vi.fn();
  act(() => root.render(<StoryResult onNext={next} />));
  const button = host.querySelector('.worm-story-primary');
  expect(button.disabled).toBe(true);
  expect(document.activeElement).toBe(host.querySelector('[role="dialog"]'));
  act(() => button.click()); expect(next).not.toHaveBeenCalled();
  advance(999);
  expect(feel).not.toHaveBeenCalledWith('storyStar', expect.anything());
  advance(1 + (stars - 1) * 300);
  expect(vi.mocked(feel).mock.calls.filter(([name]) => name === 'storyStar').map(([,o]) => o.combo)).toEqual(Array.from({length:stars},(_,i)=>i));
  expect(button.disabled).toBe(true);
  advance(450);
  expect(button.disabled).toBe(false);
  expect(document.activeElement).toBe(button);
  expect(host.querySelector('[role="status"]').textContent).toBe(`${stars} ${stars === 1 ? 'star' : 'stars'} earned`);
  act(() => { button.click(); button.click(); });
  expect(next).not.toHaveBeenCalled();
  advance(180); expect(next).toHaveBeenCalledOnce();
});
it('shows the final rating and actions immediately with reduced motion', () => {
  vi.mocked(prefersReducedMotion).mockReturnValue(true);
  const levels = vi.fn();
  useGameStore.setState({ wormStoryResult: { levelId: 120, stars: 2 } });
  act(() => root.render(<StoryResult onLevels={levels} />));
  expect(host.querySelector('h2').textContent).toBe('Story complete');
  const primary = host.querySelector('.worm-story-primary');
  expect(primary.disabled).toBe(false);
  act(() => primary.click()); expect(levels).toHaveBeenCalledOnce();
  expect(feel).not.toHaveBeenCalledWith('storyStar', expect.anything());
});
it('cancels delayed navigation on unmount', () => {
  const next = vi.fn();
  act(() => root.render(<StoryResult onNext={next} />));
  advance(2050);
  act(() => host.querySelector('.worm-story-primary').click());
  act(() => root.render(null));
  vi.mocked(feel).mockClear(); advance(5000);
  expect(next).not.toHaveBeenCalled(); expect(feel).not.toHaveBeenCalled();
});
it('cancels star cues when leaving during the reveal', () => {
  act(() => root.render(<StoryResult />));
  advance(500);
  act(() => root.render(null));
  vi.mocked(feel).mockClear(); advance(5000);
  expect(feel).not.toHaveBeenCalled();
});
it('removes the live controls during the celebration beat', () => {
  act(() => root.render(<WormCrawlerHUD phase="crawling" wormAlive />));
  expect(host.querySelector('[role="dialog"]')).not.toBeNull();
  expect(host.querySelector('.worm-hud-top')).toBeNull();
  expect(host.querySelector('.worm-hud-bottom')).toBeNull();
});
it('keeps focus within the result and out of collapsed field notes', () => {
  vi.mocked(prefersReducedMotion).mockReturnValue(true);
  act(() => root.render(<StoryResult />));
  const primary = host.querySelector('.worm-story-primary');
  const last = [...host.querySelectorAll('button')].at(-1);
  act(() => last.focus());
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key:'Tab', cancelable:true })));
  expect(document.activeElement).toBe(host.querySelector('summary'));
  act(() => primary.focus());
  expect(host.querySelector('details').open).toBe(false);
});
