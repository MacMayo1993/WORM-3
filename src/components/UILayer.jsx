// src/components/UILayer.jsx
/**
 * UILayer — all DOM overlays rendered after the welcome screen dismisses.
 *
 * Reads Zustand store state directly for store-backed fields.
 * Receives hook-derived data and callbacks as props from App.jsx.
 *
 * Props shape:
 *   - Individual data props (metrics, resolvedColors, etc.)
 *   - `ui`       — local useState values from App.jsx
 *   - `handlers` — all callbacks / action functions
 */

import React, { Suspense } from 'react';
import { useGameStore } from '../hooks/useGameStore.js';
import { useShallow } from 'zustand/react/shallow';

// Always-loaded UI components
import TopMenuBar from './menus/TopMenuBar.jsx';
import BottomNavBar from './menus/BottomNavBar.jsx';
import SecondaryModesSheet from './menus/SecondaryModesSheet.jsx';
import FloatingHUD from './menus/FloatingHUD.jsx';
import TileLeaderboard from './menus/TileLeaderboard.jsx';
import MainMenu from './menus/MainMenu.jsx';
import SettingsMenu from './menus/SettingsMenu.jsx';
import HelpMenu from './menus/HelpMenu.jsx';
import MobileControls from './menus/MobileControls.jsx';
import FirstFlipTutorial from './screens/FirstFlipTutorial.jsx';
import RotationPreview from './overlays/RotationPreview.jsx';
import FaceRotationButtons from './overlays/FaceRotationButtons.jsx';
import TileRotationSelector from './overlays/TileRotationSelector.jsx';
import HandsOverlay from './overlays/HandsOverlay.jsx';
import AntipodalHUD from './overlays/AntipodalHUD.jsx';
import AntipodalModeHUD from './overlays/AntipodalModeHUD.jsx';
import EchoRotationIndicator from './overlays/EchoRotationIndicator.jsx';
import DisparityHUD from './overlays/DisparityHUD.jsx';
import HealerWormHUD from './overlays/HealerWormHUD.jsx';
import MobiusHUD from '../worm/MobiusHUD.jsx';
import { isMobile } from '../utils/device.js';

// Lazy-loaded — deferred to reduce initial parse time
const ComingSoonScreen = React.lazy(() => import('./screens/ComingSoonScreen.jsx'));
const MobiusCubeletScreen = React.lazy(() => import('./screens/MobiusCubeletScreen.jsx'));
const VictoryScreen = React.lazy(() => import('./screens/VictoryScreen.jsx'));
const LevelSelectScreen = React.lazy(() => import('./screens/LevelSelectScreen.jsx'));
const Level10Cutscene = React.lazy(() => import('./screens/Level10Cutscene.jsx'));
const LevelTutorial = React.lazy(() => import('./screens/LevelTutorial.jsx'));
const FreeplaySetupWizard = React.lazy(() => import('./screens/FreeplaySetupWizard.jsx'));
const RandomModeSetupWizard = React.lazy(() => import('./screens/RandomModeSetupWizard.jsx'));
const CubeModeSelectScreen = React.lazy(() => import('./screens/CubeModeSelectScreen.jsx'));
const WormModeSetupWizard = React.lazy(() => import('./screens/WormModeSetupWizard.jsx'));
import MobiIntroScreen, { MOBI_LINES_WORM } from './screens/MobiIntroScreen.jsx';
const DisparitySetupWizard = React.lazy(() => import('./screens/DisparitySetupWizard.jsx'));
const MergeThemePicker = React.lazy(() => import('../modes/merge/index.js').then((m) => ({ default: m.MergeThemePicker })));
const DisparityWinnerScreen = React.lazy(() => import('./screens/DisparityWinnerScreen.jsx'));
const DisparityBettingScreen = React.lazy(() => import('./screens/DisparityBettingScreen.jsx'));
const CubeNet = React.lazy(() => import('./CubeNet.jsx'));
const SolveMode = React.lazy(() => import('./SolveMode.jsx'));
const DevConsole = React.lazy(() => import('./menus/DevConsole.jsx'));
const TeachMode = React.lazy(() => import('../teach/TeachMode.jsx'));


