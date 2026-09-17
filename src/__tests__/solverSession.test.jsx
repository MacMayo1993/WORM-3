import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { useKociembaSolver } from '../teach/useKociembaSolver.js';
import { selectSolveModeVisible } from '../teach/solverSession.js';

const { solve } = vi.hoisted(() => ({ solve: vi.fn() }));
vi.mock('kociemba-wasm', () => ({ solve }));

const state = () => useGameStore.getState();
let root, host, solver;
function Solver() {
  const cubies = useGameStore(s => s.cubies);
  const api = useKociembaSolver(cubies, 3);
  useEffect(() => { solver = api; }, [api]);
  return <div>Solver</div>;
}
function Session() {
  const visible = useGameStore(selectSolveModeVisible);
  return visible ? <Solver /> : null;
}
function mount() {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<Session />));
}
const tick = ms => act(async () => {
  await vi.advanceTimersByTimeAsync(ms);
  await vi.dynamicImportSettled();
});
const expectCleared = () => {
  expect(state()).toMatchObject({
    solveModeActive: false, solveFocusedStep: null,
    solveHighlights: [], kociembaLayerHighlight: null,
  });
};

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  solve.mockReset().mockResolvedValue('R U');
  useGameStore.setState({
    showMainMenu: false, demoMode: false, demoStep: null,
    solveModeActive: true, solveFocusedStep: 'pll',
    solveHighlights: [{ x: 0, y: 0, z: 0 }],
    kociembaLayerHighlight: { axis: 'col', sliceIndex: 2, dir: 1 },
    cubies: makeCubies(3), size: 3, animState: null, pendingMove: null,
    rotationEpoch: 0, lastRotation: null,
  });
});
afterEach(() => {
  if (root) act(() => root.unmount());
  host?.remove();
  root = host = null;
  vi.useRealTimers();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

describe('solver session boundaries', () => {
  it.each(['menu', 'demo', 'exit-demo', 'close'])('clears all solver state on %s', exit => {
    if (exit === 'menu') state().setShowMainMenu(true);
    if (exit === 'demo') state().startDemo();
    if (exit === 'exit-demo') state().exitDemo();
    if (exit === 'close') state().setSolveModeActive(false);
    expectCleared();
  });

  it('does not restore the solver when leaving the menu for Demo or another puzzle', () => {
    state().setShowMainMenu(true);
    state().startDemo();
    expectCleared();
    expect(selectSolveModeVisible(state())).toBe(false);
    state().exitDemo();
    state().setShowMainMenu(false);
    expect(selectSolveModeVisible(state())).toBe(false);
    state().setSolveModeActive(true);
    expect(selectSolveModeVisible(state())).toBe(true);
  });

  it('hides stale active flags on both menu and demo screens', () => {
    expect(selectSolveModeVisible({ ...state(), showMainMenu: true })).toBe(false);
    expect(selectSolveModeVisible({ ...state(), demoMode: true })).toBe(false);
  });

  it.each(['resolve', 'reject'])('ignores a late solver %s after returning to the menu', async outcome => {
    let resolve, reject;
    solve.mockReturnValue(new Promise((yes, no) => { resolve = yes; reject = no; }));
    mount();
    await tick(160);
    expect(solve).toHaveBeenCalledTimes(1);
    act(() => state().setShowMainMenu(true));
    expect(host.textContent).toBe('');
    expectCleared();
    act(() => state().startDemo());
    // Simulate the demo's own guide acquiring the shared preview channel.
    const demoHighlight = { axis: 'row', sliceIndex: 0, dir: -1 };
    act(() => state().setKociembaLayerHighlight(demoHighlight));
    await act(async () => {
      if (outcome === 'resolve') resolve('R U');
      else reject(new Error('late solver failure'));
    });
    expect(state().kociembaLayerHighlight).toEqual(demoHighlight);
    expect(state().pendingMove).toBeNull();
  });

  it('cancels queued playback when the solver closes', async () => {
    mount();
    await tick(160);
    expect(solver.status).toBe('ready');
    act(() => solver.play());
    expect(state().pendingMove).not.toBeNull();
    act(() => state().clearAnimation());
    act(() => state().setShowMainMenu(true));
    await tick(1000);
    expect(state().pendingMove).toBeNull();
    expectCleared();
  });

  it('cancels a queued reset before unmount', async () => {
    mount();
    await tick(160);
    act(() => { solver.reset(); state().setShowMainMenu(true); });
    await tick(1000);
    expect(solve).toHaveBeenCalledTimes(1);
    expectCleared();
  });
});
