// Two elements at once: claiming an element while another's wash is up fuses them.
// These pin the claim rules, that every element check sees both halves of a pair,
// and the four fusions with rules of their own (Steam, Slipstream, Wildfire,
// Thunderpad).
import { describe, it, expect } from 'vitest';
import {
  ORDERED_FUSIONS, fusionEffect, fusionKey, getFusion, hasElement, activeFusion, fusionOf, claimElement
} from '../worm/healerWorm/elementalFusion.js';
import { ELEMENTAL_TYPES } from '../worm/healerWorm/elementalDefs.js';
import { makeWormSim, resetWormSim, stepWormSim, startElemental, startJump } from '../worm/healerWorm/wormSim.js';
import {
  addElementalPatch, chargeSpringPad, steamTiles, waterSpeedBonus, turnShedsMomentum, iceHoldsTurn,
  tickElementalGameplay, isHotTile, isObsidianTile, isFirebreakTile, rotateElementalPatches, ELEMENTAL_PATCH_LIMIT, CHARGED_SPRING_SPAN, CHARGED_SPRING_HEIGHT
} from '../worm/healerWorm/elementalGameplay.js';
import { pickStrikeTile } from '../worm/healerWorm/lightningStorm.js';
import { elementalFeedback } from '../worm/healerWorm/elementalFeedback.js';
import { springSlamTiles } from '../worm/healerWorm/jumpLanding.js';
import { ELEMENTAL_DURATION } from '../worm/healerWorm/constants.js';

const SIZE = 5;
const key = (t) => `${t.x},${t.y},${t.z},${t.dirKey}`;

function makeCtx() {
  const events = [];
  return {
    events,
    feel: () => {},
    onElementalTheme: (...a) => events.push(a),
    onStoryMechanic: (...a) => events.push(['story', ...a]),
    onRocketState: () => {}, onMagnetState: () => {},
    getSpeed: () => 1.0, getCubies: () => null, getGamePhase: () => 'active', isPaused: () => false,
    getControlMode: () => 'non-oriented', getWormholeInterval: () => 9999, isPrismCharacter: () => false,
    getOrbInventory: () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }), getHealingProgress: () => ({}),
    getOrbColor: () => '#22ff88', resolveTunnel: () => null,
    onDeath: () => {}, onTunnelEnter: () => {}, onCrawlResume: () => {}, onPhase: () => {}, onBoostState: () => {},
    onSurvivalTick: () => {}, spawnWormholePair: () => {}, onFlippedTile: () => {}, applyDeposit: () => {},
    onOrbPickup: () => {}, onPowerupsChanged: () => {}, applyHeal: () => {},
    onSpecialsChanged: () => {}, onSpecialSpawned: () => {}, onSpecialExpired: () => {},
  };
}

function makeSim() {
  const sim = makeWormSim(SIZE);
  resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
  return sim;
}

function fused(a, b) {
  const sim = makeSim();
  const ctx = makeCtx();
  startElemental(sim, ctx, a);
  startElemental(sim, ctx, b);
  return { sim, ctx };
}

describe('fusion catalogue', () => {
  it('names all twenty ordered pairs exactly once', () => {
    const keys = new Set();
    for (const a of ELEMENTAL_TYPES) for (const b of ELEMENTAL_TYPES) if (a !== b) keys.add(fusionKey(a, b));
    expect([...keys].sort()).toEqual(Object.keys(ORDERED_FUSIONS).sort());
    expect(keys.size).toBe(20);
    expect(getFusion('water', 'fire').id).toBe('steam');
    expect(getFusion('fire', 'water').id).toBe('quench');
    expect(fusionKey('water', 'water')).toBeNull();
    expect(fusionKey('water', 'rocket')).toBeNull();
  });

  it('separates shipped rules from explicit reverse-order fallbacks', () => {
    const ruled = Object.values(ORDERED_FUSIONS).filter(f => f.rule).map(f => f.id).sort();
    expect(ruled).toEqual(['quench', 'slipstream', 'steam', 'thunderpad', 'wildfire']);
    expect(getFusion('fire', 'water').id).toBe('quench');
    expect(getFusion('ice', 'water').id).toBe('frozen-wake');
    expect(fusionEffect(getFusion('ice', 'water'))).toBe('slipstream');
    expect(getFusion('grass', 'fire').id).toBe('emberseed');
    expect(fusionEffect(getFusion('grass', 'fire'))).toBe('wildfire');
    expect(getFusion('lightning', 'grass').id).toBe('grounded');
    expect(fusionEffect(getFusion('lightning', 'grass'))).toBe('thunderpad');
  });
});

