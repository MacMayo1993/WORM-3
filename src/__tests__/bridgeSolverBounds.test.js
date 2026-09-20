import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { makeBridgeCurve, fitBridgeToLength, ARC_LENGTH_TOLERANCE, SAG_FIT_TOLERANCE } from '../worm/traversal/bridgeCurve.js';
import { LENGTH_MARGIN, bodyLength, missingPickupsForGrowth, missingOrdinaryOrbs } from '../worm/traversal/bodyMaterial.js';
const up = new Vector3(0, 1, 0), a = new Vector3();
// Independent composite Simpson integration of the analytic derivative, including
// unequal-height and horizontal shoulder terms (not the solver's polyline).
function referenceLength(width, rise, sag, shoulder) {
  const n = 4096, h = width - 2 * shoulder;
  const speed = t => Math.hypot(h, 6 * rise * t * (1 - t) - 32 * sag * t * (1 - t) * (1 - 2 * t));
  let sum = speed(0) + speed(1);
  for (let i = 1; i < n; i++) sum += (i % 2 ? 4 : 2) * speed(i / n);
  return 2 * shoulder + sum / (3 * n);
}
it.each([-.5, 0, .5])('bounds arclength and verifies strict sag monotonicity at rise %s', rise => {
  for (const width of [.34, .89, 3.24]) {
    const shoulder = width === .34 ? .145 : .23, b = new Vector3(width, rise, 0);
    let previous = -Infinity, previousUpper = -Infinity;
    for (const sag of [0, .005, .03, .1, .3, .5]) {
      const curve = makeBridgeCurve(a, b, up, sag, shoulder), exact = referenceLength(width, rise, sag, shoulder);
      expect(exact).toBeGreaterThan(previous); previous = exact;
      expect(curve.length).toBeGreaterThan(previousUpper); previousUpper = curve.lengthUpper;
      expect(curve.length).toBeLessThanOrEqual(exact + 1e-10);
      expect(curve.lengthUpper).toBeGreaterThanOrEqual(exact - 1e-10);
      expect(curve.lengthErrorBound).toBeLessThanOrEqual(ARC_LENGTH_TOLERANCE);
    }
  }
});
it('returns a feasible bracket with budget slack below tolerance, far below the gameplay margin', () => {
  expect(SAG_FIT_TOLERANCE).toBeLessThan(LENGTH_MARGIN / 100);
  expect(ARC_LENGTH_TOLERANCE).toBeLessThan(SAG_FIT_TOLERANCE);
  for (const rise of [-.5, 0, .5]) {
    const b = new Vector3(.89, rise, 0), shoulder = .23;
    const min = makeBridgeCurve(a, b, up, 0, shoulder);
    expect(fitBridgeToLength(a, b, up, min.length - .001, .3, shoulder)).toBeNull();
    for (const extra of [.0002, .01, .06]) {
      const available = min.lengthUpper + extra;
      const fitted = fitBridgeToLength(a, b, up, available, .3, shoulder);
      expect(fitted.lengthUpper).toBeLessThanOrEqual(available);
      expect(fitted.fit.constrained).toBe(true);
      expect(fitted.fit.slackUpper).toBeLessThanOrEqual(SAG_FIT_TOLERANCE);
      expect(makeBridgeCurve(a, b, up, fitted.fit.sagBracket[1], shoulder).lengthUpper).toBeGreaterThan(available);
      expect(referenceLength(.89, rise, fitted.sag, shoulder)).toBeLessThanOrEqual(available);
    }
    const desired = fitBridgeToLength(a, b, up, 10, .3, shoulder);
    expect(desired.sag).toBe(.3); expect(desired.fit.constrained).toBe(false);
  }
});
it('rejects non-finite or invalid solver inputs', () => {
  expect(() => fitBridgeToLength(a, new Vector3(1, 0, 0), up, Infinity, .1)).toThrow();
  expect(() => makeBridgeCurve(a, new Vector3(1, 0, 0), up, .1, NaN)).toThrow();
});
it('forecasts a per-pickup growth schedule, including an expiring Prism bonus and the tail cap', () => {
  const required = bodyLength(11);
  expect(missingOrdinaryOrbs(required, 4)).toBe(3);
  expect(missingPickupsForGrowth(required, 4, index => index === 0 ? 4 : 3)).toBe(2);
  expect(missingPickupsForGrowth(bodyLength(12), 4, index => index === 0 ? 4 : 3)).toBe(3);
  expect(missingPickupsForGrowth(bodyLength(1200) + .01, 1199, () => 4)).toBe(Infinity);
});
