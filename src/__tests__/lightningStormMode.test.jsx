import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { makeWormSim, resetWormSim, killWormSim } from '../worm/healerWorm/wormSim.js';
import { makeCubies } from '../game/cubeState.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { resetLiveRotation } from '../worm/liveRotation.js';
import { wormBuffs } from '../worm/wormBuffs.js';
import { ttReset, ttPush } from '../worm/circularBuffers.js';
import { makeCombat, makeEnemy, combatBridge } from '../worm/combat/portalCombat.js';
import { LightningStrikes } from '../worm/healerWorm/LightningStrikes.jsx';
import { STORM } from '../worm/healerWorm/lightningStorm.js';

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

import { HealerWormMode3DWrapper } from '../worm/HealerWormMode.jsx';

function Harness(props) { tree = HealerWormMode3DWrapper(props); return null; }
function findElement(node, type) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const child of node) { const hit = findElement(child, type); if (hit) return hit; } return null; }
  if (node.type === type) return node;
  return findElement(node.props?.children, type);
}
let root, host, sim, storm;
const tick = (count = 1, delta = 0.1) => act(() => { for (let i = 0; i < count; i++) frameCb({}, delta); });
const head = () => ({ ...sim.pos });
// A mark that is one tick from striking `tile`.
const mark = (tile, id = 1) => storm.spots.push({ id, tile: { ...tile }, age: STORM.telegraph - 0.05, delay: STORM.telegraph });
const FAR = { x: 0, y: 0, z: 0, dirKey: 'NZ' };

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
  worm.tick = vi.fn(); worm.queueTurn = vi.fn(); worm.feel = vi.fn(); worm.strikeTile = vi.fn(() => ({ tunnelKey: 'k' }));
  worm.killWorm = details => killWormSim(sim, {
    feel: worm.feel,
    onDeath: death => useGameStore.setState({ wormAlive: false, wormDeathDetails: death }),
  }, details);
  const cubies = makeCubies(3);
  useGameStore.setState({ cubies, size: 3, wormAlive: true, wormPaused: false, wormJumpRescueActive: false, animState: null,
    demoMode: false, wormStoryLevel: null, wormStoryResult: null, wormCombatMode: false, wormEnemiesEnabled: false, wormPhase: 'crawling' });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  act(() => root.render(<Harness cubies={cubies} size={3} onRotate={vi.fn()} onAnimatedShuffle={(_moves, done) => done()} />));
  tick(1, 1); tick(1, 5);
  expect(useGameStore.getState().wormGamePhase).toBe('active');
  tick(1, 0.01);                      // the first active frame binds the storm to this run
  storm = findElement(tree, LightningStrikes).props.stormRef.current;
  wormBuffs.elementalT = 0;
});

