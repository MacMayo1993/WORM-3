// Two elements at once: claiming an element while another's wash is up fuses them.
// These pin the claim rules, that every element check sees both halves of a pair,
// and that each of the twenty ordered fusions runs a rule of its own.
import { describe, it, expect } from 'vitest';
import {
  ORDERED_FUSIONS, fusionEffect, fusionKey, getFusion, hasElement, activeFusion, fusionOf, claimElement
} from '../worm/healerWorm/elementalFusion.js';
import { ELEMENTAL_TYPES } from '../worm/healerWorm/elementalDefs.js';
import { makeWormSim, resetWormSim, stepWormSim, startElemental, startJump } from '../worm/healerWorm/wormSim.js';
import {
  addElementalPatch, chargeSpringPad, steamTiles, waterSpeedBonus, turnShedsMomentum, iceHoldsTurn,
  tickElementalGameplay, isHotTile, isObsidianTile, isFirebreakTile, rotateElementalPatches, ELEMENTAL_PATCH_LIMIT, CHARGED_SPRING_SPAN, CHARGED_SPRING_HEIGHT,
  isColdTile, isFrostTile, isMeltTile, frostTiles, fusionSpeedBonus, FUSION
} from '../worm/healerWorm/elementalGameplay.js';
import { pickStrikeTile, makeStorm, beginStorm, tickStorm, STORM } from '../worm/healerWorm/lightningStorm.js';
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

  it('gives every ordered recipe a rule of its own, different from its reverse', () => {
    const recipes = Object.values(ORDERED_FUSIONS);
    expect(recipes.every(f => f.rule && !f.fallback)).toBe(true);
    expect(new Set(recipes.map(f => f.id)).size).toBe(20);
    expect(new Set(recipes.map(f => f.description)).size).toBe(20);
    for (const f of recipes) {
      expect(fusionEffect(f)).toBe(f.id);
      expect(fusionEffect(getFusion(f.catalyst, f.base))).not.toBe(f.id);
    }
    expect(fusionEffect(getFusion('ice', 'water'))).toBe('frozen-wake');
    expect(fusionEffect(getFusion('grass', 'fire'))).toBe('emberseed');
    expect(fusionEffect(getFusion('lightning', 'grass'))).toBe('grounded');
  });

  it('has a live HUD readout for every recipe', () => {
    const generic = elementalFeedback('water', { waterMomentum: 0 }).text;
    const texts = Object.values(ORDERED_FUSIONS).map(f => elementalFeedback(f.catalyst, { waterMomentum: 0 }, f.id).text);
    expect(texts).not.toContain(generic);
    expect(new Set(texts).size).toBe(20);
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
    // fusionOf takes the newest element first: Nature then Lightning is Thunderpad.
    expect(fusionOf('lightning', 'grass', 3)).toBe('thunderpad');
    expect(fusionOf('grass', 'lightning', 3)).toBe('grounded');
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

// Lands a jump this frame (the landing branch of stepWormSim).
function land(sim, ctx) {
  sim.elementalFocusT = 0;
  sim.isJumping = true;
  sim.jumpT = 0.9999;
  sim.springLaunch = true;
  stepWormSim(sim, 0.05, SIZE, ctx);
}

describe('Bloom (Water → Nature)', () => {
  it('grows a 12-second pad behind every 4th tile without a landing; Geyser does not', () => {
    const { sim, ctx } = fused('water', 'grass');
    sim.elementalFocusT = 0;
    for (let i = 0; i < 400 && sim.fusionTiles < 4; i++) stepWormSim(sim, 0.05, SIZE, ctx);
    const pads = [...sim.elementalPatches.values()].filter(p => p.type === 'grass');
    expect(pads).toHaveLength(1);
    expect(pads[0].ttl).toBeGreaterThan(8);
    const reverse = fused('grass', 'water');
    reverse.sim.elementalFocusT = 0;
    for (let i = 0; i < 120; i++) stepWormSim(reverse.sim, 0.05, SIZE, reverse.ctx);
    expect([...reverse.sim.elementalPatches.values()].some(p => p.type === 'grass')).toBe(false);
  });
});

describe('Geyser (Nature → Water)', () => {
  it('a full-momentum pad launch leaps a tile further and refills momentum', () => {
    const { sim, ctx } = fused('grass', 'water');
    addElementalPatch(sim, sim.pos, 'grass');
    sim.waterMomentum = 0.9;
    startJump(sim, ctx);
    expect(sim.jumpSpan).toBe(2.2 + FUSION.geyserSpan);
    expect(sim.jumpHeight).toBeCloseTo(1.8 + FUSION.geyserHeight);
    expect(sim.waterMomentum).toBe(1);
    tickElementalGameplay(sim, 0.5, SIZE);
    expect(sim.waterMomentum).toBe(1);
  });
});

describe('Emberseed (Nature → Fire)', () => {
  it('pads wither fast and burst into a 3x3 of fire', () => {
    const { sim } = fused('grass', 'fire');
    addElementalPatch(sim, sim.pos, 'grass');
    const pad = sim.elementalPatches.get(key(sim.pos));
    expect(pad).toMatchObject({ ember: true, ttl: FUSION.emberseedPadTtl });
    tickElementalGameplay(sim, FUSION.emberseedPadTtl + 0.1, SIZE);
    expect(sim.fusionBurst).toMatchObject({ kind: 'emberseed' });
    for (const k of springSlamTiles(sim.pos, SIZE)) expect(isHotTile(sim.elementalPatches, k)).toBe(true);
  });

  it('a launched pad never bursts', () => {
    const { sim, ctx } = fused('grass', 'fire');
    addElementalPatch(sim, sim.pos, 'grass');
    startJump(sim, ctx);
    tickElementalGameplay(sim, 10, SIZE);
    expect(sim.fusionBurst).toBeNull();
  });
});

describe('Ski Jump (Nature → Ice)', () => {
  it('turns an ordinary grounded jump into a spring leap', () => {
    const { sim, ctx } = fused('grass', 'ice');
    startJump(sim, ctx, SIZE);
    expect(sim.jumpSpan).toBe(2.2);
    expect(sim.springLaunch).toBe(true);
    const plain = fused('ice', 'grass');
    startJump(plain.sim, plain.ctx, SIZE);
    expect(plain.sim.springLaunch).toBe(false);
  });
});

describe('Frostbloom (Ice → Nature)', () => {
  it('a spring landing freezes its 3x3 and grows an iced pad', () => {
    const { sim, ctx } = fused('ice', 'grass');
    land(sim, ctx);
    expect(sim.fusionBurst).toMatchObject({ kind: 'frostbloom' });
    const reach = [...springSlamTiles(sim.pos, SIZE)].filter(k => k !== key(sim.pos));
    for (const k of reach) expect(isFrostTile(sim.elementalPatches, k)).toBe(true);
    expect(sim.elementalPatches.get(key(sim.pos))).toMatchObject({ type: 'grass', iced: true, ttl: FUSION.frostbloomPadTtl });
    // Wildfire, not Frostbloom, for the elements' other recipe with Nature.
    const wild = fused('fire', 'grass');
    land(wild.sim, wild.ctx);
    expect(wild.sim.fusionBurst.kind).toBe('wildfire');
  });
});

describe('Coldfire (Fire → Ice) and Meltdown (Ice → Fire)', () => {
  it('Coldfire lays a blue firebreak that freezes and never heats a fuse', () => {
    const { sim } = fused('fire', 'ice');
    addElementalPatch(sim, sim.pos, 'fire');
    expect(isColdTile(sim.elementalPatches, sim.pos)).toBe(true);
    expect(isHotTile(sim.elementalPatches, sim.pos)).toBe(false);
    expect(isFirebreakTile(sim.elementalPatches, sim.pos)).toBe(true);
    expect(frostTiles(sim).has(key(sim.pos))).toBe(true);
    expect(sim.elementalPatches.get(key(sim.pos)).ttl).toBe(FUSION.coldfireTtl);
  });

  it('Meltdown: a turn held by the ice slide ends in a dash and melts the tile', () => {
    const { sim, ctx } = fused('ice', 'fire');
    sim.elementalFocusT = 0;
    sim.interpT = 0.5;
    sim.pendingTurns.push('left');
    for (let i = 0; i < 40 && sim.meltdownT === 0; i++) stepWormSim(sim, 0.02, SIZE, ctx);
    expect(sim.meltdownT).toBeGreaterThan(0);
    expect(fusionSpeedBonus(sim)).toBe(FUSION.meltdownDash);
    expect([...sim.elementalPatches.values()].some(p => p.melt)).toBe(true);
    const melted = [...sim.elementalPatches.values()].find(p => p.melt);
    expect(isMeltTile(sim.elementalPatches, melted)).toBe(true);
    // Laying the ordinary trail over it on the way out keeps it melted.
    addElementalPatch(sim, melted, 'fire');
    expect(isMeltTile(sim.elementalPatches, melted)).toBe(true);
  });
});

describe('Frozen Wake (Ice → Water)', () => {
  it('freezes every tile the worm leaves; Slipstream does not', () => {
    const { sim, ctx } = fused('ice', 'water');
    sim.elementalFocusT = 0;
    for (let i = 0; i < 60; i++) stepWormSim(sim, 0.05, SIZE, ctx);
    const frost = [...sim.elementalPatches.values()].filter(p => p.type === 'frost');
    expect(frost.length).toBeGreaterThan(0);
    expect(isFrostTile(sim.elementalPatches, frost[0])).toBe(true);
    expect(turnShedsMomentum(sim)).toBe(true);
    const slip = fused('water', 'ice');
    slip.sim.elementalFocusT = 0;
    for (let i = 0; i < 60; i++) stepWormSim(slip.sim, 0.05, SIZE, slip.ctx);
    expect([...slip.sim.elementalPatches.values()].some(p => p.type === 'frost')).toBe(false);
  });
});

describe('fused storms', () => {
  it('Plasma doubles the marks; Cryostorm doubles the telegraph', () => {
    const storm = makeStorm();
    beginStorm(storm, STORM.strikes * 2);
    const tile = { x: 0, y: 0, z: 4, dirKey: 'PZ' };
    for (let i = 0; i < 400; i++) tickStorm(storm, 0.1, { spawning: true, rng: () => 0, pick: () => tile });
    expect(storm.spawned).toBe(STORM.strikes * 2);
    const slow = makeStorm();
    beginStorm(slow);
    tickStorm(slow, STORM.firstDelay + 0.01, { spawning: true, rng: () => 0, pick: () => tile, telegraph: STORM.telegraph * 2 });
    expect(slow.spots[0].delay).toBe(STORM.telegraph * 2);
  });

  it('Conductor and Plasma never aim at the body', () => {
    const body = ['0,2,4,PZ'];
    const tiles = [{ x: 4, y: 4, z: 4, dirKey: 'PZ' }];
    expect(pickStrikeTile({ tiles, body, avoid: new Set() }, () => 0)).toEqual({ x: 0, y: 2, z: 4, dirKey: 'PZ' });
    expect(pickStrikeTile({ tiles, body, avoid: new Set(), bodyShare: 0 }, () => 0)).toBe(tiles[0]);
  });
});
