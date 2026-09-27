import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import InspectionLens from '../components/overlays/InspectionLens.jsx';
import { inspectionLens } from '../3d/inspectionBridge.js';
import WormCrawlerHUD from '../worm/WormCrawlerHUD.jsx';

vi.mock('../utils/feel.js', async original => ({ ...(await original()), feel: vi.fn(), resumeFeel: vi.fn() }));

it('supports keyboard, touch drag, cancellation and Escape without resuming a paused worm', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState(), initial = { ...inspectionLens };
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  useGameStore.setState({ showWelcome: false, showMainMenu: false, showSettings: false, showHelp: false,
    showCutawayLens: true, showAntipodalPiP: false, captureMode: false, wormHealerMode: true, wormPhase: 'crawling', wormPaused: true });
  try {
    await act(async () => root.render(<InspectionLens />));
    const handle = host.querySelector('[aria-label="Move cutaway lens"]');
    expect(document.activeElement).toBe(handle);
    const oldX = inspectionLens.x;
    const key = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    act(() => handle.dispatchEvent(key));
    expect(key.defaultPrevented).toBe(true); expect(inspectionLens.x).toBeGreaterThan(oldX);
    const pointer = (type, x, y) => {
      const event = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true });
      Object.defineProperty(event, 'pointerId', { value: 7 }); return event;
    };
    const beforeDrag = inspectionLens.x;
    act(() => handle.dispatchEvent(pointer('pointerdown', 400, 300)));
    act(() => handle.dispatchEvent(pointer('pointermove', 450, 320)));
    expect(inspectionLens.x).toBeGreaterThan(beforeDrag);
    act(() => handle.dispatchEvent(pointer('pointercancel', 450, 320)));
    const canceled = inspectionLens.x;
    act(() => handle.dispatchEvent(pointer('pointermove', 550, 320)));
    expect(inspectionLens.x).toBe(canceled);
    act(() => handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(useGameStore.getState().showCutawayLens).toBe(false);
    expect(useGameStore.getState().wormPaused).toBe(true);
    expect(host.querySelector('[aria-label="Move cutaway lens"]')).toBeNull();
  } finally {
    await act(async () => root.unmount()); host.remove(); Object.assign(inspectionLens, initial);
    useGameStore.setState(before, true); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});

it('keeps the far-side view and inspection lens mutually exclusive', () => {
  const before = useGameStore.getState();
  try {
    useGameStore.getState().setShowAntipodalPiP(true);
    useGameStore.getState().setShowCutawayLens(true);
    expect(useGameStore.getState().showAntipodalPiP).toBe(false);
    useGameStore.getState().toggleAntipodalPiP();
    expect(useGameStore.getState().showCutawayLens).toBe(false);
  } finally { useGameStore.setState(before, true); }
});

it('returns from inspection to Pause and keeps Pause usable during tunnel transit', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  useGameStore.setState({ showWelcome: false, showMainMenu: false, showSettings: false, showHelp: false,
    showCutawayLens: false, showAntipodalPiP: false, captureMode: false, wormHealerMode: true, wormPhase: 'crawling',
    wormPaused: false, wormAlive: true, wormGamePhase: 'active', demoMode: false, wormStoryLevel: null, wormCombatMode: false });
  try {
    await act(async () => root.render(<><WormCrawlerHUD phase="crawling" /><InspectionLens /></>));
    act(() => host.querySelector('[aria-label="Pause"]').click());
    const inspect = () => [...host.querySelectorAll('button')].find(b => b.textContent.includes('inside the cube'));
    act(() => inspect().click());
    expect(host.querySelector('[aria-label="Game paused"]')).toBeNull();
    expect(useGameStore.getState().wormPaused).toBe(true);
    act(() => host.querySelector('[aria-label="Close cutaway lens"]').click());
    expect(host.querySelector('[aria-label="Game paused"]')).not.toBeNull();
    expect(useGameStore.getState().wormPaused).toBe(true);
    act(() => useGameStore.setState({ wormPhase: 'tunnel', showCutawayLens: true }));
    expect(host.querySelector('[aria-label="Game paused"]')).not.toBeNull();
    expect([...host.querySelectorAll('button')].find(b => b.textContent.includes('available on the surface')).disabled).toBe(true);
    act(() => useGameStore.getState().initWormMode());
    expect(useGameStore.getState().showCutawayLens).toBe(false);
  } finally {
    await act(async () => root.unmount()); host.remove();
    useGameStore.setState(before, true); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
