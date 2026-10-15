vi.mock('../utils/device.js', async original => ({ ...(await original()), prefersReducedMotion: () => true }));
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import WormEntryScreen from '../components/screens/WormEntryScreen.jsx';
import DeathScreen from '../worm/DeathScreens.jsx';
import { StoryObjectiveCard, StoryResult } from '../worm/story/StoryCards.jsx';
import { storyNarrative, storyBriefingText } from '../worm/story/narrative.js';
import { storyLevel } from '../worm/story/levels.js';
import { storyGrowthTarget } from '../worm/story/starGoals.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { newProgress } from '../progression/model.js';
import { STORY_WORLDS } from '../worm/story/worlds.js';
vi.mock('../components/screens/WormModeSetupWizard.jsx', () => ({ default: ({ onComplete, onCancel, initialSettings, sectionSelect }) => <div aria-label="Free Play setup">{sectionSelect}<button onClick={onCancel}>Cancel setup</button><button onClick={() => onComplete(initialSettings)}>Launch free run</button></div> }));
let host, root, complete, cancel;
const state = () => useGameStore.getState();
const switchSection = value => act(() => {
  const select = host.querySelector('select[aria-label="Worm mode section"]');
  select.value = value; select.dispatchEvent(new Event('change', { bubbles: true }));
});
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
  expect(host.querySelector('[aria-label="Selected level"]').textContent).toContain(`defeat ${storyLevel(9).mechanics.kills} enemies`);
  click('Worm Ascendant'); click('Play level');
  expect(complete.mock.lastCall[0]).toMatchObject({ storyLevel: 10, cubeSize: 6 });
});
it('opens directly to Story Mode and switches sections without launching a run', async () => {
  show();
  expect(host.querySelector('.worm-path-split')).toBeNull();
  expect(host.querySelector('select').value).toBe('story');
  expect([...host.querySelector('select').options].map(option => option.text)).toEqual(['Story Mode', 'Free Play', 'Worm Customization']);
  expect(complete).not.toHaveBeenCalled();
  expect(host.querySelectorAll('.worm-level-grid button:disabled')).toHaveLength(9);
  const rules = host.querySelector('[aria-label="Star requirements"]');
  expect(rules.querySelectorAll('li')).toHaveLength(3);
  const first = storyLevel(1);
  expect(rules.textContent).toContain(`${first.limit}s`);
  expect(rules.textContent).toContain(`${first.par}s OR`);
  expect(rules.textContent).toContain(`AND reach ${storyGrowthTarget(first)} body segments`);
  expect(host.querySelector('[aria-label="Sunlit Garden tile preview"]')).not.toBeNull();
  click('Play level'); expect(complete).toHaveBeenCalledWith(expect.objectContaining({ storyLevel: 1, cubeSize: 6, megaMode: false, wormSpeed: 1.5, wormEnemiesEnabled: false,
    colorScheme: STORY_WORLDS[1].palette, backgroundTheme: STORY_WORLDS[1].background, perFaceStyles: STORY_WORLDS[1].styles }));
  await act(async () => { switchSection('free'); await import('../components/screens/WormModeSetupWizard.jsx'); });
  expect(host.querySelector('[aria-label="Free Play setup"]')).not.toBeNull();
  click('Launch free run'); expect(complete.mock.lastCall[0]).toEqual({ colorScheme: 'classic', manifoldStyles: {1:'grass'}, wormSpeed: 3 });
  switchSection('customize');
  expect(host.querySelector('.worm-customization-body .worm-profile-options')).not.toBeNull();
  expect(host.querySelector('select').value).toBe('customize');
  switchSection('story');
  expect(host.querySelector('.worm-level-grid')).not.toBeNull();
  await act(async () => { switchSection('free'); });
  click('Cancel setup'); expect(host.querySelector('select').value).toBe('story');
});
it('traps keyboard focus and handles Back/Escape within the mode boundary', () => {
  show(); const buttons = host.querySelectorAll('button'); expect(document.activeElement).toBe(buttons[0]);
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true })));
  expect(document.activeElement).toBe(buttons[buttons.length-1]);
  switchSection('customize');
  const select = host.querySelector('select'); select.focus();
  act(() => select.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(select.value).toBe('customize'); expect(cancel).not.toHaveBeenCalled();
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
  expect(host.querySelector('select').value).toBe('story'); expect(cancel).not.toHaveBeenCalled();
  click('Back to modes'); expect(cancel).toHaveBeenCalledOnce();
});
it('keeps the selected level when switching away from and back to Story Mode', async () => {
  useGameStore.setState({ playerProgress: { ...newProgress(), wormStory: { stars: {1:3,2:2,3:1}, claimed: {} } } });
  show(); click('Clear Your Tail');
  const selectedLabel = () => host.querySelector('.worm-level-grid [aria-pressed="true"]').getAttribute('aria-label');
  const before = selectedLabel();
  switchSection('customize'); switchSection('story');
  expect(selectedLabel()).toBe(before);
  await act(async () => { switchSection('free'); await import('../components/screens/WormModeSetupWizard.jsx'); });
  switchSection('story'); expect(selectedLabel()).toBe(before);
  expect(complete).not.toHaveBeenCalled();
});
it('resumes at the next unlocked level and lets a completed level claim its reward from the map', () => {
  useGameStore.setState({ playerProgress: { ...newProgress(), wormStory: { stars: {1:3,2:2,3:1}, claimed: {} } } });
  show({ initialPage: 'story' }); expect(host.querySelector('.worm-level-grid [aria-pressed="true"]').getAttribute('aria-label')).toContain('Moving Ground');
  click('Clear Your Tail'); const choices = host.querySelector('.worm-story-rewards');
  act(() => choices.querySelector('button').click());
  expect(state().ownedItems).toHaveLength(1); expect(host.querySelector('[role="status"]').textContent).toContain('unlocked');
});
it.each(['Next level', 'Play again', 'Levels'])('offers %s from the concise completion card', label => {
  const next = vi.fn(), retry = vi.fn(), levels = vi.fn();
  useGameStore.setState({ wormStoryResult: { levelId: 1, stars: 3, seconds: 8, xp: 70, points: 45 } });
  act(() => root.render(<StoryResult onNext={next} onRetry={retry} onLevels={levels} />));
  expect(host.querySelector('[aria-label="3 out of 3 stars"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="Star requirements"]')).toBeNull();
  expect(host.querySelector('.screen-stat-row')).toBeNull();
  expect(host.querySelector('.story-completion-notes').open).toBe(false);
  click(label);
  expect(({ 'Next level': next, 'Play again': retry, Levels: levels })[label]).toHaveBeenCalledOnce();
});

