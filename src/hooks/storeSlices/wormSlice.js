import { ACCESSORY_SLOTS, EMPTY_ACCESSORIES, getAccessory } from '../../worm/handmadeAccessoriesData.js';
import { characterXpMultiplier } from '../../worm/characterAbilities.js';
import { WORM_CHARACTERS } from '../../worm/wormCharacterData.js';
import { storyLevel, storyUnlocked } from '../../worm/story/levels.js';
import { storyVisualChanges } from '../../worm/story/worlds.js';
import { completeStoryChanges, claimStoryChanges } from '../../worm/story/rewards.js';
import { createXpRun, wormMultiplier } from '../../progression/model.js';
import { wormMissionChanges } from '../../worm/wormEventChanges.js';
import { startMission, readMissionCount } from '../../worm/missions.js';
import { MAX_WORM_ORBS } from '../../worm/wormDifficulty.js';
/**
 * wormSlice.js — all worm-mode state, setters and run lifecycle.
 *
 * The original slice, and the template the other slices follow.
 */

import { makeDisparityRuntimeDefaults, makeWormSessionDefaults } from './sessionDefaults.js';
import { persistedState } from './persistedState.js';

const WORM_CHARACTER_KEY = 'worm3_character';

export const createWormSlice = (set, get) => ({
  // ── Mode flag ─────────────────────────────────────────────────────────────
  wormHealerMode: false,
  wormStoryVisualBase: null,
  wormStoryViewBase: null,
  applyWormStoryLook: id => set(s => id !== null && !storyUnlocked(s.playerProgress, id) ? s : storyVisualChanges(s, id)),
  startWormStory: () => set(s => s.wormHealerMode && s.wormStoryLevel && s.wormStoryReady && s.wormAlive && !s.wormStoryResult && s.wormGamePhase === 'active' && !s.wormPauseMenuOpen ? { wormStoryStarted: true, wormPaused: false } : s),
  completeWormStory: (runId, metrics) => set(s => completeStoryChanges(s, runId, metrics)),
  claimWormStoryReward: (id, choice) => set(s => claimStoryChanges(s, id, choice)),
  setWormHealerMode: (v) => set(s => ({ wormHealerMode: v, ...(!v ? storyVisualChanges(s, null) : {}) })),

  // ── Config (persists across sessions or set by wizard) ────────────────────
  wormRunId: 0,
  wormMissionsCompleted: readMissionCount(),
  recordWormMission: (kind, total, faceId, runId) => set(state => wormMissionChanges(state, kind, total, faceId, runId) ?? state),
  wormSpeed: 2.0,
  setWormSpeed: (v) => set(s => s.wormStoryLevel ? s : { wormSpeed: v }),
  wormBoostState: 'ready',
  setWormBoostState: (v) => set({ wormBoostState: v }),
  wormOrbCount: 5,
  setWormOrbCount: (v) => set({ wormOrbCount: Math.max(1, Math.min(MAX_WORM_ORBS, Math.round(v))) }),
  wormholeInterval: 10,
  setWormholeInterval: (v) => set({ wormholeInterval: Math.max(2, Math.min(30, Number(v))) }),
  wormColor: '#33ff66',
  setWormColor: (v) => set({ wormColor: v || '#33ff66' }),
  wormSkin: persistedState.wormSkin,
  setWormSkin: (id) => {
    try { localStorage.setItem('worm3_skin', id); } catch { }
    set({ wormSkin: id });
  },
  wormAccessories: persistedState.wormAccessories ?? EMPTY_ACCESSORIES,
  setWormAccessory: (slot, id) => {
    if (!ACCESSORY_SLOTS.includes(slot)) return false;
    const item = getAccessory(id);
    if (id !== 'none' && (item?.slot !== slot || (!get().demoMode && !get().ownedItems.includes(`accessory_${id}`)))) return false;
    const equipment = { ...EMPTY_ACCESSORIES, ...get().wormAccessories, [slot]: id };
    try { localStorage.setItem('worm3_accessories', JSON.stringify(equipment)); } catch { }
    set({ wormAccessories: equipment });
    return true;
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
    if (!WORM_CHARACTERS.some(c => c.id === id) || (!get().ownedItems.includes(`character_${id}`) && !get().demoMode)) return false;
    try { localStorage.setItem(WORM_CHARACTER_KEY, id); } catch { }
    set({ wormCharacter: id });
  },
  // Nothing writes this any more: the painted route is parked (see
  // WormTrail.jsx's TRAIL_PAINTING_ENABLED), so the wizard no longer offers the
  // toggle. Kept wired, and kept persisted, so whatever a save already holds
  // survives and the switch works the day the trail comes back as a pickup.
  wormShowTrail: persistedState.wormShowTrail ?? true,
  setWormShowTrail: (v) => {
    try { localStorage.setItem('worm3_show_trail', String(v)); } catch { }
    set({ wormShowTrail: v });
  },

  // Which way is up while crawling. 'face' builds the camera's roll from the face
  // the worm is on, 'level' from world Y. See WormChaseCamera for why this is a
  // choice at all: a world-up camera has to flip its up vector under the cube and
  // has no defined roll when the view lines up with that axis.
  wormCameraHorizon: persistedState.wormCameraHorizon ?? 'face',
  toggleWormCameraHorizon: () => set((state) => {
    const next = state.wormCameraHorizon === 'face' ? 'level' : 'face';
    try { localStorage.setItem('worm3_camera_horizon', next); } catch { }
    return { wormCameraHorizon: next };
  }),

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
  clearDisparityGame: () => set(state => ({
    ...storyVisualChanges(state, null),
    xpRun: null,
    ...makeDisparityRuntimeDefaults(),
    ...makeWormSessionDefaults(),
    wormHealerMode: false,
  })),
  initWormMode: (flipCap = 9999, _chaosLevel = 0, speed = null, orbCount = null, interval = null, color = null, combat = false, enemies = true, storyId = null) => set((state) => storyId !== null && !storyUnlocked(state.playerProgress, storyId) ? state : ({
    ...storyVisualChanges(state, storyId),
    ...makeDisparityRuntimeDefaults(),
    ...makeWormSessionDefaults(),
    wormHealerMode: true,
    wormStoryLevel: storyId,
    wormCombatMode: combat === true && !state.demoMode && !storyId,
    wormEnemiesEnabled: storyId ? !!storyLevel(storyId).mechanics?.kills : enemies !== false,
    xpRun: state.demoMode || combat || storyId ? null : createXpRun('worm', (state.wormRunId ?? 0) + 1, state.playerProgress.xp, {
      multiplier: wormMultiplier(speed ?? state.wormSpeed, interval ?? state.wormholeInterval) * characterXpMultiplier(state.wormCharacter),
      character: state.wormCharacter,
    }),
    wormMission: state.demoMode || combat || storyId ? null : startMission(state.wormMissionsCompleted, (state.wormRunId ?? 0) + 1, {}, { recent: state.playerProgress.recentGoals || [] }),
    disparityFlipCap: flipCap,
    chaosLevel: 0,
    wormRunId: (state.wormRunId ?? 0) + 1,
    wormPaused: true,
    wormSpeed: storyId ? storyLevel(storyId).speed : speed !== null ? Math.max(0.5, Math.min(3.5, speed)) : state.wormSpeed,
    wormOrbCount: orbCount !== null ? Math.max(1, Math.min(MAX_WORM_ORBS, Math.round(orbCount))) : state.wormOrbCount,
    wormholeInterval: interval !== null ? Math.max(2, Math.min(30, Number(interval))) : state.wormholeInterval,
    wormColor: color !== null ? (color || '#33ff66') : state.wormColor,
  })),
});
