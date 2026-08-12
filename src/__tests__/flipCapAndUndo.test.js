// Regression tests for the flip-cap / undo / dead-tile defects found in the
// 2026-08-12 review. Each of these passed silently before the fix because the
// whole flip call path sat outside the coverage report.
import { describe, it, expect } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import {
  buildManifoldGridMap,
  flipStickerPair,
  unflipStickerPair,
  canFlipStickerPair,
  canUnflipStickerPair,
  findAntipodalStickerByGrid
} from '../game/manifoldLogic.js';
import { FLIP_CAP, getHalfLifeMultiplier } from '../utils/constants.js';
import { selectEffectiveFlipCap } from '../hooks/useGameStore.js';

const SIZE = 3;
const TILE = { x: 1, y: 1, z: 2, dir: 'PZ' };

const mapFor = (c) => buildManifoldGridMap(c, SIZE);
const flip = (c, cap) => flipStickerPair(c, SIZE, TILE.x, TILE.y, TILE.z, TILE.dir, mapFor(c), cap);
const unflip = (c) => unflipStickerPair(c, SIZE, TILE.x, TILE.y, TILE.z, TILE.dir, mapFor(c));
const st = (c) => c[TILE.x][TILE.y][TILE.z].stickers[TILE.dir];
const partnerOf = (c) => {
  const loc = findAntipodalStickerByGrid(mapFor(c), st(c), SIZE);
  return c[loc.x][loc.y][loc.z].stickers[loc.dirKey];
};
const flipN = (c, n, cap) => {
  for (let i = 0; i < n; i++) c = flip(c, cap);
  return c;
};

describe('flipStickerPair honours the cap it is given', () => {
  it('defaults to the standard-play constant when no cap is passed', () => {
    const out = flipN(makeCubies(SIZE), 12);
    expect(st(out).flips).toBe(FLIP_CAP);
  });

  it('lets a Disparity session spend the full configured life (cap 8)', () => {
    // Before the fix this stopped at 6 while the health bar read 8, so a visibly
    // alive tile refused the player's tap.
    const out = flipN(makeCubies(SIZE), 12, 8);
    expect(st(out).flips).toBe(8);
    expect(partnerOf(out).flips).toBe(8);
  });

  it('kills a Fragile-tier tile at its own threshold (cap 3)', () => {
    // Before the fix the player could push a cap-3 tile all the way to 6,
    // straight past the death threshold the tier exists to enforce.
    const out = flipN(makeCubies(SIZE), 12, 3);
    expect(st(out).flips).toBe(3);
  });

  it.each([3, 8, 13, 20])('reaches exactly the wizard preset cap of %i', (cap) => {
    const out = flipN(makeCubies(SIZE), cap + 5, cap);
    expect(st(out).flips).toBe(cap);
    expect(canFlipStickerPair(out, SIZE, TILE.x, TILE.y, TILE.z, TILE.dir, mapFor(out), cap)).toBe(false);
  });
});

describe('canFlipStickerPair gates the tap before any move is charged', () => {
  it('is true on a fresh tile and false once the pair is spent', () => {
    let c = makeCubies(SIZE);
    expect(canFlipStickerPair(c, SIZE, TILE.x, TILE.y, TILE.z, TILE.dir, mapFor(c), 3)).toBe(true);
    c = flipN(c, 3, 3);
    expect(canFlipStickerPair(c, SIZE, TILE.x, TILE.y, TILE.z, TILE.dir, mapFor(c), 3)).toBe(false);
  });

  it('refuses when only the PARTNER is spent, keeping the pair atomic', () => {
    // A one-sided flip would leave the β-pair permanently asymmetric, breaking
    // the ∆ = 0 invariant antipodalEngine documents for ordinary play.
    let c = flipN(makeCubies(SIZE), 3, 3);          // both members now at 3
    const partnerLoc = findAntipodalStickerByGrid(mapFor(c), st(c), SIZE);
    // Heal only our side back to 0, leaving the partner capped.
    const cubie = c[TILE.x][TILE.y][TILE.z];
    c[TILE.x][TILE.y][TILE.z] = {
      ...cubie,
      stickers: { ...cubie.stickers, [TILE.dir]: { ...cubie.stickers[TILE.dir], flips: 0 } }
    };
    expect(c[partnerLoc.x][partnerLoc.y][partnerLoc.z].stickers[partnerLoc.dirKey].flips).toBe(3);
    expect(canFlipStickerPair(c, SIZE, TILE.x, TILE.y, TILE.z, TILE.dir, mapFor(c), 3)).toBe(false);

    const after = flip(c, 3);
    expect(st(after).flips).toBe(0);               // neither side moved
    expect(st(after).curr).toBe(st(c).curr);
  });
});