it('presents the selected mission briefing alongside its real objectives, without revealing its ending', () => {
  useGameStore.setState({ playerProgress: { ...newProgress(), wormStory: {
    stars: Object.fromEntries(Array.from({ length: 19 }, (_, i) => [i + 1, 1])), claimed: {}
  } } });
  show({ initialPage: 'story' });
  expect(host.querySelector('[aria-label="Mobi’s briefing"]').textContent).toContain(storyBriefingText(20));
  expect(host.textContent).not.toContain(storyNarrative(20).debrief);
  expect(host.querySelector('[aria-label="Level goals"]').textContent).toContain('Collect orbs');
  click('Play level');
  expect(complete.mock.lastCall[0]).toMatchObject({ storyLevel: 20, cubeSize: 8 });
});

it('keeps narrative in the briefing and pause card, out of the live compact tracker', () => {
  useGameStore.setState({ wormStoryLevel: 1, wormStoryStarted: false, wormStoryResult: null,
    wormAlive: true, wormStoryChecklist: null, wormPaused: false });
  act(() => root.render(<StoryObjectiveCard />));
  expect(host.textContent).toContain(storyBriefingText(1));
  expect(host.querySelector('[aria-label="Level tasks"]')).not.toBeNull();
  act(() => useGameStore.setState({ wormStoryStarted: true }));
  act(() => root.render(<StoryObjectiveCard compact />));
  expect(host.querySelector('[aria-label="Mobi’s briefing"]')).toBeNull();
  expect(host.querySelector('[aria-label="Level tasks"]')).not.toBeNull();
});

it('reveals each chapter discovery on success, through to the ending', () => {
  for (const id of [10, 20, 21, 120]) {
    act(() => useGameStore.setState({ wormStoryResult: { levelId: id, stars: 1, seconds: 200, xp: 50, points: 0 } }));
    act(() => root.render(<StoryResult onNext={vi.fn()} onLevels={vi.fn()} onRetry={vi.fn()} />));
    const note = host.querySelector('[aria-label="Mobi’s field notes"]');
    expect(note.textContent).toContain(storyNarrative(id).debrief);
  }
});

it('explains the hard deadline before play and distinguishes timeout from a collision', () => {
  const limit = storyLevel(1).limit;
  show({ initialPage: 'story' }); expect(host.textContent).toContain(`${Math.floor(limit / 60)}:${String(limit % 60).padStart(2, '0')} to finish`);
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
