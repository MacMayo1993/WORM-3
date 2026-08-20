/**
 * disparitySlice.js — The Disparity round: tile deaths, face eliminations, the winner, plus the
 * economy (wallet, purchases) and the betting book that ride on it.
 *
 * Part of the useGameStore assembly (see src/hooks/useGameStore.js).
 */

import { persistedState } from './persistedState.js';

export const createDisparitySlice = (set, get) => ({
  // ========================================================================
  // DISPARITY GAME STATE
  // ========================================================================
  // Each entry: { id, gridId, rank, timestamp }
  disparityDeaths: [],
  // O(1) lookup table keyed by gridId for fast per-sticker dead-rank reads
  disparityDeathByGridId: {},
  // Set when a single tile survives: { gridId }
  disparityWinner: null,
  // Controls whether the cinematic winner celebration screen is visible
  showDisparityWinner: false,
  // Face elimination events: array of faceNum (1-6) values in order they were eliminated
  disparityEliminatedFaces: [],
  holonomyMode: false,

  // Configurable flip cap for Disparity Mode (overrides FLIP_CAP constant).
  // Default matches the setup wizard's "Standard / Balanced carnage" tier — 13
  // is the "Endurance / Slow attrition" tier and made tiles feel unkillable when
  // chaos was started without going through the wizard.
  disparityFlipCap: 8,
  setDisparityFlipCap: (v) => set({ disparityFlipCap: v }),

  // Running parity score for the current disparity game session.
  // Incremented by EARN_DISPARITY_TILE_RESTORE × healed-tile-count on each player heal.
  // Reset by makeDisparityRuntimeDefaults (via clearDisparityGame + initWormMode).
  disparityParityScore: 0,
  addDisparityParityScore: (points) => set((state) => ({
    disparityParityScore: state.disparityParityScore + points,
  })),
  // Convert the session's parity score into wallet PP and zero it. Called at
  // round end (winner shown) and on round abandonment (chaos STOP) — the
  // zeroing makes it idempotent, so both call sites firing is safe. Without
  // this the score was HUD-only and healed-tile earnings evaporated.
  cashOutParityScore: () => set((state) => {
    const score = Math.round(state.disparityParityScore || 0);
    if (score <= 0) return state;
    return { parityPoints: Math.max(0, (state.parityPoints || 0) + score), disparityParityScore: 0 };
  }),

  // Chosen game length for the current disparity session ('short' | 'medium' | 'long').
  // Persists between sessions so the wizard remembers the last pick.
  disparityGameLength: 'medium',
  setDisparityGameLength: (v) => set({ disparityGameLength: v }),

  // Live chaos metrics pushed from the chaos worker on each productive tick.
  // Read by TopMenuBar instead of re-scanning every sticker on an interval.
  chaosStats: null,
  setChaosStats: (v) => set({ chaosStats: v }),

  addDisparityDeath: (death) => set((state) => ({
    disparityDeaths: [...state.disparityDeaths, death],
    disparityDeathByGridId: {
      ...state.disparityDeathByGridId,
      [death.gridId]: death,
    },
  })),
  addDisparityDeathsBulk: (deaths) => set((state) => {
    if (!deaths?.length) return state;
    const byGrid = { ...state.disparityDeathByGridId };
    const uniqueNew = [];
    for (const death of deaths) {
      if (!death?.gridId || byGrid[death.gridId]) continue;
      byGrid[death.gridId] = death;
      uniqueNew.push(death);
    }
    if (!uniqueNew.length) return state;
    return {
      disparityDeaths: [...state.disparityDeaths, ...uniqueNew],
      disparityDeathByGridId: byGrid,
    };
  }),
  // Undo death records for tiles the board says are alive again (the player
  // healed them). Emitted by the chaos sim's ledger reconciliation — see
  // reconcileDeadLedger in chaosSim.js. Ranks already handed out are left as
  // they are: they are a historical log, not an index.
  removeDisparityDeathsBulk: (gridIds) => set((state) => {
    if (!gridIds?.length) return state;
    const drop = new Set(gridIds);
    const kept = state.disparityDeaths.filter((d) => !drop.has(d.gridId));
    if (kept.length === state.disparityDeaths.length) return state;
    const byGrid = { ...state.disparityDeathByGridId };
    for (const gridId of drop) delete byGrid[gridId];
    return { disparityDeaths: kept, disparityDeathByGridId: byGrid };
  }),
  removeDisparityEliminatedFacesBulk: (faces) => set((state) => {
    if (!faces?.length) return state;
    const drop = new Set(faces);
    const kept = state.disparityEliminatedFaces.filter((f) => !drop.has(f));
    if (kept.length === state.disparityEliminatedFaces.length) return state;
    return { disparityEliminatedFaces: kept };
  }),

  // Bumped whenever the cube is edited outside the chaos worker's knowledge —
  // today that is the player's heal wave (CubeAssembly). useChaosWorker watches
  // this and pushes a full SYNC_CUBIES; without it the worker keeps simulating
  // damage the player already cleared, and its death ledger drifts away from
  // the tiles on screen.
  chaosResyncEpoch: 0,
  requestChaosResync: () => set((state) => ({ chaosResyncEpoch: state.chaosResyncEpoch + 1 })),

  setDisparityWinner: (winner) => set({ disparityWinner: winner }),
  setShowDisparityWinner: (v) => set({ showDisparityWinner: v }),
  addDisparityEliminatedFace: (faceNum) => set((state) => ({
    disparityEliminatedFaces: [...state.disparityEliminatedFaces, faceNum],
  })),
  addDisparityEliminatedFacesBulk: (faces) => set((state) => {
    if (!faces?.length) return state;
    return { disparityEliminatedFaces: [...state.disparityEliminatedFaces, ...faces] };
  }),
  setHolonomyMode: (v) => set({ holonomyMode: v }),

  // ── Economy ──────────────────────────────────────────────────────────────
  parityPoints: persistedState.parityPoints,
  earnCoins: (amount) => set((state) => ({
    parityPoints: Math.max(0, (state.parityPoints || 0) + Math.round(amount)),
  })),
  spendCoins: (amount) => {
    const current = get().parityPoints || 0;
    if (current < amount) return false;
    set({ parityPoints: current - Math.round(amount) });
    return true;
  },

  // ── Store ownership ───────────────────────────────────────────────────────
  ownedItems: persistedState.ownedItems,
  buyItem: (itemId, price) => {
    const state = get();
    if (state.ownedItems.includes(itemId)) return true; // already owned
    const current = state.parityPoints || 0;
    if (current < price) return false;
    set({ parityPoints: current - Math.round(price), ownedItems: [...state.ownedItems, itemId] });
    return true;
  },

  // ── Disparity betting ─────────────────────────────────────────────────────
  // activeBet: { type, pick, wager, odds, potentialWin, placedAt, streak, roundId }
  activeBet: null,
  setActiveBet: (bet) => set({ activeBet: bet }),
  clearActiveBet: () => set({ activeBet: null }),
  // Monotonic round counter. beginDisparityRound stamps the pending bet with
  // the new round's id so a bet can only ever resolve against the round it
  // was placed for — a bet orphaned by an abandoned round is refunded
  // (refundActiveBet) instead of silently riding the next chaos winner.
  disparityRoundId: 0,
  beginDisparityRound: () => set((state) => {
    const nextId = state.disparityRoundId + 1;
    const bet = state.activeBet;
    if (bet && bet.roundId != null) {
      // Already-stamped bet from an earlier round reached a new round start —
      // its round never resolved, so refund it rather than adopting it.
      const pts = Math.max(0, (state.parityPoints || 0) + Math.round(bet.wager || 0));
      return { disparityRoundId: nextId, activeBet: null, parityPoints: pts };
    }
    return {
      disparityRoundId: nextId,
      activeBet: bet ? { ...bet, roundId: nextId } : null,
    };
  }),
  refundActiveBet: () => set((state) => {
    if (!state.activeBet) return state;
    return {
      parityPoints: Math.max(0, (state.parityPoints || 0) + Math.round(state.activeBet.wager || 0)),
      activeBet: null,
    };
  }),
  // lastBetResult: { won, payout, description, wager }
  lastBetResult: null,
  setLastBetResult: (result) => set({ lastBetResult: result }),
  clearLastBetResult: () => set({ lastBetResult: null }),
  // betStreak: consecutive wins. Persisted like the wallet — the streak is
  // part of the wallet's earning power (up to +50% payout), so losing it to
  // a page reload read as a bug.
  betStreak: persistedState.betStreak,
  setBetStreak: (v) => set({ betStreak: v }),
});
