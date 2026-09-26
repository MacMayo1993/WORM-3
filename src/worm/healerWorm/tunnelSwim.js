import * as THREE from 'three';

const tangent = new THREE.Vector3();
const side = new THREE.Vector3();
const up = new THREE.Vector3();
const seed = new THREE.Vector3();
const clamp01 = value => Math.max(0, Math.min(1, value));
const ease = value => { const t = clamp01(value); return t * t * (3 - 2 * t); };

// Render-only motion. Never feed these offsets into the recorded route or camera.
// The wave uses a continuous clock, so crossing a phase boundary cannot reset it.
export function tunnelHeadPulse(phase, progress, time, reducedMotion = false) {
    if (reducedMotion) return 1;
    const envelope = phase === 'windup' ? ease(progress)
        : phase === 'windout' ? ease(1 - progress)
            : ['entering', 'tunnel', 'exiting'].includes(phase) ? 1 : 0;
    return 1 + envelope * 0.045 * Math.sin(time * 4.8);
}

export function tunnelSwimInto(out, index, count, time, weight, reducedMotion = false) {
    // Leave the head anchored, and taper the last few beads independently of body
    // length so both a starter worm and a mega-worm have a readable swimming stroke.
    const strength = reducedMotion ? 0 : clamp01(weight) * ease(index / 3) * ease((count - index) / 3);
    if (strength === 0) {
        out.side = out.lift = out.bank = 0;
        out.scale = 1;
        return out;
    }
    const phase = time * 4.8 - index * 0.62;
    out.side = Math.sin(phase) * 0.07 * strength;
    out.lift = (0.5 + 0.5 * Math.sin(phase + 0.8)) * 0.014 * strength;
    out.scale = 1 + Math.cos(phase) * 0.065 * strength;
    out.bank = Math.cos(phase) * 0.18 * strength;
    return out;
}

// Follow the local route frame, not a world axis: top/bottom and rotated portals
// get the same stroke. Gram-Schmidt keeps the displacement perpendicular to travel.
export function offsetTunnelSwimInto(position, forward, normal, stroke) {
    if (forward.lengthSq() < 1e-10) return position;
    tangent.copy(forward).normalize();
    up.copy(normal).addScaledVector(tangent, -normal.dot(tangent));
    if (up.lengthSq() < 1e-8) {
        seed.set(Math.abs(tangent.y) < 0.9 ? 0 : 1, Math.abs(tangent.y) < 0.9 ? 1 : 0, 0);
        up.copy(seed).addScaledVector(tangent, -seed.dot(tangent));
    }
    up.normalize();
    side.crossVectors(up, tangent).normalize();
    return position.addScaledVector(side, stroke.side).addScaledVector(up, stroke.lift);
}
