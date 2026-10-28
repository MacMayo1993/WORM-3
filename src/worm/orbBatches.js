import { uploadInstancePrefix, setInstanceCount } from '../3d/instanceUploads.js';
import * as THREE from 'three';

// Batch only opaque parts. Transparent shells, additive rings and patterned
// bands keep their own meshes and Three.js sorting behavior.
export function createOrbBatches(capacity = 256) {
    const group = new THREE.Group();
    group.name = 'ParityOrbOpaqueBatches';
    const batches = new Map();
    const inverse = new THREE.Matrix4();
    const local = new THREE.Matrix4();
    const batchFor = (geometry, material) => {
        if (material.transparent) throw Error('Transparent parity parts must not be instanced');
        const key = `${geometry.uuid}:${material.uuid}`;
        let batch = batches.get(key);
        if (!batch) {
            const mesh = new THREE.InstancedMesh(geometry, material, capacity);
            mesh.count = 0;
            mesh.frustumCulled = false; // source orbs were conservatively culled as a group
            mesh.raycast = () => {};
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            batch = { mesh, count: 0 };
            batches.set(key, batch);
            group.add(mesh);
        }
        return batch;
    };
    return {
        group,
        begin(root) {
            root.updateWorldMatrix(true, false);
            inverse.copy(root.matrixWorld).invert();
            for (const batch of batches.values()) batch.count = 0;
        },
        add(source) {
            if (!source) return;
            const batch = batchFor(source.geometry, source.material);
            if (batch.count === capacity) throw Error('Parity batch capacity exceeded');
            local.multiplyMatrices(inverse, source.matrixWorld);
            batch.mesh.setMatrixAt(batch.count++, local);
        },
        // Make the batch a part will join when its orb arrives (in its own material,
        // not one it wears while arriving), with no instance yet, so a warm-up can
        // compile the instanced program before anything is drawn.
        prepare(source, material = source?.material) {
            if (source) batchFor(source.geometry, material);
        },
        end() {
            for (const { mesh, count } of batches.values()) {
                setInstanceCount(mesh, count);
                uploadInstancePrefix(mesh.instanceMatrix, count);
            }
        },
        dispose() {
            for (const { mesh } of batches.values()) mesh.dispose();
            group.clear();
            batches.clear();
        },
    };
}
