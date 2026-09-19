import { Vector3 } from 'three';

const right = new Vector3();
const tangent = new Vector3();
const velocity = new Vector3();
const axis = new Vector3(0, 1, 0);
const fract = x => x - Math.floor(x);
const hash = x => fract(Math.sin(x * 127.1 + 311.7) * 43758.5453);

export const PORTAL_SPARKS = 12;
export const DANGER_SPARKS = 18;

// Analytic jets + tiny fragments. Each burst has fresh deterministic velocities;
// no particle objects, simulation history, timers or per-frame allocations.
export function portalSparkPose(out, origin, normal, time, seed, index, dangerous) {
    const period = dangerous ? 1.02 : 1.25;
    const clock = time + seed * period;
    const cycle = Math.floor(clock / period);
    const age = fract(clock / period) * period - index * 0.014;
    const random = hash(seed * 97 + index * 3.71 + cycle * 13.3);
    const fragment = index % 3 === 2;
    const life = (fragment ? 0.36 : 0.62) + random * 0.24;
    if (age <= 0 || age >= life) return false;
    const p = age / life;
    right.crossVectors(normal, axis);
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    tangent.crossVectors(normal, right).normalize();
    const angle = index * 2.39996 + seed * Math.PI * 2 + random * 0.8;
    const spread = (fragment ? 0.56 : 0.30) + random * 0.38;
    const height = (fragment ? 0.55 : 1.15) + random * (dangerous ? 1.15 : 0.65);
    const radial = 0.10 + p * spread;
    const lift = 0.10 + height * (2 * p - p * p);
    out.position.fromArray(origin).addScaledVector(normal, lift)
        .addScaledVector(right, Math.cos(angle) * radial)
        .addScaledVector(tangent, Math.sin(angle) * radial);
    velocity.copy(normal).multiplyScalar(height * 2 * (1 - p))
        .addScaledVector(right, Math.cos(angle) * spread)
        .addScaledVector(tangent, Math.sin(angle) * spread).normalize();
    out.quaternion.setFromUnitVectors(axis, velocity);
    const fade = Math.min(1, p * 14) * Math.pow(1 - p, 0.65);
    const width = (fragment ? 0.018 : 0.027) * fade;
    const length = (fragment ? 0.08 : 0.23 + random * 0.25) * fade;
    out.scale.set(width, length, width);
    out.userData.life = p;
    out.updateMatrix();
    return true;
}

export const sparkVertexShader = `
    varying float vY;
    varying vec3 vTint;
    void main() {
        vY = position.y + 0.5;
        vTint = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
            vTint = instanceColor;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    }
`;
export const sparkFragmentShader = `
    varying float vY;
    varying vec3 vTint;
    void main() {
        float head = smoothstep(0.3, 0.95, vY);
        float fade = smoothstep(0.0, 0.3, vY);
        // Preserve the status hue through the bright tip, including black fragments.
        vec3 color = vTint * mix(0.75, 1.8, head);
        gl_FragColor = vec4(color, fade);
    }
`;
