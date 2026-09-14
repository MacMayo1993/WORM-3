// Each transform ancestry is checked once per frame. Only changed local/world
// matrices are recomputed; descendants inherit the parent's version. This sees
// every writer (React, GSAP, flip, tremor, press) without maintaining a second
// list of animation-specific dirty flags that can miss a rotation commit.
export function createWorldTransformTracker() {
    const cache = new WeakMap();
    let frame = 0;
    let version = 0;
    function update(object) {
        let state = cache.get(object);
        if (!state) {
            state = { frame: -1, version: 0, values: [], parent: null, parentVersion: -1 };
            cache.set(object, state);
        }
        if (state.frame === frame) return state.version;
        state.frame = frame;
        const parentVersion = object.parent ? update(object.parent) : 0;
        const p = object.position, q = object.quaternion, s = object.scale;
        let changed = false;
        // No per-frame array allocation. Matrix-driven objects are compared as
        // matrices; regular Object3Ds compare their ten transform components.
        const length = object.matrixAutoUpdate ? 10 : 16;
        for (let i = 0; i < length; i++) {
            const value = !object.matrixAutoUpdate ? object.matrix.elements[i]
                : i < 3 ? (i === 0 ? p.x : i === 1 ? p.y : p.z)
                : i < 7 ? (i === 3 ? q.x : i === 4 ? q.y : i === 5 ? q.z : q.w)
                : (i === 7 ? s.x : i === 8 ? s.y : s.z);
            if (state.values[i] !== value) { state.values[i] = value; changed = true; }
        }
        if (state.auto !== object.matrixAutoUpdate) changed = true;
        state.auto = object.matrixAutoUpdate;
        if (object.matrixWorldAutoUpdate === false) {
            // Explicit world-matrix owners are uncommon; preserve their writes.
            state.version = ++version;
            return state.version;
        }
        if (changed || state.parent !== object.parent || state.parentVersion !== parentVersion) {
            if (changed && object.matrixAutoUpdate) object.updateMatrix();
            if (object.parent) object.matrixWorld.multiplyMatrices(object.parent.matrixWorld, object.matrix);
            else object.matrixWorld.copy(object.matrix);
            object.matrixWorldNeedsUpdate = false;
            state.version = ++version;
        }
        state.parent = object.parent;
        state.parentVersion = parentVersion;
        return state.version;
    }
    return { begin: () => { frame++; }, update };
}
