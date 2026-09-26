import { describe, expect, it } from 'vitest';
import { ambienceLayout, ambienceRadius, cubePositionAt, AMBIENCE_QUALITY, AMBIENCE_STYLES } from '../3d/backgroundAmbience.js';
import { ambienceCubeGeometry } from '../3d/ambienceCubeMaterial.js';
import { COLOR_SCHEMES } from '../utils/colorSchemes.js';
import { Color } from 'three';
import { MAX_DISTANCE_BY_SIZE } from '../3d/cameraLimits.js';

const SIZES = Object.keys(MAX_DISTANCE_BY_SIZE).map(Number);
const length = v => Math.hypot(...v);

describe('background cube field', () => {
  it.each(SIZES)('keeps every cube beyond the farthest %i camera and apart throughout its drift', size => {
    const maxCamera = MAX_DISTANCE_BY_SIZE[size];
    for (const seed of [1, 42, 0x57a3]) {
      const layout = ambienceLayout(size, 'full', seed);
      for (const t of [0, 13, 97, 600, 3600]) {
        const points = layout.cubes.map(cube => cubePositionAt(cube, t));
        layout.cubes.forEach((cube, i) => {
          const bound = cube.scale * Math.sqrt(3) / 2;
          expect(length(points[i]) - bound).toBeGreaterThan(maxCamera);
          for (let j = 0; j < i; j++) {
            const separation = length(points[i].map((v, axis) => v - points[j][axis]));
            expect(separation).toBeGreaterThan(bound + layout.cubes[j].scale * Math.sqrt(3) / 2);
          }
        });
      }
      expect(ambienceRadius(size)).toBeGreaterThan(maxCamera);
      expect(layout).not.toHaveProperty('wormholes');
    }
  });

  it('assigns one style and palette to each cube with no duplicate combinations', () => {
    for (const seed of [1, 42, 500]) {
      const cubes = ambienceLayout(5, 'full', seed).cubes;
      expect(new Set(cubes.map(c => `${c.style}:${c.palette}`)).size).toBe(cubes.length);
      expect(new Set(cubes.map(c => c.style)).size).toBe(AMBIENCE_STYLES.length);
      expect(new Set(cubes.map(c => c.palette)).size).toBeGreaterThan(20);
      for (const cube of cubes) {
        expect(AMBIENCE_STYLES).toContain(cube.style);
        expect(COLOR_SCHEMES[cube.palette]).toBeTruthy();
      }
    }
  });

  it('randomizes between scenes but holds identities steady across quality changes', () => {
    const full = ambienceLayout(4, 'full', 42), reduced = ambienceLayout(4, 'reduced', 42);
    expect(full).toEqual(ambienceLayout(4, 'full', 42));
    expect(full).not.toEqual(ambienceLayout(4, 'full', 43));
    expect(reduced.cubes).toEqual(full.cubes.slice(0, AMBIENCE_QUALITY.reduced.cubes));
    expect(full.cubes).toHaveLength(AMBIENCE_QUALITY.full.cubes);
    for (const cube of full.cubes) expect(Math.abs(cube.speed) * 10).toBeLessThan(Math.PI * 2 / 10);
  });

  it('renders each cube with its own six palette colours and a single shared face style', () => {
    const cubes = ambienceLayout(3).cubes, geometry = ambienceCubeGeometry(cubes);
    try {
      cubes.forEach((cube, i) => {
        expect(geometry.getAttribute('cubeStyle').getX(i)).toBe(AMBIENCE_STYLES.indexOf(cube.style));
        [5, 2, 3, 6, 1, 4].forEach((face, index) => {
          const attr = geometry.getAttribute(`palette${index}`), expected = new Color(COLOR_SCHEMES[cube.palette][face]);
          expect(attr.getX(i)).toBeCloseTo(expected.r, 6);
          expect(attr.getY(i)).toBeCloseTo(expected.g, 6);
          expect(attr.getZ(i)).toBeCloseTo(expected.b, 6);
          expect(attr.isInstancedBufferAttribute).toBe(true);
        });
      });
    } finally { geometry.dispose(); }
  });
});
