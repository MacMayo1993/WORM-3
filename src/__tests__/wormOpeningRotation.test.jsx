import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import CubeAssembly from '../3d/CubeAssembly.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { useAnimation } from '../hooks/useAnimation.js';
import { makeCubies } from '../game/cubeState.js';
import { rotateSliceCubies } from '../game/cubeRotation.js';
import { buildWormScramble } from '../worm/healerWorm/scramble.js';
import { liveCubies } from '../worm/liveCubies.js';
import { liveRotation, resetLiveRotation } from '../worm/liveRotation.js';
import { createOpeningTurn, advanceOpeningTurn } from '../worm/healerWorm/openingRotation.js';

const callbacks = new Map();
const camera = new THREE.PerspectiveCamera();
const tween = vi.hoisted(() => ({ to: vi.fn(() => ({ kill: vi.fn(), paused: vi.fn() })) }));
vi.mock('gsap', () => ({ default: tween }));
vi.mock('../3d/Cubie.jsx', () => ({ default: () => null }));
vi.mock('@react-three/fiber', () => ({ useFrame: (cb, priority = 0) => callbacks.set(priority, cb), useThree: () => ({ camera, gl: {} }) }));
vi.mock('../3d/styles/TileStyleMaterials.jsx', async original => ({ ...(await original()), warmUpDefaultStyles: () => {} }));
let root, before;
const complete = vi.fn();
function Harness({ size, move }) {
  CubeAssembly.type({ size, cubies: useGameStore.getState().cubies, animState: move, onAnimComplete: complete });
  return null;
}
function frame(delta) {
  act(() => {
    const state = { camera, clock: { elapsedTime: 1 } };
    callbacks.get(-2)(state, delta);
    callbacks.get(-1)(state, delta);
  });
}
function mount(size, move, wormHealerMode = true) {
  useGameStore.setState({ size, cubies: makeCubies(size), animState: move, wormHealerMode,
    wormJumpRescueActive: false, explosionT: 0, rotationEpoch: 0 });
  act(() => root.render(<Harness size={size} move={move} />));
  const k = (size - 1) / 2;
  for (let i = 0; i < size ** 3; i++) {
    const obj = new THREE.Object3D();
    obj.position.set(Math.floor(i / (size * size)) - k, Math.floor(i / size) % size - k, i % size - k);
    liveCubies.refs[i] = obj;
  }
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  before = useGameStore.getState();
  root = createRoot(document.createElement('div'));
  callbacks.clear(); complete.mockClear(); tween.to.mockClear(); resetLiveRotation();
});
afterEach(() => {
  act(() => root.unmount()); useGameStore.setState(before, true); resetLiveRotation();
  vi.useRealTimers();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

let animation;
function QueueHarness({ size }) {
  animation = useAnimation();
  CubeAssembly.type({ size, cubies: useGameStore.getState().cubies, animState: animation.animState,
    onAnimComplete: animation.handleAnimComplete });
  return null;
}

it.each([3, 10, 15])('finishes the real size-%i shuffle queue exactly once with the intended board', size => {
  vi.useFakeTimers();
  mount(size, null);
  const initial = useGameStore.getState().cubies;
  act(() => root.render(<QueueHarness size={size} />));
  const moves = buildWormScramble(size, 20);
  const done = vi.fn();
  act(() => animation.startAnimatedShuffle(moves, done));
  for (let i = 0; i < 1000 && !done.mock.calls.length; i++) {
    frame(1 / 60);
    act(() => vi.advanceTimersByTime(1000 / 60));
  }
  expect(done).toHaveBeenCalledTimes(1);
  const expected = moves.reduce((board, move) => {
    const layers = move.sliceIndices || [move.sliceIndex];
    return layers.reduce((cubies, layer, i) => rotateSliceCubies(cubies, size, move.axis, layer,
      move.sliceDirs?.[i] ?? move.dir), board);
  }, initial);
  expect(useGameStore.getState().cubies).toEqual(expected);
  expect(useGameStore.getState().animState).toBeNull();
  expect(useGameStore.getState().pendingMove).toBeNull();
  expect(useGameStore.getState().moves).toBe(before.moves);
});

it.each([2, 3, 4, 5, 6, 7, 8, 9, 10, 15])('renders the exact final size-%i pose before committing, even after hitches', size => {
  const move = { axis: 'row', sliceIndex: 0, dir: 1, isShuffle: true, wormScramble: true,
    ...(size === 15 ? { sliceIndices: [0, 14], sliceDirs: [1, -1] } : {}) };
  mount(size, move);
  const original = liveCubies.refs.map(obj => obj.position.clone());
  frame(2); // expensive first mount must still show the zero-angle pose
  expect(liveRotation.angle).toBe(0);
  let frames = 0, previous = 0;
  while (liveRotation.angle < Math.PI / 2 && frames++ < 100) {
    frame(frames === 2 ? 3 : 1 / 60);
    expect(liveRotation.angle).toBeGreaterThanOrEqual(previous);
    expect(liveRotation.angle - previous).toBeLessThan(0.36);
    previous = liveRotation.angle;
    expect(complete).not.toHaveBeenCalled();
  }
  expect(liveRotation.angle).toBe(Math.PI / 2);
  expect(tween.to).not.toHaveBeenCalled();
  const axis = new THREE.Vector3(0, 1, 0);
  original.forEach((position, i) => {
    const layer = Math.floor(i / size) % size;
    const dir = layer === 0 ? 1 : size === 15 && layer === 14 ? -1 : 0;
    const expected = position.clone().applyAxisAngle(axis, dir * Math.PI / 2);
    expect(liveCubies.refs[i].position.distanceTo(expected)).toBeLessThan(1e-7);
  });
  frame(1 / 60);
  expect(complete).toHaveBeenCalledTimes(1);
  frame(1 / 60);
  expect(complete).toHaveBeenCalledTimes(1);
});

it('holds during rescue and discards a cancelled turn without committing', () => {
  const move = { axis: 'col', sliceIndex: 1, dir: -1, isShuffle: true, wormScramble: true };
  mount(8, move); frame(1 / 60); frame(1 / 60);
  const angle = liveRotation.angle;
  useGameStore.setState({ wormJumpRescueActive: true });
  for (let i = 0; i < 60; i++) frame(1 / 60);
  expect(liveRotation.angle).toBe(angle); expect(complete).not.toHaveBeenCalled();
  useGameStore.setState({ wormJumpRescueActive: false, animState: null });
  act(() => root.render(<Harness size={8} move={null} />));
  for (let i = 0; i < 60; i++) frame(1 / 60);
  expect(complete).not.toHaveBeenCalled();
});

it.each([30, 60, 120, 144, 240])('has the same turn duration at %i FPS', fps => {
  const turn = createOpeningTurn(10);
  advanceOpeningTurn(turn, 1 / fps);
  let frames = 0;
  while (turn.elapsed < turn.duration && frames++ < 100) advanceOpeningTurn(turn, 1 / fps);
  expect(frames / fps).toBeCloseTo(turn.duration, 1);
});

it.each([
  [{ isShuffle: true }, 0.12, 'power2.out'],
  [{}, 1.4, 'power2.inOut'],
])('preserves the existing non-opening tween for %j', (flags, duration, ease) => {
  mount(8, { axis: 'depth', sliceIndex: 0, dir: 1, ...flags });
  expect(tween.to).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration, ease }));
});

