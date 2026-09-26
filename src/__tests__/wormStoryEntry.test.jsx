import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import WormEntryScreen from '../components/screens/WormEntryScreen.jsx';
import DeathScreen from '../worm/DeathScreens.jsx';
import { StoryResult } from '../worm/story/StoryCards.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { newProgress } from '../progression/model.js';
import { STORY_WORLDS } from '../worm/story/worlds.js';
vi.mock('../components/screens/WormModeSetupWizard.jsx', () => ({ default: ({ onComplete, onCancel, initialSettings }) => <div aria-label="Free Play setup"><button onClick={onCancel}>Cancel setup</button><button onClick={() => onComplete(initialSettings)}>Launch free run</button></div> }));
let host, root, complete, cancel;
const state = () => useGameStore.getState();
const click = text => act(() => [...host.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent).includes(text)).click());
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useGameStore.setState({ playerProgress: newProgress(), ownedItems: [], parityPoints: 0 });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host); complete = vi.fn(); cancel = vi.fn();
});
afterEach(() => { act(() => root.unmount()); host.remove(); state().clearDisparityGame(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
const show = props => act(() => root.render(<WormEntryScreen onComplete={complete} onCancel={cancel} initialSettings={{ colorScheme: 'classic', manifoldStyles: {1:'grass'}, wormSpeed: 3 }} {...props} />));
it('launches the Chapter 1 siege and finale on 6x6', () => {
  useGameStore.setState({ playerProgress: { ...newProgress(), wormStory: {
    stars: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + 1, 1])), claimed: {}
  } } });
  show({ initialPage: 'story' });
  click('Under Siege'); click('Play again');
  expect(complete.mock.lastCall[0]).toMatchObject({ storyLevel: 9, cubeSize: 6, megaMode: false });
  expect(host.querySelector('[aria-label="Selected level"]').textContent).toContain('defeat one enemy');
  click('Worm Ascendant'); click('Play level');
  expect(complete.mock.lastCall[0]).toMatchObject({ storyLevel: 10, cubeSize: 6 });
});
it('opens with Story on the left and Free Play on the right, without launching either', async () => {
  show(); const cards = [...host.querySelector('.worm-path-split').children];
  expect(cards).toHaveLength(2);
  expect(cards.every(card => card.tagName === 'BUTTON')).toBe(true);
  expect(cards.map(card => card.querySelector('.worm-path-cta').firstChild.textContent.trim())).toEqual(['Levels', 'Free Play']);
  expect(complete).not.toHaveBeenCalled();
  click('Levels'); expect(host.querySelectorAll('.worm-level-grid button:disabled')).toHaveLength(9);
  expect(host.querySelector('[aria-label="Sunlit Garden tile preview"]')).not.toBeNull();
  click('Play level'); expect(complete).toHaveBeenCalledWith(expect.objectContaining({ storyLevel: 1, cubeSize: 6, megaMode: false, wormSpeed: 1.5, wormEnemiesEnabled: false,
    colorScheme: STORY_WORLDS[1].palette, backgroundTheme: STORY_WORLDS[1].background, perFaceStyles: STORY_WORLDS[1].styles }));
  click('Back'); await act(async () => { click('Free Play'); await import('../components/screens/WormModeSetupWizard.jsx'); });
  expect(host.querySelector('[aria-label="Free Play setup"]')).not.toBeNull();
  click('Launch free run'); expect(complete.mock.lastCall[0]).toEqual({ colorScheme: 'classic', manifoldStyles: {1:'grass'}, wormSpeed: 3 });
  click('Cancel setup'); expect(host.querySelector('.worm-path-split')).not.toBeNull();
});
it('traps keyboard focus and handles Back/Escape within the mode boundary', () => {
  show(); const buttons = host.querySelectorAll('button'); expect(document.activeElement).toBe(buttons[0]);
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true })));
  expect(document.activeElement).toBe(buttons[buttons.length-1]);
  click('Levels'); act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
  expect(host.querySelector('.worm-path-split')).not.toBeNull(); expect(cancel).not.toHaveBeenCalled();
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))); expect(cancel).toHaveBeenCalledOnce();
});
it('resumes at the next unlocked level and lets a completed level claim its reward from the map', () => {
  useGameStore.setState({ playerProgress: { ...newProgress(), wormStory: { stars: {1:3,2:2,3:1}, claimed: {} } } });
  show({ initialPage: 'story' }); expect(host.querySelector('.worm-level-grid [aria-pressed="true"]').getAttribute('aria-label')).toContain('Moving Ground');
  click('Clear Your Tail'); const choices = host.querySelector('.worm-story-rewards');
  act(() => choices.querySelector('button').click());
  expect(state().ownedItems).toHaveLength(1); expect(host.querySelector('[role="status"]').textContent).toContain('unlocked');
});
it('offers Next, Replay and chapter navigation from completion', () => {
  const next = vi.fn(), retry = vi.fn(), levels = vi.fn();
  useGameStore.setState({ wormStoryResult: { levelId: 1, stars: 3, seconds: 8, xp: 70, points: 45 } });
  act(() => root.render(<StoryResult onNext={next} onRetry={retry} onLevels={levels} />));
  expect(host.querySelector('[aria-label="3 out of 3 stars"]')).not.toBeNull();
  click('Next level'); click('Play again'); click('Levels');
  expect(next).toHaveBeenCalledOnce(); expect(retry).toHaveBeenCalledOnce(); expect(levels).toHaveBeenCalledOnce();
});

it('explains the hard deadline before play and distinguishes timeout from a collision', () => {
  show({ initialPage: 'story' }); expect(host.textContent).toContain('2:05 to finish');
  act(() => root.render(<DeathScreen deathDetails={{ reason: 'story-timeout' }} wormTimeAlive={90}
    wormBodyTiles={12} wormHealedCount={0} wormTunnelCount={0} formatTime={n => `${n}s`} />));
  expect(host.textContent).toContain('Time’s up'); expect(host.textContent).toContain('Try a shorter route');
  expect(host.textContent).not.toContain('Tail bite');
});

it('continues level six into seven and reserves chapter completion for ten', () => {
  const next = vi.fn(), levels = vi.fn();
  for (const id of [6, 10]) {
    act(() => useGameStore.setState({ wormStoryResult: { levelId: id, stars: 1, seconds: 200, xp: 50, points: 0 } }));
    act(() => root.render(<StoryResult onNext={next} onLevels={levels} />));
    expect(host.textContent).toContain(`Level ${id} / 10`);
    expect(host.textContent.includes('Chapter complete')).toBe(id === 10);
    click(id === 6 ? 'Next level' : 'Levels');
  }
  expect(next).toHaveBeenCalledOnce(); expect(levels).toHaveBeenCalledOnce();
});
