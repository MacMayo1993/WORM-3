// Chaos bolts used to be drawn between world positions the worker froze when it
// computed the hop. Once flipped cubies started rising to their Explode position
// (and springing, and riding slice turns), those bolts struck the empty slot the
// piece had left. The storm now resolves every endpoint against the live cubie
// transform each frame; this pins that, plus the landing's physical kick, the
// wormhole surge a flip sends to its twin, and clean retirement.
import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChaosStorm from '../manifold/ChaosStorm.jsx';
import { makeCubies } from '../game/cubeState.js';
import { buildManifoldGridMap } from '../game/manifoldLogic.js';
import { chaosStormEvents } from '../game/chaosStormEvents.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { pushChaosStormEvents, clearChaosStorm, tunnelCharges } from '../manifold/chaosStormBridge.js';
import { cubieKicks, clearCubieKicks } from '../3d/cubieKick.js';
import { SURFACE_OFFSET } from '../utils/constants.js';
import { STRIP_POINTS } from '../manifold/stormStrips.js';

extend(THREE);

const SIZE = 3;
const LIFT = SURFACE_OFFSET + 0.03;
// The main channel is the first strip written each frame: its vertex widths.
const BOLT_WIDTH_SPAN = 14 * 2;

let root, frame, now, before, refs, cubies, map;

const idx = (x, y, z) => (x * SIZE + y) * SIZE + z;
const stripVertex = (geo, strip, point) => {
  const v = strip * STRIP_POINTS * 2 + point * 2;
  return new THREE.Vector3().fromArray(geo.attributes.position.array, v * 3);
};
const stripGeometry = (store) => {
  let geo = null;
  store.getState().scene.traverse((o) => { if (!geo && o.isMesh && o.geometry.attributes.aXray) geo = o.geometry; });
  return geo;
};
const usedStrips = (geo) => geo.drawRange.count / ((STRIP_POINTS - 1) * 6);

async function mount(onCascadeComplete = vi.fn()) {
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  let store;
  await act(async () => { store = root.render(<ChaosStorm cubieRefs={refs} size={SIZE} onCascadeComplete={onCascadeComplete} />); });
  frame = 0;
  return store;
}
// Advance both the R3F clock and the wall clock the storm's timers read.
const step = (store, dtS = 1 / 60) => {
  frame += dtS;
  now += dtS * 1000;
  store.getState().advance(frame);
};

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  before = useGameStore.getState();
  cubies = makeCubies(SIZE);
  map = buildManifoldGridMap(cubies, SIZE);
  refs = [];
  for (let x = 0; x < SIZE; x++) for (let y = 0; y < SIZE; y++) for (let z = 0; z < SIZE; z++) {
    const g = new THREE.Group();
    g.position.set(x - 1, y - 1, z - 1);
    refs[idx(x, y, z)] = g;
  }
  useGameStore.setState({
    size: SIZE, cubies, chaosLevel: 3, rotationEpoch: 0, showTunnels: false, perfReducedFX: false, wormHealerMode: false,
    settings: { ...before.settings, flipPads: 'off', reducedMotion: false }
  });
  now = 10_000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  clearChaosStorm();
  clearCubieKicks();
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  vi.restoreAllMocks();
  useGameStore.setState(before, true);
  clearChaosStorm();
  clearCubieKicks();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

const boltEvent = (cascadeId = 7) => chaosStormEvents(
  { cascades: [{ from: [0, 0, 1.52], to: [1, 0, 1.52], crossFace: false, fromTile: [1, 1, 2, 'PZ'], toTile: [2, 1, 2, 'PZ'] }] },
  cubies, SIZE, map, 6, { cascadeIds: [cascadeId] }
).events;

