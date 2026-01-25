// src/worm/WormModeGame.jsx
// Complete WORM mode game - wraps all components with shared state
// Supports both surface mode (classic) and tunnel mode (new inside-the-cube mode)

import React, { createContext, useContext, useCallback } from 'react';
import { useWormGame, useTunnelWormGame, WormMode3D, WormGameLoop, TunnelWormGameLoop } from './WormMode.jsx';
import WormHUD from './WormHUD.jsx';
import WormCamera from './WormCamera.jsx';

// Context for sharing game state between Canvas and UI
const WormGameContext = createContext(null);

export function useWormGameContext() {
  return useContext(WormGameContext);
}

// Provider component - place this high in the component tree
// mode: 'surface' (classic) or 'tunnel' (inside the cube through wormholes)
export function WormModeProvider({ children, cubies, size, animState, onRotate, onGameStateChange, mode = 'surface' }) {
  // Use appropriate hook based on mode
  const surfaceGame = useWormGame(cubies, size, animState, onRotate);
  const tunnelGame = useTunnelWormGame(cubies, size, animState, onRotate);
  const game = mode === 'tunnel' ? tunnelGame : surfaceGame;

  // Report game state changes to parent (for UI outside Canvas)
  React.useEffect(() => {
    if (onGameStateChange) {
      onGameStateChange({
        gameState: game.gameState,
        worm: game.worm,
        orbs: game.orbs,
        score: game.score,
        warps: game.warps || 0,
        tunnelsTraversed: game.tunnelsTraversed || 0,
        tunnels: game.tunnels || [],
        speed: game.speed,
        orbsTotal: game.orbsTotal,
        wormCameraEnabled: game.wormCameraEnabled,
        targetTunnelId: game.targetTunnelId || null,
        mode: mode,
        setGameState: game.setGameState,
        setWormCameraEnabled: game.setWormCameraEnabled,
        restart: game.restart
      });
    }
  }, [
    onGameStateChange,
    game.gameState,
    game.worm,
    game.orbs,
    game.score,
    game.warps,
    game.tunnelsTraversed,
    game.tunnels,
    game.speed,
    game.orbsTotal,
    game.wormCameraEnabled,
    game.targetTunnelId,
    game.setGameState,
    game.setWormCameraEnabled,
    game.restart,
    mode
  ]);

  return (
    <WormGameContext.Provider value={game}>
      {children}
    </WormGameContext.Provider>
  );
}

// Canvas elements - render inside Canvas
// Supports both surface and tunnel modes
export function WormModeCanvasElements({ size, explosionFactor, animState, cubies, mode = 'surface' }) {
  const game = useWormGameContext();
  if (!game) return null;

  const isTunnelMode = mode === 'tunnel' || game.mode === 'tunnel';
  const GameLoop = isTunnelMode ? TunnelWormGameLoop : WormGameLoop;

  return (
    <>
      <WormMode3D
        worm={game.worm}
        orbs={game.orbs}
        size={size}
        explosionFactor={explosionFactor}
        gameState={game.gameState}
        mode={isTunnelMode ? 'tunnel' : 'surface'}
        targetTunnelId={game.targetTunnelId}
        tunnels={game.tunnels || []}
      />
      <GameLoop
        cubies={cubies}
        size={size}
        animState={animState}
        game={game}
      />
      {/* First-person worm camera - toggle with 'C' key */}
      <WormCamera
        worm={game.worm}
        moveDir={game.moveDir}
        size={size}
        explosionFactor={explosionFactor}
        enabled={game.wormCameraEnabled}
      />
    </>
  );
}

// HUD elements - render in UI layer
// NOTE: This component tries to use context first, but can also receive props directly
// when rendered outside the WormModeProvider (which is inside Canvas)
export function WormModeHUD({ onQuit, gameData }) {
  const contextGame = useWormGameContext();
  // Use context if available, otherwise fall back to props
  const game = contextGame || gameData;

  if (!game) {
    // No game data available - show minimal HUD
    return (
      <WormHUD
        score={0}
        length={3}
        orbsRemaining={15}
        orbsTotal={15}
        warps={0}
        gameState="playing"
        speed={0.8}
        onPause={() => {}}
        onResume={() => {}}
        onRestart={() => {}}
        onQuit={onQuit}
      />
    );
  }

  const {
    gameState,
    worm,
    orbs,
    score,
    warps,
    tunnelsTraversed,
    speed,
    orbsTotal,
    wormCameraEnabled,
    mode,
    setGameState,
    restart
  } = game;

  const handlePause = useCallback(() => {
    setGameState('paused');
  }, [setGameState]);

  const handleResume = useCallback(() => {
    setGameState('playing');
  }, [setGameState]);

  const isTunnelMode = mode === 'tunnel';

  return (
    <WormHUD
      score={score}
      length={worm.length}
      orbsRemaining={orbs.length}
      orbsTotal={orbsTotal}
      warps={isTunnelMode ? tunnelsTraversed : warps}
      warpsLabel={isTunnelMode ? 'TUNNELS' : 'WARPS'}
      gameState={gameState}
      speed={speed}
      wormCameraEnabled={wormCameraEnabled}
      mode={mode}
      onPause={handlePause}
      onResume={handleResume}
      onRestart={restart}
      onQuit={onQuit}
    />
  );
}

