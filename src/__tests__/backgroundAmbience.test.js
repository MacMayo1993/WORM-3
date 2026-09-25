import { describe, expect, it } from 'vitest';
import { ambienceLayout, ambienceRadius, cubePositionAt, TWIN_FACE_PAIRS, AMBIENCE_QUALITY } from '../3d/backgroundAmbience.js';
import { MAX_DISTANCE_BY_SIZE } from '../3d/cameraLimits.js';

const SIZES = Object.keys(MAX_DISTANCE_BY_SIZE).map(Number);
const length = v => Math.hypot(...v);

describe('background ambience layout', () => {
  it.each(SIZES)('keeps every cube and portal beyond the farthest %i×%i camera', size => {
    const maxCamera = MAX_DISTANCE_BY_SIZE[size];
    const layout = ambienceLayout(size);
    for (const cube of layout.cubes) {
      for (const t of [0, 13, 97, 600]) {
        // Nearest point of the tumbling cube (half its diagonal) still clears the camera.
        expect(length(cubePositionAt(cube, t)) - cube.scale * Math.sqrt(3) / 2).toBeGreaterThan(maxCamera);
      }
    }
    for (const portal of layout.wormholes) expect(length(portal.position) - portal.ring * 1.1).toBeGreaterThan(maxCamera);
    expect(ambienceRadius(size)).toBeGreaterThan(maxCamera);
  });

  it('places wormholes in antipodal twin pairs with twin colours', () => {
    const { wormholes } = ambienceLayout(5);
    for (let i = 0; i < wormholes.length; i += 2) {
      const [a, b] = [wormholes[i], wormholes[i + 1]];
      a.position.forEach((x, k) => expect(b.position[k]).toBeCloseTo(-x, 9));
      expect(TWIN_FACE_PAIRS.some(([p, q]) => (p === a.face && q === b.face) || (q === a.face && p === b.face))).toBe(true);
      expect([a.twin, b.twin]).toEqual([b.face, a.face]);
    }
  });

  it('is deterministic and scales down in the reduced-effects tier', () => {
    expect(ambienceLayout(4)).toEqual(ambienceLayout(4));
    expect(ambienceLayout(4, 'reduced').cubes).toHaveLength(AMBIENCE_QUALITY.reduced.cubes);
    expect(ambienceLayout(4, 'reduced').wormholes).toHaveLength(AMBIENCE_QUALITY.reduced.wormholePairs * 2);
    expect(ambienceLayout(4).cubes).toHaveLength(AMBIENCE_QUALITY.full.cubes);
  });

  it('drifts slowly: under a tenth of a turn per ten seconds', () => {
    for (const cube of ambienceLayout(3).cubes) expect(Math.abs(cube.speed) * 10).toBeLessThan(Math.PI * 2 / 10);
  });
});
