// A fusion is a reaction with its own look, not its two elements' skins stacked.
// These hold the catalogue (every dedicated reaction has a distinct look) and the
// reaction particles' motion (born on the cube, steam rises, sparks fall).
import { describe, it, expect } from 'vitest';
import { ORDERED_FUSIONS } from '../worm/healerWorm/elementalFusion.js';
import { ELEMENTAL_DEFS } from '../worm/healerWorm/elementalDefs.js';
import { FUSION_LOOKS, REACTION_PATTERNS, REACTION_PARTICLES, fusionLookOf, reactionPatternOf } from '../worm/healerWorm/fusionLooks.js';
import { makeReactionField, stepReactionField } from '../worm/healerWorm/fusionParticles.js';

const seeded = (seed = 7) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

describe('fusion looks', () => {
  it('gives every dedicated reaction a look of its own', () => {
    const ids = Object.values(ORDERED_FUSIONS).filter(f => f.rule).map(f => f.id).sort();
    expect(Object.keys(FUSION_LOOKS).sort()).toEqual(ids);
    const signatures = new Set();
    for (const id of ids) {
      const look = fusionLookOf(id);
      expect(REACTION_PATTERNS[look.pattern]).toBeTypeOf('number');
      expect(REACTION_PARTICLES[look.particle]).toBeDefined();
      for (const hex of [look.color, look.accent, look.glow, look.tint, look.tint2]) expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(look.depth).toBeGreaterThan(0);
      expect(look.depth).toBeLessThanOrEqual(0.12);
      expect(reactionPatternOf(id)).toBe(REACTION_PATTERNS[look.pattern]);
      signatures.add(`${look.pattern}|${look.color}|${look.particle}`);
    }
    expect(signatures.size).toBe(20);
  });

  it('never reuses either element\'s own colour as a reaction\'s main colour', () => {
    for (const recipe of Object.values(ORDERED_FUSIONS).filter(f => f.rule)) {
      const look = fusionLookOf(recipe.id);
      expect(look.color.toLowerCase()).not.toBe(ELEMENTAL_DEFS[recipe.base].color.toLowerCase());
      expect(look.color.toLowerCase()).not.toBe(ELEMENTAL_DEFS[recipe.catalyst].color.toLowerCase());
    }
  });

  it('makes the reverse order of a pair look different', () => {
    for (const recipe of Object.values(ORDERED_FUSIONS).filter(f => f.rule)) {
      const reverse = Object.values(ORDERED_FUSIONS).filter(f => f.rule).find(f => f.base === recipe.catalyst && f.catalyst === recipe.base);
      const a = fusionLookOf(recipe.id), b = fusionLookOf(reverse.id);
      expect(a.pattern !== b.pattern || a.particle !== b.particle || a.color !== b.color).toBe(true);
    }
  });

  it('Steam boils off steam clouds', () => {
    expect(fusionLookOf('steam')).toMatchObject({ pattern: 'mist', particle: 'steam' });
    expect(fusionLookOf('nonsense')).toBeNull();
  });
});

describe('reaction particles', () => {
  const SIZE = 3;
  const run = (kind, seconds, opts = {}) => {
    const field = makeReactionField(40);
    const rand = seeded();
    for (let t = 0; t < seconds; t += 0.05) stepReactionField(field, 0.05, { cfg: REACTION_PARTICLES[kind], size: SIZE, rand, ...opts });
    return field;
  };

  it('are born on the cube\'s faces', () => {
    const field = makeReactionField(60);
    stepReactionField(field, 0, { cfg: REACTION_PARTICLES.steam, size: SIZE, rand: seeded(3) });
    for (let i = 0; i < field.count; i++) {
      const m = Math.max(Math.abs(field.pos[i * 3]), Math.abs(field.pos[i * 3 + 1]), Math.abs(field.pos[i * 3 + 2]));
      expect(m).toBeCloseTo(SIZE / 2 + 0.06, 5);
    }
  });

  it('steam rises and swells; sparks fall', () => {
    const steam = REACTION_PARTICLES.steam;
    const field = makeReactionField(1);
    const rand = seeded(11);
    stepReactionField(field, 0, { cfg: steam, size: SIZE, rand });
    field.age[0] = 0;
    const y0 = field.pos[1];
    field.vel[0] = field.vel[1] = field.vel[2] = 0;
    for (let i = 0; i < 20; i++) stepReactionField(field, 0.05, { cfg: steam, size: SIZE, rand });
    expect(field.pos[1]).toBeGreaterThan(y0);
    expect(field.size[0]).toBeGreaterThan(steam.size);

    const sparks = REACTION_PARTICLES.sparks;
    const spark = makeReactionField(1);
    stepReactionField(spark, 0, { cfg: sparks, size: SIZE, rand });
    spark.age[0] = 0;
    spark.vel[0] = spark.vel[1] = spark.vel[2] = 0;
    const s0 = spark.pos[1];
    for (let i = 0; i < 6; i++) stepReactionField(spark, 0.05, { cfg: sparks, size: SIZE, rand });
    expect(spark.pos[1]).toBeLessThan(s0);
  });

  it('stops being born when the wash ends, and every particle fades out', () => {
    const field = run('steam', 3);
    expect(Array.from(field.alpha).some(a => a > 0)).toBe(true);
    const rand = seeded(5);
    for (let t = 0; t < 4; t += 0.05) stepReactionField(field, 0.05, { cfg: REACTION_PARTICLES.steam, size: SIZE, rand, emitting: false });
    expect(Array.from(field.alpha).every(a => a === 0)).toBe(true);
  });

  it('boils off the worm\'s own body', () => {
    const worm = { positions: new Float32Array([0.2, 1.62, -0.3]), count: 1 };
    const field = makeReactionField(30);
    stepReactionField(field, 0, { cfg: { ...REACTION_PARTICLES.steam, worm: 1 }, size: SIZE, worm, rand: seeded(9) });
    for (let i = 0; i < field.count; i++) {
      expect(field.pos[i * 3]).toBeCloseTo(0.2, 5);
      expect(field.pos[i * 3 + 1]).toBeCloseTo(1.68, 5);
    }
  });
});
