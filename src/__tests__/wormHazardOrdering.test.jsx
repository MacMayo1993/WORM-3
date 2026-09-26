import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { makeWormSim, resetWormSim, killWormSim } from '../worm/healerWorm/wormSim.js';
import { makeCubies } from '../game/cubeState.js';
import { stageWormPractice, readWormPractice } from '../worm/healerWorm/demoPractice.js';
import { WORM_DEMO_LESSONS, newWormDemo } from '../game/wormDemoLessons.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { rotationClock } from '../worm/healerWorm/rotationClockBridge.js';
import { setLiveRotation, resetLiveRotation } from '../worm/liveRotation.js';

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
  ...await importOriginal(), checkBlastHitWorm: vi.fn(() => ({ type: 'death' })), isBombDisarmed: vi.fn(() => false),
}));

import { HealerWormMode3DWrapper } from '../worm/HealerWormMode.jsx';
import { HealerBombs } from '../worm/healerWorm/HealerBombs.jsx';
import { resolveSliceHits } from '../worm/wormHelpers.js';
import { isBombDisarmed, checkBlastHitWorm } from '../worm/healerWorm/bombs.js';

// Run the real scheduler's hooks, retaining its child props without mounting
// WebGL renderers. Only the simulation port and visual effects are substituted.
function Harness(props) { tree = HealerWormMode3DWrapper(props); return null; }
let root, host, rotate, sim;
const tick = (count = 1, delta = 0.1) => act(() => { for (let i = 0; i < count; i++) frameCb({}, delta); });

beforeEach(() => {
  vi.clearAllMocks();
  isBombDisarmed.mockImplementation(() => false);
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
  useGameStore.setState({ cubies, size: 3, wormAlive: true, wormPaused: false, wormJumpRescueActive: false, animState: null,
    demoMode: false, wormStoryLevel: null, wormStoryResult: null, wormCombatMode: false, wormEnemiesEnabled: false, wormPhase: 'crawling' });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  rotate = vi.fn();
  act(() => root.render(<Harness cubies={cubies} size={3} onRotate={rotate} onAnimatedShuffle={(_moves, done) => done()} />));
  tick(1, 1); // spawn
  tick(1, 5); // countdown
  expect(useGameStore.getState().wormGamePhase).toBe('active');
});

