import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it } from 'vitest';
import WormCountdownOverlay from '../worm/WormCountdownOverlay.jsx';

let host, root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); host.remove();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it('announces the beats and keeps the same letters mounted for their exit', () => {
  for (const step of [3, 2, 1]) {
    act(() => root.render(<WormCountdownOverlay step={step} />));
    expect(host.querySelector('[role="status"]').textContent).toBe(`${step}`);
    expect(host.querySelectorAll('.worm-countdown-pips [data-lit="true"]')).toHaveLength(4 - step);
  }
  act(() => root.render(<WormCountdownOverlay step="go" />));
  const letters = [...host.querySelectorAll('.worm-countdown-letter')];
  const announcement = host.querySelector('[role="status"]');
  expect(letters.map(node => node.textContent).join('')).toBe('WORM');
  expect(announcement.textContent).toBe('WORM!');
  act(() => root.render(<WormCountdownOverlay step="hold" />));
  expect(host.querySelector('.worm-countdown').dataset.stage).toBe('exit');
  [...host.querySelectorAll('.worm-countdown-letter')].forEach((node, index) => expect(node).toBe(letters[index]));
  expect(host.querySelector('[role="status"]')).toBe(announcement);
  expect(announcement.textContent).toBe('WORM!');
});
