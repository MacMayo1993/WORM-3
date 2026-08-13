/**
 * wormSlice.js — all worm-mode state, setters and run lifecycle.
 *
 * The original slice, and the template the other slices follow.
 */

import { makeDisparityRuntimeDefaults, makeWormSessionDefaults } from './sessionDefaults.js';
import { persistedState } from './persistedState.js';

const WORM_CHARACTER_KEY = 'worm3_character';

export const createWormSlice = (set, _get) => ({
  // ── Mode flag ─────────────────────────────────────────────────────────────
  wormHealerMode: false,
  setWormHealerMode: (v) => set({ wormHealerMode: v }),

  // ── Config (persists across sessions or set by wizard) ────────────────────
  wormRunId: 0,
  wormSpeed: 2.0,
  setWormSpeed: (v) => set({ wormSpeed: v }),
  wormBoostState: 'ready',
  setWormBoostState: (v) => set({ wormBoostState: v }),
  wormOrbCount: 5,
  setWormOrbCount: (v) => set({ wormOrbCount: Math.max(1, Math.min(144, Math.round(v))) }),
  wormholeInterval: 10,
  setWormholeInterval: (v) => set({ wormholeInterval: Math.max(2, Math.min(30, Number(v))) }),
  wormColor: '#33ff66',
  setWormColor: (v) => set({ wormColor: v || '#33ff66' }),
  wormSkin: persistedState.wormSkin,
  setWormSkin: (id) => {
    try { localStorage.setItem('worm3_skin', id); } catch { }
    set({ wormSkin: id });
  },
  wormHat: persistedState.wormHat,
  setWormHat: (id) => {
    try { localStorage.setItem('worm3_hat', id); } catch { }
    set({ wormHat: id });
  },
  wormTrail: persistedState.wormTrail ?? 'classic',
  setWormTrail: (id) => {
    try { localStorage.setItem('worm3_trail', id); } catch { }
    set({ wormTrail: id });
  },
  wormCharacter: persistedState.wormCharacter ?? 'classic',
  setWormCharacter: (id) => {
    try { localStorage.setItem(WORM_CHARACTER_KEY, id); } catch { }
    set({ wormCharacter: id });
  },
  wormShowTrail: persistedState.wormShowTrail ?? true,
  setWormShowTrail: (v) => {
    try { localStorage.setItem('worm3_show_trail', String(v)); } catch { }
    set({ wormShowTrail: v });
  },

  // ── Controls ──────────────────────────────────────────────────────────────
  wormControlMode: 'non-oriented',
  setWormControlMode: (v) => set({ wormControlMode: v }),
  toggleWormControlMode: () => set((state) => ({
    wormControlMode: state.wormControlMode === 'non-oriented' ? 'oriented' : 'non-oriented'
  })),

  // ── Session state (reset by makeWormSessionDefaults) ──────────────────────
  ...makeWormSessionDefaults(),
  setWormHealedCount: (v) => set({ wormHealedCount: v }),
  setWormPhase: (v) => set({ wormPhase: v }),
  setWormOnFlippedTile: (v) => set({ wormOnFlippedTile: v }),
  setWormBodyTiles: (v) => set({ wormBodyTiles: v }),
  setWormPowerups: (v) => set({ wormPowerups: v }),
  setWormSpecials: (v) => set({ wormSpecials: v }),
  setWormElementalTheme: (v) => set({ wormElementalTheme: v }),
  setWormAlive: (v) => set({ wormAlive: v }),
  setShowWormDeathMenu: (v) => set({ showWormDeathMenu: v }),
  setWormDeathDetails: (v) => set({ wormDeathDetails: v }),
  setWormPaused: (v) => set({ wormPaused: v }),
  setWormTimeAlive: (v) => set({ wormTimeAlive: v }),
  setWormTunnelCount: (v) => set({ wormTunnelCount: v }),
  setWormOrbInventory: (v) => set({ wormOrbInventory: v }),
  setWormHealingProgress: (v) => set({ wormHealingProgress: v }),
  setWormGamePhase: (v) => set({ wormGamePhase: v }),
  setWormCountdownStep: (v) => set({ wormCountdownStep: v }),
  setWormSessionOrbs: (v) => set({ wormSessionOrbs: v }),

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  // Tears down BOTH a disparity round and a worm run — the two share the same
  // runtime fields. Lives in the worm slice because initWormMode is its mirror.
  clearDisparityGame: () => set({
    ...makeDisparityRuntimeDefaults(),
    ...makeWormSessionDefaults(),
    wormHealerMode: false,
  }),
  initWormMode: (flipCap = 9999, _chaosLevel = 0, speed = null, orbCount = null, interval = null, color = null) => set((state) => ({
    ...makeDisparityRuntimeDefaults(),
    ...makeWormSessionDefaults(),
    wormHealerMode: true,
    disparityFlipCap: flipCap,
    chaosLevel: 0,
    wormRunId: (state.wormRunId ?? 0) + 1,
    wormPaused: true,
    wormSpeed: speed !== null ? Math.max(0.5, Math.min(3.5, speed)) : state.wormSpeed,
    wormOrbCount: orbCount !== null ? Math.max(1, Math.min(144, Math.round(orbCount))) : state.wormOrbCount,
    wormholeInterval: interval !== null ? Math.max(2, Math.min(30, Number(interval))) : state.wormholeInterval,
    wormColor: color !== null ? (color || '#33ff66') : state.wormColor,
  })),
});
