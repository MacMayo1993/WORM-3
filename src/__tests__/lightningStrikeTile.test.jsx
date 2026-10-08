import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { useWormCrawler } from '../worm/useWormCrawler.js';
import { makeCubies } from '../game/cubeState.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import { activeTunnelCap } from '../worm/healerWorm/constants.js';
vi.mock('../utils/feel.js', async original => ({ ...(await original()), feel: vi.fn(), stopFeel: vi.fn(), resumeFeel: vi.fn(), setFeelEnabled: vi.fn() }));

let root, host, worm;
const state = () => useGameStore.getState();
const SIZE = 5;
function Harness() {
  const cubies = useGameStore(s => s.cubies);
  const api = useWormCrawler(SIZE, cubies);
  useEffect(() => { worm = api; }, [api]);
  return null;
}
const sticker = ({ x, y, z, dirKey }) => state().cubies[x][y][z].stickers[dirKey];
const FAR = { x: 0, y: 2, z: 2, dirKey: 'NX' };

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; resetLiveRotation();
  useGameStore.setState({ cubies: makeCubies(SIZE), size: SIZE, demoMode: false, wormPauseMenuOpen: false, wormCharacter: 'classic' });
  state().initWormMode(undefined, undefined, 1.25, 2, 30, null, false);
  useGameStore.setState({ wormGamePhase: 'active' });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<Harness />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });

it('flips a bare tile into a wormhole and charges it', () => {
  expect(sticker(FAR).curr).toBe(sticker(FAR).orig);
  let hit;
  act(() => { hit = worm.strikeTile(FAR); });
  expect(hit).toBeTruthy();
  expect(sticker(FAR).curr).not.toBe(sticker(FAR).orig);
  expect(worm.chargedTunnels.current.has(hit.tunnelKey)).toBe(true);
  const mouths = worm.chargedMouths();
  expect(mouths).toHaveLength(1);
  expect(mouths[0].tunnelKey).toBe(hit.tunnelKey);
});

it('charges a hole already on the tile instead of flipping it back', () => {
  let first, second;
  act(() => { first = worm.strikeTile(FAR); });
  const flipped = sticker(FAR).curr;
  act(() => { second = worm.strikeTile(FAR); });
  expect(second.tunnelKey).toBe(first.tunnelKey);
  expect(sticker(FAR).curr).toBe(flipped);
  expect(worm.chargedTunnels.current.size).toBe(1);
});

it('opens nothing past the board’s tunnel cap', () => {
  const cap = activeTunnelCap(SIZE);
  const tiles = [];
  for (let y = 0; y < SIZE && tiles.length < cap + 1; y++) for (let z = 0; z < SIZE && tiles.length < cap + 1; z++) tiles.push({ x: 0, y, z, dirKey: 'NX' });
  let opened = 0, refused = 0;
  act(() => {
    for (const tile of tiles) {
      const before = sticker(tile).curr;
      const hit = worm.strikeTile(tile);
      if (hit) opened++; else if (sticker(tile).curr === before) refused++;
    }
  });
  expect(opened).toBeLessThanOrEqual(cap);
  expect(refused).toBeGreaterThan(0);
});

it('forgets charged tunnels when the run restarts', () => {
  act(() => { worm.strikeTile(FAR); });
  expect(worm.chargedTunnels.current.size).toBe(1);
  act(() => state().initWormMode());
  act(() => useGameStore.setState({ wormGamePhase: 'active' }));
  expect(worm.chargedTunnels.current.size).toBe(0);
});
