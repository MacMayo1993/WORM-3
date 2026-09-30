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

describe('parity orb colour roles', () => {
    it('wears the manifold on the band and its antipodal partner on the gem body', async () => {
        const { orbColorRoles } = await import('../worm/orbMaterials.js');
        const { getOrbColor, getAntipodalOrbColor } = await import('../worm/wormHelpers.js');
        const { resolveColors } = await import('../utils/colorSchemes.js');
        const colors = resolveColors({});
        // Face 3 is white, its antipode 6 is yellow: an orb on a white manifold
        // has a yellow body and a white band.
        const roles = orbColorRoles(getOrbColor(3, colors), getAntipodalOrbColor(3, colors));
        expect(roles.gem).toBe(getOrbColor(6, colors));
        expect(roles.band).toBe(getOrbColor(3, colors));
        // Every antipodal pair maps the same way in both directions.
        for (const [face, anti] of [[1, 4], [2, 5], [3, 6], [4, 1], [5, 2], [6, 3]]) {
            expect(orbColorRoles(getOrbColor(face, colors), getAntipodalOrbColor(face, colors)))
                .toEqual({ gem: getOrbColor(anti, colors), band: getOrbColor(face, colors) });
        }
    });

    it('matches MOBI’s carried orbs', async () => {
        const { createMobiOrbPalette } = await import('../worm/mobiOrbAppearance.js');
        const { orbColorRoles } = await import('../worm/orbMaterials.js');
        const { getOrbColor, getAntipodalOrbColor } = await import('../worm/wormHelpers.js');
        const { resolveColors } = await import('../utils/colorSchemes.js');
        const colors = resolveColors({});
        const mobi = createMobiOrbPalette({})[3];
        const roles = orbColorRoles(getOrbColor(3, colors), getAntipodalOrbColor(3, colors));
        expect(mobi.gemColor).toBe(roles.gem);
        expect(mobi.bandColor).toBe(roles.band);
    });
});
