import { describe, expect, it, vi } from 'vitest';
import * as storyMastery from '../worm/story/mastery.js';
import { STORY_WORLDS } from '../worm/story/worlds.js';
import { WORM_STORY_LEVELS } from '../worm/story/levels.js';
import { DEFAULT_SETTINGS, generateCampaign, generateLevel, modeledPowerBudget } from '../../tools/worm-level-auditor/web/generator.js';
import { assess, ELEMENTS, requiredPowerCycles } from '../../tools/worm-level-auditor/web/audit.js';
import { auditGeneratedLevel } from '../../tools/worm-level-auditor/scripts/generator-engine.mjs';

const templates = Object.entries(STORY_WORLDS).filter(([id]) => Number(id) <= 40).map(([, world]) => world);
const RECIPE = { ...DEFAULT_SETTINGS };

// The shipped campaign is authored (campaign.js); the seeded generator is a
// drafting workshop whose packs are copied in by hand.
describe('campaign drafting workshop', () => {
  it('drafts deterministically and never replaces the authored campaign', () => {
    const pack = generateCampaign(RECIPE, templates);
    expect(generateCampaign(RECIPE, templates)).toEqual(pack);
    expect(pack.levels.map(level => level.config.id)).toEqual(Array.from({ length: 80 }, (_, i) => i + 41));
    const authored = WORM_STORY_LEVELS.find(level => level.id === 41);
    expect(pack.levels[0].config.title).not.toBe(authored.title);
    expect(STORY_WORLDS[41].name).toBe('Galley Deck');
  });

  it('can extend a draft to 150 without changing earlier drafts', () => {
    const pack = generateCampaign(RECIPE, templates);
    const longer = generateCampaign({ ...RECIPE, total: 150 }, templates);
    expect(longer.levels.slice(0, 80).map(level => level.config)).toEqual(pack.levels.map(level => level.config));
    expect(longer.chapters.at(-1).id).toBe(15);
    for (const candidate of longer.levels.slice(80)) expect(auditGeneratedLevel(candidate).status).toBe('checked');
  });

  it.each([[[2]], [[3]], [[4]], [[15]]])('falls back to compatible objectives for a restricted %j board pool', sizes => {
    const pack = generateCampaign({ ...RECIPE, total: 50, sizes }, templates);
    for (const candidate of pack.levels) {
      expect(candidate.config.cubeSize).toBe(sizes[0]);
      expect(auditGeneratedLevel(candidate).status).toBe('checked');
    }
  });

  it('rejects impossible edits and flags inadequate time budgets', () => {
    const original = generateLevel(50, RECIPE, templates);
    for (const mutate of [draft => { draft.config.target = 7; },
      draft => { draft.config.mechanics.uniqueElements = ELEMENTS.length + 1; },
      draft => { draft.config.mechanics.unsupported = 1; },
      draft => { draft.world.route = 'missing'; }]) {
      const draft = structuredClone(original); mutate(draft);
      expect(auditGeneratedLevel(draft).status).toBe('invalid');
    }
    const short = structuredClone(original); short.config.limit = 60; short.config.par = 40;
    expect(auditGeneratedLevel(short).status).toBe('review');
  });

  it('rerolls one ID deterministically without changing other levels or leaving a draft world in the runtime', () => {
    const prior = STORY_WORLDS[50];
    const draft = generateLevel(50, RECIPE, templates, 1);
    expect(draft).toEqual(generateLevel(50, RECIPE, templates, 1));
    expect(draft.config).not.toEqual(generateLevel(50, RECIPE, templates).config);
    expect(auditGeneratedLevel(draft).status).toBe('checked');
    expect(STORY_WORLDS[50]).toBe(prior);
  });

  it.each(['elements', 'uniqueElements', 'elementPickups', 'fusions', 'uniqueFusions', 'steamFusions', 'quenchFusions'])(
    'audits center supplies separately from quest powers for %s', key => {
      const draft = generateLevel(50, RECIPE, templates);
      draft.config.mechanics = { [key]: 1, magnetOrbs: 4, explodes: 1, rockets: 1 };
      draft.config.limit = 10000;
      const result = auditGeneratedLevel(draft);
      expect(result.errors).toEqual([]);
      expect(result.status).toBe('checked');
      for (const stage of Object.values(result.record.stages)) {
        expect(stage.questCycle).toEqual(['magnet', 'explode', 'rocket']);
        expect(new Set(stage.centerElements)).toEqual(new Set(ELEMENTS));
        for (const type of [...ELEMENTS, ...stage.questCycle]) expect(stage.offered).toContain(type);
      }
    },
  );

  it.each(['center', 'quest'])('still rejects broken %s power supply', lane => {
    const offer = storyMastery.offerStoryPower;
    const spy = vi.spyOn(storyMastery, 'offerStoryPower').mockImplementation((sim, ...args) => {
      const changed = offer(sim, ...args);
      if (lane === 'center') sim.specials = sim.specials.filter(orb => orb.type !== 'air');
      else for (const orb of sim.specials) if (orb.type === 'magnet') orb.type = 'rocket';
      return changed;
    });
    try {
      const result = auditGeneratedLevel(generateLevel(50, RECIPE, templates));
      expect(result.status).toBe('invalid');
      expect(result.errors).toEqual([lane === 'center'
        ? 'Center supply does not replenish all six elements.'
        : 'Offered quest power does not match generated objectives.']);
    } finally { spy.mockRestore(); }
  });

  it.each(['elementPickups', 'magnetOrbs'])('rejects a 200 %s edit within a 500-second limit in both densities', key => {
    const draft = generateLevel(50, RECIPE, templates);
    draft.config.mechanics = { [key]: 200 };
    draft.config.limit = 500; draft.config.par = 350;
    const result = auditGeneratedLevel(draft);
    expect(result.errors).toEqual([]);
    expect(result.status).toBe('review');
    for (const character of ['glow', 'classic']) {
      const audit = assess(result.record, character);
      expect(audit.status).toBe('undersupplied');
      expect(audit.findings).toContainEqual(expect.objectContaining({ key: 'timing' }));
      expect(audit.powerBudget).toBeGreaterThan(500);
      expect(audit.powerBudget).toBe(modeledPowerBudget(draft.config));
    }
    draft.config.limit = 10000;
    // A long enough pack can still pass; quantities are valid schema values.
    if (key === 'magnetOrbs') expect(auditGeneratedLevel(draft).status).toBe('checked');
  });

  it('rounds magnet catch quantities up to four-catch offers while retaining the largest concurrent quest', () => {
    expect(requiredPowerCycles({ mechanics: { magnetOrbs: 8 } })).toBe(2);
    expect(requiredPowerCycles({ mechanics: { magnetOrbs: 9 } })).toBe(3);
    expect(requiredPowerCycles({ mechanics: { magnetOrbs: 13, elementPickups: 3, explodes: 5, rockets: 2 } })).toBe(5);
  });
});
