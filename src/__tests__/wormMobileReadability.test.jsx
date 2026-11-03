import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it } from 'vitest';
import { StoryObjectiveCard } from '../worm/story/StoryCards.jsx';
import TunnelNeedsCard from '../worm/TunnelNeedsCard.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { wormBuffs } from '../worm/wormBuffs.js';
import { readFileSync } from 'node:fs';
const hudCss = readFileSync('src/worm/wormHudLayout.css', 'utf8');

let host, root, styles;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  styles = document.createElement('style');
  styles.textContent = hudCss;
  document.head.append(styles);
  document.body.append(host);
  root = createRoot(host);
  useGameStore.setState({ wormStoryLevel: 7, wormStoryStarted: true, wormStoryResult: null,
    wormAlive: true, wormPaused: false, wormGamePhase: 'active',
    wormStoryChecklist: { runId: useGameStore.getState().wormRunId, levelId: 7, seconds: 30,
      goals: [{ key: 'magnetOrbs', label: 'Catch orbs with a magnet', value: 0, target: 4, done: false }] } });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove(); styles.remove(); wormBuffs.tunnelNeeds = null;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it('keeps the complete next action readable without opening Goals or hovering', () => {
  act(() => root.render(<StoryObjectiveCard compact />));
  const next = host.querySelector('.worm-story-next');
  expect(next.textContent).toBe('Catch orbs with a magnet 0/4');
  expect(getComputedStyle(next).whiteSpace).toBe('normal');
  expect(getComputedStyle(next).textOverflow).not.toBe('ellipsis');
  expect(getComputedStyle(next).fontSize).toBe('13px');
  const goals = host.querySelector('.worm-story-glance');
  expect(getComputedStyle(goals).minHeight).toBe('44px');
  expect(goals.getAttribute('aria-expanded')).toBe('false');
  act(() => goals.click());
  expect(host.querySelector('.worm-story-details').textContent).toContain('Catch orbs with a magnet');
});

it('keeps the Finish action at a touch-sized height', () => {
  const checklist = useGameStore.getState().wormStoryChecklist;
  useGameStore.setState({ wormStoryChecklist: { ...checklist, canFinish: true, starGoals: { stars: 3 } } });
  act(() => root.render(<StoryObjectiveCard compact />));
  expect(getComputedStyle(host.querySelector('.worm-story-finish')).minHeight).toBe('44px');
});

it('keeps tunnel safety and the escape action legible in the compact telemetry rail', () => {
  wormBuffs.tunnelNeeds = { ready: false, voided: true, collapsed: true, color: '#8094ef' };
  act(() => root.render(<div className="worm-hud-telemetry"><TunnelNeedsCard compact /></div>));
  const button = host.querySelector('.worm-tunnel-glance');
  expect(button).not.toBeNull();
  expect(getComputedStyle(button).minHeight).toBe('44px');
  expect(getComputedStyle(button.querySelector('strong')).fontSize).toBe('13px');
  expect(getComputedStyle(button.querySelector('small')).fontSize).toBe('12px');
  expect(button.getAttribute('data-tunnel-danger')).toBe('true');
  expect(getComputedStyle(button.querySelector('small')).color).toBe('rgb(255, 249, 233)');
  expect(getComputedStyle(button.querySelector('.worm-tunnel-safety-copy')).whiteSpace).toBe('normal');
});
