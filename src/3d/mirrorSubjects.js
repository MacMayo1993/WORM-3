import { PerspectiveCamera, Scene, WebGLRenderTarget } from 'three';
import { compileDistinct } from './compileDistinct.js';

// What the core's mirror room reflects. Its capture (createCoreMirrorProbe) sees
// only MIRROR_LAYER: the mirrors themselves, the registered subjects (the worm,
// the band being ridden) and every light. Rendering the whole scene into six
// cube faces drew hundreds of objects no mirror can show (the walls are opaque),
// and made every capture frame several times heavier than the frames between.
export const MIRROR_LAYER = 7;

const subjects = new Set();

/** Reflect `object` (and everything under it) in the mirror room. Returns the undo. */
export function addMirrorSubject(object) {
  if (!object) return () => {};
  subjects.add(object);
  return () => removeMirrorSubject(object);
}

export function removeMirrorSubject(object) {
  if (!subjects.delete(object)) return;
  object.traverse(child => child.layers.disable(MIRROR_LAYER));
}

export const mirrorSubjects = () => subjects;

/**
 * Put the subjects and the lights on the mirror layer. Every light goes on it,
 * hidden or not: a light the capture left out would change the light counts in
 * its programs' keys and link a second copy of each one.
 */
export function tagMirrorSubjects(scene, lights = []) {
  lights.length = 0;
  scene.traverse(object => {
    if (object.isLight) { object.layers.enable(MIRROR_LAYER); lights.push(object); }
  });
  for (const subject of subjects) subject.traverse(object => object.layers.enable(MIRROR_LAYER));
  return lights;
}

/**
 * A small render list for the probe. Layers suppress draws, not scene traversal:
 * three still visits every exterior cubie for each of the six reflection views.
 * Borrow only the room, subjects and lights, without reparenting or cloning them.
 * Their original parents supply world transforms; the capture must not update
 * them as children of its identity scene or alter the main view's graph.
 */
export function createMirrorCaptureScene() {
  const capture = new Scene();
  capture.name = 'anticube-mirror-capture';
  capture.matrixWorldAutoUpdate = false;
  const lights = [], roots = new Set();
  const visibleParents = (object, source) => {
    for (let parent = object.parent; parent; parent = parent.parent) {
      if (!parent.visible) return false;
      if (parent === source) return true;
    }
    return false;
  };
  return {
    scene: capture,
    sync(source, room) {
      // Preserve lighting/program keys, background through the openings and any
      // diagnostic material override. These can change after the run warm-up.
      capture.background = source.background;
      capture.backgroundBlurriness = source.backgroundBlurriness;
      capture.backgroundIntensity = source.backgroundIntensity;
      capture.environment = source.environment;
      capture.fog = source.fog;
      capture.overrideMaterial = source.overrideMaterial;
      capture.visible = source.visible;
      tagMirrorSubjects(source, lights);
      roots.clear();
      if (room.visible && visibleParents(room, source)) roots.add(room);
      for (const subject of subjects) {
        if (subject.visible && visibleParents(subject, source)) roots.add(subject);
      }
      for (const light of lights) {
        if (light.visible && visibleParents(light, source)) roots.add(light);
      }
      capture.children.length = 0;
      for (const object of roots) {
        // A registered child or a light within another subject is already drawn.
        let nested = false;
        for (let parent = object.parent; parent; parent = parent.parent) {
          if (roots.has(parent)) { nested = true; break; }
        }
        if (nested) continue;
        if (source.matrixWorldAutoUpdate) object.updateWorldMatrix(true, true);
        capture.children.push(object);
      }
      // Directional/spot targets may live outside the reflected subtrees.
      if (source.matrixWorldAutoUpdate) {
        for (const light of lights) light.target?.updateWorldMatrix(true, false);
      }
      return capture;
    },
    dispose() {
      capture.children.length = 0;
      roots.clear(); lights.length = 0;
    }
  };
}

let warmTarget = null, warmCamera = null;

/**
 * Link the programs the capture draws `objects` with (by default every
 * subject). Drawing into a render target keys a program apart from drawing to
 * the screen (no tone mapping, linear output), so warming only the on-screen
 * variant left the first capture of a run to link one for the worm, the band and
 * the mirrors in the frame the worm dived in.
 */
export function warmMirrorPrograms(renderer, scene, objects = [...subjects]) {
  if (typeof renderer?.compile !== 'function') return;
  tagMirrorSubjects(scene);
  warmTarget ||= new WebGLRenderTarget(1, 1);
  if (!warmCamera) { warmCamera = new PerspectiveCamera(); warmCamera.layers.set(MIRROR_LAYER); }
  const previous = renderer.getRenderTarget?.() ?? null;
  renderer.setRenderTarget?.(warmTarget);
  try {
    for (const object of objects) renderer.compile(object, warmCamera, scene);
  } finally {
    renderer.setRenderTarget?.(previous);
  }
}

/**
 * Link `object`'s programs for drawing into a render target (desktop's AO
 * composer draws the whole surface that way), with `camera`'s lights.
 */
export function compileOffscreen(renderer, object, camera, scene) {
  if (typeof renderer?.compile !== 'function') return;
  warmTarget ||= new WebGLRenderTarget(1, 1);
  const previous = renderer.getRenderTarget?.() ?? null;
  renderer.setRenderTarget?.(warmTarget);
  try { compileDistinct(renderer, object, camera, scene); } finally { renderer.setRenderTarget?.(previous); }
}
