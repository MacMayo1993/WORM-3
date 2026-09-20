import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { useWormCrawler } from '../worm/useWormCrawler.js';
import { makeCubies } from '../game/cubeState.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import { combatBridge } from '../worm/combat/portalCombat.js';
import { getNextSurfacePosition } from '../worm/wormLogic.js';
import { tileKey } from '../worm/healerWorm/wormSim.js';
import { ttReset, ttPush } from '../worm/circularBuffers.js';
import WormCrawlerHUD from '../worm/WormCrawlerHUD.jsx';
import WormSwipeControls from '../worm/WormSwipeControls.jsx';
import { setWormTurnCallback } from '../worm/wormTurnBridge.js';
import { wormBuffs } from '../worm/wormBuffs.js';
vi.mock('@react-three/fiber', () => ({ useThree: () => ({ camera: {} }) }));
vi.mock('../utils/feel.js', async original => ({ ...(await original()), feel: vi.fn(), stopFeel: vi.fn(), resumeFeel: vi.fn(), setFeelEnabled: vi.fn() }));

let root, host, worm;
const state = () => useGameStore.getState();
function Harness() {
  const cubies = useGameStore(s => s.cubies), phase = useGameStore(s => s.wormPhase), alive = useGameStore(s => s.wormAlive);
  const api = useWormCrawler(5, cubies);
  useEffect(() => { worm = api; setWormTurnCallback(api.queueTurn); return () => setWormTurnCallback(null); }, [api]);
  return <><WormCrawlerHUD phase={phase} wormAlive={alive} /><WormSwipeControls onTurn={api.queueTurn} worm={api} /></>;
}
const frame = (dt = 0.02) => act(() => worm.tick(dt));
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  resetLiveRotation();
  useGameStore.setState({ cubies: makeCubies(5), size: 5, demoMode: false, wormCharacter: 'classic' });
  state().initWormMode(undefined, undefined, 1, 2, 30);
  useGameStore.setState({ wormGamePhase: 'active', wormPaused: false });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<Harness />));
  frame();
  worm.moveDir.current = 'right';
  worm.tailLength.current = 100;
  const key = tileKey(getNextSurfacePosition(worm.pos.current, 'right', 5));
  ttReset(worm.tileTrail.current, key);
  ttPush(worm.tileTrail.current, '0,0,4,PZ');
  ttPush(worm.tileTrail.current, tileKey(worm.pos.current));
  for (let i = 0; i < 100 && !state().wormJumpRescueActive; i++) frame();
  expect(state().wormJumpRescueActive).toBe(true);
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); state().clearDisparityGame();
  vi.restoreAllMocks();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it.each(['touch', 'keyboard'])('highlights Jump and accepts %s input while holding combat and survival time', input => {
  const button = host.querySelector('[aria-label="Jump now to clear your body"]');
  expect(button.disabled).toBe(false);
  expect(button.classList.contains('worm-jump-rescue')).toBe(true);
  expect(host.querySelector('[role="alert"]').textContent).toContain('Body ahead');
  const snapshot = [worm.timeAliveRef.current, worm.interpT.current, combatBridge.current.time];
  frame(0.8);
  expect([worm.timeAliveRef.current, worm.interpT.current, combatBridge.current.time]).toEqual(snapshot);
  expect(wormBuffs.jumpRescueT).toBeCloseTo(0.2);
  act(() => {
    if (input === 'touch') button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    else window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  });
  frame();
  expect(state().wormJumpRescueActive).toBe(false);
  expect(worm.isJumping.current).toBe(true);
  expect(host.querySelector('.worm-jump-rescue')).toBeNull();
  for (let i = 0; i < 90; i++) frame();
  expect(state().wormAlive).toBe(true);
  expect(worm.isJumping.current).toBe(false);
});

it('holds the remaining countdown in Pause and removes the prompt on retry', () => {
  frame(0.1);
  act(() => host.querySelector('[aria-label="Pause"]').click());
  frame(1);
  expect(wormBuffs.jumpRescueT).toBeCloseTo(0.9);
  expect(host.querySelector('.worm-jump-rescue')).toBeNull();
  act(() => [...host.querySelectorAll('button')].find(b => b.textContent === 'RESUME').click());
  expect(host.querySelector('.worm-jump-rescue')).not.toBeNull();
  act(() => state().initWormMode());
  expect(state().wormJumpRescueActive).toBe(false);
  expect(wormBuffs.jumpRescueT).toBe(0);
  expect(host.querySelector('.worm-jump-rescue')).toBeNull();
});

it('does not spend the reaction window on a background tab catch-up frame', () => {
  let hidden = true;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  frame(5);
  expect(wormBuffs.jumpRescueT).toBe(1);
  hidden = false;
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  frame(5);
  expect(wormBuffs.jumpRescueT).toBe(1);
  frame(0.1);
  expect(wormBuffs.jumpRescueT).toBeCloseTo(0.9);
});
