import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { it, expect } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import AntipodalCoreKey from '../components/overlays/AntipodalCoreKey.jsx';

it('explains the paired interior only when exposed, and follows the live custom palette', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  const host = document.createElement('div');
  const root = createRoot(host);
  useGameStore.setState({ showWelcome: false, showMainMenu: false, showSettings: false, showHelp: false,
    showAntipodalPiP: false, captureMode: false, wormHealerMode: false, showCutawayLens: false,
    visualMode: 'classic', hollowMode: false, explosionT: 0 });
  try {
    await act(async () => root.render(<AntipodalCoreKey />));
    expect(host.children.length).toBe(0);
    await act(async () => useGameStore.setState({ explosionT: 1 }));
    expect(host.textContent).toContain('Each inner tile shows the partner');
    expect(host.querySelectorAll('.antipodal-core-pairs > span')).toHaveLength(3);
    await act(async () => useGameStore.setState({ settings: {
      ...before.settings, colorScheme: 'custom', customColors: { 1: '#123456', 4: '#abcdef' }
    } }));
    const swatches = host.querySelectorAll('i');
    expect(swatches[0].style.background).toBe('rgb(18, 52, 86)');
    expect(swatches[1].style.background).toBe('rgb(171, 205, 239)');
    await act(async () => useGameStore.setState({ explosionT: 0, showCutawayLens: true }));
    expect(host.children.length).toBe(1);
    await act(async () => useGameStore.setState({ captureMode: true }));
    expect(host.children.length).toBe(0);
    await act(async () => useGameStore.setState({ captureMode: false, wormHealerMode: true, wormPhase: 'tunnel' }));
    expect(host.children.length).toBe(0);
  } finally {
    await act(async () => root.unmount()); useGameStore.setState(before, true);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
