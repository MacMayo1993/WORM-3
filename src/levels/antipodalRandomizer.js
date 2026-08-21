// antipodalRandomizer.js — analytic level generation from the antipodal par formula.
//
// The WORM-3 antipodal engine (src/game/antipodalEngine.js) proves that the
// exact minimum cost to solve a fibre state is the *directed canonical* formula
// (Theorem 6 of docs/antipodal-math/symmetry-induced-exact-decoding.md):
//
//     C_dir = n_A + min(n11, P - n11)
//
// where, over P antipodal β-orbit pairs,
//   · n00 = clean pairs            (0,0)
//   · n11 = symmetric dirty pairs  (1,1)
//   · n_A = asymmetric defect pairs (0,1) or (1,0)   with  n00 + n11 + n_A = P.
//
// Because every partition (n00, n11, n_A) *dictates* the exact par, level design
// stops being a backward-search over scrambles and becomes forward synthesis:
// pick a target par, enumerate the partitions that realise it, and instantiate a
// bit vector. No pathfinding is ever run — the closed form is O(P). This module
// is pure (no React, no Three.js) so it is trivially testable and reusable by the
// campaign generator, the daily-challenge seed, the level editor's live par
// badge, and the zero-cost hint engine.
//
// Determinism note: generation never touches Math.random. Every random choice is
// driven by a seeded mulberry32 stream so a seed (e.g. a calendar date) yields
// the identical puzzle for every player, and tests are reproducible.

// ---------------------------------------------------------------------------
// Seeded RNG (mulberry32) — small, fast, deterministic across engines.
// ---------------------------------------------------------------------------

