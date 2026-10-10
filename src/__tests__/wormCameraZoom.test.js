import { describe, expect, it } from 'vitest';
import { WORM_CAMERA_ZOOM, clampWormCameraZoom, wheelCameraZoom, wormCameraZoomLabel, desktopHeadFraming } from '../worm/wormCameraZoom.js';

describe('WORM camera distance', () => {
  it('starts a little further back than the original lens', () => {
    expect(WORM_CAMERA_ZOOM.default).toBeGreaterThan(1);
    expect(WORM_CAMERA_ZOOM.min).toBeLessThan(1);
    expect(WORM_CAMERA_ZOOM.max).toBeGreaterThanOrEqual(2);
  });

  it('reads stored and slider values safely', () => {
    expect(clampWormCameraZoom(null)).toBe(WORM_CAMERA_ZOOM.default);
    expect(clampWormCameraZoom('')).toBe(WORM_CAMERA_ZOOM.default);
    expect(clampWormCameraZoom('garbage')).toBe(WORM_CAMERA_ZOOM.default);
    expect(clampWormCameraZoom('1.5')).toBe(1.5);
    expect(clampWormCameraZoom(0.1)).toBe(WORM_CAMERA_ZOOM.min);
    expect(clampWormCameraZoom(99)).toBe(WORM_CAMERA_ZOOM.max);
  });

  it('wheels out on scroll-down and in on scroll-up, with the same step at any distance', () => {
    const out = wheelCameraZoom(1, 100), back = wheelCameraZoom(out, -100);
    expect(out).toBeGreaterThan(1);
    expect(back).toBeCloseTo(1, 10);
    expect(wheelCameraZoom(1.5, 100) / 1.5).toBeCloseTo(out, 10);
    // A trackpad's tiny deltas still move it, and nothing escapes the range.
    expect(wheelCameraZoom(1.2, 2)).toBeGreaterThan(1.2);
    expect(wheelCameraZoom(WORM_CAMERA_ZOOM.max, 10000)).toBe(WORM_CAMERA_ZOOM.max);
    expect(wheelCameraZoom(WORM_CAMERA_ZOOM.min, -10000)).toBe(WORM_CAMERA_ZOOM.min);
  });

  it('labels the distance compactly', () => {
    expect(wormCameraZoomLabel(1.2)).toBe('1.2×');
    expect(wormCameraZoomLabel(0.85)).toBe('0.85×');
    expect(wormCameraZoomLabel(2)).toBe('2.0×');
  });

  it('keeps the whole-board desktop framing on small cubes and centres the head on big ones', () => {
    for (const size of [2, 3, 4, 5]) expect(desktopHeadFraming(size)).toBe(0);
    for (const size of [8, 10, 15]) expect(desktopHeadFraming(size)).toBe(1);
    expect(desktopHeadFraming(6)).toBeGreaterThan(0);
    expect(desktopHeadFraming(7)).toBeGreaterThan(desktopHeadFraming(6));
    expect(desktopHeadFraming(7)).toBeLessThan(1);
  });
});
