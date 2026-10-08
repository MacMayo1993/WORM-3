import { describe, it, expect } from 'vitest';
import { STORM, makeStorm, beginStorm, clearStorm, tickStorm, pickStrikeTile } from '../worm/healerWorm/lightningStorm.js';
import { getAllSurfaceTiles } from '../worm/healerWorm/surfaceTiles.js';

// A small fixed generator: no Math.random anywhere in these tests.
const seeded = seed => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const key = t => `${t.x},${t.y},${t.z},${t.dirKey}`;
const tiles = getAllSurfaceTiles(5);
function run(storm, seconds, { spawning = true, rng = seeded(7), pick } = {}) {
  const struck = [];
  for (let t = 0; t < seconds; t += 0.05) {
    for (const spot of tickStorm(storm, 0.05, { spawning, rng, pick: pick ?? (() => tiles[Math.floor(rng() * tiles.length)]) })) struck.push({ ...spot, at: t });
  }
  return struck;
}

describe('storm schedule', () => {
  it('marks six tiles over the wash, each striking after its telegraph', () => {
    const storm = makeStorm(); beginStorm(storm);
    const marks = []; const rng = seeded(3);
    const pick = r => { const tile = tiles[Math.floor(r() * tiles.length)]; marks.push(tile); return tile; };
    const struck = run(storm, 14, { rng, pick });
    expect(marks).toHaveLength(STORM.strikes);
    expect(struck).toHaveLength(STORM.strikes);
    for (const spot of struck) expect(spot.age).toBeGreaterThanOrEqual(STORM.telegraph);
    expect(struck.map(s => s.id)).toEqual([...struck.map(s => s.id)].sort((a, b) => a - b));   // in the order they were marked
  });
  it('waits for the first mark and spaces the rest', () => {
    const storm = makeStorm(); beginStorm(storm);
    const marked = [];
    const rng = seeded(11);
    for (let t = 0; t < 14; t += 0.05) {
      const before = storm.spawned;
      tickStorm(storm, 0.05, { spawning: true, rng, pick: r => tiles[Math.floor(r() * tiles.length)] });
      if (storm.spawned > before) marked.push(t);
    }
    expect(marked[0]).toBeGreaterThanOrEqual(STORM.firstDelay - 0.06);
    expect(marked[0]).toBeLessThanOrEqual(STORM.firstDelay + 0.1);
    for (let i = 1; i < marked.length; i++) {
      expect(marked[i] - marked[i - 1]).toBeGreaterThanOrEqual(STORM.gapMin - 0.06);
      expect(marked[i] - marked[i - 1]).toBeLessThanOrEqual(STORM.gapMax + 0.1);
    }
  });
  it('stops marking when the wash ends but still strikes what is already charging', () => {
    const storm = makeStorm(); beginStorm(storm);
    const rng = seeded(5), pick = r => tiles[Math.floor(r() * tiles.length)];
    run(storm, 3, { rng, pick });
    const open = storm.spots.length, spawned = storm.spawned;
    expect(open).toBeGreaterThan(0);
    const struck = run(storm, 4, { spawning: false, rng, pick });
    expect(storm.spawned).toBe(spawned);
    expect(struck).toHaveLength(open);
    expect(storm.spots).toHaveLength(0);
  });
  it('retries soon when no tile could be found, and never double-counts a mark', () => {
    const storm = makeStorm(); beginStorm(storm);
    let calls = 0;
    const pick = () => (++calls < 4 ? null : tiles[0]);
    run(storm, 2, { pick });
    expect(storm.spawned).toBe(1);
    expect(calls).toBeLessThanOrEqual(5);
  });
  it('keeps a landed strike on screen for its flash, then drops it', () => {
    const storm = makeStorm(); beginStorm(storm);
    const rng = seeded(2);
    let struckAt = null;
    for (let t = 0; t < 8; t += 0.05) {
      const fired = tickStorm(storm, 0.05, { spawning: true, rng, pick: r => tiles[Math.floor(r() * tiles.length)] });
      if (fired.length && struckAt === null) { struckAt = t; expect(storm.flashes.some(f => f.age === 0)).toBe(true); }
      if (struckAt !== null && t > struckAt + STORM.flash + 0.2) break;
    }
    expect(storm.flashes.every(f => f.age < STORM.flash)).toBe(true);
  });
  it('clears every mark and flash', () => {
    const storm = makeStorm(); beginStorm(storm); run(storm, 5);
    clearStorm(storm);
    expect(storm.spots).toHaveLength(0); expect(storm.flashes).toHaveLength(0); expect(storm.spawned).toBe(0);
  });
});

describe('where a mark may go', () => {
  const head = tiles[0], ahead = tiles[1];
  const body = tiles.slice(2, 12).map(key);
  const avoid = new Set([key(head), key(ahead), key(tiles[2]), key(tiles[40])]);
  it('never picks an avoided tile, over many draws', () => {
    const rng = seeded(21);
    for (let i = 0; i < 400; i++) {
      const tile = pickStrikeTile({ tiles, body, avoid }, rng);
      expect(avoid.has(key(tile))).toBe(false);
    }
  });
  it('aims a share at the worm\'s own body and the rest at the board', () => {
    const rng = seeded(8), bodySet = new Set(body);
    let onBody = 0; const N = 600;
    for (let i = 0; i < N; i++) if (bodySet.has(key(pickStrikeTile({ tiles, body, avoid }, rng)))) onBody++;
    expect(onBody / N).toBeGreaterThan(STORM.bodyShare - 0.12);
    expect(onBody / N).toBeLessThan(STORM.bodyShare + 0.15);
  });
  it('falls back to the board when the whole body is off limits, and to null when nothing is left', () => {
    const rng = () => 0;                                             // always chooses the body path first
    const all = new Set(tiles.map(key));
    const none = pickStrikeTile({ tiles, body, avoid: all }, rng);
    expect(none).toBeNull();
    const onlyBodyAvoided = pickStrikeTile({ tiles, body, avoid: new Set(body) }, rng);
    expect(onlyBodyAvoided).not.toBeNull(); expect(body.includes(key(onlyBodyAvoided))).toBe(false);
  });
});
