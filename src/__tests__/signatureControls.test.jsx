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
vi.mock('../utils/feel.js', () => ({ feel: vi.fn() }));
let host, root, worm;
function Harness() {
  const cubies = useGameStore(s => s.cubies);
  const api = useWormCrawler(5, cubies);
  useEffect(() => { worm = api; setWormTurnCallback(api.queueTurn); return () => setWormTurnCallback(null); }, [api]);
  return <><SignatureButton /><WormSwipeControls onTurn={api.queueTurn} worm={api} /></>;
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
  expect(button.getAttribute('aria-label')).toBe('Pulse Beacon'); expect(button.disabled).toBe(false);
  act(() => {
    button.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  });
  frame();
  expect(worm.signature.current.seq).toBe(1);
  expect(worm.signature.current.active).toBeGreaterThan(4);
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
