// Chaos launch order. Mobi's intro used to play over whatever cube the last mode
// left (usually a plain 3×3), and the player's size, style and scene only arrived
// once the scramble began. Now the chosen cube is built before the intro, and
// after the scramble the round waits for the player to aim the first strike.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDisparityGame } from '../hooks/useDisparityGame.js';
import { useCubeState } from '../hooks/useCubeState.js';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';

let root, host, before, calls;
// The hook's latest return value, published by the harness each render.
const out = { current: null };

function Harness(props) {
  // Use the actual cube callbacks: Mobi retains the launch callback from before
  // the chosen size is installed, which a getState()-based reset stub hid.
  const { changeSize, reset } = useCubeState();
  out.current = useDisparityGame({ ...props, changeSize, reset });
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
    cancelShuffle: vi.fn(),
    startAnimatedShuffle: (_moves, done) => { calls.shuffleDone = done; },
    setChaosLevel: useGameStore.getState().setChaosLevel,
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

  it.each([
    { cubeSize: 2, wager: true },
    { cubeSize: 3, wager: false },
    { cubeSize: 5, wager: false },
    { cubeSize: 6, wager: true }
  ])('keeps the $cubeSize×$cubeSize board intact after Mobi and reaches GO (wager: $wager)', async ({ cubeSize, wager }) => {
    await act(async () => out.current.handleDisparitySetupComplete({ ...WIZARD, cubeSize }));
    await act(async () => {
      if (wager) out.current.handleBetPlaced({ type: 'PAIR', pick: 'RO', wager: 50, odds: 2 });
      else out.current.handleBetSkipped();
    });
    await act(async () => calls.intro.post());

    // Check BEFORE the delayed scramble rebuild: the app must survive the
    // render immediately after Mobi dismisses, including smaller/unchanged sizes.
    const { size, cubies } = useGameStore.getState();
    expect(size).toBe(cubeSize);
    expect(cubies).toHaveLength(cubeSize);
    expect(cubies.every(plane => plane.length === cubeSize && plane.every(row => row.length === cubeSize))).toBe(true);
    expect(calls.shuffleDone).toBeNull();

    await act(async () => { vi.advanceTimersByTime(60); });
    await act(async () => calls.shuffleDone());
    expect(out.current.ignitionPicking).toBe(true);
    await act(async () => out.current.surpriseIgnition());
    for (const delay of [900, 900, 900, 600]) {
      await act(async () => { vi.advanceTimersByTime(delay); });
    }
    expect(out.current.disparityCountdown).toBeNull();
    expect(useGameStore.getState().chaosLevel).toBe(WIZARD.disparityLevel);
    expect(useGameStore.getState().cubies).toHaveLength(cubeSize);
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

  it('leaving before GO refunds a wager already stamped for the round', async () => {
    useGameStore.setState({ parityPoints: 1000, activeBet: null });
    const bet = { type: 'PAIR', pick: 'RO', wager: 50, odds: 2 };
    useGameStore.getState().spendCoins(bet.wager);
    await act(async () => out.current.handleDisparitySetupComplete(WIZARD));
    await act(async () => out.current.handleBetPlaced(bet));
    await act(async () => calls.intro.post());
    await act(async () => { vi.advanceTimersByTime(60); });
    await act(async () => calls.shuffleDone());
    // beginDisparityRound stamped it; the PP is gone while the round is armed.
    expect(useGameStore.getState().activeBet.roundId).toBe(useGameStore.getState().disparityRoundId);
    expect(useGameStore.getState().parityPoints).toBe(950);
    // Leave → handleHomeFromGame → cancelDisparityRun.
    await act(async () => out.current.cancelDisparityRun());
    expect(useGameStore.getState().activeBet).toBeNull();
    expect(useGameStore.getState().parityPoints).toBe(1000);
    // Idempotent: a second exit path cannot pay it back twice.
    await act(async () => out.current.cancelDisparityRun());
    expect(useGameStore.getState().parityPoints).toBe(1000);
  });

  it('leaves a live round’s wager to the chaos worker’s own STOP refund', async () => {
    useGameStore.setState({ parityPoints: 1000, activeBet: null });
    const bet = { type: 'PAIR', pick: 'RO', wager: 50, odds: 2 };
    useGameStore.getState().spendCoins(bet.wager);
    await act(async () => out.current.handleDisparitySetupComplete(WIZARD));
    await act(async () => out.current.handleBetPlaced(bet));
    await act(async () => calls.intro.post());
    await act(async () => { vi.advanceTimersByTime(60); });
    // The round went live.
    useGameStore.setState({ chaosLevel: 3 });
    await act(async () => out.current.cancelDisparityRun());
    expect(useGameStore.getState().activeBet).not.toBeNull();
    expect(useGameStore.getState().parityPoints).toBe(950);
  });

  it('the guided demo still goes straight to the countdown', async () => {
    await act(async () => out.current.startDisparityGame(WIZARD));
    await act(async () => { vi.advanceTimersByTime(60); });
    await act(async () => calls.shuffleDone());
    expect(out.current.ignitionPicking).toBe(false);
    expect(out.current.disparityCountdown).toBe(3);
  });
});
