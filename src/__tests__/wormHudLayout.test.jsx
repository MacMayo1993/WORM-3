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
    wormElementalTheme: null, wormRocketActive: false, wormOrbShowerActive: false, wormMagnetActive: false, wormSpecialNotice: null, wormJumpRescueActive: false,
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
  expect(host.querySelector('.worm-tunnel-safety-copy strong').textContent).toBe('Safe traversal');
  expect(host.querySelector('.worm-tunnel-safety-copy small').textContent).toBe('Healing after tail clears');
  expect(host.querySelector('.worm-hud-context .worm-buffs')).toBeNull();
  expect(host.querySelector('[aria-label="Healing energy deposited"]')).toBeNull();
  act(() => host.querySelector('[aria-label="Pause"]').click());
  expect(useGameStore.getState().wormPaused).toBe(true);
  act(() => [...host.querySelectorAll('button')].find(b => b.classList.contains('worm-pause-resume')).click());
  expect(useGameStore.getState().wormPaused).toBe(false);
  wormBuffs.tunnelNeeds = null;
  renderPhase('crawling'); act(() => vi.advanceTimersByTime(110));
  expect(host.querySelector('.worm-tunnel-needs')).toBeNull();
  expect(host.querySelector('.worm-primary-actions')).not.toBeNull();
});