describe('claiming into a fusion', () => {
  it.each(Object.values(ORDERED_FUSIONS))('$label retains both mechanics and emits a fusion cue only on a new pairing', recipe => {
    const sim = makeSim(), ctx = makeCtx(), sounds = [];
    ctx.feel = sound => sounds.push(sound);
    startElemental(sim, ctx, recipe.base);
    expect(sounds).not.toContain('elementFusion');
    startElemental(sim, ctx, recipe.catalyst);
    expect(sounds.at(-1)).toBe('elementFusion');
    expect(hasElement(sim, recipe.base)).toBe(true);
    expect(hasElement(sim, recipe.catalyst)).toBe(true);
    startElemental(sim, ctx, recipe.catalyst);
    expect(sounds.filter(sound => sound === 'elementFusion')).toHaveLength(1);
  });
  it('fuses a second element, refreshes on a repeat, and lets a third replace the older', () => {
    expect(claimElement(null, null, 'water')).toEqual({ type: 'water', pair: null, fused: false });
    expect(claimElement('water', null, 'fire')).toEqual({ type: 'fire', pair: 'water', fused: true });
    expect(claimElement('fire', 'water', 'fire')).toEqual({ type: 'fire', pair: 'water', fused: false });
    expect(claimElement('fire', 'water', 'water')).toEqual({ type: 'water', pair: 'fire', fused: true });
    // Water was the older of the two, so ice replaces it and fuses with fire.
    expect(claimElement('fire', 'water', 'ice')).toEqual({ type: 'ice', pair: 'fire', fused: true });
  });

  it('runs both elements on one refreshed clock and tells the renderer the partner', () => {
    const { sim, ctx } = fused('water', 'fire');
    expect(sim.elementalType).toBe('fire');
    expect(sim.elementalPair).toBe('water');
    expect(sim.elementalT).toBe(ELEMENTAL_DURATION);
    expect(hasElement(sim, 'water')).toBe(true);
    expect(hasElement(sim, 'fire')).toBe(true);
    expect(hasElement(sim, 'ice')).toBe(false);
    expect(activeFusion(sim)).toBe('steam');
    expect(ctx.events).toContainEqual(['fire', ELEMENTAL_DURATION, 'water']);
    expect(ctx.events).toContainEqual(['story', 'elementFusion', 'steam']);
    startElemental(sim, ctx, 'ice');
    expect([sim.elementalType, sim.elementalPair]).toEqual(['ice', 'fire']);
  });

  it('ends both halves together when the wash runs out', () => {
    const { sim, ctx } = fused('water', 'ice');
    sim.elementalFocusT = 0;
    sim.elementalT = 0.01;
    stepWormSim(sim, 0.05, SIZE, ctx);
    expect(sim.elementalType).toBeNull();
    expect(sim.elementalPair).toBeNull();
    expect(hasElement(sim, 'water')).toBe(false);
    expect(ctx.events.at(-1)).toEqual([null, 0, null]);
  });

  it('keeps the partner element working: ice still holds turns when water is the newest', () => {
    const { sim } = fused('ice', 'water');
    sim.interpT = 0.5;
    expect(iceHoldsTurn(sim, 0.01, 0.4)).toBe(true);
    tickElementalGameplay(sim, 1);
    expect(sim.waterMomentum).toBeGreaterThan(0.5);
  });

  it('reads the same fusion from the render side', () => {
    expect(fusionOf('grass', 'lightning', 3)).toBe('thunderpad');
    expect(fusionOf('grass', 'lightning', 0)).toBeNull();
    expect(fusionOf('grass', null, 3)).toBeNull();
  });
});

