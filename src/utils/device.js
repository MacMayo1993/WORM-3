// Canonical device-detection utilities.
// Evaluated once at module load (suitable for layout decisions that don't need
// to react to window resize — e.g. initial store state, style constants).
// For components that must respond to orientation changes, use a resize listener.
export const isMobile =
  typeof window !== 'undefined' &&
  (window.innerWidth <= 768 || 'ontouchstart' in window || navigator.maxTouchPoints > 0);
