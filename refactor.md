# WORM³ Architecture Refactor — No Babylon, Roguelike Ready

## The Three Moves

1. **Extract `CubeSimulation`** — plain JS class, owns cubies and manifoldMap
2. **Extract `RunEngine`** — plain JS class, owns roguelike state, called synchronously at rotation completion
3. **Starve React** — React sees events and display data only, never simulation state

---

## Step 1 — `src/simulation/CubeSimulation.js`

Pull the core cube logic out of `useCubeState` and `useChaosMode`. This class owns the
canonical state. React reads from it via a subscription, never writes directly.

```javascript
// src/simulation/CubeSimulation.js

import { makeCubies }         from '../game/cubeState.js';
import { rotateSliceCubies }  from '../game/cubeRotation.js';
import { buildManifoldGridMap, flipStickerPair } from '../game/manifoldLogic.js';
import { computeAntipodalIntegrity } from '../simulation/AntipodalSensor.js';
import { K_STAR } from '../simulation/constants.js';

export class CubeSimulation {
  constructor(size = 3) {
    this.size    = size;
    this.cubies  = makeCubies(size);
    this.manifoldMap = buildManifoldGridMap(this.cubies, size);

    // Subscribers: (eventName, data) => void
    // React hooks into this — the simulation never imports React
    this._listeners = new Map();

    // RunEngine attaches here — called synchronously before any listener fires
    this.onRotationComplete = null;  // (prev, next, axis, slice, dir) => void
    this.onFlipComplete     = null;  // (prev, next, pos, dirKey)      => void
  }

  // ─── Mutations ────────────────────────────────────────────────────────────

  rotate(axis, slice, dir) {
    const prev = this.cubies;
    const next = rotateSliceCubies(prev, this.size, axis, slice, dir);
    this.cubies      = next;
    this.manifoldMap = buildManifoldGridMap(next, this.size);

    // RunEngine fires FIRST — synchronous, before React knows anything
    this.onRotationComplete?.(prev, next, axis, slice, dir);

    // Now notify React subscribers
    this._emit('rotation', { prev, next, axis, slice, dir });
    this._emit('state',    { cubies: this.cubies, manifoldMap: this.manifoldMap });
  }

  flip(x, y, z, dirKey) {
    const prev = this.cubies;
    const next = flipStickerPair(prev, this.size, x, y, z, dirKey, this.manifoldMap);
    this.cubies      = next;
    this.manifoldMap = buildManifoldGridMap(next, this.size);

    this.onFlipComplete?.(prev, next, { x, y, z }, dirKey);

    this._emit('flip',  { prev, next, pos: { x, y, z }, dirKey });
    this._emit('state', { cubies: this.cubies, manifoldMap: this.manifoldMap });
  }

  resize(newSize) {
    this.size        = newSize;
    this.cubies      = makeCubies(newSize);
    this.manifoldMap = buildManifoldGridMap(this.cubies, newSize);
    this._emit('resize', { size: newSize });
    this._emit('state',  { cubies: this.cubies, manifoldMap: this.manifoldMap });
  }

  reset() {
    this.cubies      = makeCubies(this.size);
    this.manifoldMap = buildManifoldGridMap(this.cubies, this.size);
    this._emit('reset', {});
    this._emit('state', { cubies: this.cubies, manifoldMap: this.manifoldMap });
  }

  setCubies(cubies) {
    this.cubies      = cubies;
    this.manifoldMap = buildManifoldGridMap(cubies, this.size);
    this._emit('state', { cubies: this.cubies, manifoldMap: this.manifoldMap });
  }

  // ─── Queries (never mutate) ───────────────────────────────────────────────

  getIntegrity() {
    return computeAntipodalIntegrity(this.cubies, this.size);
  }

  isAboveKStar() {
    return this.getIntegrity().integrity > K_STAR;
  }

  // ─── Subscription (React uses this) ───────────────────────────────────────

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this._listeners.get(event).delete(fn); // returns unsubscribe
  }

  _emit(event, data) {
    this._listeners.get(event)?.forEach(fn => fn(data));
  }
}
```

---

## Step 2 — `src/simulation/constants.js`

Single source of truth for your universal constant and related thresholds.

