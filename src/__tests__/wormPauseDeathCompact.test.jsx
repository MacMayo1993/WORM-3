import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import WormCrawlerHUD from '../worm/WormCrawlerHUD.jsx';
import DeathScreen from '../worm/DeathScreens.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { wormBuffs } from '../worm/wormBuffs.js';

vi.mock('../utils/feel.js', async (original) => ({ ...(await original()), feel: vi.fn(), resumeFeel: vi.fn() }));

let host, root;
const buttons = () => [...host.querySelectorAll('button')];
const key = (label) => [...host.querySelectorAll('.worm-pause-key')].find((b) => b.textContent === label);
const escape = () =>
  act(() => host.querySelector('[aria-label="Game paused"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  useGameStore.setState({
    captureMode: false,
    demoMode: false,
    wormHealerMode: true,
    wormAlive: true,
    wormPhase: 'crawling',
    wormStoryLevel: null,
    wormStoryStarted: false,
    wormCombatMode: false,
    wormGamePhase: 'active',
    wormPaused: false,
    showCutawayLens: false,
    wormSessionOrbs: 7,
    wormTimeAlive: 35,
    wormHealedCount: 2,
    wormTunnelCount: 1
  });
  wormBuffs.signature = { character: 'inch', ready: true, seconds: 0, fraction: 1 };
  wormBuffs.tunnelNeeds = null;
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  wormBuffs.signature = null;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it('leads the death card with the orbs collected, not the worm length', () => {
  act(() =>
    root.render(
      <DeathScreen
        deathDetails={{ reason: 'slice-rotation' }}
        wormTimeAlive={35}
        wormHealedCount={0}
        wormTunnelCount={0}
        wormSessionOrbs={7}
        formatTime={(n) => `0:${n}`}
      />
    )
  );
  const hero = host.querySelector('.worm-death-stat.is-hero');
  expect(hero.textContent).toContain('Orbs');
  expect(hero.textContent).toContain('7');
  expect(host.textContent).not.toMatch(/length/i);
  expect(host.querySelector('.worm-death-beads')).toBeNull();
  // One strip of four numbers, the badge beside the title, and the two keys.
  expect(host.querySelectorAll('.worm-death-stat')).toHaveLength(4);
  expect(host.querySelector('.worm-death-head .worm-death-badge')).not.toBeNull();
  expect(host.querySelector('.worm-death-head .worm-death-title').textContent).toContain('Sliced');
  expect(buttons().map((b) => b.textContent)).toEqual(expect.arrayContaining(['Try again', 'New game']));
});

it('keeps the pause card to Resume, four keys, one row of numbers and the objective', () => {
  act(() => root.render(<WormCrawlerHUD phase="crawling" wormAlive onRetry={() => {}} onHome={() => {}} onSettings={() => {}} />));
  act(() => host.querySelector('[aria-label="Pause"]').click());
  const card = host.querySelector('.worm-pause-card');
  expect(card.querySelector('.worm-pause-resume')).not.toBeNull();
  expect([...card.querySelectorAll('.worm-pause-key')].map((b) => b.textContent)).toEqual(['Restart', 'Home', 'Settings', 'Cube']);
  expect(card.textContent).toContain('Orbs');
  // The run's settings are a page away, not on the main card.
  expect(card.querySelector('.worm-quest-setting')).toBeNull();
  expect(card.textContent).not.toContain('Relative turns');
});

it('opens Settings as a page of the card, and Escape steps back before it resumes', () => {
  const onSettings = vi.fn();
  act(() => root.render(<WormCrawlerHUD phase="crawling" wormAlive onSettings={onSettings} />));
  act(() => host.querySelector('[aria-label="Pause"]').click());
  act(() => key('Settings').click());
  const card = host.querySelector('.worm-pause-card');
  expect(card.classList.contains('is-settings')).toBe(true);
  expect(card.querySelector('.worm-quest-setting')).not.toBeNull();
  expect(card.textContent).toMatch(/Relative turns|Fixed turns/);
  expect(card.textContent).toContain('Inspect inside the cube');
  // The rest of the Settings sheet is still one key away.
  act(() =>
    buttons()
      .find((b) => b.textContent.includes('All settings'))
      .click()
  );
  expect(onSettings).toHaveBeenCalledTimes(1);
  escape();
  expect(host.querySelector('.worm-pause-card').classList.contains('is-main')).toBe(true);
  expect(useGameStore.getState().wormPaused).toBe(true);
  escape();
  expect(host.querySelector('.worm-pause-card')).toBeNull();
});

it('opens Cube as a page with the colours, tiles and scene, and Back returns to the main page', async () => {
  act(() => root.render(<WormCrawlerHUD phase="crawling" wormAlive />));
  act(() => host.querySelector('[aria-label="Pause"]').click());
  await act(async () => {
    key('Cube').click();
    await import('../components/menus/settings/CubeLookSettings.jsx');
  });
  await act(async () => {});
  const card = host.querySelector('.worm-pause-card');
  expect(card.classList.contains('is-cube')).toBe(true);
  expect([...card.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual(['Colors', 'Tiles', 'Scene']);
  expect(card.textContent).toContain('Color scheme');
  act(() => host.querySelector('[aria-label="Back to pause menu"]').click());
  expect(host.querySelector('.worm-pause-card').classList.contains('is-main')).toBe(true);
});