describe('Slipstream (water + ice)', () => {
  it('keeps momentum through turns and is worth 40% instead of 25%', () => {
    const water = makeSim();
    startElemental(water, makeCtx(), 'water');
    expect(waterSpeedBonus(water)).toBe(0.25);
    expect(turnShedsMomentum(water)).toBe(true);
    const { sim } = fused('water', 'ice');
    expect(waterSpeedBonus(sim)).toBe(0.4);
    expect(turnShedsMomentum(sim)).toBe(false);
  });

  it('shows the Slipstream bonus in the HUD readout', () => {
    expect(elementalFeedback('water', { waterMomentum: 1 }, 'slipstream')).toEqual({ text: 'Slipstream +40% · Turns keep momentum', fraction: 1 });
  });
});

describe('Steam (water + fire)', () => {
  it('turns the fire trail into a wall that joins the Glow Worm\'s light', () => {
    const { sim } = fused('water', 'fire');
    const a = { x: 0, y: 2, z: 4, dirKey: 'PZ' }, b = { x: 1, y: 2, z: 4, dirKey: 'PZ' };
    addElementalPatch(sim, a, 'fire');
    addElementalPatch(sim, b, 'grass');
    const wall = steamTiles(sim, new Set(['light']));
    expect([...wall].sort()).toEqual([key(a), 'light'].sort());
  });

  it('is only steam while both halves are up', () => {
    const sim = makeSim();
    startElemental(sim, makeCtx(), 'fire');
    addElementalPatch(sim, { x: 0, y: 2, z: 4, dirKey: 'PZ' }, 'fire');
    expect(steamTiles(sim, null)).toBeNull();
    const light = new Set(['light']);
    expect(steamTiles(sim, light)).toBe(light);
  });
});

describe('Thunderpad (nature + lightning)', () => {
  it('charges a struck spring pad and leaves a fire patch alone', () => {
    const { sim } = fused('grass', 'lightning');
    const pad = { x: 0, y: 2, z: 4, dirKey: 'PZ' }, fire = { x: 1, y: 2, z: 4, dirKey: 'PZ' };
    addElementalPatch(sim, pad, 'grass');
    addElementalPatch(sim, fire, 'fire');
    expect(chargeSpringPad(sim.elementalPatches, pad)).toBe(true);
    expect(sim.elementalPatches.get(key(pad)).charged).toBe(true);
    expect(chargeSpringPad(sim.elementalPatches, key(fire))).toBe(false);
  });

  it('launches rocket-high from a charged pad', () => {
    const { sim } = fused('grass', 'lightning');
    addElementalPatch(sim, sim.pos, 'grass');
    chargeSpringPad(sim.elementalPatches, sim.pos);
    startJump(sim, { feel() {}, onStoryMechanic() {} });
    expect(sim.jumpSpan).toBe(CHARGED_SPRING_SPAN);
    expect(sim.jumpHeight).toBe(CHARGED_SPRING_HEIGHT);
    expect(sim.springLaunch).toBe(true);
  });

  it('lets the storm aim for a free pad', () => {
    const pad = { x: 0, y: 2, z: 4, dirKey: 'PZ' };
    const tiles = [{ x: 4, y: 4, z: 4, dirKey: 'PZ' }];
    expect(pickStrikeTile({ tiles, body: [], avoid: new Set(), pads: [pad] }, () => 0)).toBe(pad);
    // A pad under the head's safe ring is never aimed at.
    expect(pickStrikeTile({ tiles, body: [], avoid: new Set([key(pad)]), pads: [pad] }, () => 0)).toBe(tiles[0]);
  });
});

describe('Wildfire (fire + nature)', () => {
  it('sets the 3x3 around a spring landing alight and hands the mode a burst', () => {
    const { sim, ctx } = fused('fire', 'grass');
    sim.elementalFocusT = 0;
    sim.isJumping = true;
    sim.jumpT = 0.9999;
    sim.springLaunch = true;
    stepWormSim(sim, 0.05, SIZE, ctx);
    expect(sim.isJumping).toBe(false);
    expect(sim.springLaunch).toBe(false);
    expect(sim.fusionBurst).toMatchObject({ seq: 1, kind: 'wildfire' });
    const burning = springSlamTiles(sim.fusionBurst.tile, SIZE);
    for (const k of burning) expect(sim.elementalPatches.get(k)?.type === 'fire' || sim.elementalPatches.get(k)?.type === 'grass').toBe(true);
  });

  it('does not burst from an ordinary jump', () => {
    const { sim, ctx } = fused('fire', 'grass');
    sim.elementalFocusT = 0;
    sim.isJumping = true;
    sim.jumpT = 0.9999;
    stepWormSim(sim, 0.05, SIZE, ctx);
    expect(sim.fusionBurst).toBeNull();
  });
});