```javascript
// src/simulation/constants.js

export const K_STAR = 1 / (2 * Math.LN2);  // ≈ 0.7213

// Roguelike regime names keyed to integrity bands
export const REGIME = {
  STRUCTURE:  'structure',   // I(T) > K_STAR
  BOUNDARY:   'boundary',    // |I(T) - K_STAR| < EPSILON
  ENTROPY:    'entropy',     // I(T) < K_STAR
};

export const K_STAR_EPSILON = 0.05;

export function classifyRegime(integrity) {
  if (Math.abs(integrity - K_STAR) < K_STAR_EPSILON) return REGIME.BOUNDARY;
  return integrity > K_STAR ? REGIME.STRUCTURE : REGIME.ENTROPY;
}
```

---

## Step 3 — `src/simulation/RunEngine.js`

The roguelike brain. Pure JS, zero React imports, zero Three.js imports.
`CubeSimulation` calls `onRotationComplete` synchronously — RunEngine evaluates
consequences and emits UI events only when the display actually needs to change.

```javascript
// src/simulation/RunEngine.js

import { K_STAR, classifyRegime, REGIME } from './constants.js';

const BASE_STATS = () => ({
  coherence:   0,   // earned by G_A moves (antipodal-preserving)
  entropy:     0,   // earned by seam crossings
  harmony:     0,   // earned by completing full rotation cycles (g^4 = id)
  chaosCharge: 0,   // fills when I(T) < k*, drains when above
});

const BASE_CITY_HEALTH = (faceIds) => {
  const m = new Map();
  faceIds.forEach(id => m.set(id, 100));
  return m;
};

export class RunEngine {
  constructor(cubeSimulation) {
    this.sim = cubeSimulation;

    // Wire into simulation synchronously
    this.sim.onRotationComplete = this._onRotationComplete.bind(this);
    this.sim.onFlipComplete     = this._onFlipComplete.bind(this);

    this.runState    = 'idle';   // idle | active | encounter | paused | dead | won
    this.stats       = BASE_STATS();
    this.cityHealth  = BASE_CITY_HEALTH([1, 2, 3, 4, 5, 6]);
    this.floor       = 1;
    this.rotationLog = [];       // circular buffer, last 4 entries for harmony detection
    this.encounterQueue = [];
    this.items       = [];

    // React attaches one callback here for UI updates
    // Signature: (eventName: string, payload: object) => void
    this.onUIEvent = null;
  }

  // ─── Run Lifecycle ─────────────────────────────────────────────────────────

  startRun(config = {}) {
    this.runState   = 'active';
    this.stats      = BASE_STATS();
    this.cityHealth = BASE_CITY_HEALTH([1, 2, 3, 4, 5, 6]);
    this.floor      = 1;
    this.rotationLog = [];
    this.encounterQueue = [];
    this.items      = config.startingItems ?? [];
    this._emitUI('RUN_STARTED', { floor: this.floor, stats: { ...this.stats } });
  }

  endRun(reason) {
    this.runState = reason === 'win' ? 'won' : 'dead';
    this._emitUI('RUN_ENDED', { reason, stats: { ...this.stats }, floor: this.floor });
  }

  // ─── Core Evaluation (called synchronously by CubeSimulation) ─────────────

  _onRotationComplete(prev, next, axis, slice, dir) {
    if (this.runState !== 'active') return;

    const prevI  = computeIntegrityFromCubies(prev, this.sim.size);
    const nextI  = computeIntegrityFromCubies(next, this.sim.size);
    const delta  = nextI - prevI;
    const regime = classifyRegime(nextI);

    // ── Stat accumulation ──
    const isGAMove = delta >= 0;  // integrity preserved or improved → G_A element
    this._accumulateStats(isGAMove, delta, regime, axis, slice, dir);

    // ── City damage from seam activation ──
    const seamDamage = this._computeSeamDamage(prev, next);
    seamDamage.forEach((dmg, faceId) => {
      const current = this.cityHealth.get(faceId) ?? 100;
      const newHealth = Math.max(0, current - dmg);
      this.cityHealth.set(faceId, newHealth);
      if (newHealth === 0) this._onCityDeath(faceId);
    });

    // ── Chaos charge ──
    if (regime === REGIME.ENTROPY) {
      this.stats.chaosCharge = Math.min(100, this.stats.chaosCharge + 8);
    } else {
      this.stats.chaosCharge = Math.max(0, this.stats.chaosCharge - 3);
    }
    if (this.stats.chaosCharge >= 100) {
      this._triggerManifoldCollapse();
      return;
    }

    // ── k* threshold crossing ──
    const prevRegime = classifyRegime(prevI);
    const crossedKStar = prevRegime !== regime;
    if (crossedKStar) {
      this._onRegimeCrossing(prevRegime, regime, nextI);
    }

    // ── Encounter evaluation ──
    const encounter = this._evaluateEncounter(regime, delta, axis, slice);
    if (encounter) {
      this.encounterQueue.push(encounter);
      this.runState = 'encounter';
      this._emitUI('ENCOUNTER', encounter);
      return; // don't emit STATS_UPDATE yet — will emit after encounter resolves
    }

    // ── Emit display update ──
    this._emitUI('STATS_UPDATE', {
      stats:      { ...this.stats },
      cityHealth: Object.fromEntries(this.cityHealth),
      integrity:  nextI,
      regime,
      delta,
    });
  }

  _onFlipComplete(prev, next, pos, dirKey) {
    if (this.runState !== 'active') return;
    // Flips contribute entropy — they move stickers without preserving G_A structure
    this.stats.entropy = Math.min(999, this.stats.entropy + 2);
    this._emitUI('FLIP_STAT', { entropy: this.stats.entropy });
  }

  // ─── Encounter System ──────────────────────────────────────────────────────

  _evaluateEncounter(regime, delta, axis, slice) {
    // Only spawn encounters probabilistically, weighted by how far from k*
    const integrity = this.sim.getIntegrity().integrity;
    const distFromKStar = Math.abs(integrity - K_STAR);

    // Boundary zone encounters are most common — you're in danger
    if (regime === REGIME.BOUNDARY && Math.random() < 0.25) {
      return this._buildEncounter('SEAM_TREMOR', { axis, slice, integrity });
    }
    if (regime === REGIME.ENTROPY && Math.random() < 0.15) {
      return this._buildEncounter('CITY_RAID', {
        attackingFace: this._getMostDisruptedFace(),
        intensity: distFromKStar,
      });
    }
    // Floor-based boss encounter after enough rotations
    if (this.rotationLog.length > 0 && this.rotationLog.length % 20 === 0) {
      return this._buildEncounter('FLOOR_BOSS', { floor: this.floor });
    }
    return null;
  }

  _buildEncounter(type, context) {
    return {
      id:      `${type}_${Date.now()}`,
      type,
      context,
      options: ENCOUNTER_OPTIONS[type](context, this.stats, this.items),
    };
  }

  resolveEncounter(encounterId, choiceIndex) {
    const encounter = this.encounterQueue.find(e => e.id === encounterId);
    if (!encounter) return;

    const choice  = encounter.options[choiceIndex];
    const outcome = choice.resolve(this.stats, this.cityHealth, this.items);

    this.encounterQueue = this.encounterQueue.filter(e => e.id !== encounterId);
    this.runState = this.encounterQueue.length > 0 ? 'encounter' : 'active';

    // Apply outcome
    if (outcome.statDelta)   this._applyStatDelta(outcome.statDelta);
    if (outcome.healthDelta) this._applyHealthDelta(outcome.healthDelta);
    if (outcome.item)        this.items.push(outcome.item);
    if (outcome.runEnds)     { this.endRun(outcome.runEnds); return; }

    this._emitUI('ENCOUNTER_RESOLVED', {
      encounter,
      choice:     choice.label,
      outcome,
      stats:      { ...this.stats },
      cityHealth: Object.fromEntries(this.cityHealth),
    });

    if (this.encounterQueue.length > 0) {
      this._emitUI('ENCOUNTER', this.encounterQueue[0]);
    }
  }

  // ─── Stat Helpers ──────────────────────────────────────────────────────────

  _accumulateStats(isGAMove, delta, regime, axis, slice, dir) {
    if (isGAMove) {
      this.stats.coherence = Math.min(999, this.stats.coherence + Math.ceil(Math.abs(delta) * 10 + 1));
    } else {
      this.stats.entropy = Math.min(999, this.stats.entropy + Math.ceil(Math.abs(delta) * 10 + 1));
    }

    // Log rotation for harmony detection
    this.rotationLog.push({ axis, slice, dir, ts: Date.now() });
    if (this.rotationLog.length > 4) this.rotationLog.shift();

    // Harmony: same axis+slice rotated 4 times = full cycle (g^4 = id)
    if (this._detectHarmonyCycle()) {
      this.stats.harmony = Math.min(999, this.stats.harmony + 5);
      this._emitUI('HARMONY_CYCLE', { harmony: this.stats.harmony });
    }
  }

  _detectHarmonyCycle() {
    if (this.rotationLog.length < 4) return false;
    const last4 = this.rotationLog.slice(-4);
    const [a] = last4;
    return last4.every(r => r.axis === a.axis && r.slice === a.slice);
  }

  _applyStatDelta(delta) {
    Object.entries(delta).forEach(([key, val]) => {
      if (key in this.stats) {
        this.stats[key] = Math.max(0, Math.min(999, this.stats[key] + val));
      }
    });
  }

  _applyHealthDelta(delta) {
    Object.entries(delta).forEach(([faceId, val]) => {
      const current = this.cityHealth.get(Number(faceId)) ?? 100;
      this.cityHealth.set(Number(faceId), Math.max(0, Math.min(100, current + val)));
    });
  }

  // ─── Seam Damage ──────────────────────────────────────────────────────────

  _computeSeamDamage(prev, next) {
    // For each face, count how many stickers from another face's city
    // ended up adjacent after the rotation. Scale damage by seam frequency.
    const damage = new Map();
    // NOTE: Implement using getSeamInteraction from CityBiomeMode.js
    // Damage = seam frequency * (disrupted pair count) * 0.5
    // Placeholder — replace with real manifold adjacency walk
    return damage;
  }

  _getMostDisruptedFace() {
    let worst = 1, worstHealth = 100;
    this.cityHealth.forEach((health, faceId) => {
      if (health < worstHealth) { worstHealth = health; worst = faceId; }
    });
    return worst;
  }

  _onCityDeath(faceId) {
    this._emitUI('CITY_DIED', { faceId, floor: this.floor });
    const living = [...this.cityHealth.values()].filter(h => h > 0).length;
    if (living === 0) this.endRun('all_cities_dead');
  }

  _triggerManifoldCollapse() {
    this.stats.chaosCharge = 0;
    this._emitUI('MANIFOLD_COLLAPSE', { floor: this.floor });
    // Give player a window to respond before it becomes a death
    const encounter = this._buildEncounter('MANIFOLD_COLLAPSE', { floor: this.floor });
    this.encounterQueue.push(encounter);
    this.runState = 'encounter';
    this._emitUI('ENCOUNTER', encounter);
  }

  _onRegimeCrossing(fromRegime, toRegime, integrity) {
    this._emitUI('REGIME_CROSSING', {
      from:      fromRegime,
      to:        toRegime,
      integrity,
      kStar:     K_STAR,
    });
    // Crossing into structure from entropy: award bonus coherence
    if (toRegime === REGIME.STRUCTURE) {
      this.stats.coherence = Math.min(999, this.stats.coherence + 10);
    }
  }

  // ─── UI Bridge ─────────────────────────────────────────────────────────────

  _emitUI(eventName, payload) {
    // This is the ONLY place RunEngine touches React
    this.onUIEvent?.(eventName, payload);
  }
}

// ─── Encounter option tables ───────────────────────────────────────────────

const ENCOUNTER_OPTIONS = {
  SEAM_TREMOR: (ctx, stats, items) => [
    {
      label: 'Spend 10 Coherence to stabilize',
      available: stats.coherence >= 10,
      resolve: (s, h) => {
        if (s.coherence < 10) return { runEnds: 'death' };
        return { statDelta: { coherence: -10 } };
      },
    },
    {
      label: 'Let it cascade (+5 Entropy, all cities take 8 damage)',
      available: true,
      resolve: (s, h) => ({
        statDelta:   { entropy: 5 },
        healthDelta: { 1: -8, 2: -8, 3: -8, 4: -8, 5: -8, 6: -8 },
      }),
    },
    {
      label: 'Channel it: spend 15 Entropy for 20 Harmony',
      available: stats.entropy >= 15,
      resolve: (s, h) => ({ statDelta: { entropy: -15, harmony: 20 } }),
    },
  ],

  CITY_RAID: (ctx, stats, items) => [
    {
      label: `Defend ${ctx.attackingFace} (costs 5 Coherence)`,
      available: stats.coherence >= 5,
      resolve: (s, h) => ({ statDelta: { coherence: -5 } }),
    },
    {
      label: 'Sacrifice 15 HP from attacked city',
      available: true,
      resolve: (s, h) => ({
        healthDelta: { [ctx.attackingFace]: -15 },
        statDelta:   { entropy: 3 },
      }),
    },
  ],

  FLOOR_BOSS: (ctx, stats, items) => [
    {
      label: 'Challenge (requires Coherence ≥ 50)',
      available: stats.coherence >= 50,
      resolve: (s, h) => ({
        statDelta: { coherence: -30, harmony: 15 },
        item: { id: 'seam_shard', name: 'Seam Shard', effect: 'coherence_regen' },
      }),
    },
    {
      label: 'Flee to next floor (lose 20 Entropy)',
      available: stats.entropy >= 20,
      resolve: (s, h) => ({ statDelta: { entropy: -20 } }),
    },
  ],

  MANIFOLD_COLLAPSE: (ctx, stats, items) => [
    {
      label: 'Spend all Harmony to resist',
      available: stats.harmony >= 20,
      resolve: (s, h) => ({ statDelta: { harmony: -s.harmony, chaosCharge: -100 } }),
    },
    {
      label: 'Accept collapse — run ends',
      available: true,
      resolve: () => ({ runEnds: 'manifold_collapse' }),
    },
  ],
};

// ─── Integrity helper (no React, no Three.js) ─────────────────────────────

function computeIntegrityFromCubies(cubies, size) {
  // Inline version of your useAntipodalIntegrity logic
  // Returns a number in [0, 1]
  // Replace with import from AntipodalSensor.js once extracted
  return 0.72; // placeholder
}
```

