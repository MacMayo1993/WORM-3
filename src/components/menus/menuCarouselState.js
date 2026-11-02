// Shared carousel state bridging the ModeCarousel DOM overlay and the 3D menu
// cube (RotatingBlackCube) without a circular import back to MainMenu.
//
// - active flag: gates MenuFlipWave / MenuWormParticle useFrame loops.
// - face: which cube face the carousel wants presented to the camera
//   ('PZ' | 'NZ' | 'PX' | 'NX' | 'PY' | 'NY' | null). Each mode owns a face;
//   swiping the carousel rotates the physical cube to that mode's face.
// - dive: PLAY triggers a dive THROUGH the active face. The DOM side requests
//   it; the 3D side consumes it, animates, and fires the callback.
let _active = false;
const _listeners = new Set();
export const setCarouselActive = (v) => {
  _active = v;
  _listeners.forEach(fn => fn(v));
};
export const isCarouselActive = () => _active;
export const subscribeCarouselActive = (fn) => {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
};

let _face = null;
const _faceListeners = new Set();
export const setCarouselFace = (dirKey) => {
  _face = dirKey;
  _faceListeners.forEach(fn => fn(dirKey));
};
export const getCarouselFace = () => _face;
export const subscribeCarouselFace = (fn) => {
  _faceListeners.add(fn);
  return () => _faceListeners.delete(fn);
};

// Dive request — single-slot mailbox. The 3D consumer polls once per frame.
let _diveRequest = null; // { onComplete }
export const requestModeDive = (onComplete) => {
  _diveRequest = { onComplete };
};
export const consumeModeDive = () => {
  const d = _diveRequest;
  _diveRequest = null;
  return d;
};

// The dive in flight, published by the cube each frame it runs so the worm can
// leap into the portal and the portal can open: { t, face, reduced } or null.
let _diveState = null;
export const setModeDiveState = (state) => { _diveState = state; };
export const getModeDiveState = () => _diveState;

// What the carousel's paper needs from the rest of the screen, published by
// its owners each frame or change and read by MenuPaperBackdrop: the presented
// mode's look ({ face, color, locked }) from the carousel, and where the cube
// is ({ x, y, z, radius } in world space) from the cube.
let _theme = null;
export const setCarouselTheme = (theme) => { _theme = theme; };
export const getCarouselTheme = () => _theme;
const _cubeFrame = { x: 0, y: 0, z: 0, radius: 0, live: false };
export const setCarouselCubeFrame = (x, y, z, radius) => {
  _cubeFrame.x = x; _cubeFrame.y = y; _cubeFrame.z = z; _cubeFrame.radius = radius; _cubeFrame.live = true;
};
export const clearCarouselCubeFrame = () => { _cubeFrame.live = false; };
export const getCarouselCubeFrame = () => _cubeFrame;

// ─── Cube stage ───────────────────────────────────────────────────────────────
// The measured viewport rectangle of the transparent DOM stage. The cube uses
// this to stay centered and in bounds as controls, disclosures or screens resize.
let _stage = null; // { left, top, width, height } in CSS px
export const setCarouselStage = (stage) => { _stage = stage; };
export const getCarouselStage = () => _stage;

// Switch whole scene branches together. A middle slice can be paused at any
// angle when the selector opens; hiding just its stickers leaves the rotating
// black cubie bodies protruding through the mode plates.
export function presentMenuCube(shufflingCube, modePlates, carouselActive) {
  if (shufflingCube) shufflingCube.visible = !carouselActive;
  if (modePlates) modePlates.visible = carouselActive;
}
