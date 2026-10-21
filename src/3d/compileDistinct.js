import { Group } from 'three';

// renderer.compile walks every object under its root and builds program
// parameters for each one. A 15×15 WORM scene is ~17,000 objects over a few
// hundred materials, and the run's warm-up spent ~130 ms on each pass of it (two
// on desktop) in one frame of the scramble. A program depends on the material,
// the target scene (lights, fog, environment) and only these few things about
// the object and its geometry (WebGLPrograms.getParameters in three r159), so one
// stand-in per combination compiles exactly the same programs.
const EMPTY = [];

function variantOf(object) {
  const geometry = object.geometry;
  if (!geometry) return -1;
  const a = geometry.attributes, m = geometry.morphAttributes;
  return (object.isInstancedMesh ? 1 : 0) | (object.isInstancedMesh && object.instanceColor ? 2 : 0)
    | (object.isBatchedMesh ? 4 : 0) | (object.isPoints ? 8 : 0) | (object.isSkinnedMesh ? 16 : 0)
    | (a.uv1 ? 32 : 0) | (a.uv2 ? 64 : 0) | (a.uv3 ? 128 : 0) | (a.tangent ? 256 : 0)
    | ((a.color?.itemSize ?? 0) << 9)
    | (m.position ? 1 << 12 : 0) | (m.normal ? 1 << 13 : 0) | (m.color ? 1 << 14 : 0);
}

/** One object per program variant under `root`, hidden ones included (as compile does). */
export function distinctProgramObjects(root) {
  const chosen = new Map(), loose = [];
  root.traverse(object => {
    const { material } = object;
    if (!material) return;
    const variant = variantOf(object);
    // Without a geometry there is nothing to compare: keep it as it is.
    if (variant < 0) { loose.push(object); return; }
    for (const m of Array.isArray(material) ? material : [material]) {
      if (!m) continue;
      const key = `${m.id}:${variant}`;
      if (!chosen.has(key)) chosen.set(key, object);
    }
  });
  return [...new Set([...chosen.values(), ...loose])];
}

/**
 * renderer.compile(root, camera, targetScene) over one stand-in per program
 * variant. A stand-in is a shallow copy of its object on the object's own class
 * prototype, with no children, so compile never walks the real subtree again.
 * Never use the live object as the stand-in's prototype (Object.create(object)):
 * V8 gives every object that becomes a prototype a map of its own for good, and a
 * few hundred such meshes left every walk of the scene (updateMatrixWorld,
 * projectObject, the batch trackers) megamorphic, ~3 ms a frame on a 10×10.
 * Nor empty the live objects' children while compiling: compile collects lights
 * by walking targetScene, the live scene, and would miss any under them.
 */
export function compileDistinct(renderer, root, camera, targetScene = root) {
  const holder = new Group();
  holder.children = distinctProgramObjects(root).map(object => {
    const standIn = Object.assign(Object.create(Object.getPrototypeOf(object)), object);
    standIn.children = EMPTY;
    return standIn;
  });
  return renderer.compile(holder, camera, targetScene);
}
