import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import WelcomeScreen from '../components/screens/WelcomeScreen.jsx';
import { TITLE_END } from '../components/intro/introTiming.js';

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
