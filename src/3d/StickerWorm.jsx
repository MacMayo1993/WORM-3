// src/3d/StickerWorm.jsx
// Worm creature for disparity / wormhole visualization.
// Lies flat on the tile surface and undulates with a travelling sine wave.
// Uses shared module-level geometries so no per-instance GPU allocations occur.
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const _wormGeoHead = new THREE.SphereGeometry(0.028, 10, 10);
const _wormGeoSeg1 = new THREE.SphereGeometry(0.024, 8, 8);
const _wormGeoSeg2 = new THREE.SphereGeometry(0.022, 8, 8);
const _wormGeoSeg3 = new THREE.SphereGeometry(0.020, 8, 8);
const _wormGeoTail = new THREE.SphereGeometry(0.016, 8, 8);
const _wormGlowGeo = new THREE.SphereGeometry(0.045, 10, 10);

const StickerWorm = ({ position, rotation, scale = 1 }) => {
    const headRef = useRef();
    const seg1Ref = useRef();
    const seg2Ref = useRef();
    const seg3Ref = useRef();
    const tailRef = useRef();

    // One worm rides every disparate tile, so this list was an array literal plus a
    // forEach closure per tile per frame. Built once per mount instead.
    const segRefs = useRef(null);
    if (segRefs.current === null) segRefs.current = [headRef, seg1Ref, seg2Ref, seg3Ref, tailRef];

    useFrame(({ clock }) => {
        const time = clock.elapsedTime;
        const freq = 4.2;
        const amp = 0.028 * scale;
        const refs = segRefs.current;
        for (let i = 0; i < refs.length; i++) {
            const ref = refs[i];
            if (!ref.current) continue;
            ref.current.position.y = Math.sin(time * freq - i * 0.70 + rotation) * amp;
        }
    });

    const sp = 0.034 * scale; // spacing between segments along body axis

    return (
        // rotation = angle of this worm's orbit position; +PI/2 = tangent direction.
        <group position={position} rotation={[0, 0, rotation + Math.PI / 2]}>
            <mesh ref={headRef} position={[sp * 2, 0, 0.026]} renderOrder={4}>
                <primitive object={_wormGeoHead} attach="geometry" />
                <meshBasicMaterial color="#f2c38b" toneMapped={false} />
            </mesh>
            <mesh ref={seg1Ref} position={[sp, 0, 0.024]} renderOrder={4}>
                <primitive object={_wormGeoSeg1} attach="geometry" />
                <meshBasicMaterial color="#dda15e" toneMapped={false} />
            </mesh>
            <mesh ref={seg2Ref} position={[0, 0, 0.023]} renderOrder={4}>
                <primitive object={_wormGeoSeg2} attach="geometry" />
                <meshBasicMaterial color="#bc6c25" toneMapped={false} />
            </mesh>
            <mesh ref={seg3Ref} position={[-sp, 0, 0.022]} renderOrder={4}>
                <primitive object={_wormGeoSeg3} attach="geometry" />
                <meshBasicMaterial color="#a05c20" toneMapped={false} />
            </mesh>
            <mesh ref={tailRef} position={[-sp * 2, 0, 0.021]} renderOrder={4}>
                <primitive object={_wormGeoTail} attach="geometry" />
                <meshBasicMaterial color="#8f4e1b" toneMapped={false} />
            </mesh>

            {/* Soft additive glow so ghost worms read clearly above busy tile art */}
            {[sp * 2, sp, 0, -sp, -sp * 2].map((x, i) => (
                <mesh key={i} position={[x, 0, 0.018]} renderOrder={3}>
                    <primitive object={_wormGlowGeo} attach="geometry" />
                    <meshBasicMaterial
                        color="#ffe6c6"
                        transparent
                        opacity={i === 0 ? 0.24 : 0.14}
                        blending={THREE.AdditiveBlending}
                        depthWrite={false}
                        toneMapped={false}
                    />
                </mesh>
            ))}
        </group>
    );
};

export default StickerWorm;
