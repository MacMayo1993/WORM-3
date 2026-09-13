import { describe, it, expect } from 'vitest';
import { DoubleSide } from 'three';
import { getOrbMaterials } from '../worm/orbMaterials.js';

describe('parity material ownership', () => {
    it('reuses resident materials for matching orb states', () => {
        expect(getOrbMaterials('#f00', '#00f', false)).toBe(getOrbMaterials('#f00', '#00f', false));
    });
    it('keeps rainbow writes away from ordinary pickups of the same colors', () => {
        const plain = getOrbMaterials('#f00', '#00f', false);
        const rainbow = getOrbMaterials('#f00', '#00f', false, true);
        const before = plain.shell.color.getHex();
        rainbow.shell.color.set('#00ff00');
        rainbow.band.emissive.set('#00ff00');
        expect(plain.shell.color.getHex()).toBe(before);
        expect(plain.band.emissive.getHex()).toBe(0x0000ff);
    });
    it('isolates glow intensity from normal characters and target variants', () => {
        const plain = getOrbMaterials('#ff0', '#0ff', false);
        const glow = getOrbMaterials('#ff0', '#0ff', false, false, true);
        glow.shell.emissiveIntensity = 9;
        expect(plain.shell.emissiveIntensity).toBe(0.6);
        expect(getOrbMaterials('#ff0', '#0ff', true).shell.emissiveIntensity).toBe(0.85);
    });
    it('renders both sides of the unstyled Mobius band', () => {
        expect(getOrbMaterials('#fff', '#f00', false).band.side).toBe(DoubleSide);
    });
});
