// Chaos launch order. Mobi's intro used to play over whatever cube the last mode
// left (usually a plain 3×3), and the player's size, style and scene only arrived
// once the scramble began. Now the chosen cube is built before the intro, and
// after the scramble the round waits for the player to aim the first strike.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDisparityGame } from '../hooks/useDisparityGame.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';

let root, host, before, calls;
// The hook's latest return value, published by the harness each render.
const out = { current: null };

function Harness(props) {
  out.current = useDisparityGame(props);
  return null;
}

const WIZARD = {
  cubeSize: 5, visualMode: 'neon', backgroundTheme: 'forest', colorScheme: 'standard',
  disparityLevel: 3, flipCap: 8, gameLength: 'short', flipMode: true, showTunnels: true
};

beforeEach(async () => {
  vi.useFakeTimers();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  before = useGameStore.getState();
  useGameStore.setState({ size: 3, cubies: makeCubies(3), chaosIgnition: null, chaosIgnitionPicking: false, activeBet: null });
  calls = { intro: null, shuffleDone: null, visualMode: null, settings: null, tunnels: null };
  const props = {
    settings: { ...before.settings, backgroundTheme: 'blackhole' },
    setSettings: (s) => { calls.settings = s; },
    changeSize: (n) => useGameStore.getState().setSize(n),
    reset: () => useGameStore.getState().setRotatedCubies(makeCubies(useGameStore.getState().size)),
    cancelShuffle: vi.fn(),
    startAnimatedShuffle: (_moves, done) => { calls.shuffleDone = done; },
    setChaosLevel: vi.fn(),
    setVisualMode: (m) => { calls.visualMode = m; },
    setFlipMode: vi.fn(),
    setShowTunnels: (v) => { calls.tunnels = v; },
    launchWithMobi: (_lines, _name, post) => {
      // What the player sees under the intro.
      calls.intro = { size: useGameStore.getState().size, visualMode: calls.visualMode, scene: calls.settings?.backgroundTheme, post };
    },
    mobiLines: []
  };
  host = document.createElement('div');
  root = createRoot(host);
  await act(async () => root.render(<Harness {...props} />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  vi.useRealTimers();
  useGameStore.setState(before, true);
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

const launch = async () => {
  await act(async () => out.current.handleDisparitySetupComplete(WIZARD));
  await act(async () => out.current.handleBetSkipped());
};

describe('chaos launch', () => {
  it('builds the chosen cube before Mobi’s intro plays', async () => {
    await launch();
    expect(calls.intro).toMatchObject({ size: 5, visualMode: 'neon', scene: 'forest' });
    expect(useGameStore.getState().cubies).toHaveLength(5);
    expect(calls.tunnels).toBe(true);
  });

  it('waits for the first-strike pick after the scramble, then counts down', async () => {
    await launch();
    await act(async () => calls.intro.post());
    await act(async () => { vi.advanceTimersByTime(60); });
    expect(useGameStore.getState().size).toBe(5);
    expect(out.current.ignitionPicking).toBe(false);
    await act(async () => calls.shuffleDone());
    expect(out.current.ignitionPicking).toBe(true);
    expect(useGameStore.getState().chaosIgnitionPicking).toBe(true);
    expect(out.current.disparityCountdown).toBeNull();

    // "Strike here" needs a pick.
    await act(async () => out.current.confirmIgnition());
    expect(out.current.disparityCountdown).toBeNull();

    await act(async () => useGameStore.getState().setChaosIgnition({ x: 4, y: 2, z: 4, dirKey: 'PZ', gridId: 'M1-013' }));
    await act(async () => out.current.confirmIgnition());
    expect(out.current.ignitionPicking).toBe(false);
    expect(useGameStore.getState().chaosIgnitionPicking).toBe(false);
    expect(out.current.disparityCountdown).toBe(3);
    expect(useGameStore.getState().chaosIgnition.gridId).toBe('M1-013');
  });

  it('"Surprise me" aims at a real tile and counts down at once', async () => {
    await launch();
    await act(async () => calls.intro.post());
    await act(async () => { vi.advanceTimersByTime(60); });
    await act(async () => calls.shuffleDone());
    await act(async () => out.current.surpriseIgnition());
    const pick = useGameStore.getState().chaosIgnition;
    expect(pick.gridId).toMatch(/^M[1-6]-\d{3}$/);
    expect(useGameStore.getState().cubies[pick.x][pick.y][pick.z].stickers[pick.dirKey]).toBeTruthy();
    expect(out.current.disparityCountdown).toBe(3);
  });

  it('cancelling a run drops the pick and the prompt', async () => {
    await launch();
    await act(async () => calls.intro.post());
    await act(async () => { vi.advanceTimersByTime(60); });
    await act(async () => calls.shuffleDone());
    await act(async () => useGameStore.getState().setChaosIgnition({ x: 0, y: 0, z: 4, dirKey: 'PZ', gridId: 'M1-001' }));
    await act(async () => out.current.cancelDisparityRun());
    expect(out.current.ignitionPicking).toBe(false);
    expect(useGameStore.getState().chaosIgnitionPicking).toBe(false);
    expect(useGameStore.getState().chaosIgnition).toBeNull();
  });

  it('leaving mid-pick drops the prompt and its aim, and a stale press launches nothing', async () => {
    await launch();
    await act(async () => calls.intro.post());
    await act(async () => { vi.advanceTimersByTime(60); });
    await act(async () => calls.shuffleDone());
    await act(async () => useGameStore.getState().setChaosIgnition({ x: 0, y: 0, z: 4, dirKey: 'PZ', gridId: 'M1-001' }));
    // Every Home path resets the session (handleBackToMainMenu); none of them has
    // to know the pick exists for it to go away.
    await act(async () => {
      useGameStore.getState().resetGame();
      useGameStore.getState().clearDisparityGame();
    });
    expect(out.current.ignitionPicking).toBe(false);
    expect(useGameStore.getState().chaosIgnition).toBeNull();
    await act(async () => out.current.surpriseIgnition());
    await act(async () => out.current.confirmIgnition());
    expect(out.current.disparityCountdown).toBeNull();
    expect(useGameStore.getState().chaosIgnition).toBeNull();
  });

  it('while aiming, the board cannot be turned or shuffled from the keyboard', async () => {
    const { selectCubeInputBlocked, BLOCKING_FLAGS, MODAL_SURFACES } = await import('../hooks/uiSurfaces.js');
    // Nothing else owns the screen: the menu is closed and play is live.
    useGameStore.setState({ ...Object.fromEntries([...BLOCKING_FLAGS, ...MODAL_SURFACES.map((m) => m.flag)].map((k) => [k, false])), victory: null });
    await launch();
    await act(async () => calls.intro.post());
    await act(async () => { vi.advanceTimersByTime(60); });
    expect(selectCubeInputBlocked(useGameStore.getState())).toBe(false);
    await act(async () => calls.shuffleDone());
    expect(selectCubeInputBlocked(useGameStore.getState())).toBe(true);
    await act(async () => out.current.surpriseIgnition());
    expect(selectCubeInputBlocked(useGameStore.getState())).toBe(false);
  });

  it('the guided demo still goes straight to the countdown', async () => {
    await act(async () => out.current.startDisparityGame(WIZARD));
    await act(async () => { vi.advanceTimersByTime(60); });
    await act(async () => calls.shuffleDone());
    expect(out.current.ignitionPicking).toBe(false);
    expect(out.current.disparityCountdown).toBe(3);
  });
});
