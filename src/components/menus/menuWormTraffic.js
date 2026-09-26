import { Vector3 } from 'three';
import { MENU_FLIP_PAIRS } from './menuCenterPortals.js';
import { makeMenuTunnelWormPath, MENU_WORM_SPEED, MENU_WORM_TAIL } from './menuTunnelWormPath.js';
import { createRaisedMenuTrail, raisedMenuDistance, updateRaisedMenuTrail } from './menuPortalFrames.js';
import { menuWormPace } from './menuWormTransit.js';

export function createMenuWormTraffic(cycle = 0) {
  // Three worms, one starting pair each; adjacent destinations form a
  // permutation. There is no mirrored companion travelling the same tunnel.
  const routes = MENU_FLIP_PAIRS.map((pair, id) => {
    const start = pair[cycle % 2].pos;
    const normal = new Vector3(...start).normalize();
    const axis = Math.abs(normal.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
    const right = new Vector3().crossVectors(axis, normal).normalize();
    const target = new Vector3(...MENU_FLIP_PAIRS[(id + 1 + cycle % 2) % 3][cycle % 2].pos).normalize();
    let turn = 0;
    while (turn < 3 && right.clone().applyAxisAngle(normal, turn * Math.PI / 2).dot(target) < 0.99) turn++;
    const path = makeMenuTunnelWormPath(start, (turn + 0.1) * Math.PI / 2);
    return { id, path, trail: createRaisedMenuTrail(path), distance: 0, waiting: false, done: false,
      beats: path.beats.map(beat => ({ ...beat })) };
  });
  const locks = new Map(routes.map(route => [route.path.tunnelSpans[0].key, { owner: route.id, span: 0 }]));
  return { routes, locks };
}

export function advanceMenuWormTraffic(traffic, delta, frames, reducedMotion = false) {
  const dt = Math.max(0, Math.min(delta, 0.05));
  // Update geometry first, including paused frames: a changed tile transform
  // must never let the tail release a lock using yesterday's portal position.
  for (const route of traffic.routes) {
    updateRaisedMenuTrail(route.path, route.trail, frames);
    route.path.beats.forEach((beat, i) => { route.beats[i].distance = raisedMenuDistance(route.trail, beat.distance); });
  }
  if (dt === 0) return traffic.routes.every(route => route.done);
  for (const [key, lock] of traffic.locks) {
    const route = traffic.routes[lock.owner];
    const tail = raisedMenuDistance(route.trail, route.distance) - MENU_WORM_TAIL;
    const end = raisedMenuDistance(route.trail, route.path.tunnelSpans[lock.span].end);
    if (route.done || tail > end) traffic.locks.delete(key);
  }
  for (const route of traffic.routes) {
    if (route.done) continue;
    route.waiting = false;
    let next = route.distance + dt * MENU_WORM_SPEED * menuWormPace(route.path.beats, route.distance, reducedMotion);
    for (let i = 0; i < route.path.tunnelSpans.length; i++) {
      const span = route.path.tunnelSpans[i];
      const tail = raisedMenuDistance(route.trail, route.distance) - MENU_WORM_TAIL;
      if (next < span.start || tail > raisedMenuDistance(route.trail, span.end)) continue;
      const lock = traffic.locks.get(span.key);
      if (lock && lock.owner !== route.id) {
        next = Math.min(next, span.start);
        route.waiting = true;
        break;
      }
      traffic.locks.set(span.key, { owner: route.id, span: i });
    }
    route.distance = next;
    route.done = next > route.path.length + MENU_WORM_TAIL;
    if (route.done) for (const [key, lock] of traffic.locks) if (lock.owner === route.id) traffic.locks.delete(key);
  }
  return traffic.routes.every(route => route.done);
}
