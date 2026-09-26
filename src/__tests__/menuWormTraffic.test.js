import { describe, expect, it } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import { createMenuWormTraffic, advanceMenuWormTraffic, MENU_WORM_CHARACTERS } from '../components/menus/menuWormTraffic.js';
import { createMenuPortalFrames, raisedMenuDistance } from '../components/menus/menuPortalFrames.js';
import { MENU_WORM_TAIL, sampleMenuTunnelWorm } from '../components/menus/menuTunnelWormPath.js';
import { MENU_FLIP_PAIRS } from '../components/menus/menuCenterPortals.js';

const move = new Matrix4(), spin = new Matrix4(), offset = new Vector3();
function animateFrames(frames, time) {
  frames.forEach((frame, i) => {
    frame.active = true;
    // Opposite portals deliberately have different heights. Periodically tap
    // a tile edge-on too, so occupancy is checked against real body length.
    const lift = 0.35 + 0.07 * Math.sin(time * 3 + i);
    offset.setFromMatrixPosition(frame.base).normalize().multiplyScalar(lift);
    frame.matrix.copy(frame.base).premultiply(move.makeTranslation(...offset.toArray()));
    const turn = Math.max(0, Math.sin(time * 0.7)) * Math.PI * 0.6;
    frame.matrix.multiply(spin.makeRotationX(turn));
    frame.correction.multiplyMatrices(frame.matrix, frame.inverseBase);
  });
}

function assertExclusive(traffic) {
  const occupied = new Set();
  for (const route of traffic.routes) {
    if (route.done) {
      expect(traffic.locks.has(route.portal)).toBe(false);
      continue;
    }
    expect(occupied.has(route.portal), `two worms in ${route.portal}`).toBe(false);
    occupied.add(route.portal);
    expect(traffic.locks.get(route.portal)).toBe(route.id);
  }
}

describe('six worms with six dedicated menu wormholes', () => {
  it.each([0, 1, 2, 3, 4, 5])('shows the full six-worm cast in separate portals in cycle %s', cycle => {
    const traffic = createMenuWormTraffic(cycle);
    expect(traffic.routes).toHaveLength(6);
    expect(traffic.locks.size).toBe(6);
    expect(traffic.routes.map(route => route.character)).toEqual(['classic', 'inch', 'glow', 'book', 'wiggle', 'prism']);
    expect(traffic.routes.map(route => route.character)).toEqual(MENU_WORM_CHARACTERS);
    expect(new Set(traffic.routes.map(route => route.portal)).size).toBe(6);
    for (const route of traffic.routes) {
      const face = MENU_FLIP_PAIRS.flat().find(face => face.dir === route.portal);
      expect(route.path.portals.source.toArray()).toEqual(face.pos);
      expect(route.path.portals.destination.toArray()).toEqual(face.pos);
    }
  });

  it.each([30, 60, 144])('animates all six together with exclusive bouncing/turning mouths at %s fps', fps => {
    const traffic = createMenuWormTraffic(), frames = createMenuPortalFrames();
    const p = new Vector3(), n = new Vector3(), f = new Vector3();
    let done = false, allSixOutside = false;
    for (let step = 0; step < fps * 25 && !done; step++) {
      animateFrames(frames, step / fps);
      done = advanceMenuWormTraffic(traffic, 1 / fps, frames);
      assertExclusive(traffic);
      if (traffic.routes.every(route => {
        const head = raisedMenuDistance(route.trail, route.distance);
        return !route.done && head - MENU_WORM_TAIL > route.beats[0].distance && head < route.beats[1].distance;
      })) allSixOutside = true;
      for (const route of traffic.routes) {
        const frame = frames.find(frame => frame.dir === route.portal);
        for (const beat of route.beats) {
          sampleMenuTunnelWorm(route.trail, beat.distance, p, n, f);
          expect(p.distanceTo(new Vector3().setFromMatrixPosition(frame.matrix))).toBeLessThan(1e-6);
        }
      }
    }
    expect(allSixOutside).toBe(true);
    expect(done).toBe(true);
    expect(traffic.locks.size).toBe(0);
  });

  it.each([false, true])('holds every assignment through pause, frame gaps, and the last tail (reduced motion: %s)', reduced => {
    const traffic = createMenuWormTraffic(), frames = createMenuPortalFrames();
    animateFrames(frames, 0);
    advanceMenuWormTraffic(traffic, 0.05, frames, reduced);
    const frozen = traffic.routes.map(route => route.distance), held = [...traffic.locks];
    for (let i = 0; i < 5; i++) advanceMenuWormTraffic(traffic, 0, frames, reduced);
    expect(traffic.routes.map(route => route.distance)).toEqual(frozen);
    expect([...traffic.locks]).toEqual(held);
    let done = false;
    for (let i = 0; i < 1000 && !done; i++) {
      done = advanceMenuWormTraffic(traffic, [0.008, 0.016, 0.09][i % 3], frames, reduced);
      assertExclusive(traffic);
      for (const route of traffic.routes) {
        const tail = raisedMenuDistance(route.trail, route.distance) - MENU_WORM_TAIL;
        expect(route.done).toBe(tail > route.trail.length);
      }
    }
    expect(done).toBe(true);
  });
});
