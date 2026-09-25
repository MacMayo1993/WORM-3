import { describe, it, expect } from 'vitest';
import { TILES, PAIRS } from '../components/intro/introTopology.js';
import { INTRO_STICKERS } from '../components/intro/introStickers.js';
import { INTRO_END } from '../components/intro/introChoreography.js';
import { FULL_FLIP_START, FULL_FLIP_END, IMPLODE_START, IMPLODE_END, WORM_START, DISSOLVE_START, DISSOLVE_END } from '../components/intro/introTiming.js';
import {
  introDrop, introSquash, LAND_TIME, DROP_HEIGHT, stickerWave, stickerFlip, tunnelGrowth,
  introConfetti, introShockwaves, introFloorY, introColor, introLayerTurn, introFleck, FLECK_LIFE
} from '../components/intro/introMotion.js';

const STEP = 1 / 240;

describe('drop and squash', () => {
  it('falls from above the frame, lands, bounces once and rests', () => {
    expect(introDrop(0)).toBe(DROP_HEIGHT);
    expect(introDrop(LAND_TIME)).toBeCloseTo(0, 10);
    expect(Math.max(...Array.from({ length: 100 }, (_, i) => introDrop(LAND_TIME + i * 0.004)))).toBeLessThan(0.5);
    for (let t = 1; t < INTRO_END; t += 0.1) expect(introDrop(t)).toBe(0);
  });
  it('moves continuously apart from the landing contact, and settles before the title', () => {
    for (let t = STEP; t < INTRO_END; t += STEP) {
      expect(Math.abs(introDrop(t) - introDrop(t - STEP))).toBeLessThan(0.08); // free fall, never a teleport
      // The one allowed discontinuity is the stretch-to-squash snap on contact.
      if (Math.abs(t - LAND_TIME) > STEP * 1.5) expect(Math.abs(introSquash(t) - introSquash(t - STEP))).toBeLessThan(0.03);
    }
    for (let t = 0; t < INTRO_END; t += 0.01) expect(Math.abs(introSquash(t))).toBeLessThan(0.25);
    expect(Math.abs(introSquash(INTRO_END))).toBeLessThan(0.01);
  });
  it('holds still for reduced motion', () => {
    for (let t = 0; t < INTRO_END; t += 0.1) { expect(introDrop(t, true)).toBe(0); expect(introSquash(t, true)).toBe(0); }
  });
});

describe('top-layer twist', () => {
  it('is thrown a quarter turn off solved and clacks home as the cube lands', () => {
    expect(introLayerTurn(0)).toBeCloseTo(-Math.PI / 2, 10);
    expect(introLayerTurn(LAND_TIME)).toBe(0);
    let recoil = 0;
    for (let t = LAND_TIME; t < LAND_TIME + 0.4; t += STEP) recoil = Math.max(recoil, Math.abs(introLayerTurn(t)));
    expect(recoil).toBeGreaterThan(0.02); // the clack is visible…
    expect(recoil).toBeLessThan(0.1); //  …but never looks like a second move
  });
  it('turns continuously and is exactly solved before the flip wave, so tunnels see a solved cube', () => {
    for (let t = STEP; t < INTRO_END; t += STEP) expect(Math.abs(introLayerTurn(t) - introLayerTurn(t - STEP))).toBeLessThan(0.05);
    for (let t = LAND_TIME + 0.36; t <= INTRO_END; t += 0.05) expect(introLayerTurn(t)).toBe(0);
    expect(LAND_TIME + 0.36).toBeLessThan(FULL_FLIP_START);
  });
  it('holds still for reduced motion', () => {
    for (let t = 0; t <= INTRO_END; t += 0.1) expect(introLayerTurn(t, true)).toBe(0);
  });
});

