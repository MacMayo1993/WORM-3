// Every fusion wears a look of its own: its coat family and palette (fusionLooks.js),
// a sigil no recipe of the same family shares (fusionSigils.js), and a particle motion
// no recipe of the same particle kind shares. These hold the catalogue to that, the
// reaction coat and HUD to the same sigil, and each motion to what it promises.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ORDERED_FUSIONS } from '../worm/healerWorm/elementalFusion.js';
import { FUSION_LOOKS, REACTION_MOTIONS, REACTION_PARTICLES, reactionMotionOf, fusionLookOf } from '../worm/healerWorm/fusionLooks.js';
import { SIGILS, SIGIL_ICONS, GLSL_SIGILS, sigilIdOf } from '../worm/healerWorm/fusionSigils.js';
import { makeReactionField, stepReactionField } from '../worm/healerWorm/fusionParticles.js';
import { getReactionSurfaceMaterial } from '../worm/ElementalSurface.jsx';
import FusionSigilIcon from '../worm/FusionSigilIcon.jsx';

const recipes = Object.values(ORDERED_FUSIONS);
const reverseOf = r => recipes.find(f => f.base === r.catalyst && f.catalyst === r.base);

describe('fusion signatures', () => {
  it('gives every recipe a sigil, a sigil colour, a motion and its four numbers', () => {
    for (const { id } of recipes) {
      const look = fusionLookOf(id);
      expect(SIGILS[look.sigil], id).toBeTypeOf('number');
      expect(look.sigilColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(REACTION_MOTIONS[look.motion], id).toBeTypeOf('number');
      expect(look.sigilParams).toHaveLength(4);
      for (const v of look.sigilParams) expect(v).toBeGreaterThan(0);
      expect(look.sigilParams[2]).toBeLessThanOrEqual(1);
    }
  });

  it('never repeats a family and sigil, nor a particle kind and motion', () => {
    const coats = new Set(recipes.map(({ id }) => `${FUSION_LOOKS[id].pattern}|${FUSION_LOOKS[id].sigil}`));
    const clouds = new Set(recipes.map(({ id }) => `${FUSION_LOOKS[id].particle}|${FUSION_LOOKS[id].motion}`));
    expect(coats.size).toBe(recipes.length);
    expect(clouds.size).toBe(recipes.length);
  });

  it('wears each sigil at most twice, and never on a pair and its reverse', () => {
    const uses = {};
    for (const { id } of recipes) uses[FUSION_LOOKS[id].sigil] = (uses[FUSION_LOOKS[id].sigil] ?? 0) + 1;
    for (const count of Object.values(uses)) expect(count).toBeLessThanOrEqual(2);
    for (const recipe of recipes) expect(FUSION_LOOKS[recipe.id].sigil).not.toBe(FUSION_LOOKS[reverseOf(recipe).id].sigil);
  });

  it('draws every sigil the shader knows, and has an icon for each', () => {
    for (const [name, id] of Object.entries(SIGILS)) {
      expect(GLSL_SIGILS).toContain(`uSigil == ${id})`);
      expect(SIGIL_ICONS[name], name).toMatch(/^M/);
    }
    expect(sigilIdOf('nonsense')).toBe(-1);
  });

  it('hands the reaction coat its recipe\'s sigil', () => {
    for (const { id } of recipes) {
      const look = FUSION_LOOKS[id];
      const mat = getReactionSurfaceMaterial(id, look, 0);
      expect(mat.uniforms.uSigil.value).toBe(SIGILS[look.sigil]);
      expect(mat.uniforms.uSigilParams.value.toArray()).toEqual([...look.sigilParams]);
      expect(mat.fragmentShader).toContain('sigilAt(');
    }
  });

  it('shows the same sigil in the HUD', () => {
    const html = renderToStaticMarkup(<FusionSigilIcon recipe="steam" size={24} />);
    expect(html).toContain('data-sigil="bubbles"');
    expect(html).toContain(SIGIL_ICONS.bubbles);
    expect(renderToStaticMarkup(<FusionSigilIcon recipe="nonsense" />)).toBe('');
  });
});

describe('reaction particle motions', () => {
  const SIZE = 3;
  const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  // One particle, born, then stepped with its own buoyancy switched off so only the motion acts.
  const fly = (motion, { steps = 20, worm = null, place = [1.6, 0, 0] } = {}) => {
    const cfg = { ...REACTION_PARTICLES.spores, buoy: 0, drag: 0, life: 99, worm: 0 };
    const field = makeReactionField(1);
    const rand = seeded(13);
    stepReactionField(field, 0, { cfg, size: SIZE, rand, motion: REACTION_MOTIONS[motion], worm });
    field.age[0] = 0; field.life[0] = 99;
    field.pos.set(place); field.vel.fill(0);
    const start = Array.from(field.pos);
    for (let i = 0; i < steps; i++) stepReactionField(field, 0.05, { cfg, size: SIZE, rand, motion: REACTION_MOTIONS[motion], worm });
    return { start, pos: Array.from(field.pos), vel: Array.from(field.vel) };
  };

  it('a rising particle with no buoyancy only wanders; a swirl wheels round the vertical axis', () => {
    const rise = fly('rise');
    expect(Math.hypot(rise.pos[0] - 1.6, rise.pos[1], rise.pos[2])).toBeLessThan(0.08);
    const swirl = fly('swirl');
    expect(swirl.pos[2]).toBeGreaterThan(0.1);   // from +x, counter-clockwise toward +z
    expect(swirl.pos[1]).toBeCloseTo(0, 5);
  });

  it('a spiral wheels, pulls in and lifts', () => {
    const { pos } = fly('spiral');
    expect(pos[1]).toBeGreaterThan(0.05);
    expect(Math.hypot(pos[0], pos[2])).toBeLessThan(1.6);
  });

  it('a gust blows sideways, a fountain falls back, a hover holds still', () => {
    expect(fly('gust').pos[0]).toBeGreaterThan(1.7);
    expect(fly('fountain').vel[1]).toBeLessThan(0);
    const hover = fly('hover');
    expect(Math.hypot(hover.pos[0] - 1.6, hover.pos[1], hover.pos[2])).toBeLessThan(0.08);
  });

  it('a zigzag hops in sharp jumps', () => {
    const { pos, start } = fly('zigzag', { steps: 10 });
    expect(Math.abs(pos[0] - start[0]) + Math.abs(pos[2] - start[2])).toBeGreaterThan(0.05);
  });

  it('an orbit circles the worm\'s head and stays near its ring', () => {
    const worm = { positions: new Float32Array([0, 1.6, 0]), count: 1 };
    const { pos } = fly('orbit', { worm, place: [0.7, 1.6, 0], steps: 120 });
    const r = Math.hypot(pos[0], pos[1] - 1.6, pos[2]);
    expect(r).toBeGreaterThan(0.5);
    expect(r).toBeLessThan(0.9);
    expect(Math.abs(pos[2])).toBeGreaterThan(0.1);
  });

  it('every recipe resolves its motion', () => {
    for (const { id } of recipes) expect(reactionMotionOf(id)).toBe(REACTION_MOTIONS[FUSION_LOOKS[id].motion]);
    expect(reactionMotionOf('nonsense')).toBe(0);
  });
});