---

## Step 4 — `src/simulation/AntipodalSensor.js`

Extract the integrity computation out of the React hook so both `CubeSimulation`
and `RunEngine` can call it without importing React.

```javascript
// src/simulation/AntipodalSensor.js

import { K_STAR } from './constants.js';

/**
 * Computes I(T) = (preserved pairs) / (total pairs)
 * Pure function — no React, no Three.js, no side effects.
 *
 * @param {Array} cubies   - current cube state
 * @param {number} size    - cube dimension
 * @returns {{ integrity, preserved, total, regime }}
 */
export function computeAntipodalIntegrity(cubies, size) {
  const pairs   = buildAntipodalPairs(cubies, size);
  let preserved = 0;

  for (const [pA, pB] of pairs) {
    const stickerA = getStickerAt(cubies, pA);
    const stickerB = getStickerAt(cubies, pB);
    if (!stickerA || !stickerB) continue;
    if (antipodalOrigMatch(stickerA, stickerB)) preserved++;
  }

  const total     = pairs.length;
  const integrity = total > 0 ? preserved / total : 0;
  const regime    = integrity > K_STAR ? 'structure' : 'entropy';

  return { integrity, preserved, total, regime, kStar: K_STAR };
}

// These helper functions are moved here from useAntipodalIntegrity.js
// (implement from existing hook body)
function buildAntipodalPairs(cubies, size) { /* ... */ return []; }
function getStickerAt(cubies, pos)         { /* ... */ return null; }
function antipodalOrigMatch(a, b)         { /* ... */ return false; }
```

