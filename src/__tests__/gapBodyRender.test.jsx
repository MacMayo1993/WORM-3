import React, { act } from 'react';
import { expect, it, vi } from 'vitest';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { WormBody } from '../worm/healerWorm/WormBody.jsx';
import { WormFace } from '../worm/healerWorm/WormFace.jsx';
import { makeGapLabWorm } from '../worm/dev/gapLabAdapter.js';
import { makeGapTraversal, advanceGap, setReachHeld, sampleGapBodyInto } from '../worm/traversal/gapTraversal.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { wormSegments } from '../worm/wormSegments.js';
import { BODY_BALL_SPACING } from '../worm/healerWorm/constants.js';
extend(THREE);
it('renders every body segment on the conserved path through reach, sag and pull', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const traversal = makeGapTraversal({ landingHeight: -.3 });
  const worm = makeGapLabWorm(traversal);
  useGameStore.setState({ wormAlive: true, wormPaused: false, wormCharacter: 'classic', wormColor: '#55dd88', wormGamePhase: 'active' });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  let state;
  const seen = new Set(), p = new THREE.Vector3(), n = new THREE.Vector3(), f = new THREE.Vector3(), actual = new THREE.Vector3(), previous = new THREE.Vector3();
  try {
    await act(async () => { state = root.render(<><WormBody worm={worm} size={3}/><WormFace worm={worm} size={3}/></>); });
    setReachHeld(traversal, true);
    for (let frame = 0; frame < 160; frame++) {
      advanceGap(traversal, 1 / 60); state.getState().advance((frame + 1) / 60); seen.add(traversal.phase);
      expect(wormSegments.count).toBe(traversal.segments);
      for (let i = 0; i < wormSegments.count; i++) {
        sampleGapBodyInto(traversal, i * BODY_BALL_SPACING, p, n, f);
        actual.fromArray(wormSegments.positions, i * 3);
        expect(actual.distanceTo(p)).toBeLessThan(.00001);
        if (i) expect(actual.distanceTo(previous)).toBeLessThanOrEqual(BODY_BALL_SPACING + .00001);
        previous.copy(actual);
      }
    }
    expect([...seen]).toEqual(expect.arrayContaining(['reach', 'latch', 'pull', 'complete']));
  } finally {
    await act(async () => root.unmount()); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
