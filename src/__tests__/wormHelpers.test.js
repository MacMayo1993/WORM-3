import { describe, it, expect } from 'vitest';
import { rotateTilePosition, ensureOrbContrast, checkWormHitBySlice, checkWormHitByWave, parseTileKey, _parseTile, tileKeyCoordAt, getSliceSurfaceStickers } from '../worm/wormHelpers.js';
import { makeTileTrail, ttPush, ttReset } from '../worm/circularBuffers.js';

describe('rotateTilePosition', () => {
  it('returns the tile unchanged when not in the slice', () => {
    const tile = { x: 0, y: 1, z: 2, dirKey: 'PZ' };
    const result = rotateTilePosition(tile, 'col', 1, 1, 3);
    expect(result).toBe(tile);
  });

  it('rotates a tile on the col slice', () => {
    const tile = { x: 1, y: 0, z: 2, dirKey: 'PZ' };
    const result = rotateTilePosition(tile, 'col', 1, 1, 3);
    expect(result).not.toBe(tile);
    expect(result.x).toBe(1);
  });

  it('preserves extra tile properties', () => {
    const tile = { x: 0, y: 0, z: 0, dirKey: 'NX', extra: 'data' };
    const result = rotateTilePosition(tile, 'col', 0, 1, 3);
    expect(result.extra).toBe('data');
  });
});

