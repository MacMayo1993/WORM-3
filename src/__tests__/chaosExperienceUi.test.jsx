import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';
import { makeCubies } from '../game/cubeState.js';
import { emptyChaosRecord, recordChaosHealing } from '../game/chaosExperience.js';
import DisparityHUD from '../components/overlays/DisparityHUD.jsx';
import DisparityBettingScreen from '../components/screens/DisparityBettingScreen.jsx';
import DisparityWinnerScreen from '../components/screens/DisparityWinnerScreen.jsx';
import { useDisparityGame } from '../hooks/useDisparityGame.js';
vi.mock('../utils/feel.js', () => ({ feel: vi.fn() }));
let root, host;
const state = () => useGameStore.getState();
const click = text => act(() => [...host.querySelectorAll('button')].find(b => b.textContent.includes(text)).click());
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  useGameStore.setState({ chaosLevel: 0, cubies: makeCubies(3), size: 3, disparityFlipCap: 8,
    activeBet: null, lastBetResult: null, betStreak: 0, chaosRecord: emptyChaosRecord(),
    disparityRoundId: 1, showMainMenu: false, demoMode: false, currentLevel: null,
    wormHealerMode: false, xpRun: null, parityPoints: 1000 });
  state().clearDisparityGame();
});
afterEach(() => { act(() => root.unmount()); host.remove(); delete globalThis.IS_REACT_ACT_ENVIRONMENT; vi.useRealTimers(); });
it('supports keyboard-generated clicks, correct setup preview, and charges once', () => {
  const onBet = vi.fn();
  act(() => root.render(<DisparityBettingScreen onBetPlaced={onBet} onSkip={vi.fn()} settings={{ cubeSize: 7, flipCap: 13, disparityLevel: 4 }} />));
  expect(host.textContent).toContain('7×7');
  click('Red – Orange');
  expect(host.textContent).toContain('49 tiles');
  const betButton = [...host.querySelectorAll('button')].find(b => b.textContent.includes('Bet 25 PP'));
  act(() => { betButton.click(); betButton.click(); });
  expect(onBet).toHaveBeenCalledTimes(1);
  expect(state().parityPoints).toBe(975);
});
it('allows an empty-wallet player to skip and supports Back', () => {
  useGameStore.setState({ parityPoints: 0 });
  const onSkip = vi.fn(), onBack = vi.fn();
  act(() => root.render(<DisparityBettingScreen onBetPlaced={vi.fn()} onSkip={onSkip} onBack={onBack} />));
  click('Back to setup'); expect(onBack).toHaveBeenCalledTimes(1);
  click('Skip & Start'); click('Skip & Start'); expect(onSkip).toHaveBeenCalledTimes(1);
});
it('updates standings, highlights a color family, and replaces completed objectives', () => {
  state().startChaosExperience();
  act(() => root.render(<DisparityHUD />));
  expect(host.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('54');
  act(() => host.querySelector('[aria-label^="Highlight Red"]').click());
  expect(state().chaosFocusFaces).toEqual([1, 4]);
  act(() => state().recordChaosTick({}));
  act(() => useGameStore.setState({ chaosExperience: recordChaosHealing(state().chaosExperience, ['a','b','c','d','e','f'], 15) }));
  expect(host.textContent).toContain('Restore twelve different tiles · 6/12');
  expect(host.textContent).not.toContain('Restore six different tiles');
  act(() => useGameStore.setState({ showDisparityWinner: true }));
  expect(host.textContent).toBe('');
});
it('settles a prediction and healing once, then shows results with records', () => {
  function Harness() { useDisparityGame({}); return <DisparityWinnerScreen onDismiss={vi.fn()} />; }
  state().setActiveBet({ type: 'PAIR', pick: 'RO', roundId: 1, wager: 25, odds: 2.7 });
  state().startChaosExperience();
  act(() => root.render(<Harness />));
  act(() => {
    useGameStore.setState({ disparityParityScore: 15, chaosExperience: { ...state().chaosExperience, healPoints: 15, endedAt: Date.now() } });
    state().setDisparityWinner({ pair: ['M1-001', 'M4-009'] });
  });
  expect(state().showDisparityWinner).toBe(false);
  expect(state().activeBet).toBeNull();
  expect(state().parityPoints).toBe(1083); // 68 payout + 15 heals, stake already deducted before this fixture.
  expect(state().chaosRecord).toMatchObject({ rounds: 1, predictions: 1, correct: 1, bestStreak: 1 });
  expect(host.textContent).toContain('Prediction won · +43 PP');
  expect(host.textContent).toContain('Called it');
  act(() => { state().setShowDisparityWinner(false); state().setShowDisparityWinner(true); });
  expect(state().parityPoints).toBe(1083);
  expect(state().chaosRecord.rounds).toBe(1);
});
it('cancels pending scramble launch when the player leaves the round', () => {
  vi.useFakeTimers(); const api = { current: null };
  const shuffle = vi.fn();
  const options = { settings: {}, size: 3, setSettings: vi.fn(), reset: vi.fn(), changeSize: vi.fn(),
    setVisualMode: vi.fn(), setFlipMode: vi.fn(), setShowTunnels: vi.fn(), setChaosLevel: vi.fn(),
    cancelShuffle: vi.fn(), startAnimatedShuffle: shuffle };
  function Harness() { const game = useDisparityGame(options); React.useLayoutEffect(() => { api.current = game; }); return null; }
  act(() => root.render(<Harness />));
  act(() => api.current.startDisparityGame({ disparityLevel: 3, cubeSize: 3, gameLength: 'short' }));
  act(() => api.current.cancelDisparityRun());
  act(() => vi.advanceTimersByTime(1000));
  expect(shuffle).not.toHaveBeenCalled();
  expect(api.current.disparityCountdown).toBeNull();
});
it('keeps a losing wager settled when leaving during the winner reveal', () => {
  function Harness() { useDisparityGame({}); return null; }
  useGameStore.setState({ parityPoints: 975, activeBet: { type: 'PAIR', pick: 'RO', roundId: 1, wager: 25, odds: 2.7 } });
  state().startChaosExperience();
  act(() => root.render(<Harness />));
  act(() => state().setDisparityWinner({ pair: ['M2-001', 'M5-009'] }));
  expect(state().showDisparityWinner).toBe(false);
  expect(state().lastBetResult).toMatchObject({ won: false, loss: 25 });
  act(() => { state().refundActiveBet(); state().clearDisparityGame(); });
  expect(state().parityPoints).toBe(975);
  expect(state().chaosRecord).toMatchObject({ rounds: 1, predictions: 1, correct: 0 });
});
