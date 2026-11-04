import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeWormSessionDefaults } from '../hooks/storeSlices/sessionDefaults.js';
import { makeCubies } from '../game/cubeState.js';
import { useWormCrawler } from '../worm/useWormCrawler.js';
import { stepWormSim } from '../worm/healerWorm/wormSim.js';

vi.mock('../worm/healerWorm/wormSim.js', async original => ({ ...(await original()), stepWormSim: vi.fn() }));
vi.mock('../utils/feel.js', async original => ({ ...(await original()), feel: vi.fn(), stopFeel: vi.fn(), resumeFeel: vi.fn() }));

let root, host, worm, ctx;
const state = () => useGameStore.getState();
const empty = () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
function Harness() {
  const cubies = useGameStore(s => s.cubies);
  const api = useWormCrawler(5, cubies);
  useEffect(() => { worm = api; }, [api]);
  return null;
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  useGameStore.setState({ ...makeWormSessionDefaults(), cubies: makeCubies(5), size: 5,
    demoMode: false, wormHealerMode: true, wormRunId: 100, wormEnemiesEnabled: false,
    wormGamePhase: 'active', wormOrbCount: 0, wormholeInterval: 30 });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<Harness />));
  act(() => worm.tick(0));
  ctx = stepWormSim.mock.lastCall[3];
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); vi.clearAllMocks();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it('counts each color once per pickup, irrespective of combo growth', () => {
  act(() => {
    ctx.onOrbPickup(1, 1, '#fff', 0, 3);
    ctx.onOrbPickup(1, 3, '#fff', 5, 9);
    ctx.onOrbPickup(4, 4, '#fff', 0, 3);
  });
  expect(state().wormOrbPickups).toEqual({ ...empty(), 1: 2, 4: 1 });
  expect(state().wormOrbInventory).toEqual({ ...empty(), 1: 12, 4: 3 });
  expect(state().wormSessionOrbs).toBe(3);
});

it('preserves pickup totals when spending, shedding or recovering body reserves', () => {
  act(() => ctx.onOrbPickup(2, 1, '#fff', 0, 3));
  act(() => ctx.applyDeposit({ orbsLeft: 0, nextInventory: empty(), nextDeposited: 3 }, 'pad', 2));
  expect(state().wormOrbPickups).toEqual({ ...empty(), 2: 1 });
  act(() => {
    ctx.onTailShed(empty(), 0);
    ctx.onOrbPickup(2, 1, '#fff', 0, 3, true);
  });
  expect(state().wormOrbPickups).toEqual({ ...empty(), 2: 1 });
  expect(state().wormSessionOrbs).toBe(1);
  expect(state().wormOrbInventory[2]).toBe(3);
});

it('resets pickup totals when a new run is initialized or the mode is cleared', () => {
  act(() => ctx.onOrbPickup(3, 1, '#fff', 0, 3));
  act(() => state().initWormMode());
  expect(state().wormOrbPickups).toEqual(empty());
  act(() => ctx.onOrbPickup(5, 1, '#fff', 0, 3));
  act(() => state().clearDisparityGame());
  expect(state().wormOrbPickups).toEqual(empty());
});

it('clears totals on a hook run restart', () => {
  act(() => ctx.onOrbPickup(6, 1, '#fff', 0, 3));
  act(() => useGameStore.setState({ wormRunId: state().wormRunId + 1 }));
  expect(state().wormOrbPickups).toEqual(empty());
});
