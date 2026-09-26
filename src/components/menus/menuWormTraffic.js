import { MENU_FLIP_PAIRS } from './menuCenterPortals.js';
import { makeMenuTunnelWormPath, MENU_WORM_SPEED, MENU_WORM_TAIL } from './menuTunnelWormPath.js';
import { createRaisedMenuTrail, raisedMenuDistance, updateRaisedMenuTrail } from './menuPortalFrames.js';
import { menuWormPace } from './menuWormTransit.js';
import { WORM_CHARACTERS } from '../../worm/wormCharacterData.js';

// The six worm species appear together; MOBI is the separate cube character.
export const MENU_WORM_CHARACTERS = WORM_CHARACTERS.filter(character => character.id !== 'mobi').map(character => character.id);

export function createMenuWormTraffic(cycle = 0) {
  const routes = MENU_FLIP_PAIRS.flat().map((face, id) => {
    const path = makeMenuTunnelWormPath(face.pos, ((cycle + id) % 4 + 0.1) * Math.PI / 2);
    return { id, portal: face.dir, character: MENU_WORM_CHARACTERS[id], path,
      trail: createRaisedMenuTrail(path), distance: 0, done: false,
      beats: path.beats.map(beat => ({ ...beat })) };
  });
  // Reserve each mouth for its assigned character for the entire wave. No
  // random crossing, mirrored companion, or queue can reuse that entrance.
  const locks = new Map(routes.map(route => [route.portal, route.id]));
  return { routes, locks };
}

export function advanceMenuWormTraffic(traffic, delta, frames, reducedMotion = false) {
  const dt = Math.max(0, Math.min(delta, 0.05));
  for (const route of traffic.routes) {
    // Follow the live raised/flipped tile even while paused.
    updateRaisedMenuTrail(route.path, route.trail, frames);
    route.path.beats.forEach((beat, i) => { route.beats[i].distance = raisedMenuDistance(route.trail, beat.distance); });
    if (dt === 0 || route.done) continue;
    route.distance += dt * MENU_WORM_SPEED * menuWormPace(route.path.beats, route.distance, reducedMotion);
    route.done = raisedMenuDistance(route.trail, route.distance) - MENU_WORM_TAIL > route.trail.length;
    if (route.done) traffic.locks.delete(route.portal);
  }
  return traffic.routes.every(route => route.done);
}
