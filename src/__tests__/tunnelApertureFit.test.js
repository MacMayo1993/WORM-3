import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { tunnelApertureProfileInto } from '../worm/healerWorm/tunnelApertureFit.js';
import { fitTunnelBodyInto } from '../worm/healerWorm/tunnelBodyFit.js';
import { coreOpeningRadius } from '../3d/corePassage.js';

it('fits all footprints and stroke inside tile apertures without changing the gameplay profile', () => {
    const center = new Vector3(1, 2, 3), point = new Vector3(1.3, 2, 3);
    const original = { rideWidth: .12, rideClearance: .08, rideWeight: 1 };
    for (const size of [3, 15]) for (const zoom of [1, 6]) for (const radius of [.082, .12, .22]) {
        const profile = tunnelApertureProfileInto({}, original, point, center, .3, size, zoom);
        const fit = fitTunnelBodyInto({}, profile, radius, .07, .014);
        expect(Math.hypot(fit.shift + radius * fit.scale * 1.1 + fit.lift, fit.side)).toBeLessThan(coreOpeningRadius(size, zoom));
    }
    expect(original).toEqual({ rideWidth: .12, rideClearance: .08, rideWeight: 1 });
});

it('restores the full profile inside the room and outside the shell, with a smooth shoulder', () => {
    const center = new Vector3(), original = { rideWidth: .12, rideClearance: .08, rideWeight: 1 };
    for (const point of [new Vector3(), new Vector3(1, 0, 0)]) {
        expect(tunnelApertureProfileInto({}, original, point, center, .2125, 15, 1)).toEqual(original);
    }
    let last = null;
    for (let x = .02; x < .45; x += .001) {
        const profile = tunnelApertureProfileInto({}, original, new Vector3(x, 0, 0), center, .2125, 15, 1);
        if (last) {
            expect(Math.abs(profile.rideWidth - last.rideWidth)).toBeLessThan(.002);
            expect(Math.abs(profile.rideClearance - last.rideClearance)).toBeLessThan(.002);
        }
        last = profile;
    }
});
