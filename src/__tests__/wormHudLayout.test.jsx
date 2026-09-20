import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import WormCrawlerHUD from '../worm/WormCrawlerHUD.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { wormBuffs } from '../worm/wormBuffs.js';
import { rotationClock } from '../worm/healerWorm/rotationClockBridge.js';

let host, root;
const renderPhase = phase => act(() => {
  useGameStore.setState({ wormPhase: phase });
  root.render(<WormCrawlerHUD phase={phase} wormAlive />);
});
beforeEach(() => {
  vi.useFakeTimers();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  useGameStore.setState({ demoMode: false, wormHealerMode: true, wormAlive: true,
    wormStoryLevel: null, wormStoryResult: null, wormCombatMode: false, wormGamePhase: 'active', wormPaused: false, wormCharacter: 'inch',
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
  expect(host.querySelector('.worm-hud-context')).toBeNull();
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

it('places level seven objectives beneath the orb tracker and outside the control tray', () => {
  useGameStore.setState({ wormStoryLevel: 7, wormStoryReady: true, wormStoryStarted: true,
    wormStoryProgress: '1/6 goals · 0/2 boosts finished' });
  renderPhase('crawling');
  const top = host.querySelector('.worm-hud-top');
  const card = top.querySelector('[aria-label="Story objective"]');
  expect(card).not.toBeNull();
  expect(card.textContent).toContain('Full Throttle');
  expect(top.querySelector('.worm-hud-bar').compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(host.querySelector('.worm-hud-bottom [aria-label="Story objective"]')).toBeNull();
  expect(host.querySelector('.worm-primary-actions')).not.toBeNull();
});