---

## Step 5 — `src/simulation/ChaosSimulation.js`

Extract chaos from `useChaosMode`. It runs its own RAF loop. No React state.

```javascript
// src/simulation/ChaosSimulation.js

export class ChaosSimulation {
  constructor(cubeSimulation) {
    this.sim      = cubeSimulation;
    this.level    = 0;
    this.chains   = [];
    this._rafId   = null;
    this._lastTs  = 0;
    this.onUIEvent = null;  // React subscribes here for display-only updates
  }

  setLevel(level) {
    this.level = level;
    if (level === 0) {
      this._stop();
    } else if (!this._rafId) {
      this._start();
    }
  }

  _start() {
    this._lastTs = performance.now();
    const tick = (ts) => {
      const delta = ts - this._lastTs;
      this._lastTs = ts;
      this._tick(delta);
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  _stop() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this.chains = [];
  }

  _tick(delta) {
    if (this.level === 0 || this.chains.length === 0) return;

    // Steps per frame scale with chaos level
    const steps = Math.max(1, Math.floor(this.level * delta / 16));

    const newDeaths = [];
    for (let i = 0; i < steps; i++) {
      const result = this._stepChains();
      newDeaths.push(...result.deaths);
    }

    if (newDeaths.length > 0) {
      // RunEngine gets notified via CubeSimulation's onFlipComplete
      // which fires during sim.flip() inside _stepChains
      this.onUIEvent?.('DEATHS', { deaths: newDeaths });
    }
  }

  _stepChains() {
    const deaths = [];
    // Move existing chain logic from useChaosMode here
    // Call this.sim.flip() for each chain step — RunEngine hears it automatically
    return { deaths };
  }

  dispose() {
    this._stop();
  }
}
```

