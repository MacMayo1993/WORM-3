import TunnelNeedsCard from '../worm/TunnelNeedsCard.jsx';
import { flipStickerPair } from '../game/manifoldLogic.js';
import { getManifoldMap } from '../game/manifoldMapStore.js';
import { getStableKey } from '../worm/wormLogic.js';
import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { useWormCrawler } from '../worm/useWormCrawler.js';
import SignatureButton from '../worm/SignatureButton.jsx';
import WormSwipeControls from '../worm/WormSwipeControls.jsx';
import { setWormTurnCallback } from '../worm/wormTurnBridge.js';
import { wormBuffs } from '../worm/wormBuffs.js';
import { makeCubies } from '../game/cubeState.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
vi.mock('@react-three/fiber', () => ({ useThree: () => ({ camera: {} }) }));
vi.mock('../utils/feel.js', async original => ({ ...(await original()), feel: vi.fn(), stopFeel: vi.fn(), resumeFeel: vi.fn(), setFeelEnabled: vi.fn() }));
let host, root, worm;
function Harness() {
  const cubies = useGameStore(s => s.cubies);
  const api = useWormCrawler(5, cubies);
  useEffect(() => { worm = api; setWormTurnCallback(api.queueTurn); return () => setWormTurnCallback(null); }, [api]);
  return <><SignatureButton /><TunnelNeedsCard /><WormSwipeControls onTurn={api.queueTurn} worm={api} /></>;
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); resetLiveRotation();
  useGameStore.setState({ cubies: makeCubies(5), size: 5, wormCharacter: 'glow', wormRunId: 100,
    wormHealerMode: true, wormAlive: true, wormPaused: false, wormGamePhase: 'active',
    wormOrbCount: 0, wormholeInterval: 9999, demoMode: false, wormSpeed: 1 });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<Harness />));
  act(() => { worm.tick(0.05); vi.advanceTimersByTime(100); });
});
afterEach(() => {
  act(() => root.unmount()); host.remove();
  vi.useRealTimers(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});
const frame = () => act(() => { worm.tick(0.05); vi.advanceTimersByTime(100); });
it('uses the real character store, button bridge, sim and cooldown mirror', () => {
  const button = host.querySelector('button');
  expect(button.getAttribute('aria-label')).toBe('Light Trail'); expect(button.disabled).toBe(false);
  act(() => {
    button.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  });
  frame();
  expect(worm.signature.current.seq).toBe(1);
  expect(worm.signature.current.active).toBeGreaterThan(2);
  expect(button.disabled).toBe(true); expect(button.textContent).toContain('ACTIVE');
  const seconds = wormBuffs.signature.seconds;
  act(() => useGameStore.setState({ wormPaused: true }));
  for (let i = 0; i < 30; i++) frame();
  expect(wormBuffs.signature.seconds).toBe(seconds);
  act(() => useGameStore.setState({ wormRunId: 101, wormPaused: false })); frame();
  expect(worm.signature.current.active).toBe(0); expect(button.disabled).toBe(false);
});
it('supports Q and keyboard button clicks while ignoring editable fields', () => {
  const input = document.createElement('input'); host.append(input);
  act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true })));
  frame(); expect(worm.signature.current.active).toBe(0);
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Q', bubbles: true })));
  frame(); expect(worm.signature.current.active).toBeGreaterThan(0);
  act(() => useGameStore.setState({ wormRunId: 102 })); frame();
  act(() => host.querySelector('button').click()); frame();
  expect(worm.signature.current.active).toBeGreaterThan(0);
});
it('clears the HUD bridge when gameplay unmounts', () => {
  act(() => host.querySelector('button').click()); frame();
  expect(wormBuffs.signature.active).toBe(true);
  act(() => root.render(null));
  expect(wormBuffs.signature).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});

it('Book pauses once, keeps moving and cannot reactivate through cooldown', () => {
  act(() => useGameStore.setState({ wormCharacter: 'book' })); frame();
  const mark = { ...worm.pos.current };
  act(() => host.querySelector('button').click()); frame();
  for (let i = 0; i < 24; i++) frame();
  const button = host.querySelector('button');
  expect(button.textContent).toContain('Pause'); expect(button.disabled).toBe(true);
  expect(worm.pos.current).not.toEqual(mark);
});
it('MOBI creates a real tunnel and preserves its inventory during the opening dive', () => {
  act(() => useGameStore.setState({ wormCharacter: 'mobi', wormOrbInventory: { 4: 12 } })); frame();
  worm.tailLength.current = 16;
  const before = { ...useGameStore.getState().wormOrbInventory };
  act(() => host.querySelector('button').click()); frame();
  expect(worm.phase.current).toBe('windup');
  expect(worm.signature.current.mobiTunnel?.stableKeys).toHaveLength(2);
  expect(useGameStore.getState().wormOrbInventory).toEqual(before);
  expect(worm.tailLength.current).toBe(16);
});
it('shows correct pickup requirements through the real tunnel lookup and store', () => {
  const state = useGameStore.getState();
  const cubies = flipStickerPair(state.cubies, 5, 2, 3, 4, 'PZ', getManifoldMap(state.cubies, 5, state.rotationEpoch));
  act(() => useGameStore.setState({ cubies })); frame();
  expect(host.textContent).toContain('COLLECT 2 MORE ORBS');
  expect(host.querySelector('.worm-tunnel-needs').dataset.healReady).toBe('false');
  const face = cubies[2][3][4].stickers.PZ.curr;
  act(() => { worm.tailLength.current = 7; useGameStore.setState({ wormOrbInventory: { [face]: 3 } }); }); frame();
  expect(host.textContent).toContain('COLLECT 1 MORE ORB');
  const key = getStableKey(2, 3, 4, 'PZ', cubies);
  act(() => useGameStore.setState({ wormHealingProgress: { [key]: { deposited: 1, faceId: face } } })); frame();
  expect(host.textContent).toContain('READY TO HEAL');
  expect(host.querySelector('.worm-tunnel-needs').dataset.healReady).toBe('true');
  expect(host.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('25');
  act(() => useGameStore.setState({ wormOrbInventory: { [face]: 0 } })); frame();
  expect(host.querySelector('.worm-tunnel-needs').dataset.healReady).toBe('false');
  act(() => useGameStore.setState({ wormGamePhase: 'solved' }));
  expect(host.querySelector('[aria-label="Tunnel healing requirements"]')).toBeNull();
});

it('Classic receives extra orbs from the actual run reset', () => {
  act(() => useGameStore.setState({ wormCharacter: 'classic', wormOrbCount: 5, wormRunId: 103 })); frame();
  expect(useGameStore.getState().wormPowerups).toHaveLength(8);
  act(() => useGameStore.setState({ wormCharacter: 'glow', wormRunId: 104 })); frame();
  expect(useGameStore.getState().wormPowerups).toHaveLength(5);
});
