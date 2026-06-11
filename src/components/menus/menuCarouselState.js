// Shared carousel-active flag so MenuFlipWave and MenuWormParticle can
// gate their useFrame loops without a circular import back to MainMenu.
let _active = false;
export const setCarouselActive = (v) => { _active = v; };
export const isCarouselActive  = () => _active;