it('keeps the next task visible and puts every task and star rule behind the Goals tab', () => {
  localStorage.setItem('worm3_story_tracker_collapsed', '0');
  const runId = useGameStore.getState().wormRunId;
  useGameStore.setState({ wormStoryLevel: 7, wormStoryReady: true, wormStoryStarted: true, wormStoryChecklist: { runId, levelId: 7, seconds: 250,
    starGoals: { peakLength: 76, target: 64, grown: true, fast: true, clean: true, stars: 3 },
    hint: 'Rocket: steer the flight and land', goals: [
      { key: 'boosts', label: 'Finish boosts', value: 2, target: 2, done: true },
      { key: 'doubleJumps', label: 'Land double-jumps', value: 1, target: 2, done: false },
      { key: 'rockets', label: 'Land a rocket flight', value: 0, target: 1, done: false },
      { key: 'magnetOrbs', label: 'Catch orbs with a magnet', value: 0, target: 4, done: false },
      { key: 'healed', label: 'Heal tunnel pairs', value: 0, target: 2, done: false },
      { key: 'orbs', label: 'Collect orbs', value: 5, target: 24, done: false }] } });
  renderPhase('crawling');
  const top = host.querySelector('.worm-hud-top');
  const header = top.querySelector('.worm-story-glance');
  expect(header.getAttribute('aria-label')).toContain('Full Throttle');
  expect(top.querySelector('.worm-hud-bar').compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // Collapsed by default: the header alone carries the next task and the count, no list below.
  expect(header.getAttribute('aria-expanded')).toBe('false');
  expect(top.querySelector('.worm-story-next').textContent).toContain('Land double-jumps 1/2');
  expect(top.querySelector('.worm-story-glance-level').textContent).toBe('L7');
  expect(header.textContent).toContain('Goals 1/6');
  expect(top.querySelector('.worm-star-requirements')).toBeNull();
  expect(header.getAttribute('aria-label')).toContain('Next: Land double-jumps, 1 of 2');
  const rows = () => [...top.querySelectorAll('.worm-story-live li')].map(li => li.textContent);
  expect(rows()).toEqual([]);
  expect(top.querySelector('.worm-story-live-hint')).toBeNull();
  expect(host.querySelector('.worm-primary-actions')).not.toBeNull();
  // The tab reveals all tasks and star rules, without expanding the default HUD.
  act(() => header.click());
  expect(useGameStore.getState().wormPaused).toBe(false);
  expect(header.getAttribute('aria-expanded')).toBe('true');
  expect(header.textContent).toContain('Goals 1/6');
  expect(rows()).toEqual(['Finish boosts2/2', 'Land double-jumps1/2', 'Land a rocket flight0/1', 'Catch orbs with a magnet0/4', 'Heal tunnel pairs0/2', 'Collect orbs5/24']);
  expect(top.querySelectorAll('.worm-star-requirements li')).toHaveLength(3);
  expect(top.querySelector('.worm-star-requirements').textContent).toContain('76/64');
  expect(top.querySelector('.worm-story-details').id).toBe(header.getAttribute('aria-controls'));
  expect(top.querySelector('.worm-story-live-hint').textContent).toBe('Rocket: steer the flight and land');
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(document.activeElement).toBe(header);
  expect(rows()).toEqual([]);
  expect(top.querySelector('.worm-star-requirements')).toBeNull();
  act(() => header.click());
  act(() => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
  expect(rows()).toEqual([]);
  act(() => header.click());
  act(() => useGameStore.setState({ wormRunId: runId + 1 }));
  expect(header.getAttribute('aria-expanded')).toBe('false');
  act(() => useGameStore.setState({ wormRunId: runId }));
  // Pause still opens the complete checklist.
  act(() => host.querySelector('[aria-label="Pause"]').click());
  expect(useGameStore.getState().wormPaused).toBe(true);
  expect(host.querySelectorAll('.worm-pause-card .worm-story-checklist li')).toHaveLength(6);
  expect(top.hasAttribute('inert')).toBe(true);
  act(() => host.querySelector('.worm-pause-resume').click());
  expect(useGameStore.getState().wormPaused).toBe(false);
  expect(top.hasAttribute('inert')).toBe(false);
});

it('replaces the next task with the finishing instruction once every task is done', () => {
  localStorage.removeItem('worm3_story_tracker_collapsed');
  const runId = useGameStore.getState().wormRunId;
  useGameStore.setState({ wormStoryLevel: 2, wormStoryReady: true, wormStoryStarted: true, wormStoryChecklist: { runId, levelId: 2, seconds: 60, settling: true,
    goals: [{ key: 'uniqueTunnels', label: 'Cross tunnel pairs', value: 4, target: 4, done: true }] } });
  renderPhase('crawling');
  expect(host.querySelector('.worm-story-next').textContent).toContain('Land and clear your tail to finish');
  act(() => host.querySelector('.worm-story-glance').click());
  expect(host.querySelector('.worm-story-details .worm-story-live-hint').textContent).toBe('Land and clear your tail to finish');
  expect(host.querySelectorAll('.worm-story-live li')).toHaveLength(1);
});

it('puts Start level at the bottom, counts down, then shows automatic checked tasks', () => {
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
  expect(host.querySelector('.worm-countdown-digit').textContent).toBe('3');
  expect(useGameStore.getState().wormPaused).toBe(true);
  expect(host.querySelector('[aria-label="Pause"]').disabled).toBe(true);
  // Complete the phase driver's handoff in this DOM-only harness.
  act(() => useGameStore.setState({ wormGamePhase: 'active', wormCountdownStep: null, wormPaused: false }));
  expect(host.querySelector('.worm-countdown')).toBeNull();
  expect(host.querySelector('.worm-primary-actions')).not.toBeNull();
  act(() => useGameStore.setState({ wormStoryChecklist: { runId, levelId: 7, seconds: 260,
    goals: [{ key: 'boosts', label: 'Finish boosts', value: 2, target: 2, done: true }] } }));
  expect(host.querySelector('.worm-story-checklist')).toBeNull();
  expect(host.querySelector('.worm-story-glance').getAttribute('aria-label')).toContain('1 of 1 tasks complete');
  expect(feel.mock.calls.filter(([event]) => event === 'storyTask')).toHaveLength(1);
  act(() => host.querySelector('[aria-label="Pause"]').click());
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
  localStorage.removeItem('worm3_story_tracker_collapsed');
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
  expect(host.querySelector('.worm-story-next').textContent).toContain('Tasks 1/1');
  expect(host.querySelector('.worm-story-glance-level').textContent).toBe('L8');
  act(() => host.querySelector('[aria-label="Pause"]').click());
  act(() => host.querySelector('.worm-pause-resume').click());
  expect(feel.mock.calls.filter(([event]) => event === 'storyTask')).toHaveLength(1);
  act(() => useGameStore.setState({ wormRunId: runId + 1 }));
  expect(host.querySelector('.worm-story-glance').textContent).toContain('Goals 0/3');
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

it('resumes a user pause when starting capture and restores the HUD afterward', () => {
  useGameStore.setState({ captureMode: false });
  renderPhase('crawling');
  act(() => host.querySelector('[aria-label="Pause"]').click());
  expect(useGameStore.getState().wormPaused).toBe(true);
  act(() => useGameStore.getState().setCaptureMode(true));
  expect(useGameStore.getState().wormPaused).toBe(false);
  expect(useGameStore.getState().wormPauseMenuOpen).toBe(false);
  expect(host.querySelector('.worm-pause-card')).toBeNull();
  act(() => useGameStore.getState().setCaptureMode(false));
  expect(host.querySelector('[aria-label="Pause"]')).not.toBeNull();
});

it('shows the cube view and sim-driven countdown, then removes it on expiry', () => {
  useGameStore.setState({ wormViewPower: 'view-glass' });
  wormBuffs.viewPowerT = 20;
  renderPhase('crawling');
  expect(host.textContent).toContain('Glass Cube');
  expect(host.querySelector('[aria-label="Glass Cube active"]').textContent).toContain('20s');
  wormBuffs.viewPowerT = 7;
  act(() => vi.advanceTimersByTime(100));
  expect(host.querySelector('[aria-label="Glass Cube active"]').textContent).toContain('7s');
  act(() => useGameStore.setState({ wormViewPower: null }));
  expect(host.querySelector('[aria-label="Glass Cube active"]')).toBeNull();
});

it('shows Orb Shower with a live ten-second countdown and removes it when rain ends', () => {
  useGameStore.setState({ wormOrbShowerActive: true }); wormBuffs.orbShowerT = 10;
  renderPhase('crawling');
  const chip = () => host.querySelector('[aria-label="Orb Shower active"]');
  expect(chip().textContent).toContain('10.0s');
  wormBuffs.orbShowerT = 4.2; act(() => vi.advanceTimersByTime(100));
  expect(chip().textContent).toContain('4.2s');
  act(() => useGameStore.setState({ wormOrbShowerActive: false })); expect(chip()).toBeNull();
});

it('shares the rotation countdown row with effects outside the pause and inventory rail', () => {
  Object.assign(rotationClock, { armed: true, total: 10, secondsLeft: 7.4, warning: 0, held: false });
  renderPhase('crawling');
  act(() => vi.advanceTimersByTime(20));
  const clock = host.querySelector('.worm-rotation-clock');
  expect(clock.parentElement.classList.contains('worm-hud-telemetry')).toBe(true);
  expect(clock.closest('.worm-hud-bar')).toBeNull();
  expect(host.querySelector('[aria-label="Pause"]').closest('.worm-hud-bar')).not.toBeNull();
  expect(clock.textContent).toContain('Turn in');
  expect(clock.textContent).toContain('7.4s');
  rotationClock.secondsLeft = 2.1;
  act(() => vi.advanceTimersByTime(20));
  expect(clock.textContent).toContain('2.1s');
});

it('previews the ordered next pickup and keeps the full recipe guide inside Pause', () => {
  useGameStore.setState({ wormElementalTheme: 'water', wormElementalPartner: null,
    wormSpecials: [{ type: 'fire', id: 'partner' }] });
  wormBuffs.elementalT = 8; wormBuffs.elementalMaxT = 10;
  renderPhase('crawling');
  expect(host.querySelector('.worm-fusion-preview').textContent).toContain('Fire → Steam');
  expect(host.querySelector('.worm-fusion-guide')).toBeNull();
  act(() => host.querySelector('.worm-fusion-preview').click());
  expect(useGameStore.getState().wormPaused).toBe(true);
  const guide = host.querySelector('.worm-fusion-guide');
  expect(guide.open).toBe(false);
  expect(guide.querySelectorAll('li')).toHaveLength(20);
  expect(guide.textContent).toContain('Water → Fire: Steam');
  expect(guide.textContent).toContain('Fire → Water: Quench');
  expect(guide.textContent).toContain('Currently uses Slipstream');
  act(() => useGameStore.setState({ wormElementalTheme: 'water', wormElementalPartner: 'fire', wormSpecials: [] }));
  expect(host.querySelector('.worm-power-detail').textContent).toContain('Fire → Water: Quench');
  expect(host.querySelector('.worm-power-detail').textContent).toContain('without speeding bomb fuses');
  act(() => useGameStore.setState({ wormElementalTheme: null, wormElementalPartner: null, wormSpecials: [] }));
  wormBuffs.elementalT = 0;
});
