import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import WormCrawlerHUD from '../worm/WormCrawlerHUD.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { wormBuffs } from '../worm/wormBuffs.js';
import { rotationClock } from '../worm/healerWorm/rotationClockBridge.js';
import { feel } from '../utils/feel.js';
vi.mock('../utils/feel.js', async original => ({ ...await original(), feel: vi.fn(), resumeFeel: vi.fn() }));

let host, root;
const renderPhase = phase => act(() => {
  useGameStore.setState({ wormPhase: phase });
  root.render(<WormCrawlerHUD phase={phase} wormAlive />);
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  useGameStore.setState({ demoMode: false, wormHealerMode: true, wormAlive: true,
    wormStoryLevel: null, wormStoryStarted: false, wormStoryChecklist: null, wormStoryResult: null, wormCombatMode: false, wormGamePhase: 'active', wormPaused: false, wormCharacter: 'inch',
    wormElementalTheme: null, wormRocketActive: false, wormMagnetActive: false, wormSpecialNotice: null, wormJumpRescueActive: false,
    wormMission: { title: 'Collect 3 face orbs', target: 3, progress: 0, reward: 30, xp: 60, sequence: 5 },
    wormRunAchievements: [] });
  wormBuffs.signature = { character: 'inch', ready: true, seconds: 0, fraction: 1 };
  wormBuffs.tunnelNeeds = null;
  rotationClock.armed = true;
});
afterEach(() => {
  act(() => root.unmount()); host.remove();
  wormBuffs.tunnelNeeds = null; wormBuffs.signature = null; rotationClock.armed = false;
  vi.useRealTimers(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
it('clears unavailable surface controls for every transit phase and restores them on exit', () => {
  renderPhase('crawling');
  expect(host.querySelector('.worm-primary-actions')).not.toBeNull();
  expect(host.textContent).toContain('Collect 3 face orbs');
  for (const phase of ['windup', 'entering', 'tunnel', 'exiting', 'windout']) {
    renderPhase(phase);
    expect(host.querySelector('.worm-primary-actions')).toBeNull();
    expect(host.querySelector('.worm-signature-control')).toBeNull();
    expect(host.querySelector('.worm-mission-live')).toBeNull();
    expect(host.querySelector('[aria-label="Orb reserve by face"]')).toBeNull();
    expect(host.querySelector('.worm-rotation-clock')).toBeNull();
    expect(host.querySelector('[aria-label="Pause"]').disabled).toBe(false);
  }
  renderPhase('crawling');
  expect(host.querySelector('.worm-primary-actions')).not.toBeNull();
  expect(host.querySelector('.worm-signature-control')).not.toBeNull();
  expect(host.textContent).toContain('Collect 3 face orbs');
  expect(host.querySelector('[aria-label="Orb reserve by face"]')).not.toBeNull();
  expect(host.querySelector('.worm-rotation-clock')).not.toBeNull();
});
it('replaces secondary context with one healing readout and keeps pause usable during transit', () => {
  renderPhase('crawling');
  wormBuffs.tunnelNeeds = { ready: true, inTransit: true, color: '#8094ef', savedFraction: 1, payableFraction: 0 };
  renderPhase('tunnel'); act(() => vi.advanceTimersByTime(110));
  expect(host.querySelectorAll('.worm-tunnel-needs')).toHaveLength(1);
  expect(host.textContent).toContain('HEALING ON EXIT');
  expect(host.querySelector('.worm-hud-context .worm-buffs')).toBeNull();
  expect(host.querySelector('[aria-label="Healing energy deposited"]')).toBeNull();
  act(() => host.querySelector('[aria-label="Pause"]').click());
  expect(useGameStore.getState().wormPaused).toBe(true);
  act(() => [...host.querySelectorAll('button')].find(b => b.textContent === 'RESUME').click());
  expect(useGameStore.getState().wormPaused).toBe(false);
  wormBuffs.tunnelNeeds = null;
  renderPhase('crawling'); act(() => vi.advanceTimersByTime(110));
  expect(host.querySelector('.worm-tunnel-needs')).toBeNull();
  expect(host.querySelector('.worm-primary-actions')).not.toBeNull();
});

it('keeps live Story progress in a single compact button and pauses to inspect the checklist', () => {
  useGameStore.setState({ wormStoryLevel: 7, wormStoryReady: true, wormStoryStarted: true,
    wormStoryProgress: '1/6 goals · 0/2 boosts finished' });
  renderPhase('crawling');
  const top = host.querySelector('.worm-hud-top');
  const card = top.querySelector('.worm-story-glance');
  expect(card).not.toBeNull();
  expect(card.getAttribute('aria-label')).toContain('Full Throttle');
  expect(card.textContent).toContain('Tasks 0/6');
  expect(host.querySelector('.worm-story-checklist')).toBeNull();
  expect(top.querySelector('.worm-hud-bar').compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(host.querySelector('.worm-hud-bottom [aria-label="Story objective"]')).toBeNull();
  expect(host.querySelector('.worm-primary-actions')).not.toBeNull();
  act(() => card.click());
  expect(useGameStore.getState().wormPaused).toBe(true);
  expect(host.querySelector('.worm-pause-card .worm-story-checklist')).not.toBeNull();
  expect(top.hasAttribute('inert')).toBe(true);
  expect(document.activeElement.textContent).toBe('RESUME');
  act(() => document.activeElement.click());
  expect(useGameStore.getState().wormPaused).toBe(false);
  expect(host.querySelector('.worm-story-checklist')).toBeNull();
  expect(top.hasAttribute('inert')).toBe(false);
});

it('puts Start level at the bottom, then shows controls and automatic checked tasks', () => {
  const runId = useGameStore.getState().wormRunId;
  useGameStore.setState({ wormStoryLevel: 7, wormStoryReady: true, wormStoryStarted: false, wormStoryChecklist: null, wormPauseMenuOpen: false });
  renderPhase('crawling');
  expect(host.querySelectorAll('.worm-story-checklist li')).toHaveLength(6);
  expect(host.querySelector('.worm-hud-bottom .worm-story-checklist')).not.toBeNull();
  expect(host.querySelector('.worm-hud-top .worm-story-start')).toBeNull();
  expect(host.querySelector('.worm-primary-actions')).toBeNull();
  const start = host.querySelector('.worm-hud-bottom .worm-story-start');
  expect(start.textContent).toContain('Start level');
  act(() => start.click());
  expect(host.querySelector('.worm-story-start')).toBeNull();
  expect(host.querySelector('.worm-primary-actions')).not.toBeNull();
  act(() => useGameStore.setState({ wormStoryChecklist: { runId, levelId: 7, seconds: 260,
    goals: [{ key: 'boosts', label: 'Finish boosts', value: 2, target: 2, done: true }] } }));
  expect(host.querySelector('.worm-story-checklist')).toBeNull();
  expect(host.querySelector('.worm-story-glance').getAttribute('aria-label')).toContain('1 of 1 tasks complete');
  expect(feel.mock.calls.filter(([event]) => event === 'storyTask')).toHaveLength(1);
  act(() => host.querySelector('.worm-story-glance').click());
  expect(host.querySelector('.worm-pause-card .worm-story-checklist .is-complete').getAttribute('aria-label')).toContain('complete');
  // A retry must not show marks from the previous attempt.
  act(() => useGameStore.setState({ wormRunId: runId + 1 }));
  expect(host.querySelector('.worm-story-checklist .is-complete')).toBeNull();
});

it('shows element timers and momentum in the compact chip and instructions only in paused details', () => {
  useGameStore.setState({ wormStoryLevel: 8, wormStoryStarted: true, wormElementalTheme: 'water' });
  wormBuffs.elementalT = 10; wormBuffs.elementalMaxT = 12; wormBuffs.waterMomentum = 0.8;
  renderPhase('crawling'); act(() => vi.advanceTimersByTime(20));
  const chip = host.querySelector('[aria-label="WATER element active"]');
  expect(chip.closest('.worm-hud-status-row')).not.toBeNull();
  expect(chip.textContent).toContain('10s');
  expect(chip.querySelector('.worm-momentum-meter').style.transform).toBe('scaleX(0.8)');
  expect(host.textContent).not.toContain('Turns slow you');
  expect(host.querySelector('.worm-power-detail')).toBeNull();
  act(() => chip.click());
  expect(useGameStore.getState().wormPaused).toBe(true);
  expect(host.querySelector('.worm-pause-card').textContent).toContain('Momentum +20%');
  expect(host.querySelector('.worm-pause-card').textContent).toContain('turning sheds momentum');
  act(() => vi.advanceTimersByTime(2000));
  expect(chip.textContent).toContain('10s');
  act(() => host.querySelector('.worm-pause-resume').click());
  expect(host.querySelector('.worm-power-detail')).toBeNull();
  expect(useGameStore.getState().wormPaused).toBe(false);
});

it('confirms each completed task once without adding a banner or replaying it on pause or retry', () => {
  const runId = useGameStore.getState().wormRunId;
  const checklist = value => ({ runId, levelId: 8, seconds: 349,
    goals: [{ key: 'orbs', label: 'Collect orbs', value, target: 24, done: value >= 24 }] });
  useGameStore.setState({ wormStoryLevel: 8, wormStoryStarted: true, wormStoryChecklist: checklist(23) });
  renderPhase('crawling');
  act(() => useGameStore.setState({ wormStoryChecklist: checklist(24) }));
  expect(host.querySelector('.worm-task-confirmed').textContent).toContain('✓ Collect orbs');
  expect(feel).toHaveBeenCalledExactlyOnceWith('storyTask', { priority: 0 });
  act(() => useGameStore.setState({ wormStoryChecklist: { ...checklist(24), seconds: 348 } }));
  expect(feel).toHaveBeenCalledTimes(1);
  act(() => vi.advanceTimersByTime(1500));
  expect(host.querySelector('.worm-task-confirmed')).toBeNull();
  expect(host.querySelector('.worm-story-glance').textContent).toContain('Tasks 1/1');
  act(() => host.querySelector('.worm-story-glance').click());
  act(() => host.querySelector('.worm-pause-resume').click());
  expect(feel.mock.calls.filter(([event]) => event === 'storyTask')).toHaveLength(1);
  act(() => useGameStore.setState({ wormRunId: runId + 1 }));
  expect(host.querySelector('.worm-story-glance').textContent).toContain('Tasks 0/3');
  expect(feel.mock.calls.filter(([event]) => event === 'storyTask')).toHaveLength(1);
});

it('gives healing priority over power and spawn text while keeping emergency jump guidance', () => {
  useGameStore.setState({ wormElementalTheme: 'water', wormSpecialNotice: { seq: 1, type: 'magnet', kind: 'spawn' }, wormJumpRescueActive: true });
  wormBuffs.tunnelNeeds = { ready: false, pickupsNeeded: 2, color: '#8094ef', savedFraction: 0, payableFraction: 0 };
  renderPhase('crawling');
  expect(host.querySelector('.worm-tunnel-glance')).not.toBeNull();
  expect(host.querySelector('.worm-buffs')).toBeNull();
  expect(host.querySelector('.worm-special-notice')).toBeNull();
  expect(host.querySelector('.worm-jump-rescue-cue')).not.toBeNull();
  expect(host.querySelector('.worm-hud-status-row').textContent).toContain('Need 2 orbs');
});
