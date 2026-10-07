import { describe, it, expect } from 'vitest';
import { mapNodePositions, mapTrailSegments, chapterWorldColor, stageCode } from '../worm/story/levelMapLayout.js';
import { RUBIKS_CLASSIC } from '../utils/constants.js';

describe('chapter map layout', () => {
  const points = mapNodePositions(10);

  it('snakes ten stages across two rows, inside the map', () => {
    expect(points).toHaveLength(10);
    for (const p of points) {
      expect(p.x).toBeGreaterThan(0.05); expect(p.x).toBeLessThan(0.95);
      expect(p.y).toBeGreaterThan(0.25); expect(p.y).toBeLessThan(0.9);
    }
    // First row runs left to right, second row comes back.
    expect(points.slice(0, 5).map(p => p.x)).toEqual([...points.slice(0, 5).map(p => p.x)].sort((a, b) => a - b));
    expect(points.slice(5).map(p => p.x)).toEqual([...points.slice(5).map(p => p.x)].sort((a, b) => b - a));
    // The row turn drops straight down at the edge; the finale ends under the start.
    expect(points[5].x).toBe(points[4].x);
    expect(points[9].x).toBe(points[0].x);
    expect(Math.min(...points.slice(5).map(p => p.y))).toBeGreaterThan(Math.max(...points.slice(0, 5).map(p => p.y)));
  });

  it('draws one curve per gap, pinned to the stages it joins', () => {
    const segments = mapTrailSegments(points, 600, 400);
    expect(segments).toHaveLength(9);
    segments.forEach((d, i) => {
      const nums = d.match(/-?[\d.]+/g).map(Number);
      expect(nums[0]).toBeCloseTo(points[i].x * 600, 0); expect(nums[1]).toBeCloseTo(points[i].y * 400, 0);
      expect(nums.at(-2)).toBeCloseTo(points[i + 1].x * 600, 0); expect(nums.at(-1)).toBeCloseTo(points[i + 1].y * 400, 0);
    });
    // The turn bows outward past the right-hand column rather than doubling back.
    const turn = segments[4].match(/-?[\d.]+/g).map(Number);
    expect(turn[2]).toBeGreaterThan(points[4].x * 600);
  });

  it('lights chapters in the cube\'s face colours and numbers stages like a platformer', () => {
    expect(chapterWorldColor(1).color).toBe(RUBIKS_CLASSIC.green);
    expect(chapterWorldColor(6).color).toBe(chapterWorldColor(1).color);
    for (let id = 1; id <= 12; id++) expect(chapterWorldColor(id).color).not.toBe(RUBIKS_CLASSIC.white);
    expect(stageCode(2, 4)).toBe('2-4');
  });
});
