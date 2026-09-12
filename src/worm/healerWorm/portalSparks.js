import { Vector3 } from 'three';

const right = new Vector3();
const tangent = new Vector3();
const axis = new Vector3(0, 1, 0);

// Analytic bursts need no particle allocation or simulation history. All offsets
// are in the tile's tangent frame, including on the underside of the cube.
export function portalSparkPose(out, origin, normal, time, seed, index, dangerous) {
    const period = dangerous ? 1.05 : 1.15;
    const age = ((time + seed * period) % period + period) % period - index * 0.035;
    const life = dangerous ? 0.95 : 0.8;
    if (age <= 0 || age >= life) return false;
    const p = age / life;
    right.crossVectors(normal, axis);
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    tangent.crossVectors(normal, right).normalize();
    const angle = index * 2.39996 + seed * 6.28318;
    const spread = 0.05 + p * (dangerous ? 0.55 : 0.34);
    const lift = 0.08 + (dangerous ? 2.2 : 1.55) * (2 * p - p * p);
    out.position.fromArray(origin).addScaledVector(normal, lift)
        .addScaledVector(right, Math.cos(angle) * spread)
        .addScaledVector(tangent, Math.sin(angle) * spread);
    out.quaternion.setFromUnitVectors(axis, normal);
    const fade = Math.sin(Math.PI * p);
    const width = (dangerous ? 0.045 : 0.035) * fade;
    out.scale.set(width, (dangerous ? 0.42 : 0.32) * fade, width);
    out.updateMatrix();
    return true;
}
