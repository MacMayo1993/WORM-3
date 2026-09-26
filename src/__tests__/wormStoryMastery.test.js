import { it, expect } from 'vitest';
import { makeWormSim } from '../worm/healerWorm/wormSim.js';
import { getStickerWorldPos } from '../game/coordinates.js';
import { stageStory, storyMetrics } from '../worm/story/runtime.js';
import { recordStoryMechanic, offerStoryPower, nextStoryPower } from '../worm/story/mastery.js';
import { storyLevel, storyOutcome, nextStoryLevel, sanitizeStoryProgress } from '../worm/story/levels.js';
import { getActiveTunnels } from '../worm/wormLogic.js';
import { makeStoryCombat, stepStoryCombat } from '../worm/story/combat.js';
import { surfacePose } from '../worm/combat/portalCombat.js';
import { shAt, ttAt } from '../worm/circularBuffers.js';
import { WORM_LIFT } from '../worm/healerWorm/constants.js';
import { resetLiveRotation } from '../worm/liveRotation.js';

function setup(id = 10) {
  resetLiveRotation();
  const level = storyLevel(id), size = level.cubeSize ?? 5;
  const sim = makeWormSim(size), p = stageStory(sim, size, level);
  p.rotationEpoch = 0;
  const read = (delta = 0.05) => storyMetrics(sim, p, level, { wormSessionOrbs: 0, rotationEpoch: 0 }, [], delta);
  return { sim, level, p, read };
}
it.each([7, 8, 9, 10])('authors level %i with enough matching orbs and real healing pairs', id => {
  const { sim, p, level } = setup(id);
  expect(getActiveTunnels(p.cubies, level.cubeSize ?? 5)).toHaveLength(Math.min(2,level.target));
  expect(sim.powerups.length).toBeGreaterThanOrEqual(level.orbs);
  for (const color of [1,2,3,4,5,6]) expect(sim.powerups.filter(t => p.cubies[t.x][t.y][t.z].stickers[t.dirKey].curr === color).length).toBeGreaterThanOrEqual(4);
  expect(sim.specials.length).toBeLessThanOrEqual(1);
});
it('requires every final-level mechanic, a safe landing, tail clearance and settled rotation', () => {
  const level = storyLevel(10);
  const won = { ...level.mechanics, alive: true, elapsed: 300, cuts: 0, orbs: 36, rotations: 8, healed: 6, remaining: 0, tailClear: true, landed: true, rotationSettled: true };
  expect(storyOutcome(level, won)).toMatchObject({ stars: 3 });
  for (const [key, target] of Object.entries(level.mechanics)) expect(storyOutcome(level, { ...won, [key]: target - 1 })).toBeNull();
  for (const key of ['alive', 'tailClear', 'landed', 'rotationSettled']) expect(storyOutcome(level, { ...won, [key]: false })).toBeNull();
  expect(storyOutcome(level, { ...won, elapsed: level.limit + 1 })).toBeNull();
});
it('stages the Stage 9 body on the 7x7 exterior and completes with one bomb and enemy', () => {
  const { sim, level, p } = setup(9);
  expect(level.cubeSize).toBe(7);
  expect(p.cubies).toHaveLength(7);
  expect(sim.pos).toMatchObject({ x: 3, y: 0, z: 6, dirKey: 'PZ' });
  const headZ = getStickerWorldPos(3, 0, 6, 'PZ', 7, 0)[2] + WORM_LIFT;
  for (let i = 0; i < sim.stepHistory.count; i++) {
    const point = shAt(sim.stepHistory, i);
    expect(point.tz).toBe(6);
    expect(point.pos.z).toBeCloseTo(headZ, 8);
    if (i > 0) expect(point.pos.distanceTo(shAt(sim.stepHistory, i - 1).pos)).toBeCloseTo(0.02, 8);
  }
  expect(ttAt(sim.tileTrail, 0)).toBe('3,0,6,PZ');
  const won = { alive: true, elapsed: 200, cuts: 0, orbs: 24, healed: 4, remaining: 0,
    tailClear: true, landed: true, rotationSettled: true, ringHeals: 1, signatures: 2, bombs: 1, kills: 1 };
  expect(storyOutcome(level, won)).toMatchObject({ stars: 3 });
  expect(storyOutcome(level, { ...won, bombs: 0 })).toBeNull();
  expect(storyOutcome(level, { ...won, kills: 0 })).toBeNull();
});
it('counts completed boosts, double-jump landings and rocket landings once per episode', () => {
  const { sim, read } = setup(7);
  sim.boostActiveT = 1; expect(read().boosts).toBeUndefined();
  sim.boostActiveT = 0; expect(read().boosts).toBe(1); expect(read().boosts).toBe(1);
  sim.isJumping = true; sim.jumpCount = 2;
  expect(read().doubleJumps).toBeUndefined(); read();
  sim.isJumping = false; sim.jumpCount = 0;
  expect(read().doubleJumps).toBe(1); expect(read().doubleJumps).toBe(1);
  sim.rocketActive = true; sim.isJumping = true; sim.jumpCount = 2; read();
  sim.rocketActive = false; expect(read().rockets).toBeUndefined();
  sim.isJumping = false; expect(read().rockets).toBe(1); expect(read().doubleJumps).toBe(1);
});
it('does not count fatal landings or an Inch signature that only charged', () => {
  const { sim, read } = setup();
  sim.signature.character = 'inch'; sim.signature.seq = 1; sim.signature.charge = 1;
  expect(read().signatures).toBeUndefined();
  sim.signature.charge = 0; expect(read().signatures).toBeUndefined();
  sim.signature.seq = 2; sim.signature.active = 1; expect(read().signatures).toBe(1);
  expect(read().signatures).toBe(1);
  sim.isJumping = true; sim.jumpCount = 2; read();
  sim.alive = false; sim.isJumping = false; expect(read().doubleJumps).toBeUndefined();
});
it('checks all five elemental effects and reoffers a missed or expired power', () => {
  const { sim, p, level, read } = setup(10);
  p.mechanics.rockets = 1; p.mechanics.magnetOrbs = 4;
  sim.specials = []; p.powerDelay = 0; offerStoryPower(sim, p, level, 5, p.cubies);
  expect(sim.specials[0].type).toBe('water');
  sim.specials = []; p.powerDelay = 0; expect(offerStoryPower(sim, p, level, 5, p.cubies)).toBe(true);
  expect(sim.specials[0].type).toBe('water');
  for (const type of ['water', 'fire', 'grass', 'ice', 'lightning']) {
    sim.specials = []; sim.elementalType = type; sim.elementalT = 15; sim.elementalFocusT = 0;
    sim.waterMomentum = 0;
    for (let i = 0; i < 81; i++) read();
    if (type === 'water') { expect(p.elements.has(type)).toBe(false); sim.waterMomentum = 0.9; read(); }
    if (type === 'fire') { expect(p.elements.has(type)).toBe(false); sim.elementalPatches.set('test', { type: 'fire' }); read(); }
    if (type === 'grass' || type === 'ice') {
      expect(p.elements.has(type)).toBe(false);
      sim.isJumping = true; sim.jumpHeight = type === 'grass' ? 3 : 1;
      if (type === 'grass') { read(); expect(p.elements.has(type)).toBe(false); recordStoryMechanic(p, 'grassLaunch'); }
      read();
      expect(p.elements.has(type)).toBe(false);
      sim.isJumping = false; read();
    }
    expect(p.elements.has(type)).toBe(true);
    expect(offerStoryPower(sim, p, level, 5, p.cubies)).toBe(false); // don't replace an active element
  }
  expect(read().elements).toBe(5); expect(nextStoryPower(p, level)).toBeNull();
});
it('finishes level eight with two collected elements without waiting for mastery', () => {
  const { sim, p, level, read } = setup(8);
  expect(level.mechanics).toEqual({ elementPickups: 2 });
  p.powerDelay = 0; offerStoryPower(sim, p, level, 5, p.cubies);
  expect(sim.specials[0].type).toBe('water');
  p.powerDelay = 0;
  sim.specials = []; // missed offerings do not count and can be offered again
  expect(offerStoryPower(sim, p, level, 5, p.cubies)).toBe(true);
  expect(read().elementPickups).toBeUndefined();
  const won = { alive: true, elapsed: 80, cuts: 0, orbs: 24, healed: 3, remaining: 0,
    tailClear: true, landed: true, rotationSettled: true };
  recordStoryMechanic(p, 'elementPickups');
  expect(storyOutcome(level, { ...won, elementPickups: read().elementPickups })).toBeNull();
  expect(nextStoryPower(p, level)).toBe('fire');
  sim.specials = []; sim.elementalT = 10;
  expect(offerStoryPower(sim, p, level, 5, p.cubies)).toBe(false);
  sim.elementalT = 0; p.powerDelay = 0;
  expect(offerStoryPower(sim, p, level, 5, p.cubies)).toBe(true);
  expect(sim.specials[0].type).toBe('fire');
  recordStoryMechanic(p, 'elementPickups');
  expect(p.elements.size).toBe(0);
  expect(storyOutcome(level, { ...won, elementPickups: read().elementPickups })).not.toBeNull();
  expect(nextStoryPower(p, level)).toBeNull();
  expect(stageStory(sim, 5, level).mechanics).toEqual({});
});
it('deduplicates disarms and resets every mastery counter on retry', () => {
  const { sim, p, level } = setup();
  recordStoryMechanic(p, 'bombs', 0); recordStoryMechanic(p, 'bombs', 0); recordStoryMechanic(p, 'bombs');
  recordStoryMechanic(p, 'ringHeals'); recordStoryMechanic(p, 'magnetOrbs');
  expect(p.mechanics).toEqual({ bombs: 1, ringHeals: 1, magnetOrbs: 1 });
  const retry = stageStory(sim, 5, level);
  expect(retry.mechanics).toEqual({}); expect(retry.elements.size).toBe(0); expect(retry.bombIds.size).toBe(0);
});
it('keeps six-level saves and claims intact, resumes at seven, and carries chapter one into chapter two', () => {
  const old = { stars: Object.fromEntries(Array.from({ length: 6 }, (_, i) => [i+1, 3])), claimed: { 6: 'skin_royal' } };
  expect(sanitizeStoryProgress(old)).toEqual(old);
  expect(nextStoryLevel({ wormStory: old }).id).toBe(7);
  const complete = { wormStory: { stars: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i+1, 3])) } };
  expect(nextStoryLevel(complete).id).toBe(11);
  const all = { wormStory: { stars: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [i+1, 3])) } };
  expect(nextStoryLevel(all).id).toBe(40);
});

