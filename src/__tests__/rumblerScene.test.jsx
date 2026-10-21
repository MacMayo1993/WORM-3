import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { rumbleLifts } from '../worm/rumbleBridge.js';
import { resetRotationClock } from '../worm/healerWorm/rotationClockBridge.js';

const { woken } = vi.hoisted(() => ({ woken: [] }));
vi.mock('../3d/StickerAnimationManager.js', async original => ({ ...await original(), activateSticker: id => woken.push(id) }));
extend(THREE);

// The Rumbler in a live scene: belts drawn from a small pool, a few cells lifted
// through the bridge, one rumble cue per crest under the head, Mobi's line once, and
// not a single write to the worm.
let before, root, store;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  before = useGameStore.getState();
  try { localStorage.removeItem('worm3_rumble_seen'); } catch { /* jsdom */ }
  resetRotationClock();
  woken.length = 0;
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  useGameStore.setState(before, true);
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

function stubWorm() {
  const ref = value => Object.freeze({ current: value });
  return {
    pos: ref(Object.freeze({ x: 2, y: 2, z: 4, dirKey: 'PZ' })), moveDir: ref('up'), interpT: ref(0.5),
    phase: ref('crawling'), padFlight: ref(null), jumpRescueHeld: ref(false), cutFocusT: ref(0),
    elementalFocusT: ref(0), healPauseT: ref(0), feel: vi.fn()
  };
}

async function mount(worm) {
  const { default: Rumbler } = await import('../worm/healerWorm/Rumbler.jsx');
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 400, height: 300 } });
  await act(async () => { store = root.render(<Rumbler worm={worm} size={5} />); });
}

it('rumbles under the worm without touching it, and starts flat again on unmount', async () => {
  useGameStore.setState({ size: 5, cubies: makeCubies(5), wormAlive: true, wormPaused: false, wormGamePhase: 'active',
    wormStoryLevel: null, wormJumpRescueActive: false, wormMobiLine: null, settings: { ...before.settings, reducedMotion: false } });
  const worm = stubWorm();
  await mount(worm);
  let mostLifted = 0, mostBands = 0, t = 0;
  for (let f = 0; f < 420; f++) {
    await act(async () => { store.getState().advance(t += 1 / 60); });
    mostLifted = Math.max(mostLifted, rumbleLifts.size);
    const bands = store.getState().scene.getObjectsByProperty('name', 'rumbler-band');
    expect(bands).toHaveLength(4);
    mostBands = Math.max(mostBands, bands.filter(b => b.visible).length);
  }
  expect(mostBands).toBeGreaterThan(0);
  expect(mostLifted).toBeGreaterThan(0);
  expect(mostLifted).toBeLessThanOrEqual(8);
  expect(woken.length).toBeGreaterThan(0);
  const cues = worm.feel.mock.calls.filter(([event]) => event === 'rumble');
  expect(cues.length).toBeGreaterThan(0);
  // Mobi speaks the first time only.
  expect(useGameStore.getState().wormMobiLine).toMatchObject({ id: 'rumble' });
  expect(localStorage.getItem('worm3_rumble_seen')).toBe('1');
  const seq = useGameStore.getState().wormMobiLine.seq;
  for (let f = 0; f < 240; f++) await act(async () => { store.getState().advance(t += 1 / 60); });
  expect(useGameStore.getState().wormMobiLine.seq).toBe(seq);
  await act(async () => root.unmount());
  root = null;
  expect(rumbleLifts.size).toBe(0);
});

it('holds while the worm is in a tunnel: nothing lifts and no cue plays', async () => {
  useGameStore.setState({ size: 5, cubies: makeCubies(5), wormAlive: true, wormPaused: false, wormGamePhase: 'active',
    wormStoryLevel: null, wormJumpRescueActive: false, settings: { ...before.settings, reducedMotion: false } });
  const worm = { ...stubWorm(), phase: Object.freeze({ current: 'tunnel' }) };
  await mount(worm);
  let t = 0;
  for (let f = 0; f < 300; f++) {
    await act(async () => { store.getState().advance(t += 1 / 60); });
    expect(rumbleLifts.size).toBe(0);
  }
  expect(worm.feel).not.toHaveBeenCalled();
});
