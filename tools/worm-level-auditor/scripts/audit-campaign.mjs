import fs from 'node:fs';
import assert from 'node:assert/strict';
import { WORM_STORY_LEVELS } from '../../../src/worm/story/levels.js';
import { stageStory, replenishStoryOrbs, replenishStoryTunnel } from '../../../src/worm/story/runtime.js';
import { storyElementTypes } from '../../../src/worm/story/elementGoals.js';
import { updateMastery, recordStoryMechanic, offerStoryPower, STORY_ELEMENTS } from '../../../src/worm/story/mastery.js';
import { makeWormSim, tileKey } from '../../../src/worm/healerWorm/wormSim.js';
import { getActiveTunnels, findStickerByStableKey } from '../../../src/worm/wormLogic.js';
import { healSticker } from '../../../src/game/cubeState.js';
import { buildManifoldGridMap, flipStickerPair } from '../../../src/game/manifoldLogic.js';
import { rotateSliceCubies } from '../../../src/game/cubeRotation.js';
import { orbCreditFace } from '../../../src/worm/healerWorm/economy.js';
import { resetLiveRotation } from '../../../src/worm/liveRotation.js';
import { seededRandom } from '../web/generator.js';
import { assess } from '../web/audit.js';

const data = JSON.parse(fs.readFileSync(new URL('../dist/data.json',import.meta.url)));
const seeds = ['opening', 'dense', 'seams', 'recovery', 'sparse', 'repeat'];
const totals = { recoveryAttempts: 0, taskSupplyChecks: 0, seeds: seeds.length, stages: 0, powerOffers: 0, fullInventoryRestores: 0, rotatedRefills: 0, replacementPairs: 0, counterFixtures: 0 };
const setup = (level, character, seed) => {
  resetLiveRotation(); const sim = makeWormSim(level.cubeSize);
  sim.rand = seededRandom(seed + ':' + level.id + ':' + character);
  const p = stageStory(sim, level.cubeSize, level, character);
  p.viewOffered = true;
  // A run deals its elements at random; every deal relabels the same slots, so audit the authored one.
  if (p.elementOrder) p.elementOrder = [...storyElementTypes(level)];
  return { sim, p, state: { cubies: p.cubies, wormPaused: false, animState: null } };
};
const readColors = (sim, cubies) => sim.powerups.reduce((counts, orb) => {
  const color = cubies[orb.x][orb.y][orb.z].stickers[orb.dirKey].orig;
  counts[color] = (counts[color] ?? 0) + 1; return counts;
}, {});

