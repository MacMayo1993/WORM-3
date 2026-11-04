import { it, expect } from 'vitest';
import { WORM_CHARACTERS } from '../worm/wormCharacterData.js';
import { makeWormSim } from '../worm/healerWorm/wormSim.js';
import { makeSignature, activateSignature, launchSpring, releaseMobiTunnel, SIGNATURES } from '../worm/healerWorm/signatures.js';
import { makeCubies } from '../game/cubeState.js';
import { stageStory, storyMetrics, replenishStoryOrbs } from '../worm/story/runtime.js';
import { canStoryTunnelHeal } from '../worm/story/mastery.js';
import { WORM_STORY_LEVELS, storyChecklist, storyOutcome } from '../worm/story/levels.js';
import { storyGoalText } from '../worm/story/goalText.js';
import { storyLaunchLines } from '../worm/story/narrative.js';
import { orbCreditFace } from '../worm/healerWorm/economy.js';
import { resetLiveRotation } from '../worm/liveRotation.js';

const colors = (sim, p) => new Set(sim.powerups.map(t => orbCreditFace(p.cubies[t.x][t.y][t.z].stickers[t.dirKey].curr)));
const affected = WORM_STORY_LEVELS.filter(l => l.mechanics?.signatures);
const read = (sim, p, level) => storyMetrics(sim, p, level, { size: level.cubeSize, wormSessionOrbs: 0, rotationEpoch: 0 }, [], 0.05);

it.each(WORM_STORY_LEVELS)('level $id stages collectible color supply for every character objective', level => {
  resetLiveRotation();
  const size = level.cubeSize ?? 5, sim = makeWormSim(size), p = stageStory(sim, size, level);
  const available = colors(sim, p);
  for (const { id } of WORM_CHARACTERS) {
    const goals = storyChecklist(level, { character: id });
    expect(goals.every(g => g.label && g.target > 0), id).toBe(true);
    expect(available.size, `${id}: level color quota`).toBeGreaterThanOrEqual(level.colors ?? 0);
    if (id === 'prism') expect(available.size, 'Spectrum quota').toBeGreaterThanOrEqual(level.mechanics?.signatures ?? 0);
  }
});

it.each(affected)('level $id has renewable Spectrum colors, exact credit, and clean retries', level => {
  const size = level.cubeSize ?? 5, sim = makeWormSim(size);
  for (let attempt = 0; attempt < 2; attempt++) {
    const p = stageStory(sim, size, level);
    sim.signature = { ...makeSignature(), character: 'prism' };
    expect(read(sim, p, level).signatures).toBe(0);
    const supply = [...colors(sim, p)];
    for (let i = 0; i < level.mechanics.signatures; i++) {
      p.colors.add(supply[i]);
      expect(read(sim, p, level).signatures).toBe(i + 1);
      p.colors.add(supply[i]);
      expect(read(sim, p, level).signatures).toBe(i + 1);
    }
    expect(storyChecklist(level, read(sim, p, level)).find(g => g.key === 'signatures')).toMatchObject({ done: true, label: 'Collect different orb colors for Spectrum' });
    // Even after every pickup is gone, refill offers the authored palette again.
    sim.powerups = []; p.orbRefillDelay = 0;
    expect(replenishStoryOrbs(sim, p, { cubies: p.cubies }, size, .1)).toBe(true);
    expect(colors(sim, p).size).toBeGreaterThanOrEqual(level.mechanics.signatures);
    expect(storyGoalText(level, 'prism')).toContain(`${level.mechanics.signatures} different orb color`);
    expect(storyLaunchLines(level, { replay: true, character: 'prism' })).toEqual([storyGoalText(level, 'prism')]);
  }
});

it.each(WORM_CHARACTERS.filter(c => c.id !== 'prism'))('$id can earn every authored ability quota via successful activations', ({ id }) => {
  for (const level of affected) {
    const size = level.cubeSize ?? 5, sim = makeWormSim(size), p = stageStory(sim, size, level);
    const cubies = makeCubies(size);
    // Isolate the ability contract from unrelated story route obstacles.
    sim.tileTrail.count = 0;
    const ctx = { getCharacter: () => id, getCubies: () => cubies, getGamePhase: () => 'active',
      isPaused: () => false, isStoryMode: () => true, feel: () => {}, canCreateMobiTunnel: () => true,
      createMobiTunnel: () => ({ tunnel: { pairId: 'owned' }, stableKeys: [] }) };
    for (let i = 1; i <= level.mechanics.signatures; i++) {
      sim.signature.cooldown = 0; sim.signature.active = 0; sim.signature.charge = 0;
      sim.isJumping = false; sim.magnetT = 0;
      expect(activateSignature(sim, size, ctx), `${id}, level ${level.id}`).toBe(true);
      if (id === 'inch') expect(launchSpring(sim, size, ctx)).toBe(true);
      expect(read(sim, p, level).signatures).toBe(i);
      expect(read(sim, p, level).signatures).toBe(i);
      if (id === 'mobi') {
        const counts = { ...p.mechanics, ringHeals: level.mechanics.ringHeals ?? 0 };
        expect(canStoryTunnelHeal(level.mechanics, counts, sim.signature.mobiTunnel, { pairId: 'owned' })).toBe(true);
        releaseMobiTunnel(sim, { pairId: 'owned' });
      }
    }
    expect(SIGNATURES[id].cooldown * (level.mechanics.signatures - 1)).toBeLessThan(level.limit);
    // The ability never waives any other campaign objective.
    expect(storyOutcome(level, read(sim, p, level))).toBeNull();
  }
});

it('Mobi only bypasses the ability gate for its own door, never the surround quota', () => {
  const goal = { ringHeals: 2, signatures: 3 }, owned = { pairId: 'mine' };
  expect(canStoryTunnelHeal(goal, { ringHeals: 1, signatures: 1 }, owned, owned)).toBe(false);
  expect(canStoryTunnelHeal(goal, { ringHeals: 2, signatures: 1 }, owned, owned)).toBe(true);
  expect(canStoryTunnelHeal(goal, { ringHeals: 2, signatures: 1 }, owned, { pairId: 'other' })).toBe(false);
  expect(canStoryTunnelHeal(goal, { ringHeals: 2, signatures: 1 }, null, owned)).toBe(false);
  expect(canStoryTunnelHeal(goal, { ringHeals: 2, signatures: 3 }, null, owned)).toBe(true);
});
