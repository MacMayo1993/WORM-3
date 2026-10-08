// Canonical device-detection utilities.
// Evaluated once at module load (suitable for layout decisions that don't need
// to react to window resize — e.g. initial store state, style constants).
// For components that must respond to orientation changes, use a resize listener.
export const isMobile =
  typeof window !== 'undefined' &&
  (window.innerWidth <= 768 || 'ontouchstart' in window || navigator.maxTouchPoints > 0);

// Whether the viewer has asked the OS to reduce motion. Read live (not cached at
// module load) so a mid-session change to the system preference is respected, and
// guarded for SSR/test environments where matchMedia does not exist.
//
// Used by the worm's 3D effects — blinking orbs, magnet attraction streaks — which
// sit outside CSS's reach and so cannot rely on a @media query.
//
// Frame loops call this (every raised cubie, every ticking sticker), so the
// MediaQueryList is made once and its live `.matches` read after that: calling
// matchMedia itself every frame parsed the query anew each time. It is rebuilt only
// if window.matchMedia is replaced (tests stub it).
let reducedMotionQuery = null;
let reducedMotionSource = null;
export const prefersReducedMotion = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  if (reducedMotionSource !== window.matchMedia) {
    reducedMotionSource = window.matchMedia;
    reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  }
  return !!reducedMotionQuery?.matches;
};
