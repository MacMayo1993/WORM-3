import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { makeWormSim, resetWormSim, killWormSim } from '../worm/healerWorm/wormSim.js';
import { makeCubies } from '../game/cubeState.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { rotationClock } from '../worm/healerWorm/rotationClockBridge.js';

let frameCb, worm, tree;
const scene = {};
vi.mock('@react-three/fiber', async importOriginal => ({
  ...await importOriginal(), useFrame: cb => { frameCb = cb; }, useThree: () => scene,
}));
vi.mock('../worm/useWormCrawler.js', () => ({ useWormCrawler: () => worm }));
vi.mock('../worm/healerWorm/elementalWarmup.js', () => ({ warmUpElementalSkins: vi.fn() }));
vi.mock('../worm/healerWorm/HealerBombs.jsx', () => ({ HealerBombs: () => null, FLAME_TEX: null }));
vi.mock('../utils/feel.js', async importOriginal => ({ ...await importOriginal(), feel: vi.fn(), setFeelEnabled: vi.fn() }));
vi.mock('../worm/wormHelpers.js', async importOriginal => ({ ...await importOriginal(), resolveSliceHits: vi.fn(() => null) }));
vi.mock('../worm/healerWorm/bombs.js', async importOriginal => ({
  ...await importOriginal(), checkBlastHitWorm: vi.fn(() => ({ type: 'death' })), isBombDisarmed: () => false,
}));

import { HealerWormMode3DWrapper } from '../worm/HealerWormMode.jsx';
import { HealerBombs } from '../worm/healerWorm/HealerBombs.jsx';
import { resolveSliceHits } from '../worm/wormHelpers.js';
import { checkBlastHitWorm } from '../worm/healerWorm/bombs.js';

// Run the real scheduler's hooks, retaining its child props without mounting
// WebGL renderers. Only the simulation port and visual effects are substituted.
function Harness(props) { tree = HealerWormMode3DWrapper(props); return null; }
let root, host, rotate, sim;
const tick = (count = 1, delta = 0.1) => act(() => { for (let i = 0; i < count; i++) frameCb({}, delta); });

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  sim = makeWormSim(3);
  resetWormSim(sim, 3, { orbCount: 0, wormholeInterval: 9999 });
  worm = Object.fromEntries(Object.keys(sim).map(key => [key, {
    get current() { return sim[key]; }, set current(value) { sim[key] = value; },
  }]));
  for (const [alias, key] of Object.entries({
    orbPickupColorsRef: 'orbPickupColors', orbPickupFaceIdsRef: 'orbPickupFaceIds',
    colorEpochRef: 'colorEpoch', timeAliveRef: 'timeAlive',
  })) worm[alias] = worm[key];
  worm.tick = vi.fn(); worm.queueTurn = vi.fn(); worm.feel = vi.fn();
  worm.killWorm = details => killWormSim(sim, {
    feel: worm.feel,
    onDeath: death => useGameStore.setState({ wormAlive: false, wormDeathDetails: death }),
  }, details);
  const cubies = makeCubies(3);
  useGameStore.setState({ cubies, size: 3, wormAlive: true, wormPaused: false, animState: null,
    demoMode: false, wormCombatMode: false, wormEnemiesEnabled: false, wormPhase: 'crawling' });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  rotate = vi.fn();
  act(() => root.render(<Harness cubies={cubies} size={3} onRotate={rotate} onAnimatedShuffle={(_moves, done) => done()} />));
  tick(1, 1); // spawn
  tick(1, 5); // countdown
  expect(useGameStore.getState().wormGamePhase).toBe('active');
});

afterEach(() => {
  act(() => root.unmount()); host.remove();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it('does not evaluate or dequeue a slice while another move awaits commit', () => {
  act(() => useGameStore.setState({ animState: { axis: 'row', sliceIndex: 1, dir: 1 } }));
  tick(150);
  expect(rotate).not.toHaveBeenCalled();
  expect(resolveSliceHits).not.toHaveBeenCalled();
  expect(rotationClock.held).toBe(true);
  act(() => useGameStore.setState({ animState: null }));
  tick(101);
  expect(rotate).toHaveBeenCalledTimes(1);
  expect(resolveSliceHits).toHaveBeenCalledTimes(1);
});

it('stops damage and slice dispatch after a fatal bomb on the rotation frame', () => {
  tick(100); // just before the ten-second hazard fires
  expect(rotate).not.toHaveBeenCalled();
  const bombProps = React.Children.toArray(tree.props.children).find(child => child.type === HealerBombs).props;
  const second = { id: 2, tile: { ...sim.pos }, fuse: 0.001, maxFuse: 5 };
  bombProps.bombsRef.current.push({ ...second, id: 1 }, second);
  tick();
  expect(useGameStore.getState().wormAlive).toBe(false);
  expect(useGameStore.getState().wormDeathDetails).toEqual({ reason: 'bomb', bombId: 1 });
  expect(checkBlastHitWorm).toHaveBeenCalledTimes(1);
  expect(bombProps.bombsRef.current).toEqual([second]);
  expect(second.fuse).toBe(0.001);
  expect(rotate).not.toHaveBeenCalled();
  expect(resolveSliceHits).not.toHaveBeenCalled();
  tick(20);
  expect(worm.feel.mock.calls.filter(([event]) => event === 'death')).toHaveLength(1);
});
