import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import SafeEnvironment from '../3d/SafeEnvironment.jsx';

// Keep the real THREE.FileLoader/RGBELoader path. Only the final environment
// renderer is replaced because this regression does not require a WebGL context.
vi.mock('@react-three/drei', () => ({ Environment: () => <span>Reflection loaded</span> }));

it('handles an actual HDR loader fetch rejection without throwing into React or window', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  vi.stubGlobal('fetch', fetch);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const pageError = vi.fn(), rejection = vi.fn();
  window.addEventListener('error', pageError);
  window.addEventListener('unhandledrejection', rejection);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<><button>Game remains playable</button><SafeEnvironment preset="city" /></>));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0].url).toMatch(/potsdamer_platz_1k\.hdr$/);
    expect(host.textContent).toBe('Game remains playable');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('environment map unavailable'), 'Failed to fetch');
    expect(error).not.toHaveBeenCalled();
    expect(pageError).not.toHaveBeenCalled();
    expect(rejection).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount()); host.remove();
    await new Promise(resolve => setTimeout(resolve, 5));
    window.removeEventListener('error', pageError);
    window.removeEventListener('unhandledrejection', rejection);
    vi.restoreAllMocks(); vi.unstubAllGlobals(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
