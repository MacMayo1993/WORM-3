import { describe, it, expect } from 'vitest';
import {
  bombCap,
  tileKeyOf,
  computeBlastTiles,
  bombDisarmRing,
  isBombDisarmed,
  checkBlastHitWorm,
  BOMB_BLAST_RADIUS,
} from '../worm/healerWorm/bombs.js';

// A minimal stand-in for the useWormCrawler proxy: every field is a { current }.
function makeWorm({ buf, tailLength = 400, jumping = false, grace = 0, rocket = false }) {
  const tt = { buf, head: 0, capacity: buf.length, count: buf.length };
  return {
    tileTrail: { current: tt },
    tailLength: { current: tailLength },
    isJumping: { current: jumping },
    landingGraceT: { current: grace },
    rocketActive: { current: rocket }
  };
}

const SIZE = 5;
// A front-face interior tile (columns/rows 0..4, so index 2 is dead centre).
const CENTER = { x: 2, y: 2, z: 4, dirKey: 'PZ' };

describe('bombCap', () => {
  it('scales gently with board size', () => {
    expect(bombCap(2)).toBe(1);
    expect(bombCap(3)).toBe(1);
    expect(bombCap(4)).toBe(2);
    expect(bombCap(5)).toBe(3);
  });
});

describe('tileKeyOf', () => {
  it('formats x,y,z,dirKey', () => {
    expect(tileKeyOf(CENTER)).toBe('2,2,4,PZ');
  });
});

describe('computeBlastTiles', () => {
  it('covers the centre plus four arms up to the blast radius', () => {
    const { keys, center, arms } = computeBlastTiles({ tile: CENTER }, SIZE);
    expect(center).toBe(CENTER);
    expect(arms).toHaveLength(4);
    // From a face centre on a 5-cube every arm reaches its full radius.
    for (const arm of arms) expect(arm.length).toBe(BOMB_BLAST_RADIUS);
    // Centre is always in the footprint.
    expect(keys.has(tileKeyOf(CENTER))).toBe(true);
    // 1 centre + 4 arms × 3 = 13 unique cells (no wrap collisions from a centre tile).
    expect(keys.size).toBe(1 + 4 * BOMB_BLAST_RADIUS);
  });

  it('respects a custom radius', () => {
    const { keys } = computeBlastTiles({ tile: CENTER }, SIZE, 1);
    expect(keys.size).toBe(1 + 4 * 1);
  });
});

describe('disarm ring', () => {
  it('an interior tile has an eight-cell encirclement', () => {
    const ring = bombDisarmRing({ tile: CENTER }, SIZE);
    expect(ring.size).toBe(8);
  });

  it('is disarmed only when every ring cell is covered', () => {
    const ring = bombDisarmRing({ tile: CENTER }, SIZE);
    const full = new Set(ring);
    expect(isBombDisarmed({ tile: CENTER }, full, SIZE)).toBe(true);

    // Drop one ring cell → no longer disarmed.
    const partial = new Set(ring);
    partial.delete([...ring][0]);
    expect(isBombDisarmed({ tile: CENTER }, partial, SIZE)).toBe(false);

    expect(isBombDisarmed({ tile: CENTER }, new Set(), SIZE)).toBe(false);
  });
});

describe('checkBlastHitWorm', () => {
  const trail = ['0,0,0,PZ', '1,0,0,PZ', '2,0,0,PZ', '3,0,0,PZ'];

  it('kills when the grounded head is in the blast', () => {
    const worm = makeWorm({ buf: trail });
    const hit = checkBlastHitWorm(worm, new Set(['0,0,0,PZ']));
    expect(hit).toEqual({ type: 'death' });
  });

  it('cuts the tail at the first body segment in the blast', () => {
    const worm = makeWorm({ buf: trail });
    const hit = checkBlastHitWorm(worm, new Set(['2,0,0,PZ']));
    expect(hit).toEqual({ type: 'cut', cutTrailIdx: 2 });
  });

  it('a jumping head escapes death but the body can still be cut', () => {
    const worm = makeWorm({ buf: trail, jumping: true });
    expect(checkBlastHitWorm(worm, new Set(['0,0,0,PZ']))).toBeNull();
    expect(checkBlastHitWorm(worm, new Set(['1,0,0,PZ']))).toEqual({ type: 'cut', cutTrailIdx: 1 });
  });

  it('a landing-grace head also escapes death', () => {
    const worm = makeWorm({ buf: trail, grace: 0.2 });
    expect(checkBlastHitWorm(worm, new Set(['0,0,0,PZ']))).toBeNull();
  });

  it('a rocketing worm is immune', () => {
    const worm = makeWorm({ buf: trail, rocket: true });
    expect(checkBlastHitWorm(worm, new Set(['0,0,0,PZ']))).toBeNull();
  });

  it('misses cleanly when nothing overlaps', () => {
    const worm = makeWorm({ buf: trail });
    expect(checkBlastHitWorm(worm, new Set(['9,9,9,PZ']))).toBeNull();
  });
});
