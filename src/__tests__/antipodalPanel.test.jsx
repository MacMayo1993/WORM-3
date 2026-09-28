import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AntipodalCameraPanel from '../components/overlays/AntipodalCameraPanel.jsx';
import { antipodalViewport } from '../3d/antipodalViewport.js';
import { useGameStore } from '../hooks/useGameStore.js';
let root, host, canvasHost;
const render = active => act(() => root.render(<AntipodalCameraPanel active={active} />));
const click = label => act(() => host.querySelector(`[aria-label="${label}"]`).click());
beforeEach(() => {
  vi.useFakeTimers(); globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useGameStore.setState({ captureMode: false });
  Object.assign(antipodalViewport, { rect: null, canvas: null, cube: null });
  canvasHost = document.createElement('div'); canvasHost.className = 'canvas-container'; canvasHost.append(document.createElement('canvas')); document.body.append(canvasHost);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    if (this.tagName === 'CANVAS') return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    if (this.classList.contains('antipodal-panel-view')) {
      const panel = this.closest('section'), width = parseFloat(panel.style.width) - 14;
      return new DOMRect(parseFloat(panel.style.left) + 7, parseFloat(panel.style.top) + 43, width, width * 0.75);
    }
    return new DOMRect();
  });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); canvasHost.remove(); vi.restoreAllMocks(); vi.useRealTimers(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
it('publishes the measured camera window, folds without a second render, and moves on request', () => {
  render(true); const first = { ...antipodalViewport.rect };
  expect(first.width).toBeGreaterThan(100);
  click('Collapse far-side camera'); expect(antipodalViewport.rect).toBeNull();
  act(() => vi.advanceTimersByTime(1000)); expect(antipodalViewport.rect).toBeNull();
  click('Expand far-side camera'); expect(antipodalViewport.rect.width).toBe(first.width);
  click('Move far-side camera'); expect(antipodalViewport.rect.y).not.toBe(first.y);
});
it('hides for Capture or tunnel/settings UI and restores the panel when enabled again', () => {
  render(true); expect(antipodalViewport.rect).not.toBeNull();
  act(() => useGameStore.setState({ captureMode: true })); expect(antipodalViewport.rect).toBeNull();
  expect(host.querySelector('section')).toBeNull();
  act(() => useGameStore.setState({ captureMode: false })); expect(antipodalViewport.rect).not.toBeNull();
  render(false); expect(antipodalViewport.rect).toBeNull();
  render(true); expect(antipodalViewport.rect).not.toBeNull();
});
