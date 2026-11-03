import { MathUtils } from 'three';
import { coreOpeningRadius, CORE_MIRROR_HALF } from '../../3d/corePassage.js';
import { blendTunnelBodyProfile } from './tunnelBodyFit.js';

// Cosmetic shell clearance only. Never change history profiles or the distance
// metric: the larger gameplay lane stays readable inside the mirror room.
export function tunnelApertureProfileInto(out, profile, point, center, half, size, zoom) {
    blendTunnelBodyProfile(out, profile);
    if (!(half > 0) || !(out.rideWeight > 0)) return out;
    const extent = Math.max(Math.abs(point.x - center.x),
        Math.abs(point.y - center.y), Math.abs(point.z - center.z));
    // The mirror faces sit inside the outer sticker shell. Keep the same fit
    // through its whole thickness, even when zoom separates those two walls.
    const innerHalf = Math.min(half, CORE_MIRROR_HALF * zoom);
    const shellDistance = Math.max(innerHalf - extent, extent - half, 0);
    const inner = Math.min(0.035, half * 0.2);
    const outer = Math.min(0.14, half * 0.65);
    const weight = 1 - MathUtils.smoothstep(shellDistance, inner, outer);
    const width = Math.min(out.rideWidth, coreOpeningRadius(size, zoom) * 2);
    out.rideWidth += (width - out.rideWidth) * weight;
    // The aperture follows the route center, not the raised band's old floor.
    // At the wall, seat the tiny body on that center with the conservative dock
    // fit (19% of diameter), leaving room for its face and swimming stroke.
    out.rideClearance *= 1 - weight;
    return out;
}
