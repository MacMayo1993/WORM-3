import React, { act } from 'react';
import { expect, it, vi } from 'vitest';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { WormBody } from '../worm/healerWorm/WormBody.jsx';
import { makeWormSim, resetWormSim, evaluatePosAndNormal } from '../worm/healerWorm/wormSim.js';
import { tickExpansion } from '../worm/healerWorm/expansion.js';
import { wormExpansion, EXPLODE_AMOUNT } from '../worm/wormExpansion.js';
import { shPush, shReset } from '../worm/circularBuffers.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { wormSegments } from '../worm/wormSegments.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { cubeExpansionScale } from '../game/cubeWorldGeometry.js';
import { WORM_LIFT, FACE_NORMALS } from '../worm/healerWorm/constants.js';

extend(THREE);

it.each(['classic', 'wiggle', 'inch', 'mobi'])('keeps the rendered %s body connected while the gaps open and close', async character => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = useGameStore.getState();
  const sim = makeWormSim(5);
  resetWormSim(sim, 5, { orbCount: 0 });
  Object.assign(sim, { phase: 'crawling', tailLength: 40, explodeT: 12, prevWorldPos: null });
  sim.pos = { x: 4, y: 4, z: 2, dirKey: 'PY' };
  sim.curWorldPos.fromArray(getStickerWorldPos(4, 4, 2, 'PY', 5));
  sim.headInterpPos.copy(sim.curWorldPos);
  sim.currentNormal.copy(FACE_NORMALS.PY);
  shReset(sim.stepHistory);
  const point = sim.curWorldPos.clone().addScaledVector(FACE_NORMALS.PY, WORM_LIFT);
  for (let i = 0; i <= 200; i++) {
    point.x = -2 + i / 50;
    shPush(sim.stepHistory, point, FACE_NORMALS.PY, Math.round(point.x + 2), 4, 2);
  }
  const worm = Object.fromEntries(Object.keys(sim).map(key => [key, { get current() { return sim[key]; } }]));
  for (const key of ['orbPickupColors', 'orbPickupFaceIds', 'colorEpoch']) worm[`${key}Ref`] = worm[key];
  useGameStore.setState({ wormAlive: true, wormPaused: true, wormCharacter: character, wormGamePhase: 'active' });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {}, renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  let deepest = 0;
  try {
    let state;
    await act(async () => { state = root.render(<WormBody worm={worm} size={5}/>); });
    for (let frame = 0; frame < 50; frame++) {
      if (frame === 25) sim.explodeT = 0;
      tickExpansion(sim, 5, 0.05, { onExpansionAmount: amount => { wormExpansion.amount = amount; } });
      evaluatePosAndNormal(sim, 1, sim.headInterpPos);
      state.getState().advance(frame / 60);
      // Mobi draws one block for every three logical body beads.
      expect(wormSegments.count).toBe(character === 'mobi' ? 14 : 40);
      const deck = 2 * cubeExpansionScale(5, sim.expansionAmount) + 0.5;
      for (let i = 1; i < wormSegments.count; i++) {
        const a = new THREE.Vector3().fromArray(wormSegments.positions, (i - 1) * 3);
        const b = new THREE.Vector3().fromArray(wormSegments.positions, i * 3);
        expect(a.distanceTo(b)).toBeLessThan(character === 'mobi' ? 0.36 : 0.19);
        expect(a.distanceTo(b)).toBeGreaterThan(0.025);
        if (sim.expansionAmount === EXPLODE_AMOUNT) deepest = Math.max(deepest, deck - b.y);
      }
    }
    if (character !== 'inch') expect(deepest).toBeGreaterThan(0.1);
    expect(sim.expansionAmount).toBe(0);
    expect(sim.tailLength).toBe(40);
  } finally {
    await act(async () => root.unmount());
    wormExpansion.amount = 0;
    useGameStore.setState(before, true);
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