for (const level of WORM_STORY_LEVELS) {
  const record = data.records.find(r => r.config.id === level.id);
  const evidence = { recoveryAttempts: 0, taskSupplyChecks: 0, variationStages: 0, repeatedPowerOffers: 0, fullInventoryRestores: 0, rotatedRefills: 0, replacementPairs: 0, counters: [], findings: [] };
  for (const character of ['glow', 'classic']) {
    const stage = record.stages[character];
    // Pickup bodies credit the antipode of the tile they sit on.
    stage.pickupTargets = Object.fromEntries(Object.entries(stage.orbTargets).map(([color, count]) => [orbCreditFace(Number(color)), count]));
    for (const seed of seeds) {
      const { sim, p, state } = setup(level, character, seed), cycle = stage.powerCycle;
      const opening = sim.powerups.length;
      assert.equal(new Set(sim.powerups.map(tileKey)).size, opening);
      assert.equal(Object.keys(p.orbTargets).length, 6);
      if (stage.pickupBudget !== null) assert(opening <= stage.pickupBudget);
      evidence.variationStages++; totals.stages++;
      const supplied = new Set();
      for (let i = 0; i < cycle.length * 3; i++) {
        sim.specials = []; p.powerDelay = 0; p.elementSupplyDelay = 0;
        assert(offerStoryPower(sim, p, level, level.cubeSize, state.cubies));
        for (const orb of sim.specials) supplied.add(orb.type);
        assert(!sim.specials.some(orb => !cycle.includes(orb.type) && !STORY_ELEMENTS.includes(orb.type)));
        assert.equal(new Set(sim.specials.map(tileKey)).size, sim.specials.length);
        assert(!sim.powerups.some(orb => tileKey(orb) === tileKey(sim.specials[0])));
        evidence.repeatedPowerOffers++; totals.powerOffers++;
      }
      assert(cycle.every(type => supplied.has(type)), `level ${level.id}: recurring power coverage`);
      sim.specials = []; sim.powerups = [];
      for (let pulse = 0; pulse < Math.max(...Object.values(p.orbTargets)) + 2; pulse++) {
        p.orbRefillDelay = 0;
        replenishStoryOrbs(sim, p, state, level.cubeSize, .1);
      }
      assert.deepEqual(readColors(sim, state.cubies), p.orbTargets);
      assert.equal(new Set(sim.powerups.map(tileKey)).size, sim.powerups.length);
      evidence.fullInventoryRestores++; totals.fullInventoryRestores++;
      state.cubies = rotateSliceCubies(rotateSliceCubies(state.cubies, level.cubeSize, 'row', Math.floor(level.cubeSize / 2), 1), level.cubeSize, 'col', 0, -1);
      sim.powerups = [];
      for (let pulse = 0; pulse < Math.max(...Object.values(p.orbTargets)) + 2; pulse++) {
        p.orbRefillDelay = 0;
        replenishStoryOrbs(sim, p, state, level.cubeSize, .1);
      }
      assert.deepEqual(readColors(sim, state.cubies), p.orbTargets);
      evidence.rotatedRefills++; totals.rotatedRefills++;
    }
  }
  // Exhaust actual tunnel pairs without awarding task credit, then recover
  // each qualifier independently. Counting the opening queue alone missed
  // blocked mouths, surrounded unvisited pairs and a lone self-pass retry.
  for (const character of ['glow', 'classic']) {
    const goals = record.objectives.filter(o => ['healed', 'uniqueTunnels', 'selfPasses', 'multiHeals', 'ringHeals'].includes(o.key));
    for (const goal of goals) {
      const { sim, p, state } = setup(level, character, 'recovery:' + goal.key);
      sim.powerups = []; sim.specials = [];
      const pairs = () => getActiveTunnels(state.cubies, level.cubeSize);
      const close = pair => {
        for (const t of [pair.entry, pair.exit]) state.cubies = healSticker(state.cubies, level.cubeSize, t.x, t.y, t.z, t.dirKey);
      };
      const refill = () => {
        const replacement = replenishStoryTunnel(sim, p, state, level.cubeSize);
        if (replacement) { state.cubies = replacement; evidence.replacementPairs++; totals.replacementPairs++; }
        return replacement;
      };
      for (let missed = 0; missed < level.target + 3; missed++) {
        assert(pairs().length > 0, `level ${level.id}: exhausted ${goal.key}`);
        close(pairs()[0]); refill(); refill();
        assert.equal(pairs().length, 2, `level ${level.id}: ${goal.key} missed attempt ${missed}`);
        evidence.recoveryAttempts++; totals.recoveryAttempts++;
      }
      // Complete other qualifiers so only this particular task can keep supply alive.
      sim.healed = p.healTarget ?? 0;
      Object.assign(p.mechanics, p.tunnelGoals);
      if (p.traversalTarget && goal.key !== 'uniqueTunnels') {
        p.tunnels = new Set(Array.from({ length: p.traversalTarget }, (_, i) => `credited-${i}`));
      }
      if (goal.key === 'healed') sim.healed = 0;
      else if (goal.key !== 'uniqueTunnels') p.mechanics[goal.key] = 0;
      while (pairs().length) close(pairs()[0]);
      p.pendingMouths = [];
      for (let count = 0; count < goal.target; count++) {
        refill(); refill(); assert.equal(pairs().length, 2, `level ${level.id}: ${goal.key} attempt ${count}`);
        const pair = pairs()[0];
        if (goal.key === 'uniqueTunnels') {
          assert(!p.tunnels.has(pair.pairId)); p.tunnels.add(pair.pairId);
        } else if (goal.key === 'healed') sim.healed++;
        else recordStoryMechanic(p, goal.key);
        close(pair);
      }
      assert.equal(refill(), null); assert.equal(p.pendingMouths.length, 0);
      evidence.taskSupplyChecks++; totals.taskSupplyChecks++;
    }
    // Occupied queued mouths must not stall either traversal or repair supply.
    if (goals.length) {
      const { sim, p, state } = setup(level, character, 'blocked-mouths');
      const first = getActiveTunnels(state.cubies, level.cubeSize)[0].entry;
      state.cubies = flipStickerPair(state.cubies, level.cubeSize, first.x, first.y, first.z, first.dirKey, buildManifoldGridMap(state.cubies, level.cubeSize));
      sim.specials = []; sim.powerups = p.pendingMouths.map(key => findStickerByStableKey(state.cubies, level.cubeSize, key));
      const replacement = replenishStoryTunnel(sim, p, state, level.cubeSize);
      assert(replacement, `level ${level.id}: blocked mouths never recovered`);
      assert.equal(getActiveTunnels(replacement, level.cubeSize).length, 2);
      evidence.taskSupplyChecks++; totals.taskSupplyChecks++;
    }
  }
  // Source counter fixtures exercise action state transitions. They are not player runs.
  {
    const { sim, p } = setup(level, 'glow', 'counters'), m = level.mechanics ?? {};
    const tick = () => updateMastery(sim, p, level, .1);
    for (const [key, count] of Object.entries(m)) {
      if (['steamFusions', 'quenchFusions'].includes(key)) {
        for (let i = 0; i < count; i++) recordStoryMechanic(p, 'elementFusion', key === 'steamFusions' ? 'steam' : 'quench');
        assert.equal(p.mechanics[key], count);
      } else if (['elementPickups', 'uniqueElements'].includes(key)) {
        for (let i = 0; i < count; i++) recordStoryMechanic(p, 'elementPickups', storyElementTypes(level)[i % storyElementTypes(level).length]);
        const distinct = p.collectedElements.size;
        recordStoryMechanic(p, 'elementPickups', storyElementTypes(level)[0]); assert.equal(p.collectedElements.size, distinct);
        assert((key === 'uniqueElements' ? distinct : p.mechanics.elementPickups) >= count);
      } else if (key === 'elements') {
        for (const type of storyElementTypes(level).slice(0, count)) {
          sim.elementalType = type; sim.elementalT = 15; sim.elementalFocusT = 0; sim.waterMomentum = 1;
          if (type === 'fire') sim.elementalPatches.set('audit', { type: 'fire' });
          if (type === 'grass') recordStoryMechanic(p, 'grassLaunch');
          if (type === 'air') recordStoryMechanic(p, 'airLaunch');
          if (type === 'ice') { sim.isJumping = true; tick(); sim.isJumping = false; }
          for (let i = 0; i < 45; i++) tick();
          assert(p.elements.has(type));
        }
        sim.elementalT = 0;
      } else if (['boosts', 'doubleJumps', 'rockets', 'explodes', 'signatures'].includes(key)) {
        for (let i = 0; i < count; i++) {
          if (key === 'boosts') { sim.boostActiveT = 1; tick(); sim.boostActiveT = 0; }
          if (key === 'doubleJumps') { sim.isJumping = true; sim.jumpCount = 2; tick(); sim.isJumping = false; sim.jumpCount = 0; }
          if (key === 'rockets') { sim.rocketActive = true; tick(); sim.rocketActive = false; }
          if (key === 'explodes') { sim.explodeT = 12; sim.expansionAmount = .4; tick(); sim.explodeT = 0; tick(); assert.equal(p.mechanics.explodes ?? 0, i); sim.expansionAmount = 0; }
          if (key === 'signatures') { sim.signature.seq++; sim.signature.active = 1; }
          tick(); assert.equal(p.mechanics[key], i + 1);
        }
      } else continue;
      evidence.counters.push(key); totals.counterFixtures++;
    }
  }
  for (const character of ['glow', 'classic']) {
    const findings = assess(record, character).findings;
    evidence.findings.push(...findings.map(finding => ({ ...finding, character })));
  }
  record.runtimeAudit = evidence;
  if (level.id % 10 === 0) console.log(`Audited objective supply through level ${level.id}/${WORM_STORY_LEVELS.length}.`);
}
data.checks.extended = totals;
data.auditSummary = {
  newLevels: data.records.filter(r => r.config.id > 40).length,
  findings: data.records.flatMap(r => r.runtimeAudit.findings.map(f => ({ level: r.config.id, ...f }))),
  playthroughsVerified: false,
};
fs.writeFileSync(new URL('../dist/data.json',import.meta.url), JSON.stringify(data));
console.log(JSON.stringify({ result: 'passed', levels: data.records.length, ...totals, findings: data.auditSummary.findings.length }));
