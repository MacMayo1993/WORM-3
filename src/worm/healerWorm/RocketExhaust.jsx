import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../hooks/useGameStore.js';
import { wormSegments } from '../wormSegments.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { rocketOrbitT } from './rocketOrbit.js';

const tail = new THREE.Vector3();
const direction = new THREE.Vector3();
const axis = new THREE.Vector3(0, 1, 0);

// Exhaust tapers away from the tail. Longitudinal ripples and pressure diamonds
// read as thrust, while the bright blue-white nozzle stays fixed to the body.
const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;
const fragmentShader = `
    uniform float uTime;
    uniform float uMotion;
    varying vec2 vUv;
    void main() {
        float distance = vUv.y;
        float ripple = sin(distance * 30.0 - uTime * 12.0) * uMotion;
        float diamonds = pow(max(0.0, cos(distance * 23.0)), 8.0);
        vec3 blue = vec3(0.18, 0.58, 1.6);
        vec3 gold = vec3(1.7, 0.53, 0.08);
        vec3 color = mix(blue, gold, smoothstep(0.15, 0.95, distance));
        color += vec3(0.9, 1.1, 1.3) * diamonds * (1.0 - distance);
        float alpha = (1.0 - smoothstep(0.5, 1.0, distance)) * (0.7 + ripple * 0.1);
        gl_FragColor = vec4(color, alpha);
    }
`;

export default function RocketExhaust({ worm }) {
    const group = useRef();
    const time = useRef(0);
    const reducedMotion = prefersReducedMotion();
    const uniforms = useMemo(() => ({ uTime: { value: 0 }, uMotion: { value: 1 } }), []);
    useFrame((_, delta) => {
        if (!group.current) return;
        const state = useGameStore.getState();
        const active = state.wormAlive && worm.rocketActive.current && worm.phase.current === 'crawling';
        group.current.visible = active && wormSegments.tailCount >= 2;
        if (!group.current.visible) return;
        if (!state.wormPaused) time.current += Math.min(delta, 0.05);
        tail.fromArray(wormSegments.tail);
        direction.fromArray(wormSegments.beforeTail).sub(tail).negate();
        if (direction.lengthSq() < 1e-8) { group.current.visible = false; return; }
        direction.normalize();
        group.current.position.copy(tail).addScaledVector(direction, 0.055);
        group.current.quaternion.setFromUnitVectors(axis, direction);
        const throttle = rocketOrbitT(true, worm.rocketT.current, worm.rocketFlight?.current);
        const pulse = reducedMotion ? 1 : 1 + Math.sin(time.current * 10) * 0.02;
        group.current.scale.set(0.7 + throttle * 0.2, (0.2 + throttle * 0.6) * pulse, 0.7 + throttle * 0.2);
        uniforms.uTime.value = time.current;
        uniforms.uMotion.value = reducedMotion ? 0 : 1;
    });
    return <group ref={group} visible={false}>
        <mesh position={[0, 0.65, 0]}>
            <coneGeometry args={[0.14, 1.3, 16, 8, true]} />
            <shaderMaterial uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader}
                transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
            <coneGeometry args={[0.065, 0.44, 12]} />
            <meshBasicMaterial color="#c9f6ff" transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
    </group>;
}
