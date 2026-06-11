// Shared carousel-active flag so MenuFlipWave and MenuWormParticle can
// gate their useFrame loops without a circular import back to MainMenu.
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
