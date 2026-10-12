import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { prefersReducedMotion } from '../../utils/device.js';

class CoilCurve extends THREE.Curve {
    getPoint(t, out = new THREE.Vector3()) {
        const angle = t * Math.PI * 8;
        return out.set(Math.cos(angle) * 0.22, t * 0.58, Math.sin(angle) * 0.22);
    }
}
// Shared, low-poly hardware: no per-frame geometry or particle allocations.
const coil = new THREE.TubeGeometry(new CoilCurve(), 64, 0.037, 6, false);
const cap = new THREE.CylinderGeometry(0.29, 0.29, 0.055, 18);
const arrow = new THREE.ConeGeometry(0.12, 0.18, 4);
const tag = mesh => { if (mesh) mesh.userData.baseOpacity = 1; };
export default function SpringPickup() {
    const stretch = useRef(), top = useRef(), cue = useRef();
    useFrame(({ clock }) => {
        const t = clock.elapsedTime;
        const extension = prefersReducedMotion() ? 1 : 0.72 + 0.3 * (0.5 + 0.5 * Math.sin(t * 6));
        if (stretch.current) stretch.current.scale.y = extension;
        if (top.current) top.current.position.y = 0.58 * extension;
        if (cue.current) cue.current.position.y = 0.58 * extension + 0.17;
    });
    return <group name="spring-pickup" position={[0, -0.25, 0]}>
        <mesh geometry={cap} ref={tag}><meshStandardMaterial color="#ff9e22" emissive="#ff9e22" emissiveIntensity={0.55} metalness={0.55} roughness={0.25} transparent /></mesh>
        <group ref={stretch}><mesh geometry={coil} ref={tag}>
            <meshStandardMaterial color="#fff3ab" emissive="#ffcf40" emissiveIntensity={1.15} metalness={0.65} roughness={0.2} toneMapped={false} transparent />
        </mesh></group>
        <group ref={top} position={[0, 0.58, 0]}><mesh geometry={cap} ref={tag}>
            <meshStandardMaterial color="#ffcf40" emissive="#ffcf40" emissiveIntensity={0.8} metalness={0.5} roughness={0.25} transparent />
        </mesh></group>
        <group ref={cue} position={[0, 0.75, 0]}>{[-0.085, 0.085].map(x => <mesh key={x} geometry={arrow} position={[x, 0, 0]} scale={0.65} ref={tag}>
            <meshBasicMaterial color="#fff6c4" toneMapped={false} transparent />
        </mesh>)}</group>
    </group>;
}
