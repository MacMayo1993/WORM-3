// src/worm/PlatformerHUD.jsx
// Dual HUD overlay for the co-op platformer WORM mode.
// Left half: Manifolder stats and controls.  Right half: Crawler stats.

import React from 'react';

const isMobile = typeof window !== 'undefined' &&
  (window.innerWidth <= 768 || 'ontouchstart' in window);

export default function PlatformerHUD({
  // Game state
  gameState,      // 'waiting' | 'countdown' | 'playing' | 'paused' | 'gameover' | 'victory'
  timer,
  // Crawler stats
  health,
  maxHealth,
  orbsCollected,
  orbsTotal,
  crawlerSpeed,
  crawlerFace,
  // Manifolder stats
  rotationCount,
  selectedSlice,
  selectedAxis,
  // Callbacks
  onPause: _onPause,
  onResume,
  onRestart,
  onQuit,
}) {
  const isPlaying = gameState === 'playing';
  const isPaused = gameState === 'paused';
  const isGameOver = gameState === 'gameover';
  const isVictory = gameState === 'victory';
  const isWaiting = gameState === 'waiting' || gameState === 'countdown';

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={styles.container}>
      {/* Top bar - shared stats */}
      <div style={styles.topBar}>
        {/* Left: Manifolder label */}
        <div style={styles.playerLabel}>
          <span style={styles.playerIcon}>&#9678;</span>
          <span style={{ color: '#60a5fa' }}>MANIFOLDER</span>
          <span style={styles.controls}>WASD+QE / 1-5</span>
        </div>

        {/* Center: timer + orbs */}
        <div style={styles.centerStats}>
          <div style={styles.stat}>
            <span style={styles.statLabel}>TIME</span>
            <span style={styles.statValue}>{formatTime(timer || 0)}</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statLabel}>ORBS</span>
            <span style={styles.statValue}>{orbsCollected || 0} / {orbsTotal || 0}</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statLabel}>ROTATIONS</span>
            <span style={styles.statValue}>{rotationCount || 0}</span>
          </div>
        </div>

        {/* Right: Crawler label */}
        <div style={{ ...styles.playerLabel, textAlign: 'right' }}>
          <span style={styles.controls}>Arrows + Space</span>
          <span style={{ color: '#00ff88' }}>CRAWLER</span>
          <span style={styles.playerIcon}>&#9679;</span>
        </div>
      </div>

      {/* Health hearts (right side, below top bar) */}
      {isPlaying && (
        <div style={styles.healthBar}>
          {Array.from({ length: maxHealth || 3 }).map((_, i) => (
            <span key={i} style={{
              ...styles.heart,
              opacity: i < (health || 0) ? 1 : 0.2,
              filter: i < (health || 0) ? 'none' : 'grayscale(1)',
            }}>
              &#9829;
            </span>
          ))}
        </div>
      )}

      {/* Manifolder slice indicator (left side) */}
      {isPlaying && (
        <div style={styles.sliceIndicator}>
          <div style={styles.sliceLabel}>Slice {selectedSlice || 0}</div>
          <div style={styles.axisLabel}>{selectedAxis || 'col'}</div>
        </div>
      )}

      {/* Crawler face indicator (right side) */}
      {isPlaying && (
        <div style={styles.faceIndicator}>
          <div style={styles.faceLabel}>Face: {crawlerFace || '?'}</div>
          <div style={styles.speedLabel}>{(crawlerSpeed || 0).toFixed(1)} m/s</div>
        </div>
      )}

      {/* Control hints (bottom center) */}
      {isPlaying && !isMobile && (
        <div style={styles.hints}>
          <span style={{ color: '#60a5fa' }}>P1: WASD rotate | QE depth | 1-5 slice | Tab axis</span>
          <span style={{ color: '#555' }}> | </span>
          <span style={{ color: '#00ff88' }}>P2: Arrows move | Space jump | Shift sprint</span>
        </div>
      )}

      {/* Waiting / countdown overlay */}
      {isWaiting && (
        <div style={styles.overlay}>
          <div style={styles.overlayBox}>
            <h2 style={{ ...styles.overlayTitle, color: '#60a5fa' }}>CO-OP CRAWLER</h2>
            <p style={styles.overlayText}>
              <strong style={{ color: '#60a5fa' }}>Player 1 (Manifolder):</strong> Rotate the cube with WASD + QE
            </p>
            <p style={styles.overlayText}>
              <strong style={{ color: '#00ff88' }}>Player 2 (Crawler):</strong> Navigate the surface with Arrow Keys
            </p>
            <p style={{ ...styles.overlayText, marginTop: '16px' }}>
              Collect all orbs to win. Parity zones deal damage!
            </p>
            <button style={styles.startButton} onClick={onResume}>
              PRESS TO START
            </button>
          </div>
        </div>
      )}

      {/* Pause overlay */}
      {isPaused && (
        <div style={styles.overlay}>
          <div style={styles.overlayBox}>
            <h2 style={styles.overlayTitle}>PAUSED</h2>
            <div style={styles.buttonRow}>
              <button style={styles.btn} onClick={onResume}>RESUME</button>
              <button style={styles.btn} onClick={onRestart}>RESTART</button>
              <button style={{ ...styles.btn, ...styles.btnQuit }} onClick={onQuit}>QUIT</button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over */}
      {isGameOver && (
        <div style={styles.overlay}>
          <div style={styles.overlayBox}>
            <h2 style={{ ...styles.overlayTitle, color: '#ef4444' }}>GAME OVER</h2>
            <p style={styles.overlayText}>The WORM ran out of health!</p>
            <div style={styles.finalStats}>
              <div>Time: <strong>{formatTime(timer || 0)}</strong></div>
              <div>Orbs: <strong>{orbsCollected || 0} / {orbsTotal || 0}</strong></div>
              <div>Rotations: <strong>{rotationCount || 0}</strong></div>
            </div>
            <div style={styles.buttonRow}>
              <button style={styles.btn} onClick={onRestart}>TRY AGAIN</button>
              <button style={{ ...styles.btn, ...styles.btnQuit }} onClick={onQuit}>QUIT</button>
            </div>
          </div>
        </div>
      )}

      {/* Victory */}
      {isVictory && (
        <div style={styles.overlay}>
          <div style={{ ...styles.overlayBox, borderColor: '#22c55e', boxShadow: '0 0 40px rgba(34, 197, 94, 0.4)' }}>
            <h2 style={{ ...styles.overlayTitle, color: '#22c55e' }}>VICTORY!</h2>
            <p style={styles.overlayText}>All orbs collected! The manifold is conquered!</p>
            <div style={styles.finalStats}>
              <div>Time: <strong>{formatTime(timer || 0)}</strong></div>
              <div>Rotations: <strong>{rotationCount || 0}</strong></div>
              <div>Health remaining: <strong>{health || 0} / {maxHealth || 3}</strong></div>
            </div>
            <div style={styles.buttonRow}>
              <button style={styles.btn} onClick={onRestart}>PLAY AGAIN</button>
              <button style={{ ...styles.btn, ...styles.btnQuit }} onClick={onQuit}>QUIT</button>
            </div>
          </div>
        </div>
      )}

      {/* Vertical split line */}
      {isPlaying && <div style={styles.splitLine} />}
    </div>
  );
}

