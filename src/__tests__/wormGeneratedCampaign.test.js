import { describe, expect, it } from 'vitest';
import { WORM_GENERATED_LEVELS, WORM_GENERATED_WORLDS, WORM_GENERATED_CHAPTERS, WORM_GENERATION_RECIPE } from '../worm/story/generated.js';
import { STORY_WORLDS } from '../worm/story/worlds.js';
import { generateCampaign, generateLevel } from '../../tools/worm-level-auditor/web/generator.js';
import { auditGeneratedLevel } from '../../tools/worm-level-auditor/scripts/generator-engine.mjs';

const templates = Object.entries(STORY_WORLDS).filter(([id]) => Number(id) <= 40).map(([, world]) => world);

describe('reusable campaign generator', () => {
  it('reproduces the integrated 80 levels, worlds and chapter metadata from the shipped recipe', () => {
    const pack = generateCampaign(WORM_GENERATION_RECIPE, templates);
    expect(pack.levels.map(level => level.config)).toEqual(WORM_GENERATED_LEVELS);
    expect(Object.fromEntries(pack.levels.map(level => [level.config.id, level.world]))).toEqual(WORM_GENERATED_WORLDS);
    expect(pack.chapters).toEqual(WORM_GENERATED_CHAPTERS);
    expect(WORM_GENERATED_LEVELS.map(level => level.id)).toEqual(Array.from({ length: 80 }, (_, i) => i + 41));
  });

  it('can extend to 150 without changing already generated levels', () => {
    const pack = generateCampaign({ ...WORM_GENERATION_RECIPE, total: 150 }, templates);
    expect(pack.levels.slice(0, 80).map(level => level.config)).toEqual(WORM_GENERATED_LEVELS);
    expect(pack.chapters.at(-1).id).toBe(15);
    for (const candidate of pack.levels.slice(80)) expect(auditGeneratedLevel(candidate).status).toBe('checked');
  });

  it.each([[[2]], [[3]], [[4]], [[15]]])('falls back to compatible objectives for a restricted %j board pool', sizes => {
    const pack = generateCampaign({ ...WORM_GENERATION_RECIPE, total: 50, sizes }, templates);
    for (const candidate of pack.levels) {
      expect(candidate.config.cubeSize).toBe(sizes[0]);
      expect(auditGeneratedLevel(candidate).status).toBe('checked');
    }
  });

  it('rejects impossible edits and flags inadequate time budgets', () => {
    const original = generateLevel(50, WORM_GENERATION_RECIPE, templates);
    for (const mutate of [draft => { draft.config.target = 7; },
      draft => { draft.config.mechanics.uniqueElements = 6; },
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
    const draft = generateLevel(50, WORM_GENERATION_RECIPE, templates, 1);
    expect(draft).toEqual(generateLevel(50, WORM_GENERATION_RECIPE, templates, 1));
    expect(draft.config).not.toEqual(WORM_GENERATED_LEVELS.find(level => level.id === 50));
    expect(auditGeneratedLevel(draft).status).toBe('checked');
    expect(STORY_WORLDS[50]).toBe(prior);
  });
});
