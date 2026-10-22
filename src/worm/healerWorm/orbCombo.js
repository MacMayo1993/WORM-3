// src/worm/healerWorm/orbCombo.js
//
// The orb chain. A pickup within ORB_COMBO_WINDOW seconds of the last one extends
// the chain (sim.orbCombo counts the links after the first, so the chain is
// orbCombo + 1 orbs); a slower one starts a new chain. The window runs on the sim's
// own clock (timeAlive), so pause, tunnels and every freeze beat hold it.
//
// What a chain earns is recognition, not currency: the pickup chime climbs with it,
// the HUD shows ×N from the second orb with a ring that drains as the window closes,
// ×3, ×5 and ×8 (and every fifth after) call out with a flourish, and the run keeps
// its best chain for the result card. Chains never pay Parity Points, so playing for
// one never feeds the chest economy.

export const ORB_COMBO_WINDOW = 2.0;
const MILESTONES = [[3, 'Combo'], [5, 'Streak'], [8, 'Frenzy']];

/** The callout for a chain of this many orbs, or null if it is not a milestone. */
export function comboMilestone(chain) {
  for (const [at, label] of MILESTONES) if (chain === at) return label;
  return chain > 8 && (chain - 8) % 5 === 0 ? 'Frenzy' : null;
}

/** Seconds left to extend the chain (0 once it has lapsed, or before any pickup). */
export const comboWindowLeft = sim => Math.max(0, ORB_COMBO_WINDOW - (sim.timeAlive - sim.lastOrbTime));

/**
 * Count one pickup into the chain: extend or restart it, keep the run's best, and
 * cue a milestone. Called before the pickup's own growth so its chime, haptic and
 * flash all read the new level.
 */
export function chainOrb(sim, ctx) {
  sim.orbCombo = sim.timeAlive - sim.lastOrbTime <= ORB_COMBO_WINDOW ? sim.orbCombo + 1 : 0;
  sim.lastOrbTime = sim.timeAlive;
  const chain = sim.orbCombo + 1;
  if (chain > sim.bestCombo) sim.bestCombo = chain;
  if (comboMilestone(chain)) ctx.feel?.('combo', { combo: sim.orbCombo });
  return chain;
}
