import { PerspectiveCamera, WebGLRenderTarget } from 'three';

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
export function tagMirrorSubjects(scene) {
  scene.traverse(object => { if (object.isLight) object.layers.enable(MIRROR_LAYER); });
  for (const subject of subjects) subject.traverse(object => object.layers.enable(MIRROR_LAYER));
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
  try { renderer.compile(object, camera, scene); } finally { renderer.setRenderTarget?.(previous); }
}
