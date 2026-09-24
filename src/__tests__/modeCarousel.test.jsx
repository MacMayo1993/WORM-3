import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
vi.mock('troika-three-text', () => ({ preloadFont: () => {} }));
vi.mock('@fontsource/bungee/files/bungee-latin-400-normal.woff', () => ({ default: '' }));
import { ModeCarousel } from '../components/menus/MainMenu.jsx';
import { isCarouselActive, consumeModeDive } from '../components/menus/menuCarouselState.js';
import { COURSE_STORAGE_KEY } from '../teach/course.js';
import { useGameStore } from '../hooks/useGameStore.js';

let host, root, callbacks;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.removeItem('worm3_last_mode_id'); localStorage.removeItem(COURSE_STORAGE_KEY);
  useGameStore.setState({ modePlays: {} });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  callbacks = Object.fromEntries(['onBack','onCubeSelect','onWormSelect','onChaos','onFreeplay','onRandom','onStore','onSettings'].map(key => [key, vi.fn()]));
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });
const mount = () => act(() => root.render(<ModeCarousel {...callbacks} />));
const click = label => act(() => [...host.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent).trim() === label).click());
const settle = () => act(() => vi.advanceTimersByTime(151));

it('keeps wraparound, direct selection, and the saved mode without repeating the heading', () => {
  mount(); expect(isCarouselActive()).toBe(true);
  click('Previous mode'); settle(); expect(host.querySelector('h2').textContent).toBe('STORE');
  click('Next mode'); settle(); expect(host.querySelector('h2').textContent).toBe('WORM');
  click('Select CHAOS mode'); settle();
  expect(localStorage.getItem('worm3_last_mode_id')).toBe('chaos');
  expect(host.querySelector('[aria-current]').getAttribute('aria-label')).toBe('Select CHAOS mode');
  expect(host.querySelectorAll('h2')).toHaveLength(1);
  act(() => root.unmount()); root = createRoot(host); mount();
  expect(host.querySelector('h2').textContent).toBe('CHAOS');
});

it('launches only once if both the cube transition and fallback finish', () => {
  mount(); click('Play WORM'); click('Play WORM');
  expect(callbacks.onWormSelect).not.toHaveBeenCalled();
  const dive = consumeModeDive(); act(() => dive.onComplete());
  act(() => vi.advanceTimersByTime(900));
  expect(callbacks.onWormSelect).toHaveBeenCalledOnce();
  expect(useGameStore.getState().modePlays.worm.plays).toBe(1);
});

it('distinguishes continuing a Teach lesson from opening the map', () => {
  localStorage.setItem('worm3_last_mode_id', 'cube');
  localStorage.setItem(COURSE_STORAGE_KEY, '["turn"]'); mount();
  click('All lessons'); expect(callbacks.onCubeSelect).toHaveBeenCalledWith({ resume: false });
  click('Continue lesson'); act(() => vi.advanceTimersByTime(900));
  expect(callbacks.onCubeSelect).toHaveBeenLastCalledWith({ resume: true });
});

it('accepts horizontal swipes, ignores vertical scrolling, and supports arrows', () => {
  mount(); const deck = host.querySelector('.mc-deck');
  const swipe = (x, y) => act(() => {
    deck.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 200, clientY: 200 }));
    deck.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: x, clientY: y }));
  });
  swipe(140, 350); settle(); expect(host.querySelector('h2').textContent).toBe('WORM');
  swipe(100, 210); settle(); expect(host.querySelector('h2').textContent).toBe('CUBE');
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))); settle();
  expect(host.querySelector('h2').textContent).toBe('TEACH');
});

it('opens real customization and settings and clears a pending launch on close', () => {
  mount(); click('Customize'); expect(callbacks.onWormSelect).toHaveBeenCalledWith({ page: 'customize' });
  click('Settings'); expect(callbacks.onSettings).toHaveBeenCalledOnce();
  callbacks.onWormSelect.mockClear(); click('Play WORM');
  act(() => root.unmount()); root = createRoot(host);
  act(() => vi.advanceTimersByTime(1000));
  expect(callbacks.onWormSelect).not.toHaveBeenCalled(); expect(isCarouselActive()).toBe(false);
  expect(consumeModeDive()).toBeNull();
});