// Start screen overlay with mode selection
export function WormModeStartScreen({ onStart, onCancel }) {
  const [selectedMode, setSelectedMode] = React.useState('surface');
  // Detect mobile/touch device
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  const handleStart = () => {
    onStart(selectedMode);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.content}>
        <h1 style={styles.title}>WORM MODE</h1>
        <p style={styles.subtitle}>Slither across the manifold!</p>

        {/* Mode Selection */}
        <div style={styles.modeSelector}>
          <button
            style={{
              ...styles.modeButton,
              ...(selectedMode === 'surface' ? styles.modeButtonActive : {})
            }}
            onClick={() => setSelectedMode('surface')}
          >
            <div style={styles.modeTitle}>SURFACE</div>
            <div style={styles.modeDesc}>Classic - crawl on cube faces</div>
          </button>
          <button
            style={{
              ...styles.modeButton,
              ...(selectedMode === 'tunnel' ? styles.modeButtonActive : {}),
              ...styles.modeButtonTunnel
            }}
            onClick={() => setSelectedMode('tunnel')}
          >
            <div style={styles.modeTitle}>TUNNEL</div>
            <div style={styles.modeDesc}>NEW - travel inside wormholes!</div>
          </button>
        </div>

        <div style={styles.instructions}>
          <h3 style={styles.instructionsTitle}>
            {selectedMode === 'tunnel' ? 'Tunnel Mode' : 'Surface Mode'}
          </h3>
          <ul style={styles.list}>
            {selectedMode === 'tunnel' ? (
              <>
                <li>Worm travels INSIDE the cube through wormhole tunnels</li>
                <li>Requires flipped stickers to create tunnels</li>
                {isTouchDevice ? (
                  <>
                    <li><strong>Swipe</strong> - Rotate layers to align tunnels</li>
                    <li><strong>📷 button</strong> - Toggle first-person view</li>
                  </>
                ) : (
                  <>
                    <li><strong>WASD/QE</strong> - Rotate to align tunnel exits</li>
                    <li><strong>C</strong> - Toggle first-person worm cam</li>
                  </>
                )}
                <li>Collect orbs floating inside tunnels</li>
                <li>Exit leads to nearest tunnel entrance</li>
              </>
            ) : (
              <>
                <li>The worm auto-advances across cube surfaces</li>
                {isTouchDevice ? (
                  <>
                    <li><strong>Swipe</strong> - Rotate layers to steer</li>
                    <li><strong>Q/E buttons</strong> - Rotate the face</li>
                    <li><strong>📷 button</strong> - Toggle first-person worm cam</li>
                  </>
                ) : (
                  <>
                    <li><strong>WASD</strong> - Rotate layers to steer</li>
                    <li><strong>Q/E</strong> - Rotate the face</li>
                    <li><strong>C</strong> - Toggle first-person worm cam</li>
                  </>
                )}
                <li>Collect glowing orbs to grow longer</li>
                <li>Hit a flipped tile = wormhole teleport!</li>
              </>
            )}
            <li>Don't collide with yourself!</li>
          </ul>
        </div>

        <div style={styles.buttons}>
          <button style={styles.startButton} onClick={handleStart}>
            START {selectedMode.toUpperCase()}
          </button>
          <button style={styles.cancelButton} onClick={onCancel}>
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    fontFamily: "'Courier New', monospace"
  },
  content: {
    textAlign: 'center',
    padding: '40px 60px',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    borderRadius: '16px',
    border: '3px solid #00ff88',
    boxShadow: '0 0 50px rgba(0, 255, 136, 0.3), inset 0 0 30px rgba(0, 255, 136, 0.1)'
  },
  title: {
    fontSize: '48px',
    fontWeight: 'bold',
    color: '#00ff88',
    margin: '0 0 8px 0',
    textShadow: '0 0 30px #00ff88, 0 0 60px #00ff88',
    letterSpacing: '0.2em'
  },
  subtitle: {
    fontSize: '18px',
    color: '#888',
    margin: '0 0 30px 0',
    fontStyle: 'italic'
  },
  instructions: {
    textAlign: 'left',
    background: 'rgba(0, 255, 136, 0.05)',
    padding: '20px 30px',
    borderRadius: '8px',
    marginBottom: '30px'
  },
  instructionsTitle: {
    color: '#00ff88',
    fontSize: '14px',
    margin: '0 0 12px 0',
    letterSpacing: '0.1em'
  },
  list: {
    color: '#aaa',
    fontSize: '13px',
    lineHeight: '1.8',
    margin: 0,
    paddingLeft: '20px'
  },
  buttons: {
    display: 'flex',
    gap: '16px',
    justifyContent: 'center'
  },
  startButton: {
    padding: '16px 40px',
    fontSize: '16px',
    fontFamily: "'Courier New', monospace",
    fontWeight: 'bold',
    color: '#000',
    background: '#00ff88',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    letterSpacing: '0.1em',
    transition: 'all 0.2s ease',
    boxShadow: '0 0 20px rgba(0, 255, 136, 0.5)'
  },
  cancelButton: {
    padding: '16px 40px',
    fontSize: '16px',
    fontFamily: "'Courier New', monospace",
    fontWeight: 'bold',
    color: '#888',
    background: 'transparent',
    border: '2px solid #444',
    borderRadius: '8px',
    cursor: 'pointer',
    letterSpacing: '0.1em',
    transition: 'all 0.2s ease'
  },
  // Mode selector styles
  modeSelector: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    marginBottom: '24px'
  },
  modeButton: {
    flex: 1,
    padding: '16px 20px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '2px solid #444',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center',
    maxWidth: '180px'
  },
  modeButtonActive: {
    borderColor: '#00ff88',
    background: 'rgba(0, 255, 136, 0.15)',
    boxShadow: '0 0 20px rgba(0, 255, 136, 0.3)'
  },
  modeButtonTunnel: {
    // Special styling for tunnel mode button when active is handled via modeButtonActive
  },
  modeTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: '4px',
    letterSpacing: '0.1em'
  },
  modeDesc: {
    fontSize: '11px',
    color: '#888',
    lineHeight: '1.3'
  }
};
