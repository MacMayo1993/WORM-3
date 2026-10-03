import { describe, expect, it } from 'vitest';
import { makeCubies } from '../game/cubeState.js';
import { findCoveredWormholeRings, getWormholeHealRing } from '../worm/wormLogic.js';

const keyOf = t => `${t.x},${t.y},${t.z},${t.dirKey}`;

function world(entries) {
  const size = 7;
  const cubies = makeCubies(size);
  const tunnels = entries.map(([x, y], i) => ({ tunnelKey: `pair-${i}`, tunnel: {
    entry: { x, y, z: 6, dirKey: 'PZ' },
    exit: { x: 6 - x, y: 6 - y, z: 0, dirKey: 'NZ' },
  } }));
  const holes = new Set();
  for (const { tunnel } of tunnels) for (const t of [tunnel.entry, tunnel.exit]) {
    cubies[t.x][t.y][t.z].stickers[t.dirKey].curr = t.dirKey === 'PZ' ? 4 : 1;
    holes.add(keyOf(t));
  }
  const occupied = new Set(tunnels.flatMap(({ tunnel }) => [...getWormholeHealRing(tunnel.entry, size)])
    .filter(key => !holes.has(key)));
  return { size, cubies, tunnels, occupied };
}

describe('simultaneous wormhole surrounds', () => {
  it.each([
    [[2, 3], [3, 3]], // adjacent
    [[2, 2], [3, 3]], // diagonal
    [[2, 3], [3, 3], [4, 3]], // three mouths
    [[1, 1], [5, 5]], // separate complete rings
    [[0, 0], [1, 0]], // folded corner/edge rings
  ])('clears every pair with covered non-flipped neighbours: %j', (...entries) => {
    const { tunnels, occupied, size, cubies } = world(entries);
    expect(findCoveredWormholeRings(tunnels, occupied, size, cubies)).toHaveLength(tunnels.length);
  });

  it('still requires every non-flipped neighbour, including diagonals', () => {
    const { tunnels, occupied, size, cubies } = world([[2, 3], [3, 3]]);
    occupied.delete('1,2,6,PZ');
    expect(findCoveredWormholeRings(tunnels, occupied, size, cubies).map(h => h.tunnelKey))
      .toEqual(['pair-1']);
  });

  it('counts a pair only once when both mouths and reversed lookup records match', () => {
    const { tunnels, occupied, size, cubies } = world([[2, 3]]);
    const { entry, exit } = tunnels[0].tunnel;
    for (const key of getWormholeHealRing(exit, size)) occupied.add(key);
    tunnels.push({ tunnelKey: 'reversed', tunnel: { entry: exit, exit: entry } });
    expect(findCoveredWormholeRings(tunnels, occupied, size, cubies)).toHaveLength(1);
  });

  it('does not auto-clear a mouth surrounded entirely by flipped tiles', () => {
    const { tunnels, size, cubies } = world([[3, 3]]);
    for (const key of getWormholeHealRing(tunnels[0].tunnel.entry, size)) {
      const [x, y, z, dir] = key.split(',');
      cubies[x][y][z].stickers[dir].curr = 4;
    }
    expect(findCoveredWormholeRings(tunnels, new Set(['0,0,6,PZ']), size, cubies)).toEqual([]);
  });
});
