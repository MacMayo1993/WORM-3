import { describe, it, expect } from 'vitest';
import { TUNNEL_ENERGY_BEAT, tunnelEnergySeed, makeTunnelEnergyUniforms, tunnelEnergyGLSL } from '../manifold/tunnelEnergy.js';
import { fragmentShader, bumperFragmentShader, createMobiusWarmupMaterials } from '../manifold/mobiusTunnelShaders.js';
import { veilFragmentShader } from '../manifold/tunnelRibbonVeil.js';

describe('Möbius tunnel energy', () => {
  it('gives each tunnel a stable phase so bands do not beat in lockstep', () => {
    const ids = ['M1-001|M4-009', 'M2-004|M5-006', 'M3-012|M6-001', 'a|b', ''];
    const seeds = ids.map(tunnelEnergySeed);
    for (const seed of seeds) {
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(1);
    }
    expect(ids.map(tunnelEnergySeed)).toEqual(seeds);
    expect(new Set(seeds.slice(0, 4)).size).toBe(4);
  });

  it('starts every band at full strength, drawn to both mouths', () => {
    const u = makeTunnelEnergyUniforms();
    expect(u.uEnergyGain.value).toBe(1);
    expect(u.uEnergyDrawn.value.toArray()).toEqual([1, 1]);
    expect(makeTunnelEnergyUniforms().uEnergyDrawn.value).not.toBe(u.uEnergyDrawn.value);
  });

  it('declares every uniform it reads and splices the beat as a float', () => {
    for (const name of Object.keys(makeTunnelEnergyUniforms())) expect(tunnelEnergyGLSL).toContain(name);
    expect(tunnelEnergyGLSL).toContain(`time / ${TUNNEL_ENERGY_BEAT.toFixed(2)}`);
  });

  it('runs through the spine, lips and veil, and the warm-up compiles the same programs', () => {
    for (const shader of [fragmentShader, bumperFragmentShader, veilFragmentShader]) expect(shader).toContain('tunnelEnergy(');
    const warm = createMobiusWarmupMaterials().map(m => m.fragmentShader);
    for (const shader of [fragmentShader, bumperFragmentShader, veilFragmentShader]) expect(warm).toContain(shader);
  });
});