describe('sticker flip wave', () => {
  it('flips every sticker to its antipodal colour inside the flip beat and back as the cube shuts', () => {
    const [original, flipped] = INTRO_STICKERS;
    TILES.forEach((tile, i) => {
      expect(stickerFlip(tile, FULL_FLIP_START - 0.001).flipped).toBe(false);
      expect(stickerFlip(tile, FULL_FLIP_END).flipped).toBe(true);
      expect(stickerFlip(tile, IMPLODE_START).flipped).toBe(true);
      expect(stickerFlip(tile, IMPLODE_END).flipped).toBe(false);
      expect(stickerFlip(tile, INTRO_END).angle).toBeCloseTo(2 * Math.PI);
      // The colour it shows is the gameplay flip's, not a guess.
      expect(introColor(flipped[i].curr)).not.toBe(introColor(original[i].curr));
    });
  });
  it('turns the colour edge-on and pops the sticker clear of the cubie while it turns', () => {
    const tile = TILES[20];
    for (let t = FULL_FLIP_START; t < FULL_FLIP_END; t += 0.005) {
      const s = stickerFlip(tile, t);
      if (s.angle > 0.05 && s.angle < Math.PI - 0.05) expect(s.lift).toBeGreaterThan(0);
      expect(s.flipped).toBe(s.angle >= Math.PI / 2);
    }
  });
  it('travels as a wave, top first, and stays still for reduced motion', () => {
    const top = TILES.find(t => t.face.axis === 1 && t.face.sign === 1 && t.position[0] === -1);
    const bottom = TILES.find(t => t.face.axis === 1 && t.face.sign === -1 && t.position[0] === 1);
    expect(stickerWave(top)).toBeLessThan(stickerWave(bottom));
    for (const tile of TILES) expect(stickerWave(tile)).toBeGreaterThanOrEqual(0);
    for (let t = 0; t < INTRO_END; t += 0.2) expect(stickerFlip(TILES[3], t, true)).toEqual({ angle: 0, flipped: false, lift: 0 });
  });
});

describe('tunnels, confetti and shockwaves', () => {
  it('finishes every tunnel before its worm sets off', () => {
    PAIRS.forEach((_, i) => expect(tunnelGrowth(i, WORM_START + i * 0.012)).toBe(1));
    expect(tunnelGrowth(0, 2.1)).toBe(0);
    expect(tunnelGrowth(5, 3, true)).toBe(0);
  });
  it('throws bounded confetti only around the two bursts, and none for reduced motion', () => {
    let seen = 0;
    for (let i = 0; i < 64; i++) for (let t = 0; t <= INTRO_END; t += 0.05) {
      expect(introConfetti(i, t, true)).toBeNull();
      const piece = introConfetti(i, t);
      if (!piece) continue;
      seen++;
      expect(piece.position.every(Number.isFinite)).toBe(true);
      expect(Math.hypot(...piece.position)).toBeLessThan(14);
      expect(piece.scale).toBeGreaterThanOrEqual(0);
      expect(piece.scale).toBeLessThanOrEqual(0.16);
    }
    expect(seen).toBeGreaterThan(0);
    for (let i = 0; i < 64; i++) expect(introConfetti(i, INTRO_END)).toBeNull();
  });
  it('sheds bounded flecks only while the cube dissolves, top first, and none for reduced motion', () => {
    const born = [];
    for (let i = 0; i < 54; i++) {
      let first = null;
      for (let t = 0; t <= INTRO_END; t += 0.02) {
        expect(introFleck(i, t, true)).toBeNull();
        const fleck = introFleck(i, t);
        if (!fleck) continue;
        first ??= { t, y: fleck.position[1] };
        expect(t).toBeGreaterThan(DISSOLVE_START);
        expect(t).toBeLessThan(DISSOLVE_END + FLECK_LIFE);
        expect(fleck.position.every(Number.isFinite)).toBe(true);
        expect(Math.hypot(...fleck.position)).toBeLessThan(6);
        expect(fleck.scale).toBeGreaterThanOrEqual(0);
        expect(fleck.scale).toBeLessThanOrEqual(0.1);
      }
      expect(first, `fleck ${i} never appears`).not.toBeNull();
      born.push(first);
      expect(introFleck(i, INTRO_END)).toBeNull();
    }
    // Top first: the upper half of the cube starts shedding sooner, on average.
    const mean = list => list.reduce((sum, b) => sum + b.t, 0) / list.length;
    expect(mean(born.filter(b => b.y > 0.5))).toBeLessThan(mean(born.filter(b => b.y < -0.5)));
  });
  it('spreads each shockwave once and clears them all', () => {
    for (let t = 0; t <= INTRO_END; t += 0.05) for (const wave of introShockwaves(t)) {
      expect(wave.opacity).toBeGreaterThanOrEqual(0);
      expect(wave.opacity).toBeLessThanOrEqual(0.55);
    }
    expect(introShockwaves(INTRO_END).every(w => w.opacity === 0)).toBe(true);
    expect(introShockwaves(2, true).every(w => w.opacity === 0)).toBe(true);
    expect(introFloorY(2.5)).toBeLessThan(introFloorY(1));
  });
});
