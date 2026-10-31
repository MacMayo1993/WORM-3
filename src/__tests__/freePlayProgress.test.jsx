import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../utils/feel.js', async original => ({ ...(await original()), feel: vi.fn() }));
import { feel } from '../utils/feel.js';
import { freePlayProgress } from '../worm/freePlayProgress.js';
import FreePlayProgress from '../worm/FreePlayProgress.jsx';
import { useGameStore } from '../hooks/useGameStore.js';
import { wormBuffs } from '../worm/wormBuffs.js';

// Free play shows where the run stands: slice turns still to come, then the pairs
// left to heal, with the final heal and the last pair called out.
describe('what the chip says', () => {
  it('counts turns, then pairs, then calls out the last pair', () => {
    expect(freePlayProgress({ phase: 'active', turnsLeft: 12, openPairs: 3 })).toMatchObject({ kind: 'turns', value: '12' });
    expect(freePlayProgress({ phase: 'active', turnsLeft: 1, openPairs: 3 }).label).toBe('Last turn');
    expect(freePlayProgress({ phase: 'finalHealing', turnsLeft: 0, openPairs: 3 })).toMatchObject({ kind: 'final', value: '3 pairs' });
    expect(freePlayProgress({ phase: 'finalHealing', turnsLeft: 0, openPairs: 1 })).toMatchObject({ kind: 'last', label: 'Last pair' });
    expect(freePlayProgress({ phase: 'finalHealing', turnsLeft: 0, openPairs: 0 })).toBeNull();
    expect(freePlayProgress({ phase: 'active', turnsLeft: null, openPairs: 2 })).toBeNull();
    expect(freePlayProgress({ phase: 'solved', turnsLeft: 0, openPairs: 0 })).toBeNull();
  });
});

describe('the chip', () => {
  let root, host, before;
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.mocked(feel).mockClear();
    before = useGameStore.getState();
    useGameStore.setState({ wormHealerMode: true, wormAlive: true, wormStoryLevel: null, demoMode: false, wormCombatMode: false,
      wormGamePhase: 'active', wormTurnsLeft: 5, wormOpenPairs: 2 });
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); useGameStore.setState(before, true); delete globalThis.IS_REACT_ACT_ENVIRONMENT; });

  it('pops on each change and chimes into the final heal and the last pair', () => {
    act(() => root.render(<FreePlayProgress />));
    const chip = () => host.querySelector('.worm-progress-chip');
    expect(chip().textContent).toBe('Turns left5');
    act(() => useGameStore.setState({ wormTurnsLeft: 4 }));
    expect(chip().classList.contains('is-popping')).toBe(true);
    expect(feel).not.toHaveBeenCalled();
    act(() => useGameStore.setState({ wormGamePhase: 'finalHealing', wormTurnsLeft: 0 }));
    expect(chip().dataset.kind).toBe('final');
    act(() => useGameStore.setState({ wormOpenPairs: 1 }));
    expect(chip().dataset.kind).toBe('last');
    expect(vi.mocked(feel).mock.calls.map(([e]) => e)).toEqual(['storyTask', 'storyTask']);
    act(() => useGameStore.setState({ wormOpenPairs: 0 }));
    expect(chip()).toBeNull();
  });

  it('stays out of Story, the demo and combat', () => {
    for (const patch of [{ wormStoryLevel: 4 }, { demoMode: true }, { wormCombatMode: true }]) {
      act(() => useGameStore.setState({ wormStoryLevel: null, demoMode: false, wormCombatMode: false, ...patch }));
      act(() => root.render(<FreePlayProgress />));
      expect(host.querySelector('.worm-progress-chip')).toBeNull();
    }
  });
});

describe('the way to the nearest pair', () => {
  let root, host, before;
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.useFakeTimers();
    before = useGameStore.getState();
    useGameStore.setState({ wormHealerMode: true, wormAlive: true, wormStoryLevel: null, demoMode: false, wormCombatMode: false,
      wormGamePhase: 'finalHealing', wormTurnsLeft: 0, wormOpenPairs: 2 });
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount()); host.remove(); useGameStore.setState(before, true);
    wormBuffs.guide = null; vi.useRealTimers(); delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('follows the guide in the final heal, and only there', () => {
    act(() => root.render(<FreePlayProgress />));
    const heading = () => host.querySelector('.worm-progress-guide');
    expect(heading()).toBeNull();
    wormBuffs.guide = { kind: 'pair', final: true, turn: 'left', steps: 6 };
    act(() => vi.advanceTimersByTime(200));
    expect(heading().dataset.turn).toBe('left');
    expect(heading().textContent).toContain('Left · 6 tiles');
    expect(heading().getAttribute('aria-live')).toBe('off');
    expect(host.querySelector('.worm-progress-guide-label').textContent).toBe('Nearest open pair: turn left, 6 tiles');
    // Before the final heal the chip counts turns and the beams speak for themselves.
    wormBuffs.guide = { kind: 'orb', final: false, turn: 'right', steps: 4 };
    act(() => vi.advanceTimersByTime(200));
    expect(heading()).toBeNull();
  });
});