---

## Step 6 — `src/simulation/SimulationContext.js`

One context that provides the class instances to the React tree.
Components never own simulation state — they only read snapshots.

```javascript
// src/simulation/SimulationContext.js

import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { CubeSimulation }  from './CubeSimulation.js';
import { ChaosSimulation } from './ChaosSimulation.js';
import { RunEngine }        from './RunEngine.js';

const SimCtx = createContext(null);

/**
 * Single provider wrapping the whole app.
 * Exposes stable class instances — never recreated between renders.
 */
export function SimulationProvider({ children }) {
  // Class instances are created once and never change identity
  const simRef   = useRef(null);
  const chaosRef = useRef(null);
  const runRef   = useRef(null);

  if (!simRef.current) {
    simRef.current   = new CubeSimulation(3);
    chaosRef.current = new ChaosSimulation(simRef.current);
    runRef.current   = new RunEngine(simRef.current);
  }

  return (
    <SimCtx.Provider value={{
      sim:   simRef.current,
      chaos: chaosRef.current,
      run:   runRef.current,
    }}>
      {children}
    </SimCtx.Provider>
  );
}

export function useSimulation() { return useContext(SimCtx); }
```

---

## Step 7 — New React Hooks (Thin Wrappers)

These replace `useCubeState` and `useAntipodalIntegrity`. They subscribe to
simulation events and return display data. They never own simulation logic.

