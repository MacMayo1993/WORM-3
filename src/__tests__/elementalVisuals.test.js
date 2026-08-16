// Guardrails for the elemental visual foundation.
//
// The cube skin, the particle field and the fill light used to each carry their own
// copy of the fade constants, their own density constants, and their own if/set
// chain deciding which layer an element gets. These tests pin the three shared
// modules that replaced all of that, so the per-element art passes that follow
// (water → fire → nature → ice, then lightning) have something to break loudly
// against rather than a silently drifting renderer.
//
// All three modules are pure by construction — no React, no Three, no store — so
// everything here runs headlessly.
import { describe, it, expect } from 'vitest';
import {
  elementalEnvelope,
  smoothstep01,
  ELEMENTAL_FADE_IN,
  ELEMENTAL_FADE_OUT,
  elementalRideBlend,
  ELEMENTAL_RIDE_HOLD,
  ELEMENTAL_RIDE_OUT
} from '../worm/healerWorm/elementalLifecycle.js';
import {
  resolveElementalQuality,
  elementalBudget,
  ELEMENTAL_TIERS
} from '../worm/healerWorm/elementalQuality.js';
import {
  ELEMENTAL_RENDERERS,
  resolveElementalRenderer
} from '../worm/healerWorm/elementalRenderers.js';
import {
  hashSeed,
  hashSeed2,
  cellSeed,
  cellEdgeMask,
  cellSweepDelay,
  resolveSweepOrigin
} from '../worm/healerWorm/elementalSeeds.js';
import { ELEMENTAL_TYPES, getElementalDef } from '../worm/healerWorm/elementalDefs.js';
import { ELEMENTAL_DURATION, ELEMENTAL_FOCUS_DURATION } from '../worm/healerWorm/constants.js';

describe('elemental lifecycle envelope', () => {
  const full = (o) => elementalEnvelope({ remaining: ELEMENTAL_DURATION, ...o });

  it('rises from nothing on claim and reaches full strength after the fade-in', () => {
    expect(full({ elapsed: 0 }).intensity).toBe(0);
    expect(full({ elapsed: ELEMENTAL_FADE_IN / 2 }).intensity).toBeCloseTo(0.5);
    expect(full({ elapsed: ELEMENTAL_FADE_IN }).intensity).toBe(1);
    expect(full({ elapsed: 99 }).intensity).toBe(1);
  });

  it('keeps grow above zero so a zero-scale matrix never yields NaN normals', () => {
    expect(full({ elapsed: 0 }).grow).toBeGreaterThan(0);
    expect(elementalEnvelope({ elapsed: 0, remaining: 0 }).grow).toBeGreaterThan(0);
  });

  it('orders the phases claim → hold → release across a whole wash', () => {
    expect(full({ elapsed: 0.1 }).phase).toBe('claim');
    expect(full({ elapsed: 3 }).phase).toBe('hold');
    expect(elementalEnvelope({ elapsed: 9, remaining: ELEMENTAL_FADE_OUT / 2 }).phase).toBe('release');
    // Expired: still 'release', never wrapping back round to 'claim'.
    expect(elementalEnvelope({ elapsed: 11, remaining: 0 }).phase).toBe('release');
  });

  it('holds the claim phase for the whole camera focus beat', () => {
    // The sim is frozen while focus > 0; the wash must read as still arriving.
    expect(full({ elapsed: 5, focus: 1.2 }).phase).toBe('claim');
    expect(full({ elapsed: 5, focus: 0 }).phase).toBe('hold');
  });

  it('release runs 0 → 1 as the tail drains, the inverse of intensity', () => {
    expect(full({ elapsed: 5 }).release).toBe(0);
    const tail = elementalEnvelope({ elapsed: 9, remaining: ELEMENTAL_FADE_OUT / 4 });
    expect(tail.release).toBeCloseTo(0.75);
    expect(tail.intensity).toBeCloseTo(0.25);
    expect(elementalEnvelope({ elapsed: 11, remaining: 0 }).release).toBe(1);
  });

  it('stops accents before the dissolve, and during the frozen focus beat', () => {
    expect(full({ elapsed: 3 }).accents).toBe(true);
    expect(full({ elapsed: 3, focus: 0.5 }).accents).toBe(false);
    expect(elementalEnvelope({ elapsed: 9, remaining: 0.3 }).accents).toBe(false);
  });

  it('never blooms past the tail when a wash is claimed with little clock left', () => {
    // A replacement claimed onto a nearly-drained clock must not flash to full and
    // then snap off — intensity is bounded by the weaker of the two ends.
    const env = elementalEnvelope({ elapsed: ELEMENTAL_FADE_IN, remaining: 0.25 });
    expect(env.intensity).toBeLessThan(0.3);
  });

  it('the claim sweep is a normalised 0..1 ramp over its own duration', () => {
    expect(full({ elapsed: 0, sweep: 1.8 }).claim).toBe(0);
    expect(full({ elapsed: 0.9, sweep: 1.8 }).claim).toBeCloseTo(0.5);
    expect(full({ elapsed: 5, sweep: 1.8 }).claim).toBe(1);
  });

  it('smoothstep01 clamps and eases at both ends', () => {
    expect(smoothstep01(-1)).toBe(0);
    expect(smoothstep01(0)).toBe(0);
    expect(smoothstep01(0.5)).toBeCloseTo(0.5);
    expect(smoothstep01(1)).toBe(1);
    expect(smoothstep01(2)).toBe(1);
  });
});