describe('ChaosStorm bolts', () => {
  it('land on the live cubie, and keep following it when it rises mid-flight', async () => {
    const store = await mount();
    pushChaosStormEvents(boltEvent());
    // Through the charge-up and the leader, all the way to the target.
    for (let i = 0; i < 16; i++) step(store);
    const geo = stripGeometry(store);
    expect(usedStrips(geo)).toBeGreaterThanOrEqual(1);
    const source = stripVertex(geo, 0, 0);
    const target = stripVertex(geo, 0, 13);
    expect(source.distanceTo(new THREE.Vector3(0, 0, 1 + LIFT))).toBeLessThan(1e-5);
    expect(target.distanceTo(new THREE.Vector3(1, 0, 1 + LIFT))).toBeLessThan(1e-5);

    // The struck piece rises to its Explode position (whole-cubie lift). The old
    // bolt kept striking the slot it left; this one moves with the piece.
    refs[idx(2, 1, 2)].position.set(1.8, 0, 1.8);
    step(store);
    expect(stripVertex(geo, 0, 13).distanceTo(new THREE.Vector3(1.8, 0, 1.8 + LIFT))).toBeLessThan(1e-5);

    // And rides a slice turn: the face normal turns with the piece.
    refs[idx(2, 1, 2)].position.set(1, 0, 1);
    refs[idx(2, 1, 2)].quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    step(store);
    expect(stripVertex(geo, 0, 13).distanceTo(new THREE.Vector3(1 + LIFT, 0, 1))).toBeLessThan(1e-5);
  });

  it('charges up on the source tile before the channel fires', async () => {
    const store = await mount();
    pushChaosStormEvents(boltEvent());
    step(store);
    const geo = stripGeometry(store);
    // Only the gathering arcs so far — no channel, no hit.
    expect(usedStrips(geo)).toBe(2);
    expect(stripVertex(geo, 0, 0).distanceTo(new THREE.Vector3(0, 0, 1 + LIFT))).toBeLessThan(0.6);
    expect(cubieKicks.size).toBe(0);
  });

  it('opens a thick channel on the return stroke', async () => {
    const store = await mount();
    pushChaosStormEvents(boltEvent());
    for (let i = 0; i < 12; i++) step(store);
    const geo = stripGeometry(store);
    const leaderWidth = Math.max(...geo.attributes.aWidth.array.slice(0, BOLT_WIDTH_SPAN));
    for (let i = 0; i < 4; i++) step(store);
    const strokeWidth = Math.max(...geo.attributes.aWidth.array.slice(0, BOLT_WIDTH_SPAN));
    expect(strokeWidth).toBeGreaterThan(leaderWidth * 1.5);
    // Thick against a ~0.88 tile: a real channel, not a hairline.
    expect(strokeWidth).toBeGreaterThan(0.3);
  });

  it('punches the struck cubie on landing, ripples its neighbours, and retires its HUD entry once', async () => {
    const done = vi.fn();
    const store = await mount(done);
    pushChaosStormEvents(boltEvent(99));
    for (let i = 0; i < 16; i++) step(store);
    const kick = cubieKicks.get('2,1,2');
    expect(kick).toBeTruthy();
    expect([kick.x, kick.y, kick.z]).toEqual([0, 0, 1]);
    // In-face neighbours of (2,1,2) on +Z are (1,1,2), (2,0,2) and (2,2,2):
    // softer, and a beat later.
    for (const key of ['1,1,2', '2,0,2', '2,2,2']) {
      expect(cubieKicks.get(key).amp).toBeLessThan(kick.amp);
      expect(cubieKicks.get(key).startMs).toBeGreaterThan(kick.startMs);
    }
    expect(cubieKicks.has('2,1,1')).toBe(false);
    expect(done).not.toHaveBeenCalled();
    for (let i = 0; i < 40; i++) step(store);
    expect(done).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledWith(99);
    step(store);
    expect(usedStrips(stripGeometry(store))).toBe(0);
  });

  it('keeps the bolt but drops the physical kick under reduced motion', async () => {
    useGameStore.setState({ settings: { ...useGameStore.getState().settings, reducedMotion: true } });
    const store = await mount();
    pushChaosStormEvents(boltEvent());
    for (let i = 0; i < 16; i++) step(store);
    expect(usedStrips(stripGeometry(store))).toBeGreaterThanOrEqual(1);
    expect(cubieKicks.size).toBe(0);
  });

  it('drops everything in flight when the round is cleared', async () => {
    const done = vi.fn();
    const store = await mount(done);
    pushChaosStormEvents(boltEvent());
    step(store);
    clearChaosStorm();
    step(store);
    expect(usedStrips(stripGeometry(store))).toBe(0);
    // The store's bolt list was cleared by the same path — nothing to retire.
    expect(done).not.toHaveBeenCalled();
  });
});

describe('ChaosStorm first strike', () => {
  it('charges the picked tile, then drops a heavy bolt out of the sky onto it', async () => {
    const store = await mount();
    const { events } = chaosStormEvents({ ignition: [1, 1, 2, 'PZ'] }, cubies, SIZE, map, 6);
    pushChaosStormEvents(events);
    step(store);
    const geo = stripGeometry(store);
    // The pick gathers charge first: three arcs on the tile, nothing from the sky yet.
    expect(usedStrips(geo)).toBe(3);
    expect(stripVertex(geo, 0, 0).distanceTo(new THREE.Vector3(0, 0, 1 + LIFT))).toBeLessThan(0.6);
    for (let i = 0; i < 40; i++) step(store);
    // The channel ends on the tile and starts well above it.
    expect(stripVertex(geo, 0, 13).distanceTo(new THREE.Vector3(0, 0, 1 + LIFT))).toBeLessThan(1e-5);
    expect(stripVertex(geo, 0, 0).distanceTo(new THREE.Vector3(0, 0, 1 + LIFT))).toBeGreaterThan(3);
    expect(cubieKicks.get('1,1,2').amp).toBeGreaterThanOrEqual(0.2);
  });
});

describe('ChaosStorm wormhole surges', () => {
  it('runs a flip down its wormhole to the twin, lights the tunnel, and ends', async () => {
    const store = await mount();
    const { events } = chaosStormEvents({ flips: [[1, 1, 2, 'PZ']] }, cubies, SIZE, map, 6);
    const [charge] = events;
    pushChaosStormEvents(events);
    step(store);
    // The tunnel renderers read the same clock.
    expect(tunnelCharges.get(charge.pairId)).toMatchObject({ fromGridId: charge.from.gridId, kind: 'birth' });

    const geo = stripGeometry(store);
    // The sheath is marked x-ray: most of the surge runs inside the cube.
    expect(geo.attributes.aXray.array[0]).toBe(1);
    // Its route starts at the struck tile's mouth and ends at the twin's.
    const start = stripVertex(geo, 0, 0);
    const end = stripVertex(geo, 0, STRIP_POINTS - 1);
    expect(start.distanceTo(new THREE.Vector3(0, 0, 1.5))).toBeLessThan(1e-5);
    const twinRef = refs[idx(charge.to.x, charge.to.y, charge.to.z)].position;
    expect(end.distanceTo(new THREE.Vector3(twinRef.x, twinRef.y, twinRef.z - 0.5))).toBeLessThan(1e-5);

    // Arrival at the twin kicks it; then the surge crackles out and is pruned.
    for (let i = 0; i < 40; i++) step(store);
    expect(cubieKicks.has(`${charge.to.x},${charge.to.y},${charge.to.z}`)).toBe(true);
    for (let i = 0; i < 40; i++) step(store);
    expect(tunnelCharges.size).toBe(0);
    expect(usedStrips(geo)).toBe(0);
  });
});
