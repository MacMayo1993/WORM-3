// src/worm/healerWorm/RampMarkers.jsx
// Ramp launch pads: a raised block on a tile that reads as a cubie pulled proud of the
// surface, with a base ring and an outward arrow marking "cross here to launch". The
// gameplay lives in wormSim (applyRampAt → startRampLaunch); this is only its picture.
// Like the orbs, each pad rides the live cubie mesh through slice rotations and never
// touches the sticker/heal model.
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { readLiveTile } from '../wormHelpers.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { FACE_NORMALS } from './constants.js';

// Shared geometry — the whole session draws from one set.
const _rampGeos = {
    block: new THREE.BoxGeometry(0.52, 0.30, 0.52),
    ring: new THREE.TorusGeometry(0.40, 0.04, 8, 28),
    arrow: new THREE.ConeGeometry(0.14, 0.26, 4)
};

const RAMP_COLOR = '#ff9d2e'; // rocket amber — this pad fires the rocket

const _rPos = new THREE.Vector3();
const _rNorm = new THREE.Vector3();
const _rUp = new THREE.Vector3(0, 1, 0);
const _rQuat = new THREE.Quaternion();

function RampMarker({ worm, index, size }) {
    const groupRef = useRef();
    const reducedRef = useRef(prefersReducedMotion());

    useFrame((state) => {
        const g = groupRef.current;
        const pad = worm.ramps?.current?.[index];
        if (!g || !pad) return;

        // Anchor to the live cubie mesh so the pad rides a mid-rotation slice; fall back
        // to grid math before the meshes exist.
        if (!readLiveTile(pad, _rPos, _rNorm)) {
            const wp = getStickerWorldPos(pad.x, pad.y, pad.z, pad.dirKey, size, 0);
            _rPos.set(wp[0], wp[1], wp[2]);
            _rNorm.copy(FACE_NORMALS[pad.dirKey] ?? FACE_NORMALS.PZ);
        }
        // Local +Y points out along the face normal, so the block rises off the tile and
        // the arrow points away from the cube.
        _rQuat.setFromUnitVectors(_rUp, _rNorm);
        g.quaternion.copy(_rQuat);
        const bob = reducedRef.current ? 0 : Math.sin(state.clock.elapsedTime * 3 + index) * 0.04;
        g.position.copy(_rPos).addScaledVector(_rNorm, bob);
    });

    return (
        <group ref={groupRef}>
            {/* Base ring flush on the tile */}
            <mesh geometry={_rampGeos.ring} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
                <meshBasicMaterial color={RAMP_COLOR} transparent opacity={0.8} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
            </mesh>
            {/* The "lifted cubie" block, standing proud of the surface */}
            <mesh geometry={_rampGeos.block} position={[0, 0.18, 0]}>
                <meshStandardMaterial color={RAMP_COLOR} emissive={RAMP_COLOR} emissiveIntensity={0.9} roughness={0.35} metalness={0.2} transparent opacity={0.85} toneMapped={false} />
            </mesh>
            {/* Outward launch arrow */}
            <mesh geometry={_rampGeos.arrow} position={[0, 0.52, 0]}>
                <meshBasicMaterial color={'#fff1cf'} transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
            </mesh>
        </group>
    );
}

export function RampMarkers({ worm, size }) {
    // Ramps are fixed for the run (only their tile coords change as slices turn), so the
    // declarative list is rebuilt only when a reset swaps the array — detected by length.
    const [count, setCount] = useState(0);
    useFrame(() => {
        const n = worm.ramps?.current?.length ?? 0;
        if (n !== count) setCount(n);
    });

    return (
        <>
            {Array.from({ length: count }, (_, i) => (
                <RampMarker key={i} worm={worm} index={i} size={size} />
            ))}
        </>
    );
}