describe('elemental claim camera', () => {
  const D = ELEMENTAL_DURATION;
  const F = ELEMENTAL_FOCUS_DURATION;
  // Seconds of wash consumed → the blend. The beat freezes the wash clock, so
  // washElapsed 0 is "the beat just ended".
  const atWash = (washElapsed, focusT = 0) =>
    elementalRideBlend({ focusT, remaining: D - washElapsed, maxT: D, focusDuration: F });

  it('eases in over the claim beat rather than snapping to the close shot', () => {
    expect(elementalRideBlend({ focusT: F, remaining: D, maxT: D, focusDuration: F })).toBe(0);
    const mid = elementalRideBlend({ focusT: F - 0.18, remaining: D, maxT: D, focusDuration: F });
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    // Fully committed well before the beat ends, and stays there through the freeze.
    expect(elementalRideBlend({ focusT: F - 0.35, remaining: D, maxT: D, focusDuration: F })).toBe(1);
    expect(elementalRideBlend({ focusT: 0.2, remaining: D, maxT: D, focusDuration: F })).toBe(1);
  });

  it('lingers close for the hold, then gives the cube back', () => {
    expect(atWash(0)).toBe(1);
    expect(atWash(ELEMENTAL_RIDE_HOLD)).toBe(1);
    const easing = atWash(ELEMENTAL_RIDE_HOLD + ELEMENTAL_RIDE_OUT / 2);
    expect(easing).toBeGreaterThan(0);
    expect(easing).toBeLessThan(1);
    expect(atWash(ELEMENTAL_RIDE_HOLD + ELEMENTAL_RIDE_OUT)).toBe(0);
  });

  it('stays out for the whole rest of the wash', () => {
    // The bug: the close framing used to ride the wash's entire clock, so the
    // player spent ten seconds unable to see the cube the element was washing.
    for (const washElapsed of [3, 5, 8, D - 0.1]) {
      expect(atWash(washElapsed), `still close at ${washElapsed}s`).toBe(0);
    }
  });

  it('is monotonically non-increasing once the beat has ended', () => {
    let prev = Infinity;
    for (let t = 0; t <= D; t += 0.1) {
      const v = atWash(t);
      expect(v).toBeLessThanOrEqual(prev + 1e-9);
      prev = v;
    }
  });

  it('is fully out whenever no wash is running', () => {
    expect(elementalRideBlend({ focusT: 0, remaining: 0, maxT: D, focusDuration: F })).toBe(0);
    expect(elementalRideBlend({})).toBe(0);
  });

  it('holds still while the beat freezes the clock', () => {
    // Nothing is consumed during the freeze, so the linger cannot start early —
    // this is what keeps the shot paused exactly when gameplay is.
    expect(atWash(0, 1.2)).toBe(atWash(0, 0.4));
  });
});

