// src/3d/ParityBreakthrough.jsx
// Persistent "parity breaking through" effect for flipped tiles.
// Square glow fills the full cubie face so the original color's light shines
// outward through the black grid lines. Intensity scales with flip count.
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sharedTremorState } from './styles/TileStyleMaterials.jsx';

// Shared geometries — one set allocated at module level, reused across all instances.
const _pbBackGlowGeo = new THREE.PlaneGeometry(0.84, 0.84);
const _pbThroughGlowGeo = new THREE.PlaneGeometry(0.82, 0.82);
const _pbEdgeHGeo = new THREE.PlaneGeometry(0.84, 0.08);
const _pbEdgeVGeo = new THREE.PlaneGeometry(0.08, 0.84);
const _pbCrackGeos = [
    new THREE.PlaneGeometry(0.38, 0.018),
    new THREE.PlaneGeometry(0.42, 0.016),
    new THREE.PlaneGeometry(0.34, 0.017),
    new THREE.PlaneGeometry(0.36, 0.015),
    new THREE.PlaneGeometry(0.24, 0.014),
    new THREE.PlaneGeometry(0.28, 0.013),
    new THREE.PlaneGeometry(0.20, 0.012),
    new THREE.PlaneGeometry(0.22, 0.012),
];

const _PB_CRACKS_BASE = [
    { pos: [0.12, 0.40, 0.004], rot: 0.08, geoIdx: 0 },
    { pos: [-0.08, -0.39, 0.004], rot: -0.12, geoIdx: 1 },
    { pos: [0.39, 0.06, 0.004], rot: 1.52, geoIdx: 2 },
    { pos: [-0.38, -0.05, 0.004], rot: 1.62, geoIdx: 3 },
];
const _PB_CRACKS_L2 = [
    { pos: [0.22, -0.18, 0.004], rot: 0.75, geoIdx: 4 },
    { pos: [-0.18, 0.24, 0.004], rot: -0.6, geoIdx: 5 },
];
const _PB_CRACKS_L3 = [
    { pos: [0.05, 0.12, 0.004], rot: 1.1, geoIdx: 6 },
    { pos: [-0.1, -0.15, 0.004], rot: -0.9, geoIdx: 7 },
];
const _PB_GRID_EDGES = [
    { pos: [0, 0.44, -0.005], horiz: true },
    { pos: [0, -0.44, -0.005], horiz: true },
    { pos: [0.44, 0, -0.005], horiz: false },
    { pos: [-0.44, 0, -0.005], horiz: false },
];

const ParityBreakthrough = ({ origColor, flipCount }) => {
    const backGlowRef = useRef();
    const throughGlowRef = useRef();
    const cracksRef = useRef([]);
    const edgesRef = useRef([]);

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        const intensity = Math.min(0.4 + flipCount * 0.25, 1.5);
        const surge = sharedTremorState.surge;

        if (backGlowRef.current) {
            backGlowRef.current.material.opacity = (0.2 + surge * 0.5) * intensity;
            const s = 1.0 + surge * 0.08;
            backGlowRef.current.scale.set(s, s, 1);
        }
        if (throughGlowRef.current) {
            throughGlowRef.current.material.opacity = surge * 0.25 * intensity;
        }
        edgesRef.current.forEach((ref) => {
            if (!ref) return;
            ref.material.opacity = (0.15 + surge * 0.55) * intensity;
        });
        cracksRef.current.forEach((ref, i) => {
            if (!ref) return;
            const crackPulse = Math.pow(Math.max(0, Math.sin(t * 2.0 + i * 1.3)), 3.0);
            ref.material.opacity = (0.08 + crackPulse * 0.5 + surge * 0.35) * intensity;
        });
    });

    const cracks = useMemo(() => {
        const base = [..._PB_CRACKS_BASE];
        if (flipCount >= 2) base.push(..._PB_CRACKS_L2);
        if (flipCount >= 3) base.push(..._PB_CRACKS_L3);
        return base;
    }, [flipCount]);

    return (
        <group>
            <mesh ref={backGlowRef} position={[0, 0, -0.018]}>
                <primitive object={_pbBackGlowGeo} attach="geometry" />
                <meshBasicMaterial color={origColor} transparent opacity={0.2}
                    blending={THREE.AdditiveBlending} side={THREE.FrontSide} depthWrite={false} />
            </mesh>

            {_PB_GRID_EDGES.map((edge, i) => (
                <mesh key={`edge-${i}`} ref={el => edgesRef.current[i] = el} position={edge.pos}>
                    <primitive object={edge.horiz ? _pbEdgeHGeo : _pbEdgeVGeo} attach="geometry" />
                    <meshBasicMaterial color={origColor} transparent opacity={0.15}
                        blending={THREE.AdditiveBlending} side={THREE.FrontSide} depthWrite={false} />
                </mesh>
            ))}

            <mesh ref={throughGlowRef} position={[0, 0, 0.002]}>
                <primitive object={_pbThroughGlowGeo} attach="geometry" />
                <meshBasicMaterial color={origColor} transparent opacity={0}
                    blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>

            {cracks.map((crack, i) => (
                <mesh key={i} ref={el => cracksRef.current[i] = el} position={crack.pos} rotation={[0, 0, crack.rot]}>
                    <primitive object={_pbCrackGeos[crack.geoIdx]} attach="geometry" />
                    <meshBasicMaterial color={origColor} transparent opacity={0.08}
                        blending={THREE.AdditiveBlending} depthWrite={false} />
                </mesh>
            ))}
        </group>
    );
};

export default ParityBreakthrough;
