// src/utils/economyConstants.js
// Parity Point economy constants — used by worm mode, disparity mode, and store.

// ── Earning rates ─────────────────────────────────────────────────────────────
export const EARN_ORB_COLLECT = 5;              // per parity orb collected in Worm mode
export const EARN_WORM_SURVIVAL_TICK = 1;       // per second alive in Worm mode
export const EARN_WORM_HEALED_FACE = 20;        // per face fully healed
export const EARN_DISPARITY_BET_WIN = 0;        // base; multiplied by bet amount × odds (handled in betting logic)
export const EARN_DAILY_CHALLENGE = 100;        // flat bonus for completing daily challenge
export const EARN_DISPARITY_TILE_RESTORE = 5;  // per tile restored from disparity in chaos game mode

// ── Earning outside Worm and Chaos ────────────────────────────────────────────
// Parity Points used to come from exactly two modes. Everything else — the three
// campaigns, Freeplay, Random, Teach, Holonomy — paid nothing, so a player could
// finish every authored level in the game and still be able to afford nothing in
// the store beyond the one-off starting bankroll. These route the rest of the
// game into the same wallet.
//
// All of them are ONE-TIME. A level pays on its first clear and again only for
// stars it has never earned before (stars cap at three), and every other award
// is claimed once against a persisted milestone key — so no amount of replaying
// a solved level or re-running an algorithm farms points.
export const EARN_LEVEL_FIRST_CLEAR = 15;    // any authored level, first completion
export const EARN_LEVEL_STAR = 10;           // per NEW star, so ≤30 more per level
export const EARN_FREEPLAY_FIRST_SOLVE = 25; // first Freeplay/Random solve at each cube size
export const EARN_TEACH_ALGORITHM = 20;      // per algorithm executed to the end, once
export const EARN_HOLONOMY_LOOP = 30;        // first closed holonomy loop
export const EARN_HOLONOMY_MOBIUS = 60;      // first orientation-reversing loop — the RP² payoff

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
