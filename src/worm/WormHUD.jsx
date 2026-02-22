// src/worm/WormHUD.jsx
// HUD overlay for WORM mode - score, length, orbs, status

import React from 'react';

export default function WormHUD({
  score,
  length,
  orbsRemaining,
  orbsTotal,
  warps,
  warpsLabel = 'WARPS', // 'WARPS' for surface mode, 'TUNNELS' for tunnel mode
  gameState, // 'playing', 'paused', 'gameover', 'victory'
  speed,
  wormCameraEnabled = false,
  mode = 'surface', // 'surface' or 'tunnel'
  onPause: _onPause,
  onResume,
  onRestart,
  onQuit
}) {
  const isTunnelMode = mode === 'tunnel';
  const isPlaying = gameState === 'playing';
  const isGameOver = gameState === 'gameover';
  const isVictory = gameState === 'victory';
  const isPaused = gameState === 'paused';

  return (
    <div className="worm-hud" style={styles.container}>
      {/* Stats Bar */}
      <div style={styles.statsBar}>
        <div style={styles.statGroup}>
          <span style={styles.statLabel}>SCORE</span>
          <span style={styles.statValue}>{score.toLocaleString()}</span>
        </div>
        <div style={styles.statGroup}>
          <span style={styles.statLabel}>LENGTH</span>
          <span style={styles.statValue}>{length}</span>
        </div>
        <div style={styles.statGroup}>
          <span style={styles.statLabel}>ORBS</span>
          <span style={styles.statValue}>
            {orbsRemaining} / {orbsTotal}
          </span>
        </div>
        <div style={styles.statGroup}>
          <span style={styles.statLabel}>{warpsLabel}</span>
          <span style={styles.statValue}>{warps}</span>
        </div>
        <div style={styles.statGroup}>
          <span style={styles.statLabel}>SPEED</span>
          <span style={styles.statValue}>{speed.toFixed(1)}x</span>
        </div>
        {wormCameraEnabled && (
          <div style={{...styles.statGroup, ...styles.cameraIndicator}}>
            <span style={styles.statLabel}>CAM</span>
            <span style={{...styles.statValue, color: '#ff6b6b'}}>WORM</span>
          </div>
        )}
      </div>

      {/* Control hint */}
      {isPlaying && (
        <div style={styles.hint}>
          {isTunnelMode
            ? 'WASD/QE to align tunnels | C for worm cam | Space to pause'
            : 'WASD/QE to rotate | C for worm cam | Space to pause'}
        </div>
      )}

      {/* Pause Overlay */}
      {isPaused && (
        <div style={styles.overlay}>
          <div style={styles.overlayContent}>
            <h2 style={styles.overlayTitle}>PAUSED</h2>
            <div style={styles.buttonGroup}>
              <button style={styles.button} onClick={onResume}>
                RESUME
              </button>
              <button style={styles.button} onClick={onRestart}>
                RESTART
              </button>
              <button style={{...styles.button, ...styles.quitButton}} onClick={onQuit}>
                QUIT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {isGameOver && (
        <div style={styles.overlay}>
          <div style={styles.overlayContent}>
            <h2 style={{...styles.overlayTitle, color: '#ef4444'}}>GAME OVER</h2>
            <p style={styles.overlayMessage}>
              {isTunnelMode ? 'Lost in the manifold!' : 'You collided with yourself!'}
            </p>
            <div style={styles.finalStats}>
              <div>Final Score: <strong>{score.toLocaleString()}</strong></div>
              <div>Length: <strong>{length}</strong></div>
              <div>Orbs Collected: <strong>{orbsTotal - orbsRemaining}</strong></div>
              <div>{isTunnelMode ? 'Tunnels Traversed' : 'Wormhole Warps'}: <strong>{warps}</strong></div>
            </div>
            <div style={styles.buttonGroup}>
              <button style={styles.button} onClick={onRestart}>
                TRY AGAIN
              </button>
              <button style={{...styles.button, ...styles.quitButton}} onClick={onQuit}>
                QUIT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory Overlay */}
      {isVictory && (
        <div style={styles.overlay}>
          <div style={styles.overlayContent}>
            <h2 style={{...styles.overlayTitle, color: '#22c55e'}}>VICTORY!</h2>
            <p style={styles.overlayMessage}>
              {isTunnelMode ? 'You conquered the wormhole network!' : 'All orbs collected!'}
            </p>
            <div style={styles.finalStats}>
              <div>Final Score: <strong>{score.toLocaleString()}</strong></div>
              <div>Final Length: <strong>{length}</strong></div>
              <div>{isTunnelMode ? 'Tunnels Traversed' : 'Wormhole Warps'}: <strong>{warps}</strong></div>
            </div>
            <div style={styles.buttonGroup}>
              <button style={styles.button} onClick={onRestart}>
                PLAY AGAIN
              </button>
              <button style={{...styles.button, ...styles.quitButton}} onClick={onQuit}>
                QUIT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Check if mobile
const isMobile = typeof window !== 'undefined' &&
  (window.innerWidth <= 768 || 'ontouchstart' in window);

const styles = {
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    pointerEvents: 'none',
    zIndex: 100,
    fontFamily: "'Courier New', monospace"
  },
  statsBar: {
    display: 'flex',
    justifyContent: 'center',
    gap: isMobile ? '12px' : '24px',
    padding: isMobile ? '8px 10px' : '12px 20px',
    background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 100%)',
    borderBottom: '2px solid #00ff88',
    flexWrap: 'wrap'
  },
  statGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px'
  },
  statLabel: {
    fontSize: isMobile ? '8px' : '10px',
    color: '#888',
    letterSpacing: '0.1em'
  },
  statValue: {
    fontSize: isMobile ? '14px' : '18px',
    color: '#00ff88',
    fontWeight: 'bold',
    textShadow: '0 0 10px #00ff88'
  },
  cameraIndicator: {
    background: 'rgba(255, 107, 107, 0.2)',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #ff6b6b'
  },
  hint: {
    position: 'absolute',
    bottom: '-40px',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: isMobile ? '10px' : '11px',
    color: '#666',
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
    display: isMobile ? 'none' : 'block' // Hide hint on mobile (touch controls are visible)
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto'
  },
  overlayContent: {
    textAlign: 'center',
    padding: '40px',
    background: 'rgba(20, 20, 20, 0.95)',
    borderRadius: '12px',
    border: '2px solid #00ff88',
    boxShadow: '0 0 30px rgba(0, 255, 136, 0.3)'
  },
  overlayTitle: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#00ff88',
    margin: '0 0 20px 0',
    textShadow: '0 0 20px currentColor'
  },
  overlayMessage: {
    fontSize: '16px',
    color: '#aaa',
    margin: '0 0 20px 0'
  },
  finalStats: {
    fontSize: '14px',
    color: '#888',
    lineHeight: '1.8',
    marginBottom: '24px'
  },
  buttonGroup: {
    display: 'flex',
    gap: isMobile ? '8px' : '12px',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  button: {
    padding: isMobile ? '14px 20px' : '12px 24px',
    fontSize: isMobile ? '12px' : '14px',
    fontFamily: "'Courier New', monospace",
    fontWeight: 'bold',
    color: '#00ff88',
    background: 'transparent',
    border: '2px solid #00ff88',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    letterSpacing: '0.1em',
    minWidth: isMobile ? '100px' : 'auto',
    touchAction: 'manipulation' // Prevent double-tap zoom on mobile
  },
  quitButton: {
    color: '#888',
    borderColor: '#888'
  }
};
