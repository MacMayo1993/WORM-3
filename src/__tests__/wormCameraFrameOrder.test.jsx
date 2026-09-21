import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { makeWormSim, resetWormSim, killWormSim } from '../worm/healerWorm/wormSim.js';
import { makeCubies } from '../game/cubeState.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { PerspectiveCamera, Object3D, Vector3 } from 'three';
import { bodyPathHeadInto } from '../worm/healerWorm/sliceBodyPath.js';
import { liveCubies } from '../worm/liveCubies.js';
import { resetLiveRotation } from '../worm/liveRotation.js';

let worm;
const frames = [];
const scene = { camera: new PerspectiveCamera(70, 412 / 915, 0.1, 200), size: { width: 412, height: 915 } };
vi.mock('@react-three/fiber', async importOriginal => {
  const React = await import('react');
  return { ...await importOriginal(), useThree: () => scene,
    useFrame(callback, priority = 0) {
      const current = React.useRef(callback); current.current = callback;
      React.useLayoutEffect(() => {
        const sub = { run: (...args) => current.current(...args), priority };
        frames.push(sub);
        return () => frames.splice(frames.indexOf(sub), 1);
      }, [priority]);
    },
  };
});
vi.mock('../hooks/useIsMobile.js', () => ({ useIsMobile: () => true }));
vi.mock('../worm/useWormCrawler.js', () => ({ useWormCrawler: () => worm }));
vi.mock('../worm/healerWorm/elementalWarmup.js', () => ({ warmUpElementalSkins: vi.fn() }));
vi.mock('../worm/healerWorm/HealerBombs.jsx', () => ({ HealerBombs: () => null, FLAME_TEX: null }));
vi.mock('../utils/feel.js', async importOriginal => ({ ...await importOriginal(), feel: vi.fn(), setFeelEnabled: vi.fn() }));
vi.mock('../worm/wormHelpers.js', async importOriginal => ({ ...await importOriginal(), resolveSliceHits: vi.fn(() => null) }));
vi.mock('../worm/healerWorm/bombs.js', async importOriginal => ({
  ...await importOriginal(), checkBlastHitWorm: vi.fn(() => ({ type: 'death' })), isBombDisarmed: vi.fn(() => false),
}));

import { HealerWormMode3DWrapper } from '../worm/HealerWormMode.jsx';
import WormChaseCamera from '../worm/WormChaseCamera.jsx';

import { isBombDisarmed } from '../worm/healerWorm/bombs.js';

// Mount the real scheduler and camera. Reproduce R3F layout-effect subscription
// order (children before parents) and priority sorting without a WebGL renderer.
function Harness(props) {
  const tree = HealerWormMode3DWrapper(props);
  return React.Children.toArray(tree.props.children).find(child => child.type === WormChaseCamera);
}
let root, host, rotate, sim;
const tick = (count = 1, delta = 0.1) => act(() => { for (let i = 0; i < count; i++) frames.slice().sort((a, b) => a.priority - b.priority).forEach(sub => sub.run({}, delta)); });

beforeEach(() => {
  vi.clearAllMocks();
  scene.camera = new PerspectiveCamera(70, 412 / 915, 0.1, 200);
  isBombDisarmed.mockImplementation(() => false);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  resetLiveRotation(); liveCubies.refs = null; liveCubies.size = 0;
  sim = makeWormSim(15);
  resetWormSim(sim, 15, { orbCount: 0, wormholeInterval: 9999 });
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
  const cubies = makeCubies(15);
  useGameStore.setState({ cubies, size: 15, wormCameraHorizon: 'face', wormAlive: true, wormPaused: false, wormJumpRescueActive: false, animState: null,
    demoMode: false, wormStoryLevel: null, wormStoryResult: null, wormCombatMode: false, wormEnemiesEnabled: false, wormPhase: 'crawling' });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  rotate = vi.fn();
  act(() => root.render(<Harness cubies={cubies} size={15} onRotate={rotate} onAnimatedShuffle={(_moves, done) => done()} />));
  tick(1, 1); // spawn
  tick(1, 5); // countdown
  expect(useGameStore.getState().wormGamePhase).toBe('active');
});

afterEach(() => {
  act(() => root.unmount()); host.remove();
  resetLiveRotation(); liveCubies.refs = null; liveCubies.size = 0;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it('aims at the current moving Mega head regardless of mount order', () => {
  worm.tick.mockImplementation(delta => { sim.headInterpPos.x += delta * 3; });
  for (const reverse of [false, true]) {
    if (reverse) frames.reverse();
    for (const delta of [1 / 120, 1 / 30, 1 / 60, 0.07, 1 / 60]) {
      tick(1, delta);
      scene.camera.updateMatrixWorld(true);
      const projected = bodyPathHeadInto(sim.headInterpPos.clone(), worm).project(scene.camera);
      expect(projected.x).toBeCloseTo(0, 6);
      expect(projected.y).toBeCloseTo(0, 6);
    }
  }
});

it('follows live rotating Mega cubies before the head and camera are drawn', () => {
  const mesh = new Object3D();
  const tile = sim.pos;
  const rest = new Vector3(tile.x - 7, tile.y - 7, tile.z - 7);
  const axis = new Vector3(0, 1, 0);
  liveCubies.size = 15;
  liveCubies.refs = [];
  liveCubies.refs[tile.x * 225 + tile.y * 15 + tile.z] = mesh;
  sim.prevTile = null;
  sim.interpT = 1;
  let angle = 0;
  const transform = { priority: -1, run: () => {
    angle += 0.005;
    mesh.position.copy(rest).applyAxisAngle(axis, angle);
    mesh.quaternion.setFromAxisAngle(axis, angle);
  } };
  frames.push(transform);
  for (let i = 0; i < 180; i++) {
    tick(1, i % 2 ? 1 / 30 : 1 / 120);
    scene.camera.updateMatrixWorld(true);
    const head = bodyPathHeadInto(sim.headInterpPos.clone(), worm);
    const ndc = head.project(scene.camera);
    expect(ndc.x).toBeCloseTo(0, 6);
    expect(ndc.y).toBeCloseTo(0, 6);
    expect(Number.isFinite(scene.camera.quaternion.w)).toBe(true);
  }
  frames.splice(frames.indexOf(transform), 1);
});
