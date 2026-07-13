import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';

// Round-scoped bet lifecycle: bets are stamped with the round they were placed
// for (beginDisparityRound) and orphaned bets are refunded (refundActiveBet)
// instead of resolving against a later, unrelated chaos round.

describe('disparity bet lifecycle', () => {
  beforeEach(() => {
    useGameStore.setState({ parityPoints: 1000, activeBet: null, disparityRoundId: 0, betStreak: 0 });
  });

  it('spendCoins refuses to overdraw and reports failure', () => {
    expect(useGameStore.getState().spendCoins(2000)).toBe(false);
    expect(useGameStore.getState().parityPoints).toBe(1000);
  });

  it('spendCoins deducts and reports success', () => {
    expect(useGameStore.getState().spendCoins(250)).toBe(true);
    expect(useGameStore.getState().parityPoints).toBe(750);
  });

  it('beginDisparityRound stamps the pending bet with the new round id', () => {
    useGameStore.getState().setActiveBet({ type: 'PAIR', pick: 'RO', wager: 50 });
    useGameStore.getState().beginDisparityRound();
    const s = useGameStore.getState();
    expect(s.disparityRoundId).toBe(1);
    expect(s.activeBet.roundId).toBe(1);
  });

  it('beginDisparityRound without a bet just advances the round counter', () => {
    useGameStore.getState().beginDisparityRound();
    useGameStore.getState().beginDisparityRound();
    expect(useGameStore.getState().disparityRoundId).toBe(2);
    expect(useGameStore.getState().activeBet).toBeNull();
  });

  it('a stale bet reaching a new round start is refunded, not adopted', () => {
    useGameStore.getState().spendCoins(25);
    useGameStore.getState().setActiveBet({ type: 'SURVIVOR', pick: 1, wager: 25 });
    useGameStore.getState().beginDisparityRound(); // round 1 — bet stamped 1
    expect(useGameStore.getState().activeBet.roundId).toBe(1);
    useGameStore.getState().beginDisparityRound(); // round 2 — round 1 never resolved
    const s = useGameStore.getState();
    expect(s.disparityRoundId).toBe(2);
    expect(s.activeBet).toBeNull();
    expect(s.parityPoints).toBe(1000); // wager returned
  });

  it('refundActiveBet returns the wager and clears the bet', () => {
    useGameStore.getState().spendCoins(50);
    useGameStore.getState().setActiveBet({ type: 'PAIR', pick: 'RO', wager: 50, roundId: 1 });
    useGameStore.getState().refundActiveBet();
    const s = useGameStore.getState();
    expect(s.parityPoints).toBe(1000);
    expect(s.activeBet).toBeNull();
  });

  it('refundActiveBet is a no-op without an active bet', () => {
    useGameStore.getState().refundActiveBet();
    expect(useGameStore.getState().parityPoints).toBe(1000);
    expect(useGameStore.getState().activeBet).toBeNull();
  });
});
