import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import UILayer from '../components/UILayer.jsx';

const device = vi.hoisted(() => ({ mobile: true }));
vi.mock('../utils/device.js', async importOriginal => ({ ...await importOriginal(), get isMobile() { return device.mobile; } }));
// The menu's 3D font preload is unrelated to the DOM game/result transition.
vi.mock('../components/menus/MainMenu.jsx', () => ({ default: () => null }));
vi.mock('../components/menus/SettingsMenu.jsx', () => ({ default: () => null }));
vi.mock('../components/menus/HelpMenu.jsx', () => ({ default: () => null }));

it.each([true, false])('removes live controls for the Chaos reveal and recap, then restores them for replay (mobile=%s)', async mobile => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  device.mobile = mobile;
  const before = useGameStore.getState(), replay = vi.fn(), nextDemo = vi.fn();
  useGameStore.setState({ showMainMenu: false, showTutorial: false, showLevelSelect: false, showPackSelect: false,
    showSettings: false, showHelp: false, showFirstFlipTutorial: false, showCutscene: false, showLevelTutorial: false,
    showDisparityWinner: false, disparityWinner: null, wormHealerMode: false, demoMode: false, currentLevel: null,
    showNetPanel: false, showLeaderboard: false, showMobileTouchHint: true, faceRotationTarget: 'PZ',
    selectedTileForRotation: null, chaosLevel: 1 });
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  function Harness() {
    const [sheetOpen, setSheetOpen] = useState(true);
    return <UILayer metrics={{ parity: .5, disparity: .5 }} resolvedColors={{}} settings={before.settings}
      chaosMode chaosLevel={1} cascades={[]} autoRotateEnabled={false} moveHistory={['move']} canUndo undo={() => {}}
      teachMode={{ courseActive: false, active: false }} ui={{ sheetOpen, setSheetOpen, sheetMode: 'views' }}
      handlers={{ onChaosReplay: replay, onDemoDisparityDismiss: nextDemo }} />;
  }
  const gameControls = () => host.querySelector('.top-app-bar, .bottom-nav-bar, .mobile-touch-hint, [aria-label="Open menu"], [aria-label="Close menu"]');
  try {
    await act(async () => root.render(<Harness />));
    expect(host.querySelector('.top-app-bar')).not.toBeNull();
    expect(host.querySelector('[aria-label="Undo"]')).not.toBeNull();
    expect(host.querySelector('.sheet-open')).not.toBeNull();
    if (mobile) {
      const launcher = host.querySelector('[aria-label="Open menu"]');
      expect(launcher).not.toBeNull();
      act(() => launcher.click());
      expect(host.querySelector('[aria-label="Close menu"]')).not.toBeNull();
    }
    // The winner reveal precedes the results flag.
    await act(async () => useGameStore.setState({ disparityWinner: { pair: ['M1-001', 'M4-009'] } }));
    expect(gameControls()).toBeNull();
    expect(host.querySelector('[aria-label="Undo"]')).toBeNull();
    await act(async () => useGameStore.setState({ showDisparityWinner: true }));
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(host.querySelector('.chaos-results')).not.toBeNull();
    expect(gameControls()).toBeNull();
    expect(host.querySelector('.sheet-open')).toBeNull();
    // The demo's progression button must remain reachable too.
    await act(async () => useGameStore.setState({ demoMode: true }));
    const next = [...host.querySelectorAll('button')].find(b => b.textContent.includes('Next: Random'));
    expect(next).toBeDefined(); act(() => next.click()); expect(nextDemo).toHaveBeenCalledTimes(1);
    // Clear just the winner first: an open recap still owns the screen.
    await act(async () => useGameStore.setState({ disparityWinner: null }));
    expect(gameControls()).toBeNull();
    await act(async () => useGameStore.setState({ showDisparityWinner: false, demoMode: false }));
    expect(host.querySelector('.top-app-bar')).not.toBeNull();
    expect(host.querySelector('[aria-label="Undo"]')).not.toBeNull();
    expect(host.querySelector('.sheet-open')).toBeNull();
  } finally {
    await act(async () => root.unmount()); host.remove(); useGameStore.setState(before, true);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
