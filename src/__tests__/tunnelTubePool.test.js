import { describe, it, expect } from 'vitest';
import { makeTunnelTubePool, syncTunnelTubePool, tunnelTubeHeadProgress } from '../worm/healerWorm/tunnelTubePool.js';

const a = { entry: { x: 1, y: 1, z: 2, dirKey: 'PZ' }, exit: { x: 1, y: 1, z: 0, dirKey: 'NZ' } };
const b = { entry: { x: 2, y: 1, z: 1, dirKey: 'PX' }, exit: { x: 0, y: 1, z: 1, dirKey: 'NX' } };
describe('occupied tunnel shell lifetime', () => {
  it('keeps every occupied route when the head enters a different tunnel', () => {
    const pool = makeTunnelTubePool();
    syncTunnelTubePool(pool, a, []);
    const first = pool.slots[0];
    first.opacity = 1;
    syncTunnelTubePool(pool, b, [{ tunnel: a }]);
    expect(pool.slots).toHaveLength(2);
    expect(first.tunnel).toBe(a);
    expect(first.tailOccupied).toBe(true);
    expect(first.activeTunnel).toBeNull();
    expect(pool.slots[1].activeTunnel).toBe(b);
  });

  it('reuses one shell without flipping its geometry when doubling back', () => {
    const pool = makeTunnelTubePool();
    syncTunnelTubePool(pool, a, []);
    const slot = pool.slots[0];
    const reverse = { entry: a.exit, exit: a.entry };
    syncTunnelTubePool(pool, reverse, [{ tunnel: a }]);
    expect(pool.slots).toEqual([slot]);
    expect(slot.tunnel).toBe(a);
    expect(slot.tailOccupied).toBe(true);
    expect(tunnelTubeHeadProgress(slot, 0.25)).toBe(0.75);
    syncTunnelTubePool(pool, null, [{ tunnel: a }, { tunnel: reverse }]);
    expect(slot.tailOccupied).toBe(true);
  });

  it('fades cleared routes and recycles their slots only after the fade', () => {
    const pool = makeTunnelTubePool();
    syncTunnelTubePool(pool, a, []);
    const slot = pool.slots[0];
    slot.opacity = 1;
    syncTunnelTubePool(pool, null, []);
    expect(slot.activeTunnel).toBeNull();
    expect(slot.tailOccupied).toBe(false);
    expect(slot.tunnel).toBe(a);
    slot.opacity = 0;
    syncTunnelTubePool(pool, b, []);
    expect(pool.slots).toEqual([slot]);
    expect(slot.tunnel).toBe(b);
  });
});
