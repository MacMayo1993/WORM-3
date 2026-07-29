// Phase 1 exit criterion for Mega Worm: a headless 15×15 run must survive a long
// soak without producing an invalid coordinate or corrupting cube state.
//
// The point isn't to assert a particular gameplay outcome — it's that the size
// jump from 7 to 15 doesn't break any of the invariants the whole mode rests on.
// Everything downstream (the manifold map, tunnel pairing, the worm's surface
// navigation, the renderer's index math) assumes these hold, and each one used to
// hold only because no cube was ever bigger than 7.
import { describe, it, expect } from 'vitest';
import { makeCubies, isSurfaceSticker } from '../game/cubeState.js';
import { MEGA_SIZE } from '../game/sliceIndex.js';
import { normalizeWave, applyWaveToCubies, MAX_WAVE_PLANES } from '../game/rotationWave.js';
import { getManifoldMap, resetManifoldMap } from '../game/manifoldMapStore.js';
import { getManifoldGridId } from '../game/gridIds.js';
import { applyWaveToSim } from '../worm/healerWorm/wormSim.js';
import { generateScrambleWaves, buildInverseQueue } from '../worm/healerWorm/waveScramble.js';
import { makeWormCtx, makeWormSimFor, makeWormRunner, makeSeededRand } from './helpers/wormHarness.js';
import { DEFAULT_SETTINGS } from '../utils/colorSchemes.js';

const SIZE = MEGA_SIZE;
const SURFACE_STICKERS = 6 * SIZE * SIZE; // 1,350

const megaCubies = () => makeCubies(SIZE, { allowMega: true });

const AXES = ['col', 'row', 'depth'];

describe('15×15 construction', () => {
  it('builds only through the deliberate Mega path', () => {
    expect(() => makeCubies(SIZE)).toThrow(RangeError);
    expect(() => makeCubies(SIZE, { allowMega: true })).not.toThrow();
    // The opt-in widens the ceiling to exactly 15, not to anything larger.
    expect(() => makeCubies(16, { allowMega: true })).toThrow(RangeError);
  });

  it('has the right cubie and sticker counts', () => {
    const cubies = megaCubies();
    expect(cubies).toHaveLength(SIZE);

    let cubieCount = 0;
    let stickerCount = 0;
    const perFace = {};
    for (let x = 0; x < SIZE; x++) {
      for (let y = 0; y < SIZE; y++) {
        for (let z = 0; z < SIZE; z++) {
          cubieCount++;
          for (const dir in cubies[x][y][z].stickers) {
            stickerCount++;
            perFace[dir] = (perFace[dir] ?? 0) + 1;
          }
        }
      }
    }
    expect(cubieCount).toBe(SIZE ** 3);       // 3,375
    expect(stickerCount).toBe(SURFACE_STICKERS); // 1,350
    for (const dir of ['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ']) {
      expect(perFace[dir], dir).toBe(SIZE * SIZE); // 225 each
    }
  });

  it('gives every sticker a distinct manifold grid ID that still fits the format', () => {
    // Grid IDs are zero-padded to three digits. size² = 225 fits; a larger cube
    // would silently overflow the format and collide with another face's IDs.
    const cubies = megaCubies();
    const ids = new Set();
    for (let x = 0; x < SIZE; x++) {
      for (let y = 0; y < SIZE; y++) {
        for (let z = 0; z < SIZE; z++) {
          for (const dir in cubies[x][y][z].stickers) {
            const id = getManifoldGridId(cubies[x][y][z].stickers[dir], SIZE);
            expect(id).toMatch(/^M[1-6]-\d{3}$/);
            ids.add(id);
          }
        }
      }
    }
    expect(ids.size).toBe(SURFACE_STICKERS);
  });
});