it('resets poses when React commits the completed rotation', () => {
  const move = { axis: 'depth', sliceIndex: 0, dir: -1, isShuffle: true, wormScramble: true };
  mount(9, move);
  const original = liveCubies.refs.map(obj => obj.position.clone());
  complete.mockImplementationOnce(() => useGameStore.setState({ animState: null, pendingMove: null, rotationEpoch: 1 }));
  for (let i = 0; i < 60 && !complete.mock.calls.length; i++) frame(1 / 60);
  expect(complete).toHaveBeenCalledTimes(1);
  expect(liveRotation.active).toBe(false);
  original.forEach((position, i) => expect(liveCubies.refs[i].position.distanceTo(position)).toBeLessThan(1e-8));
});

it.each([1, 2])('displays the final ordinary %i-quarter-turn pose before committing', numTurns => {
  const move = { axis: 'col', sliceIndex: 0, dir: -1, numTurns };
  mount(8, move, false);
  const [progress, config] = tween.to.mock.calls.at(-1);
  expect(config.ease).toBe('power2.inOut');
  const original = liveCubies.refs[0].position.clone();
  frame(1 / 60);
  // Tiny increments used to be silently dropped near the easing endpoints.
  for (const value of [0.00001, 0.00002, 0.3, 0.8, 0.99998, 0.99999]) {
    progress.value = value; frame(1 / 60);
  }
  progress.value = 1;
  config.onComplete(); // GSAP's callback runs before the next WebGL frame.
  expect(complete).not.toHaveBeenCalled();
  frame(1 / 60);
  expect(complete).not.toHaveBeenCalled();
  const expected = original.applyAxisAngle(new THREE.Vector3(1, 0, 0), -numTurns * Math.PI / 2);
  expect(liveCubies.refs[0].position.distanceTo(expected)).toBeLessThan(1e-10);
  frame(1 / 60);
  expect(complete).toHaveBeenCalledTimes(1);
  frame(1 / 60);
  expect(complete).toHaveBeenCalledTimes(1);
});

it('does not commit a finished tween cancelled before its final render', () => {
  mount(5, { axis: 'row', sliceIndex: 0, dir: 1 }, false);
  const [progress, config] = tween.to.mock.calls.at(-1);
  progress.value = 1; config.onComplete();
  useGameStore.setState({ animState: null });
  act(() => root.render(<Harness size={5} move={null} />));
  frame(1 / 60); frame(1 / 60);
  expect(complete).not.toHaveBeenCalled();
});
