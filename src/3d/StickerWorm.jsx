// src/3d/StickerWorm.jsx
// Worm creature for disparity / wormhole visualization.
// Lies flat on the tile surface and undulates with a travelling sine wave.
// Uses shared module-level geometries so no per-instance GPU allocations occur.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const _wormGeoHead = new THREE.SphereGeometry(0.022, 8, 8);
const _wormGeoSeg1 = new THREE.SphereGeometry(0.018, 6, 6);
const _wormGeoSeg2 = new THREE.SphereGeometry(0.017, 6, 6);
const _wormGeoSeg3 = new THREE.SphereGeometry(0.015, 6, 6);
const _wormGeoTail = new THREE.SphereGeometry(0.011, 6, 6);

const StickerWorm = ({ position, rotation, scale = 1 }) => {
    const headRef = useRef();
    const seg1Ref = useRef();
    const seg2Ref = useRef();
    const seg3Ref = useRef();
    const tailRef = useRef();

    useFrame(({ clock }) => {
        const time = clock.elapsedTime;
        const freq = 3.5;
        const amp = 0.020 * scale;
        const refs = [headRef, seg1Ref, seg2Ref, seg3Ref, tailRef];
        refs.forEach((ref, i) => {
            if (!ref.current) return;
            ref.current.position.y = Math.sin(time * freq - i * 0.70 + rotation) * amp;
        });
    });

    const sp = 0.025 * scale; // spacing between segments along body axis

    return (
        // rotation = angle of this worm's orbit position; +PI/2 = tangent direction.
        <group position={position} rotation={[0, 0, rotation + Math.PI / 2]}>
            <mesh ref={headRef} position={[sp * 2, 0, 0.016]}>
                <primitive object={_wormGeoHead} attach="geometry" />
                <meshBasicMaterial color="#dda15e" />
            </mesh>
            <mesh ref={seg1Ref} position={[sp, 0, 0.015]}>
                <primitive object={_wormGeoSeg1} attach="geometry" />
                <meshBasicMaterial color="#bc6c25" />
            </mesh>
            <mesh ref={seg2Ref} position={[0, 0, 0.015]}>
                <primitive object={_wormGeoSeg2} attach="geometry" />
                <meshBasicMaterial color="#a05c20" />
            </mesh>
            <mesh ref={seg3Ref} position={[-sp, 0, 0.015]}>
                <primitive object={_wormGeoSeg3} attach="geometry" />
                <meshBasicMaterial color="#bc6c25" />
            </mesh>
            <mesh ref={tailRef} position={[-sp * 2, 0, 0.015]}>
                <primitive object={_wormGeoTail} attach="geometry" />
                <meshBasicMaterial color="#a05c20" />
            </mesh>
        </group>
    );
};

export default StickerWorm;
