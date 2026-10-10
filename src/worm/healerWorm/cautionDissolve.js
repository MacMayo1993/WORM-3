import { addWormDissolve } from '../../components/intro/introDissolve.js';

// Swap every worm material for a dissolving copy. `restore` puts the live
// materials back; `dispose` frees the copies (and, with them, their programs).
export function patchCautionDissolve(root, uniforms) {
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
    return {
        restore() { for (const { object, original, replacement } of objects) if (object.material === replacement) object.material = original; },
        dispose() { copies.forEach(material => material.dispose()); copies.clear(); }
    };
}

// Borrow the equipped worm's geometry for the death, but isolate every patched
// material. Retry restores live materials and disposes all temporary copies.
export function createCautionDissolve(root, uniforms) {
    const patch = patchCautionDissolve(root, uniforms);
    return () => { patch.restore(); patch.dispose(); };
}

// Compile the death's dissolve programs ahead of it, while the run is calm. The
// copies are swapped in only for the compile and kept (never drawn) so their
// programs stay linked for the real fall; call the result to free them. Skin
// factories keep their compiled shader on the live material for animation, and
// compiling a copy can overwrite that handle, so it is put back afterwards.
export function warmCautionDissolve(renderer, camera, scene, root) {
    if (!root) return () => {};
    const shaders = new Map();
    root.traverse(object => {
        for (const material of [].concat(object.material ?? [])) shaders.set(material, material.userData.shader);
    });
    const uniforms = { uDissolve: { value: 0 }, uDissolveFrame: { value: root.matrixWorld.clone().invert() } };
    const patch = patchCautionDissolve(root, uniforms);
    try { renderer.compile(root, camera, scene); }
    finally {
        patch.restore();
        shaders.forEach((shader, material) => { if (shader) material.userData.shader = shader; else delete material.userData.shader; });
    }
    return patch.dispose;
}
