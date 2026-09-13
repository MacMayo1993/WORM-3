import { describe, it, expect } from 'vitest';
import { previewPathPoint, PREVIEW_PATH_LENGTH, PREVIEW_CRAWL_SPEED, nextPreviewFrame } from '../3d/wormPreviewMotion.js';

describe('character preview roaming', () => {
  it('closes smoothly and keeps the whole trail on the tiled stage', () => {
    const first = previewPathPoint(0, {});
    expect(previewPathPoint(PREVIEW_PATH_LENGTH, {})).toEqual(first);
    for (let d = -2; d < 4; d += 0.007) {
      const p = previewPathPoint(d, {}, 0.033);
      expect(Math.abs(p.x + 0.30) + 0.10).toBeLessThan(0.54);
      expect(Math.abs(p.z) + 0.10).toBeLessThan(0.33);
    }
  });
  it('advances at steady speed through tight and broad turns', () => {
    for (let d = 0; d < PREVIEW_PATH_LENGTH; d += 0.02) {
      const a = previewPathPoint(d, {});
      const b = previewPathPoint(d + PREVIEW_CRAWL_SPEED / 60, {});
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeCloseTo(PREVIEW_CRAWL_SPEED / 60, 4);
    }
  });
  it('starts facing the viewer and samples trailing segments behind the head', () => {
    const head = previewPathPoint(0, {});
    const ahead = previewPathPoint(0.002, {});
    const tail = previewPathPoint(-0.72, {});
    expect(ahead.z).toBeGreaterThan(head.z);
    expect(Math.hypot(tail.x - head.x, tail.z - head.z)).toBeGreaterThan(0.4);
  });
});

describe('preview frame cadence', () => {
  it('preserves deadlines on late frames instead of accumulating drift', () => {
    expect(nextPreviewFrame(0.05, 0.066, 0.05)).toBeCloseTo(0.10);
    expect(nextPreviewFrame(0.10, 0.116, 0.05)).toBeCloseTo(0.15);
  });
  it('skips missed frames without a catch-up burst', () => {
    expect(nextPreviewFrame(0.05, 3.02, 0.05)).toBeCloseTo(3.05);
  });
});
