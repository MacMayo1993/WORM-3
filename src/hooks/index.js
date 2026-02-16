/**
 * WORM³ Custom Hooks
 *
 * Modular hooks for game state management, extracted from App.jsx.
 *
 * Usage:
 *   import { useGameStore, useCubeState, useGameSession } from './hooks';
 *
 * Architecture:
 *   - useGameStore: Zustand store for global state
 *   - useCubeState: Cube manipulation, rotations, flips
 *   - useGameSession: Moves, time, victory tracking
 *   - useAnimation: Animation state and callbacks
 *   - useChaosMode: Chaos cascade and auto-rotate
 *   - useCursor: Keyboard cursor navigation
 *   - useLevelSystem: Level selection and progression
 *   - useSettings: User settings and color schemes
 *   - useKeyboardControls: Keyboard shortcuts
 *   - useHandsMode: Speedcuber-style controls
 *   - useUndo: Undo functionality
 */

// Zustand store
export { useGameStore } from './useGameStore.js';

// Domain hooks
export { useCubeState } from './useCubeState.js';
export { useGameSession } from './useGameSession.js';
export { useAnimation } from './useAnimation.js';
export { useChaosMode } from './useChaosMode.js';
export { useCursor } from './useCursor.js';
export { useLevelSystem } from './useLevelSystem.js';
export { useSettings } from './useSettings.js';
export { useKeyboardControls } from './useKeyboardControls.js';
export { useHandsMode } from './useHandsMode.js';
export { useUndo } from './useUndo.js';
export { useParityDecay } from './useParityDecay.js';
export { useAntipodalIntegrity } from './useAntipodalIntegrity.js';
