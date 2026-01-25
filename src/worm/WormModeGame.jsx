// src/worm/WormModeGame.jsx
// Complete WORM mode game - wraps all components with shared state

import React, { createContext, useContext, useCallback } from 'react';
import { useWormGame, WormMode3D, WormGameLoop } from './WormMode.jsx';
import WormHUD from './WormHUD.jsx';
import WormCamera from './WormCamera.jsx';

// Context for sharing game state between Canvas and UI
const WormGameContext = createContext(null);

export function useWormGameContext() {
  return useContext(WormGameContext);
}

// Provider component - place this high in the component tree
export function WormModeProvider({ children, cubies, size, animState, onRotate, onGameStateChange }) {
  const game = useWormGame(cubies, size, animState, onRotate);

  // Report game state changes to parent (for UI outside Canvas)
  React.useEffect(() => {
    if (onGameStateChange) {
      onGameStateChange({
        gameState: game.gameState,
        worm: game.worm,
        orbs: game.orbs,
        score: game.score,
        warps: game.warps,
        speed: game.speed,
        orbsTotal: game.orbsTotal,
        wormCameraEnabled: game.wormCameraEnabled,
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
    game.speed,
    game.orbsTotal,
    game.wormCameraEnabled,
    game.setGameState,
    game.setWormCameraEnabled,
    game.restart
  ]);

  return (
    <WormGameContext.Provider value={game}>
      {children}
    </WormGameContext.Provider>
  );
}

// Canvas elements - render inside Canvas
export function WormModeCanvasElements({ size, explosionFactor, animState, cubies }) {
  const game = useWormGameContext();
  if (!game) return null;

  return (
    <>
      <WormMode3D
        worm={game.worm}
        orbs={game.orbs}
        size={size}
        explosionFactor={explosionFactor}
        gameState={game.gameState}
      />
      <WormGameLoop
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
    speed,
    orbsTotal,
    wormCameraEnabled,
    setGameState,
    restart
  } = game;

  const handlePause = useCallback(() => {
    setGameState('paused');
  }, [setGameState]);

  const handleResume = useCallback(() => {
    setGameState('playing');
  }, [setGameState]);

  return (
    <WormHUD
      score={score}
      length={worm.length}
      orbsRemaining={orbs.length}
      orbsTotal={orbsTotal}
      warps={warps}
      gameState={gameState}
      speed={speed}
      wormCameraEnabled={wormCameraEnabled}
      onPause={handlePause}
      onResume={handleResume}
      onRestart={restart}
      onQuit={onQuit}
    />
  );
}

// Start screen overlay
export function WormModeStartScreen({ onStart, onCancel }) {
  // Detect mobile/touch device
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  return (
    <div style={styles.overlay}>
      <div style={styles.content}>
        <h1 style={styles.title}>WORM MODE</h1>
        <p style={styles.subtitle}>Slither across the manifold!</p>

        <div style={styles.instructions}>
          <h3 style={styles.instructionsTitle}>How to Play</h3>
          <ul style={styles.list}>
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
                <li><strong>C</strong> - Toggle first-person worm cam (trippy!)</li>
              </>
            )}
            <li>Collect glowing orbs to grow longer</li>
            <li>Hit a flipped tile = wormhole teleport!</li>
            <li>Don't collide with yourself!</li>
          </ul>
        </div>

        <div style={styles.buttons}>
          <button style={styles.startButton} onClick={onStart}>
            START GAME
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
  }
};
