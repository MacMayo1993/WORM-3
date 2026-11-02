import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getWormStickerWorldPos as getStickerWorldPos } from '../wormExpansion.js';
import { prefersReducedMotion } from '../../utils/device.js';
import { liveRotation, liveLayerAngle } from '../liveRotation.js';
import { FACE_NORMALS, BODY_BALL_SPACING } from './constants.js';
import { readLiveTile } from '../wormHelpers.js';
import { createTrampolineBatch } from './trampolineModel.js';
import { trampolineCompression } from './trampoline.js';
import { wormBuffs } from '../wormBuffs.js';
import { fusionOf } from './elementalFusion.js';
import { ELEMENTAL_PATCH_LIMIT } from './elementalGameplay.js';
import { patchOpacity, patchVariant } from './elementalFeedback.js';
import { patchVertex, shieldFragment } from './elementalPatchShaders.js';
import { uploadInstancePrefix } from '../../3d/instanceUploads.js';

const Z = new THREE.Vector3(0, 0, 1);
function patchMesh(geometry, fragmentShader) {
    geometry.setAttribute('patchAlpha', new THREE.InstancedBufferAttribute(new Float32Array(ELEMENTAL_PATCH_LIMIT), 1));
    geometry.setAttribute('patchVariant', new THREE.InstancedBufferAttribute(new Float32Array(ELEMENTAL_PATCH_LIMIT), 1));
    geometry.setAttribute('patchCharge', new THREE.InstancedBufferAttribute(new Float32Array(ELEMENTAL_PATCH_LIMIT), 1));
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
        pads: createTrampolineBatch(6 * size * size + ELEMENTAL_PATCH_LIMIT),
        normal: new THREE.Vector3(), axis: new THREE.Vector3(), pose: new THREE.Object3D(),
    }), [size]);
    useEffect(() => () => {
        const mesh = resources.fire;
        mesh.geometry.dispose(); mesh.material.dispose(); mesh.dispose();
        resources.pads.dispose();
    }, [resources]);
    useFrame(() => {
        resources.fire.count = 0; resources.pads.reset();
        let padIndex = 0;
        const reduced = prefersReducedMotion();
        const steam = fusionOf(worm.elementalType?.current, worm.elementalPair?.current, wormBuffs.elementalT) === 'steam';
        for (const patches of [worm.elementalPatches.current, worm.bouncePads?.current]) {
          if (!patches) continue;
          for (const patch of patches.values()) {
            const spring = patch.type === 'grass';
            const { pose, normal, axis } = resources;
            if (!readLiveTile(patch, pose.position, normal)) {
                normal.copy(FACE_NORMALS[patch.dirKey]);
                pose.position.fromArray(getStickerWorldPos(patch.x, patch.y, patch.z, patch.dirKey, size));
                const angle = liveLayerAngle(patch.x, patch.y, patch.z);
                if (angle !== null) {
                    axis.set(liveRotation.axis === 'col' ? 1 : 0, liveRotation.axis === 'row' ? 1 : 0, liveRotation.axis === 'depth' ? 1 : 0);
                    pose.position.applyAxisAngle(axis, angle); normal.applyAxisAngle(axis, angle);
                }
            }
            pose.position.addScaledVector(normal, spring ? 0.01 : 0.07);
            pose.quaternion.setFromUnitVectors(Z, normal);
            pose.scale.setScalar(1); pose.updateMatrix();
            if (spring) {
                const compression = trampolineCompression(patch, worm.stepHistory?.current?.distance ?? 0,
                    Math.max(0, (worm.tailLength?.current ?? 1) - 1) * BODY_BALL_SPACING, reduced);
                resources.pads.put(padIndex++, pose.matrix, compression, patchOpacity(patch.ttl),
                    patch.charged ? 3 : patchVariant(patch, steam));
            } else {
                const mesh = resources.fire, index = mesh.count++;
                mesh.setMatrixAt(index, pose.matrix);
                mesh.geometry.attributes.patchVariant.setX(index, patchVariant(patch, steam));
                mesh.geometry.attributes.patchAlpha.setX(index, patchOpacity(patch.ttl));
                mesh.geometry.attributes.patchCharge.setX(index, patch.charged ? 1 : 0);
            }
          }
        }
        resources.pads.flush();
        // Only the patches drawn this frame (the pool holds ELEMENTAL_PATCH_LIMIT).
        const mesh = resources.fire, { attributes } = mesh.geometry;
        uploadInstancePrefix(mesh.instanceMatrix, mesh.count);
        uploadInstancePrefix(attributes.patchVariant, mesh.count);
        uploadInstancePrefix(attributes.patchAlpha, mesh.count);
        uploadInstancePrefix(attributes.patchCharge, mesh.count);
        // Empty, it would still cost a program selection per pass: hide it.
        mesh.visible = mesh.count > 0;
    });
    return <>{[resources.fire, ...resources.pads.meshes].map(mesh => <primitive key={mesh.uuid} object={mesh} />)}</>;
}