afterEach(() => {
  resetLiveRotation();
  act(() => root.unmount()); host.remove();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it('opens the authored WORM demo board without a scramble or countdown', () => {
  const shuffle = vi.fn();
  act(() => {
    useGameStore.setState({ demoMode: true, demoStep: 'worm-traversal', demoWormLessonIndex: 0 });
    root.render(<Harness cubies={useGameStore.getState().cubies} size={3} onRotate={rotate} onAnimatedShuffle={shuffle} />);
  });
  expect(shuffle).not.toHaveBeenCalled();
  expect(useGameStore.getState().wormGamePhase).toBe('active');
  expect(useGameStore.getState().wormCountdownStep).toBeNull();
  expect(useGameStore.getState().wormPaused).toBe(true);
  act(() => useGameStore.setState({ wormPaused: false }));
  tick(300);
  expect(rotate).not.toHaveBeenCalled();
  expect(useGameStore.getState().wormGamePhase).toBe('active');
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

it('holds bombs and the rotation countdown through a rescue and its release frame', () => {
  tick(95);
  const bombProps = React.Children.toArray(tree.props.children).find(child => child.type === HealerBombs).props;
  const bomb = { id: 3, tile: { ...sim.pos }, fuse: 0.3, maxFuse: 5 };
  bombProps.bombsRef.current.push(bomb);
  act(() => useGameStore.setState({ wormJumpRescueActive: true }));
  tick(10);
  expect(bomb.fuse).toBe(0.3);
  expect(checkBlastHitWorm).not.toHaveBeenCalled();
  expect(rotate).not.toHaveBeenCalled();
  expect(rotationClock.held).toBe(true);
  act(() => useGameStore.setState({ wormJumpRescueActive: false }));
  sim.jumpRescueHeld = true;
  tick();
  expect(bomb.fuse).toBe(0.3);
  sim.jumpRescueHeld = false;
  tick();
  expect(bomb.fuse).toBeCloseTo(0.2);
});

it('severs a fatal slice hit and stops the turn before it can drag the dead body apart', () => {
  resolveSliceHits.mockReturnValueOnce({ type: 'death', sliceIndex: 1,
    cutTrailIdx: 1, cutDistance: 0.2, keepCount: 2, historyIndex: 0, historyT: 0.5,
    cutPosition: sim.headInterpPos.toArray() });
  tick(110);
  expect(useGameStore.getState().wormAlive).toBe(false);
  expect(useGameStore.getState().wormDeathDetails).toMatchObject({ reason: 'slice-rotation', sliceIndex: 1 });
  expect(sim.tailLength).toBe(2);
  expect(sim.stepHistory.count).toBe(1);
  expect(rotate).not.toHaveBeenCalled();
  expect(worm.feel.mock.calls.filter(([event]) => event === 'death')).toHaveLength(1);
});

it.each([1, 2, 3])('keeps story level %i free of ambient bombs, rotations and ordinary solve rewards', id => {
  act(() => {
    useGameStore.setState({ playerProgress: { ...useGameStore.getState().playerProgress, wormStory: { stars: {1:1,2:1,3:1,4:1,5:1}, claimed: {} } } });
    useGameStore.getState().initWormMode(undefined, undefined, 1.4, 1, 30, null, false, false, id);
  });
  expect(useGameStore.getState().wormGamePhase).toBe('active');
  act(() => useGameStore.setState({ wormPaused: false, wormStoryStarted: true }));
  tick(500);
  expect(rotate).not.toHaveBeenCalled();
  expect(useGameStore.getState().wormGamePhase).toBe('active');
  const props = React.Children.toArray(tree.props.children).find(child => child.type === HealerBombs).props;
  expect(props.bombsRef.current).toHaveLength(0);
});

it.each([[4,14], [5,14], [6,11]])('repeats the full warned cycle for story level %i at %is intervals and holds it while paused', (id, interval) => {
  act(() => {
    useGameStore.setState({ playerProgress: { ...useGameStore.getState().playerProgress, wormStory: { stars: {1:1,2:1,3:1,4:1,5:1}, claimed: {} } } });
    useGameStore.getState().initWormMode(undefined, undefined, 1.4, 1, 30, null, false, false, id);
  });
  tick(150); expect(rotate).not.toHaveBeenCalled();
  act(() => useGameStore.setState({ wormPaused: false, wormStoryStarted: true }));
  tick(interval * 5); expect(rotate).not.toHaveBeenCalled(); expect(rotationClock.total).toBe(interval);
  act(() => useGameStore.setState({ wormPaused: true }));
  const left = rotationClock.secondsLeft;
  tick(300); expect(rotationClock.secondsLeft).toBe(left); expect(rotate).not.toHaveBeenCalled();
  act(() => useGameStore.setState({ wormPaused: false }));
  tick(interval * 70);
  expect(rotate.mock.calls.length).toBeGreaterThanOrEqual(7);
  expect(useGameStore.getState().wormGamePhase).toBe('active');
  expect(useGameStore.getState().wormStoryResult).toBeNull();
  expect(new Set(rotate.mock.calls.map(call => call[0])).size).toBe(3);
  const props = React.Children.toArray(tree.props.children).find(child => child.type === HealerBombs).props;
  expect(props.bombsRef.current).toHaveLength(0);
});

it('spawns a Story bomb, credits only a full live ring, and suppresses ordinary disarm coins', async () => {
  const { isBombDisarmed: actualDisarm, bombDisarmRing } = await vi.importActual('../worm/healerWorm/bombs.js');
  const { ttReset, ttPush } = await import('../worm/circularBuffers.js');
  isBombDisarmed.mockImplementation(actualDisarm);
  sim.pos = { x: 0, y: 0, z: 2, dirKey: 'PZ' };
  worm.storyBombsNeeded = () => true; worm.recordStoryBomb = vi.fn();
  act(() => useGameStore.setState({ wormStoryLevel: 9, wormStoryStarted: true, wormStoryResult: null, wormPaused: false }));
  const props = React.Children.toArray(tree.props.children).find(child => child.type === HealerBombs).props;
  for (let i = 0; i < 600 && props.bombsRef.current.length === 0; i++) tick();
  expect(props.bombsRef.current).toHaveLength(1);
  const bomb = props.bombsRef.current[0]; expect(bomb.maxFuse).toBe(25);
  const ring = [...bombDisarmRing(bomb, 3)]; sim.tailLength = 120;
  ttReset(sim.tileTrail, ring[0]); for (const key of ring.slice(1, -1)) ttPush(sim.tileTrail, key);
  tick(); expect(worm.recordStoryBomb).not.toHaveBeenCalled();
  const coins = useGameStore.getState().parityPoints;
  ttPush(sim.tileTrail, ring.at(-1)); tick();
  expect(worm.recordStoryBomb).toHaveBeenCalledExactlyOnceWith(bomb.id);
  expect(props.bombsRef.current).toHaveLength(0);
  expect(useGameStore.getState().parityPoints).toBe(coins);
});

it('Book freezes only the layer countdown and resumes the same pending turn', () => {
  tick(80);
  const remaining = rotationClock.remaining;
  sim.signature.character = 'book'; sim.signature.active = 5;
  tick(60);
  expect(rotationClock.held).toBe(true);
  expect(rotationClock.remaining).toBe(remaining);
  expect(rotate).not.toHaveBeenCalled();
  sim.signature.active = 0;
  tick(21);
  expect(rotate).toHaveBeenCalledTimes(1);
});

it('publishes the impact effect once for a death caused during the live rotation', async () => {
  const { ThunkEffect } = await import('../worm/healerWorm/impactFx.jsx');
  const details = { reason: 'slice-rotation', liveCrossing: true, axis: 'row', sliceIndex: 1, impactPosition: [1,2,3] };
  worm.tick.mockImplementationOnce(() => worm.killWorm(details));
  tick();
  const effect = React.Children.toArray(tree.props.children).find(child => child.type === ThunkEffect).props.thunkRef;
  expect(effect.current).toMatchObject({ active: true, text: "WORM'D", pos: [1,2,3] });
  effect.current.active = false;
  tick(5);
  expect(effect.current.active).toBe(false);
  expect(rotate).not.toHaveBeenCalled();
});

// The hazard's own tween holds store.animState for its whole length. The early-turn
// watch has to run through it, and must not outlive the commit.
const COORD = { col: 'x', row: 'y', depth: 'z' };
function fireHazardWithHeadOff() {
  tick(95); // armed: the clock publishes the threatened layer
  const { axis, sliceIndex: layer } = rotationClock;
  const coord = COORD[axis], off = (layer + 1) % 3;
  sim.pos = { ...sim.pos, [coord]: off }; sim.prevTile = { ...sim.pos }; sim.interpT = 1;
  tick(15);
  expect(rotate).toHaveBeenCalledTimes(1);
  expect(resolveSliceHits).toHaveBeenCalledTimes(1); // the fire-time decision
  return { axis, layer, coord, off };
}
const stepOnto = ({ coord, off, layer }) => {
  sim.prevTile = { ...sim.pos, [coord]: off }; sim.pos = { ...sim.pos, [coord]: layer }; sim.interpT = 0.6;
};

it('resolves a head that steps onto the turning layer early in the hazard tween', () => {
  const turn = fireHazardWithHeadOff();
  act(() => useGameStore.setState({ animState: { axis: turn.axis, sliceIndex: turn.layer, dir: 1 } }));
  setLiveRotation(turn.axis, [turn.layer], [0.02], turn.layer, 0.02);
  tick();
  expect(resolveSliceHits).toHaveBeenCalledTimes(1);
  resolveSliceHits.mockReturnValueOnce({ type: 'death', sliceIndex: turn.layer, cutTrailIdx: 1,
    cutPosition: sim.headInterpPos.toArray() });
  stepOnto(turn);
  tick();
  expect(resolveSliceHits).toHaveBeenCalledTimes(2);
  expect(useGameStore.getState().wormAlive).toBe(false);
  expect(useGameStore.getState().wormDeathDetails).toMatchObject({ reason: 'slice-rotation', axis: turn.axis,
    sliceIndex: turn.layer, liveCrossing: true });
});

it('forgets the turn at its commit, so crossing the old layer on an idle cube is not a hit', () => {
  const turn = fireHazardWithHeadOff();
  act(() => useGameStore.setState({ animState: { axis: turn.axis, sliceIndex: turn.layer, dir: 1 } }));
  tick(3); // the tween runs without liveRotation ever being observed
  act(() => useGameStore.setState(state => ({ animState: null, rotationEpoch: state.rotationEpoch + 1 })));
  tick();
  stepOnto(turn);
  tick(5);
  expect(resolveSliceHits).toHaveBeenCalledTimes(1);
  expect(useGameStore.getState().wormAlive).toBe(true);
});

function startHazardLesson(id) {
  const index = WORM_DEMO_LESSONS.findIndex(l => l.id === id), lesson = WORM_DEMO_LESSONS[index];
  const practice = { ...stageWormPractice(sim, 3, lesson), rotationEpoch: 0 };
  act(() => useGameStore.setState({ ...newWormDemo(), demoMode: true, demoStep: 'worm-traversal',
    demoWormLessonIndex: index, demoWormTarget: practice.target, cubies: practice.cubies, rotationEpoch: 0 }));
  act(() => useGameStore.setState({ wormPaused: false }));
  return { practice, lesson, result: () => readWormPractice(sim, practice, lesson, useGameStore.getState(), 3, 0.1) };
}

it('requires the live bomb ring to disarm and complete the demo lesson without rewards', async () => {
  const { isBombDisarmed: actualDisarm, bombDisarmRing } = await vi.importActual('../worm/healerWorm/bombs.js');
  const { ttReset, ttPush } = await import('../worm/circularBuffers.js');
  isBombDisarmed.mockImplementation(actualDisarm);
  const { result } = startHazardLesson('bomb');
  tick();
  const props = React.Children.toArray(tree.props.children).find(child => child.type === HealerBombs).props;
  expect(props.bombsRef.current).toHaveLength(1);
  const bomb = props.bombsRef.current[0], ring = [...bombDisarmRing(bomb, 3)];
  expect(bomb.maxFuse).toBe(25);
  ttReset(sim.tileTrail, ring[0]); for (const key of ring.slice(1, -1)) ttPush(sim.tileTrail, key);
  const coins = useGameStore.getState().parityPoints;
  tick(); expect(result().done).toBe(false);
  ttPush(sim.tileTrail, ring.at(-1)); tick();
  expect(result().done).toBe(true); expect(props.bombsRef.current).toHaveLength(0);
  expect(useGameStore.getState().parityPoints).toBe(coins);
  expect(rotate).not.toHaveBeenCalled();
});

it('completes the demo rotation only after the warned live layer has committed', () => {
  const { result } = startHazardLesson('rotation');
  tick(50);
  expect(rotationClock.axis).toBe('col'); expect(rotationClock.sliceIndex).toBe(0);
  expect(result().done).toBe(false); expect(rotate).not.toHaveBeenCalled();
  tick(55);
  expect(rotate).toHaveBeenCalledExactlyOnceWith('col', 1, 0, false, undefined, undefined);
  expect(result().done).toBe(false);
  act(() => useGameStore.setState({ rotationEpoch: 1 }));
  expect(result().done).toBe(true);
  tick(200); expect(rotate).toHaveBeenCalledTimes(1);
});
