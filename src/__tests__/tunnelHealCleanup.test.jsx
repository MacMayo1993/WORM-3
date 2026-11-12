import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { useWormCrawler } from '../worm/useWormCrawler.js';
import { makeCubies } from '../game/cubeState.js';
import { flipStickerPair, buildManifoldGridMap } from '../game/manifoldLogic.js';
import { getActiveTunnels, getStableKey } from '../worm/wormLogic.js';
import { resetLiveRotation } from '../worm/liveRotation.js';

vi.mock('@react-three/fiber', () => ({ useThree: () => ({ camera: {} }) }));
vi.mock('../utils/feel.js', async original => ({ ...(await original()), feel: vi.fn(), stopFeel: vi.fn(), resumeFeel: vi.fn() }));

let root, before, worm;
const size = 5;
function Harness() {
  const cubies = useGameStore(s => s.cubies);
  const crawler = useWormCrawler(size, cubies);
  useEffect(() => { worm = crawler; });
  return null;
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  resetLiveRotation();
  before = useGameStore.getState();
  useGameStore.setState({ size, cubies: makeCubies(size), demoMode: false, wormStoryLevel: null, wormCombatMode: false });
  useGameStore.getState().initWormMode();
  root = createRoot(document.createElement('div'));
  act(() => root.render(<Harness />));
});
afterEach(() => {
  act(() => root.unmount());
  useGameStore.setState(before, true);
  vi.restoreAllMocks();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it.each([false, true])('clears both mouths\' saved deposits after a paid traversal (reversed: %s)', reversed => {
  let cubies = makeCubies(size);
  cubies = flipStickerPair(cubies, size, 1, 1, size - 1, 'PZ', buildManifoldGridMap(cubies, size));
  let tunnel = getActiveTunnels(cubies, size)[0];
  if (reversed) tunnel = { ...tunnel, entry: tunnel.exit, exit: tunnel.entry };
  const keyFor = t => getStableKey(t.x, t.y, t.z, t.dirKey, cubies);
  const entryKey = keyFor(tunnel.entry), exitKey = keyFor(tunnel.exit);
  const unrelated = { deposited: 2, faceId: 2 };
  act(() => useGameStore.setState({ cubies, wormPaused: false, wormGamePhase: 'active',
    wormHealingProgress: { [entryKey]: { deposited: 4, faceId: 4 }, [exitKey]: { deposited: 2, faceId: 1 }, other: unrelated } }));
  worm.tunnelPassages.current.push({ tunnel, tunnelKey: 'pair', exitDistance: -100, clearFrame: false,
    heal: { tunnel, tunnelKey: 'pair', stableKey: entryKey } });
  act(() => { worm.tick(0); worm.tick(0); });
  const state = useGameStore.getState();
  expect(state.wormHealedCount).toBe(1);
  expect(state.wormHealingProgress).toEqual({ other: unrelated });
  expect(worm.tunnelPassages.current).toEqual([]);
  for (const t of [tunnel.entry, tunnel.exit]) {
    const sticker = state.cubies[t.x][t.y][t.z].stickers[t.dirKey];
    expect(sticker.curr).toBe(sticker.orig);
  }
});