/** Hash an arbitrary string/number seed into a 32-bit unsigned integer. */
export function hashSeed(seed) {
  const str = String(seed);
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A deterministic PRNG returning floats in [0, 1). */
export function makeRng(seed) {
  let a = hashSeed(seed);
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// The par formula and its parameter space.
// ---------------------------------------------------------------------------

/** Exact directed repair cost C_dir = n_A + min(n11, P - n11). */
export function computeCDir(n00, n11, nA) {
  const P = n00 + n11 + nA;
  return nA + Math.min(n11, P - n11);
}

/** Target ambiguity Δ = |P - 2·n11|: 0 ⇒ both polarities cost the same. */
export function targetAmbiguity(P, n11) {
  return Math.abs(P - 2 * n11);
}

/**
 * Enumerate every non-negative partition (n00, n11, n_A) of P whose C_dir equals
 * `targetPar`, optionally bounded by an inclusive [minNA, maxNA] asymmetry band.
 *
 * @returns {Array<{ n00, n11, nA, P, par, ambiguity }>}
 */
export function enumerateConfigs(P, targetPar, { minNA = 0, maxNA = P } = {}) {
  const configs = [];
  const hi = Math.min(maxNA, P);
  for (let nA = Math.max(0, minNA); nA <= hi; nA++) {
    for (let n11 = 0; n11 <= P - nA; n11++) {
      const n00 = P - nA - n11;
      if (computeCDir(n00, n11, nA) === targetPar) {
        configs.push({ n00, n11, nA, P, par: targetPar, ambiguity: targetAmbiguity(P, n11) });
      }
    }
  }
  return configs;
}

/**
 * The reachable par band for a given P: C_dir ranges over [0, P] (all-clean or
 * all-dirty solve for free; worst case is every pair asymmetric). Useful to the
 * editor and to campaign tuning so a requested par is known-realisable.
 */
export function parRange(P) {
  return { min: 0, max: P };
}

// ---------------------------------------------------------------------------
// State synthesis.
// ---------------------------------------------------------------------------

const BALANCE = {
  // Closest to P/2 first → branching "polarity choice" puzzles.
  highAmbiguity: (a, b) => a.ambiguity - b.ambiguity,
  // Skewed toward all-clean or all-dirty first → one obvious attractor.
  lowAmbiguity: (a, b) => b.ambiguity - a.ambiguity
};

/**
 * Instantiate one orbit bit-pair list for a chosen partition. Each orbit is
 * {@code { orbitType, bits:[x,y] }}; asymmetric orbits pick a random broken
 * member. The list is shuffled so defect positions are not tier-predictable.
 */
export function instantiateOrbits({ n00, n11, nA }, rng) {
  const orbits = [];
  for (let i = 0; i < n00; i++) orbits.push({ orbitType: '00', bits: [0, 0] });
  for (let i = 0; i < n11; i++) orbits.push({ orbitType: '11', bits: [1, 1] });
  for (let i = 0; i < nA; i++) {
    const bits = rng() < 0.5 ? [1, 0] : [0, 1];
    orbits.push({ orbitType: `${bits[0]}${bits[1]}`, bits });
  }
  // Fisher–Yates with the seeded stream.
  for (let i = orbits.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [orbits[i], orbits[j]] = [orbits[j], orbits[i]];
  }
  return orbits;
}

/**
 * Synthesize a complete level state with an exact theoretical par.
 *
 * @param {object}  opts
 * @param {number}  opts.P            number of antipodal orbit pairs
 * @param {number}  opts.targetPar    desired C_dir (exact 3-star par)
 * @param {[number,number]} [opts.nARange]  inclusive asymmetry band
 * @param {'highAmbiguity'|'lowAmbiguity'|null} [opts.balance]  polarity bias
 * @param {number|string} [opts.seed]  deterministic seed
 * @returns {{ params, parMetrics, ambiguity, state }}
 */
export function generateLevelState({ P, targetPar, nARange = [0, P], balance = null, seed = 0 }) {
  const rng = makeRng(`${seed}:${P}:${targetPar}`);
  let configs = enumerateConfigs(P, targetPar, { minNA: nARange[0], maxNA: nARange[1] });

  // Relax the asymmetry band before failing outright, so a tier's stylistic
  // bounds never make a reachable par unreachable.
  if (configs.length === 0) configs = enumerateConfigs(P, targetPar);
  if (configs.length === 0) {
    throw new RangeError(`No antipodal state realises P=${P} with par=${targetPar} (valid par ∈ [0, ${P}])`);
  }

  if (balance && BALANCE[balance]) configs = configs.slice().sort(BALANCE[balance]);

  // Draw from the biased half so the lever is honoured without collapsing to a
  // single deterministic config across a whole tier.
  const pool = configs.slice(0, Math.max(1, Math.floor(configs.length / 2)) || 1);
  const pick = pool[Math.floor(rng() * pool.length)];

  const orbits = instantiateOrbits(pick, rng);
  const flatVector = orbits.flatMap((o) => o.bits);

  return {
    params: { P, n00: pick.n00, n11: pick.n11, nA: pick.nA },
    parMetrics: { gold: targetPar, silver: targetPar + parSlack(targetPar), bronze: Infinity },
    ambiguity: targetAmbiguity(P, pick.n11),
    state: { totalBits: 2 * P, flatVector, orbits }
  };
}

/** 2-star window that scales with par (mirrors levels/scoring.js parSlack). */
export function parSlack(par) {
  return Math.max(2, Math.ceil(par * 0.5));
}

// ---------------------------------------------------------------------------
// Deterministic 3-star rating from a completion move count.
// ---------------------------------------------------------------------------

/** ★★★ at par, ★★☆ within the slack window, ★☆☆ for any completion. */
export function starsForMoves(par, moves) {
  if (moves <= par) return 3;
  if (moves <= par + parSlack(par)) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// Zero-cost hint engine — reads the closed form, never searches.
// ---------------------------------------------------------------------------

/**
 * Next optimal move for a live orbit list, straight from the decoder:
 *   · any asymmetric orbit present → heal its broken member (mandatory wt(Δ));
 *   · else flip toward the cheaper polarity (min(n11, P − n11)).
 * Returns { action, orbitIndex, reason } or a solved sentinel.
 */
export function nextHint(orbits) {
  const P = orbits.length;
  const asymIndex = orbits.findIndex((o) => o.bits[0] !== o.bits[1]);
  if (asymIndex !== -1) {
    return { action: 'heal', orbitIndex: asymIndex, reason: 'Heal the broken antipodal pair (mandatory defect repair).' };
  }
  const n11 = orbits.filter((o) => o.bits[0] === 1 && o.bits[1] === 1).length;
  if (n11 === 0) return { action: 'solved', orbitIndex: -1, reason: 'Fibre already lies in the solved orbit.' };
  if (n11 <= P - n11) {
    const idx = orbits.findIndex((o) => o.bits[0] === 1 && o.bits[1] === 1);
    return { action: 'flip', orbitIndex: idx, reason: 'Flip a dirty (1,1) pair toward the all-clean target.' };
  }
  const idx = orbits.findIndex((o) => o.bits[0] === 0 && o.bits[1] === 0);
  return { action: 'flip', orbitIndex: idx, reason: 'Flip a clean (0,0) pair toward the all-dirty target (fewer moves).' };
}

// ---------------------------------------------------------------------------
// 5-tier, 100-level campaign curriculum (topological concept progression).
// ---------------------------------------------------------------------------

/**
 * Tier plan. Each tier owns a level range, orbit count(s) P, a par ramp, an
 * asymmetry band, and a polarity bias, teaching one topological idea:
 *   1 Invariant Plane   — pure paired flips (whole-orbit inversion costs 1)
 *   2 Defect Healing     — spotting antipodal mismatches, directed heals
 *   3 Polarity Choice    — deciding which polarity to collapse toward
 *   4 High Entanglement  — interleaving flips and heals under tight par
 *   5 Master Extremals   — long exact chains, zero margin
 */
export const CAMPAIGN_TIERS = [
  { name: 'Invariant Plane', from: 1, to: 15, P: (l) => (l <= 8 ? 4 : 6), par: (l) => 1 + Math.floor((l - 1) / 5), nARange: [0, 0], balance: 'lowAmbiguity', concept: 'Symmetric Flips' },
  { name: 'Defect Healing', from: 16, to: 35, P: (l) => (l <= 25 ? 6 : 8), par: (l) => 3 + Math.floor((l - 16) / 5), nARange: [1, 4], balance: 'lowAmbiguity', concept: 'Deck-Invariance' },
  { name: 'Polarity Choice', from: 36, to: 60, P: (l) => (l <= 48 ? 8 : 10), par: (l) => 5 + Math.floor((l - 36) / 6), nARange: [2, 5], balance: 'highAmbiguity', concept: 'Target Optimization' },
  { name: 'High Entanglement', from: 61, to: 85, P: (l) => (l <= 72 ? 10 : 12), par: (l) => 8 + Math.floor((l - 61) / 4), nARange: [4, 8], balance: null, concept: 'Mixed Operations' },
  { name: 'Master Extremals', from: 86, to: 100, P: (l) => (l <= 93 ? 12 : 14), par: (l) => 12 + Math.floor((l - 86) / 3), nARange: [6, 14], balance: 'highAmbiguity', concept: 'Exact Execution' }
];

/** Locate the tier owning a 1-based level number. */
export function tierForLevel(level) {
  return CAMPAIGN_TIERS.find((t) => level >= t.from && level <= t.to) || null;
}

/**
 * Build one campaign level descriptor. Deterministic given (level, seed).
 */
export function generateCampaignLevel(level, seed = 0) {
  const tier = tierForLevel(level);
  if (!tier) throw new RangeError(`Level ${level} is outside the 1–100 campaign range`);
  const P = tier.P(level);
  const targetPar = Math.min(tier.par(level), P); // clamp to the reachable par band
  const synth = generateLevelState({ P, targetPar, nARange: tier.nARange, balance: tier.balance, seed: `${seed}:lvl:${level}` });
  return {
    levelId: level,
    name: `${tier.name} — ${level}`,
    tier: tier.name,
    concept: tier.concept,
    ...synth
  };
}

/**
 * Generate the full deterministic 100-level campaign.
 * @param {number|string} [seed] default `20260821` (a calendar-style seed).
 */
export function generateCampaign(seed = 20260821) {
  const levels = [];
  for (let l = 1; l <= 100; l++) levels.push(generateCampaignLevel(l, seed));
  return { title: 'WORM³: Topological Descent', totalLevels: 100, seed, levels };
}

/**
 * The daily procedural challenge: one shared puzzle keyed off a calendar date
 * (e.g. '2026-08-21') so every player worldwide faces the identical par.
 */
export function generateDailyChallenge(dateKey, { P = 8, targetPar = 5 } = {}) {
  const synth = generateLevelState({ P, targetPar, balance: 'highAmbiguity', seed: `daily:${dateKey}` });
  return { dateKey, name: `Daily Descent — ${dateKey}`, ...synth };
}

