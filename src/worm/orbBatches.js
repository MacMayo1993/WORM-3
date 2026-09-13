import * as THREE from 'three';

// Batch only opaque parts. Transparent shells, additive rings and patterned
// bands keep their own meshes and Three.js sorting behavior.
export function createOrbBatches(capacity = 256) {
    const group = new THREE.Group();
    group.name = 'ParityOrbOpaqueBatches';
    const batches = new Map();
    const inverse = new THREE.Matrix4();
    const local = new THREE.Matrix4();
    return {
        group,
        begin(root) {
            root.updateWorldMatrix(true, false);
            inverse.copy(root.matrixWorld).invert();
            for (const batch of batches.values()) batch.count = 0;
        },
        add(source) {
            if (!source) return;
            if (source.material.transparent) throw Error('Transparent parity parts must not be instanced');
            const key = `${source.geometry.uuid}:${source.material.uuid}`;
            let batch = batches.get(key);
            if (!batch) {
                const mesh = new THREE.InstancedMesh(source.geometry, source.material, capacity);
                mesh.count = 0;
                mesh.frustumCulled = false; // source orbs were conservatively culled as a group
                mesh.raycast = () => {};
                mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
                batch = { mesh, count: 0 };
                batches.set(key, batch);
                group.add(mesh);
            }
            if (batch.count === capacity) throw Error('Parity batch capacity exceeded');
            local.multiplyMatrices(inverse, source.matrixWorld);
            batch.mesh.setMatrixAt(batch.count++, local);
        },
        end() {
            for (const { mesh, count } of batches.values()) {
                mesh.count = count;
                if (count) mesh.instanceMatrix.needsUpdate = true;
            }
        },
        dispose() {
            for (const { mesh } of batches.values()) mesh.dispose();
            group.clear();
            batches.clear();
        },
    };
}
