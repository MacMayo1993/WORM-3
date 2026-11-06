import { getWormTunnelSnapshot } from '../tunnelSnapshot.js';
import { WORM_PAD_HEIGHT } from '../../game/raisedCubie.js';
import { tunnelRouteKey } from './tunnelTubePool.js';

const cellKey = cell => `${cell.x},${cell.y},${cell.z},${cell.dirKey}`;
const routeFrame = tunnel => `${cellKey(tunnel.entry)}:${cellKey(tunnel.exit)}:${tunnel.padExpansion}:${tunnel.padHeight}`;

// The passage array is mutated in place as tails clear. Cache its contents, not
// just its identity, and keep all occupied routes ahead of the live topology.
export function interiorPortalRoutes(cache, cubies, size, epoch, cap, expansion, active, passages) {
  const occupied = [];
  if (active) occupied.push(active);
  for (const passage of passages) if (passage.tunnel) occupied.push(passage.tunnel);
  const signature = occupied.map(routeFrame).join('|');
  if (cache.cubies === cubies && cache.size === size && cache.epoch === epoch && cache.cap === cap
    && cache.expansion === expansion && cache.signature === signature) return cache.routes;
  const routes = [], seen = new Set();
  const add = tunnel => {
    const key = tunnelRouteKey(tunnel);
    if (seen.has(key)) return;
    seen.add(key); routes.push(tunnel);
  };
  for (const tunnel of occupied) add(tunnel);
  // Reuse the simulation's immutable snapshot rather than rescanning the board.
  for (const { tunnel } of getWormTunnelSnapshot(cubies, size, epoch).tunnels) {
    if ([tunnel.entry, tunnel.exit].some(cell =>
      (cubies[cell.x]?.[cell.y]?.[cell.z]?.stickers?.[cell.dirKey]?.flips ?? cap) >= cap)) continue;
    add({ ...tunnel, padHeight: WORM_PAD_HEIGHT, padExpansion: expansion });
  }
  Object.assign(cache, { cubies, size, epoch, cap, expansion, signature, routes });
  return routes;
}
