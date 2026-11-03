import { MathUtils } from 'three';

// Keep the same clearance while the camera departs after a ride, rather than
// restoring every hidden bead on the first crawling frame. Ordinary airborne
// moves never inherit tunnel culling. Exponential damping is frame-rate stable.
export function advanceTunnelBodyClearance(weight, transit, phase, delta) {
    if (!transit && phase !== 'crawling') return 0;
    const target = transit ? 1 : 0;
    return target + (weight - target) * Math.exp(-18 * Math.max(0, delta));
}

// Distance is normalized to the bead's footprint. Below-lens beads stay visible
// except at actual contact, where they now taper away instead of popping out.
export function tunnelBodyCameraKeep(distance, aheadCos, belowCos, weight = 1) {
    const close = 1 - MathUtils.smoothstep(distance, 0.2, 0.36);
    const ahead = MathUtils.smoothstep(aheadCos, 0.55, 0.85)
        * (1 - MathUtils.smoothstep(distance, 0.36, 0.5));
    const below = MathUtils.smoothstep(belowCos, 0.3, 0.6);
    const contact = MathUtils.smoothstep(distance, 0.1, 0.2);
    const keep = contact * (1 - Math.max(close, ahead) * (1 - below));
    return 1 - (1 - keep) * MathUtils.clamp(weight, 0, 1);
}
