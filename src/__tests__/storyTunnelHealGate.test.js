import { describe, it, expect } from 'vitest';
import { storyTunnelHealGate, canStoryTunnelHeal } from '../worm/story/mastery.js';
import { healGateText } from '../worm/healerWorm/tunnelReadout.js';
import { WORM_STORY_LEVELS } from '../worm/story/levels.js';

const tunnel = { pairId: 'a' };

describe('Story tunnel heal gate', () => {
  it('lets a paid tunnel heal while enough heals remain for the surrounds', () => {
    const goal = { ringHeals: 2, signatures: 3 };
    // Level 79's shape: 4 heals, 2 surrounds. Two tunnel heals fit before them.
    expect(storyTunnelHealGate(goal, {}, null, tunnel, 4)).toBeNull();
    expect(storyTunnelHealGate(goal, {}, null, tunnel, 3)).toBeNull();
    // A third would leave one heal for two surrounds.
    expect(storyTunnelHealGate(goal, {}, null, tunnel, 2)).toEqual({ ringHeals: 2, signatures: 0 });
    // One surround done: that heal is free again.
    expect(storyTunnelHealGate(goal, { ringHeals: 1 }, null, tunnel, 2)).toBeNull();
  });

  it('holds the last heal until the ability task is done, except Mobi’s own door', () => {
    const goal = { signatures: 2 };
    expect(storyTunnelHealGate(goal, { signatures: 1 }, null, tunnel, 2)).toBeNull();
    expect(storyTunnelHealGate(goal, { signatures: 1 }, null, tunnel, 1)).toEqual({ ringHeals: 0, signatures: 1 });
    expect(storyTunnelHealGate(goal, { signatures: 1 }, tunnel, tunnel, 1)).toBeNull();
    expect(storyTunnelHealGate(goal, { signatures: 2 }, null, tunnel, 1)).toBeNull();
  });

  it('keeps the strict rule when no heal count is given, and never gates free play', () => {
    expect(canStoryTunnelHeal({ ringHeals: 1 }, {}, null, tunnel)).toBe(false);
    expect(canStoryTunnelHeal(undefined, undefined, null, tunnel, 1)).toBe(true);
  });

  it('never makes a gated level unwinnable: every surround and the last heal stay reachable', () => {
    for (const level of WORM_STORY_LEVELS.filter(l => l.mechanics?.ringHeals || l.mechanics?.signatures)) {
      const m = level.mechanics;
      // Tunnels heal greedily from the start; count how many they take before the gate bites.
      let healed = 0;
      while (healed < level.target && canStoryTunnelHeal(m, {}, null, tunnel, level.target - healed)) healed++;
      expect(level.target - healed, `level ${level.id}`).toBeGreaterThanOrEqual(m.ringHeals ?? 0);
      expect(level.target - healed, `level ${level.id}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('names what the tunnel is waiting for', () => {
    expect(healGateText({ ringHeals: 1, signatures: 0 })).toBe('Surround 1 tunnel first · your orbs stay on you');
    expect(healGateText({ ringHeals: 2, signatures: 3 })).toBe('Surround 2 tunnels and use your ability 3 more times first · your orbs stay on you');
    expect(healGateText({ ringHeals: 0, signatures: 1 })).toBe('Use your ability once first · your orbs stay on you');
  });
});
