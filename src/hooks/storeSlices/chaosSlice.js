/**
 * chaosSlice.js — Chaos cascades, auto-rotation and the camera-orbit request channel.
 *
 * Part of the useGameStore assembly (see src/hooks/useGameStore.js).
 */

export const createChaosSlice = (set, _get) => ({
  // ========================================================================
  // CHAOS MODE STATE
  // ========================================================================
  chaosLevel: 0, // 0 = off, 1-5 = chaos levels
  autoRotateEnabled: false,
  cascades: [],
  upcomingRotation: null,
  rotationCountdown: 0,
  blackHolePulse: 0,
  flipWaveOrigins: [],
  // Screen-space flip echo: { at, color, danger }. Null until the first flip.
  flipPulse: null,
  cameraOrbitRequest: 0,  // epoch — increments each time the user requests a camera orbit
  cameraOrbitDir: null,   // 'cw' | 'ccw'

  triggerCameraOrbit: (dir) => set(state => ({ cameraOrbitDir: dir, cameraOrbitRequest: state.cameraOrbitRequest + 1 })),
  setChaosLevel: (chaosLevel) => set(typeof chaosLevel === 'function'
    ? (state) => ({ chaosLevel: chaosLevel(state.chaosLevel) })
    : { chaosLevel }),
  setAutoRotateEnabled: (autoRotateEnabled) => set({ autoRotateEnabled }),
  setCascades: (cascades) => set(typeof cascades === 'function'
    ? (state) => ({ cascades: cascades(state.cascades) })
    : { cascades }),
  setUpcomingRotation: (upcomingRotation) => set({ upcomingRotation }),
  setRotationCountdown: (rotationCountdown) => set(typeof rotationCountdown === 'function'
    ? (state) => ({ rotationCountdown: rotationCountdown(state.rotationCountdown) })
    : { rotationCountdown }),
  setBlackHolePulse: (blackHolePulse) => set({ blackHolePulse }),
  setFlipWaveOrigins: (flipWaveOrigins) => set({ flipWaveOrigins }),

  toggleChaos: () => set((state) => ({
    chaosLevel: state.chaosLevel === 0 ? 1 : 0
  })),
});
