// src/utils/disparityBetting.js
// Disparity Parity Roulette — bet types, resolution logic, and payout math.

// ── Face identity ─────────────────────────────────────────────────────────────
// Face IDs match CLAUDE.md: 1=PZ(Red) 2=NX(Green) 3=PY(White) 4=NZ(Orange) 5=PX(Blue) 6=NY(Yellow)
export const FACE_INFO = {
  1: { name: 'Red',    hex: '#ef4444', antipodalFace: 4 },
  2: { name: 'Green',  hex: '#22c55e', antipodalFace: 5 },
  3: { name: 'White',  hex: '#e5e5e5', antipodalFace: 6 },
  4: { name: 'Orange', hex: '#f97316', antipodalFace: 1 },
  5: { name: 'Blue',   hex: '#3b82f6', antipodalFace: 2 },
  6: { name: 'Yellow', hex: '#eab308', antipodalFace: 3 },
};

export const ANTIPODAL_PAIRS = [
  { id: 'RO', faces: [1, 4], label: 'Red – Orange', color: '#f97316' },
  { id: 'GB', faces: [2, 5], label: 'Green – Blue', color: '#22c55e' },
  { id: 'WY', faces: [3, 6], label: 'White – Yellow', color: '#eab308' },
];

// ── Bet type definitions ──────────────────────────────────────────────────────
// Odds are total payout multipliers on the wager (stake is deducted at bet
// time). The final winning pair is always one of the three antipodal pairs, so
// picking a face (SURVIVOR) and picking its pair (PAIR) are the same 1-in-3
// event — both pay 2.7× (fair odds 3×, ~10% house edge). FIRST_OUT is 1-in-6
// (fair 6×) and pays 5.4×. The streak bonus (up to +50%) is the player's edge.
export const BET_TYPES = {
  SURVIVOR: {
    id: 'SURVIVOR',
    label: 'Last Color',
    tagline: 'One face survives to the end',
    desc: 'Pick the face color that will have a tile in the final winning pair. 1-in-3 shot.',
    odds: 2.7,
    icon: 'S',
  },
  PAIR: {
    id: 'PAIR',
    label: 'Exact Pair',
    tagline: 'Name the winning antipodal pair',
    desc: 'Call the antipodal pairing that outlasts all others: Red-Orange, Green-Blue, or White-Yellow. 1-in-3 shot.',
    odds: 2.7,
    icon: 'P',
  },
  FIRST_OUT: {
    id: 'FIRST_OUT',
    label: 'First Fall',
    tagline: 'Who collapses first?',
    desc: 'Pick which face color loses all its tiles before anyone else. First blood — a true 1-in-6 long shot.',
    odds: 5.4,
    icon: 'F',
  },
  SPEED: {
    id: 'SPEED',
    label: 'Speed Round',
    tagline: 'Fast or slow collapse?',
    desc: 'Will the collapse (first death to last) beat the typical pace for your settings? A near coin flip.',
    odds: 1.8,
    icon: 'Z',
  },
};

// ── SPEED benchmark ───────────────────────────────────────────────────────────
// Median round durations (first→last death, seconds) measured with
// scripts/measureSpeedOdds.mjs — 250 headless rounds per cell on a 3×3,
// after the 2026-07 chaos pacing retune (see game/chaosSim.js).
// The FAST/SLOW threshold tracks the median for the round's settings so the
// bet is a genuine ~50/50 (matching its 1.8× odds). The old fixed 60 s
// threshold was 96–100% SLOW across every configuration.
// Keys are the wizard's flip-cap tiers; index is chaos level 1–5.
const SPEED_MEDIANS = {
  6:  [0, 66, 60, 40, 28, 23],
  15: [0, 143, 129, 79, 57, 52],
  25: [0, 226, 203, 118, 72, 72],
  40: [0, 343, 314, 167, 92, 86],
};

export function speedThresholdFor(chaosLevel, flipCap) {
  const level = Math.max(1, Math.min(5, Math.round(chaosLevel || 3)));
  const cap = Number(flipCap) || 15;
  let bestTier = 15;
  for (const tier of Object.keys(SPEED_MEDIANS).map(Number)) {
    if (Math.abs(tier - cap) < Math.abs(bestTier - cap)) bestTier = tier;
  }
  return SPEED_MEDIANS[bestTier][level];
}

