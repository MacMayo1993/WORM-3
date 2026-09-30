import { addWormDissolve } from '../../components/intro/introDissolve.js';

// Borrow the equipped worm's geometry for the death, but isolate every patched
// material. Retry restores live materials and disposes all temporary copies.
export function createCautionDissolve(root, uniforms) {
    const copies = new Map(), objects = [];
    root?.traverse(object => {
        if (!object.isMesh || !object.material) return;
        const original = object.material;
        const materialFor = source => {
            const key = `${source.uuid}:${!!object.isInstancedMesh}`;
            if (!copies.has(key)) {
                const copy = source.clone();
                copy.onBeforeCompile = source.onBeforeCompile;
                copy.customProgramCacheKey = source.customProgramCacheKey;
                copies.set(key, addWormDissolve(copy, uniforms, !!object.isInstancedMesh));
            }
            return copies.get(key);
        };
        const replacement = Array.isArray(original) ? original.map(materialFor) : materialFor(original);
        objects.push({ object, original, replacement });
        object.material = replacement;
    });
    return () => {
        for (const { object, original, replacement } of objects) if (object.material === replacement) object.material = original;
        copies.forEach(material => material.dispose());
    };
}
