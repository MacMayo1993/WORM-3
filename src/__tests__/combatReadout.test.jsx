import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { CombatCard } from '../worm/combat/CombatControls.jsx';
import { combatBridge, makeCombat, stepCombat } from '../worm/combat/portalCombat.js';

let host, root, previousAlive;
beforeEach(() => {
  vi.useFakeTimers();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  previousAlive = useGameStore.getState().wormAlive;
  useGameStore.setState({ wormAlive: true });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  combatBridge.current = null;
  useGameStore.setState({ wormAlive: previousAlive });
  vi.useRealTimers();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

it.each([null, 'fire'])('hides live wave details after sealing with surviving enemies (infusion: %s)', element => {
  const tile = { x: 2, y: 2, z: 4, dirKey: 'PZ' };
  const c = makeCombat(5, tile);
  Object.assign(c, { started: true, waveSpawned: 3, score: 100, kills: 1, element, elementT: element ? 10 : 0 });
  c.enemies = [1, 2].map(id => ({ id, tile, emerging: 0 }));
  combatBridge.current = c;
  act(() => root.render(<CombatCard />));
  expect(host.textContent).toContain(element ? 'Fire · 10s' : '2 remaining');

  act(() => {
    stepCombat(c, .05, { blocked: false, portalOpen: false, canFinish: true });
    vi.advanceTimersByTime(100);
  });
  expect(c.won).toBe(true);
  expect(c.enemies).toHaveLength(0);
  expect(host.textContent).toContain('PORTAL SEALED');
  expect(host.textContent).toContain('100 pts');
  expect(host.textContent).toContain('1 defeated');
  expect(host.textContent).toContain('Try again');
  expect(host.querySelector('.worm-combat-readout').textContent).not.toMatch(/remaining|Fire/);
});

it('hides the live wave count on death while keeping the final score', () => {
  const c = makeCombat(5, { x: 2, y: 2, z: 4, dirKey: 'PZ' });
  Object.assign(c, { started: true, score: 100 });
  combatBridge.current = c;
  act(() => root.render(<CombatCard />));
  expect(host.textContent).toContain('3 remaining');
  act(() => useGameStore.setState({ wormAlive: false }));
  expect(host.textContent).toContain('Run ended.');
  expect(host.textContent).toContain('100 pts');
  expect(host.querySelector('.worm-combat-readout').textContent).not.toContain('remaining');
});
