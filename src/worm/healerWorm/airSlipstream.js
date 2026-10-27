import * as THREE from 'three';

const LANES = 6, STEPS = 24, STRIDE = (STEPS + 1) * 2;

// Open, tapered streamlines, not rings. One reusable mesh follows the published
// body in world space, including turns and live slice rotations. No trail cache
// or wall clock: holding the sim also holds the wind.
export function createAirSlipstream() {
    const geometry = new THREE.BufferGeometry();
    const positions = new THREE.BufferAttribute(new Float32Array(LANES * STRIDE * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const colors = new THREE.BufferAttribute(new Float32Array(LANES * STRIDE * 4), 4).setUsage(THREE.DynamicDrawUsage);
    const indices = [];
    for (let lane = 0; lane < LANES; lane++) for (let j = 0; j < STEPS; j++) {
        const v = lane * STRIDE + j * 2;
        indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
    geometry.setAttribute('position', positions); geometry.setAttribute('color', colors);
    geometry.setIndex(indices); geometry.setDrawRange(0, 0);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true,
        transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    mesh.name = 'air-slipstream'; mesh.frustumCulled = false; mesh.material.forceSinglePass = true;
    const distances = new Float32Array(96);
    const forward = new THREE.Vector3(), tangent = new THREE.Vector3(), normal = new THREE.Vector3();
    const side = new THREE.Vector3(), center = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
    const mint = new THREE.Color('#75e8d5'), pearl = new THREE.Color('#f1fffa');

    function update(head, headNormal, segments, time, flying, reduced, lowFX) {
        const count = Math.min(segments.count, distances.length);
        distances[0] = 0;
        for (let i = 1; i < count; i++) {
            a.fromArray(segments.positions, (i - 1) * 3); b.fromArray(segments.positions, i * 3);
            distances[i] = distances[i - 1] + a.distanceTo(b);
        }
        // A valid tangent even on the first frame, or while beads overlap.
        forward.set(0, 1, 0);
        if (Math.abs(forward.dot(headNormal)) > 0.9) forward.set(1, 0, 0);
        forward.addScaledVector(headNormal, -forward.dot(headNormal)).normalize();
        for (let i = 1; i < count; i++) {
            a.copy(head).sub(b.fromArray(segments.positions, i * 3));
            if (a.lengthSq() > 1e-6) { forward.copy(a).normalize(); break; }
        }
        const total = count > 1 ? distances[count - 1] : 0;
        const length = Math.min(flying ? 3.8 : 2.5, Math.max(1.3, total + 0.45));
        const lanes = reduced ? 2 : lowFX ? 4 : LANES;
        for (let lane = 0; lane < lanes; lane++) {
            const flank = lane % 2 ? 1 : -1, tier = Math.floor(lane / 2);
            let segment = 1;
            normal.copy(headNormal);
            for (let j = 0; j <= STEPS; j++) {
                const u = j / STEPS, distance = -0.25 + u * length * (1 - tier * 0.12);
                tangent.copy(forward);
                if (distance <= 0 || total < 1e-5) center.copy(head).addScaledVector(forward, -distance);
                else {
                    while (segment < count - 1 && distances[segment] < distance) segment++;
                    a.fromArray(segments.positions, (segment - 1) * 3); b.fromArray(segments.positions, segment * 3);
                    const span = distances[segment] - distances[segment - 1];
                    center.lerpVectors(a, b, span > 1e-5 ? (distance - distances[segment - 1]) / span : 1);
                    if (a.sub(b).lengthSq() > 1e-6) tangent.copy(a).normalize();
                }
                // Parallel-transport the ribbon frame instead of keeping it on
                // one cube face. This also avoids twisting at vertical flight.
                side.crossVectors(tangent, normal);
                if (side.lengthSq() < 1e-6) {
                    normal.set(Math.abs(tangent.x) < 0.9 ? 1 : 0, Math.abs(tangent.x) < 0.9 ? 0 : 1, 0);
                    side.crossVectors(tangent, normal);
                }
                side.normalize(); normal.crossVectors(side, tangent).normalize();
                const taper = Math.pow(Math.sin(Math.PI * u), 0.7);
                const ripple = reduced ? 0 : Math.sin(u * 8 - time * 4 + tier * 1.8) * 0.035 * taper;
                const spread = 0.27 + tier * 0.13 + Math.sin(u * Math.PI) * (flying ? 0.3 : 0.12);
                center.addScaledVector(side, flank * (spread + ripple))
                    .addScaledVector(normal, 0.06 + tier * 0.13 + Math.sin(u * Math.PI) * 0.1);
                const width = taper * (flying ? 0.06 : 0.045) * (1 - tier * 0.15);
                const shimmer = reduced ? 0.7 : 0.55 + 0.35 * Math.pow(Math.sin(u * 5 - time * 3 + tier), 2);
                const color = tier === 1 ? mint : pearl;
                for (let edge = 0; edge < 2; edge++) {
                    const v = lane * STRIDE + j * 2 + edge, w = (edge ? 1 : -1) * width;
                    positions.setXYZ(v, center.x + side.x * w, center.y + side.y * w, center.z + side.z * w);
                    colors.setXYZW(v, color.r, color.g, color.b, taper * shimmer);
                }
            }
        }
        geometry.setDrawRange(0, lanes * STEPS * 6);
        positions.needsUpdate = true; colors.needsUpdate = true;
    }
    return { mesh, update };
}
