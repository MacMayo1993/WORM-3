import { describe, it, expect } from 'vitest';
import { selectChaosFlipLocked } from '../hooks/useGameStore.js';
import { cubieBodyGeometry } from '../3d/cubieBodyGeometry.js';

const base = { chaosLevel: 0, chaosIgnitionPicking: false, currentLevelData: null, wormHealerMode: false };

describe('selectChaosFlipLocked', () => {
  it('refuses the player\'s flips while a Chaos round owns the board', () => {
    expect(selectChaosFlipLocked({ ...base, chaosLevel: 3 })).toBe(true);
    // Aiming the first strike: a flip would change the board the round starts from.
    expect(selectChaosFlipLocked({ ...base, chaosIgnitionPicking: true })).toBe(true);
  });

  it('leaves flips alone outside Chaos, in story levels and in WORM', () => {
    expect(selectChaosFlipLocked(base)).toBe(false);
    expect(selectChaosFlipLocked({ ...base, chaosLevel: 3, currentLevelData: { id: 4 } })).toBe(false);
    expect(selectChaosFlipLocked({ ...base, chaosLevel: 3, wormHealerMode: true })).toBe(false);
  });
});

describe('cubieBodyGeometry', () => {
  it('builds each body size once and shares it', () => {
    const classic = cubieBodyGeometry(0.96);
    expect(cubieBodyGeometry(0.96)).toBe(classic);
    const neon = cubieBodyGeometry(0.98);
    expect(neon).not.toBe(classic);
    neon.computeBoundingBox();
    const extent = neon.boundingBox.max.clone().sub(neon.boundingBox.min);
    for (const v of extent.toArray()) expect(v).toBeCloseTo(0.98, 3);
    // Centred, with creased (flat-faced) normals like drei's RoundedBox.
    expect(neon.boundingBox.min.x).toBeCloseTo(-0.49, 3);
    expect(neon.attributes.normal.count).toBe(neon.attributes.position.count);
  });
});