afterEach(() => {
  wormBuffs.elementalT = 0;
  combatBridge.current = null;
  resetLiveRotation();
  act(() => root.unmount()); host.remove();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

const wash = () => { sim.elementalType = 'lightning'; wormBuffs.elementalT = 10; };

describe('the lightning storm in the mode', () => {
  it('marks tiles while the wash is up, never on or near the head, and strikes them after the telegraph', () => {
    wash();
    sim.rand = (() => { let a = 7; return () => (a = (a * 16807) % 2147483647) / 2147483647; })();
    tick(1, 0.1);                       // the claim starts the marks
    tick(12, 0.1);                      // past the first delay
    expect(storm.spots.length).toBeGreaterThan(0);
    const [spot] = storm.spots;
    const h = head();
    expect(`${spot.tile.x},${spot.tile.y},${spot.tile.z},${spot.tile.dirKey}`).not.toBe(`${h.x},${h.y},${h.z},${h.dirKey}`);
    expect(worm.strikeTile).not.toHaveBeenCalled();
    tick(16, 0.1);                      // the mark charges for STORM.telegraph
    expect(storm.flashes.length + worm.strikeTile.mock.calls.length).toBeGreaterThan(0);
  });

  it('marks nothing without the Lightning wash, in a demo, or after the wash has run out', () => {
    tick(40, 0.1);
    expect(storm.spots).toHaveLength(0);
    sim.elementalType = 'fire'; wormBuffs.elementalT = 10;
    tick(40, 0.1);
    expect(storm.spots).toHaveLength(0);
    useGameStore.setState({ demoMode: true, demoStep: 'worm-traversal' });
    wash();
    tick(40, 0.1);
    expect(storm.spots).toHaveLength(0);
  });

  it('a mark already set still strikes after the wash ends, but no new one is set', () => {
    mark(FAR);
    tick(1, 0.1);
    expect(worm.strikeTile).toHaveBeenCalledWith(expect.objectContaining(FAR));
    expect(storm.spots).toHaveLength(0);
  });

  it('flips a bare tile through the crawler', () => {
    mark(FAR);
    tick(1, 0.1);
    expect(worm.strikeTile).toHaveBeenCalledTimes(1);
    expect(storm.flashes).toHaveLength(1);
  });

  it('leaves a tile holding an orb or a special whole', () => {
    sim.powerups.push({ ...FAR, type: 'apple', spawnId: 'o1' });
    mark(FAR);
    tick(1, 0.1);
    expect(worm.strikeTile).not.toHaveBeenCalled();
    expect(storm.flashes).toHaveLength(1);
  });

  it('kills a head under the bolt', () => {
    mark(head());
    tick(1, 0.1);
    expect(useGameStore.getState().wormAlive).toBe(false);
    expect(useGameStore.getState().wormDeathDetails).toMatchObject({ reason: 'lightning' });
    expect(worm.strikeTile).not.toHaveBeenCalled();
  });

  it('a jumping head clears the bolt', () => {
    sim.isJumping = true;
    mark(head());
    tick(1, 0.1);
    expect(useGameStore.getState().wormAlive).toBe(true);
  });

  it('cuts the tail off where the bolt lands on the body', () => {
    sim.pos = { x: 1, y: 1, z: 2, dirKey: 'PZ' };
    sim.tailLength = 60;
    ttReset(sim.tileTrail, '1,1,2,PZ'); ttPush(sim.tileTrail, '0,1,2,PZ'); ttPush(sim.tileTrail, '0,0,2,PZ');
    mark({ x: 0, y: 1, z: 2, dirKey: 'PZ' });
    tick(1, 0.1);
    expect(useGameStore.getState().wormAlive).toBe(true);
    expect(worm.cutFocusT.current).toBeGreaterThan(0);
    expect(worm.strikeTile).not.toHaveBeenCalled();
  });

  it('kills the enemies near the strike', () => {
    const c = makeCombat(3, { x: 1, y: 1, z: 2, dirKey: 'PZ' });
    const near = makeEnemy(c); near.emerging = 0; near.tile = { ...FAR };
    const far = makeEnemy(c); far.emerging = 0; far.tile = { x: 2, y: 2, z: 2, dirKey: 'PZ' };
    c.enemies.push(near, far);
    combatBridge.current = c;
    mark(FAR);
    tick(1, 0.1);
    expect(c.enemies).toEqual([far]);
    expect(c.dying).toContain(near);
  });

  it.each([
    ['paused', () => useGameStore.setState({ wormPaused: true })],
    ['in a tunnel', () => { sim.phase = 'tunnel'; }],
    ['with a body in a tunnel', () => { sim.tunnelPassages.push({}); }],
    ['during a slice turn', () => useGameStore.setState({ animState: { axis: 'col', sliceIndex: 0, dir: 1 } })],
    ['during the orb freeze', () => { sim.elementalFocusT = 1; }],
    ['during a cut freeze', () => { sim.cutFocusT = 1; }],
  ])('holds the marks while %s', (_name, hold) => {
    mark(FAR);
    act(hold);
    tick(5, 0.1);
    expect(storm.spots[0].age).toBeCloseTo(STORM.telegraph - 0.05, 5);
    expect(worm.strikeTile).not.toHaveBeenCalled();
  });

  it('forgets its marks on a new run', () => {
    mark(FAR);
    act(() => useGameStore.setState({ wormRunId: (useGameStore.getState().wormRunId ?? 0) + 1 }));
    tick(1, 1); tick(1, 5);             // a new run goes through its spawn and countdown again
    tick(1, 0.1);
    expect(storm.spots).toHaveLength(0);
    expect(worm.strikeTile).not.toHaveBeenCalled();
  });
});