describe('Quench (Fire → Water)', () => {
  it('converts existing fire and lays persistent obsidian without hot-tile effects', () => {
    const sim = makeSim(), ctx = makeCtx();
    startElemental(sim, ctx, 'fire');
    addElementalPatch(sim, sim.pos, 'fire');
    expect(isHotTile(sim.elementalPatches, sim.pos)).toBe(true);
    startElemental(sim, ctx, 'water');
    expect(activeFusion(sim)).toBe('quench');
    expect(sim.elementalPatches.get(key(sim.pos))).toMatchObject({ obsidian: true, ttl: 8 });
    expect(isFirebreakTile(sim.elementalPatches, sim.pos)).toBe(true);
    expect(isHotTile(sim.elementalPatches, sim.pos)).toBe(false);
    expect(steamTiles(sim)).toBeNull();
    expect(turnShedsMomentum(sim)).toBe(false);
    expect(waterSpeedBonus(sim)).toBe(0.25);
    const other = { ...sim.pos, x: 0 };
    addElementalPatch(sim, other, 'fire');
    expect(isObsidianTile(sim.elementalPatches, other)).toBe(true);
    sim.elementalT = 0;
    tickElementalGameplay(sim, 3.1);
    expect(isFirebreakTile(sim.elementalPatches, sim.pos)).toBe(true);
    expect(turnShedsMomentum(sim)).toBe(true);
    tickElementalGameplay(sim, 5);
    expect(sim.elementalPatches.size).toBe(0);
  });

  it('only preserves turns on obsidian, and reversing the pair changes the effect once', () => {
    const { sim, ctx } = fused('fire', 'water');
    expect(turnShedsMomentum(sim)).toBe(true);
    addElementalPatch(sim, sim.pos, 'fire');
    expect(turnShedsMomentum(sim)).toBe(false);
    startElemental(sim, ctx, 'fire');
    expect(activeFusion(sim)).toBe('steam');
    expect(turnShedsMomentum(sim)).toBe(true);
    expect(steamTiles(sim)).toBeNull(); // old obsidian does not suddenly become hot
    addElementalPatch(sim, sim.pos, 'fire');
    expect(isHotTile(sim.elementalPatches, sim.pos)).toBe(true);
    expect(steamTiles(sim).has(key(sim.pos))).toBe(true);
    startElemental(sim, ctx, 'fire'); // catalyst refresh: no duplicate objective
    expect(ctx.events.filter(e => e[1] === 'elementFusion').map(e => e[2])).toEqual(['quench', 'steam']);
  });

  it('holds its lifetime on pause and through focus, rotates with the tile, and stays bounded', () => {
    const { sim, ctx } = fused('fire', 'water');
    addElementalPatch(sim, sim.pos, 'fire');
    const pad = sim.elementalPatches.get(key(sim.pos));
    ctx.isPaused = () => true;
    stepWormSim(sim, 0.1, SIZE, ctx);
    expect(pad.ttl).toBe(8);
    ctx.isPaused = () => false;
    stepWormSim(sim, 0.1, SIZE, ctx); // claim focus still holds it
    expect(pad.ttl).toBe(8);
    rotateElementalPatches(sim, tile => ({ ...tile, x: 0 }));
    expect(isObsidianTile(sim.elementalPatches, { ...sim.pos, x: 0 })).toBe(true);
    for (let i = 0; i < 50; i++) addElementalPatch(sim, { x: i % 5, y: Math.floor(i / 5) % 5, z: 4, dirKey: i < 25 ? 'PZ' : 'NZ' }, 'fire');
    expect(sim.elementalPatches.size).toBe(ELEMENTAL_PATCH_LIMIT);
    resetWormSim(sim, SIZE, { orbCount: 0 });
    expect(sim.elementalPatches.size).toBe(0);
    expect(activeFusion(sim)).toBeNull();
  });
});
