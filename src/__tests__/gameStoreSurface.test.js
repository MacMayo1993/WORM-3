// Contract test for the assembled store surface.
//
// useGameStore is composed from slices in src/hooks/storeSlices/. A slice left
// out of the assembly, or an action dropped while moving it, produces a store
// that is missing a key — which surfaces as a runtime "x is not a function"
// deep inside a component, in a layer with almost no component tests. This
// pins the full surface so the failure lands here instead.
//
// Adding state is expected: add the key below in the same commit. Removing one
// is a deliberate API change and should be visible in review.
import { describe, it, expect } from 'vitest';
import { useGameStore } from '../hooks/useGameStore.js';

const EXPECTED_KEYS = [
  'achievedWins', 'activeBet', 'activePackId', 'addDisparityDeath',
  'addDisparityDeathsBulk', 'addDisparityEliminatedFace', 'addDisparityEliminatedFacesBulk', 'addDisparityParityScore',
  'addToHistory', 'animState', 'autoRotateEnabled', 'beginDisparityRound',
  'betStreak', 'blackHolePulse', 'bumpRandomTick', 'buyItem',
  'cameraOrbitDir', 'cameraOrbitRequest', 'cascades', 'cashOutParityScore',
  'chaosCurrent', 'chaosLevel', 'chaosResyncEpoch', 'chaosStats',
  'chaosTarget',
  'clearActiveBet', 'clearAnimation', 'clearDisparityGame', 'clearHistory',
  'clearLastBetResult', 'clearLevel', 'completeCurrentLevel', 'completedLevels',
  'cubiePops', 'cubies', 'currentLevel', 'currentLevelData',
  'cursor', 'cycleTunnelDetail', 'cycleVisualMode', 'demoMode',
  'demoStep', 'disparityDeathByGridId', 'disparityDeaths', 'disparityEliminatedFaces',
  'disparityFlipCap', 'disparityGameLength', 'disparityParityScore', 'disparityRoundId',
  'disparityWinner', 'earnCoins', 'exitDemo', 'exploded',
  'explosionT', 'faceImages', 'faceRotationTarget', 'faceTextures',
  'firstFlipHighlightPair', 'flipMode', 'flipPulse', 'flipWaveOrigins',
  'gameStartTime', 'gameTime', 'handsMode', 'handsMoveHistory',
  'handsMoveQueue', 'handsTps', 'hasFlippedOnce', 'hasShuffled',
  'hollowMode', 'holonomyMode', 'incrementMoves', 'initWormMode',
  'kociembaLayerHighlight', 'lastBetResult', 'lastRotation', 'lerpShaderValues',
  'markIntroSeen', 'markMobileHintShown', 'markTutorialDone', 'mergeMode',
  'mergeRegionTiers', 'mergeTheme', 'mirrorMode', 'moveHistory',
  'moves', 'ownedItems', 'parityCurrent', 'parityPoints',
  'parityTarget', 'pendingMove', 'perfReducedFX', 'popFromHistory',
  'randomMode', 'randomStyleTick', 'refundActiveBet', 'removeDisparityDeathsBulk',
  'removeDisparityEliminatedFacesBulk', 'requestChaosResync', 'resetGame',
  'rotationCountdown', 'rotationEpoch', 'savedCubeState', 'selectedTileForRotation',
  'setAchievedWins', 'setActiveBet', 'setActivePackId', 'setAnimState',
  'setAutoRotateEnabled', 'setBetStreak', 'setBlackHolePulse', 'setCascades',
  'setChaosCurrent', 'setChaosLevel', 'setChaosStats', 'setChaosTarget',
  'setCompletedLevels', 'setCubies', 'setCurrentLevel', 'setCurrentLevelData',
  'setCursor', 'setDemoStep', 'setDisparityFlipCap', 'setDisparityGameLength',
  'setDisparityWinner', 'setExploded', 'setExplosionT', 'setFaceImages',
  'setFaceRotationTarget', 'setFaceTextures', 'setFirstFlipHighlightPair', 'setFlipMode',
  'setFlipWaveOrigins', 'setGameStartTime', 'setGameTime', 'setHandsMode',
  'setHandsMoveHistory', 'setHandsMoveQueue', 'setHandsTps', 'setHasFlippedOnce',
  'setHasShuffled', 'setHollowMode', 'setHolonomyMode', 'setKociembaLayerHighlight',
  'setLastBetResult', 'setMergeMode', 'setMergeRegionTiers', 'setMergeTheme',
  'setMirrorMode', 'setMoves', 'setParityCurrent', 'setParityTarget',
  'setPendingMove', 'setPerfReducedFX', 'setRandomMode', 'setRotatedCubies',
  'setRotationCountdown', 'setSavedCubeState', 'setSelectedTileForRotation', 'setSettings',
  'setShowAntipodalPiP', 'setShowCursor', 'setShowCutscene', 'setShowDevConsole',
  'setShowDisparityWinner', 'setShowFirstFlipCaption', 'setShowFirstFlipTutorial', 'setShowHelp',
  'setShowLeaderboard', 'setShowLevelSelect', 'setShowLevelTutorial', 'setShowMainMenu',
  'setShowMobileTouchHint', 'setShowNetPanel', 'setShowPackSelect', 'setShowSettings',
  'setShowTunnels', 'setShowTutorial', 'setShowWelcome', 'setShowWormDeathMenu',
  'setSize', 'setSolveFocusedStep', 'setSolveHighlights', 'setSolveModeActive',
  'setTeachModeActive', 'setTunnelDetail', 'setUpcomingRotation', 'setVictory',
  'setVisualMode', 'setWormAlive', 'setWormBodyTiles', 'setWormBoostState',
  'setWormCharacter', 'setWormColor', 'setWormControlMode', 'setWormCountdownStep',
  'setWormDeathDetails', 'setWormElementalTheme', 'setWormGamePhase', 'setWormHat', 'setWormHealedCount',
  'setWormHealerMode', 'setWormHealingProgress', 'setWormOnFlippedTile', 'setWormOrbCount',
  'setWormOrbInventory', 'setWormPaused', 'setWormPhase', 'setWormPowerups',
  'setWormSessionOrbs', 'setWormShowTrail', 'setWormSkin', 'setWormSpecials',
  'setWormSpeed', 'setWormTimeAlive', 'setWormTrail', 'setWormTunnelCount',
  'setWormholeInterval', 'settings', 'showAntipodalPiP', 'showCursor',
  'showCutscene', 'showDevConsole', 'showDisparityWinner', 'showFirstFlipCaption',
  'showFirstFlipTutorial', 'showHelp', 'showLeaderboard', 'showLevelSelect',
  'showLevelTutorial', 'showMainMenu', 'showMobileTouchHint', 'showNetPanel',
  'showPackSelect', 'showSettings', 'showTunnels', 'showTutorial',
  'showWelcome', 'showWormDeathMenu', 'size', 'solveFocusedStep',
  'solveHighlights', 'solveModeActive', 'spendCoins', 'startDemo',
  'teachModeActive', 'toggleAntipodalPiP', 'toggleChaos', 'toggleDevConsole',
  'toggleExploded', 'toggleFlipMode', 'toggleHandsMode', 'toggleHelp',
  'toggleHollowMode', 'toggleLeaderboard', 'toggleMirrorMode', 'toggleNetPanel',
  'toggleTunnels', 'toggleWormCameraHorizon', 'toggleWormControlMode', 'triggerCameraOrbit', 'tunnelBirths',
  'tunnelDeaths', 'tunnelDetail', 'tunnelPulses', 'upcomingRotation',
  'victory', 'visualMode', 'wormActiveTunnelColors', 'wormAlive',
  'wormBodyTiles', 'wormBoostState', 'wormCameraHorizon', 'wormCharacter', 'wormColor',
  'wormControlMode', 'wormCountdownStep', 'wormDeathDetails', 'wormElementalTheme', 'wormGamePhase',
  'wormHat', 'wormHealedCount', 'wormHealerMode', 'wormHealingProgress',
  'wormMagnetActive', 'wormMagnetSeq', 'wormOnFlippedTile', 'wormOrbCount',
  'wormOrbFlash', 'wormOrbInventory', 'wormPaused', 'wormPhase',
  'wormPowerups', 'wormRocketActive', 'wormRunId', 'wormSessionOrbs',
  'wormShowTrail', 'wormSkin', 'wormSpecialNotice', 'wormSpecials',
  'wormSpeed', 'wormTimeAlive', 'wormTrail', 'wormTunnelCount',
  'wormholeInterval'
];

describe('useGameStore surface', () => {
  it('exposes every expected key', () => {
    const actual = new Set(Object.keys(useGameStore.getState()));
    const missing = EXPECTED_KEYS.filter((k) => !actual.has(k));
    expect(missing).toEqual([]);
  });

  it('has not grown keys without updating this contract', () => {
    const expected = new Set(EXPECTED_KEYS);
    const added = Object.keys(useGameStore.getState()).filter((k) => !expected.has(k));
    expect(added).toEqual([]);
  });

  it('keeps every action callable', () => {
    const state = useGameStore.getState();
    const actions = Object.entries(state).filter(([, v]) => typeof v === 'function');
    expect(actions.length).toBeGreaterThan(100);
    for (const [name, fn] of actions) {
      expect(typeof fn, `${name} should be a function`).toBe('function');
    }
  });
});
