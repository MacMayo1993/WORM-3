import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import ParityOrbs from '../worm/ParityOrb.jsx';
import { PARITY_ORB_GEOMETRIES } from '../worm/parityOrbGeometries.js';
import { getAllSurfaceTiles } from '../worm/healerWorm/surfaceTiles.js';
import { useGameStore } from '../hooks/useGameStore.js';

extend(THREE);
const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff'];
const visibleMeshes = scene => {
  const meshes = [];
  scene.traverseVisible(o => { if (o.isMesh) meshes.push(o); });
  return meshes;
};

it.each([6, 15])('batches a 144-pickup shower on a %s board while keeping its parity silhouette and entrance', async size => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const previousPiP = useGameStore.getState().showAntipodalPiP;
  // Worst-case visibility: no main-camera culling may conceal the draw count.
  useGameStore.setState({ showAntipodalPiP: true });
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {},
    renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  root.configure({ gl, frameloop: 'never', size: { width: 800, height: 600 } });
  const orbs = getAllSurfaceTiles(size).slice(0, 144).map((tile, i) => ({
    ...tile, spawnId: `rain-${i}`, shower: true,
    color: colors[i % 6], antipodalColor: colors[(i + 3) % 6], styleKey: 'solid',
  }));
  let store;
  let frame = 0;
  const render = async data => {
    await act(async () => { store = root.render(<ParityOrbs wormMode size={size} orbs={data} />).getState(); });
  };
  const advance = count => { for (let i = 0; i < count; i++) store.advance(++frame / 60); };
  try {
    await render(orbs.slice(0, 6));
    advance(1);
    const arriving = visibleMeshes(store.scene).filter(o => !o.isInstancedMesh);
    expect(arriving).toHaveLength(24); // four pieces per falling orb, no glass/glow layers
    const falling = arriving[0].parent;
    const initialPosition = falling.position.clone();
    advance(60);
    expect(falling.position.distanceTo(initialPosition)).toBeGreaterThan(1);
    const firstBatchCount = visibleMeshes(store.scene).length;
    expect(firstBatchCount).toBe(24);

    // Add the rest in the production six-orb waves, 0.65 s apart. Even during
    // overlapping entrances, visible mesh submissions stay below 100.
    for (let count = 12; count <= 144; count += 6) {
      await render(orbs.slice(0, count));
      advance(1);
      expect(visibleMeshes(store.scene).length).toBeLessThanOrEqual(72);
      advance(38);
    }
    advance(60);
    const settled = visibleMeshes(store.scene);
    expect(settled).toHaveLength(firstBatchCount);
    expect(settled.every(o => o.isInstancedMesh && !o.material.transparent)).toBe(true);
    expect(settled.reduce((n, o) => n + o.count, 0)).toBe(144 * 4);
    const g = PARITY_ORB_GEOMETRIES.normal;
    expect(new Set(settled.map(o => o.geometry))).toEqual(new Set([g.shell, g.core, g.ringA, g.ringB]));

    // A dense ordinary food field uses the same bounded four-piece batches.
    await render(orbs.slice(0, 90).map(orb => ({ ...orb, shower: false, spawnId: `food-${orb.spawnId}` })));
    advance(60);
    const allFood = visibleMeshes(store.scene);
    expect(allFood.length).toBeLessThanOrEqual(25); // 24 parity batches + one shared beacon
    const food = allFood.filter(o => [g.shell, g.core, g.ringA, g.ringB].includes(o.geometry));
    expect(food).toHaveLength(24);
    expect(food.every(o => o.isInstancedMesh && !o.material.transparent)).toBe(true);
    expect(food.reduce((n, o) => n + o.count, 0)).toBe(90 * 4);
    expect(new Set(food.map(o => o.geometry))).toEqual(new Set([g.shell, g.core, g.ringA, g.ringB]));

    // Removing shower pickups clears their batches; ordinary pickups retain
    // their full glass shell and transparent ring/glow rendering.
    await render([{ ...orbs[0], spawnId: 'ordinary', shower: false }]);
    advance(60);
    expect(visibleMeshes(store.scene).some(o => o.geometry === g.shell && o.material.transparent)).toBe(true);
    await render([]);
    advance(1);
    expect(visibleMeshes(store.scene)).toHaveLength(0);
  } finally {
    await act(async () => root.unmount());
    useGameStore.setState({ showAntipodalPiP: previousPiP });
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
