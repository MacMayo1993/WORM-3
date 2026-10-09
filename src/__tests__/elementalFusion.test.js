// Two elements at once: claiming an element while another's wash is up fuses them.
// These pin the claim rules, that every element check sees both halves of a pair,
// and the four fusions with rules of their own (Steam, Slipstream, Wildfire,
// Thunderpad).
import { describe, it, expect } from 'vitest';
import {
  FUSION_DEFS, fusionKey, getFusion, hasElement, activeFusion, fusionOf, claimElement
} from '../worm/healerWorm/elementalFusion.js';
import { ELEMENTAL_TYPES } from '../worm/healerWorm/elementalDefs.js';
import { makeWormSim, resetWormSim, stepWormSim, startElemental, startJump } from '../worm/healerWorm/wormSim.js';
import {
  addElementalPatch, chargeSpringPad, steamTiles, waterSpeedBonus, turnShedsMomentum, iceHoldsTurn,
  tickElementalGameplay, CHARGED_SPRING_SPAN, CHARGED_SPRING_HEIGHT
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
  it('names every pair of the five elements exactly once', () => {
    const keys = new Set();
    for (const a of ELEMENTAL_TYPES) for (const b of ELEMENTAL_TYPES) if (a !== b) keys.add(fusionKey(a, b));
    expect([...keys].sort()).toEqual(Object.keys(FUSION_DEFS).sort());
    expect(keys.size).toBe(10);
    expect(getFusion('water', 'fire')).toBe(getFusion('fire', 'water'));
    expect(fusionKey('water', 'water')).toBeNull();
    expect(fusionKey('water', 'rocket')).toBeNull();
  });

  it('gives the four first-pass fusions rules of their own', () => {
    const ruled = Object.values(FUSION_DEFS).filter(f => f.rule).map(f => f.id).sort();
    expect(ruled).toEqual(['slipstream', 'steam', 'thunderpad', 'wildfire']);
    expect(getFusion('fire', 'water').id).toBe('steam');
    expect(getFusion('ice', 'water').id).toBe('slipstream');
    expect(getFusion('grass', 'fire').id).toBe('wildfire');
    expect(getFusion('lightning', 'grass').id).toBe('thunderpad');
  });
});

describe('claiming into a fusion', () => {
  it('fuses a second element, refreshes on a repeat, and lets a third replace the older', () => {
    expect(claimElement(null, null, 'water')).toEqual({ type: 'water', pair: null, fused: false });
    expect(claimElement('water', null, 'fire')).toEqual({ type: 'fire', pair: 'water', fused: true });
    expect(claimElement('fire', 'water', 'fire')).toEqual({ type: 'fire', pair: 'water', fused: false });
    expect(claimElement('fire', 'water', 'water')).toEqual({ type: 'water', pair: 'fire', fused: false });
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
    const { sim } = fused('fire', 'water');
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