export default function UILayer({
  // Hook-derived data (not raw store state)
  metrics,
  resolvedColors,
  faceTextures,
  faceImages,
  settings,
  chaosMode,
  chaosLevel,
  cascades,
  autoRotateEnabled,
  upcomingRotation,
  moveHistory,
  undo,
  canUndo,
  handsMode,
  handsMoveHistory,
  handsTps,
  victory,
  moves,
  gameTime,
  currentLevel,
  currentLevelData,
  antipodalData,
  teachMode,
  performCursorRotation,
  // Local UI state (App.jsx useState values)
  ui,
  // All action callbacks
  handlers,
}) {
  const {
    sheetOpen, setSheetOpen, sheetMode, setSheetMode,
    showFreeplayWizard, showRandomWizard, showWormModeWizard, showCubeModeSelect, showMobiIntro,
    showDisparityWizard, setShowDisparityWizard,
    showDisparityBetting,
    disparityWaitingFirstFlip, disparityCountdown,
    showAntipodalPiP, onToggleAntipodalPiP,
    showComingSoon, onCloseComingSoon,
    showMobiusCubelet, onCloseMobiusCubelet,
  } = ui;

  const {
    onReset, onShuffle, onShuffleForLevel, onChangeSize,
    onSetChaosLevel, onSetAutoRotate, onSetSettings, onFaceImage, onSetVictory,
    onTapFlip, onBackToMainMenu, onLevelSelect, onCutsceneComplete,
    onTutorialClose, onLevelTutorialClose, onNextLevel,
    onPreset, onInstantChaos, onSaveState, onLoadState,
    onMenuPlay, onMenuLevels, onMenuFreeplay, onMenuRandomMode, onMenuCoop, onMenuTeach,
    onMenuSettings, onMenuBiome, onMenuDisparity, onMenuWormHealer, onMenuHolonomy, onMenuMerge, onMenuStore, onMenuComingSoon, onMenuMobiusCubelet,
    showMergeThemePicker, onMergeStart, onMergeCancel,
    onWizardComplete, onWizardCancel, onRandomWizardComplete, onRandomWizardCancel,
    onCubeModeRubiks, onCubeModeDisparity, onCubeModeBack, onDisparitySetupComplete,
    onBetPlaced, onBetSkipped,
    onWormSetupComplete, onMobiIntroComplete, onWormWizardCancel, onWormRetry, onWormNewGame,
    onToggleHandsMode, onFaceRotate, onTileRotation, onTileFaceRotation,
    onVictoryContinue, onVictoryNewGame,
  } = handlers;

  // ── Zustand store reads ──────────────────────────────────────────────────
  // Batched with useShallow so UILayer only re-renders when a value in the
  // group actually changes — not once per selector subscription (previously
  // 46 individual subscriptions, now 5 grouped ones).

  // Core game data — changes on every move
  const { size, cubies } = useGameStore(useShallow(s => ({ size: s.size, cubies: s.cubies })));

  // UI visibility flags — change rarely, batched to minimise subscriptions
  const {
    showMainMenu, showTutorial, showLevelSelect, showSettings, showHelp,
    showFirstFlipTutorial, showCutscene, showLevelTutorial, showNetPanel,
    showLeaderboard, showMobileTouchHint, showDevConsole, solveModeActive,
    showDisparityWinner, wormHealerMode,
  } = useGameStore(useShallow(s => ({
    showMainMenu: s.showMainMenu,
    showTutorial: s.showTutorial,
    showLevelSelect: s.showLevelSelect,
    showSettings: s.showSettings,
    showHelp: s.showHelp,
    showFirstFlipTutorial: s.showFirstFlipTutorial,
    showCutscene: s.showCutscene,
    showLevelTutorial: s.showLevelTutorial,
    showNetPanel: s.showNetPanel,
    showLeaderboard: s.showLeaderboard,
    showMobileTouchHint: s.showMobileTouchHint,
    showDevConsole: s.showDevConsole,
    solveModeActive: s.solveModeActive,
    showDisparityWinner: s.showDisparityWinner,
    wormHealerMode: s.wormHealerMode,
  })));

  // Visual state — change on user preference changes
  const {
    flipMode, visualMode, exploded, showTunnels, hollowMode,
    antipodalIntegrityMode, disparityWinner,
    faceRotationTarget, selectedTileForRotation,
    savedCubeState, solveFocusedStep,
  } = useGameStore(useShallow(s => ({
    flipMode: s.flipMode,
    visualMode: s.visualMode,
    exploded: s.exploded,
    showTunnels: s.showTunnels,
    hollowMode: s.hollowMode,
    antipodalIntegrityMode: s.antipodalIntegrityMode,
    disparityWinner: s.disparityWinner,
    faceRotationTarget: s.faceRotationTarget,
    selectedTileForRotation: s.selectedTileForRotation,
    savedCubeState: s.savedCubeState,
    solveFocusedStep: s.solveFocusedStep,
  })));

  // Store actions — stable references, batched for conciseness
  const {
    setShowLevelSelect, setShowSettings, setShowHelp, setShowFirstFlipTutorial,
    setShowNetPanel, toggleLeaderboard, setFlipMode, setVisualMode,
    setExploded, setShowTunnels, setFaceRotationTarget, setSelectedTileForRotation,
    setShowDevConsole, setSolveModeActive, setSolveFocusedStep, setSolveHighlights,
    setAntipodalIntegrityMode, toggleHollowMode, triggerCameraOrbit,
  } = useGameStore(useShallow(s => ({
    setShowLevelSelect: s.setShowLevelSelect,
    setShowSettings: s.setShowSettings,
    setShowHelp: s.setShowHelp,
    setShowFirstFlipTutorial: s.setShowFirstFlipTutorial,
    setShowNetPanel: s.setShowNetPanel,
    toggleLeaderboard: s.toggleLeaderboard,
    setFlipMode: s.setFlipMode,
    setVisualMode: s.setVisualMode,
    setExploded: s.setExploded,
    setShowTunnels: s.setShowTunnels,
    setFaceRotationTarget: s.setFaceRotationTarget,
    setSelectedTileForRotation: s.setSelectedTileForRotation,
    setShowDevConsole: s.setShowDevConsole,
    setSolveModeActive: s.setSolveModeActive,
    setSolveFocusedStep: s.setSolveFocusedStep,
    setSolveHighlights: s.setSolveHighlights,
    setAntipodalIntegrityMode: s.setAntipodalIntegrityMode,
    toggleHollowMode: s.toggleHollowMode,
    triggerCameraOrbit: s.triggerCameraOrbit,
  })));

  return (
    <>
      <div className="ui-layer">
        {!wormHealerMode && !showMainMenu && <TopMenuBar
          metrics={metrics}
          size={size}
          visualMode={visualMode}
          flipMode={flipMode}
          chaosMode={chaosMode}
          chaosLevel={chaosLevel}
          cubies={cubies}
          faceColors={resolvedColors}
          cascadeCount={cascades.length}
          onShowSettings={() => setShowSettings(true)}
          onHome={onBackToMainMenu}
          currentLevelData={currentLevelData}
          showAntipodalPiP={showAntipodalPiP}
          onToggleAntipodalPiP={onToggleAntipodalPiP}
        />}

        {/* Undo Indicator — desktop only (mobile uses MobileControls) */}
        {moveHistory.length > 0 && !isMobile && (
          <div
            style={{
              position: 'fixed', bottom: '20px', left: '20px',
              background: 'rgba(0, 217, 255, 0.15)', border: '2px solid rgba(0, 217, 255, 0.4)',
              borderRadius: '8px', padding: '8px 16px', color: '#00d9ff',
              fontFamily: "'Courier New', monospace", fontSize: '14px', fontWeight: 'bold',
              zIndex: 100, backdropFilter: 'blur(10px)', cursor: 'pointer',
            }}
            onClick={undo}
            title="Click or press Z to undo"
          >
            Z: Undo ({moveHistory.length})
          </div>
        )}

        {/* Auto-rotate Preview */}
        {autoRotateEnabled && chaosMode && (
          <RotationPreview upcomingRotation={upcomingRotation} size={size} />
        )}

        {/* Floating HUD — auto-fade parity/chaos notifications */}
        {!wormHealerMode && <FloatingHUD metrics={metrics} chaosLevel={chaosLevel} chaosMode={chaosMode} />}

        {/* Disparity HUD — RIP death log + winner announcement */}
        {(!wormHealerMode && (chaosMode || disparityWinner)) && <DisparityHUD />}

        {/* Healer Worm HUD Overlay */}
        <HealerWormHUD onHome={onBackToMainMenu} onSettings={() => setShowSettings(true)} onRetry={onWormRetry} onNewGame={onWormNewGame} />
        {/* Möbius Band HUD — shows topology of active wormhole during tunnel traversal */}
        <MobiusHUD />

        {/* Disparity countdown — 3-2-1-GO overlay before chaos starts */}
        {disparityCountdown !== null && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 8000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div key={disparityCountdown} style={{
              fontSize: disparityCountdown === 'GO!' ? '6rem' : '9rem',
              fontWeight: 900, fontFamily: 'monospace',
              color: disparityCountdown === 'GO!' ? '#22c55e' : '#ef4444',
              textShadow: `0 0 40px ${disparityCountdown === 'GO!' ? '#22c55e' : '#ef4444'}`,
              animation: 'disparity-cd-pop 0.3s cubic-bezier(0.22,1,0.36,1) forwards',
              letterSpacing: '0.02em',
            }}>
              {disparityCountdown}
            </div>
            <style>{`
              @keyframes disparity-cd-pop {
                0%   { transform: scale(1.6); opacity: 0; }
                40%  { transform: scale(0.95); opacity: 1; }
                100% { transform: scale(1); opacity: 0.9; }
              }
            `}</style>
          </div>
        )}

        {/* Disparity Betting Screen — intercepts before chaos starts */}
        {showDisparityBetting && (
          <Suspense fallback={null}>
            <DisparityBettingScreen onBetPlaced={onBetPlaced} onSkip={onBetSkipped} />
          </Suspense>
        )}

        {/* Disparity Winner — cinematic celebration screen */}
        {showDisparityWinner && (
          <Suspense fallback={null}>
            <DisparityWinnerScreen
              onDismiss={() => {
                useGameStore.getState().clearDisparityGame();
                useGameStore.getState().clearLastBetResult();
                useGameStore.getState().setChaosLevel(0);
                setShowDisparityWizard(true);
              }}
            />
          </Suspense>
        )}

        {/* Tile Leaderboard — live flip stats in chaos mode, toggled via Views sheet */}
        <TileLeaderboard cubies={cubies} size={size} chaosMode={chaosMode} visible={showLeaderboard} onClose={toggleLeaderboard} />

        {/* Bottom Navigation Bar */}
        {!wormHealerMode && !showMainMenu && (
          <BottomNavBar
            onReset={onReset}
            onShuffle={currentLevelData ? onShuffleForLevel : onShuffle}
            solveModeActive={solveModeActive}
            teachModeActive={teachMode.active}
            onToggleSolve={() => { setSolveModeActive(!solveModeActive); if (!solveModeActive) setSolveFocusedStep(null); else setSolveHighlights([]); }}
            onToggleTeach={() => { if (teachMode.active) teachMode.exitTeachMode(); else if (size === 3) teachMode.enterTeachMode(); }}
            hasActiveView={exploded || showTunnels || showNetPanel || hollowMode || showLeaderboard}
            onToggleViews={() => { setSheetMode('views'); setSheetOpen(!sheetOpen || sheetMode !== 'views'); }}
            onToggleMore={() => { setSheetMode('more'); setSheetOpen(!sheetOpen || sheetMode !== 'more'); }}
            moreOpen={sheetOpen && sheetMode === 'more'}
            viewsOpen={sheetOpen && sheetMode === 'views'}
          />
        )}
      </div>

      {/* Secondary Modes Bottom Sheet */}
      {!wormHealerMode && !showMainMenu && <SecondaryModesSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        mode={sheetMode}
        flipMode={flipMode}
        onToggleFlip={() => { if (!currentLevelData || currentLevelData.features.flips) setFlipMode(!flipMode); }}
        flipLocked={!!(currentLevelData && !currentLevelData.features.flips)}
        chaosMode={chaosMode}
        chaosLevel={chaosLevel}
        onToggleChaos={() => { if (!currentLevelData || currentLevelData.features.chaos) onSetChaosLevel(l => l > 0 ? 0 : 1); }}
        onSetChaosLevel={onSetChaosLevel}
        chaosLocked={!!(currentLevelData && !currentLevelData.features.chaos)}
        maxChaosLevel={currentLevelData?.chaosLevel || 5}
        autoRotateEnabled={autoRotateEnabled}
        onToggleAutoRotate={() => onSetAutoRotate(!autoRotateEnabled)}
        showTunnels={showTunnels}
        onToggleTunnels={() => { if (!currentLevelData || currentLevelData.features.tunnels) setShowTunnels(!showTunnels); }}
        tunnelsLocked={!!(currentLevelData && !currentLevelData.features.tunnels)}
        exploded={exploded}
        onToggleExplode={() => { if (!currentLevelData || currentLevelData.features.explode) setExploded(!exploded); }}
        explodeLocked={!!(currentLevelData && !currentLevelData.features.explode)}
        showNetPanel={showNetPanel}
        onToggleNet={() => { if (!currentLevelData || currentLevelData.features.net) setShowNetPanel(!showNetPanel); }}
        netLocked={!!(currentLevelData && !currentLevelData.features.net)}
        hollowMode={hollowMode}
        onToggleHollow={toggleHollowMode}
        visualMode={visualMode}
        onCycleVisualMode={setVisualMode}
        size={size}
        onChangeSize={(n) => { if (!currentLevelData) onChangeSize(n); }}
        sizeLocked={!!currentLevelData}
        handsMode={handsMode}
        onToggleHands={onToggleHandsMode}
        antipodalIntegrityMode={antipodalIntegrityMode}
        onToggleIntegrity={() => setAntipodalIntegrityMode(!antipodalIntegrityMode)}
        showLeaderboard={showLeaderboard}
        onToggleLeaderboard={toggleLeaderboard}
        currentLevelData={currentLevelData}
        onShowLevels={() => { setShowLevelSelect(true); setSheetOpen(false); }}
        onFreeplay={() => { useGameStore.getState().clearLevel(); setSheetOpen(false); }}
      />}

      {/* Level Badge */}
      {currentLevelData && !wormHealerMode && !showMainMenu && !showLevelSelect && !victory && (
        <div className="level-badge">
          <span className="level-badge-number">{currentLevel}</span>
          <span className="level-badge-name">{currentLevelData.name}</span>
        </div>
      )}

      {showMainMenu && (
        <MainMenu
          onPlay={onMenuPlay}
          onLevels={onMenuLevels}
          onFreeplay={onMenuFreeplay}
          onRandom={onMenuRandomMode}
          onCoop={onMenuCoop}
          onTeach={onMenuTeach}
          onSettings={onMenuSettings}
          onBiome={onMenuBiome}
          onDisparity={onMenuDisparity}
          onWormHealer={onMenuWormHealer}
          onHolonomy={onMenuHolonomy}
          onMerge={onMenuMerge}
          onStore={onMenuStore}
          onComingSoon={onMenuComingSoon}
          onMobiusCubelet={onMenuMobiusCubelet}
        />
      )}

      {showComingSoon && (
        <Suspense fallback={null}>
          <ComingSoonScreen onBack={onCloseComingSoon} />
        </Suspense>
      )}

      {showMobiusCubelet && (
        <Suspense fallback={null}>
          <MobiusCubeletScreen onBack={onCloseMobiusCubelet} />
        </Suspense>
      )}

      {showLevelSelect && (
        <Suspense fallback={null}>
          <LevelSelectScreen onSelectLevel={onLevelSelect} onBack={onBackToMainMenu} />
        </Suspense>
      )}

      {showSettings && (
        <SettingsMenu
          onClose={() => setShowSettings(false)}
          settings={settings}
          onSettingsChange={onSetSettings}
          faceImages={faceImages}
          onFaceImage={onFaceImage}
        />
      )}

      {showCubeModeSelect && (
        <Suspense fallback={null}>
          <CubeModeSelectScreen
            onRubiks={onCubeModeRubiks}
            onDisparity={onCubeModeDisparity}
            onBack={onCubeModeBack}
          />
        </Suspense>
      )}

      {showFreeplayWizard && (
        <Suspense fallback={null}>
          <FreeplaySetupWizard onComplete={onWizardComplete} onCancel={onWizardCancel} initialSettings={settings} />
        </Suspense>
      )}

      {showRandomWizard && (
        <Suspense fallback={null}>
          <RandomModeSetupWizard onComplete={onRandomWizardComplete} onCancel={onRandomWizardCancel} initialSettings={settings} />
        </Suspense>
      )}

      {showWormModeWizard && (
        <Suspense fallback={null}>
          <WormModeSetupWizard onComplete={onWormSetupComplete} onCancel={onWormWizardCancel} initialSettings={settings} />
        </Suspense>
      )}

      {showMobiIntro && (
        <MobiIntroScreen
          lines={MOBI_LINES_WORM}
          modeName="WORM MODE"
          accentColor="#33ff66"
          onComplete={onMobiIntroComplete}
        />
      )}

      {showMergeThemePicker && (
        <Suspense fallback={null}>
          <MergeThemePicker onStart={onMergeStart} onBack={onMergeCancel} />
        </Suspense>
      )}

      {showDisparityWizard && (
        <Suspense fallback={null}>
          <DisparitySetupWizard
            onStart={onDisparitySetupComplete}
            onCancel={() => { setShowDisparityWizard(false); useGameStore.getState().setShowMainMenu(true); }}
          />
        </Suspense>
      )}

      {/* Disparity "tap to begin" hint */}
      {disparityWaitingFirstFlip && (
        <div style={{
          position: 'fixed', bottom: '110px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 500, pointerEvents: 'none',
          fontFamily: "-apple-system, 'Helvetica Neue', Roboto, sans-serif",
        }}>
          <div style={{
            background: 'rgba(0,0,0,0.78)', borderRadius: '14px', padding: '14px 22px',
            textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(10px)', whiteSpace: 'nowrap',
          }}>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#fff', marginBottom: '3px' }}>
              Tap any tile to begin
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
              Your chosen tile starts the disparity cascade
            </div>
          </div>
        </div>
      )}

      {showHelp && <HelpMenu onClose={() => setShowHelp(false)} />}

      {showFirstFlipTutorial && (
        <FirstFlipTutorial
          onClose={() => setShowFirstFlipTutorial(false)}
          onMainMenu={() => { setShowFirstFlipTutorial(false); onBackToMainMenu(); }}
        />
      )}

      {solveModeActive && (
        <Suspense fallback={null}>
          <SolveMode
            cubies={cubies} size={size}
            onClose={() => { setSolveModeActive(false); setSolveHighlights([]); }}
            onHighlightChange={setSolveHighlights}
            focusedStep={solveFocusedStep} onFocusStep={setSolveFocusedStep}
          />
        </Suspense>
      )}

      {teachMode.active && (
        <Suspense fallback={null}>
          <TeachMode
            analysis={teachMode.analysis}
            stages={teachMode.stages}
            methodName={teachMode.methodName}
            subMode={teachMode.subMode}
            onSwitchSubMode={teachMode.switchSubMode}
            selectedAlgo={teachMode.selectedAlgo}
            algoMoves={teachMode.algoMoves}
            currentStep={teachMode.currentStep}
            isPlaying={teachMode.isPlaying}
            canExecute={teachMode.canExecute}
            isAlgoComplete={teachMode.isAlgoComplete}
            whyOpen={teachMode.whyOpen}
            onToggleWhy={() => teachMode.setWhyOpen(v => !v)}
            quizOptions={teachMode.quizOptions}
            quizAnswered={teachMode.quizAnswered}
            quizHintShown={teachMode.quizHintShown}
            onSelectAlgorithm={teachMode.selectAlgorithm}
            onExecuteStep={teachMode.executeStep}
            onToggleAutoPlay={teachMode.toggleAutoPlay}
            onResetAlgorithm={teachMode.resetAlgorithm}
            onAnswerQuiz={teachMode.answerQuiz}
            onRetryQuiz={teachMode.retryQuiz}
            onClose={teachMode.exitTeachMode}
          />
        </Suspense>
      )}

      {victory && (
        <Suspense fallback={null}>
          <VictoryScreen
            winType={victory} moves={moves} time={gameTime}
            onContinue={onVictoryContinue} onNewGame={onVictoryNewGame}
            currentLevel={currentLevel} levelData={currentLevelData}
            onNextLevel={onNextLevel} hasNextLevel={currentLevel && currentLevel < 10}
            onMainMenu={() => { onSetVictory(null); onBackToMainMenu(); }}
          />
        </Suspense>
      )}

      {showCutscene && currentLevel === 10 && (
        <Suspense fallback={null}>
          <Level10Cutscene onComplete={onCutsceneComplete} onSkip={onCutsceneComplete} />
        </Suspense>
      )}

      {showLevelTutorial && currentLevelData && (
        <Suspense fallback={null}>
          <LevelTutorial
            level={currentLevelData}
            onClose={onTutorialClose}
            onMainMenu={() => { onLevelTutorialClose(); onBackToMainMenu(); }}
          />
        </Suspense>
      )}

      {showNetPanel && (
        <Suspense fallback={null}>
          <CubeNet
            cubies={cubies} size={size} onTapFlip={onTapFlip} flipMode={flipMode}
            onClose={() => setShowNetPanel(false)} faceColors={resolvedColors} faceTextures={faceTextures}
          />
        </Suspense>
      )}

      {isMobile && !wormHealerMode && !showTutorial && !showMainMenu && (
        <MobileControls
          onShowSettings={() => setShowSettings(true)} onShowHelp={() => setShowHelp(true)}
          flipMode={flipMode} onToggleFlip={() => setFlipMode(!flipMode)}
          exploded={exploded} onToggleExplode={() => setExploded(!exploded)}
          showTunnels={showTunnels} onToggleTunnels={() => setShowTunnels(!showTunnels)}
          onShuffle={onShuffle} onReset={onReset}
          showNetPanel={showNetPanel} onToggleNet={() => setShowNetPanel(!showNetPanel)}
          onRotateCW={() => {
            if (faceRotationTarget) onFaceRotate('cw');
            else if (selectedTileForRotation && !flipMode) onTileFaceRotation('cw');
            else performCursorRotation('cw');
          }}
          onRotateCCW={() => {
            if (faceRotationTarget) onFaceRotate('ccw');
            else if (selectedTileForRotation && !flipMode) onTileFaceRotation('ccw');
            else performCursorRotation('ccw');
          }}
          onUndo={undo} canUndo={canUndo} undoCount={moveHistory.length}
          teachModeActive={teachMode.active}
          onToggleTeachMode={() => { if (teachMode.active) teachMode.exitTeachMode(); else teachMode.enterTeachMode(); }}
          cubeSize={size}
          onOrbitCW={() => triggerCameraOrbit('cw')}
          onOrbitCCW={() => triggerCameraOrbit('ccw')}
        />
      )}

      {showMobileTouchHint && !showTutorial && !showMainMenu && (
        <div className="mobile-touch-hint">Swipe to rotate • Tap tile for options</div>
      )}

      {faceRotationTarget && !isMobile && (
        <FaceRotationButtons
          onRotateCW={() => onFaceRotate('cw')}
          onRotateCCW={() => onFaceRotate('ccw')}
          onCancel={() => setFaceRotationTarget(null)}
        />
      )}

      {selectedTileForRotation && !flipMode && !isMobile && (
        <TileRotationSelector
          onRotate={onTileRotation}
          onRotateFaceCW={() => onTileFaceRotation('cw')}
          onRotateFaceCCW={() => onTileFaceRotation('ccw')}
          onCancel={() => setSelectedTileForRotation(null)}
        />
      )}

      {handsMode && !wormHealerMode && (
        <HandsOverlay
          recentMoves={handsMoveHistory}
          lastMove={handsMoveHistory.length > 0 ? handsMoveHistory[handsMoveHistory.length - 1] : null}
          tps={handsTps}
        />
      )}

      {antipodalIntegrityMode && !wormHealerMode && (
        <AntipodalHUD
          integrity={antipodalData.integrity}
          preserved={antipodalData.preserved}
          total={antipodalData.total}
          regime={antipodalData.regime}
          kStar={antipodalData.kStar}
          onClose={() => setAntipodalIntegrityMode(false)}
        />
      )}

      {!wormHealerMode && <AntipodalModeHUD />}
      {!wormHealerMode && <EchoRotationIndicator />}

      {showDevConsole && (
        <Suspense fallback={null}>
          <DevConsole
            onClose={() => setShowDevConsole(false)}
            onPreset={onPreset} onSaveState={onSaveState} onLoadState={onLoadState}
            hasSavedState={!!savedCubeState} size={size}
            onJumpToLevel={onLevelSelect} onInstantChaos={onInstantChaos}
            moveHistory={moveHistory}
          />
        </Suspense>
      )}

      <RandomStyleFlash />
    </>
  );
}

function RandomStyleFlash() {
  const tick = useGameStore(s => s.randomStyleTick);
  if (tick === 0) return null;
  return (
    <div
      key={tick}
      style={{
        position: 'fixed', inset: 0, zIndex: 9990, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.18) 0%, rgba(180,120,255,0.10) 45%, transparent 72%)',
        animation: 'randomFlash 0.5s ease-out forwards',
      }}
    />
  );
}
