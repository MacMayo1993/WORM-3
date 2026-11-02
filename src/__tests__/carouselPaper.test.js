import { describe, it, expect } from 'vitest';
import { Color } from 'three';
import {
  carouselPaperLayoutInto, doodlesFor, revealStrokes, strokesLength, paintDoodles, paperTintInto, PADLOCK_STAMP, PALE_MODE_GLOW,
} from '../components/menus/carouselPaper.js';
import { CAROUSEL_MOOD_FACES } from '../components/menus/carouselWormMood.js';
import {
  setCarouselTheme, getCarouselTheme, setCarouselCubeFrame, clearCarouselCubeFrame, getCarouselCubeFrame,
} from '../components/menus/menuCarouselState.js';

const ROWS = 26;

describe('the carousel paper layout', () => {
  it('flanks the cube with its doodles on a wide screen', () => {
    const cube = { x: 0.8, y: 0.55, r: 0.2 };
    const out = carouselPaperLayoutInto({}, cube, 1.6, ROWS);
    expect(out.left.x).toBeLessThan(cube.x - cube.r);
    expect(out.right.x).toBeGreaterThan(cube.x + cube.r);
    expect(out.left.y).toBeGreaterThan(out.right.y);
    expect(out.size).toBeGreaterThan(0);
  });

  it('tucks them by the corners on a phone, clear of the header and footer', () => {
    const cube = { x: 0.23, y: 0.55, r: 0.2 };
    const out = carouselPaperLayoutInto({}, cube, 0.46, ROWS);
    expect(Math.abs(out.left.x - cube.x)).toBeLessThan(cube.r);
    expect(out.left.y).toBeGreaterThan(cube.y + cube.r);
    expect(out.right.y).toBeLessThan(cube.y - cube.r);
  });

  it('walks the doodle worm on a grid line behind the cube\'s lower half', () => {
    const cube = { x: 0.8, y: 0.55, r: 0.2 };
    const { wormRow } = carouselPaperLayoutInto({}, cube, 1.6, ROWS);
    expect(Number.isInteger(wormRow)).toBe(true);
    expect(wormRow / ROWS).toBeLessThan(cube.y);
    expect(wormRow / ROWS).toBeGreaterThan(cube.y - cube.r);
  });

  it('reuses the objects it is given', () => {
    const out = {};
    carouselPaperLayoutInto(out, { x: 0.5, y: 0.5, r: 0.2 }, 1, ROWS);
    const left = out.left;
    carouselPaperLayoutInto(out, { x: 0.6, y: 0.5, r: 0.2 }, 1, ROWS);
    expect(out.left).toBe(left);
  });
});

describe('the margin doodles', () => {
  it('gives every mode face two doodles of its own, inside their slots', () => {
    const seen = new Set();
    for (const face of CAROUSEL_MOOD_FACES) {
      const [left, right] = doodlesFor(face);
      expect(left.length).toBeGreaterThan(0);
      expect(right.length).toBeGreaterThan(0);
      for (const point of [...left, ...right].flat()) {
        expect(point[0]).toBeGreaterThanOrEqual(0.05);
        expect(point[0]).toBeLessThanOrEqual(0.95);
        expect(point[1]).toBeGreaterThanOrEqual(0.05);
        expect(point[1]).toBeLessThanOrEqual(0.95);
      }
      seen.add(JSON.stringify(left));
    }
    expect(seen.size).toBe(CAROUSEL_MOOD_FACES.length);
    expect(doodlesFor('nowhere')).toEqual([[], []]);
  });

  it('inks a doodle in, in stroke order, as far as the pen has got', () => {
    const [left] = doodlesFor('NX');
    const total = strokesLength(left);
    expect(revealStrokes(left, 0)).toEqual([]);
    expect(revealStrokes(left, 1)).toBe(left);
    const half = revealStrokes(left, 0.5);
    expect(strokesLength(half)).toBeCloseTo(total / 2, 6);
    // Drawn in order: the half that is there starts with the first stroke.
    expect(half[0][0]).toEqual(left[0][0]);
  });

  it('paints the doodles in ink, and a locked mode\'s padlock stamp in red', () => {
    const calls = [];
    const ctx = new Proxy({}, {
      get: (target, key) => (key in target ? target[key] : (...args) => calls.push([key, ...args])),
      set: (target, key, value) => { target[key] = value; if (key === 'strokeStyle') calls.push(['style', value]); return true; },
    });
    paintDoodles(ctx, 512, 256, 'PY', 1, false);
    const styles = calls.filter(c => c[0] === 'style').map(c => c[1]);
    expect(styles.every(style => style !== '#c0392b')).toBe(true);
    const strokes = calls.filter(c => c[0] === 'stroke').length;
    expect(strokes).toBe(doodlesFor('PY')[0].length + doodlesFor('PY')[1].length);
    calls.length = 0;
    paintDoodles(ctx, 512, 256, 'PY', 1, true);
    expect(calls.filter(c => c[0] === 'style').map(c => c[1])).toContain('#c0392b');
    expect(calls.filter(c => c[0] === 'stroke').length).toBe(doodlesFor('PY')[0].length + PADLOCK_STAMP.length);
    // Every paint starts from a clean sheet.
    expect(calls[0][0]).toBe('clearRect');
  });
});

describe('the paper\'s glow colour', () => {
  it('keeps a mode\'s colour as the raw values the paper writes', () => {
    const out = paperTintInto(new Color(), '#ff8000');
    expect(out.r).toBeCloseTo(1, 6);
    expect(out.g).toBeCloseTo(128 / 255, 6);
    expect(out.b).toBeCloseTo(0, 6);
  });

  it('glows warm gold for a pale mode (the Store\'s white face)', () => {
    const gold = new Color().setStyle(PALE_MODE_GLOW, 'srgb-linear');
    expect(paperTintInto(new Color(), '#f8f8f4').equals(gold)).toBe(true);
  });
});

describe('the carousel state the paper reads', () => {
  it('carries the presented mode and the cube\'s place', () => {
    setCarouselTheme({ face: 'NZ', color: '#ff8000', locked: true });
    expect(getCarouselTheme()).toEqual({ face: 'NZ', color: '#ff8000', locked: true });
    setCarouselTheme(null);
    expect(getCarouselTheme()).toBeNull();
    setCarouselCubeFrame(1, 2, 3, 4);
    expect(getCarouselCubeFrame()).toMatchObject({ x: 1, y: 2, z: 3, radius: 4, live: true });
    clearCarouselCubeFrame();
    expect(getCarouselCubeFrame().live).toBe(false);
  });
});