describe('elemental quality budget', () => {
  it('leaves desktop play at the pre-tier constants', () => {
    // These three numbers were the hard-coded constants in the skin, the flame
    // component and the particle field. Desktop must be unchanged by the refactor.
    const q = resolveElementalQuality({ mobile: false, reducedMotion: false, cubeSize: 3 });
    expect(q.tier).toBe('high');
    expect(q.skinGrid).toBe(5);
    expect(q.particleCount).toBe(130);
    expect(q.flamesPerCell).toBe(5);
  });

  it('steps down for phones and again for large boards', () => {
    const phone = resolveElementalQuality({ mobile: true, cubeSize: 3 });
    const bigDesktop = resolveElementalQuality({ mobile: false, cubeSize: 15 });
    const bigPhone = resolveElementalQuality({ mobile: true, cubeSize: 15 });
    expect(phone.skinGrid).toBeLessThan(5);
    expect(bigDesktop.skinGrid).toBeLessThan(5);
    expect(bigPhone.skinGrid).toBeLessThanOrEqual(phone.skinGrid);
    expect(bigPhone.particleCount).toBeLessThanOrEqual(phone.particleCount);
  });

  it('degrades density but never deletes the element', () => {
    // Every tier still sheathes the whole cube: the cover grid reaches every corner
    // and fire still has tongues to burn with.
    for (const tier of ELEMENTAL_TIERS) {
      const b = elementalBudget(tier);
      expect(b.skinGrid).toBeGreaterThanOrEqual(3);
      expect(b.flamesPerCell).toBeGreaterThanOrEqual(1);
    }
  });

  it('reduced motion freezes the wash and drops every particle, whatever the device', () => {
    for (const cubeSize of [2, 3, 5, 15]) {
      for (const mobile of [false, true]) {
        const q = resolveElementalQuality({ mobile, reducedMotion: true, cubeSize });
        expect(q.animate).toBe(false);
        expect(q.accents).toBe(false);
        expect(q.particleCount).toBe(0);
      }
    }
  });

  it('a phone pushed to the floor budget by board size still animates', () => {
    // Landing on the cheapest budget is a perf decision; only an explicit
    // reduced-motion request is allowed to stop the motion.
    const q = resolveElementalQuality({ mobile: true, reducedMotion: false, cubeSize: 15 });
    expect(q.animate).toBe(true);
  });

  it('falls back to the floor budget for an unknown tier', () => {
    expect(elementalBudget('nonsense')).toBe(elementalBudget('minimal'));
  });

  it('bounds effect counts by tier rather than by cube size', () => {
    // The acceptance criterion from the art plan: cost must not scale with the
    // board. A 15×15 must not ask for more of anything than a 3×3 does.
    const small = resolveElementalQuality({ cubeSize: 3 });
    const huge = resolveElementalQuality({ cubeSize: 15 });
    expect(huge.skinGrid).toBeLessThanOrEqual(small.skinGrid);
    expect(huge.particleCount).toBeLessThanOrEqual(small.particleCount);
    expect(huge.adornments).toBeLessThanOrEqual(small.adornments);
  });
});

describe('elemental renderer registry', () => {
  it('resolves every canonical element to a renderer', () => {
    for (const type of ELEMENTAL_TYPES) {
      const r = resolveElementalRenderer(type, getElementalDef);
      expect(r, `${type} has no renderer`).toBeTruthy();
      expect(ELEMENTAL_RENDERERS[r.key]).toBe(r);
    }
  });

  it('fails soft on unknown types and on definitions naming a missing renderer', () => {
    expect(resolveElementalRenderer('nonsense', getElementalDef)).toBeNull();
    expect(resolveElementalRenderer(null, getElementalDef)).toBeNull();
    expect(resolveElementalRenderer('rocket', getElementalDef)).toBeNull();
    expect(resolveElementalRenderer('ghost', () => ({ renderer: 'not-a-renderer' }))).toBeNull();
    expect(resolveElementalRenderer('ghost', () => ({}))).toBeNull();
  });

  it('every renderer declares a transform mode and a scale rule', () => {
    for (const [key, r] of Object.entries(ELEMENTAL_RENDERERS)) {
      expect(r.key).toBe(key);
      expect(['instanced', 'perCell']).toContain(r.mode);
      expect(typeof r.uniformScale).toBe('boolean');
    }
  });

  it('billboarded renderers demand a uniform cell scale', () => {
    // A camera-facing quad takes its on-screen size from world scale, so a squashed
    // (cell, cell, grow) transform would distort it. Fire is the current case.
    expect(ELEMENTAL_RENDERERS.flames.uniformScale).toBe(true);
    expect(ELEMENTAL_RENDERERS.surface.uniformScale).toBe(false);
  });

  it('the water/ice pair share one renderer and fire does not', () => {
    expect(getElementalDef('water').renderer).toBe(getElementalDef('ice').renderer);
    expect(getElementalDef('fire').renderer).not.toBe(getElementalDef('water').renderer);
  });
});

