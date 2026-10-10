import { useLayoutEffect, useMemo, useRef } from 'react';
import { ensureInstanceColor } from '../../3d/instanceUploads.js';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { burrowBridge } from '../burrowBridge.js';
import { liveCubies } from '../liveCubies.js';
import { useGameStore } from '../../hooks/useGameStore.js';
import { resolveColors } from '../../utils/colorSchemes.js';
import { FACE_COLORS } from '../../utils/constants.js';
import { FACE_NORMALS } from './constants.js';

const CAPACITY = 512;
const zAxis = new THREE.Vector3(0, 0, 1);
const white = new THREE.Color('#ffffff');
const edges = [[0, 0.455, 0], [0.455, 0, Math.PI / 2], [0, -0.455, 0], [-0.455, 0, Math.PI / 2]];

// A single instanced draw: the moving seam glow remains readable without bloom
// or particles. Four disappearing edge segments announce a retreat in-world.
export default function BurrowEffects({ size, hidden = false }) {
    const mesh = useRef();
    useLayoutEffect(() => ensureInstanceColor(mesh.current), []);
    const scratch = useMemo(() => ({ dummy: new THREE.Object3D(), center: new THREE.Vector3(),
        normal: new THREE.Vector3(), offset: new THREE.Vector3(), rotation: new THREE.Quaternion(),
        faceRotation: new THREE.Quaternion(), turn: new THREE.Quaternion(), color: new THREE.Color(),
        settings: null, colors: FACE_COLORS }), []);
    useFrame(() => {
        const target = mesh.current;
        if (!target) return;
        target.count = 0;
        const burrows = burrowBridge.current;
        if (hidden || !burrows?.wake.size || liveCubies.size !== size) return;
        const settings = useGameStore.getState().settings;
        if (scratch.settings !== settings) {
            scratch.settings = settings;
            scratch.colors = resolveColors(settings, settings?.biomeMode?.faceAssignment) || FACE_COLORS;
        }
        const { dummy, center, normal, offset, rotation, faceRotation, turn, color } = scratch;
        let count = 0;
        for (const wake of burrows.wake.values()) {
            const piece = liveCubies.refs?.[(wake.x * size + wake.y) * size + wake.z];
            if (!piece) continue;
            const closing = wake.phase === 'closing';
            if (closing && piece.parent?.parent) {
                // The countdown outlines the original surface opening, alongside
                // the caution tape. A mark on the cubie skin would be hidden
                // beneath its raised pad and full-width stalk.
                center.copy(piece.position);
                piece.parent.parent.localToWorld(center);
            } else piece.getWorldPosition(center);
            piece.getWorldQuaternion(rotation);
            normal.copy(FACE_NORMALS[wake.dirKey]).applyQuaternion(rotation);
            center.addScaledVector(normal, 0.525);
            faceRotation.setFromUnitVectors(zAxis, normal);
            color.set(closing ? '#ffc45c' : scratch.colors[wake.sticker.orig] || '#eeeeff');
            color.lerp(white, closing ? 0.2 : 0.55);
            color.multiplyScalar(closing ? 1 : 0.4 + wake.strength * 0.8);
            const segments = closing ? Math.max(1, Math.ceil(wake.remaining * 4)) : 4;
            for (let i = 0; i < segments && count < CAPACITY; i++) {
                const [x, y, angle] = edges[i];
                offset.set(x, y, 0).applyQuaternion(faceRotation);
                dummy.position.copy(center).add(offset);
                dummy.quaternion.copy(faceRotation).multiply(turn.setFromAxisAngle(zAxis, angle));
                dummy.scale.set(closing ? 0.82 : 0.48 + wake.strength * 0.34,
                    wake.phase === 'settling' || closing ? 0.065 : 0.035, 0.025);
                dummy.updateMatrix();
                target.setMatrixAt(count, dummy.matrix);
                target.setColorAt(count++, color);
            }
        }
        target.count = count;
        target.instanceMatrix.needsUpdate = true;
        if (target.instanceColor) target.instanceColor.needsUpdate = true;
    });
    return <instancedMesh ref={mesh} count={0} args={[undefined, undefined, CAPACITY]} frustumCulled={false} raycast={() => null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} depthTest />
    </instancedMesh>;
}
