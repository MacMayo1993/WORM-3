import React, { act } from 'react';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import CombatScene from '../worm/combat/CombatScene.jsx';
import { combatBridge, makeCombat, makeEnemy } from '../worm/combat/portalCombat.js';

extend(THREE);

it.each(['clear', 'replace'])('hides allocated enemy rigs when the combat bridge changes mid-frame: %s', async mode => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const before = combatBridge.current;
  const canvas = document.createElement('canvas');
  const gl = { render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: canvas,
    xr: { addEventListener: vi.fn(), removeEventListener: vi.fn() }, shadowMap: {},
    renderLists: { dispose: vi.fn() }, forceContextLoss: vi.fn() };
  const root = createRoot(canvas);
  await root.configure({ gl, frameloop: 'never', size: { width: 400, height: 700 } });
  const combat = makeCombat(5, { x: 2, y: 2, z: 4, dirKey: 'PZ' });
  const enemy = makeEnemy(combat); enemy.emerging = 0; combat.enemies.push(enemy);
  combatBridge.current = combat;
  try {
    let store;
    await act(async () => { store = root.render(<CombatScene maxEnemies={1} />); });
    const state = store.getState();
    // Run the actual renderer subscriptions in their declared priority bands.
    // The game scheduler can reset the bridge between these two bands when a
    // selected scene is staged, before React removes the old combat renderer.
    const allocate = () => state.internal.subscribers.filter(s => s.priority < 0)
      .forEach(s => s.ref.current(state, 1 / 60));
    const renderRigs = () => state.internal.subscribers.filter(s => s.priority >= 0)
      .forEach(s => s.ref.current(state, 1 / 60));
    const rigs = state.scene.children[0].children.slice(3, 7);
    expect(rigs).toHaveLength(4);
    allocate(); renderRigs();
    expect(rigs.filter(rig => rig.visible)).toHaveLength(1);

    allocate(); // Old enemy remains in the slot for this frame.
    const replacement = makeCombat(7, { x: 1, y: 1, z: 6, dirKey: 'PZ' });
    const nextEnemy = makeEnemy(replacement); nextEnemy.emerging = 0;
    replacement.enemies.push(nextEnemy);
    // Fresh combat deliberately reuses enemy IDs, so an ID-only guard fails.
    expect(nextEnemy.id).toBe(enemy.id);
    combatBridge.current = mode === 'clear' ? null : replacement;
    expect(renderRigs).not.toThrow();
    expect(rigs.every(rig => !rig.visible)).toBe(true);
    expect(renderRigs).not.toThrow(); // Remains hidden until allocation catches up.
    expect(rigs.every(rig => !rig.visible)).toBe(true);

    allocate(); renderRigs();
    expect(rigs.filter(rig => rig.visible)).toHaveLength(mode === 'clear' ? 0 : 1);
    if (mode === 'replace') {
      expect(rigs.find(rig => rig.visible).position.toArray().every(Number.isFinite)).toBe(true);
    }
  } finally {
    await act(async () => root.unmount());
    combatBridge.current = before;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
