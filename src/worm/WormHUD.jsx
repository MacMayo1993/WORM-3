// src/worm/WormHUD.jsx
// HUD overlay for WORM mode - score, length, orbs, status

import React from 'react';

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function WormHUD({
  score,
  length,
  orbsRemaining,
  orbsTotal,
  orbsCollected = 0,
  warps,
  warpsLabel = 'WARPS', // 'WARPS' for surface mode, 'TUNNELS' for tunnel mode
  gameState, // 'playing', 'paused', 'gameover', 'victory'
  speed,
  wormCameraEnabled = false,
  mode = 'surface', // 'surface' or 'tunnel'
  timeAlive = 0,
  onPause,
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
        <div style={styles.statsLeft}>
          <div style={styles.statGroup}>
            <span style={styles.statLabel}>SCORE</span>
            <span style={styles.statValue}>{score.toLocaleString()}</span>
          </div>
          <div style={styles.statGroup}>
            <span style={styles.statLabel}>LENGTH</span>
            <span style={styles.statValue}>{length}</span>
          </div>
          <div style={styles.statGroup}>
            <span style={styles.statLabel}>TIME</span>
            <span style={styles.statValue}>{formatTime(timeAlive)}</span>
          </div>
          <div style={styles.statGroup}>
            <span style={styles.statLabel}>ORBS</span>
            <span style={styles.statValue}>{orbsCollected} / {orbsTotal}</span>
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

        {/* Pause button - always visible during active gameplay */}
        <button
          style={{
            ...styles.pauseButton,
            ...(isPaused ? styles.pauseButtonActive : {})
          }}
          onClick={isPaused ? onResume : onPause}
          title={isPaused ? 'Resume (Space)' : 'Pause (Space)'}
        >
          {isPaused ? '▶' : '⏸'}
        </button>
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
            <div style={styles.pauseStats}>
              <div style={styles.pauseStatRow}>
                <span style={styles.pauseStatLabel}>Time Alive</span>
                <span style={styles.pauseStatValue}>{formatTime(timeAlive)}</span>
              </div>
              <div style={styles.pauseStatRow}>
                <span style={styles.pauseStatLabel}>Orbs Collected</span>
                <span style={styles.pauseStatValue}>{orbsCollected} / {orbsTotal}</span>
              </div>
              <div style={styles.pauseStatRow}>
                <span style={styles.pauseStatLabel}>{warpsLabel === 'TUNNELS' ? 'Tunnels Traveled' : 'Wormholes Traveled'}</span>
                <span style={styles.pauseStatValue}>{warps}</span>
              </div>
            </div>
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
              <div>Time Alive: <strong>{formatTime(timeAlive)}</strong></div>
              <div>Length: <strong>{length}</strong></div>
              <div>Orbs Collected: <strong>{orbsCollected} / {orbsTotal}</strong></div>
              <div>{isTunnelMode ? 'Tunnels Traveled' : 'Wormholes Traveled'}: <strong>{warps}</strong></div>
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
              <div>Time Alive: <strong>{formatTime(timeAlive)}</strong></div>
              <div>Final Length: <strong>{length}</strong></div>
              <div>Orbs Collected: <strong>{orbsCollected} / {orbsTotal}</strong></div>
              <div>{isTunnelMode ? 'Tunnels Traveled' : 'Wormholes Traveled'}: <strong>{warps}</strong></div>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: isMobile ? '8px 10px' : '12px 16px',
    background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 100%)',
    borderBottom: '2px solid #00ff88'
  },
  statsLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: isMobile ? '10px' : '20px',
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
  pauseButton: {
    pointerEvents: 'auto',
    background: 'rgba(0, 255, 136, 0.1)',
    border: '2px solid #00ff88',
    borderRadius: '6px',
    color: '#00ff88',
    fontSize: isMobile ? '16px' : '20px',
    width: isMobile ? '36px' : '44px',
    height: isMobile ? '36px' : '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
    flexShrink: 0,
    touchAction: 'manipulation'
  },
  pauseButtonActive: {
    background: 'rgba(0, 255, 136, 0.25)',
    boxShadow: '0 0 12px rgba(0, 255, 136, 0.4)'
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
  pauseStats: {
    marginBottom: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  pauseStatRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '32px',
    fontSize: '14px'
  },
  pauseStatLabel: {
    color: '#888',
    textAlign: 'left'
  },
  pauseStatValue: {
    color: '#00ff88',
    fontWeight: 'bold',
    textAlign: 'right'
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
