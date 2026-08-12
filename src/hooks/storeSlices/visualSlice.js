/**
 * visualSlice.js — How the cube is drawn: visual modes, tunnel visibility, explode view, the
 * transient flip-travel FX maps, and the hollow/mirror shader targets.
 *
 * Part of the useGameStore assembly (see src/hooks/useGameStore.js).
 */

export const createVisualSlice = (set, get) => ({
  // ========================================================================
  // VISUAL MODES
  // ========================================================================
  // One of the keys cycled by cycleVisualMode below — keep the two in step.
  visualMode: 'classic',
  flipMode: false,
  showTunnels: false,
  // Tunnel density tier, applied only while showTunnels is true.
  //   'hints' — every active pair is a thin merged cord; full Möbius detail is
  //             reserved for the tunnel the worm is actually traversing.
  //   'full'  — same cords, plus full ribbon detail on the most recent flip
  //             events (capped, see FOCUS_BUDGET in WormholeNetwork).
  // Together with showTunnels this makes the UI toggle three-state:
  // Off → Hints → Full. 'hints' is the default because the old always-on
  // full-detail render was unreadable past a handful of active pairs.
  tunnelDetail: 'hints',
  exploded: false,
  explosionT: 0,
  showNetPanel: false,
  showLeaderboard: false,
  // Picture-in-picture camera parked at the antipodal point of the main one —
  // the "far side" window. Lives in the store (rather than App-local state)
  // so scripted sequences like the demo's view showcase can drive it with the
  // same setters they use for every other view toggle.
  showAntipodalPiP: false,

  setVisualMode: (visualMode) => set(typeof visualMode === 'function'
    ? (state) => ({ visualMode: visualMode(state.visualMode) })
    : { visualMode }),
  setFlipMode: (flipMode) => set(typeof flipMode === 'function'
    ? (state) => ({ flipMode: flipMode(state.flipMode) })
    : { flipMode }),
  setShowTunnels: (showTunnels) => set(typeof showTunnels === 'function'
    ? (state) => ({ showTunnels: showTunnels(state.showTunnels) })
    : { showTunnels }),
  setTunnelDetail: (tunnelDetail) => set({ tunnelDetail }),
  setExploded: (exploded) => set(typeof exploded === 'function'
    ? (state) => ({ exploded: exploded(state.exploded) })
    : { exploded }),
  setExplosionT: (explosionT) => set(typeof explosionT === 'function'
    ? (state) => ({ explosionT: explosionT(state.explosionT) })
    : { explosionT }),
  setShowNetPanel: (showNetPanel) => set(typeof showNetPanel === 'function'
    ? (state) => ({ showNetPanel: showNetPanel(state.showNetPanel) })
    : { showNetPanel }),

  setShowLeaderboard: (showLeaderboard) => set(typeof showLeaderboard === 'function'
    ? (state) => ({ showLeaderboard: showLeaderboard(state.showLeaderboard) })
    : { showLeaderboard }),
  toggleLeaderboard: () => set((state) => ({ showLeaderboard: !state.showLeaderboard })),

  setShowAntipodalPiP: (showAntipodalPiP) => set(typeof showAntipodalPiP === 'function'
    ? (state) => ({ showAntipodalPiP: showAntipodalPiP(state.showAntipodalPiP) })
    : { showAntipodalPiP }),
  toggleAntipodalPiP: () => set((state) => ({ showAntipodalPiP: !state.showAntipodalPiP })),

  toggleFlipMode: () => set((state) => ({ flipMode: !state.flipMode })),
  toggleTunnels: () => set((state) => ({ showTunnels: !state.showTunnels })),
  // Three-state cycle for the Tunnels button: Off → Hints → Full → Off.
  cycleTunnelDetail: () => set((state) => {
    if (!state.showTunnels) return { showTunnels: true, tunnelDetail: 'hints' };
    if (state.tunnelDetail === 'hints') return { tunnelDetail: 'full' };
    return { showTunnels: false, tunnelDetail: 'hints' };
  }),
  toggleExploded: () => set((state) => ({ exploded: !state.exploded })),
  toggleNetPanel: () => set((state) => ({ showNetPanel: !state.showNetPanel })),

  // ========================================================================
  // FLIP TRAVEL FX STATE
  // ========================================================================
  // Per-cubie pop animations: { "x,y,z": { startMs, durationMs } }
  cubiePops: {},
  // Per-tunnel birth (first flip) animations: { pairId: { startMs, durationMs } }
  tunnelBirths: {},
  // Per-tunnel pulse (subsequent flip) animations: { pairId: { startMs, durationMs } }
  tunnelPulses: {},
  // Per-tunnel death animations, fired when a pair reaches FLIP_CAP and is severed.
  // Carries its own endpoint anchors (mesh indices, dirKeys, colours) because by
  // the time this renders the pair is already gone from the tunnel network.
  // { pairId: { startMs, durationMs, meshIdx1, meshIdx2, dirKey1, dirKey2, color1, color2 } }
  tunnelDeaths: {},
  cycleVisualMode: () => set((state) => {
    const modes = ['classic', 'grid', 'sudokube', 'wireframe', 'glass', 'chrome', 'neon', 'gap', 'lego'];
    const idx = modes.indexOf(state.visualMode);
    return { visualMode: modes[(idx + 1) % modes.length] };
  }),

  // ========================================================================
  // HOLLOW VOID CUBE MODE
  // ========================================================================
  hollowMode: false,
  mirrorMode: false,
  parityCurrent: 0,      // 0-1, smoothly lerped
  parityTarget: 0,       // 0 or 1
  chaosCurrent: 0,       // 0-1, smoothly lerped
  chaosTarget: 0,        // 0-1 based on chaosLevel

  randomMode: false,
  setRandomMode: (randomMode) => set({ randomMode }),
  randomStyleTick: 0,
  bumpRandomTick: () => set(s => ({ randomStyleTick: s.randomStyleTick + 1 })),

  setHollowMode: (hollowMode) => set({ hollowMode }),
  toggleHollowMode: () => set((state) => ({ hollowMode: !state.hollowMode })),

  setMirrorMode: (mirrorMode) => set({ mirrorMode }),
  toggleMirrorMode: () => set((state) => ({ mirrorMode: !state.mirrorMode })),

  setParityTarget: (parityTarget) => set({ parityTarget }),
  setChaosTarget: (chaosTarget) => set({ chaosTarget }),
  setParityCurrent: (parityCurrent) => set({ parityCurrent }),
  setChaosCurrent: (chaosCurrent) => set({ chaosCurrent }),

  // Smooth lerp for shader uniforms (called from effects)
  lerpShaderValues: () => {
    const state = get();
    const pLerp = state.parityCurrent + (state.parityTarget - state.parityCurrent) * 0.1;
    const cLerp = state.chaosCurrent + (state.chaosTarget - state.chaosCurrent) * 0.1;
    set({ parityCurrent: pLerp, chaosCurrent: cLerp });
  },
});
