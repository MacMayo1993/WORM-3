import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import WelcomeScreen from '../components/screens/WelcomeScreen.jsx';
import { TITLE_END, DISSOLVE_START } from '../components/intro/introTiming.js';
import { GLIDE_END } from '../components/intro/introOutro.js';

let host, root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.removeItem('worm3_intro_seen');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); localStorage.removeItem('worm3_intro_seen');
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
it('offers Skip immediately and Play when the title arrives', () => {
  const enter = vi.fn();
  act(() => root.render(<WelcomeScreen onEnter={enter} introTime={0} />));
  expect(host.querySelector('[aria-label="Enter game"]')).toBeNull();
  act(() => host.querySelector('[aria-label="Skip intro and enter game"]').click());
  expect(enter).toHaveBeenCalledTimes(1);
  act(() => root.render(<WelcomeScreen onEnter={enter} introTime={TITLE_END} />));
  expect(host.querySelector('.opening-title [aria-label="WORM cubed"]')).not.toBeNull();
  act(() => host.querySelector('[aria-label="Enter game"]').click());
  expect(enter).toHaveBeenCalledTimes(2);
});
it('shows a static title and immediate Play for reduced motion', () => {
  act(() => root.render(<WelcomeScreen onEnter={vi.fn()} introTime={0} reducedMotion />));
  expect(host.querySelector('.opening-title')).not.toBeNull();
  expect(host.querySelector('.worm-wordmark--animated')).toBeNull();
  expect(host.querySelector('[aria-label="Enter game"]')).not.toBeNull();
  expect(host.querySelector('.opening-poem-line')).toBeNull();
});
it('lets returning players enter immediately by keyboard', () => {
  localStorage.setItem('worm3_intro_seen', '1');
  const enter = vi.fn();
  act(() => root.render(<WelcomeScreen onEnter={enter} introTime={0} />));
  expect(host.querySelector('[aria-label="Enter game"]')).not.toBeNull();
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', cancelable:true })));
  expect(enter).toHaveBeenCalledTimes(1);
});
it('dissolves everything but "flip through the cube" at the end, and hides the buttons once gone', () => {
  const enter = vi.fn();
  act(() => root.render(<WelcomeScreen onEnter={enter} introTime={DISSOLVE_START} />));
  const play = () => host.querySelector('[aria-label="Enter game"]');
  const skip = () => host.querySelector('[aria-label="Skip intro and enter game"]');
  expect(play().style.visibility).toBe('');
  act(() => root.render(<WelcomeScreen onEnter={enter} introTime={GLIDE_END} />));
  // Faded buttons are hidden, not merely transparent, so nothing invisible takes a tap.
  expect(play().style.visibility).toBe('hidden');
  expect(skip().style.visibility).toBe('hidden');
  expect(Number(host.querySelector('.opening-title').style.opacity)).toBe(0);
  const [lead, phrase] = host.querySelector('.opening-tagline').children;
  for (const word of lead.children) expect(Number(word.style.opacity)).toBe(0);
  expect(Number(phrase.style.opacity)).toBe(1);
  // FLIP and CUBE ride their stickers into the last beat.
  expect([...phrase.querySelectorAll('.opening-tile-face:not(.opening-tile-back)')].map(face => face.textContent)).toEqual(['flip', 'cube']);
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true })));
  expect(enter).toHaveBeenCalledTimes(1);
});
