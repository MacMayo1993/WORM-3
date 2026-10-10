// Each transform ancestry is checked once per frame. Only changed local/world
// matrices are recomputed; descendants inherit the parent's version. This sees
// every writer (React, GSAP, flip, tremor, press) without maintaining a second
// list of animation-specific dirty flags that can miss a rotation commit.
//
// This runs for every tile, tile accessory and WORM body each frame (thousands of
// objects on a 10×10), so the comparison reads each property once into a local:
// Object3D subclasses make `object.position` and friends megamorphic, and the
// earlier loop re-read them per component, which made it the frame's top cost.
export function createWorldTransformTracker() {
    const cache = new WeakMap();
    let frame = 0;
    let version = 0;
    function stateOf(object) {
        let state = cache.get(object);
        if (state === undefined) {
            state = { frame: -1, version: 0, values: new Float64Array(16).fill(NaN), auto: null, parent: null, parentVersion: -1,
                visibleFrame: -1, visible: true };
            cache.set(object, state);
        }
        return state;
    }
    function update(object) {
        const state = stateOf(object);
        if (state.frame === frame) return state.version;
        state.frame = frame;
        const parent = object.parent;
        const parentVersion = parent ? update(parent) : 0;
        const auto = object.matrixAutoUpdate;
        const v = state.values;
        // No per-frame allocation. Matrix-driven objects are compared as matrices;
        // regular Object3Ds compare their ten transform components.
        let changed = state.auto !== auto;
        if (auto) {
            const p = object.position, q = object.quaternion, s = object.scale;
            const px = p.x, py = p.y, pz = p.z, qx = q.x, qy = q.y, qz = q.z, qw = q.w, sx = s.x, sy = s.y, sz = s.z;
            if (v[0] !== px || v[1] !== py || v[2] !== pz || v[3] !== qx || v[4] !== qy || v[5] !== qz || v[6] !== qw
                || v[7] !== sx || v[8] !== sy || v[9] !== sz) {
                v[0] = px; v[1] = py; v[2] = pz; v[3] = qx; v[4] = qy; v[5] = qz; v[6] = qw; v[7] = sx; v[8] = sy; v[9] = sz;
                changed = true;
            }
        } else {
            const e = object.matrix.elements;
            for (let i = 0; i < 16; i++) if (v[i] !== e[i]) { v[i] = e[i]; changed = true; }
        }
        state.auto = auto;
        if (object.matrixWorldAutoUpdate === false) {
            // Explicit world-matrix owners are uncommon; preserve their writes.
            state.version = ++version;
            return state.version;
        }
        if (changed || state.parent !== parent || state.parentVersion !== parentVersion) {
            if (changed && auto) object.updateMatrix();
            if (parent) object.matrixWorld.multiplyMatrices(parent.matrixWorld, object.matrix);
            else object.matrixWorld.copy(object.matrix);
            object.matrixWorldNeedsUpdate = false;
            state.version = ++version;
        }
        state.parent = parent;
        state.parentVersion = parentVersion;
        return state.version;
    }
    // Whether the object and every ancestor are visible this frame, from the same
    // per-object cache (one lookup instead of a second map rebuilt every frame).
    function visible(object) {
        if (!object) return true;
        const state = stateOf(object);
        if (state.visibleFrame === frame) return state.visible;
        state.visibleFrame = frame;
        state.visible = object.visible && visible(object.parent);
        return state.visible;
    }
    return { begin: () => { frame++; }, update, visible };
}