```javascript
// src/hooks/useCubieDisplay.js
// Read-only snapshot of cube state for rendering

import { useState, useEffect } from 'react';
import { useSimulation } from '../simulation/SimulationContext.js';

export function useCubieDisplay() {
  const { sim } = useSimulation();

  const [snapshot, setSnapshot] = useState({
    cubies:      sim.cubies,
    manifoldMap: sim.manifoldMap,
    size:        sim.size,
  });

  useEffect(() => {
    // Subscribe to state changes — fires after RunEngine has already run
    return sim.on('state', ({ cubies, manifoldMap }) => {
      setSnapshot({ cubies, manifoldMap, size: sim.size });
    });
  }, [sim]);

  return snapshot;
}
```

```javascript
// src/hooks/useRunDisplay.js
// Subscribes to RunEngine UI events for roguelike display

import { useState, useEffect } from 'react';
import { useSimulation } from '../simulation/SimulationContext.js';

const INITIAL_RUN_STATE = {
  runState:    'idle',
  stats:       { coherence: 0, entropy: 0, harmony: 0, chaosCharge: 0 },
  cityHealth:  { 1: 100, 2: 100, 3: 100, 4: 100, 5: 100, 6: 100 },
  integrity:   1.0,
  regime:      'structure',
  encounter:   null,
  floor:       1,
  lastEvent:   null,
};

export function useRunDisplay() {
  const { run } = useSimulation();
  const [display, setDisplay] = useState(INITIAL_RUN_STATE);

  useEffect(() => {
    // RunEngine fires UI events — React only updates when display changes
    run.onUIEvent = (eventName, payload) => {
      setDisplay(prev => applyRunEvent(prev, eventName, payload));
    };
    return () => { run.onUIEvent = null; };
  }, [run]);

  const resolveEncounter = (encounterId, choiceIndex) => {
    run.resolveEncounter(encounterId, choiceIndex);
  };

  return { ...display, resolveEncounter };
}

function applyRunEvent(prev, eventName, payload) {
  switch (eventName) {
    case 'RUN_STARTED':
      return { ...prev, runState: 'active', floor: payload.floor,
               stats: payload.stats, encounter: null };
    case 'STATS_UPDATE':
      return { ...prev, stats: payload.stats, cityHealth: payload.cityHealth,
               integrity: payload.integrity, regime: payload.regime,
               lastEvent: { type: 'STATS_UPDATE', delta: payload.delta } };
    case 'ENCOUNTER':
      return { ...prev, runState: 'encounter', encounter: payload };
    case 'ENCOUNTER_RESOLVED':
      return { ...prev, runState: 'active', encounter: null,
               stats: payload.stats, cityHealth: payload.cityHealth,
               lastEvent: { type: 'ENCOUNTER_RESOLVED', outcome: payload.outcome } };
    case 'CITY_DIED':
      return { ...prev, lastEvent: { type: 'CITY_DIED', faceId: payload.faceId } };
    case 'RUN_ENDED':
      return { ...prev, runState: payload.reason === 'win' ? 'won' : 'dead',
               lastEvent: { type: 'RUN_ENDED', reason: payload.reason } };
    case 'REGIME_CROSSING':
      return { ...prev, regime: payload.to, integrity: payload.integrity,
               lastEvent: { type: 'REGIME_CROSSING', from: payload.from, to: payload.to } };
    case 'MANIFOLD_COLLAPSE':
      return { ...prev, lastEvent: { type: 'MANIFOLD_COLLAPSE' } };
    case 'HARMONY_CYCLE':
      return { ...prev, stats: { ...prev.stats, harmony: payload.harmony },
               lastEvent: { type: 'HARMONY_CYCLE' } };
    default:
      return prev;
  }
}
```