const styles = {
  container: {
    position: 'absolute', inset: 0,
    pointerEvents: 'none',
    zIndex: 100,
    fontFamily: "'Courier New', monospace",
  },
  topBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: isMobile ? '6px 8px' : '8px 16px',
    background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 100%)',
    borderBottom: '1px solid rgba(100, 100, 255, 0.3)',
  },
  playerLabel: {
    display: 'flex', alignItems: 'center', gap: '8px',
    fontSize: isMobile ? '10px' : '12px',
    fontWeight: 600, letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  playerIcon: {
    fontSize: '16px',
  },
  controls: {
    fontSize: '9px', color: '#555', letterSpacing: '0.05em',
  },
  centerStats: {
    display: 'flex', gap: isMobile ? '12px' : '24px',
  },
  stat: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px',
  },
  statLabel: {
    fontSize: '9px', color: '#666', letterSpacing: '0.1em',
  },
  statValue: {
    fontSize: isMobile ? '14px' : '16px', color: '#ddd', fontWeight: 'bold',
  },
  healthBar: {
    position: 'absolute', top: isMobile ? '44px' : '50px', right: '16px',
    display: 'flex', gap: '4px',
  },
  heart: {
    fontSize: '20px', color: '#ef4444',
    textShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
  },
  sliceIndicator: {
    position: 'absolute', top: isMobile ? '44px' : '50px', left: '16px',
    fontSize: '11px', color: '#60a5fa',
    background: 'rgba(0,0,0,0.5)', padding: '4px 10px', borderRadius: '4px',
    border: '1px solid rgba(96, 165, 250, 0.3)',
  },
  sliceLabel: { fontWeight: 'bold' },
  axisLabel: { fontSize: '9px', color: '#888' },
  faceIndicator: {
    position: 'absolute', top: isMobile ? '70px' : '78px', right: '16px',
    fontSize: '11px', color: '#00ff88',
    background: 'rgba(0,0,0,0.5)', padding: '4px 10px', borderRadius: '4px',
    border: '1px solid rgba(0, 255, 136, 0.3)',
  },
  faceLabel: { fontWeight: 'bold' },
  speedLabel: { fontSize: '9px', color: '#888' },
  hints: {
    position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)',
    fontSize: '10px', color: '#555', whiteSpace: 'nowrap',
  },
  splitLine: {
    position: 'absolute', top: 0, bottom: 0, left: '50%',
    width: '2px',
    background: 'linear-gradient(180deg, rgba(100,100,255,0.4) 0%, rgba(100,100,255,0.1) 50%, rgba(100,100,255,0.4) 100%)',
    pointerEvents: 'none',
  },
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'auto', zIndex: 200,
  },
  overlayBox: {
    textAlign: 'center', padding: isMobile ? '24px' : '40px',
    background: 'rgba(20, 20, 30, 0.95)',
    borderRadius: '12px',
    border: '2px solid #60a5fa',
    boxShadow: '0 0 30px rgba(96, 165, 250, 0.3)',
    maxWidth: '500px', width: '90%',
  },
  overlayTitle: {
    fontSize: '32px', fontWeight: 'bold', color: '#60a5fa',
    margin: '0 0 20px 0', textShadow: '0 0 20px currentColor',
  },
  overlayText: {
    fontSize: '14px', color: '#aaa', margin: '8px 0', lineHeight: '1.6',
  },
  finalStats: {
    fontSize: '14px', color: '#888', lineHeight: '1.8', marginBottom: '20px',
  },
  startButton: {
    marginTop: '20px', padding: '16px 40px',
    fontSize: '16px', fontFamily: "'Courier New', monospace",
    fontWeight: 'bold', letterSpacing: '0.1em',
    color: '#00ff88', background: 'rgba(0, 255, 136, 0.15)',
    border: '2px solid #00ff88', borderRadius: '8px',
    cursor: 'pointer', transition: 'all 0.3s',
    textShadow: '0 0 10px #00ff88',
  },
  buttonRow: {
    display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap',
  },
  btn: {
    padding: '12px 24px', fontSize: '14px',
    fontFamily: "'Courier New', monospace", fontWeight: 'bold',
    color: '#60a5fa', background: 'transparent',
    border: '2px solid #60a5fa', borderRadius: '6px',
    cursor: 'pointer', letterSpacing: '0.1em',
  },
  btnQuit: {
    color: '#888', borderColor: '#555',
  },
};
