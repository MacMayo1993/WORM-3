import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { it, expect, vi } from 'vitest';
import { TunnelTube } from '../worm/healerWorm/TunnelTube.jsx';
import { buildTunnelPathForTunnel } from '../worm/wormLogic.js';
import { makeTunnelPath, tunnelPathTToArc, tunnelBoreRadiusAt } from '../utils/tunnelPath.js';
import { makeTunnelRideFrame, tunnelRideFrameInto } from '../utils/tunnelRide.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { tunnelState } from '../worm/tunnelProgressBridge.js';

extend(THREE);

it.each([3, 7, 15])('keeps depth arches on rider frames and continuous across reverse/tail visits on size %s', async size => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  const bridge = { ...tunnelState, occupiedTunnelIds: new Set(tunnelState.occupiedTunnelIds) };
  const entry = { x: size - 1, y: size - 1, z: size - 1, dirKey: 'PY' };
  const exit = { x: Math.floor(size / 2), y: Math.floor(size / 2), z: 0, dirKey: 'NZ' };
  const tunnel = { entry, exit, pairId: 'arches', entryColor: 0, exitColor: 1 };
  const reverse = { ...tunnel, entry: exit, exit: entry };
  const worm = { activeTunnel: { current: tunnel }, tunnelPassages: { current: [] },
    phase: { current: 'entering' }, tunnelProgress: { current: 0.4 } };
  useGameStore.setState({ size, wormAlive: true, wormPaused: false,
    settings: { ...before.settings, reducedMotion: false } });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  try {
    let store, time = 0;
    await act(async () => { store = root.render(<TunnelTube worm={worm} size={size} />); });
    const frame = () => act(async () => { store.getState().advance(time += 1 / 60); });
    await frame(); await frame(); await frame();
    const mesh = store.getState().scene.getObjectByName('tunnel-depth-arches');
    expect(mesh.visible).toBe(true);
    const geo = mesh.geometry, positions = geo.attributes.position, uv = geo.attributes.uv;
    const distances = geo.attributes.aDistance;
    const path = buildTunnelPathForTunnel(makeTunnelPath(), tunnel, size);
    const ride = makeTunnelRideFrame(), a = new THREE.Vector3(), b = new THREE.Vector3();
    const sides = 24, rings = positions.count / (sides + 1) - 1;
    let previous = -1;
    for (let i = 0; i <= rings; i++) {
      const start = i * (sides + 1), arc = distances.getX(start), t = uv.getY(start);
      expect(arc).toBeGreaterThan(previous); previous = arc;
      expect(tunnelPathTToArc(path, t)).toBeCloseTo(arc, 5);
      tunnelRideFrameInto(ride, path, arc);
      a.fromBufferAttribute(positions, start); b.fromBufferAttribute(positions, start + sides / 2);
      expect(a.clone().add(b).multiplyScalar(0.5).distanceTo(ride.center)).toBeLessThan(2e-6);
      expect(a.clone().sub(ride.center).normalize().distanceTo(ride.normal)).toBeLessThan(2e-5);
      expect(a.distanceTo(ride.center)).toBeCloseTo(tunnelBoreRadiusAt(t), 5);
      b.fromBufferAttribute(positions, start + sides);
      expect(a.distanceTo(b)).toBeLessThan(1e-7);
      for (let j = 0; j <= sides; j++) expect(distances.getX(start + j)).toBe(arc);
    }
    expect(distances.getX(0)).toBe(0);
    expect(distances.getX(rings * (sides + 1))).toBeCloseTo(path.total, 5);
    const version = positions.version, uniforms = mesh.material.uniforms;
    await frame();
    expect(positions.version).toBe(version);
    const tick = uniforms.uTime.value;
    useGameStore.setState({ wormPaused: true }); await frame();
    expect(uniforms.uTime.value).toBe(tick);
    useGameStore.setState({ wormPaused: false, settings: { ...before.settings, reducedMotion: true } }); await frame();
    expect(uniforms.uTime.value).toBe(tick);
    worm.tunnelPassages.current = [{ tunnel }];
    worm.activeTunnel.current = reverse;
    worm.phase.current = 'entering'; worm.tunnelProgress.current = 0;
    await frame();
    expect(uniforms.uDirection.value).toBe(-1);
    expect(uniforms.uHead.value).toBeCloseTo(path.total, 8);
    expect(positions.version).toBe(version);
    expect(store.getState().scene.children.filter(child => child.name === 'tunnel-depth-arches')).toHaveLength(1);
    worm.activeTunnel.current = null; worm.phase.current = 'crawling';
    for (let i = 0; i < 10; i++) await frame();
    expect(mesh.visible).toBe(true);
    expect(uniforms.uOpacity.value).toBeGreaterThan(0.5);
    expect(positions.version).toBe(version);
    expect(tunnelState.occupiedTunnelIds.has('arches')).toBe(true);
    expect(mesh.material.depthWrite).toBe(false);
    expect(mesh.material.side).toBe(THREE.FrontSide);
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true);
    Object.assign(tunnelState, bridge);
  }
});