// "7 min" / "45s" — for benchmark display in the betting UI.
export function formatSpeedThreshold(sec) {
  return sec >= 120 ? `${Math.round(sec / 60)} min` : `${sec}s`;
}

// ── Streak multiplier ─────────────────────────────────────────────────────────
// Consecutive wins boost payout. Capped at +50%.
export function streakMultiplier(streak) {
  return Math.min(1 + (streak || 0) * 0.1, 1.5);
}

// ── Grid ID helpers ───────────────────────────────────────────────────────────
// "M3-042" → 3
export function getFaceFromGridId(gridId) {
  return parseInt(String(gridId).replace('M', '').split('-')[0], 10);
}

export function getWinnerFaces(pair) {
  return (pair || []).map(getFaceFromGridId);
}

// ── Bet resolution ────────────────────────────────────────────────────────────
// Returns { won: bool, description: string } — or { won: false, push: true,
// description } when the round produced no meaningful outcome for the bet
// (the wager should be returned, not lost).
export function resolveBet(bet, { disparityDeaths, disparityWinner, disparityEliminatedFaces, chaosLevel, disparityFlipCap }) {
  if (!bet || !disparityWinner?.pair?.length) return null;

  const { type, pick } = bet;

  if (type === 'SURVIVOR') {
    const winnerFaces = getWinnerFaces(disparityWinner.pair);
    const won = winnerFaces.includes(pick);
    const faceName = FACE_INFO[pick]?.name ?? pick;
    const actual = winnerFaces.map(f => FACE_INFO[f]?.name ?? f).join(' & ');
    return {
      won,
      description: won
        ? `${faceName} was in the final pair!`
        : `The final pair was ${actual}, not ${faceName}.`,
    };
  }

  if (type === 'PAIR') {
    const winnerFaces = new Set(getWinnerFaces(disparityWinner.pair));
    const pairDef = ANTIPODAL_PAIRS.find(p => p.id === pick);
    const won = pairDef ? pairDef.faces.every(f => winnerFaces.has(f)) : false;
    const actualFaces = getWinnerFaces(disparityWinner.pair);
    const actualPair = ANTIPODAL_PAIRS.find(p => p.faces.every(f => actualFaces.includes(f)));
    return {
      won,
      description: won
        ? `${pairDef?.label} survived — perfect call!`
        : `The winner was ${actualPair?.label ?? 'unknown pair'}.`,
    };
  }

  if (type === 'FIRST_OUT') {
    const firstElim = disparityEliminatedFaces?.[0];
    const won = firstElim === pick;
    const faceName = FACE_INFO[pick]?.name ?? pick;
    const actualName = FACE_INFO[firstElim]?.name ?? firstElim;
    return {
      won,
      description: won
        ? `${faceName} fell first — you called it!`
        : `${actualName} was eliminated first, not ${faceName}.`,
    };
  }

  if (type === 'SPEED') {
    // Duration from first death event to last
    const sorted = [...(disparityDeaths || [])].sort((a, b) => a.timestamp - b.timestamp);
    if (sorted.length < 2) {
      // Not enough eliminations to time the round — push, wager returned.
      return {
        won: false,
        push: true,
        description: 'Too few eliminations to time the round — wager returned.',
      };
    }
    const elapsed = (sorted[sorted.length - 1].timestamp - sorted[0].timestamp) / 1000;
    // Threshold = measured median for the round's chaos level + flip cap, so
    // FAST/SLOW is a real coin flip at any settings.
    const threshold = speedThresholdFor(chaosLevel, disparityFlipCap);
    const wasFast = elapsed < threshold;
    const won = pick === 'FAST' ? wasFast : !wasFast;
    return {
      won,
      description: won
        ? `Round lasted ${Math.round(elapsed)}s vs the ${threshold}s benchmark — ${pick === 'FAST' ? 'fast as predicted' : 'nice and slow'}.`
        : `Round lasted ${Math.round(elapsed)}s vs the ${threshold}s benchmark — ${pick === 'FAST' ? 'too slow' : 'ended too fast'}.`,
    };
  }

  return null;
}

// ── Payout calculator ─────────────────────────────────────────────────────────
export function calcPayout(wager, odds, streak) {
  return Math.round(wager * odds * streakMultiplier(streak));
}
