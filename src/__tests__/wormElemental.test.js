// Deterministic tests for the elemental power-up orbs.
//
// Elements reuse the whole special-orb pipeline (spawn, lifetime, claim, HUD
// notice) and differ only in what claiming one does: it starts a timed "wash"
// that bathes the cube in the element rather than buffing the worm. These tests
// pin the data wiring and the sim's wash lifecycle without a renderer or store.
import { describe, it, expect } from 'vitest';
import {
  ELEMENTAL_DEFS,
  ELEMENTAL_TYPES,
  isElementalType,
  getElementalDef,
} from '../worm/healerWorm/elementalDefs.js';
import { SPECIAL_DEFS, SPECIAL_TYPES, getSpecialDef } from '../worm/healerWorm/specialDefs.js';
import { makeWormSim, resetWormSim, stepWormSim, activateSpecial, startElemental } from '../worm/healerWorm/wormSim.js';
import { ELEMENTAL_DURATION } from '../worm/healerWorm/constants.js';
import { LIVING_STYLE_KEYS } from '../utils/tileStyleCatalog.js';

const SIZE = 5;

function makeCtx() {
  const events = [];
  return {
    events,
    feel: (...a) => events.push({ type: 'feel', args: a }),
    onElementalTheme: (...a) => events.push({ type: 'elemental', args: a }),
    // Unused by the elemental path, but present so a stray call never throws.
    onRocketState: () => {},
    onMagnetState: () => {},
    getSpeed: () => 1.0,
    getCubies: () => null,
    getGamePhase: () => 'active',
    isPaused: () => false,
    getControlMode: () => 'non-oriented',
    getWormholeInterval: () => 9999,
    isPrismCharacter: () => false,
    getOrbInventory: () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }),
    getHealingProgress: () => ({}),
    getOrbColor: () => '#22ff88',
    resolveTunnel: () => null,
    onDeath: () => {}, onTunnelEnter: () => {}, onCrawlResume: () => {},
    onPhase: () => {}, onBoostState: () => {}, onSurvivalTick: () => {},
    spawnWormholePair: () => {}, onFlippedTile: () => {}, applyDeposit: () => {},
    onOrbPickup: () => {}, onPowerupsChanged: () => {}, applyHeal: () => {},
    onSpecialsChanged: () => {}, onSpecialSpawned: () => {}, onSpecialExpired: () => {},
  };
}

function makeSim() {
  const sim = makeWormSim(SIZE);
  resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
  return sim;
}

describe('elementalDefs', () => {
  it('defines the four elements', () => {
    expect(ELEMENTAL_TYPES).toEqual(['water', 'fire', 'grass', 'ice']);
  });

  it('each element reuses an existing Living tile style', () => {
    for (const key of ELEMENTAL_TYPES) {
      expect(LIVING_STYLE_KEYS).toContain(ELEMENTAL_DEFS[key].tileStyle);
    }
  });

  it('isElementalType distinguishes elements from buffs', () => {
    expect(isElementalType('water')).toBe(true);
    expect(isElementalType('rocket')).toBe(false);
    expect(isElementalType('magnet')).toBe(false);
    expect(isElementalType('nonsense')).toBe(false);
  });

  it('getElementalDef returns null for non-elements', () => {
    expect(getElementalDef('water')).toBe(ELEMENTAL_DEFS.water);
    expect(getElementalDef('rocket')).toBeNull();
  });

  it('every element carries HUD presentation data', () => {
    for (const key of ELEMENTAL_TYPES) {
      const def = ELEMENTAL_DEFS[key];
      expect(def.label).toBeTruthy();
      expect(def.color).toMatch(/^#/);
      expect(def.iconPath).toBeTruthy();
    }
  });
});

describe('special defs include elements', () => {
  it('folds every element into the shared spawn/claim pool', () => {
    for (const key of ELEMENTAL_TYPES) {
      expect(SPECIAL_TYPES).toContain(key);
      expect(getSpecialDef(key)).toBe(SPECIAL_DEFS[key]);
    }
    // Buffs are still present alongside them.
    expect(SPECIAL_TYPES).toContain('rocket');
    expect(SPECIAL_TYPES).toContain('magnet');
  });
});

describe('elemental wash lifecycle', () => {
  it('activateSpecial starts a wash for an element type', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    activateSpecial(sim, ctx, 'water');
    expect(sim.elementalType).toBe('water');
    expect(sim.elementalT).toBeCloseTo(ELEMENTAL_DURATION);
    expect(sim.elementalMaxT).toBeCloseTo(ELEMENTAL_DURATION);
    const evt = ctx.events.find(e => e.type === 'elemental');
    expect(evt.args[0]).toBe('water');
  });

  it('a second element replaces the first without stacking', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    startElemental(sim, ctx, 'fire');
    startElemental(sim, ctx, 'ice');
    expect(sim.elementalType).toBe('ice');
    expect(sim.elementalT).toBeCloseTo(ELEMENTAL_DURATION);
  });

  it('the wash drains and clears after ELEMENTAL_DURATION', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    startElemental(sim, ctx, 'grass');
    const dt = 0.1;
    for (let i = 0; i < Math.round((ELEMENTAL_DURATION + 1) / dt); i++) {
      stepWormSim(sim, dt, SIZE, ctx);
    }
    expect(sim.elementalT).toBe(0);
    expect(sim.elementalType).toBeNull();
    // The clear-out notifies the renderer with a null element.
    const clears = ctx.events.filter(e => e.type === 'elemental' && e.args[0] === null);
    expect(clears.length).toBeGreaterThanOrEqual(1);
  });

  it('resetWormSim wipes an active wash', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    startElemental(sim, ctx, 'water');
    resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
    expect(sim.elementalType).toBeNull();
    expect(sim.elementalT).toBe(0);
  });
});
