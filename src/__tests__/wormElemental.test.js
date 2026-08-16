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
import { makeWormSim, resetWormSim, stepWormSim, activateSpecial, startElemental, tileKey, faceCenterTiles } from '../worm/healerWorm/wormSim.js';
import { ELEMENTAL_DURATION, ELEMENTAL_FOCUS_DURATION, ELEMENTAL_SPAWN_INTERVAL } from '../worm/healerWorm/constants.js';
import { LIVING_STYLE_KEYS } from '../utils/tileStyleCatalog.js';
import { ELEMENT_MODE } from '../worm/healerWorm/elementalOrbShader.js';

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
  it('defines the five elements', () => {
    expect(ELEMENTAL_TYPES).toEqual(['water', 'fire', 'grass', 'ice', 'lightning']);
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
      expect(def.accent).toMatch(/^#/);
      expect(def.fogColor).toMatch(/^#/);
      expect(def.iconPath).toBeTruthy();
      expect(def.description).toBeTruthy();
    }
  });

  it('every element names a renderer and a particle behaviour', () => {
    for (const key of ELEMENTAL_TYPES) {
      const def = ELEMENTAL_DEFS[key];
      expect(def.renderer, `${key} has no renderer`).toBeTruthy();
      expect(def.particle, `${key} has no particle kind`).toBeTruthy();
    }
  });

  it('every element resolves to a distinct orb shader branch', () => {
    const modes = ELEMENTAL_TYPES.map((k) => ELEMENT_MODE[k]);
    for (const [i, m] of modes.entries()) {
      expect(m, `${ELEMENTAL_TYPES[i]} has no orb shader mode`).toBeTypeOf('number');
    }
    expect(new Set(modes).size).toBe(ELEMENTAL_TYPES.length);
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

describe('elemental offering placement', () => {
  // Run the sim until the offering clock fires and hand back the elemental orbs.
  function spawnOffering(sim, ctx) {
    const dt = 0.1;
    for (let i = 0; i < Math.round((ELEMENTAL_SPAWN_INTERVAL + 2) / dt); i++) {
      stepWormSim(sim, dt, SIZE, ctx);
      const els = sim.specials.filter(s => isElementalType(s.type));
      if (els.length) return els;
    }
    return sim.specials.filter(s => isElementalType(s.type));
  }

  it('offers one orb of every element at once', () => {
    // Five elements onto six face centres. The placement walks faces until it finds
    // a free one, so growing the element list past four had to keep working rather
    // than silently dropping the last orb.
    const sim = makeSim();
    const els = spawnOffering(sim, makeCtx());
    expect(els).toHaveLength(ELEMENTAL_TYPES.length);
    expect(new Set(els.map(e => e.type))).toEqual(new Set(ELEMENTAL_TYPES));
  });

  it('puts every orb on its own tile', () => {
    const sim = makeSim();
    const els = spawnOffering(sim, makeCtx());
    const keys = els.map(e => tileKey(e));
    expect(new Set(keys).size).toBe(keys.length);
    // And one per face, which is what keeps them reachable from different sides.
    expect(new Set(els.map(e => e.dirKey)).size).toBe(els.length);
  });

  it('offers what fits when faces are occupied rather than failing outright', () => {
    // Occupancy fallback: the placement skips a taken face centre. With five types
    // and six faces there is exactly one spare, so blocking two must still yield
    // four orbs — never a crash and never a doubled-up tile.
    const sim = makeSim();
    const ctx = makeCtx();
    const centres = faceCenterTiles(SIZE);
    sim.powerups.push({ ...centres[0], id: 'block-a' }, { ...centres[1], id: 'block-b' });
    const els = spawnOffering(sim, ctx);
    expect(els.length).toBeGreaterThanOrEqual(ELEMENTAL_TYPES.length - 2);
    const blocked = new Set([tileKey(centres[0]), tileKey(centres[1])]);
    for (const e of els) expect(blocked.has(tileKey(e))).toBe(false);
  });

  it('claiming one element wipes every other orb in the offering', () => {
    // The offering is a choice: taking one element costs you the other four until
    // the next spawn cycle. Driven through the real claim path (an orb sitting on
    // the worm's own tile) rather than by calling startElemental directly.
    const sim = makeSim();
    const ctx = makeCtx();
    const els = spawnOffering(sim, ctx);
    expect(els.length).toBeGreaterThan(1);

    // The claim fires as the worm steps ONTO a tile, so parking the orb on the tile
    // the head already occupies never triggers it. A magnet widens the reach to the
    // surrounding ring, which is a supported claim path and makes contact certain.
    const target = els[0];
    sim.magnetT = 10;
    for (let i = 0; i < 60 && !sim.elementalType; i++) {
      target.x = sim.pos.x; target.y = sim.pos.y; target.z = sim.pos.z; target.dirKey = sim.pos.dirKey;
      stepWormSim(sim, 0.05, SIZE, ctx);
    }

    expect(sim.elementalType).toBe(target.type);
    expect(sim.specials.filter(o => isElementalType(o.type))).toHaveLength(0);
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

  it('freezes the whole sim for the claim beat, off the wash\'s own clock', () => {
    // The beat stops the crawl so the player can look at the re-skinned cube.
    // It must not be charged to the element: the wash clock is held too, so the
    // full ELEMENTAL_DURATION of crawling still follows.
    const sim = makeSim();
    const ctx = makeCtx();
    const startTile = tileKey(sim.pos);
    startElemental(sim, ctx, 'ice');
    expect(sim.elementalFocusT).toBeCloseTo(ELEMENTAL_FOCUS_DURATION);

    const dt = 0.1;
    for (let i = 0; i < Math.round((ELEMENTAL_FOCUS_DURATION - 0.2) / dt); i++) {
      stepWormSim(sim, dt, SIZE, ctx);
    }
    expect(sim.elementalFocusT).toBeGreaterThan(0);
    expect(tileKey(sim.pos)).toBe(startTile);              // the crawl is frozen
    expect(sim.elementalT).toBeCloseTo(ELEMENTAL_DURATION); // and so is the wash

    // Once the beat expires the crawl resumes and the wash starts draining.
    for (let i = 0; i < Math.round(1.0 / dt); i++) stepWormSim(sim, dt, SIZE, ctx);
    expect(sim.elementalFocusT).toBe(0);
    expect(sim.elementalT).toBeLessThan(ELEMENTAL_DURATION);
  });

  it('the wash drains and clears after ELEMENTAL_DURATION', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    startElemental(sim, ctx, 'grass');
    const dt = 0.1;
    // The claim beat freezes everything first, so the wash's own clock only
    // starts once it expires — budget for both.
    const span = ELEMENTAL_FOCUS_DURATION + ELEMENTAL_DURATION + 1;
    for (let i = 0; i < Math.round(span / dt); i++) {
      stepWormSim(sim, dt, SIZE, ctx);
    }
    expect(sim.elementalT).toBe(0);
    expect(sim.elementalType).toBeNull();
    // The clear-out notifies the renderer with a null element.
    const clears = ctx.events.filter(e => e.type === 'elemental' && e.args[0] === null);
    expect(clears.length).toBeGreaterThanOrEqual(1);
  });

  it('records the claim tile as the sweep origin, snapshotted not aliased', () => {
    // The cube skin sweeps the element outward from where the orb was taken. The
    // orb is claimed by the head, so the head's tile IS the claim point — but the
    // worm keeps crawling, so a live reference to sim.pos would drag the sweep
    // origin along behind it.
    const sim = makeSim();
    const ctx = makeCtx();
    const claimedAt = { ...sim.pos };
    startElemental(sim, ctx, 'water');
    expect(sim.elementalOrigin).toEqual({
      x: claimedAt.x, y: claimedAt.y, z: claimedAt.z, dirKey: claimedAt.dirKey
    });
    expect(sim.elementalOrigin).not.toBe(sim.pos);

    const dt = 0.1;
    const span = ELEMENTAL_FOCUS_DURATION + 3;
    for (let i = 0; i < Math.round(span / dt); i++) stepWormSim(sim, dt, SIZE, ctx);
    expect(tileKey(sim.pos)).not.toBe(tileKey(claimedAt));   // the worm moved on
    expect(sim.elementalOrigin.x).toBe(claimedAt.x);          // the origin did not
    expect(sim.elementalOrigin.y).toBe(claimedAt.y);
    expect(sim.elementalOrigin.z).toBe(claimedAt.z);
  });

  it('a replacement element re-seeds the sweep origin', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    startElemental(sim, ctx, 'fire');
    const first = sim.elementalOrigin;
    const dt = 0.1;
    for (let i = 0; i < Math.round((ELEMENTAL_FOCUS_DURATION + 3) / dt); i++) stepWormSim(sim, dt, SIZE, ctx);
    startElemental(sim, ctx, 'ice');
    expect(sim.elementalOrigin).not.toBe(first);
    expect(tileKey(sim.elementalOrigin)).toBe(tileKey(sim.pos));
  });

  it('clears the sweep origin when the wash expires', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    startElemental(sim, ctx, 'grass');
    const dt = 0.1;
    const span = ELEMENTAL_FOCUS_DURATION + ELEMENTAL_DURATION + 1;
    for (let i = 0; i < Math.round(span / dt); i++) stepWormSim(sim, dt, SIZE, ctx);
    expect(sim.elementalType).toBeNull();
    expect(sim.elementalOrigin).toBeNull();
  });

  it('claiming an element does not touch the cube or the worm', () => {
    // The wash is presentation only. If this ever fails, an art pass has reached
    // into the simulation.
    const sim = makeSim();
    const ctx = makeCtx();
    const before = {
      tail: sim.tailLength, alive: sim.alive, pos: tileKey(sim.pos), speed: sim.speed
    };
    startElemental(sim, ctx, 'water');
    expect(sim.tailLength).toBe(before.tail);
    expect(sim.alive).toBe(before.alive);
    expect(tileKey(sim.pos)).toBe(before.pos);
    expect(sim.speed).toBe(before.speed);
  });

  it('resetWormSim wipes an active wash', () => {
    const sim = makeSim();
    const ctx = makeCtx();
    startElemental(sim, ctx, 'water');
    resetWormSim(sim, SIZE, { orbCount: 0, wormholeInterval: 9999 });
    expect(sim.elementalType).toBeNull();
    expect(sim.elementalT).toBe(0);
    expect(sim.elementalOrigin).toBeNull();
  });
});
