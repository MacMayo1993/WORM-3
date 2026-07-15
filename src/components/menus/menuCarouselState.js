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
