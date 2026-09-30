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

    it('draws MOBI’s carried orb like the pickup it came from', async () => {
        const { createMobiOrbPalette } = await import('../worm/mobiOrbAppearance.js');
        const { orbColorRoles } = await import('../worm/orbMaterials.js');
        const { orbCreditFace } = await import('../worm/healerWorm/economy.js');
        const { getOrbColor, getAntipodalOrbColor } = await import('../worm/wormHelpers.js');
        const { resolveColors } = await import('../utils/colorSchemes.js');
        const colors = resolveColors({});
        const palette = createMobiOrbPalette({});
        for (const tile of [1, 2, 3, 4, 5, 6]) {
            // A world orb on this tile credits its body's face; MOBI carries that face.
            const world = orbColorRoles(getOrbColor(tile, colors), getAntipodalOrbColor(tile, colors));
            const carried = palette[orbCreditFace(tile)];
            expect(carried.gemColor).toBe(world.gem);
            expect(carried.bandColor).toBe(world.band);
        }
    });

    it('patterns MOBI’s band with the style of the tile the orb came from', async () => {
        const { createMobiOrbPalette } = await import('../worm/mobiOrbAppearance.js');
        const { getOrbMaterials } = await import('../worm/orbMaterials.js');
        // Only white (3) is patterned; its orbs credit yellow (6).
        const palette = createMobiOrbPalette({ manifoldStyles: { 3: 'topographic' } });
        expect(palette[6].bandMaterial).not.toBe(getOrbMaterials(palette[6].gemColor, palette[6].bandColor, false).band);
        expect(palette[3].bandMaterial).toBe(getOrbMaterials(palette[3].gemColor, palette[3].bandColor, false).band);
    });
});