---

## Step 8 — `App.jsx` Changes

Remove all simulation state from App.jsx. App becomes a layout manager.

```javascript
// In App.jsx — replace the entire useCubeState / useAnimation block with:

import { useSimulation }  from './simulation/SimulationContext.js';
import { useCubieDisplay } from './hooks/useCubieDisplay.js';
import { useRunDisplay }   from './hooks/useRunDisplay.js';

// Inside WORM3():
const { sim, chaos, run } = useSimulation();
const { cubies, manifoldMap, size } = useCubieDisplay();
const runDisplay = useRunDisplay();

// Replace onMove with:
const onMove = useCallback((axis, dir, pos) => {
  const slice = axis === 'col' ? pos.x : axis === 'row' ? pos.y : pos.z;
  sim.rotate(axis, slice, dir);
}, [sim]);  // sim is a stable class instance — this never changes identity

// Replace onTapFlip with:
const onTapFlip = useCallback((pos, dirKey) => {
  sim.flip(pos.x, pos.y, pos.z, dirKey);
}, [sim]);

// Replace chaos control:
const setChaosLevel = useCallback((level) => {
  chaos.setLevel(level);
}, [chaos]);
```

---

## Migration Order

```
Week 1  — src/simulation/constants.js          (30 min)
          src/simulation/AntipodalSensor.js     (2h — extract from hook)
          src/simulation/CubeSimulation.js      (3h — extract from useCubeState)
          Verify: game still works, tests pass

Week 2  — src/simulation/RunEngine.js           (4h — new code)
          src/simulation/SimulationContext.js   (1h)
          src/hooks/useCubieDisplay.js          (1h)
          Verify: rotations still animate, integrity still displays

Week 3  — src/simulation/ChaosSimulation.js    (3h — extract from useChaosMode)
          src/hooks/useRunDisplay.js            (1h)
          Verify: disparity mode still works, death detection correct

Week 4  — Wire RunEngine to BiomeMode          (2h)
          Build EncounterCard.jsx               (UI only, pure React)
          Build RunHUD.jsx                      (UI only, reads useRunDisplay)
          First roguelike loop playable
```

---

## What This Gives You

**Immediately:**
- The disparity death-capture race condition is impossible by construction
- `onTapFlip` dependency array shrinks from 8 items to 1 (`sim`)
- Keyboard handler re-attaches far less often
- `useChaosMode` timing gaps eliminated

**For the roguelike:**
- `RunEngine` evaluates rotation consequences before React knows a rotation happened
- Encounter queue is always consistent with actual cube state
- City health reacts to real seam activations, not scheduled state reads
- `k*` threshold crossing fires an event at the exact frame it crosses

**Architecture ceiling:**
- Adding new encounter types = add to `ENCOUNTER_OPTIONS` table, no React changes
- Adding new stat = add to `BASE_STATS()`, update `applyRunEvent` switch
- Adding items with passive effects = RunEngine checks `this.items` during evaluation
- Floor progression = RunEngine owns `this.floor`, React reads it via events
