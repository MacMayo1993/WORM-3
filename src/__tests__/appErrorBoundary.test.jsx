import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppErrorBoundary from '../components/AppErrorBoundary.jsx';
import { CHUNK_RELOAD_KEY, resetChunkRecovery } from '../utils/chunkRecovery.js';
import { clearRecordedErrors } from '../utils/diagnostics.js';

let host, root, errorLog;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});   // React logs every caught render error
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  errorLog.mockRestore();
  clearRecordedErrors();
  resetChunkRecovery();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

const Boom = ({ message }) => { throw new Error(message); };
const render = (element) => act(() => root.render(element));
const click = (label) => act(() => {
  [...host.querySelectorAll('button')].find(b => b.textContent.includes(label)).dispatchEvent(new MouseEvent('click', { bubbles: true }));
});

describe('AppErrorBoundary', () => {
  it('renders the app untouched when nothing is wrong', () => {
    render(<AppErrorBoundary><span>menu</span></AppErrorBoundary>);
    expect(host.textContent).toBe('menu');
  });

  it('turns an uncaught render error into a screen with a way back, not a blank page', () => {
    render(<AppErrorBoundary><Boom message="Cannot read properties of undefined (reading 'x')" /></AppErrorBoundary>);
    const alert = host.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain('Something went wrong');
    expect(alert.textContent).toContain('progress is stored on this device');
    expect(host.querySelectorAll('button')).toHaveLength(2);
    // The diagnostics are on screen for anyone who cannot use the clipboard button.
    expect(host.querySelector('pre').textContent).toContain("Cannot read properties of undefined (reading 'x')");
  });

  it('reloads on request after forgetting its stale-chunk attempts', () => {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '2');
    const reload = vi.fn();
    render(<AppErrorBoundary reload={reload}><Boom message="boom" /></AppErrorBoundary>);
    click('Reload');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBeNull();
  });

  it('copies the diagnostics, and says so', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<AppErrorBoundary><Boom message="needle-in-haystack" /></AppErrorBoundary>);
    await act(async () => { click('Copy details'); });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain('needle-in-haystack');
    expect(host.textContent).toContain('Copied');
  });

  it('opens the details to select from when the clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('denied')) }, configurable: true });
    render(<AppErrorBoundary><Boom message="boom" /></AppErrorBoundary>);
    await act(async () => { click('Copy details'); });
    expect(host.querySelector('details').open).toBe(true);
    expect(host.textContent).toContain('Copy failed');
  });

  describe('when a deploy deleted a chunk this page needs', () => {
    const stale = 'Failed to fetch dynamically imported module: https://x.test/assets/Tutorial-abc.js';

    it('says it is updating while the reload is under way', () => {
      const recover = vi.fn(() => true);
      render(<AppErrorBoundary recover={recover}><Boom message={stale} /></AppErrorBoundary>);
      expect(recover).toHaveBeenCalledTimes(1);
      expect(host.querySelector('[data-testid="app-updating"]')).not.toBeNull();
      expect(host.textContent).toContain('Updating');
      expect(host.querySelector('[role="alert"]')).toBeNull();
    });

    it('explains the stale files, and offers the reload, once the automatic attempts are spent', () => {
      render(<AppErrorBoundary recover={() => false}><Boom message={stale} /></AppErrorBoundary>);
      const alert = host.querySelector('[role="alert"]');
      expect(alert.textContent).toContain('out of date');
      expect(alert.textContent).toContain('updated while this page was open');
    });

    it('does not try to recover from an ordinary error', () => {
      const recover = vi.fn(() => true);
      render(<AppErrorBoundary recover={recover}><Boom message="mesh.dispose is not a function" /></AppErrorBoundary>);
      expect(recover).not.toHaveBeenCalled();
      expect(host.querySelector('[role="alert"]')).not.toBeNull();
    });
  });
});
