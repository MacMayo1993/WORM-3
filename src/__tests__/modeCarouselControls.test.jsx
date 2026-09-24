import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
vi.mock('troika-three-text', () => ({ preloadFont: () => {} }));
vi.mock('@fontsource/bungee/files/bungee-latin-400-normal.woff', () => ({ default: '' }));
const recordModePlay = vi.hoisted(() => vi.fn());
vi.mock('../hooks/useGameStore.js', () => ({ useGameStore: selector => selector({ modePlays: {}, parityPoints: 0, ownedItems: [], recordModePlay }) }));
import { ModeCarousel } from '../components/menus/MainMenu.jsx';
import { consumeModeDive, getCarouselFace, isCarouselActive } from '../components/menus/menuCarouselState.js';

let host, root, launch;
const click = selector => act(() => host.querySelector(selector).click());
const advance = ms => act(() => vi.advanceTimersByTime(ms));
const enter = target => act(() => target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  localStorage.clear(); recordModePlay.mockClear(); consumeModeDive();
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  launch = vi.fn();
  act(() => root.render(<ModeCarousel onBack={() => {}} onWormSelect={() => launch('worm')} onFreeplay={() => launch('freeplay')} onStore={() => launch('store')} />));
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it.each(['HOW TO PLAY', 'GEAR & REWARDS'])('does not launch from the focused %s disclosure', label => {
  if (label === 'GEAR & REWARDS') { click('[aria-label="Show STORE mode"]'); advance(150); }
  const summary = host.querySelector('summary');
  expect(summary.textContent).toBe(label); summary.focus(); enter(summary); advance(1000);
  expect(recordModePlay).not.toHaveBeenCalled(); expect(launch).not.toHaveBeenCalled();
  expect(consumeModeDive()).toBeNull();
});

it('blocks Play and the global Enter shortcut until the newly selected mode is ready', () => {
  click('[aria-label="Next mode"]');
  expect(host.querySelector('.lc-play').disabled).toBe(true);
  click('.lc-play'); enter(document.body); advance(149);
  expect(recordModePlay).not.toHaveBeenCalled(); expect(consumeModeDive()).toBeNull();
  advance(1);
  expect(getCarouselFace()).toBe('NY');
  expect(host.querySelector('.lc-play').disabled).toBe(false);
  click('.lc-play');
  expect(recordModePlay).toHaveBeenCalledExactlyOnceWith('freeplay');
  const dive = consumeModeDive(); act(() => dive.onComplete()); advance(1000);
  expect(launch).toHaveBeenCalledExactlyOnceWith('freeplay');
});

it('rotates the shared cube face for direct selection and clears the carousel on exit', () => {
  expect(isCarouselActive()).toBe(true); expect(getCarouselFace()).toBe('NX');
  click('[aria-label="Show TEACH mode"]'); advance(150);
  expect(getCarouselFace()).toBe('PX'); expect(host.querySelector('[role="status"]').textContent).toBe('TEACH mode, 3 of 6');
  act(() => root.render(null));
  expect(isCarouselActive()).toBe(false); expect(getCarouselFace()).toBeNull();
});
