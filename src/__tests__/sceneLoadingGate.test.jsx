import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import SceneLoadingGate from '../components/screens/SceneLoadingGate.jsx';

const progress = vi.hoisted(() => ({ active: false, progress: 100 }));
vi.mock('@react-three/drei', () => ({ useProgress: () => progress }));
vi.mock('../components/screens/LoadingScreen.jsx', () => ({
  default: ({ leaving }) => <div data-loading data-leaving={String(leaving)} />,
}));

let root, host;
beforeEach(() => {
  vi.useFakeTimers();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  Object.assign(progress, { active: false, progress: 100 });
  host = document.createElement('div');
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
const show = props => act(() => root.render(<SceneLoadingGate armToken={1} eager {...props} />));
const tick = ms => act(() => vi.advanceTimersByTime(ms));
const cover = () => host.querySelector('[data-loading]');

it('covers an eager transition on its first render, before effects run', () => {
  expect(renderToString(<SceneLoadingGate armToken={1} eager ready={false} />)).toContain('data-loading');
});

it('waits beyond the timeout for the scene and portrait, then reveals once', () => {
  const reveal = vi.fn();
  show({ ready: false, onReveal: reveal });
  tick(20000);
  expect(cover().dataset.leaving).toBe('false');
  expect(reveal).not.toHaveBeenCalled();
  show({ ready: true, onReveal: reveal });
  tick(100);
  expect(reveal).toHaveBeenCalledTimes(1);
  expect(cover().dataset.leaving).toBe('true');
  tick(480);
  expect(cover()).toBeNull();
  tick(5000);
  expect(reveal).toHaveBeenCalledTimes(1);
});

it('keeps the cover through a late texture load and the minimum animation time', () => {
  const reveal = vi.fn();
  show({ ready: true, onReveal: reveal });
  tick(500);
  expect(reveal).not.toHaveBeenCalled();
  Object.assign(progress, { active: true, progress: 30 });
  tick(3000);
  expect(reveal).not.toHaveBeenCalled();
  Object.assign(progress, { active: false, progress: 100 });
  tick(100);
  expect(reveal).toHaveBeenCalledTimes(1);
});

it('cancels an outgoing fade when another level starts loading', () => {
  const first = vi.fn(), second = vi.fn();
  show({ minVisibleMs: 0, onReveal: first });
  tick(100);
  expect(first).toHaveBeenCalledTimes(1);
  show({ armToken: 2, ready: false, onReveal: second });
  tick(3000);
  expect(cover().dataset.leaving).toBe('false');
  expect(second).not.toHaveBeenCalled();
  show({ armToken: 2, ready: true, onReveal: second });
  tick(100);
  expect(second).toHaveBeenCalledTimes(1);
});

it('cancels pending reveal callbacks when the gate unmounts', () => {
  const reveal = vi.fn();
  show({ onReveal: reveal });
  act(() => root.render(null));
  tick(20000);
  expect(reveal).not.toHaveBeenCalled();
});

it('does not flash a cover for an ordinary cached transition', () => {
  show({ eager: false });
  tick(1000);
  expect(cover()).toBeNull();
});
