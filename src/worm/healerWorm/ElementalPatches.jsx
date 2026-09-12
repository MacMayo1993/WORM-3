import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getStickerWorldPos } from '../../game/coordinates.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { liveRotation, liveLayerAngle } from '../liveRotation.js';
import { FACE_NORMALS } from './constants.js';
import { ELEMENTAL_PATCH_LIMIT } from './elementalGameplay.js';
import { patchOpacity, springStretch } from './elementalFeedback.js';
import { patchVertex, shieldFragment, springFragment } from './elementalPatchShaders.js';

const Z = new THREE.Vector3(0, 0, 1);
class SpringCurve extends THREE.Curve {
    getPoint(t, target = new THREE.Vector3()) {
        const angle = t * Math.PI * 5;
        return target.set(Math.cos(angle) * 0.21, Math.sin(angle) * 0.21, 0.04 + t * 0.3);
    }
}
function patchMesh(geometry, fragmentShader) {
    geometry.setAttribute('patchAlpha', new THREE.InstancedBufferAttribute(new Float32Array(ELEMENTAL_PATCH_LIMIT), 1));
    const material = new THREE.ShaderMaterial({ vertexShader: patchVertex, fragmentShader, transparent: true,
        depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(geometry, material, ELEMENTAL_PATCH_LIMIT);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    return mesh;
}
export function ElementalPatches({ worm, size }) {
    const resources = useMemo(() => ({
        fire: patchMesh(new THREE.PlaneGeometry(0.88, 0.88), shieldFragment),
        grass: patchMesh(new THREE.TubeGeometry(new SpringCurve(), 40, 0.035, 5, false), springFragment),
        normal: new THREE.Vector3(), axis: new THREE.Vector3(), pose: new THREE.Object3D(),
    }), []);
    useEffect(() => () => {
        for (const mesh of [resources.fire, resources.grass]) {
            mesh.geometry.dispose(); mesh.material.dispose(); mesh.dispose();
        }
    }, [resources]);
    useFrame(() => {
        resources.fire.count = resources.grass.count = 0;
        const reduced = prefersReducedMotion();
        for (const patch of worm.elementalPatches.current.values()) {
            const mesh = patch.type === 'fire' ? resources.fire : resources.grass;
            const index = mesh.count++;
            const { pose, normal, axis } = resources;
            normal.copy(FACE_NORMALS[patch.dirKey]);
            pose.position.fromArray(getStickerWorldPos(patch.x, patch.y, patch.z, patch.dirKey, size, 0))
                .addScaledVector(normal, 0.07);
            const angle = liveLayerAngle(patch.x, patch.y, patch.z);
            if (angle !== null) {
                axis.set(liveRotation.axis === 'col' ? 1 : 0, liveRotation.axis === 'row' ? 1 : 0, liveRotation.axis === 'depth' ? 1 : 0);
                pose.position.applyAxisAngle(axis, angle); normal.applyAxisAngle(axis, angle);
            }
            pose.quaternion.setFromUnitVectors(Z, normal);
            pose.scale.set(1, 1, patch.type === 'grass' ? springStretch(patch.ttl, reduced) : 1);
            pose.updateMatrix(); mesh.setMatrixAt(index, pose.matrix);
            mesh.geometry.attributes.patchAlpha.setX(index, patchOpacity(patch.ttl));
        }
        for (const mesh of [resources.fire, resources.grass]) {
            mesh.instanceMatrix.needsUpdate = true;
            mesh.geometry.attributes.patchAlpha.needsUpdate = true;
        }
    });
    // R3F never auto-disposes primitives. Keep the actual mesh disposal method
    // intact for our explicit geometry/material/instance cleanup above.
    return <><primitive object={resources.fire} /><primitive object={resources.grass} /></>;
}
