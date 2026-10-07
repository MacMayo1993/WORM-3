import fs from 'node:fs';
import assert from 'node:assert/strict';
import { WORM_STORY_LEVELS } from '../../../src/worm/story/levels.js';
import { stageStory, replenishStoryOrbs, replenishStoryTunnel } from '../../../src/worm/story/runtime.js';
import { updateMastery, recordStoryMechanic, nextStoryPower, offerStoryPower, STORY_ELEMENTS } from '../../../src/worm/story/mastery.js';
import { makeWormSim, tileKey } from '../../../src/worm/healerWorm/wormSim.js';
import { getActiveTunnels } from '../../../src/worm/wormLogic.js';
import { buildManifoldGridMap, flipStickerPair } from '../../../src/game/manifoldLogic.js';
import { rotateSliceCubies } from '../../../src/game/cubeRotation.js';
import { orbCreditFace } from '../../../src/worm/healerWorm/economy.js';
import { resetLiveRotation } from '../../../src/worm/liveRotation.js';
import { seededRandom } from '../web/generator.js';
import { assess } from '../web/audit.js';

const data = JSON.parse(fs.readFileSync(new URL('../dist/data.json',import.meta.url)));
const seeds = ['opening', 'dense', 'seams', 'recovery', 'sparse', 'repeat'];
const totals = { seeds: seeds.length, stages: 0, powerOffers: 0, fullInventoryRestores: 0, rotatedRefills: 0, replacementPairs: 0, counterFixtures: 0 };
const setup = (level, character, seed) => {
  resetLiveRotation(); const sim = makeWormSim(level.cubeSize);
  sim.rand = seededRandom(seed + ':' + level.id + ':' + character);
  const p = stageStory(sim, level.cubeSize, level, character);
  return { sim, p, state: { cubies: p.cubies, wormPaused: false, animState: null } };
};
const readColors = (sim, cubies) => sim.powerups.reduce((counts, orb) => {
  const color = cubies[orb.x][orb.y][orb.z].stickers[orb.dirKey].orig;
  counts[color] = (counts[color] ?? 0) + 1; return counts;
}, {});

for (const level of WORM_STORY_LEVELS) {
  const record = data.records.find(r => r.config.id === level.id);
  const evidence = { variationStages: 0, repeatedPowerOffers: 0, fullInventoryRestores: 0, rotatedRefills: 0, replacementPairs: 0, counters: [], findings: [] };
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
      for (let i = 0; i < cycle.length * 3; i++) {
        sim.specials = []; p.powerDelay = 0;
        assert.equal(nextStoryPower(p, level), cycle[i % cycle.length]);
        assert(offerStoryPower(sim, p, level, level.cubeSize, state.cubies));
        assert.equal(sim.specials[0].type, cycle[i % cycle.length]);
        assert(!sim.powerups.some(orb => tileKey(orb) === tileKey(sim.specials[0])));
        evidence.repeatedPowerOffers++; totals.powerOffers++;
      }
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
  // Close each actual pair and exercise the real replacement transaction.
  {
    const { sim, p, state } = setup(level, 'glow', 'replacement');
    sim.powerups = []; sim.specials = [];
    const pairs = ['tunnel', 'collector', 'restore', 'mastery'].includes(level.kind) ? level.target : 0;
    let closed = 0;
    while (getActiveTunnels(state.cubies, level.cubeSize).length) {
      const mouth = getActiveTunnels(state.cubies, level.cubeSize)[0].entry;
      state.cubies = flipStickerPair(state.cubies, level.cubeSize, mouth.x, mouth.y, mouth.z, mouth.dirKey, buildManifoldGridMap(state.cubies, level.cubeSize));
      closed++; assert(closed <= pairs);
      const before = p.pendingMouths.length;
      const replacement = replenishStoryTunnel(sim, p, state, level.cubeSize);
      if (replacement) { state.cubies = replacement; assert.equal(p.pendingMouths.length, before - 1); evidence.replacementPairs++; totals.replacementPairs++; }
    }
    assert.equal(closed, pairs); assert.equal(p.pendingMouths.length, 0);
  }
  // Source counter fixtures exercise action state transitions. They are not player runs.
  {
    const { sim, p } = setup(level, 'glow', 'counters'), m = level.mechanics ?? {};
    const tick = () => updateMastery(sim, p, level, .1);
    for (const [key, count] of Object.entries(m)) {
      if (['elementPickups', 'uniqueElements'].includes(key)) {
        for (let i = 0; i < count; i++) recordStoryMechanic(p, 'elementPickups', STORY_ELEMENTS[i % STORY_ELEMENTS.length]);
        const distinct = p.collectedElements.size;
        recordStoryMechanic(p, 'elementPickups', 'water'); assert.equal(p.collectedElements.size, distinct);
        assert((key === 'uniqueElements' ? distinct : p.mechanics.elementPickups) >= count);
      } else if (key === 'elements') {
        for (const type of STORY_ELEMENTS.slice(0, count)) {
          sim.elementalType = type; sim.elementalT = 15; sim.elementalFocusT = 0; sim.waterMomentum = 1;
          if (type === 'fire') sim.elementalPatches.set('audit', { type: 'fire' });
          if (type === 'grass') recordStoryMechanic(p, 'grassLaunch');
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
}
data.checks.extended = totals;
data.auditSummary = {
  newLevels: data.records.filter(r => r.config.id > 40).length,
  findings: data.records.flatMap(r => r.runtimeAudit.findings.map(f => ({ level: r.config.id, ...f }))),
  playthroughsVerified: false,
};
fs.writeFileSync(new URL('../dist/data.json',import.meta.url), JSON.stringify(data));
console.log(JSON.stringify({ result: 'passed', levels: data.records.length, ...totals, findings: data.auditSummary.findings.length }));
