// src/worm/healerWorm/TerrainMarkers.jsx
// The surface features that give a run its texture: turbo pads, one-way turn arrows,
// and slip (ice) patches. Each is a flat marker laid on a tile — it rides the live
// cubie mesh through slice rotations exactly like the orbs do, and never touches the
// sticker/heal model. The gameplay lives in wormSim (applyTerrainAt); this is only its
// picture.
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { readLiveTile } from '../wormHelpers.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { FACE_NORMALS } from './constants.js';

// One flat triangle pointing +Y in its local XY plane (normal +Z), reused for the
// turbo chevrons and the turn arrowhead.
function triangle(halfW, halfH) {
    const s = new THREE.Shape();
    s.moveTo(-halfW, -halfH);
    s.lineTo(halfW, -halfH);
    s.lineTo(0, halfH);
    s.closePath();
    return new THREE.ShapeGeometry(s);
}

// Shared geometry — the whole session draws from one set.
const _terrGeos = {
    ring: new THREE.TorusGeometry(0.34, 0.05, 8, 28),
    rimThin: new THREE.TorusGeometry(0.40, 0.03, 8, 28),
    disc: new THREE.CircleGeometry(0.40, 28),
    chevron: triangle(0.17, 0.13),
    arrow: triangle(0.19, 0.2),
};

const TERRAIN_LOOK = {
    turbo: '#ff8a1e', // hot orange — "go faster"
    turn: '#ffd23f',  // signal yellow — "this way"
    slip: '#9fe4ff'   // pale ice blue
};

const _tPos = new THREE.Vector3();
const _tNorm = new THREE.Vector3();
const _tZ = new THREE.Vector3(0, 0, 1);
const _tQuat = new THREE.Quaternion();
const SURFACE_PROUD = 0.06; // sit just off the sticker so it reads as paint on the tile

function TerrainMarker({ worm, index, size, type, dir }) {
    const groupRef = useRef();
    const reducedRef = useRef(prefersReducedMotion());
    const color = TERRAIN_LOOK[type] ?? '#ffffff';

    useFrame((state) => {
        const g = groupRef.current;
        const marker = worm.terrain?.current?.[index];
        if (!g || !marker) return;

        // Anchor to the live cubie mesh so the marker rides a mid-rotation slice; fall
        // back to grid math before the meshes exist.
        if (!readLiveTile(marker, _tPos, _tNorm)) {
            const wp = getStickerWorldPos(marker.x, marker.y, marker.z, marker.dirKey, size, 0);
            _tPos.set(wp[0], wp[1], wp[2]);
            _tNorm.copy(FACE_NORMALS[marker.dirKey] ?? FACE_NORMALS.PZ);
        }
        g.position.copy(_tPos).addScaledVector(_tNorm, SURFACE_PROUD);
        // Lay the marker flat: local +Z becomes the outward face normal.
        _tQuat.setFromUnitVectors(_tZ, _tNorm);
        g.quaternion.copy(_tQuat);

        if (!reducedRef.current) {
            const t = state.clock.elapsedTime;
            // Turbo throbs fast and eager; ice shimmers slowly; arrows sit steady.
            const rate = type === 'turbo' ? 6 : type === 'slip' ? 2 : 3.4;
            const amp = type === 'turn' ? 0.04 : 0.09;
            g.scale.setScalar(1 + amp * Math.sin(t * rate + index));
        }
    });

    let visual;
    if (type === 'turbo') {
        visual = (
            <>
                <mesh geometry={_terrGeos.ring}>
                    <meshBasicMaterial color={color} transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
                </mesh>
                {[0.10, -0.12].map((y, i) => (
                    <mesh key={i} geometry={_terrGeos.chevron} position={[0, y, 0.001]}>
                        <meshBasicMaterial color={color} transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
                    </mesh>
                ))}
            </>
        );
    } else if (type === 'turn') {
        // Arrowhead points sideways in the turn direction; a stem leads up into it.
        const sign = dir === 'right' ? -1 : 1; // +Y triangle rotated ∓90° → points ±X
        visual = (
            <>
                <mesh geometry={_terrGeos.rimThin}>
                    <meshBasicMaterial color={color} transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
                </mesh>
                <mesh geometry={_terrGeos.arrow} rotation={[0, 0, sign * Math.PI / 2]} position={[sign * 0.14, 0, 0.001]}>
                    <meshBasicMaterial color={color} transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
                </mesh>
                <mesh position={[sign * -0.12, 0, 0.001]}>
                    <boxGeometry args={[0.24, 0.09, 0.002]} />
                    <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
                </mesh>
            </>
        );
    } else {
        // Slip: a frosty translucent patch with a bright rim. Not additive — it should
        // read as cold glass over the tile rather than a glow.
        visual = (
            <>
                <mesh geometry={_terrGeos.disc}>
                    <meshBasicMaterial color={color} transparent opacity={0.32} depthWrite={false} toneMapped={false} />
                </mesh>
                <mesh geometry={_terrGeos.rimThin}>
                    <meshBasicMaterial color={'#e8fbff'} transparent opacity={0.75} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
                </mesh>
            </>
        );
    }

    return <group ref={groupRef}>{visual}</group>;
}

export function TerrainMarkers({ worm, size }) {
    // Terrain is fixed for the run (only its tile coords change, as slices turn), so the
    // declarative list is rebuilt only when a reset swaps the array — detected by a cheap
    // signature. Each marker then tracks its own live coordinates in useFrame.
    const [list, setList] = useState([]);
    const sigRef = useRef('');

    useFrame(() => {
        const terr = worm.terrain?.current ?? [];
        const sig = `${terr.length}|${terr.map((m) => m.type + (m.dir ?? '')).join(',')}`;
        if (sig === sigRef.current) return;
        sigRef.current = sig;
        setList(terr.map((m, i) => ({ index: i, type: m.type, dir: m.dir })));
    });

    return (
        <>
            {list.map((m) => (
                <TerrainMarker key={m.index} worm={worm} index={m.index} size={size} type={m.type} dir={m.dir} />
            ))}
        </>
    );
}
