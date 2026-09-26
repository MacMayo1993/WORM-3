import { bettingPalette } from '../utils/disparityBetting.js';
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
const click = text => act(() => [...host.querySelectorAll('button')].find(b => b.textContent.includes(text) || b.getAttribute('aria-label') === text).click());
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
  expect(host.querySelector('[aria-label="Color pair standings"]')).toBeNull();
  expect(host.querySelector('.chaos-objective')).toBeNull();
  click('Inspect match');
  act(() => host.querySelector('[aria-label^="Highlight Red"]').click());
  expect(state().chaosFocusFaces).toEqual([1, 4]);
  act(() => state().recordChaosTick({}));
  act(() => useGameStore.setState({ chaosExperience: recordChaosHealing(state().chaosExperience, ['a','b','c','d','e','f'], 15) }));
  expect(host.textContent).toContain('Restore twelve different tiles · 6/12');
  expect(host.textContent).not.toContain('Restore six different tiles');
  click('Hide match details');
  expect(host.querySelector('.chaos-objective')).toBeNull();
  expect(host.querySelector('.chaos-live-event')).toBeNull();
  expect(host.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('54');
  click('Inspect match');
  const pair = host.querySelector('[aria-label^="Highlight Red"]');
  pair.focus();
  act(() => pair.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(host.querySelector('[aria-label="Color pair standings"]')).toBeNull();
  expect(document.activeElement.getAttribute('aria-label')).toBe('Inspect match');
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

it('uses the chosen palette for picks and preserves pair identity when placing a bet', () => {
  const onBet = vi.fn();
  const settings = { colorScheme: 'neon', cubeSize: 5 };
  const { faces, pairs } = bettingPalette(settings);
  act(() => root.render(<DisparityBettingScreen settings={settings} onBetPlaced={onBet} onSkip={vi.fn()} />));
  const choices = [...host.querySelectorAll('.chaos-pick-pair')];
  expect(choices[0].textContent).toContain(pairs[0].label);
  expect(choices[0].style.getPropertyValue('--pair-a')).toBe(faces[1].hex);
  expect(choices[0].style.getPropertyValue('--pair-b')).toBe(faces[4].hex);
  expect(host.textContent).not.toContain('Red-Orange, Green-Blue');
  act(() => choices[0].click());
  click('Bet 25 PP');
  expect(onBet.mock.calls[0][0]).toMatchObject({ pick: 'RO', type: 'PAIR', paletteSettings: settings });
});
it('updates single-color picks when the setup palette changes', () => {
  const renderPalette = settings => act(() => root.render(<DisparityBettingScreen settings={settings} onBetPlaced={vi.fn()} onSkip={vi.fn()} />));
  renderPalette({ colorScheme: 'neon' });
  click('Last Color');
  const custom = { colorScheme: 'custom', customColors: { 1: '#123456', 4: '#ff55cc' } };
  renderPalette(custom);
  const { faces } = bettingPalette(custom);
  const choice = host.querySelector('.chaos-face-choice');
  expect(choice.textContent).toContain(faces[1].name);
  expect(choice.querySelector('i').style.background).toBe('rgb(18, 52, 86)');
});

it('uses the inherited custom palette through setup, betting, back, and launch', () => {
  vi.useFakeTimers();
  const customColors = { 1:'#663399', 2:'#00aacc', 3:'#ffeedd', 4:'#ff99bb', 5:'#55bb66', 6:'#ffcc00' };
  const settings = { colorScheme:'custom', customColors, backgroundTheme:'blackhole' };
  const api = { current:null }, applied = vi.fn();
  const options = { settings, size:3, setSettings:applied, reset:vi.fn(), changeSize:vi.fn(),
    setVisualMode:vi.fn(), setFlipMode:vi.fn(), setShowTunnels:vi.fn(), setChaosLevel:vi.fn(),
    cancelShuffle:vi.fn(), startAnimatedShuffle:vi.fn() };
  function Harness() {
    const game = useDisparityGame(options);
    React.useLayoutEffect(() => { api.current = game; });
    return game.showDisparityBetting ? <DisparityBettingScreen settings={game.chaosPreview} onBetPlaced={vi.fn()} onSkip={vi.fn()} onBack={game.handleBetBack} /> : null;
  }
  act(() => root.render(<Harness />));
  act(() => api.current.handleDisparitySetupComplete({ cubeSize:5, disparityLevel:4, flipCap:13 }));
  expect(api.current.chaosPreview.customColors).toEqual(customColors);
  const choice = host.querySelector('[data-pair-id="RO"]');
  expect(choice.querySelector('[data-face-id="1"]').style.backgroundColor).toBe('rgb(102, 51, 153)');
  expect(choice.querySelector('[data-face-id="4"]').style.backgroundColor).toBe('rgb(255, 153, 187)');
  act(() => api.current.handleBetBack());
  expect(api.current.chaosPreview).toMatchObject({ colorScheme:'custom', cubeSize:5, flipCap:13 });
  const preview = api.current.chaosPreview;
  customColors[1] = '#000000'; // An unrelated settings edit cannot alter this round's snapshot.
  act(() => api.current.startDisparityGame(preview));
  expect(applied.mock.calls[0][0].customColors[1]).toBe('#663399');
  expect(bettingPalette(applied.mock.calls[0][0])).toEqual(bettingPalette(preview));
});