const head = { x: 0, y: 0, z: 4, dirKey: 'PZ' };
const player = () => ({ head, heading: 'up', position: surfacePose(head, head, 0, 5).position,
  phase: 'active', alive: true, healed: 6, protected: true, elementT: 0 });
function tickCombat(c, p, count, goal = 6) { for (let i = 0; i < count; i++) stepStoryCombat(c, .05, p, goal); }
it('offers all enemy types after all tunnels close; only real kills count and no prototype win fires', () => {
  const c = makeStoryCombat(5), p = player();
  for (const type of ['crawler', 'scout', 'brute']) {
    c.quiet = 0; tickCombat(c, p, 1); expect(c.warning).toBe(2.5);
    tickCombat(c, p, 51); expect(c.enemies[0].type).toBe(type);
    // The authored rift lies straight ahead. Real surface shots defeat the enemy.
    c.enemies[0].freeze = 15; c.fireHeld = true;
    tickCombat(c, p, 120);
    expect(c.killsByType[type]).toBe(1); expect(c.encounter).toBe(false);
  }
  expect(c.kills).toBe(3); expect(c.won).toBe(false); expect(c.drops).toHaveLength(0);
  c.quiet = 0; tickCombat(c, p, 100, 3); expect(c.encounter).toBe(false);
});
it('holds warnings in a pause, avoids other hazards, and cancels stale encounters on rotation or death', () => {
  const c = makeStoryCombat(5), p = player(); c.quiet = 0;
  tickCombat(c, { ...p, hazardBusy: true }, 100); expect(c.encounter).toBe(false);
  tickCombat(c, p, 1); const warning = c.warning;
  tickCombat(c, { ...p, blocked: true }, 100); expect(c.warning).toBe(warning);
  tickCombat(c, { ...p, rotating: true, blocked: true }, 1); expect(c.encounter).toBe(false);
  expect(c.enemies).toHaveLength(0); expect(c.kills).toBe(0);
  c.quiet = 0; tickCombat(c, p, 1);
  tickCombat(c, { ...p, alive: false }, 1); expect(c.encounter).toBe(false); expect(c.kills).toBe(0);
});

it('offers one optional view in later Story levels without replacing required powers', () => {
  const { sim, p, level } = setup(10);
  const size = level.cubeSize ?? 5;
  sim.specials = []; p.powerDelay = 0;
  expect(offerStoryPower(sim, p, level, size, p.cubies)).toBe(true);
  expect(sim.specials[0].type).toBe('magnet');
  sim.specials = [];
  p.mechanics = { ...level.mechanics };
  p.elements = new Set(['water', 'fire', 'grass', 'ice', 'lightning']);
  p.powerDelay = 0;
  expect(offerStoryPower(sim, p, level, size, p.cubies)).toBe(true);
  expect(sim.specials[0].type).toMatch(/^view-/);
  sim.specials = []; p.powerDelay = 0;
  expect(offerStoryPower(sim, p, level, size, p.cubies)).toBe(false);
  const early = setup(7); early.sim.specials = []; early.p.powerDelay = 0;
  early.p.mechanics = { ...early.level.mechanics };
  expect(offerStoryPower(early.sim, early.p, early.level, early.level.cubeSize ?? 5, early.p.cubies)).toBe(false);
});
