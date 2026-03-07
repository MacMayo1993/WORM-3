import { describe, it, expect } from 'vitest';
import { createInitialTunnelWorm, findNextTunnel, getTunnelSideKey } from '../worm/wormLogic.js';

describe('tunnel worm logic', () => {
  const size = 3;

  const tunnelA = {
    id: 'tunnel-a',
    entry: { x: 0, y: 1, z: 1, dirKey: 'NX' },
    exit: { x: 2, y: 1, z: 1, dirKey: 'PX' }
  };

  const tunnelB = {
    id: 'tunnel-b',
    entry: { x: 2, y: 1, z: 2, dirKey: 'PZ' },
    exit: { x: 0, y: 1, z: 2, dirKey: 'NZ' }
  };

  it('initial tunnel worm starts with forward tunnel direction', () => {
    const worm = createInitialTunnelWorm([tunnelA], 3);
    expect(worm).toHaveLength(3);
    expect(worm.every(seg => seg.direction === 1)).toBe(true);
  });

  it('finds a next tunnel entry when side is active', () => {
    const result = findNextTunnel(tunnelA.exit, [tunnelA, tunnelB], tunnelA.id, size, new Set());
    expect(result).toBeTruthy();
    expect(result.tunnel.id).toBe('tunnel-b');
    expect(result.enteredSideKey).toBe(getTunnelSideKey(tunnelB.entry));
  });

  it('skips tunnels when the chosen entry side was already consumed', () => {
    const inactive = new Set([getTunnelSideKey(tunnelB.entry)]);
    const result = findNextTunnel(tunnelA.exit, [tunnelA, tunnelB], tunnelA.id, size, inactive);
    expect(result).toBeTruthy();
    expect(result.tunnel.id).toBe('tunnel-b');
    expect(result.enteredSideKey).toBe(getTunnelSideKey(tunnelB.exit));
    expect(result.enterFromEntry).toBe(false);
  });
});
