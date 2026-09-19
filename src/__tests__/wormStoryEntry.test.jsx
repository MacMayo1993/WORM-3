import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import WormEntryScreen from '../components/screens/WormEntryScreen.jsx';
import { StoryResult } from '../worm/story/StoryCards.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { newProgress } from '../progression/model.js';
vi.mock('../components/screens/WormModeSetupWizard.jsx', () => ({ default: ({ onComplete, onCancel, initialSettings }) => <div aria-label="Free Play setup"><button onClick={onCancel}>Cancel setup</button><button onClick={() => onComplete(initialSettings)}>Launch free run</button></div> }));
let host, root, complete, cancel;
const state = () => useGameStore.getState();
const click = text => act(() => [...host.querySelectorAll('button')].find(b => b.textContent.includes(text)).click());
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useGameStore.setState({ playerProgress: newProgress(), ownedItems: [], parityPoints: 0 });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host); complete = vi.fn(); cancel = vi.fn();
});
afterEach(() => { act(() => root.unmount()); host.remove(); state().clearDisparityGame(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
const show = props => act(() => root.render(<WormEntryScreen onComplete={complete} onCancel={cancel} initialSettings={{ colorScheme: 'classic', manifoldStyles: {1:'grass'}, wormSpeed: 3 }} {...props} />));
it('opens with Story on the left and Free Play on the right, without launching either', async () => {
  show(); const cards = [...host.querySelector('.worm-path-split').children];
  expect(cards.map(b => b.querySelector('h2').textContent)).toEqual(['STORY', 'FREE PLAY']);
  expect(complete).not.toHaveBeenCalled();
  click('STORY'); expect(host.querySelectorAll('.worm-level-grid button:disabled')).toHaveLength(5);
  click('Play level'); expect(complete).toHaveBeenCalledWith(expect.objectContaining({ storyLevel: 1, cubeSize: 5, megaMode: false, wormSpeed: 1.4, wormEnemiesEnabled: false, perFaceStyles: {1:'grass'} }));
  click('Back'); await act(async () => { click('FREE PLAY'); await import('../components/screens/WormModeSetupWizard.jsx'); });
  expect(host.querySelector('[aria-label="Free Play setup"]')).not.toBeNull();
  click('Launch free run'); expect(complete.mock.lastCall[0]).toEqual({ colorScheme: 'classic', manifoldStyles: {1:'grass'}, wormSpeed: 3 });
  click('Cancel setup'); expect(host.querySelector('.worm-path-split')).not.toBeNull();
});
it('traps keyboard focus and handles Back/Escape within the mode boundary', () => {
  show(); const buttons = host.querySelectorAll('button'); expect(document.activeElement).toBe(buttons[0]);
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true })));
  expect(document.activeElement).toBe(buttons[buttons.length-1]);
  click('STORY'); act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
  expect(host.querySelector('.worm-path-split')).not.toBeNull(); expect(cancel).not.toHaveBeenCalled();
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))); expect(cancel).toHaveBeenCalledOnce();
});
it('resumes at the next unlocked level and lets a completed level claim its reward from the map', () => {
  useGameStore.setState({ playerProgress: { ...newProgress(), wormStory: { stars: {1:3,2:2,3:1}, claimed: {} } } });
  show({ initialPage: 'story' }); expect(host.querySelector('[aria-pressed="true"]').textContent).toContain('Moving Ground');
  click('Clear Your Tail'); const choices = host.querySelector('.worm-story-rewards');
  act(() => choices.querySelector('button').click());
  expect(state().ownedItems).toHaveLength(1); expect(host.querySelector('[role="status"]').textContent).toContain('unlocked');
});
it('offers Next, Replay and chapter navigation from completion', () => {
  const next = vi.fn(), retry = vi.fn(), levels = vi.fn();
  useGameStore.setState({ wormStoryResult: { levelId: 1, stars: 3, seconds: 8, xp: 70, points: 45 } });
  act(() => root.render(<StoryResult onNext={next} onRetry={retry} onLevels={levels} />));
  expect(host.querySelector('[aria-label="3 out of 3 stars"]')).not.toBeNull();
  click('Next level'); click('Replay'); click('Chapter map');
  expect(next).toHaveBeenCalledOnce(); expect(retry).toHaveBeenCalledOnce(); expect(levels).toHaveBeenCalledOnce();
});
