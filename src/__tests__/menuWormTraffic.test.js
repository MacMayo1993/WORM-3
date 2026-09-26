import { describe, expect, it } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import { createMenuWormTraffic, advanceMenuWormTraffic } from '../components/menus/menuWormTraffic.js';
import { createMenuPortalFrames, raisedMenuDistance } from '../components/menus/menuPortalFrames.js';
import { MENU_WORM_TAIL, menuTunnelKey } from '../components/menus/menuTunnelWormPath.js';

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
  const occupied = new Map();
  for (const route of traffic.routes) {
    if (route.done) continue;
    const tail = raisedMenuDistance(route.trail, route.distance) - MENU_WORM_TAIL;
    for (const span of route.path.tunnelSpans) {
      if (route.distance <= span.start + 1e-9 || tail > raisedMenuDistance(route.trail, span.end)) continue;
      expect(occupied.has(span.key), `two worms in ${span.key}`).toBe(false);
      occupied.set(span.key, route.id);
      expect(traffic.locks.get(span.key)?.owner).toBe(route.id);
    }
  }
}

describe('one worm per physical menu tunnel', () => {
  it.each([0, 1, 2, 3, 4, 5])('uses exactly three distinct starting and crossing tunnels in cycle %s', cycle => {
    const traffic = createMenuWormTraffic(cycle);
    expect(traffic.routes).toHaveLength(3);
    expect(traffic.locks.size).toBe(3);
    for (const role of ['source', 'entry']) expect(new Set(traffic.routes.map(r => menuTunnelKey(r.path.portals[role]))).size).toBe(3);
    for (const route of traffic.routes) {
      expect(menuTunnelKey(route.path.portals.entry)).toBe(menuTunnelKey(route.path.portals.exit));
      expect(menuTunnelKey(route.path.portals.entry)).not.toBe(menuTunnelKey(route.path.portals.source));
    }
  });

  it.each([30, 60, 144])('never shares a tunnel and finishes with bouncing/turning mouths at %s fps', fps => {
    const traffic = createMenuWormTraffic(fps % 2), frames = createMenuPortalFrames();
    let done = false;
    for (let step = 0; step < fps * 35 && !done; step++) {
      animateFrames(frames, step / fps);
      done = advanceMenuWormTraffic(traffic, 1 / fps, frames);
      assertExclusive(traffic);
    }
    expect(done).toBe(true);
    expect(traffic.locks.size).toBe(0);
  });

  it('queues an arriving worm until the previous tail clears, including across pause and long frame gaps', () => {
    const traffic = createMenuWormTraffic(), frames = createMenuPortalFrames();
    animateFrames(frames, 0);
    const arriving = traffic.routes[0];
    const span = arriving.path.tunnelSpans[1];
    // Advance one head to the next approach while the other worm is still
    // emerging there. Its own starting tail has already cleared.
    arriving.distance = span.start - 0.005;
    advanceMenuWormTraffic(traffic, 0.1, frames);
    expect(arriving.waiting).toBe(true);
    expect(arriving.distance).toBe(span.start);
    const owner = traffic.locks.get(span.key).owner;
    expect(owner).not.toBe(arriving.id);
    const frozen = traffic.routes.map(r => r.distance), held = [...traffic.locks];
    for (let i = 0; i < 5; i++) advanceMenuWormTraffic(traffic, 0, frames);
    expect(traffic.routes.map(r => r.distance)).toEqual(frozen);
    expect([...traffic.locks]).toEqual(held);
    let acquired = false, done = false;
    for (let i = 0; i < 1400 && !done; i++) {
      done = advanceMenuWormTraffic(traffic, [0.008, 0.016, 0.09][i % 3], frames);
      assertExclusive(traffic);
      if (traffic.locks.get(span.key)?.owner === arriving.id) {
        acquired = true;
        const previous = traffic.routes[owner];
        expect(raisedMenuDistance(previous.trail, previous.distance) - MENU_WORM_TAIL)
          .toBeGreaterThan(raisedMenuDistance(previous.trail, previous.path.tunnelSpans[0].end));
      }
    }
    expect(acquired).toBe(true);
    expect(done).toBe(true);
  });
});
