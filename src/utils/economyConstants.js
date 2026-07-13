// src/utils/economyConstants.js
// Parity Point economy constants — used by worm mode, disparity mode, and store.

// ── Earning rates ─────────────────────────────────────────────────────────────
export const EARN_ORB_COLLECT = 5;              // per parity orb collected in Worm mode
export const EARN_WORM_SURVIVAL_TICK = 1;       // per second alive in Worm mode
export const EARN_WORM_HEALED_FACE = 20;        // per face fully healed
export const EARN_DISPARITY_BET_WIN = 0;        // base; multiplied by bet amount × odds (handled in betting logic)
export const EARN_DAILY_CHALLENGE = 100;        // flat bonus for completing daily challenge
export const EARN_DISPARITY_TILE_RESTORE = 5;  // per tile restored from disparity in chaos game mode

// ── Disparity game lengths (shuffle counts) ───────────────────────────────────
export const DISPARITY_GAME_LENGTHS = {
  short:  10,
  medium: 20,
  long:   30,
};

// ── Worm survival tick interval (seconds) ────────────────────────────────────
export const SURVIVAL_TICK_INTERVAL = 5; // earn 1 PP every 5 seconds survived

// ── Store price tiers ─────────────────────────────────────────────────────────
export const PRICE_SKIN = 150;
export const PRICE_HAT = 100;
export const PRICE_TRAIL = 200;
export const PRICE_CUBE_THEME = 300;
export const PRICE_BUNDLE = 500;

// ── Disparity betting limits ──────────────────────────────────────────────────
export const BET_MIN = 10;
export const BET_MAX = 500;

// ── Starting bankroll ─────────────────────────────────────────────────────────
// Granted once, when no wallet has ever been persisted, so a brand-new player
// can reach the betting feature without first grinding Worm mode. A player who
// spends down to exactly 0 keeps 0 — the grant never repeats.
export const STARTING_BANKROLL = 100;