describe('undo is a true inverse, not a repeated flip', () => {
  it('gives back the flip it spent on both members of the pair', () => {
    const start = makeCubies(SIZE);
    const startCurr = st(start).curr;

    const flipped = flip(start);
    expect(st(flipped).flips).toBe(1);
    expect(st(flipped).curr).not.toBe(startCurr);

    const undone = unflip(flipped);
    expect(st(undone).curr).toBe(startCurr);
    expect(st(undone).flips).toBe(0);        // was 2 before the fix
    expect(partnerOf(undone).flips).toBe(0); // the partner was charged too
  });

  it('leaves no trace after a flip/undo cycle repeated to the old cap', () => {
    // Six flip+undo cycles used to burn the tile out completely (2 flips each).
    let c = makeCubies(SIZE);
    const startCurr = st(c).curr;
    for (let i = 0; i < FLIP_CAP; i++) c = unflip(flip(c));
    expect(st(c).flips).toBe(0);
    expect(st(c).curr).toBe(startCurr);
  });

  it('refuses to invent a flip on a pair that has none', () => {
    const c = makeCubies(SIZE);
    expect(canUnflipStickerPair(c, SIZE, TILE.x, TILE.y, TILE.z, TILE.dir, mapFor(c))).toBe(false);
    const out = unflip(c);
    expect(st(out).flips).toBe(0);
    expect(st(out).curr).toBe(st(c).curr);
  });

  it('unwinds a capped tile one flip at a time instead of no-opping', () => {
    // The old undo called flipStickerPair, which returned early at the cap — so
    // the board never changed while the caller still decremented the counter.
    let c = flipN(makeCubies(SIZE), 3, 3);
    expect(st(c).flips).toBe(3);
    expect(canUnflipStickerPair(c, SIZE, TILE.x, TILE.y, TILE.z, TILE.dir, mapFor(c))).toBe(true);
    c = unflip(c);
    expect(st(c).flips).toBe(2);
  });
});

describe('selectEffectiveFlipCap', () => {
  it('uses the standard constant outside chaos', () => {
    expect(selectEffectiveFlipCap({ chaosLevel: 0, disparityFlipCap: 13 })).toBe(FLIP_CAP);
  });

  it('uses the configured cap once a Disparity session is running', () => {
    expect(selectEffectiveFlipCap({ chaosLevel: 3, disparityFlipCap: 13 })).toBe(13);
  });
});

describe('getHalfLifeMultiplier scales with the cap in force', () => {
  it('keeps its documented standard-play ladder', () => {
    expect(getHalfLifeMultiplier(0)).toBe(1);
    expect(getHalfLifeMultiplier(3)).toBe(2);
    expect(getHalfLifeMultiplier(5)).toBe(4);
    expect(getHalfLifeMultiplier(FLIP_CAP)).toBe(0);
  });

  it('treats a tile as dead at the session cap, not the constant', () => {
    expect(getHalfLifeMultiplier(3, 3)).toBe(0);
    expect(getHalfLifeMultiplier(7, 13)).not.toBe(0);
    expect(getHalfLifeMultiplier(13, 13)).toBe(0);
  });
});
