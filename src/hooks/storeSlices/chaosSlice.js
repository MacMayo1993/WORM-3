/**
 * chaosSlice.js — Chaos cascades, auto-rotation and the camera-orbit request channel.
 *
 * Part of the useGameStore assembly (see src/hooks/useGameStore.js).
 */

import { isChaosSizeSupported } from '../../utils/chaosSetup.js';

export const createChaosSlice = (set, get) => ({
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
  // The first strike: the tile the player picks for chaos to ignite on, as
  // { x, y, z, dirKey, gridId } (see game/chaosIgnition.js). The sim resolves it by
  // gridId, so the unshuffle turns that start at GO cannot move it off target.
  chaosIgnition: null,
  // True while the round waits for that pick — taps choose a tile instead of flipping.
  chaosIgnitionPicking: false,

  triggerCameraOrbit: (dir) => set(state => ({ cameraOrbitDir: dir, cameraOrbitRequest: state.cameraOrbitRequest + 1 })),
  // The wizard caps its own size picker, but the in-game menu and C shortcut
  // can start Chaos on an existing board. Keep that workload limit here too.
  setChaosLevel: (chaosLevel) => set(state => ({
    chaosLevel: isChaosSizeSupported(state.size)
      ? (typeof chaosLevel === 'function' ? chaosLevel(state.chaosLevel) : chaosLevel)
      : 0,
  })),
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
  setChaosIgnition: (chaosIgnition) => set({ chaosIgnition }),
  setChaosIgnitionPicking: (chaosIgnitionPicking) => set({ chaosIgnitionPicking: !!chaosIgnitionPicking }),

  toggleChaos: () => get().setChaosLevel(level => level > 0 ? 0 : 1),
});
