import { expect, it } from 'vitest';
import { menuWormPace, menuWormTransitPose } from '../components/menus/menuWormTransit.js';

it('gathers before diving, stretches in the throat, then lifts and ripples on emergence', () => {
  const enter = [{ kind: 'enter', distance: 2 }], exit = [{ kind: 'exit', distance: 2 }];
  const gather = menuWormTransitPose(enter, 1.45, 0, 0, {});
  const throat = menuWormTransitPose(enter, 2, 0, 0, {});
  const pop = menuWormTransitPose(exit, 2.42, 0, 0, {});
  expect(gather.stretch).toBeLessThan(0.9);
  expect(throat.stretch).toBeGreaterThan(1.25);
  expect(pop.lift).toBeGreaterThan(0.05);
  expect(pop.pulse).toBeGreaterThan(0.95);
  expect(menuWormPace(enter, 1.45)).toBeLessThan(0.5);
  expect(menuWormPace(enter, 2.08)).toBeGreaterThan(1.25);
  const body = menuWormTransitPose(exit, 2.42, 4, 0.2, {});
  expect(body.stretch).not.toBe(pop.stretch);
});

it('keeps the mouth centered, volumes stable, and reduced motion still', () => {
  for (const kind of ['enter', 'exit']) {
    const beats = [{ kind, distance: 2 }];
    for (let time = 0; time < 3; time += 0.1) {
      for (let segment = 0; segment < 14; segment++) {
        const pose = menuWormTransitPose(beats, 2, segment, time, {});
        expect(pose.lift).toBeCloseTo(0, 12); expect(pose.sway).toBeCloseTo(0, 12); expect(pose.roll).toBeCloseTo(0, 12);
        expect(pose.width ** 2 * pose.stretch).toBeCloseTo(1, 12);
        const quiet = menuWormTransitPose(beats, 1.45, segment, time, {}, true, true);
        expect(quiet).toEqual({ stretch: 1, width: 1, lift: 0, sway: 0, roll: 0, pulse: 0, transit: false });
      }
    }
  }
});
