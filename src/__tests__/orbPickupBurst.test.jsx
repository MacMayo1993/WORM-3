import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { describe, it, expect, vi } from 'vitest';
import OrbPickupBurst from '../worm/healerWorm/OrbPickupBurst.jsx';
import {
  PICKUP_BURST_SECONDS, PICKUP_BASE_SPARKS, PICKUP_MAX_SPARKS, PICKUP_MOTES,
  pickupCore, pickupRing, pickupSpark, pickupMote, pickupSparkCount,
} from '../worm/healerWorm/orbPickupBurst.js';
import { useGameStore } from '../hooks/useGameStore.js';

extend(THREE);
const range = (from, to, step) => { const out = []; for (let t = from; t <= to + 1e-9; t += step) out.push(t); return out; };

describe('orb pickup burst motion', () => {
  it('pops the core past orb size, then swallows it', () => {
    expect(pickupCore(0.05).scale).toBeGreaterThan(0.3);
    expect(pickupCore(0.2).scale).toBeLessThan(0.1);
    expect(pickupCore(0.25)).toBeNull();
  });

  it('runs the shock rings outward along the tile, trailing ring second, wider with a combo', () => {
    expect(pickupRing(1, 0.05)).toBeNull();
    let last = 0;
    for (const t of range(0.02, 0.48, 0.02)) {
      const ring = pickupRing(0, t);
      expect(ring.radius).toBeGreaterThan(last);
      last = ring.radius;
    }
    expect(pickupRing(0, 0.4, 3).radius).toBeGreaterThan(pickupRing(0, 0.4, 0).radius);
    expect(pickupRing(0, 0.4, 99).radius).toBe(pickupRing(0, 0.4, 3).radius);
  });

  it('fans sparks all the way around, keeps them above the face, and slows them to short streaks', () => {
    const count = pickupSparkCount(0);
    expect(count).toBe(PICKUP_BASE_SPARKS);
    expect(pickupSparkCount(10)).toBe(PICKUP_MAX_SPARKS);
    const quadrants = new Set();
    for (let i = 0; i < count; i++) {
      const early = pickupSpark(i, 0.02, count), late = pickupSpark(i, 0.4, count);
      quadrants.add(`${Math.sign(late.position[0])}${Math.sign(late.position[1])}`);
      expect(late.position[2]).toBeGreaterThan(0);
      expect(late.length).toBeLessThan(early.length);
      expect(Math.hypot(...late.direction)).toBeCloseTo(1);
      expect(pickupSpark(i, PICKUP_BURST_SECONDS, count)).toBeNull();
    }
    expect(quadrants.size).toBe(4);
  });

  it('spirals the charge motes up off the head and lets them go', () => {
    for (let i = 0; i < PICKUP_MOTES; i++) {
      const flight = range(0, PICKUP_BURST_SECONDS, 0.01).map(t => pickupMote(i, t)).filter(Boolean);
      expect(flight.length).toBeGreaterThan(20);
      for (let k = 1; k < flight.length; k++) expect(flight[k].position[2]).toBeGreaterThan(flight[k - 1].position[2]);
      expect(pickupMote(i, PICKUP_BURST_SECONDS)).toBeNull();
    }
  });
});

describe('orb pickup burst render', () => {
  const mount = async (props) => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const canvas = document.createElement('canvas');
    const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
      xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
    const root = createRoot(canvas);
    root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
    let store;
    await act(async () => { store = root.render(<OrbPickupBurst {...props} />); });
    return { root, store: store.getState() };
  };

  it('lies flat on the tile it was eaten on, holds through pause, and finishes once', async () => {
    useGameStore.setState({ wormPaused: false });
    const onDone = vi.fn();
    const { root, store } = await mount({ position: [2.5, 0, 0], normal: [1, 0, 0], color: '#33ff66', combo: 2, onDone });
    try {
      const group = store.scene.children[0];
      // The burst's local +z (ring plane normal) is the face's outward normal.
      expect(new THREE.Vector3(0, 0, 1).applyQuaternion(group.quaternion).x).toBeCloseTo(1);
      const sparks = group.children.find(o => o.isInstancedMesh && o.count === PICKUP_MAX_SPARKS);
      const scaleOf = i => { const m = new THREE.Matrix4(); sparks.getMatrixAt(i, m); return new THREE.Vector3().setFromMatrixScale(m).y; };
      // Hidden before the first frame, so a pause on the pickup frame shows nothing stray.
      expect(scaleOf(0)).toBe(0);
      let frame = 1;
      for (; frame <= 6; frame++) store.advance(frame / 60);
      expect(scaleOf(0)).toBeGreaterThan(0);
      // Extra combo sparks are live; sparks past the combo's count stay hidden.
      expect(scaleOf(pickupSparkCount(2) - 1)).toBeGreaterThan(0);
      if (pickupSparkCount(2) < PICKUP_MAX_SPARKS) expect(scaleOf(PICKUP_MAX_SPARKS - 1)).toBe(0);

      useGameStore.setState({ wormPaused: true });
      const held = scaleOf(0);
      for (let i = 0; i < 60; i++) store.advance(frame++ / 60);
      expect(scaleOf(0)).toBe(held);
      expect(onDone).not.toHaveBeenCalled();

      useGameStore.setState({ wormPaused: false });
      for (let i = 0; i < 60; i++) store.advance(frame++ / 60);
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(group.visible).toBe(false);
    } finally {
      await act(async () => root.unmount());
      useGameStore.setState({ wormPaused: false });
    }
  });

  it('drops the travelling layers for reduced motion', async () => {
    const { root, store } = await mount({ position: [0, 0, 0], normal: [0, 0, 1], reducedMotion: true });
    try {
      const group = store.scene.children[0];
      expect(group.children.some(o => o.isInstancedMesh)).toBe(false);
      store.advance(0.1);
      const rings = group.children.filter(o => o.isMesh && o.geometry.type === 'RingGeometry');
      expect(rings.filter(r => r.visible)).toHaveLength(1);
      expect(rings.find(r => r.visible).scale.x).toBeCloseTo(0.45);
    } finally { await act(async () => root.unmount()); }
  });
});