describe('15×15 soak — 1,000 rotation waves', () => {
  it('never produces an invalid coordinate or loses a sticker', () => {
    resetManifoldMap();
    const rand = makeSeededRand(0xC0FFEE);
    let cubies = megaCubies();

    for (let n = 0; n < 1000; n++) {
      const axis = AXES[Math.floor(rand() * 3)];
      const planeCount = 1 + Math.floor(rand() * MAX_WAVE_PLANES);
      const slices = [];
      while (slices.length < planeCount) {
        const s = Math.floor(rand() * SIZE);
        if (!slices.includes(s)) slices.push(s);
      }
      const { wave, error } = normalizeWave(
        axis,
        slices.map(sliceIndex => ({ sliceIndex, dir: rand() < 0.5 ? 1 : -1, numTurns: 1 + Math.floor(rand() * 2) })),
        SIZE
      );
      if (error) continue;
      cubies = applyWaveToCubies(cubies, SIZE, wave);

      // Spot-check structure every 100 waves — a full 3,375-cell audit on every
      // one of 1,000 waves would make this test minutes long for no more signal.
      if (n % 100 !== 0) continue;

      let stickerCount = 0;
      for (let x = 0; x < SIZE; x++) {
        for (let y = 0; y < SIZE; y++) {
          for (let z = 0; z < SIZE; z++) {
            const c = cubies[x][y][z];
            // Every cubie knows where it is, and it is somewhere real.
            expect(c.x).toBe(x);
            expect(c.y).toBe(y);
            expect(c.z).toBe(z);
            for (const dir in c.stickers) {
              stickerCount++;
              // A sticker only ever lives on a face of the shell. If a rotation
              // ever deposited one on an interior face this is what catches it.
              expect(isSurfaceSticker(x, y, z, dir, SIZE), `${x},${y},${z} ${dir}`).toBe(true);
              const st = c.stickers[dir];
              // Provenance is immutable — the whole antipodal/grid-ID system
              // keys off origPos/origDir never changing.
              expect(st.origPos.x).toBeGreaterThanOrEqual(0);
              expect(st.origPos.x).toBeLessThan(SIZE);
              expect(st.origPos.y).toBeGreaterThanOrEqual(0);
              expect(st.origPos.y).toBeLessThan(SIZE);
              expect(st.origPos.z).toBeGreaterThanOrEqual(0);
              expect(st.origPos.z).toBeLessThan(SIZE);
            }
          }
        }
      }
      expect(stickerCount, `after ${n} waves`).toBe(SURFACE_STICKERS);
    }

    // The manifold map must still see every sticker exactly once at the end.
    const map = getManifoldMap(cubies, SIZE, 1);
    expect(map.size).toBe(SURFACE_STICKERS);
    resetManifoldMap();
  });

  it('returns to solved when the whole scramble is played back', () => {
    const rand = makeSeededRand(0x5EED);
    const solved = megaCubies();
    const waves = generateScrambleWaves(SIZE, 40, MAX_WAVE_PLANES, rand);

    let cubies = solved;
    for (const w of waves) cubies = applyWaveToCubies(cubies, SIZE, w);
    expect(JSON.stringify(cubies)).not.toBe(JSON.stringify(solved));

    for (const w of buildInverseQueue(waves)) cubies = applyWaveToCubies(cubies, SIZE, w);
    expect(JSON.stringify(cubies)).toBe(JSON.stringify(solved));
  });
});

describe('15×15 soak — 10,000 worm steps', () => {
  it('keeps the worm on the surface with rotation waves landing throughout', () => {
    const cubies = megaCubies();
    const ctx = makeWormCtx({ getCubies: () => cubies });
    const sim = makeWormSimFor(SIZE, { orbCount: 12, wormholeInterval: 9999 });
    sim.rand = makeSeededRand(0xBEEF);
    const { runSteps } = makeWormRunner(SIZE);
    const rand = makeSeededRand(0xFEED);

    const inRange = (v) => Number.isInteger(v) && v >= 0 && v < SIZE;
    const DIRS = new Set(['PX', 'NX', 'PY', 'NY', 'PZ', 'NZ']);

    const STEPS = 10000;
    const CHUNK = 100;
    for (let done = 0; done < STEPS; done += CHUNK) {
      runSteps(sim, ctx, CHUNK);

      // Land a wave every chunk, so the sim spends the whole soak being
      // transformed rather than crawling on a static cube.
      const axis = AXES[Math.floor(rand() * 3)];
      const slices = [];
      while (slices.length < 1 + Math.floor(rand() * MAX_WAVE_PLANES)) {
        const s = Math.floor(rand() * SIZE);
        if (!slices.includes(s)) slices.push(s);
      }
      const { wave, error } = normalizeWave(
        axis,
        slices.map(sliceIndex => ({ sliceIndex, dir: rand() < 0.5 ? 1 : -1, numTurns: 1 })),
        SIZE
      );
      if (!error) applyWaveToSim(sim, SIZE, ctx, wave, { inOpeningScramble: false, paused: false });

      // The head is always on a real surface tile.
      expect(inRange(sim.pos.x) && inRange(sim.pos.y) && inRange(sim.pos.z), JSON.stringify(sim.pos)).toBe(true);
      expect(DIRS.has(sim.pos.dirKey)).toBe(true);
      expect(isSurfaceSticker(sim.pos.x, sim.pos.y, sim.pos.z, sim.pos.dirKey, SIZE), JSON.stringify(sim.pos)).toBe(true);

      // So is every orb — a wave that dropped one off the shell would strand it
      // somewhere the player can never reach.
      for (const p of sim.powerups) {
        expect(isSurfaceSticker(p.x, p.y, p.z, p.dirKey, SIZE), JSON.stringify(p)).toBe(true);
      }
      for (const s of sim.specials) {
        expect(isSurfaceSticker(s.x, s.y, s.z, s.dirKey, SIZE), JSON.stringify(s)).toBe(true);
      }

      // The pre-allocated rings never overflow their capacity.
      expect(sim.tileTrail.count).toBeLessThanOrEqual(sim.tileTrail.capacity);
      expect(sim.stepHistory.count).toBeLessThanOrEqual(sim.stepHistory.capacity);
      expect(sim.pathHistory.count).toBeLessThanOrEqual(sim.pathHistory.capacity);
    }
  }, 60000);
});

describe('save-data containment', () => {
  it('never persists a cube size, so a session cannot come back up at 15', () => {
    // The store hardcodes size 3 at boot and size is not part of the persisted
    // settings blob. That is what keeps Mega Worm from leaking into Freeplay or
    // a story level through a restored setting.
    expect(Object.keys(DEFAULT_SETTINGS)).not.toContain('size');
    expect(Object.keys(DEFAULT_SETTINGS)).not.toContain('cubeSize');
  });
});
