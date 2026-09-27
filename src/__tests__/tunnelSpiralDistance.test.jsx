import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { it, expect, vi } from 'vitest';
import MobiusTunnel from '../manifold/MobiusTunnel.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { WORM_PAD_HEIGHT } from '../game/raisedCubie.js';
import { buildTunnelPathForTunnel } from '../worm/wormLogic.js';
import { makeTunnelPath, tunnelPathArcPointInto } from '../utils/tunnelPath.js';
import { makeTunnelRideFrame, tunnelRideFrameInto } from '../utils/tunnelRide.js';

extend(THREE);

it.each([
  ['ordinary', false, false, false], ['styled', false, false, true],
  ['raised', false, true, false], ['WORM', true, false, false]
])('uses actual shared arc distances on asymmetric %s ribbons', async (_name, wormMode, raised, styled) => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState(), size = 5;
  useGameStore.setState({ size, wormHealerMode: wormMode, wormAlive: true, wormPaused: false, perfReducedFX: false,
    settings: { ...before.settings, reducedMotion: true } });
  const entry = { x: 4, y: 4, z: 4, dirKey: 'PY' }, exit = { x: 2, y: 2, z: 0, dirKey: 'NZ' };
  const refs = [], index = cell => cell.x * size * size + cell.y * size + cell.z;
  for (const cell of [entry, exit]) {
    const mesh = new THREE.Object3D();
    mesh.position.set(cell.x - 2, cell.y - 2, cell.z - 2);
    refs[index(cell)] = mesh;
  }
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  try {
    let store;
    await act(async () => { store = root.render(<MobiusTunnel meshIdx1={index(entry)} meshIdx2={index(exit)}
      dirKey1={entry.dirKey} dirKey2={exit.dirKey} cubieRefs={refs} tunnelId="spiral-distance" flips={1}
      color1="#3973e8" color2="#38c875" raisedPresentation={raised}
      style1={styled ? 'checkerboard' : 'solid'} style2={styled ? 'circuit' : 'solid'} />); });
    store.getState().advance(1 / 60);
    const scene = store.getState().scene, spine = scene.children[0].children[0].geometry;
    const veil = scene.getObjectByName('tunnel-open-veil').geometry;
    if (styled) for (const side of [0, 1]) {
      expect(scene.getObjectByName(`tunnel-styled-half-${side}`).geometry).toBe(spine);
    }
    const continuous = wormMode || raised;
    const path = buildTunnelPathForTunnel(makeTunnelPath(), { entry, exit, padExpansion: 0, padHeight: wormMode ? WORM_PAD_HEIGHT : 0 }, size);
    expect(Math.abs(path.armALen - path.armBLen)).toBeGreaterThan(0.5);
    const segments = spine.attributes.position.count / 2 - 1;
    const stride = veil.attributes.position.count / (segments + 1), sideVerts = stride / 2;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), expected = new THREE.Vector3(), frame = makeTunnelRideFrame();
    for (let i = 0; i <= segments; i++) {
      const arc = spine.attributes.aDistance.getX(i * 2);
      // Independently sample the path at the supplied distance: this must be
      // the exact physical cross-section represented by these vertices.
      if (continuous) expected.copy(tunnelRideFrameInto(frame, path, arc).floor);
      else tunnelPathArcPointInto(expected, path, arc);
      a.fromBufferAttribute(spine.attributes.position, i * 2);
      b.fromBufferAttribute(spine.attributes.position, i * 2 + 1);
      expect(a.lerp(b, 0.5).distanceTo(expected)).toBeLessThan(1e-6);
      for (const side of [0, 1]) {
        expect(spine.attributes.aDistance.getX(i * 2 + side)).toBe(arc);
        const weld = i * stride + side * sideVerts;
        expect(veil.attributes.aRibbonU.getX(weld)).toBeCloseTo(spine.attributes.uv.getX(i * 2 + side), 10);
        for (let j = 0; j < sideVerts; j++) expect(veil.attributes.aDistance.getX(weld + j)).toBe(arc);
      }
    }
    expect(spine.attributes.aDistance.getX(0)).toBe(0);
    expect(spine.attributes.aDistance.getX(segments * 2)).toBeCloseTo(path.total, 5);
    if (!continuous) {
      const dockA = segments, dockB = segments + 2;
      // These UVs collapse to the same Float32 value, but the hidden crossing
      // must still separate their arc distances and spiral phases.
      expect(spine.attributes.uv.getY(dockA)).toBe(0.5);
      expect(spine.attributes.uv.getY(dockB)).toBe(0.5);
      expect(spine.attributes.aDistance.getX(dockA)).toBeCloseTo(path.armALen, 5);
      expect(spine.attributes.aDistance.getX(dockB)).toBeCloseTo(path.total - path.armBLen, 5);
      expect(spine.attributes.aDistance.getX(dockB) - spine.attributes.aDistance.getX(dockA)).toBeGreaterThan(0.3);
    }
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState(before, true);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