describe('elemental seeds and cube-scale masks', () => {
  it('hashes are deterministic, decorrelated and in range', () => {
    for (let s = 0; s < 40; s++) {
      for (let i = 0; i < 6; i++) {
        const a = hashSeed(s, i);
        expect(a).toBe(hashSeed(s, i)); // stable across calls
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThan(1);
        expect(hashSeed2(s, i)).toBeGreaterThanOrEqual(0);
        expect(hashSeed2(s, i)).toBeLessThan(1);
      }
    }
    expect(hashSeed(3, 1)).not.toBeCloseTo(hashSeed2(3, 1), 3);
  });

  it('reproduces the flame jitter the per-cell component used to compute', () => {
    // The GLSL flame field re-derives this on the GPU; if this drifts, every cell
    // on the burning cube silently rearranges.
    const legacy = (seed, i) => {
      const h = Math.sin((seed + 1) * 12.9898 + i * 78.233) * 43758.5453;
      return h - Math.floor(h);
    };
    for (const [s, i] of [[0, 0], [7, 3], [149, 4]]) {
      expect(hashSeed(s, i)).toBe(legacy(s, i));
    }
  });

  it('cellSeed is unique per cell and does not twin across faces', () => {
    const seen = new Set();
    const gridN = 5;
    for (const face of ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ']) {
      for (let j = 0; j < gridN; j++) {
        for (let k = 0; k < gridN; k++) {
          const s = cellSeed(face, j, k, gridN);
          expect(seen.has(s), `${face}-${j}-${k} collides`).toBe(false);
          seen.add(s);
        }
      }
    }
    expect(seen.size).toBe(6 * gridN * gridN);
  });

  it('edge masks separate the silhouette from the readable centre', () => {
    const g = 5;
    expect(cellEdgeMask(0, 0, g)).toMatchObject({ edge: 1, corner: 1 });
    expect(cellEdgeMask(0, 2, g)).toMatchObject({ edge: 1, corner: 0 });
    expect(cellEdgeMask(2, 2, g)).toMatchObject({ edge: 0, corner: 0 });
    // The face centre must stay quiet — that is where tile marks, bombs and heal
    // feedback have to remain legible under every element.
    expect(cellEdgeMask(2, 2, g).centre).toBe(1);
    expect(cellEdgeMask(0, 0, g).rim).toBe(1);
  });

  it('there are exactly four corner cells on a face, at any grid size', () => {
    for (const g of [3, 4, 5]) {
      let corners = 0;
      for (let j = 0; j < g; j++) for (let k = 0; k < g; k++) corners += cellEdgeMask(j, k, g).corner;
      expect(corners).toBe(4);
    }
  });

  it('rim is bounded and monotonic outward from the centre', () => {
    const g = 5;
    for (let j = 0; j < g; j++) {
      for (let k = 0; k < g; k++) {
        const m = cellEdgeMask(j, k, g);
        expect(m.rim).toBeGreaterThanOrEqual(0);
        expect(m.rim).toBeLessThanOrEqual(1);
        expect(m.centre).toBeCloseTo(1 - m.rim);
      }
    }
    expect(cellEdgeMask(2, 2, g).rim).toBeLessThan(cellEdgeMask(1, 2, g).rim);
    expect(cellEdgeMask(1, 2, g).rim).toBeLessThan(cellEdgeMask(0, 2, g).rim);
  });

  it('the claim sweep starts at the claimed tile and reaches every cell by the end', () => {
    const g = 5;
    const origin = { faceKey: 'PZ', j: 2, k: 2 };
    expect(cellSweepDelay(origin, origin, g)).toBe(0);
    // Same face: further out arrives later.
    const near = cellSweepDelay({ faceKey: 'PZ', j: 2, k: 3 }, origin, g);
    const far = cellSweepDelay({ faceKey: 'PZ', j: 0, k: 0 }, origin, g);
    expect(near).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(near);
    // Other faces follow the claimed one rather than racing it.
    expect(cellSweepDelay({ faceKey: 'NX', j: 2, k: 2 }, origin, g)).toBeGreaterThan(far);
    // And nothing is left behind after the sweep completes.
    for (const face of ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ']) {
      for (let j = 0; j < g; j++) {
        for (let k = 0; k < g; k++) {
          const d = cellSweepDelay({ faceKey: face, j, k }, origin, g);
          expect(d).toBeGreaterThanOrEqual(0);
          expect(d).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('no sweep origin means no delay', () => {
    expect(cellSweepDelay({ faceKey: 'PZ', j: 0, k: 0 }, null, 5)).toBe(0);
  });

  it('resolves a claimed sticker to the cover cell under it', () => {
    // A 3x3 board: every sticker is its own cell, so the match must be exact.
    const cells = [
      { faceKey: 'PZ', j: 0, k: 0, x: 0, y: 0, z: 2 },
      { faceKey: 'PZ', j: 1, k: 1, x: 1, y: 1, z: 2 },
      { faceKey: 'PY', j: 1, k: 1, x: 1, y: 2, z: 1 }
    ];
    expect(resolveSweepOrigin(cells, { x: 1, y: 1, z: 2, dirKey: 'PZ' })).toBe(cells[1]);
    expect(resolveSweepOrigin(cells, { x: 1, y: 2, z: 1, dirKey: 'PY' })).toBe(cells[2]);
  });

  it('snaps to the nearest cell on the claimed face when cells are coarser than stickers', () => {
    // Above the grid cap several stickers share one cover cell, so the claimed
    // sticker often has no cell of its own — the sweep must still start under the
    // worm rather than defaulting to a corner or giving up.
    const cells = [
      { faceKey: 'PZ', j: 0, k: 0, x: 1, y: 1, z: 14 },
      { faceKey: 'PZ', j: 1, k: 1, x: 7, y: 7, z: 14 },
      { faceKey: 'PZ', j: 2, k: 2, x: 13, y: 13, z: 14 }
    ];
    expect(resolveSweepOrigin(cells, { x: 8, y: 6, z: 14, dirKey: 'PZ' })).toBe(cells[1]);
    expect(resolveSweepOrigin(cells, { x: 0, y: 2, z: 14, dirKey: 'PZ' })).toBe(cells[0]);
  });

  it('never starts the sweep on a face the element was not claimed on', () => {
    const cells = [
      { faceKey: 'PZ', j: 0, k: 0, x: 0, y: 0, z: 2 },
      { faceKey: 'NX', j: 0, k: 0, x: 0, y: 0, z: 0 }
    ];
    // The nearest cell by raw distance is the PZ one; the face must win anyway.
    expect(resolveSweepOrigin(cells, { x: 0, y: 0, z: 0, dirKey: 'NX' })).toBe(cells[1]);
    // A face with no cells at all yields nothing rather than a wrong-face origin.
    expect(resolveSweepOrigin(cells, { x: 0, y: 0, z: 0, dirKey: 'PY' })).toBeNull();
  });

  it('fails soft with no origin or no cells', () => {
    expect(resolveSweepOrigin([], { x: 0, y: 0, z: 0, dirKey: 'PZ' })).toBeNull();
    expect(resolveSweepOrigin([{ faceKey: 'PZ', x: 0, y: 0, z: 0 }], null)).toBeNull();
  });

  it('orders a whole board so the claimed face leads and the rest follow', () => {
    // This is the shape the shader consumes: the claimed face occupies the first
    // half of the sweep, every other face the second, and nothing is left behind.
    const gridN = 3;
    const faces = ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ'];
    const cells = [];
    for (const faceKey of faces) {
      for (let j = 0; j < gridN; j++) for (let k = 0; k < gridN; k++) cells.push({ faceKey, j, k });
    }
    const origin = { faceKey: 'PY', j: 1, k: 1 };
    const delays = cells.map(c => cellSweepDelay(c, origin, gridN));
    const onOrigin = delays.filter((_, i) => cells[i].faceKey === 'PY');
    const elsewhere = delays.filter((_, i) => cells[i].faceKey !== 'PY');
    expect(Math.min(...onOrigin)).toBe(0);
    expect(Math.max(...onOrigin)).toBeLessThan(Math.min(...elsewhere));
    expect(Math.max(...elsewhere)).toBeLessThan(1);
  });
});