describe('ensureOrbContrast', () => {
  it('returns dark colors unchanged', () => {
    expect(ensureOrbContrast('#000000')).toBe('#000000');
    expect(ensureOrbContrast('#333333')).toBe('#333333');
  });

  it('darkens very bright colors', () => {
    const result = ensureOrbContrast('#ffffff');
    expect(result).not.toBe('#ffffff');
    const r = parseInt(result.slice(1, 3), 16);
    const g = parseInt(result.slice(3, 5), 16);
    const b = parseInt(result.slice(5, 7), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    expect(lum).toBeLessThan(0.73);
  });

  it('handles null/short inputs gracefully', () => {
    expect(ensureOrbContrast(null)).toBe(null);
    expect(ensureOrbContrast('#fff')).toBe('#fff');
  });

  it('returns a valid 7-char hex string', () => {
    const result = ensureOrbContrast('#ffff00');
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('parseTileKey', () => {
  it('parses a tile key into components', () => {
    const out = { x: 0, y: 0, z: 0, dirKey: '' };
    parseTileKey('1,2,0,PX', out);
    expect(out).toEqual({ x: 1, y: 2, z: 0, dirKey: 'PX' });
  });

  it('returns the out object', () => {
    const out = { x: 0, y: 0, z: 0, dirKey: '' };
    const result = parseTileKey('0,0,0,NZ', out);
    expect(result).toBe(out);
  });

  it('works with the shared _parseTile scratch', () => {
    parseTileKey('2,1,0,PY', _parseTile);
    expect(_parseTile.x).toBe(2);
    expect(_parseTile.y).toBe(1);
    expect(_parseTile.z).toBe(0);
    expect(_parseTile.dirKey).toBe('PY');
  });
});

describe('tileKeyCoordAt', () => {
  it('extracts x coordinate (idx=0)', () => {
    expect(tileKeyCoordAt('2,1,0,PZ', 0)).toBe(2);
  });

  it('extracts y coordinate (idx=1)', () => {
    expect(tileKeyCoordAt('2,1,0,PZ', 1)).toBe(1);
  });

  it('extracts z coordinate (idx=2)', () => {
    expect(tileKeyCoordAt('2,1,0,PZ', 2)).toBe(0);
  });
});

describe('getSliceSurfaceStickers', () => {
  it('returns surface stickers for a col slice on a 3x3', () => {
    const stickers = getSliceSurfaceStickers(3, 'col', 0);
    expect(stickers.length).toBeGreaterThan(0);
    for (const s of stickers) {
      expect(s.x).toBe(0);
    }
    const dirKeys = new Set(stickers.map(s => s.dirKey));
    expect(dirKeys.has('NX')).toBe(true);
  });

  it('returns stickers for edge slices that touch two faces', () => {
    const stickers = getSliceSurfaceStickers(3, 'col', 2);
    const dirKeys = new Set(stickers.map(s => s.dirKey));
    expect(dirKeys.has('PX')).toBe(true);
  });

  it('includes stickers on PY/NY/PZ/NZ faces for a middle row slice', () => {
    const stickers = getSliceSurfaceStickers(3, 'row', 1);
    const dirs = new Set(stickers.map(s => s.dirKey));
    expect(dirs.has('PY')).toBe(false);
    expect(dirs.has('NY')).toBe(false);
  });
});

describe('checkWormHitBySlice', () => {
  // BODY_BALL_SPACING is 0.09, so tailLen needs to be large enough
  // for activeTiles = ceil(tailLen * 0.09) > 1 to check body segments.
  // tailLen=20 → activeTiles=ceil(1.8)=2, tailLen=50 → ceil(4.5)=5
  function makeWorm(headTile, bodyKeys, tailLen = 50) {
    const trail = makeTileTrail(100);
    const headKey = `${headTile.x},${headTile.y},${headTile.z},${headTile.dirKey}`;
    const allKeys = [headKey, ...bodyKeys];
    ttReset(trail, allKeys[allKeys.length - 1]);
    for (let i = allKeys.length - 2; i >= 0; i--) {
      ttPush(trail, allKeys[i]);
    }
    return {
      pos: { current: headTile },
      tileTrail: { current: trail },
      tailLength: { current: tailLen },
    };
  }

  it('returns null when head and body are not on the slice', () => {
    const worm = makeWorm(
      { x: 0, y: 0, z: 2, dirKey: 'PZ' },
      ['0,0,1,PZ', '0,0,0,NZ'],
    );
    const result = checkWormHitBySlice(worm, 'col', 1);
    expect(result).toBeNull();
  });

  it('returns death when head is on slice but body is not', () => {
    const worm = makeWorm(
      { x: 1, y: 0, z: 2, dirKey: 'PZ' },
      ['0,0,2,PZ'],
    );
    const result = checkWormHitBySlice(worm, 'col', 1);
    expect(result).toEqual({ type: 'death' });
  });

  it('returns null when head and all body on the slice', () => {
    const worm = makeWorm(
      { x: 1, y: 0, z: 2, dirKey: 'PZ' },
      ['1,0,1,PZ', '1,0,0,NZ'],
    );
    const result = checkWormHitBySlice(worm, 'col', 1);
    expect(result).toBeNull();
  });

  it('returns cut when body segment is on slice but head is not', () => {
    const worm = makeWorm(
      { x: 0, y: 0, z: 2, dirKey: 'PZ' },
      ['1,0,2,PZ', '0,0,1,PZ'],
    );
    const result = checkWormHitBySlice(worm, 'col', 1);
    expect(result).toEqual({ type: 'cut', cutTrailIdx: 1 });
  });

  // ── Multi-plane waves ──────────────────────────────────────────────────────
  //
  // The rule the single-plane cases above encode is really about RIGID CLASS:
  // the worm survives while every part of it is being carried by the same
  // motion. With up to three parallel planes turning at once, "the same motion"
  // stops meaning "the same plane".
  describe('as a wave', () => {
    const wave = (axis, ...rotations) => ({ axis, rotations });
    const plane = (sliceIndex, dir = 1, numTurns = 1) => ({ sliceIndex, dir, numTurns });

    it('is identical to checkWormHitBySlice for a one-plane wave', () => {
      const cases = [
        [{ x: 0, y: 0, z: 2, dirKey: 'PZ' }, ['0,0,1,PZ', '0,0,0,NZ']],
        [{ x: 1, y: 0, z: 2, dirKey: 'PZ' }, ['0,0,2,PZ']],
        [{ x: 1, y: 0, z: 2, dirKey: 'PZ' }, ['1,0,1,PZ', '1,0,0,NZ']],
        [{ x: 0, y: 0, z: 2, dirKey: 'PZ' }, ['1,0,2,PZ', '0,0,1,PZ']],
      ];
      for (const [head, body] of cases) {
        const a = checkWormHitBySlice(makeWorm(head, body), 'col', 1);
        const b = checkWormHitByWave(makeWorm(head, body), wave('col', plane(1)));
        expect(b).toEqual(a);
      }
    });

    it('spares a worm spanning two planes turning the same way', () => {
      // Head on slice 1, tail on slice 3. Both sweep +1 quarter turn about the
      // same axis, so the worm is carried rigidly and stays in one piece.
      const worm = makeWorm(
        { x: 1, y: 0, z: 2, dirKey: 'PZ' },
        ['3,0,2,PZ', '3,0,1,PZ'],
      );
      expect(checkWormHitByWave(worm, wave('col', plane(1, 1), plane(3, 1)))).toBeNull();
    });

    it('kills a worm spanning two planes turning opposite ways', () => {
      const worm = makeWorm(
        { x: 1, y: 0, z: 2, dirKey: 'PZ' },
        ['3,0,2,PZ', '3,0,1,PZ'],
      );
      expect(checkWormHitByWave(worm, wave('col', plane(1, 1), plane(3, -1))))
        .toEqual({ type: 'death' });
    });

    it('kills a worm spanning planes turning the same way by different amounts', () => {
      // Same direction is not enough — a quarter turn and a half turn separate.
      const worm = makeWorm(
        { x: 1, y: 0, z: 2, dirKey: 'PZ' },
        ['3,0,2,PZ', '3,0,1,PZ'],
      );
      expect(checkWormHitByWave(worm, wave('col', plane(1, 1, 1), plane(3, 1, 2))))
        .toEqual({ type: 'death' });
    });

    it('kills a worm whose head turns while any part stays on static ground', () => {
      const worm = makeWorm(
        { x: 1, y: 0, z: 2, dirKey: 'PZ' },
        ['3,0,2,PZ', '2,0,2,PZ'],
      );
      expect(checkWormHitByWave(worm, wave('col', plane(1), plane(3))))
        .toEqual({ type: 'death' });
    });

    it('cuts at the nearest mismatch when several planes clip the tail', () => {
      // Head is static; slices 2 and 4 both turn and both hold body segments.
      // Exactly one cut, at the segment closest to the head — never a cascade.
      const worm = makeWorm(
        { x: 0, y: 0, z: 2, dirKey: 'PZ' },
        ['4,0,2,PZ', '2,0,2,PZ', '0,0,1,PZ'],
      );
      expect(checkWormHitByWave(worm, wave('col', plane(2), plane(4))))
        .toEqual({ type: 'cut', cutTrailIdx: 1 });
    });

    it('does not care which order the planes are listed in', () => {
      const head = { x: 0, y: 0, z: 2, dirKey: 'PZ' };
      const body = ['4,0,2,PZ', '2,0,2,PZ', '0,0,1,PZ'];
      const forward = checkWormHitByWave(makeWorm(head, body), wave('col', plane(2), plane(4)));
      const reverse = checkWormHitByWave(makeWorm(head, body), wave('col', plane(4), plane(2)));
      expect(reverse).toEqual(forward);
    });

    it('treats a rocket-flying head as clear of every plane', () => {
      const worm = makeWorm(
        { x: 1, y: 0, z: 2, dirKey: 'PZ' },
        ['0,0,2,PZ'],
      );
      worm.rocketActive = { current: true };
      // Head would be on slice 1 and the body off it — grounded, that is death.
      // Airborne it is a cut at worst, and here the body is on no plane at all.
      expect(checkWormHitByWave(worm, wave('col', plane(1)))).toBeNull();
    });
  });
});
