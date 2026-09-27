import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ScreenTransition from '../components/ScreenTransition.jsx';

let host, root;
const wait = ms => act(() => vi.advanceTimersByTime(ms));
const show = (visible, text = 'Screen') => act(() => root.render(
  <ScreenTransition show={visible} freezeOnExit><button>{text}</button></ScreenTransition>
));
beforeEach(() => {
  vi.useFakeTimers();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); host.remove();
  vi.useRealTimers(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it('re-enters an interrupted exit and replaces its frozen content', () => {
  show(true, 'First'); wait(50);
  expect(host.firstChild.style.opacity).toBe('1');
  show(false, 'Hidden'); wait(90);
  expect(host.textContent).toBe('First');
  expect(host.firstChild.style.opacity).toBe('0');
  show(true, 'Returned'); wait(250);
  expect(host.textContent).toBe('Returned');
  expect(host.firstChild.style.opacity).toBe('1');
  show(false); wait(180);
  expect(host.firstChild).toBeNull();
});

it('cancels pending entry frames when hidden before entry completes', () => {
  show(true); wait(16);
  show(false); wait(50);
  expect(host.firstChild.style.opacity).toBe('0');
  wait(180);
  expect(host.firstChild).toBeNull();
  show(true); wait(50);
  expect(host.firstChild.style.opacity).toBe('1');
});
