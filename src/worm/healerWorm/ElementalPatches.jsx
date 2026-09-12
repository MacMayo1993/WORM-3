import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { liveRotation, liveLayerAngle } from '../liveRotation.js';
import { FACE_NORMALS } from './constants.js';
import { ELEMENTAL_PATCH_LIMIT } from './elementalGameplay.js';

const Z = new THREE.Vector3(0, 0, 1);
export function ElementalPatches({ worm, size }) {
    const group = useRef();
    const scratch = useMemo(() => ({ normal: new THREE.Vector3(), axis: new THREE.Vector3() }), []);
    useFrame(() => {
        if (!group.current) return;
        let i = 0;
        for (const patch of worm.elementalPatches.current.values()) {
            const mesh = group.current.children[i++];
            if (!mesh) break;
            mesh.visible = true;
            const n = scratch.normal.copy(FACE_NORMALS[patch.dirKey]);
            mesh.position.fromArray(getStickerWorldPos(patch.x, patch.y, patch.z, patch.dirKey, size, 0))
                .addScaledVector(n, 0.055);
            const angle = liveLayerAngle(patch.x, patch.y, patch.z);
            if (angle !== null) {
                scratch.axis.set(liveRotation.axis === 'col' ? 1 : 0, liveRotation.axis === 'row' ? 1 : 0, liveRotation.axis === 'depth' ? 1 : 0);
                mesh.position.applyAxisAngle(scratch.axis, angle);
                n.applyAxisAngle(scratch.axis, angle);
            }
            mesh.quaternion.setFromUnitVectors(Z, n);
            mesh.material.color.set(patch.type === 'fire' ? '#ff8a35' : '#b0ff74');
            mesh.material.opacity = Math.min(0.85, patch.ttl * 0.65);
            mesh.scale.setScalar(patch.type === 'fire' ? 1 : 0.8);
        }
        for (; i < group.current.children.length; i++) group.current.children[i].visible = false;
    });
    return <group ref={group}>{Array.from({ length: ELEMENTAL_PATCH_LIMIT }, (_, i) =>
        <mesh key={i} visible={false}>
            <ringGeometry args={[0.18, 0.38, 8]} />
            <meshBasicMaterial transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
    )}</group>;
}
