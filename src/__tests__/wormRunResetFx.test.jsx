// A death's hit beats (the WORM'D shout, the severed tail) belong to the run they
// happened in. Retrying while the shout is still playing starts the new run paused
// (scramble or Story briefing), which holds the shout's clock, so it used to hang
// frozen over the fresh board. And a slice death leaves the killing turn in flight:
// Retry must abandon it, or it kept the Story board from restaging and then
// committed onto the new cube.
import { it, expect, vi, beforeAll, afterAll } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';

const frames = [];
vi.mock('@react-three/fiber', () => ({ useFrame: callback => { frames.push(callback); } }));
vi.mock('@react-three/drei', () => ({ Html: ({ children }) => children }));

import { useGameStore } from '../hooks/useGameStore.js';
import { ThunkEffect, SeveredTail } from '../worm/healerWorm/impactFx.jsx';
import { useAnimation } from '../hooks/useAnimation.js';
import { liveRotation, setLiveRotation } from '../worm/liveRotation.js';

// jsdom renders <group>/<mesh>/<instancedMesh> as unknown elements. Give them the few
// Three.js members these effects touch, one real object per element.
const three = new WeakMap();
const threeOf = el => {
  if (!three.has(el)) {
    three.set(el, {
      position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3(1, 1, 1),
      material: { color: new THREE.Color(), opacity: 0 }, visible: false, count: 0,
      instanceMatrix: { needsUpdate: false }, instanceColor: { needsUpdate: false },
    });
  }
  return three.get(el);
};
const members = ['position', 'quaternion', 'scale', 'material', 'visible', 'count', 'instanceMatrix', 'instanceColor'];
let warn;
beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  warn = vi.spyOn(console, 'error').mockImplementation(() => {});
  for (const name of members) {
    Object.defineProperty(HTMLUnknownElement.prototype, name, {
      configurable: true,
      get() { return threeOf(this)[name]; },
      set(value) { threeOf(this)[name] = value; },
    });
  }
  HTMLUnknownElement.prototype.setMatrixAt = () => {};
  HTMLUnknownElement.prototype.setColorAt = () => {};
});
afterAll(() => {
  for (const name of members) delete HTMLUnknownElement.prototype[name];
  delete HTMLUnknownElement.prototype.setMatrixAt;
  delete HTMLUnknownElement.prototype.setColorAt;
  warn.mockRestore();
});

const tick = (delta = 0.1) => { for (const frame of frames) frame({}, delta); };

function mount(element) {
  frames.length = 0;
  const host = document.createElement('div');
  const root = createRoot(host);
  act(() => root.render(element));
  return { host, root };
}

it('drops a WORM\'D shout still playing when a new run starts, even though the new run is paused', () => {
  useGameStore.setState({ wormRunId: 7, wormAlive: false, wormPaused: false });
  const thunkRef = { current: { active: false } };
  const { host, root } = mount(<ThunkEffect thunkRef={thunkRef} />);
  const callout = () => host.querySelector('div[style*="nowrap"]');

  thunkRef.current = { active: true, pos: [1, 2, 3], kind: 'sliced' };
  tick();
  expect(callout().style.display).toBe('block');

  // Retry before the 4.2 s shout ends: the new run opens alive and paused.
  useGameStore.setState({ wormRunId: 8, wormAlive: true, wormPaused: true });
  tick();
  expect(callout().style.display).toBe('none');
  for (let i = 0; i < 5; i++) tick();
  expect(callout().style.display).toBe('none');

  // A shout in the new run still plays.
  thunkRef.current = { active: true, pos: [0, 0, 0], kind: 'cut' };
  useGameStore.setState({ wormPaused: false });
  tick();
  expect(callout().style.display).toBe('block');
  act(() => root.unmount());
});

it('drops a pending shout from the old run instead of playing it over the new one', () => {
  useGameStore.setState({ wormRunId: 20, wormAlive: false, wormPaused: false });
  const thunkRef = { current: { active: false } };
  const { host, root } = mount(<ThunkEffect thunkRef={thunkRef} />);
  thunkRef.current = { active: true, pos: [0, 0, 0], kind: 'struck' };
  useGameStore.setState({ wormRunId: 21, wormAlive: true });
  tick();
  expect(thunkRef.current.active).toBe(false);
  expect(host.querySelector('div[style*="nowrap"]').style.display).toBe('none');
  act(() => root.unmount());
});

it('drops a severed tail still tumbling when a new run starts', () => {
  useGameStore.setState({ wormRunId: 30, wormAlive: true, wormPaused: false });
  const piece = { pos: [0, 1.6, 0], normal: [0, 1, 0], bead: 1 };
  const severedRef = { current: { active: false, pieces: [], count: 0, orbColors: [] } };
  const { host, root } = mount(<SeveredTail severedRef={severedRef} />);
  const mesh = host.querySelector('instancedmesh');
  severedRef.current = { active: true, pieces: [piece, piece, piece], count: 3, orbColors: [] };
  tick(0.05);
  expect(mesh.count).toBe(3);
  useGameStore.setState({ wormRunId: 31, wormPaused: true });
  tick(0.05);
  expect(mesh.count).toBe(0);
  act(() => root.unmount());
});

it('Retry\'s cancel abandons a turn still in flight, with no holdover of its angle', () => {
  const hook = { current: null };
  function Probe() { hook.current = useAnimation(); return null; }
  const { root } = mount(<Probe />);
  const api = new Proxy({}, { get: (_, name) => hook.current[name] });
  act(() => api.startAnimation('row', 1, 2, false, [2], [1]));
  setLiveRotation('row', [2], [0.7], 2, 0.7);
  expect(useGameStore.getState().animState).not.toBeNull();
  expect(liveRotation.active).toBe(true);

  act(() => api.cancelShuffle());
  const state = useGameStore.getState();
  expect(state.animState).toBeNull();
  expect(state.pendingMove).toBeNull();
  expect(liveRotation.active).toBe(false);
  expect(liveRotation.sliceIndices).toHaveLength(0);
  expect(liveRotation.completedFrames).toBe(0);
  act(() => root.unmount());
});
