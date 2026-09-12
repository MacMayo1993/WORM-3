import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { liveRotation } from '../liveRotation.js';
import { FACE_NORMALS } from './constants.js';
import { jumpLandingTile } from './jumpLanding.js';

const Z = new THREE.Vector3(0, 0, 1);
export function JumpLandingMarker({ worm, size }) {
    const marker = useRef();
    useFrame(() => {
        const mesh = marker.current;
        if (!mesh) return;
        mesh.visible = worm.phase.current === 'crawling' && worm.isJumping.current
            && !liveRotation.active && !worm.restRead.current;
        if (!mesh.visible) return;
        const tile = jumpLandingTile(worm.pos.current, worm.moveDir.current, size,
            worm.interpT.current, worm.jumpT.current, worm.jumpSpan.current);
        const normal = FACE_NORMALS[tile.dirKey];
        mesh.position.fromArray(getStickerWorldPos(tile.x, tile.y, tile.z, tile.dirKey, size, 0))
            .addScaledVector(normal, 0.045);
        mesh.quaternion.setFromUnitVectors(Z, normal);
        mesh.scale.setScalar(0.8 + 0.2 * (1 - worm.jumpT.current));
    });
    return <mesh ref={marker} visible={false}>
        <ringGeometry args={[0.26, 0.32, 32]} />
        <meshBasicMaterial color="#fff4b0" transparent opacity={0.85} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>;
}
